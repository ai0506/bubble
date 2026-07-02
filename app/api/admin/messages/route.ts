import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveWritableIdolId } from "@/lib/idols";
import { deleteObjects } from "@/lib/objectStorage";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { MessageType } from "@/lib/types";

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ messages: [] });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ messages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    type?: MessageType;
    contentText?: string;
  } | null;

  const type = body?.type;
  const contentText = normalizeText(body?.contentText, 4000);

  if (type !== "text" || !contentText) {
    return Response.json({ error: "Only text messages are supported here" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const idolId = await resolveWritableIdolId(supabase, null);
  if (!idolId) {
    return Response.json({ error: "No idol available" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      idol_id: idolId,
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

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

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
    .select("id,sender_kind,type")
    .eq("id", id)
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

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = normalizeText(body?.id, 80);
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 硬删除：先查出该消息引用的媒体路径，删掉 Storage 文件后再删数据库行，
  // 避免桶里堆积没有任何消息引用的孤立文件。用 select("*") 以兼容尚未执行
  // motion-photo.sql、缺少 motion_video_path 列的库。
  const { data: message, error: fetchError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    if (isMissingMessagesTable(fetchError)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (message) {
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
  }

  const { error } = await supabase.from("messages").delete().eq("id", id);

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ error: "Database schema has not been applied yet." }, { status: 503 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
