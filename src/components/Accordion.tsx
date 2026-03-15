"use client";

import { useState, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function Accordion({ title, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--color-text)",
          textAlign: "left",
          backgroundColor: open ? "rgba(139,168,154,0.04)" : "transparent",
          transition: "background-color 0.15s",
        }}
      >
        {title}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            fontSize: 11,
            color: "var(--color-text-secondary)",
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "4px 20px 20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
