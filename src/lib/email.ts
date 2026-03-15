import { Resend } from "resend";

// Lazy initialization — avoid throwing at module load time during Next.js build
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

export async function sendMagicLinkEmail(
  email: string,
  token: string
): Promise<void> {
  const link = `${BASE_URL}/api/auth/verify?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Magic link for ${email}:\n${link}\n`);
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Din inloggningslänk",
    html: magicLinkHtml(link),
    text: magicLinkText(link),
  });
}

function magicLinkHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F7F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E8E4DF;padding:40px 32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#2D2D2D;">Logga in</p>
              <p style="margin:0 0 32px 0;font-size:16px;color:#7A7A7A;line-height:1.5;">
                Klicka på knappen nedan för att logga in. Länken är giltig i 15 minuter.
              </p>
              <a href="${link}"
                style="display:inline-block;background-color:#8BA89A;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:500;">
                Logga in
              </a>
              <p style="margin:32px 0 0 0;font-size:14px;color:#7A7A7A;line-height:1.5;">
                Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:<br>
                <span style="color:#8BA89A;word-break:break-all;">${link}</span>
              </p>
              <hr style="margin:32px 0;border:none;border-top:1px solid #E8E4DF;">
              <p style="margin:0;font-size:12px;color:#7A7A7A;">
                Om du inte begärde denna länk kan du ignorera detta mejl.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function magicLinkText(link: string): string {
  return `Logga in på Intimate Scheduler\n\nKlicka på länken nedan för att logga in. Länken är giltig i 15 minuter.\n\n${link}\n\nOm du inte begärde denna länk kan du ignorera detta mejl.`;
}

// ─── Inbjudningsmejl ─────────────────────────────────────────────────────────

export async function sendInviteEmail(
  partnerEmail: string,
  inviterName: string,
  inviteToken: string
): Promise<void> {
  const link = `${BASE_URL}/invite/${inviteToken}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Invite link for ${partnerEmail}:\n${link}\n`);
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to: partnerEmail,
    subject: "Du har fått en inbjudan",
    html: inviteHtml(inviterName, link),
    text: inviteText(inviterName, link),
  });
}

function inviteHtml(inviterName: string, link: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F7F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E8E4DF;padding:40px 32px;">
          <tr>
            <td>
              <p style="margin:0 0 24px 0;font-size:16px;color:#2D2D2D;line-height:1.6;">
                Hej! <strong>${inviterName}</strong> har bjudit in dig till Intimate Scheduler,
                en app för att enklare hitta kvalitetstid tillsammans.
              </p>
              <a href="${link}"
                style="display:inline-block;background-color:#8BA89A;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:500;">
                Kom igång
              </a>
              <p style="margin:32px 0 0 0;font-size:14px;color:#7A7A7A;line-height:1.5;">
                Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:<br>
                <span style="color:#8BA89A;word-break:break-all;">${link}</span>
              </p>
              <hr style="margin:32px 0;border:none;border-top:1px solid #E8E4DF;">
              <p style="margin:0;font-size:12px;color:#7A7A7A;">
                Om du inte vill ta emot fler mejl från oss kan du ignorera detta.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function inviteText(inviterName: string, link: string): string {
  return `Hej! ${inviterName} har bjudit in dig till Intimate Scheduler, en app för att enklare hitta kvalitetstid tillsammans.\n\nKom igång här:\n${link}`;
}

// ─── Hjälpfunktioner ─────────────────────────────────────────────────────────

function formatSwedishDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F7F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E8E4DF;padding:40px 32px;">
          <tr>
            <td>
              ${content}
              <hr style="margin:32px 0;border:none;border-top:1px solid #E8E4DF;">
              <p style="margin:0;font-size:12px;color:#7A7A7A;">
                Om du inte vill ta emot fler mejl kan du ignorera detta.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Förslags-mejl ────────────────────────────────────────────────────────────

type ProposalEmailParams = {
  email: string;
  userName: string;
  codename: string;
  tonePref: "playful" | "discreet" | "direct";
  proposedDate: Date;
  proposedTime: string;
  responseToken: string;
};

export async function sendProposalEmail(params: ProposalEmailParams): Promise<void> {
  const { email, userName, codename, tonePref, proposedDate, proposedTime, responseToken } = params;
  const dateStr = formatSwedishDate(proposedDate);
  const yesLink = `${BASE_URL}/api/proposals/respond/${responseToken}/yes`;
  const noLink = `${BASE_URL}/api/proposals/respond/${responseToken}/no`;

  const subjects: Record<string, string> = {
    playful: "En kväll att se fram emot",
    discreet: `${codename}-påminnelse`,
    direct: "Förslag: svar krävs",
  };

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Proposal email for ${email} (${tonePref}):\n  Date: ${dateStr}\n  Yes: ${yesLink}\n  No: ${noLink}\n`);
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: subjects[tonePref] ?? subjects.discreet!,
    html: proposalHtml(userName, codename, tonePref, dateStr, proposedTime, yesLink, noLink),
    text: proposalText(userName, codename, tonePref, dateStr, proposedTime, yesLink, noLink),
  });
}

function proposalHtml(
  userName: string,
  codename: string,
  tone: string,
  dateStr: string,
  proposedTime: string,
  yesLink: string,
  noLink: string
): string {
  const messages: Record<string, string> = {
    playful: `Hej ${userName}! Ser ut som att ${dateStr} kväll kan bli mysig. Bara du vet om du vill. 💛`,
    discreet: `${codename}-påminnelse: ${dateStr} kväll. Svara här.`,
    direct: `Förslag: ${dateStr} kväll efter ${proposedTime}. Ja eller nej?`,
  };
  const message = messages[tone] ?? messages.discreet!;

  return emailWrapper(`
    <p style="margin:0 0 24px 0;font-size:16px;color:#2D2D2D;line-height:1.6;">${message}</p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:12px;">
          <a href="${yesLink}" style="display:inline-block;background-color:#8BA89A;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:500;">Ja</a>
        </td>
        <td>
          <a href="${noLink}" style="display:inline-block;background-color:#F0EDE9;color:#5A5A5A;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:500;">Nej</a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0 0;font-size:13px;color:#7A7A7A;line-height:1.5;">
      Svaret är bara synligt för systemet. Din partner ser inte ditt svar förrän bägge har svarat.
    </p>`);
}

function proposalText(
  userName: string,
  codename: string,
  tone: string,
  dateStr: string,
  proposedTime: string,
  yesLink: string,
  noLink: string
): string {
  const messages: Record<string, string> = {
    playful: `Hej ${userName}! Ser ut som att ${dateStr} kväll kan bli mysig. Bara du vet om du vill.`,
    discreet: `${codename}-påminnelse: ${dateStr} kväll. Svara här.`,
    direct: `Förslag: ${dateStr} kväll efter ${proposedTime}. Ja eller nej?`,
  };
  const message = messages[tone] ?? messages.discreet!;
  return `${message}\n\nJa: ${yesLink}\nNej: ${noLink}\n\nSvaret är bara synligt för systemet. Din partner ser inte ditt svar förrän bägge har svarat.`;
}

// ─── Bekräftelse-mejl ─────────────────────────────────────────────────────────

type ConfirmationEmailParams = {
  email: string;
  userName: string;
  codename: string;
  tonePref: "playful" | "discreet" | "direct";
  proposedDate: Date;
  webcalUrl?: string;
};

export async function sendConfirmationEmail(params: ConfirmationEmailParams): Promise<void> {
  const { email, userName, codename, tonePref, proposedDate, webcalUrl } = params;
  const dateStr = formatSwedishDate(proposedDate);

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Confirmation email for ${email} (${tonePref}):\n  Date: ${dateStr}\n`);
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: tonePref === "playful" ? "Det blev en match! 😊" : `${codename} bekräftat`,
    html: confirmationHtml(userName, codename, tonePref, dateStr, webcalUrl),
    text: confirmationText(userName, codename, tonePref, dateStr, webcalUrl),
  });
}

function confirmationHtml(
  userName: string,
  codename: string,
  tone: string,
  dateStr: string,
  webcalUrl?: string
): string {
  const messages: Record<string, string> = {
    playful: `Det blev en match! ${dateStr} kväll är bokad. Kolla kalendern. 😊`,
    discreet: `${codename} bekräftat för ${dateStr}. Tillagt i din kalender.`,
    direct: `Bekräftat: ${dateStr} kväll. Event tillagt.`,
  };
  const message = messages[tone] ?? messages.discreet!;

  const webcalPart = webcalUrl
    ? `<p style="margin:16px 0 0 0;font-size:14px;color:#7A7A7A;">
        Prenumerera på din kalender: <a href="${webcalUrl}" style="color:#8BA89A;">${webcalUrl}</a>
       </p>`
    : "";

  return emailWrapper(`
    <p style="margin:0 0 16px 0;font-size:16px;color:#2D2D2D;line-height:1.6;">${message}</p>
    ${webcalPart}`);
}

function confirmationText(
  userName: string,
  codename: string,
  tone: string,
  dateStr: string,
  webcalUrl?: string
): string {
  const messages: Record<string, string> = {
    playful: `Det blev en match! ${dateStr} kväll är bokad. Kolla kalendern.`,
    discreet: `${codename} bekräftat för ${dateStr}. Tillagt i din kalender.`,
    direct: `Bekräftat: ${dateStr} kväll. Event tillagt.`,
  };
  const message = messages[tone] ?? messages.discreet!;
  return webcalUrl ? `${message}\n\nKalenderprenumeration: ${webcalUrl}` : message;
}

// ─── Månadsvis underhåll ──────────────────────────────────────────────────────

type MaintenanceEmailParams = {
  email: string;
  userName: string;
  tonePref: "playful" | "discreet" | "direct";
  hasCycleData: boolean;
};

export async function sendMaintenanceEmail(params: MaintenanceEmailParams): Promise<void> {
  const { email, userName, tonePref, hasCycleData } = params;
  const settingsUrl = `${BASE_URL}/settings`;
  const cycleUrl = `${BASE_URL}/settings#cycle`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV] Maintenance email for ${email} (${tonePref})\n`);
    return;
  }

  const subjects: Record<string, string> = {
    playful: "Dags för en snabb check-in!",
    discreet: "Månatlig uppdatering",
    direct: "Dags att uppdatera inställningar",
  };

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: subjects[tonePref] ?? subjects.discreet!,
    html: maintenanceHtml(userName, tonePref, hasCycleData, settingsUrl, cycleUrl),
    text: maintenanceText(userName, tonePref, hasCycleData, settingsUrl, cycleUrl),
  });
}

function maintenanceHtml(
  userName: string,
  tone: string,
  hasCycleData: boolean,
  settingsUrl: string,
  cycleUrl: string
): string {
  const intros: Record<string, string> = {
    playful: `Hej ${userName}! Dags för en snabb check-in! Stämmer dina inställningar fortfarande?`,
    discreet: `Månatlig uppdatering. Verifiera dina inställningar.`,
    direct: `Dags att uppdatera inställningar. Klicka här.`,
  };
  const intro = intros[tone] ?? intros.discreet!;

  const cycleBlock = hasCycleData
    ? `<div style="margin-top:24px;padding:16px 20px;background-color:#F7F5F2;border-radius:8px;">
        <p style="margin:0 0 12px 0;font-size:15px;font-weight:500;color:#2D2D2D;">
          Kom mensen som förväntat?
        </p>
        <p style="margin:0 0 16px 0;font-size:14px;color:#7A7A7A;line-height:1.5;">
          Bekräfta eller uppdatera din cykeldata så att systemet håller sig kalibrerat.
        </p>
        <a href="${cycleUrl}"
          style="display:inline-block;background-color:#C4B9A8;color:#2D2D2D;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;">
          Bekräfta cykeldata
        </a>
      </div>`
    : "";

  return emailWrapper(`
    <p style="margin:0 0 24px 0;font-size:15px;color:#2D2D2D;line-height:1.6;">${intro}</p>
    <a href="${settingsUrl}"
      style="display:inline-block;background-color:#8BA89A;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:500;">
      Öppna inställningar
    </a>
    ${cycleBlock}`);
}

function maintenanceText(
  userName: string,
  tone: string,
  hasCycleData: boolean,
  settingsUrl: string,
  cycleUrl: string
): string {
  const intros: Record<string, string> = {
    playful: `Hej ${userName}! Dags för en snabb check-in! Stämmer dina inställningar fortfarande?`,
    discreet: `Månatlig uppdatering. Verifiera dina inställningar.`,
    direct: `Dags att uppdatera inställningar.`,
  };
  const intro = intros[tone] ?? intros.discreet!;
  const cycleBlock = hasCycleData
    ? `\n\nKom mensen som förväntat? Bekräfta cykeldata: ${cycleUrl}`
    : "";
  return `${intro}\n\nÖppna inställningar: ${settingsUrl}${cycleBlock}`;
}
