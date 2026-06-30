import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
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
  const { data, error } = await supabase
    .from("messages")
    .insert({
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
      const { error: removeError } = await supabase.storage.from("chat-media").remove(paths);
      if (removeError) {
        return Response.json({ error: removeError.message }, { status: 500 });
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
