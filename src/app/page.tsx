"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";

// ─── Error param → meddelande ─────────────────────────────────────────────────

const VERIFY_ERRORS: Record<string, string> = {
  expired:        "Inloggningslänken har gått ut. Begär en ny nedan.",
  already_used:   "Inloggningslänken har redan använts. Begär en ny nedan.",
  invalid_token:  "Inloggningslänken är ogiltig.",
  user_not_found: "Kontot hittades inte. Kontrollera din e-postadress.",
};

// ─── Formulär ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const searchParams = useSearchParams();
  const verifyError = searchParams.get("error");
  const inviteToken = searchParams.get("invite");
  const verifyErrorMsg = verifyError
    ? (VERIFY_ERRORS[verifyError] ?? "Något gick fel. Försök igen.")
    : null;

  const [email, setEmail]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  // Spara invite-token och kolla om redan inloggad — ett enda effect för att
  // garantera att pending_invite är satt INNAN vi eventuellt redirectar.
  useEffect(() => {
    if (inviteToken) {
      localStorage.setItem("pending_invite", inviteToken);
    }

    fetch("/api/user/profile")
      .then((r) => {
        // Redirecta BARA om användaren faktiskt är inloggad (200 OK).
        // Vid 401 eller annat: stanna kvar och visa login-formuläret.
        if (!r.ok) return;
        const pendingInvite = localStorage.getItem("pending_invite");
        if (pendingInvite) {
          window.location.href = `/invite/${pendingInvite}/accept`;
        } else {
          window.location.href = "/dashboard";
        }
      })
      .catch(() => {});
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setFormError(data.error ?? "Något gick fel. Försök igen.");
      }
    } catch {
      setFormError("Kunde inte ansluta. Kontrollera din internetanslutning.");
    } finally {
      setLoading(false);
    }
  }

  // ── Skickat-vy ────────────────────────────────────────────────────────────
  if (sent) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 22,
              color: "#fff",
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-text)",
              marginBottom: 10,
            }}
          >
            Kolla din inkorg!
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              marginBottom: 4,
            }}
          >
            En inloggningslänk har skickats till{" "}
            <strong style={{ color: "var(--color-text)" }}>{email}</strong>.
          </p>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              marginBottom: 24,
            }}
          >
            Länken är giltig i 15 minuter.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary)",
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
              fontFamily: "inherit",
            }}
          >
            Skicka igen
          </button>
        </div>
      </Card>
    );
  }

  // ── Login-vy ──────────────────────────────────────────────────────────────
  return (
    <Card>
      {/* Logotyp + tagline */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--color-text)",
            marginBottom: 6,
            letterSpacing: "-0.01em",
          }}
        >
          Intimate Scheduler
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>
          Hitta tid för det som är viktigt.
        </p>
      </div>

      {/* Felmeddelande från verify-redirect */}
      {verifyErrorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: "rgba(196,117,106,0.08)",
            border: "1px solid rgba(196,117,106,0.25)",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
            color: "var(--color-error)",
            marginBottom: 20,
          }}
        >
          {verifyErrorMsg}
        </div>
      )}

      {/* Formulär */}
      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input
          id="email"
          label="E-postadress"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@epost.se"
          autoComplete="email"
          required
          error={formError ?? undefined}
        />
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Skicka inloggningslänk
        </Button>
      </form>

      {/* Inbjudningslänk */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            textDecoration: "underline",
            textDecorationColor: "transparent",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.color = "var(--color-primary)")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.color = "var(--color-text-secondary)")
          }
        >
          Fått en inbjudan? Klicka här.
        </button>
        {showInvite && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              padding: "10px 12px",
              backgroundColor: "var(--color-bg)",
              borderRadius: 8,
              textAlign: "left",
            }}
          >
            Öppna inbjudningslänken i ditt mejl för att aktivera ditt konto.
            Sedan kan du logga in här med din e-postadress.
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── Sida ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
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
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
