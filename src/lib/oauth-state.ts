import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Skapar ett signerat state-värde för OAuth (10 min giltighetstid). */
export async function createOAuthState(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

/** Verifierar state-värdet och returnerar userId, eller null om ogiltigt/utgånget. */
export async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(state, getSecret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
