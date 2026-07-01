import { NextRequest } from "next/server";
import { requireIdol } from "@/lib/idolAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import type { MessageType } from "@/lib/types";

export async function POST(request: NextRequest) {
  const session = await requireIdol();
  if (session instanceof Response) return session;
  const idolId = session.idolId;

  const body = (await request.json().catch(() => null)) as {
    type?: MessageType;
    mediaPath?: string;
    motionVideoPath?: string;
    mediaDuration?: number;
    contentText?: string;
  } | null;

  const type = body?.type;
  const mediaPath = body?.mediaPath ?? null;
  const motionVideoPath = body?.motionVideoPath ?? null;
  const mediaDuration = body?.mediaDuration ?? null;
  const contentText = typeof body?.contentText === "string"
    ? body.contentText.trim().slice(0, 1000) || null
    : null;

  if (!type) return Response.json({ error: "type is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      idol_id: idolId,
      sender_kind: "admin",
      visibility: "public",
      type,
      content_text: contentText,
      media_path: mediaPath,
      motion_video_path: motionVideoPath,
      media_duration: type === "voice" ? mediaDuration : null,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ message: data });
}
