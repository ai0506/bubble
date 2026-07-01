import { isMissingMessagesTable } from "@/lib/supabaseErrors";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// 粉丝端发现页用：列出所有启用的爱豆（不含 password_hash）。
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("idols")
    .select("id, handle, display_name, avatar_path, bio, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingMessagesTable(error)) {
      return Response.json({ idols: [] });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ idols: data ?? [] });
}
