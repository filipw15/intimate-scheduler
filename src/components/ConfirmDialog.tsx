"use client";

import { useState } from "react";
import Button from "./Button";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "destructive";
  /** If set, user must type this exact string before confirming */
  requireText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bekräfta",
  confirmVariant = "destructive",
  requireText,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const canConfirm = requireText ? typed === requireText : true;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <h3
          id="confirm-title"
          style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 10 }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
          {message}
        </p>

        {requireText && (
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="confirm-input"
              style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", display: "block", marginBottom: 6 }}
            >
              Skriv <strong>{requireText}</strong> för att bekräfta:
            </label>
            <input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              autoComplete="off"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--color-input-border)",
                borderRadius: "var(--radius-input)",
                fontSize: 15,
                fontFamily: "inherit",
                color: "var(--color-text)",
                outline: "none",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Avbryt
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => { setTyped(""); onConfirm(); }}
            disabled={!canConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
