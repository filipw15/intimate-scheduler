"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";

// ─── Typer ────────────────────────────────────────────────────────────────────

type Proposal = {
  id: string;
  proposed_date: string;
  proposed_time: string;
  status: string;
  my_response: "yes" | "no" | null;
};

type CoupleStatus = {
  coupled: boolean;
  status?: string;
  partner_name?: string | null;
};

// ─── Hjälpfunktioner ─────────────────────────────────────────────────────────

function formatDateSv(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=sun
  const daysUntil = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntil);
  return new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

// ─── Status-logik ─────────────────────────────────────────────────────────────

type DashboardState =
  | { kind: "no_couple" }
  | { kind: "pending_invite"; partnerName?: string | null }
  | { kind: "accepted"; date: string; time: string }
  | { kind: "proposal_unanswered"; date: string; time: string }
  | { kind: "proposal_answered" }
  | { kind: "no_proposals" };

function deriveDashboardState(
  couple: CoupleStatus | null,
  proposals: Proposal[]
): DashboardState {
  if (!couple?.coupled) return { kind: "no_couple" };
  if (couple.status === "pending") return { kind: "pending_invite", partnerName: couple.partner_name };

  const accepted = proposals.find((p) => p.status === "accepted");
  if (accepted) return { kind: "accepted", date: accepted.proposed_date, time: accepted.proposed_time };

  const pending = proposals.filter((p) => p.status === "pending");
  const unanswered = pending.find((p) => p.my_response === null);
  if (unanswered) return { kind: "proposal_unanswered", date: unanswered.proposed_date, time: unanswered.proposed_time };

  const awaitingPartner = pending.find((p) => p.my_response === "yes");
  if (awaitingPartner) return { kind: "proposal_answered" };

  return { kind: "no_proposals" };
}

// ─── Status-kort-innehåll ─────────────────────────────────────────────────────

function StatusContent({ state }: { state: DashboardState }) {
  const dot = (color: string) => (
    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block", marginRight: 8, flexShrink: 0 }} />
  );

  switch (state.kind) {
    case "no_couple":
      return (
        <div>
          <h2 style={headingStyle}>Ingen partner ansluten</h2>
          <p style={bodyStyle}>Du har inget aktivt par än. Bjud in din partner för att komma igång.</p>
          <a href="/onboarding" style={linkStyle}>Bjud in din partner →</a>
        </div>
      );

    case "pending_invite":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {dot("var(--color-secondary)")}
            <h2 style={{ ...headingStyle, margin: 0 }}>Väntar på partner</h2>
          </div>
          <p style={bodyStyle}>
            Inbjudan skickad{state.partnerName ? ` till ${state.partnerName}` : ""}. Systemet aktiveras
            när din partner accepterar.
          </p>
        </div>
      );

    case "accepted":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {dot("var(--color-primary)")}
            <h2 style={{ ...headingStyle, margin: 0 }}>Ni har en tid!</h2>
          </div>
          <p style={bodyStyle}>
            {formatDateSv(state.date)} kl {state.time}. Kolla din kalender.
          </p>
        </div>
      );

    case "proposal_unanswered":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {dot("var(--color-accent)")}
            <h2 style={{ ...headingStyle, margin: 0 }}>Du har ett förslag</h2>
          </div>
          <p style={bodyStyle}>
            {formatDateSv(state.date)} kl {state.time}. Kolla din e-post och svara.
          </p>
        </div>
      );

    case "proposal_answered":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {dot("var(--color-secondary)")}
            <h2 style={{ ...headingStyle, margin: 0 }}>Svar registrerat</h2>
          </div>
          <p style={bodyStyle}>Du har svarat. Väntar på din partner.</p>
        </div>
      );

    case "no_proposals":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            {dot("var(--color-border)")}
            <h2 style={{ ...headingStyle, margin: 0 }}>Inga aktiva förslag</h2>
          </div>
          <p style={bodyStyle}>
            Nästa omgång skickas {nextMonday()}. Allt är under kontroll.
          </p>
        </div>
      );
  }
}

const headingStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "var(--color-text)",
  marginBottom: 6,
};
const bodyStyle: React.CSSProperties = {
  fontSize: 15,
  color: "var(--color-text-secondary)",
  lineHeight: 1.6,
};
const linkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 12,
  fontSize: 14,
  color: "var(--color-primary)",
  textDecoration: "none",
  fontWeight: 500,
};

// ─── Sida ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading,   setLoading]   = useState(true);
  const [couple,    setCouple]    = useState<CoupleStatus | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [webcalUrl, setWebcalUrl] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/couple/status").then((r) => r.json() as Promise<CoupleStatus>),
      fetch("/api/proposals").then((r) => r.json() as Promise<{ proposals: Proposal[] }>),
    ]).then(([coupleData, proposalsData]) => {
      setCouple(coupleData);
      setProposals(proposalsData.proposals ?? []);
    }).catch(() => {}).finally(() => setLoading(false));

    // Hämta/skapa webcal-URL tyst (ignorera fel om inget par finns)
    fetch("/api/webcal/setup", { method: "POST" })
      .then((r) => r.ok ? r.json() as Promise<{ webcal_url?: string }> : Promise.resolve({} as { webcal_url?: string }))
      .then((d) => { if (d.webcal_url) setWebcalUrl(d.webcal_url); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }

  const state = deriveDashboardState(couple, proposals);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <Card>
          {loading ? (
            <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Laddar…</p>
          ) : (
            <StatusContent state={state} />
          )}

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "24px 0" }} />

          {/* Webcal */}
          {webcalUrl && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                Kalender-prenumeration
              </p>
              <a
                href={webcalUrl}
                style={{ fontSize: 13, color: "var(--color-primary)", wordBreak: "break-all" }}
              >
                {webcalUrl}
              </a>
            </div>
          )}

          {/* Länkar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <a
              href="/settings"
              style={{ fontSize: 14, color: "var(--color-primary)", textDecoration: "none", fontWeight: 500 }}
            >
              Inställningar
            </a>
            <span style={{ color: "var(--color-border)" }}>·</span>
            <Button
              variant="ghost"
              loading={loggingOut}
              onClick={handleLogout}
              style={{ fontSize: 14, padding: "4px 0", minHeight: "unset" }}
            >
              Logga ut
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
