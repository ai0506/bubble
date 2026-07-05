import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { createSignedReadUrl } from "@/lib/objectStorage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { mediaPath?: string; width?: number } | null;
  const mediaPath = typeof body?.mediaPath === "string" ? body.mediaPath.trim() : "";
  const width = typeof body?.width === "number" && body.width > 0 ? Math.min(Math.round(body.width), 900) : null;
  // 仅对静态位图缩略；GIF 不处理以保留动图
  const isResizable = /\.(png|jpe?g|webp)$/i.test(mediaPath);

  if (!mediaPath) {
    return Response.json({ error: "mediaPath is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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

  try {
    const url = await createSignedReadUrl({
      key: mediaPath,
      expiresInSeconds: 60 * 60,
      resizeWidth: width && isResizable ? width : undefined,
    });
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Create signed URL failed" }, { status: 500 });
  }
}
