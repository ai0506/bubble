import { getIdolSession } from "@/lib/idolAuth";
import { getIdolById } from "@/lib/idols";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const idolId = await getIdolSession();
  if (!idolId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const idol = await getIdolById(supabase, idolId);
  if (!idol || !idol.is_active) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    idol: {
      id: idol.id,
      handle: idol.handle,
      display_name: idol.display_name,
      avatar_path: idol.avatar_path,
      bio: idol.bio,
    },
  });
}
