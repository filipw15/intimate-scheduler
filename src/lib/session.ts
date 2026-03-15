import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const secure = (process.env.BASE_URL ?? "").startsWith("https://");
  const attrs = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  };
  console.log("[session] setSessionCookie attrs:", { secure, sameSite: attrs.sameSite, maxAge: attrs.maxAge });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, attrs);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionFromCookies(): Promise<{
  userId: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getSessionFromRequest(
  req: NextRequest
): Promise<{ userId: string } | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return Promise.resolve(null);
  return verifySessionToken(token);
}
