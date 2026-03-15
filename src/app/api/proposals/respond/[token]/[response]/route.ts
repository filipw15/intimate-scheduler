import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAcceptanceEmails } from "@/lib/proposal-generator";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

// Kända bot/preview-agenter som inte ska registrera svar
const BOT_PATTERNS = [
  /Slackbot/i,
  /Googlebot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /WhatsApp/i,
  /Discordbot/i,
  /TelegramBot/i,
  /iMessage/i,
  /Applebot/i,
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #F7F5F2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E8E4DF;
      border-radius: 12px;
      padding: 40px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 20px; font-weight: 600; color: #2D2D2D; margin-bottom: 12px; }
    p { font-size: 15px; color: #7A7A7A; line-height: 1.6; margin-bottom: 8px; }
    a {
      display: inline-block;
      margin-top: 24px;
      color: #8BA89A;
      font-size: 14px;
      text-decoration: none;
      border-bottom: 1px solid #8BA89A;
    }
  </style>
</head>
<body>
  <div class="card">
    ${body}
    <a href="${BASE_URL}">Öppna appen</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; response: string }> }
) {
  const { token, response } = await params;

  // Bot-skydd
  const ua = req.headers.get("user-agent");
  if (isBot(ua)) {
    return htmlPage(
      "Intimate Scheduler",
      `<h1>Intimate Scheduler</h1>
       <p>Klicka på länken i ditt mejl för att svara på förslaget.</p>`
    );
  }

  // Validera response-värde
  if (response !== "yes" && response !== "no") {
    return htmlPage(
      "Ogiltigt svar",
      `<h1>Ogiltigt svar</h1><p>Länken är inte giltig.</p>`
    );
  }

  // Hitta proposal via token (user_a eller user_b)
  const proposal = await prisma.proposal.findFirst({
    where: {
      OR: [{ user_a_token: token }, { user_b_token: token }],
    },
    select: {
      id: true,
      status: true,
      expires_at: true,
      user_a_token: true,
      user_b_token: true,
      user_a_response: true,
      user_b_response: true,
    },
  });

  if (!proposal) {
    return htmlPage(
      "Förslag hittades inte",
      `<h1>Länken är inte giltig</h1><p>Förslaget hittades inte eller länken är felaktig.</p>`
    );
  }

  // Kontrollera om förslaget har löpt ut
  if (proposal.status === "expired" || new Date() > proposal.expires_at) {
    if (proposal.status === "pending") {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: "expired" },
      });
    }
    return htmlPage(
      "Förslaget har gått ut",
      `<h1>Förslaget har gått ut</h1><p>Det här förslaget har tyvärr gått ut.</p>`
    );
  }

  // Kontrollera om förslaget redan är avslutat
  if (proposal.status === "accepted" || proposal.status === "declined") {
    return htmlPage(
      "Redan besvarat",
      `<h1>Du har redan svarat</h1><p>Du har redan svarat på det här förslaget.</p>`
    );
  }

  // Avgör om detta är user_a eller user_b
  const isUserA = proposal.user_a_token === token;
  const existingResponse = isUserA ? proposal.user_a_response : proposal.user_b_response;

  // First-write-wins
  if (existingResponse !== null) {
    return htmlPage(
      "Redan besvarat",
      `<h1>Du har redan svarat</h1><p>Du har redan svarat på det här förslaget.</p>`
    );
  }

  // Registrera svaret
  const updateData = isUserA
    ? { user_a_response: response as "yes" | "no" }
    : { user_b_response: response as "yes" | "no" };

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: updateData,
    select: {
      id: true,
      user_a_response: true,
      user_b_response: true,
    },
  });

  // Kontrollera om bägge svarat
  if (updated.user_a_response !== null && updated.user_b_response !== null) {
    const bothYes =
      updated.user_a_response === "yes" && updated.user_b_response === "yes";

    if (bothYes) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: "accepted", resolved_at: new Date() },
      });
      // Skicka bekräftelse-mejl (fire-and-forget, fel loggas men stoppar inte responsen)
      sendAcceptanceEmails(proposal.id).catch((err) =>
        console.error(`sendAcceptanceEmails failed for ${proposal.id}:`, err)
      );
    } else {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: "declined", resolved_at: new Date() },
      });
    }
  }

  // Visa bekräftelsesida (aldrig info om partnerns svar)
  if (response === "yes") {
    return htmlPage(
      "Svar registrerat",
      `<h1>Tack! Ditt svar är registrerat.</h1>
       <p>Om det blir en match meddelar vi dig.</p>`
    );
  } else {
    return htmlPage(
      "Svar registrerat",
      `<h1>Tack! Ditt svar är registrerat.</h1>
       <p>Inga problem. Vi provar igen nästa vecka.</p>`
    );
  }
}
