import type { MessageType } from "@/lib/types";

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const voiceTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-m4a",
  "video/mp4",
  "video/quicktime",
]);

export function inferMessageType(file: File, requestedType?: FormDataEntryValue | null): MessageType {
  if (
    requestedType === "image" ||
    requestedType === "gif" ||
    requestedType === "voice" ||
    requestedType === "video" ||
    requestedType === "motion"
  ) {
    return requestedType;
  }

  if (file.type === "image/gif") return "gif";
  if (imageTypes.has(file.type)) return "image";
  if (voiceTypes.has(file.type)) return "voice";
  return "image";
}

export function allowedAdminUpload(file: File, type: MessageType) {
  if (type === "gif") return file.type === "image/gif";
  if (type === "image") return imageTypes.has(file.type) && file.type !== "image/gif";
  if (type === "voice") return voiceTypes.has(file.type);
  // 实况：接受 JPEG（含实况）以及任意 octet-stream（文件管理器有时报这个 MIME）
  if (type === "motion") return file.type === "image/jpeg" || file.type === "application/octet-stream" || file.type === "";
  return false;
}

export function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match ? match[1] : "bin";
}
