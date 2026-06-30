import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, createAdminSessionToken } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || body?.password !== expected) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  // Mark the cookie Secure only when the request actually arrived over HTTPS.
  // This keeps real deployments secure while allowing testing from a phone over
  // plain http://<LAN-IP> (a non-secure context that would drop a Secure cookie).
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttps = forwardedProto
    ? forwardedProto.split(",")[0].trim() === "https"
    : new URL(request.url).protocol === "https:";

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return Response.json({ ok: true });
}
