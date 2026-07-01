import { NextRequest } from "next/server";
import { resolveWritableIdolId } from "@/lib/idols";
import { isNicknameLengthValid, isUserMessageLengthValid, NICKNAME_MAX_LENGTH, USER_MESSAGE_MAX_LENGTH } from "@/lib/limits";
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

  // 过渡期：未传 idolId 时回退到默认爱豆 asw；粉丝端稳定后再改为必传。
  const requestedIdolId = request.nextUrl.searchParams.get("idolId")?.trim() || null;
  const idolId = await resolveWritableIdolId(supabase, requestedIdolId);
  if (!idolId) {
    return Response.json({ error: "No idol available" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("is_deleted", false)
    .eq("idol_id", idolId)
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
    idolId?: string;
  } | null;

  const visitorId = normalizeText(body?.visitorId, 120);
  const nickname = normalizeText(body?.nickname, NICKNAME_MAX_LENGTH);
  const contentText = normalizeText(body?.contentText, USER_MESSAGE_MAX_LENGTH + 1);

  if (!visitorId || !isValidVisitorId(visitorId) || !nickname || !contentText) {
    return Response.json({ error: "visitorId, nickname, and contentText are required" }, { status: 400 });
  }
  if (!isNicknameLengthValid(nickname)) {
    return Response.json({ error: "Nickname must be 3 to 12 characters." }, { status: 400 });
  }
  if (!isUserMessageLengthValid(contentText)) {
    return Response.json({ error: "Message must be 300 characters or fewer." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 过渡期：未传 idolId 时回退到默认爱豆 asw。
  const idolId = await resolveWritableIdolId(supabase, normalizeText(body?.idolId, 80) || null);
  if (!idolId) {
    return Response.json({ error: "No idol available" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      idol_id: idolId,
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
