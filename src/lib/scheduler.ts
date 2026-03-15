import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { generateWeeklyProposals } from "@/lib/proposal-generator";
import { sendMaintenanceEmail } from "@/lib/email";
// NOTE: matching.ts (→ calendar-sync.ts → googleapis) is NOT imported at module level.
// It is dynamically imported inside runCalendarSync() to prevent the googleapis BigInt
// error when instrumentation.ts loads this module during Next.js startup.

// ─── Kalendersynk (var 30:e minut) ───────────────────────────────────────────

async function runCalendarSync(): Promise<void> {
  console.log("[scheduler] Kalendersynk startar...");

  const connections = await prisma.calendarConnection.findMany({
    where: { status: "active" },
    select: { user_id: true },
    distinct: ["user_id"],
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  let synced = 0;
  let failed = 0;

  // Lazy import: keeps googleapis out of the instrumentation bundle
  const { generateAvailabilityForRange } = await import("@/lib/matching");

  for (const { user_id } of connections) {
    try {
      await generateAvailabilityForRange(user_id, today, in14Days);
      synced++;
    } catch (err) {
      // generateAvailabilityForRange hanterar sync-fel internt och sätter
      // connection.status = "error" | "expired". Det kastar normalt inte,
      // men fånga oväntade fel här.
      console.error(`[scheduler] Kalendersynk misslyckades för user ${user_id}:`, err);
      failed++;
    }
  }

  console.log(
    `[scheduler] Kalendersynk klar. Synkade: ${synced}, Misslyckades: ${failed}`
  );
}

// ─── Veckovis matchning (måndag 07:00) ───────────────────────────────────────

async function runWeeklyMatching(): Promise<void> {
  console.log("[scheduler] Veckovis matchning startar...");

  const couples = await prisma.couple.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  let totalProposals = 0;

  for (const { id } of couples) {
    try {
      const count = await generateWeeklyProposals(id);
      console.log(`[scheduler] Par ${id}: ${count} förslag genererade.`);
      totalProposals += count;
    } catch (err) {
      console.error(`[scheduler] Matchning misslyckades för par ${id}:`, err);
    }
  }

  console.log(
    `[scheduler] Veckovis matchning klar. Totalt ${totalProposals} nya förslag.`
  );
}

// ─── Expiry-check (varje timme) ───────────────────────────────────────────────

async function runExpiryCheck(): Promise<void> {
  const result = await prisma.proposal.updateMany({
    where: {
      status: "pending",
      expires_at: { lt: new Date() },
    },
    data: { status: "expired" },
  });

  if (result.count > 0) {
    console.log(`[scheduler] Expiry-check: ${result.count} förslag utgångna.`);
  }
}

// ─── Månadsvis underhåll (1:a varje månad kl. 08:00) ─────────────────────────

async function runMonthlyMaintenance(): Promise<void> {
  console.log("[scheduler] Månadsvis underhåll startar...");

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { couple_as_a: { some: { status: "active" } } },
        { couple_as_b: { some: { status: "active" } } },
      ],
    },
    select: {
      email: true,
      display_name: true,
      tone_pref: true,
      cycle_data: { select: { id: true } },
    },
  });

  let sent = 0;
  for (const user of users) {
    try {
      await sendMaintenanceEmail({
        email: user.email,
        userName: user.display_name,
        tonePref: user.tone_pref as "playful" | "discreet" | "direct",
        hasCycleData: user.cycle_data !== null,
      });
      sent++;
    } catch (err) {
      console.error(`[scheduler] Underhållsmejl misslyckades för ${user.email}:`, err);
    }
  }

  console.log(`[scheduler] Månadsvis underhåll klar. Skickade ${sent} mejl.`);
}

// ─── Starta alla jobb ─────────────────────────────────────────────────────────

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // Kalendersynk: var 30:e minut
  cron.schedule("*/30 * * * *", () => {
    runCalendarSync().catch((err) =>
      console.error("[scheduler] Oväntat fel i kalendersynk:", err)
    );
  });

  // Veckovis matchning: måndag kl. 07:00
  cron.schedule("0 7 * * 1", () => {
    runWeeklyMatching().catch((err) =>
      console.error("[scheduler] Oväntat fel i veckovis matchning:", err)
    );
  });

  // Expiry-check: varje hel timme
  cron.schedule("0 * * * *", () => {
    runExpiryCheck().catch((err) =>
      console.error("[scheduler] Oväntat fel i expiry-check:", err)
    );
  });

  // Månadsvis underhåll: 1:a varje månad kl. 08:00
  cron.schedule("0 8 1 * *", () => {
    runMonthlyMaintenance().catch((err) =>
      console.error("[scheduler] Oväntat fel i månadsvis underhåll:", err)
    );
  });

  console.log("[scheduler] Alla bakgrundsjobb registrerade.");
}
