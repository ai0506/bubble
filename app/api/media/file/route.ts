import { NextRequest } from "next/server";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const mediaPath = request.nextUrl.searchParams.get("mediaPath")?.trim() || "";
  const widthValue = Number(request.nextUrl.searchParams.get("width") || "0");
  const width = Number.isFinite(widthValue) && widthValue > 0 ? Math.min(Math.round(widthValue), 900) : null;

  if (!mediaPath) {
    return Response.json({ error: "mediaPath is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  // The path may be a still image (media_path) or a motion video (motion_video_path).
  let { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, media_path, is_deleted")
    .eq("media_path", mediaPath)
    .eq("is_deleted", false)
    .maybeSingle();

  if (!messageError && !message) {
    ({ data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, media_path, is_deleted")
      .eq("motion_video_path", mediaPath)
      .eq("is_deleted", false)
      .maybeSingle());
  }

  if (messageError) {
    if (isMissingMessagesTable(messageError)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: messageError.message }, { status: 500 });
  }

  if (!message) {
    return Response.json({ error: "Media not found" }, { status: 404 });
  }

  const isImage = /\.(gif|png|jpe?g|webp)$/i.test(mediaPath);
  const options = width && isImage ? { transform: { width, resize: "contain" as const } } : undefined;
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(mediaPath, 60 * 5, options);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const mediaResponse = await fetch(data.signedUrl, { headers });
  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const value = mediaResponse.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  responseHeaders.set("Cache-Control", "private, max-age=300");

  return new Response(mediaResponse.body, {
    status: mediaResponse.status,
    headers: responseHeaders,
  });
}
