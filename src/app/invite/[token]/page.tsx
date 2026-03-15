"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import Button from "@/components/Button";

// ─── Typer ────────────────────────────────────────────────────────────────────

type InviteState =
  | { kind: "loading" }
  | { kind: "pending"; inviterName: string | null }
  | { kind: "already_used" }
  | { kind: "not_found" };

// ─── Sida ─────────────────────────────────────────────────────────────────────

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<InviteState>({ kind: "loading" });

  useEffect(() => {
    fetch(`/api/couple/invite/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          setState({ kind: "not_found" });
          return;
        }
        const data = await r.json() as { inviter_name: string | null; status: string };
        if (data.status === "pending") {
          setState({ kind: "pending", inviterName: data.inviter_name });
        } else {
          setState({ kind: "already_used" });
        }
      })
      .catch(() => setState({ kind: "not_found" }));
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

          <InviteContent state={state} token={token} />
        </Card>
      </div>
    </main>
  );
}

// ─── Innehåll baserat på tillstånd ────────────────────────────────────────────

function InviteContent({ state, token }: { state: InviteState; token: string }) {
  if (state.kind === "loading") {
    return (
      <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Laddar…</p>
    );
  }

  if (state.kind === "already_used") {
    return (
      <div>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            fontSize: 20,
          }}
        >
          ○
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 10,
          }}
        >
          Inbjudan har redan använts
        </h2>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          Den här inbjudan har redan använts.
        </p>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            fontSize: 20,
          }}
        >
          ○
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 10,
          }}
        >
          Inbjudan hittades inte
        </h2>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          Inbjudan hittades inte. Kontrollera att du använder rätt länk.
        </p>
      </div>
    );
  }

  // pending
  const name = state.inviterName;

  function handleStart() {
    // Spara invite-token i localStorage så att login-sidan kan redirecta rätt efter verifiering
    localStorage.setItem("pending_invite", token);
    window.location.href = `/?invite=${token}`;
  }

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
        {name ? `${name} har bjudit in dig` : "Du har blivit inbjuden"}
      </h2>
      <p
        style={{
          fontSize: 15,
          color: "var(--color-text-secondary)",
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        {name ? `${name} har bjudit in dig till Intimate Scheduler.` : "Du har bjudits in till Intimate Scheduler."}{" "}
        Logga in eller skapa ett konto för att komma igång.
      </p>
      <Button variant="primary" fullWidth onClick={handleStart}>
        Kom igång
      </Button>
    </div>
  );
}
