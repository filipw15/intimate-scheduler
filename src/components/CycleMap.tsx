"use client";

import { useRef } from "react";

type Props = {
  cycleLength: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
};

export default function CycleMap({ cycleLength, start, end, onChange }: Props) {
  const dragRef = useRef<{ active: boolean; anchor: number }>({ active: false, anchor: 1 });

  function onDown(day: number) {
    dragRef.current = { active: true, anchor: day };
    onChange(day, day);
  }
  function onEnter(day: number) {
    if (!dragRef.current.active) return;
    const s = Math.min(dragRef.current.anchor, day);
    const e = Math.max(dragRef.current.anchor, day);
    onChange(s, e);
  }
  function onUp() {
    dragRef.current.active = false;
  }

  return (
    <div onMouseLeave={onUp} onMouseUp={onUp} style={{ userSelect: "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {Array.from({ length: cycleLength }, (_, i) => {
          const day = i + 1;
          const selected = day >= start && day <= end;
          return (
            <div
              key={day}
              onMouseDown={() => onDown(day)}
              onMouseEnter={() => onEnter(day)}
              onTouchStart={() => onDown(day)}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: selected ? "var(--color-secondary)" : "transparent",
                border: `1.5px solid ${selected ? "var(--color-secondary)" : "var(--color-border)"}`,
                color: selected ? "var(--color-text)" : "var(--color-text-secondary)",
                transition: "background-color 0.1s",
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>
        Dag {start}–{end} markerade. Klicka eller dra för att ändra.
      </p>
    </div>
  );
}
