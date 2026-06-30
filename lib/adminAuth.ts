import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "bubble_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type AdminPayload = {
  purpose: "admin";
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

export function createAdminSessionToken() {
  const payload: AdminPayload = {
    purpose: "admin",
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAdminSessionToken(token?: string) {
  if (!token) return false;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expected = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminPayload;
    return payload.purpose === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdminRequest() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  const isAdmin = await isAdminRequest();
  if (!isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
