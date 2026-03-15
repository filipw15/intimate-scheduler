import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendProposalEmail, sendConfirmationEmail } from "@/lib/email";
import type { TonePref } from "@prisma/client";

/**
 * Genererar Proposals för ett Couple baserat på bägge parters Availability.
 * Skickar notis-mejl till bägge parter för varje nytt Proposal.
 *
 * @param coupleId      ID för Couple (måste ha status "active")
 * @param minDaysAhead  Minsta antal dagar framåt (default: 3)
 * @param lookAheadDays Antal dagar att titta framåt (default: 14)
 * @returns             Antal skapade Proposals
 */
export async function generateWeeklyProposals(
  coupleId: string,
  minDaysAhead = 3,
  lookAheadDays = 14
): Promise<number> {
  // 1. Hämta Couple med bägge parter
  const couple = await prisma.couple.findUnique({
    where: { id: coupleId },
    include: {
      user_a: {
        select: {
          id: true,
          email: true,
          display_name: true,
          tone_pref: true,
          codename: true,
        },
      },
      user_b: {
        select: {
          id: true,
          email: true,
          display_name: true,
          tone_pref: true,
          codename: true,
        },
      },
    },
  });

  if (!couple || couple.status !== "active" || !couple.user_b_id || !couple.user_b) {
    return 0;
  }

  const userA = couple.user_a;
  const userB = couple.user_b;

  // 2. Beräkna datumintervall
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const fromDate = new Date(today.getTime() + minDaysAhead * 24 * 60 * 60 * 1000);
  const toDate = new Date(today.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  // 3. Hämta Availability för bägge parter
  const [availA, availB] = await Promise.all([
    prisma.availability.findMany({
      where: {
        user_id: couple.user_a_id,
        is_available: true,
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true },
    }),
    prisma.availability.findMany({
      where: {
        user_id: couple.user_b_id,
        is_available: true,
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true },
    }),
  ]);

  // 4. Hitta datum där bägge är GO
  const setA = new Set(availA.map((a) => a.date.toISOString().slice(0, 10)));
  const matchingDates = availB
    .filter((b) => setA.has(b.date.toISOString().slice(0, 10)))
    .map((b) => b.date);

  if (matchingDates.length === 0) return 0;

  // 5. Filtrera bort datum som redan har ett pending Proposal
  const existingProposals = await prisma.proposal.findMany({
    where: {
      couple_id: coupleId,
      status: "pending",
      proposed_date: { in: matchingDates },
    },
    select: { proposed_date: true },
  });
  const existingDateStrs = new Set(
    existingProposals.map((p) => p.proposed_date.toISOString().slice(0, 10))
  );
  const newDates = matchingDates.filter(
    (d) => !existingDateStrs.has(d.toISOString().slice(0, 10))
  );

  if (newDates.length === 0) return 0;

  // 6. Hämta preferenser för att fastställa proposed_time (= barnens sovtid)
  const prefA = await prisma.preference.findUnique({
    where: { user_id: couple.user_a_id },
    select: { child_bedtime_weekday: true, child_bedtime_weekend: true },
  });

  let created = 0;

  for (const date of newDates) {
    // Avgör veckodag (UTC - korrekt för Europa/Stockholm-datum lagrade som UTC midnight)
    const isWeekendDay = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const proposedTime = prefA
      ? isWeekendDay
        ? prefA.child_bedtime_weekend
        : prefA.child_bedtime_weekday
      : "20:00";

    const tokenA = crypto.randomBytes(32).toString("hex");
    const tokenB = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await prisma.proposal.create({
      data: {
        couple_id: coupleId,
        proposed_date: date,
        proposed_time: proposedTime,
        user_a_token: tokenA,
        user_b_token: tokenB,
        expires_at: expiresAt,
      },
    });

    // Skicka notis-mejl till bägge parter
    await Promise.all([
      sendProposalEmail({
        email: userA.email,
        userName: userA.display_name,
        codename: userA.codename,
        tonePref: userA.tone_pref as TonePref,
        proposedDate: date,
        proposedTime,
        responseToken: tokenA,
      }),
      sendProposalEmail({
        email: userB.email,
        userName: userB.display_name,
        codename: userB.codename,
        tonePref: userB.tone_pref as TonePref,
        proposedDate: date,
        proposedTime,
        responseToken: tokenB,
      }),
    ]);

    created++;
  }

  return created;
}

/**
 * Skickar bekräftelse-mejl till bägge parter när ett Proposal accepterats
 * (bägge har svarat ja). Anropas från respond-endpointen när bägge svar är inne.
 */
export async function sendAcceptanceEmails(proposalId: string): Promise<void> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      couple: {
        include: {
          user_a: {
            select: {
              id: true,
              email: true,
              display_name: true,
              tone_pref: true,
              codename: true,
            },
          },
          user_b: {
            select: {
              id: true,
              email: true,
              display_name: true,
              tone_pref: true,
              codename: true,
            },
          },
          calendar_subscriptions: {
            select: { user_id: true, webcal_token: true },
          },
        },
      },
    },
  });

  if (!proposal || !proposal.couple.user_b) return;

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3200";

  // Bygg per-användare webcal-URL (varje part har sitt eget kodord i sin kalender)
  const webcalByUser = new Map(
    proposal.couple.calendar_subscriptions.map((s) => [
      s.user_id,
      `${baseUrl}/api/webcal/${s.webcal_token}`,
    ])
  );

  const userA = proposal.couple.user_a;
  const userB = proposal.couple.user_b;

  await Promise.all([
    sendConfirmationEmail({
      email: userA.email,
      userName: userA.display_name,
      codename: userA.codename,
      tonePref: userA.tone_pref as TonePref,
      proposedDate: proposal.proposed_date,
      webcalUrl: webcalByUser.get(userA.id),
    }),
    sendConfirmationEmail({
      email: userB.email,
      userName: userB.display_name,
      codename: userB.codename,
      tonePref: userB.tone_pref as TonePref,
      proposedDate: proposal.proposed_date,
      webcalUrl: webcalByUser.get(userB.id),
    }),
  ]);
}
