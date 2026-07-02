export type MessageType = "text" | "image" | "gif" | "voice" | "video" | "motion";
export type MessageSenderKind = "admin" | "user";
export type MessageVisibility = "public" | "private";

export type ChatMessage = {
  id: string;
  idol_id: string;
  sender_kind: MessageSenderKind;
  visibility: MessageVisibility;
  visitor_id: string | null;
  nickname: string | null;
  type: MessageType;
  content_text: string | null;
  media_path: string | null;
  motion_video_path: string | null;
  media_duration: number | null;
  voice_transcript: string | null;
  created_at: string;
  is_deleted: boolean;
};

export type Idol = {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
};

export type SignedMedia = {
  path: string;
  url: string;
};
