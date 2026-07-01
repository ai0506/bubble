import { randomUUID } from "crypto";
import { requireIdol } from "@/lib/idolAuth";
import { extensionFromName } from "@/lib/media";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SELECT_FIELDS = "id, handle, display_name, avatar_path, bio, is_active, created_at";
const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// 爱豆自助修改显示名 / 头像
export async function PATCH(request: Request) {
  const session = await requireIdol();
  if (session instanceof Response) return session;
  const idolId = session.idolId;

  const formData = await request.formData();
  const displayNameRaw = formData.get("displayName");
  const avatarFile = formData.get("avatar");

  const updates: Record<string, unknown> = {};
  if (typeof displayNameRaw === "string" && displayNameRaw.trim()) {
    updates.display_name = displayNameRaw.trim().slice(0, 40);
  }

  const supabase = getSupabaseAdmin();
  let uploadedPath: string | null = null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!AVATAR_TYPES.has(avatarFile.type)) {
      return Response.json({ error: "头像仅支持 JPG / PNG / WEBP" }, { status: 400 });
    }
    const extension = extensionFromName(avatarFile.name) || "jpg";
    uploadedPath = `avatars/${idolId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(uploadedPath, avatarFile, { contentType: avatarFile.type, upsert: false });
    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }
    updates.avatar_path = uploadedPath;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const { data: previous } = await supabase
    .from("idols")
    .select("avatar_path")
    .eq("id", idolId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("idols")
    .update(updates)
    .eq("id", idolId)
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    if (uploadedPath) await supabase.storage.from("chat-media").remove([uploadedPath]);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 头像替换成功后清理旧文件，避免孤立文件占用存储
  if (uploadedPath && previous?.avatar_path && previous.avatar_path !== uploadedPath) {
    await supabase.storage.from("chat-media").remove([previous.avatar_path]);
  }

  return Response.json({ idol: data });
}
