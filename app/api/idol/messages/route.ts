import { requireIdol } from "@/lib/idolAuth";
import { deleteObjects } from "@/lib/objectStorage";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// 爱豆频道「大群」：本爱豆的全部消息（自己的公开广播 + 所有粉丝发来的私信），时间升序。
export async function GET() {
  const session = await requireIdol();
  if (session instanceof Response) return session;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("is_deleted", false)
    .eq("idol_id", session.idolId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ messages: [] });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ messages: data ?? [] });
}

// 爱豆发文字广播（对本频道所有粉丝公开）。
export async function POST(request: Request) {
  const session = await requireIdol();
  if (session instanceof Response) return session;

  const body = (await request.json().catch(() => null)) as { contentText?: string } | null;
  const contentText = normalizeText(body?.contentText, 4000);
  if (!contentText) {
    return Response.json({ error: "contentText is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      idol_id: session.idolId,
      sender_kind: "admin",
      visibility: "public",
      type: "text",
      content_text: contentText,
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

// 只允许爱豆修改自己语音消息的文字稿，不开放通用消息编辑。
export async function PATCH(request: Request) {
  const session = await requireIdol();
  if (session instanceof Response) return session;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    voiceTranscript?: string;
  } | null;
  const id = normalizeText(body?.id, 80);
  const voiceTranscript = normalizeText(body?.voiceTranscript, 2000) || null;
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: message, error: fetchError } = await supabase
    .from("messages")
    .select("id,idol_id,sender_kind,type")
    .eq("id", id)
    .eq("idol_id", session.idolId)
    .maybeSingle();

  if (fetchError) {
    if (isMissingMessagesTable(fetchError)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }
  if (message.sender_kind !== "admin" || message.type !== "voice") {
    return Response.json({ error: "Only idol voice messages can be updated" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ voice_transcript: voiceTranscript })
    .eq("id", id)
    .eq("idol_id", session.idolId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ message: data });
}

// 删除本频道内的消息（自己的广播或粉丝私信均可），强制限定 idol_id 防跨频道删除。
export async function DELETE(request: Request) {
  const session = await requireIdol();
  if (session instanceof Response) return session;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = normalizeText(body?.id, 80);
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 先取消息并校验归属，再删 Storage 文件、删行（硬删除，避免孤立文件）。
  const { data: message, error: fetchError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", id)
    .eq("idol_id", session.idolId)
    .maybeSingle();

  if (fetchError) {
    if (isMissingMessagesTable(fetchError)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!message) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  const paths = [message.media_path, message.motion_video_path].filter(
    (path): path is string => Boolean(path),
  );
  if (paths.length > 0) {
    try {
      await deleteObjects(paths);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Delete media failed" }, { status: 500 });
    }
  }

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", id)
    .eq("idol_id", session.idolId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
