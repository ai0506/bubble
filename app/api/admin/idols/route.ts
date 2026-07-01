import { requireAdmin } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/idolAuth";
import { IDOL_HANDLE_PATTERN } from "@/lib/idols";
import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_FIELDS = "id, handle, display_name, avatar_path, bio, is_active, created_at";

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// 列出全部爱豆（含停用）
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("idols")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ idols: [] });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ idols: data ?? [] });
}

// 创建爱豆
export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    handle?: string;
    displayName?: string;
    password?: string;
    bio?: string;
  } | null;

  const handle = normalizeText(body?.handle, 32).toLowerCase();
  const displayName = normalizeText(body?.displayName, 40);
  const password = typeof body?.password === "string" ? body.password : "";
  const bio = normalizeText(body?.bio, 200) || null;

  if (!IDOL_HANDLE_PATTERN.test(handle)) {
    return Response.json({ error: "handle 需为 2-32 位小写字母、数字、_ 或 -" }, { status: 400 });
  }
  if (!displayName) {
    return Response.json({ error: "displayName is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("idols")
    .insert({ handle, display_name: displayName, password_hash: hashPassword(password), bio })
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return Response.json({ error: "该 handle 已被占用" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ idol: data });
}

// 更新爱豆：改名 / 启用停用 / 重置密码 / 简介
export async function PATCH(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    displayName?: string;
    isActive?: boolean;
    password?: string;
    bio?: string;
  } | null;

  const id = normalizeText(body?.id, 80);
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body?.displayName === "string") {
    const displayName = normalizeText(body.displayName, 40);
    if (!displayName) return Response.json({ error: "displayName is required" }, { status: 400 });
    updates.display_name = displayName;
  }
  if (typeof body?.isActive === "boolean") {
    updates.is_active = body.isActive;
  }
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 6) return Response.json({ error: "密码至少 6 位" }, { status: 400 });
    updates.password_hash = hashPassword(body.password);
  }
  if (typeof body?.bio === "string") {
    updates.bio = normalizeText(body.bio, 200) || null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("idols")
    .update(updates)
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ idol: data });
}

// 删除爱豆：先清理其全部消息的 Storage 媒体，再删行（级联删消息）
export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = normalizeText(body?.id, 80);
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: rows, error: fetchError } = await supabase
    .from("messages")
    .select("media_path, motion_video_path")
    .eq("idol_id", id);

  if (fetchError && !isMissingMessagesTable(fetchError)) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  const paths = (rows ?? [])
    .flatMap((row) => [row.media_path, row.motion_video_path])
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from("chat-media").remove(paths);
    if (removeError) {
      return Response.json({ error: removeError.message }, { status: 500 });
    }
  }

  const { error } = await supabase.from("idols").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
