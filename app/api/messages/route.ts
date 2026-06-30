import { NextRequest } from "next/server";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidVisitorId(value: string) {
  return /^[a-zA-Z0-9_-]{8,120}$/.test(value);
}

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId")?.trim();
  if (!visitorId || !isValidVisitorId(visitorId)) {
    return Response.json({ error: "visitorId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("is_deleted", false)
    .or(
      `and(sender_kind.eq.admin,visibility.eq.public),and(sender_kind.eq.user,visibility.eq.private,visitor_id.eq.${visitorId})`,
    )
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ messages: [] });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ messages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    visitorId?: string;
    nickname?: string;
    contentText?: string;
  } | null;

  const visitorId = normalizeText(body?.visitorId, 120);
  const nickname = normalizeText(body?.nickname, 40);
  const contentText = normalizeText(body?.contentText, 2000);

  if (!visitorId || !isValidVisitorId(visitorId) || !nickname || !contentText) {
    return Response.json({ error: "visitorId, nickname, and contentText are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_kind: "user",
      visibility: "private",
      visitor_id: visitorId,
      nickname,
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
