import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Användaren nekade åtkomst
  if (error) {
    return NextResponse.redirect(`${BASE_URL}/settings?calendar_error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${BASE_URL}/settings?calendar_error=invalid_callback`);
  }

  const userId = await verifyOAuthState(state);
  if (!userId) {
    return NextResponse.redirect(`${BASE_URL}/settings?calendar_error=invalid_state`);
  }

  let accessToken: string;
  let refreshToken: string;
  try {
    // Lazy import to avoid googleapis BigInt error at build time
    const { exchangeGoogleCode } = await import("@/lib/calendar-sync");
    ({ accessToken, refreshToken } = await exchangeGoogleCode(code));
  } catch (err) {
    console.error("Google token exchange failed:", err);
    return NextResponse.redirect(`${BASE_URL}/settings?calendar_error=token_exchange`);
  }

  const encryptedAccess  = encrypt(accessToken);
  const encryptedRefresh = encrypt(refreshToken);

  // Upsert — en användare kan bara ha en aktiv Google-koppling
  await prisma.calendarConnection.upsert({
    where: {
      id: (
        await prisma.calendarConnection.findFirst({
          where: { user_id: userId, provider: "google" },
          select: { id: true },
        })
      )?.id ?? "00000000-0000-0000-0000-000000000000",
    },
    update: {
      oauth_token:    encryptedAccess,
      refresh_token:  encryptedRefresh,
      status:         "active",
      last_synced_at: null,
    },
    create: {
      user_id:       userId,
      provider:      "google",
      oauth_token:   encryptedAccess,
      refresh_token: encryptedRefresh,
      status:        "active",
    },
  });

  return NextResponse.redirect(`${BASE_URL}/settings?calendar_connected=1`);
}
