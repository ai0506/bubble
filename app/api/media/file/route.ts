import { NextRequest } from "next/server";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { createSignedReadUrl } from "@/lib/objectStorage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getErrorField(error: unknown, field: "code" | "message" | "status" | "requestId") {
  if (error && typeof error === "object" && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" || typeof value === "number" ? value : undefined;
  }
  if (field === "message" && error instanceof Error) return error.message;
  return undefined;
}

function logOssError(error: unknown, mediaPath: string) {
  console.error("[media/file] OSS signed URL failed", {
    mediaPath,
    code: getErrorField(error, "code"),
    message: getErrorField(error, "message"),
    status: getErrorField(error, "status"),
    requestId: getErrorField(error, "requestId"),
  });
}

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
  let signedUrl: string;
  try {
    signedUrl = await createSignedReadUrl({
      key: mediaPath,
      expiresInSeconds: 60 * 60,
      contentTypeHint: width && isImage ? "image" : undefined,
    });
  } catch (error) {
    logOssError(error, mediaPath);
    return Response.json({ error: error instanceof Error ? error.message : "Create signed URL failed" }, { status: 500 });
  }

  return Response.redirect(signedUrl, 302);
}
