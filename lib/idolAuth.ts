import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const IDOL_COOKIE_NAME = "bubble_idol_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type IdolPayload = {
  purpose: "idol";
  idolId: string;
  exp: number;
};

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET.");
  return secret;
}

function base64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

// —— 爱豆密码哈希（scrypt，格式 "<saltHex>:<hashHex>"）——
export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// —— 爱豆会话 token（HMAC 签名，携带 idolId）——
export function createIdolSessionToken(idolId: string) {
  const payload: IdolPayload = {
    purpose: "idol",
    idolId,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyIdolSessionToken(token?: string): string | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as IdolPayload;
    if (payload.purpose !== "idol" || payload.exp <= Date.now() || !payload.idolId) return null;
    return payload.idolId;
  } catch {
    return null;
  }
}

// 返回当前登录爱豆的 idolId，未登录返回 null。
export async function getIdolSession() {
  const cookieStore = await cookies();
  return verifyIdolSessionToken(cookieStore.get(IDOL_COOKIE_NAME)?.value);
}

// 供 /api/idol/* 复用：未登录返回 401 Response，已登录返回 { idolId }。
export async function requireIdol(): Promise<{ idolId: string } | Response> {
  const idolId = await getIdolSession();
  if (!idolId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { idolId };
}
