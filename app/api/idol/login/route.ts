import { cookies } from "next/headers";
import { createIdolSessionToken, IDOL_COOKIE_NAME, verifyPassword } from "@/lib/idolAuth";
import { getIdolByHandle } from "@/lib/idols";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { handle?: string; password?: string } | null;
  const handle = typeof body?.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!handle || !password) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const idol = await getIdolByHandle(supabase, handle);
  if (!idol || !idol.is_active || !verifyPassword(password, idol.password_hash)) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // 仅在请求确实走 HTTPS 时标记 Secure，兼容手机通过 http://<LAN-IP> 测试。
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : new URL(request.url).protocol === "https:";

  const cookieStore = await cookies();
  cookieStore.set(IDOL_COOKIE_NAME, createIdolSessionToken(idol.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 12,
  });

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
