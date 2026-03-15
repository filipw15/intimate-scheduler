"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import Button from "@/components/Button";

// ─── Typer ────────────────────────────────────────────────────────────────────

type AcceptState =
  | { kind: "loading" }
  | { kind: "success"; partnerName: string | null }
  | { kind: "error"; message: string };

// ─── Sida ─────────────────────────────────────────────────────────────────────

export default function AcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<AcceptState>({ kind: "loading" });

  useEffect(() => {
    fetch(`/api/couple/accept/${token}`, { method: "POST" })
      .then(async (r) => {
        // Inte inloggad — spara token och skicka till login-flödet
        if (r.status === 401) {
          localStorage.setItem("pending_invite", token);
          window.location.href = `/?invite=${token}`;
          return;
        }
        // Rensa pending_invite nu när API-anropet gick igenom
        localStorage.removeItem("pending_invite");
        const data = await r.json() as {
          couple_id?: string;
          partner_name?: string;
          error?: string;
        };
        if (r.ok) {
          setState({ kind: "success", partnerName: data.partner_name ?? null });
        } else {
          setState({ kind: "error", message: data.error ?? "Något gick fel." });
        }
      })
      .catch(() =>
        setState({ kind: "error", message: "Kunde inte ansluta. Försök igen." })
      );
  }, [token]);

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
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 4,
                letterSpacing: "-0.01em",
              }}
            >
              Intimate Scheduler
            </h1>
          </div>

          <AcceptContent state={state} />
        </Card>
      </div>
    </main>
  );
}

// ─── Innehåll baserat på tillstånd ────────────────────────────────────────────

function AcceptContent({ state }: { state: AcceptState }) {
  if (state.kind === "loading") {
    return (
      <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Aktiverar koppling…</p>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "rgba(196,117,106,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            fontSize: 20,
            color: "var(--color-error)",
          }}
        >
          ✕
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 10,
          }}
        >
          Något gick fel
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {state.message}
        </p>
        <a
          href="/dashboard"
          style={{
            fontSize: 14,
            color: "var(--color-primary)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Gå till appen →
        </a>
      </div>
    );
  }

  // success
  const partner = state.partnerName;

  return (
    <div>
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          backgroundColor: "var(--color-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
          fontSize: 20,
          color: "#fff",
        }}
      >
        ✓
      </div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: 10,
        }}
      >
        Koppling aktiverad!
      </h2>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        {partner
          ? `Du och ${partner} är nu ihop i appen.`
          : "Du är nu ihop med din partner i appen."}{" "}
        Ställ in dina preferenser för att komma igång.
      </p>
      <Button
        variant="primary"
        fullWidth
        onClick={() => { window.location.href = "/onboarding"; }}
      >
        Ställ in mina preferenser
      </Button>
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <a
          href="/dashboard"
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            textDecoration: "none",
          }}
        >
          Hoppa över, gå till appen
        </a>
      </div>
    </div>
  );
}
