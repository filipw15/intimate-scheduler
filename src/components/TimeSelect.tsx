"use client";

function buildTimeOptions() {
  const opts: { value: string; label: string }[] = [];
  for (let h = 18; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push({ value: v, label: v });
    }
  }
  for (let m = 0; m < 60; m += 15) {
    const v = `00:${String(m).padStart(2, "0")}`;
    opts.push({ value: v, label: v });
  }
  opts.push({ value: "01:00", label: "01:00" });
  return opts;
}
const TIME_OPTIONS = buildTimeOptions();

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

export default function TimeSelect({ label, value, onChange }: Props) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 6 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--color-input-border)",
          borderRadius: "var(--radius-input)",
          fontSize: 15,
          fontFamily: "inherit",
          color: "var(--color-text)",
          backgroundColor: "var(--color-surface)",
          minHeight: 44,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
