import { NextRequest, NextResponse } from "next/server";
import { createEvents } from "ics";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const subscription = await prisma.calendarSubscription.findUnique({
    where: { webcal_token: token },
    include: {
      user:   { select: { codename: true } },
      couple: { select: { id: true } },
    },
  });

  if (!subscription) {
    return new NextResponse("Kalender hittades inte.", { status: 404 });
  }

  const proposals = await prisma.proposal.findMany({
    where: {
      couple_id: subscription.couple.id,
      status: "accepted",
    },
    select: {
      id: true,
      proposed_date: true,
      proposed_time: true,
    },
    orderBy: { proposed_date: "asc" },
  });

  // Titel = den här användarens eget kodord (diskret, syns i deras kalender)
  const title = subscription.user.codename || "Bokad tid";

  type EventAttributes = Parameters<typeof createEvents>[0][number];

  const events: EventAttributes[] = proposals.map((p) => {
    const d = p.proposed_date;
    const [hStr, mStr] = p.proposed_time.split(":");
    const h = parseInt(hStr ?? "20", 10);
    const m = parseInt(mStr ?? "0", 10);

    // Sluttid: +1 timme (enkel addition, ingen DST-hantering behövs för floating times)
    const endTotalMin = h * 60 + m + 60;
    const endH = Math.floor(endTotalMin / 60) % 24;
    const endM = endTotalMin % 60;

    return {
      uid: `proposal-${p.id}@intimate-scheduler`,
      title,
      start: [
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        h,
        m,
      ] as [number, number, number, number, number],
      end: [
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        endH,
        endM,
      ] as [number, number, number, number, number],
      description: "",
    };
  });

  const { error, value } = createEvents(events);

  if (error || !value) {
    console.error("ICS generation error:", error);
    return new NextResponse("Kunde inte generera kalender.", { status: 500 });
  }

  const icsContent = value.replace(
    /PRODID:.*/,
    "PRODID:-//Intimate Scheduler//EN"
  );

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${title}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
