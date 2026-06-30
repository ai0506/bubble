import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { allowedAdminUpload, extensionFromName, inferMessageType } from "@/lib/media";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const requestedType = formData.get("type");
  const contentText = String(formData.get("contentText") || "").trim().slice(0, 1000) || null;
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // 实况：封面图 + 动态视频两个文件
  if (requestedType === "motion") {
    const file = formData.get("file");
    const motionVideo = formData.get("motionVideo");
    if (!(file instanceof File) || !(motionVideo instanceof File)) {
      return Response.json({ error: "实况模式需要同时上传封面图和动态视频" }, { status: 400 });
    }
    const isVideo = motionVideo.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/i.test(motionVideo.name);
    if (!isVideo) {
      return Response.json({ error: `视频请选 .mp4 文件，不是图片（当前：${motionVideo.name}）` }, { status: 400 });
    }

    const base = `motion/${today}/${randomUUID()}`;
    const stillExt = extensionFromName(file.name) || "jpg";
    const videoExt = extensionFromName(motionVideo.name) || "mp4";
    const stillPath = `${base}.${stillExt}`;
    const videoPath = `${base}_video.${videoExt}`;

    const stillUpload = await supabase.storage
      .from("chat-media")
      .upload(stillPath, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (stillUpload.error) {
      return Response.json({ error: stillUpload.error.message }, { status: 500 });
    }

    const videoUpload = await supabase.storage
      .from("chat-media")
      .upload(videoPath, motionVideo, { contentType: motionVideo.type || "video/mp4", upsert: false });
    if (videoUpload.error) {
      await supabase.storage.from("chat-media").remove([stillPath]);
      return Response.json({ error: videoUpload.error.message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_kind: "admin",
        visibility: "public",
        type: "motion",
        content_text: contentText,
        media_path: stillPath,
        motion_video_path: videoPath,
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from("chat-media").remove([stillPath, videoPath]);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ message: data });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  const type = inferMessageType(file, requestedType);
  if (!allowedAdminUpload(file, type)) {
    return Response.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const durationValue = Number(String(formData.get("mediaDuration") || "0"));
  const mediaDuration = Number.isFinite(durationValue) && durationValue > 0 ? Math.round(durationValue) : null;

  const extension = extensionFromName(file.name);
  const mediaPath = `${type}/${today}/${randomUUID()}.${extension}`;

  const upload = await supabase.storage.from("chat-media").upload(mediaPath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (upload.error) {
    return Response.json({ error: upload.error.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_kind: "admin",
      visibility: "public",
      type,
      content_text: contentText,
      media_path: mediaPath,
      media_duration: type === "voice" ? mediaDuration : null,
    })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ message: data });
}
