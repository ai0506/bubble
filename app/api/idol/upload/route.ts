import { randomUUID } from "crypto";
import { requireIdol } from "@/lib/idolAuth";
import { allowedAdminUpload, extensionFromName, inferMessageType } from "@/lib/media";
import { deleteObjects, uploadObject } from "@/lib/objectStorage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

export async function POST(request: Request) {
  const session = await requireIdol();
  if (session instanceof Response) return session;
  const idolId = session.idolId;

  const formData = await request.formData();
  const requestedType = formData.get("type");
  const contentText = normalizeOptionalText(formData.get("contentText"), 1000);
  const voiceTranscript = normalizeOptionalText(formData.get("voiceTranscript"), 2000);
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

    const base = `${idolId}/motion/${today}/${randomUUID()}`;
    const stillExt = extensionFromName(file.name) || "jpg";
    const videoExt = extensionFromName(motionVideo.name) || "mp4";
    const stillPath = `${base}.${stillExt}`;
    const videoPath = `${base}_video.${videoExt}`;

    try {
      await uploadObject({ key: stillPath, file, contentType: file.type || "image/jpeg" });
      await uploadObject({ key: videoPath, file: motionVideo, contentType: motionVideo.type || "video/mp4" });
    } catch (error) {
      await deleteObjects([stillPath]).catch(() => undefined);
      return Response.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        idol_id: idolId,
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
      await deleteObjects([stillPath, videoPath]).catch(() => undefined);
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
  const mediaPath = `${idolId}/${type}/${today}/${randomUUID()}.${extension}`;

  try {
    await uploadObject({ key: mediaPath, file, contentType: file.type || "application/octet-stream" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      idol_id: idolId,
      sender_kind: "admin",
      visibility: "public",
      type,
      content_text: contentText,
      media_path: mediaPath,
      media_duration: type === "voice" ? mediaDuration : null,
      voice_transcript: type === "voice" ? voiceTranscript : null,
    })
    .select("*")
    .single();

  if (error) {
    // 数据库插入失败时清理已上传文件，避免孤立文件
    await deleteObjects([mediaPath]).catch(() => undefined);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ message: data });
}
