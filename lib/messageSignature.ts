import type { ChatMessage } from "@/lib/types";

// 轮询拉取后用来判断消息列表是否真的变了：一致则复用旧数组引用，
// 避免无谓的重渲染与滚动。纳入会影响展示的字段（含语音文字稿）。
export function getMessagesSignature(messages: ChatMessage[]) {
  return messages
    .map((message) =>
      [
        message.id,
        message.created_at,
        message.type,
        message.content_text || "",
        message.media_path || "",
        message.motion_video_path || "",
        message.voice_transcript || "",
        message.is_deleted ? "1" : "0",
      ].join(":"),
    )
    .join("|");
}
