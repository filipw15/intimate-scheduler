import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  id: string;
};

export default function Input({ label, error, id, ...rest }: InputProps) {
  return (
    <>
      <style>{`
        .input-field {
          width: 100%;
          padding: 11px 16px;
          border: 1px solid var(--color-input-border);
          border-radius: var(--radius-input);
          font-size: 15px;
          font-family: inherit;
          color: var(--color-text);
          background-color: var(--color-surface);
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          min-height: 44px;
        }
        .input-field::placeholder {
          color: var(--color-text-secondary);
        }
        .input-field:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(139, 168, 154, 0.18);
        }
        .input-field.input-error {
          border-color: var(--color-error);
        }
        .input-field.input-error:focus {
          box-shadow: 0 0 0 3px rgba(196, 117, 106, 0.18);
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          htmlFor={id}
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
        <input
          id={id}
          className={`input-field${error ? " input-error" : ""}`}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {error && (
          <span
            id={`${id}-error`}
            role="alert"
            style={{
              fontSize: "13px",
              color: "var(--color-error)",
            }}
          >
            {error}
          </span>
        )}
      </div>
    </>
  );
}
