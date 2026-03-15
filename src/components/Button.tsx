import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
};

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  primary: {
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    backgroundColor: "transparent",
    color: "var(--color-primary)",
    border: "1.5px solid var(--color-primary)",
  },
  destructive: {
    backgroundColor: "var(--color-error)",
    color: "#ffffff",
    border: "none",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--color-primary)",
    border: "none",
  },
};

const HOVER_CLASS: Record<Variant, string> = {
  primary:     "btn-primary",
  secondary:   "btn-secondary",
  destructive: "btn-destructive",
  ghost:       "btn-ghost",
};

export default function Button({
  variant = "primary",
  fullWidth = false,
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <>
      <style>{`
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 10px 20px;
          border-radius: var(--radius-btn);
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s, background-color 0.15s;
          text-decoration: none;
          white-space: nowrap;
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn-primary:not(:disabled):hover  { background-color: var(--color-primary-dark); }
        .btn-secondary:not(:disabled):hover { background-color: #f0ede9; }
        .btn-destructive:not(:disabled):hover { opacity: 0.88; }
        .btn-ghost:not(:disabled):hover { background-color: rgba(139,168,154,0.08); }
        .btn-full { width: 100%; }
      `}</style>
      <button
        className={`btn ${HOVER_CLASS[variant]}${fullWidth ? " btn-full" : ""}`}
        disabled={isDisabled}
        style={{ ...VARIANT_STYLES[variant], ...style }}
        {...rest}
      >
        {loading ? <span style={{ opacity: 0.7 }}>Laddar…</span> : children}
      </button>
    </>
  );
}
