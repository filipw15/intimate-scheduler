"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";

// ─── Konstanter ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

/** 18:00–23:45, sedan 00:00–01:00 */
function buildTimeOptions(): { value: string; label: string }[] {
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

const WEEKDAYS = [
  { value: "monday",    label: "Måndag" },
  { value: "tuesday",   label: "Tisdag" },
  { value: "wednesday", label: "Onsdag" },
  { value: "thursday",  label: "Torsdag" },
  { value: "friday",    label: "Fredag" },
  { value: "saturday",  label: "Lördag" },
  { value: "sunday",    label: "Söndag" },
];

// ─── Typer ────────────────────────────────────────────────────────────────────

type Block = { day: string; start: string; end: string; label: string };

type FormData = {
  // Steg 3
  childBedtimeWeekday: string;
  childBedtimeWeekend: string;
  eveningEndWeekday:   string;
  eveningEndWeekend:   string;
  // Steg 4
  blocks: Block[];
  noSundays:         boolean;
  noWeekdays:        boolean;
  notBeforeMidnight: boolean;
  // Steg 5
  tonePref: "playful" | "discreet" | "direct";
  codename: string;
  // Steg 6
  cycleRelevant:     boolean | null;
  lastPeriodStart:   string;
  cycleLengthDays:   number;
  periodLengthDays:  number;
  lowInterestStart:  number;
  lowInterestEnd:    number;
  // Steg 7
  icsUrl: string;
};

const DEFAULT_FORM: FormData = {
  childBedtimeWeekday: "20:00",
  childBedtimeWeekend: "20:30",
  eveningEndWeekday:   "23:00",
  eveningEndWeekend:   "23:30",
  blocks:              [],
  noSundays:           false,
  noWeekdays:          false,
  notBeforeMidnight:   false,
  tonePref:            "discreet",
  codename:            "",
  cycleRelevant:       null,
  lastPeriodStart:     "",
  cycleLengthDays:     28,
  periodLengthDays:    5,
  lowInterestStart:    1,
  lowInterestEnd:      5,
  icsUrl:              "",
};

// ─── Hjälpkomponenter ─────────────────────────────────────────────────────────

function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
      {children}
    </h2>
  );
}

function StepBody({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function TimeSelect({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <FieldLabel>{label}</FieldLabel>
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ height: 1, backgroundColor: "var(--color-border)", marginTop: 6 }} />
    </div>
  );
}

// ─── Progress-indikator ───────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => {
        const active = i + 1 === current;
        const done   = i + 1 < current;
        return (
          <div
            key={i}
            style={{
              width:  active ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: done || active ? "var(--color-primary)" : "var(--color-border)",
              transition: "width 0.2s, background-color 0.2s",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Cykelkarta ───────────────────────────────────────────────────────────────

function CycleMap({
  cycleLength, start, end,
  onChange,
}: {
  cycleLength: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const dragRef = useRef<{ active: boolean; anchor: number }>({ active: false, anchor: 1 });

  function getRange(a: number, b: number) {
    return { s: Math.min(a, b), e: Math.max(a, b) };
  }

  function onDown(day: number) {
    dragRef.current = { active: true, anchor: day };
    onChange(day, day);
  }
  function onEnter(day: number) {
    if (!dragRef.current.active) return;
    const { s, e } = getRange(dragRef.current.anchor, day);
    onChange(s, e);
  }
  function onUp() {
    dragRef.current.active = false;
  }

  return (
    <div
      onMouseLeave={onUp}
      onMouseUp={onUp}
      style={{ userSelect: "none" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
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
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                backgroundColor: selected ? "var(--color-secondary)" : "transparent",
                border: `1.5px solid ${selected ? "var(--color-secondary)" : "var(--color-border)"}`,
                color: selected ? "var(--color-text)" : "var(--color-text-secondary)",
                transition: "background-color 0.1s",
                flexShrink: 0,
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

// ─── Steg ─────────────────────────────────────────────────────────────────────

function Step1({ userName }: { userName: string }) {
  return (
    <div>
      <StepHeading>Välkommen{userName ? `, ${userName}` : ""}.</StepHeading>
      <StepBody>
        Intimate Scheduler hjälper dig och din partner att hitta tid för det som är viktigt —
        utan att behöva prata om det varje gång. Appen analyserar era kalendrar och skickar
        ett diskret förslag när det klaffar för bägge. Allt svar sker via e-post.
      </StepBody>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        Det tar ungefär 3 minuter att ställa in allt.
      </p>
    </div>
  );
}

function Step2({
  partnerEmail, setPartnerEmail, inviteSent, inviteError,
}: {
  partnerEmail: string;
  setPartnerEmail: (v: string) => void;
  inviteSent: boolean;
  inviteError: string | null;
}) {
  if (inviteSent) {
    return (
      <div>
        <StepHeading>Inbjudan skickad!</StepHeading>
        <StepBody>
          Din partner får ett neutralt formulerat mejl med en inbjudningslänk. Ingen information
          om appens syfte delas i mejlet.
        </StepBody>
      </div>
    );
  }
  return (
    <div>
      <StepHeading>Bjud in din partner</StepHeading>
      <StepBody>
        Ange din partners e-postadress. Inbjudan är neutralt formulerad — ingen information om
        appens syfte delas.
      </StepBody>
      <Input
        id="partner-email"
        label="Partners e-postadress"
        type="email"
        value={partnerEmail}
        onChange={(e) => setPartnerEmail(e.target.value)}
        placeholder="partner@epost.se"
        autoComplete="off"
        error={inviteError ?? undefined}
      />
    </div>
  );
}

function Step3({ data, update }: { data: FormData; update: (k: keyof FormData, v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <StepHeading>Tider</StepHeading>
        <StepBody>
          Vi använder dessa tider för att veta när er kväll kan börja och sluta.
        </StepBody>
      </div>

      <SectionDivider label="När brukar barnen somna?" />
      <div style={{ display: "flex", gap: 12 }}>
        <TimeSelect label="Vardagar" value={data.childBedtimeWeekday}
          onChange={(v) => update("childBedtimeWeekday", v)} />
        <TimeSelect label="Helger" value={data.childBedtimeWeekend}
          onChange={(v) => update("childBedtimeWeekend", v)} />
      </div>

      <SectionDivider label="Senaste tid på kvällen?" />
      <div style={{ display: "flex", gap: 12 }}>
        <TimeSelect label="Vardagar" value={data.eveningEndWeekday}
          onChange={(v) => update("eveningEndWeekday", v)} />
        <TimeSelect label="Helger" value={data.eveningEndWeekend}
          onChange={(v) => update("eveningEndWeekend", v)} />
      </div>
    </div>
  );
}

function Step4({
  data,
  updateBlock,
  addBlock,
  removeBlock,
  toggleRule,
}: {
  data: FormData;
  updateBlock: (i: number, field: keyof Block, value: string) => void;
  addBlock: () => void;
  removeBlock: (i: number) => void;
  toggleRule: (rule: "noSundays" | "noWeekdays" | "notBeforeMidnight") => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <StepHeading>Blockerare och regler</StepHeading>
        <StepBody>Finns det kvällar som aldrig fungerar? Lägg till dem här.</StepBody>
      </div>

      {data.blocks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.blocks.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 90px" }}>
                <FieldLabel>Dag</FieldLabel>
                <select
                  value={b.day}
                  onChange={(e) => updateBlock(i, "day", e.target.value)}
                  style={selectStyle}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 70px" }}>
                <FieldLabel>Start</FieldLabel>
                <select value={b.start} onChange={(e) => updateBlock(i, "start", e.target.value)} style={selectStyle}>
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 70px" }}>
                <FieldLabel>Slut</FieldLabel>
                <select value={b.end} onChange={(e) => updateBlock(i, "end", e.target.value)} style={selectStyle}>
                  {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ flex: "2 1 100px" }}>
                <FieldLabel>Etikett (valfri)</FieldLabel>
                <input
                  value={b.label}
                  onChange={(e) => updateBlock(i, "label", e.target.value)}
                  placeholder="T.ex. Padel"
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeBlock(i)}
                aria-label="Ta bort"
                style={{ background: "none", border: "none", color: "var(--color-error)", cursor: "pointer", fontSize: 18, paddingBottom: 8, flexShrink: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" onClick={addBlock}>
        + Lägg till blockerare
      </Button>

      <SectionDivider label="Generella regler" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {([
          { key: "noSundays",         label: "Aldrig på söndagar" },
          { key: "noWeekdays",        label: "Inte på vardagar" },
          { key: "notBeforeMidnight", label: "Inte efter midnatt" },
        ] as const).map(({ key, label }) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 15 }}>
            <input
              type="checkbox"
              checked={data[key]}
              onChange={() => toggleRule(key)}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--color-primary)" }}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Step5({ data, setTonePref, setCodename }: {
  data: FormData;
  setTonePref: (v: "playful" | "discreet" | "direct") => void;
  setCodename: (v: string) => void;
}) {
  const tones: { value: "playful" | "discreet" | "direct"; label: string; example: string }[] = [
    { value: "playful",  label: "Lekfull",  example: "Psst! Onsdag kväll ser lovande ut 💛" },
    { value: "discreet", label: "Diskret",  example: "Påminnelse: onsdag kväll. Svara här." },
    { value: "direct",   label: "Rak",      example: "Förslag: onsdag kväll. Ja eller nej?" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <StepHeading>Personalisering</StepHeading>
        <StepBody>Välj hur du vill att notiserna ska låta.</StepBody>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tones.map((t) => {
          const active = data.tonePref === t.value;
          return (
            <label
              key={t.value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                borderRadius: 10,
                cursor: "pointer",
                backgroundColor: active ? "rgba(139,168,154,0.06)" : "transparent",
                transition: "border-color 0.15s",
              }}
            >
              <input
                type="radio"
                name="tone"
                value={t.value}
                checked={active}
                onChange={() => setTonePref(t.value)}
                style={{ marginTop: 2, accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{t.example}</div>
              </div>
            </label>
          );
        })}
      </div>

      <div>
        <Input
          id="codename"
          label="Kodord för kalenderevents"
          value={data.codename}
          onChange={(e) => setCodename(e.target.value)}
          placeholder="T.ex. Yoga, Bokklubb, PT-session"
        />
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6 }}>
          Det här syns som titel i din kalender.
        </p>
      </div>
    </div>
  );
}

function Step6({ data, update, updateNum, setCycleRelevant, setLowInterest }: {
  data: FormData;
  update: (k: keyof FormData, v: string) => void;
  updateNum: (k: keyof FormData, v: number) => void;
  setCycleRelevant: (v: boolean) => void;
  setLowInterest: (start: number, end: number) => void;
}) {
  // Om valet inte gjorts ännu
  if (data.cycleRelevant === null) {
    return (
      <div>
        <StepHeading>Menscykeldata</StepHeading>
        <StepBody>
          Är det relevant för dig att lägga till menscykeldata? Det hjälper oss att ta hänsyn
          till dina preferenser.
        </StepBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button variant="primary" fullWidth onClick={() => setCycleRelevant(true)}>
            Ja, lägg till
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setCycleRelevant(false)}>
            Nej, inte relevant för mig
          </Button>
        </div>
      </div>
    );
  }

  if (!data.cycleRelevant) {
    return (
      <div>
        <StepHeading>Menscykeldata</StepHeading>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>
          Inga problem — du kan alltid lägga till det senare i inställningarna.
        </p>
      </div>
    );
  }

  const cycleLengthOpts = Array.from({ length: 15 }, (_, i) => i + 21);
  const periodLengthOpts = Array.from({ length: 7 }, (_, i) => i + 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <StepHeading>Menscykeldata</StepHeading>

      <div>
        <Input
          id="period-start"
          label="När började din senaste mens?"
          type="date"
          value={data.lastPeriodStart}
          onChange={(e) => update("lastPeriodStart", e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Cykellängd (dagar)</FieldLabel>
          <select
            value={data.cycleLengthDays}
            onChange={(e) => {
              const len = Number(e.target.value);
              updateNum("cycleLengthDays", len);
              // Justera lowInterestEnd om det överstiger cykellängden
              if (data.lowInterestEnd > len) setLowInterest(data.lowInterestStart, len);
            }}
            style={{ ...selectStyle, width: "100%" }}
          >
            {cycleLengthOpts.map((n) => <option key={n} value={n}>{n} dagar</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Menslängd (dagar)</FieldLabel>
          <select
            value={data.periodLengthDays}
            onChange={(e) => {
              const len = Number(e.target.value);
              updateNum("periodLengthDays", len);
              setLowInterest(1, len);
            }}
            style={{ ...selectStyle, width: "100%" }}
          >
            {periodLengthOpts.map((n) => <option key={n} value={n}>{n} dagar</option>)}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Vilka dagar vill du inte få förslag?</FieldLabel>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
          Klicka eller dra för att markera dagar med lågt intresse.
        </p>
        <CycleMap
          cycleLength={data.cycleLengthDays}
          start={data.lowInterestStart}
          end={data.lowInterestEnd}
          onChange={setLowInterest}
        />
      </div>
    </div>
  );
}

function Step7({ icsUrl, setIcsUrl, icsError }: {
  icsUrl: string;
  setIcsUrl: (v: string) => void;
  icsError: string | null;
}) {
  function handleGoogle() {
    window.location.href = "/api/calendar/connect/google";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <StepHeading>Kalenderanslutning</StepHeading>
        <StepBody>
          Koppla din kalender så att vi kan hitta lediga kvällar automatiskt.
        </StepBody>
      </div>

      <Button variant="primary" fullWidth onClick={handleGoogle}>
        Anslut Google Calendar
      </Button>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>eller</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
      </div>

      <div>
        <Input
          id="ics-url"
          label="Annan kalender (iCal/ICS-länk)"
          type="url"
          value={icsUrl}
          onChange={(e) => setIcsUrl(e.target.value)}
          placeholder="webcal:// eller https://"
          error={icsError ?? undefined}
        />
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6 }}>
          Vi läser bara din kalender, aldrig skriver till den. Inga eventdetaljer sparas.
        </p>
      </div>
    </div>
  );
}

function Step8({ webcalUrl }: { webcalUrl: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StepHeading>Allt är inställt!</StepHeading>
      <StepBody>
        Du får ditt första förslag inom kort. Systemet tittar på era kalendrar och
        skickar ett mejl när det klaffar.
      </StepBody>

      {webcalUrl && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 8 }}>
            Prenumerera på din kalender
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
            Öppna länken nedan på din telefon eller dator för att lägga till godkända events direkt i din kalender.
          </p>
          <a
            href={webcalUrl}
            style={{
              display: "block",
              fontSize: 13,
              color: "var(--color-primary)",
              wordBreak: "break-all",
              marginBottom: 10,
            }}
          >
            {webcalUrl}
          </a>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            iOS: Öppna i Safari → "Prenumerera". Android: Öppna i Chrome → lägg till i Google Kalender.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Inline stilar (delade) ───────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
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
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--color-input-border)",
  borderRadius: "var(--radius-input)",
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--color-text)",
  backgroundColor: "var(--color-surface)",
  minHeight: 44,
  outline: "none",
};

// ─── Huvudkomponent ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step,        setStep]        = useState(1);
  const [userName,    setUserName]    = useState("");
  const [form,        setForm]        = useState<FormData>(DEFAULT_FORM);
  const [saving,      setSaving]      = useState(false);
  const [stepError,   setStepError]   = useState<string | null>(null);
  const [webcalUrl,   setWebcalUrl]   = useState<string | null>(null);

  // Steg 2
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteSent,   setInviteSent]   = useState(false);
  const [inviteError,  setInviteError]  = useState<string | null>(null);

  // Steg 7
  const [icsError, setIcsError] = useState<string | null>(null);

  // Ladda användarnamn
  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d: { display_name?: string }) => { if (d.display_name) setUserName(d.display_name); })
      .catch(() => {});
  }, []);

  // Steg 8: ladda webcal-URL
  useEffect(() => {
    if (step === 8) {
      fetch("/api/webcal/setup", { method: "POST" })
        .then((r) => r.json())
        .then((d: { webcal_url?: string }) => { if (d.webcal_url) setWebcalUrl(d.webcal_url); })
        .catch(() => {});
    }
  }, [step]);

  // Form-uppdaterare
  const update = useCallback((k: keyof FormData, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);
  const updateNum = useCallback((k: keyof FormData, v: number) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);
  const updateBlock = useCallback((i: number, field: keyof Block, value: string) => {
    setForm((f) => {
      const blocks = [...f.blocks];
      blocks[i] = { ...blocks[i]!, [field]: value };
      return { ...f, blocks };
    });
  }, []);
  const addBlock = useCallback(() => {
    setForm((f) => ({
      ...f,
      blocks: [...f.blocks, { day: "monday", start: "18:00", end: "20:00", label: "" }],
    }));
  }, []);
  const removeBlock = useCallback((i: number) => {
    setForm((f) => ({ ...f, blocks: f.blocks.filter((_, j) => j !== i) }));
  }, []);
  const toggleRule = useCallback((rule: "noSundays" | "noWeekdays" | "notBeforeMidnight") => {
    setForm((f) => ({ ...f, [rule]: !f[rule] }));
  }, []);

  // ── API-anrop per steg ────────────────────────────────────────────────────

  async function saveStep2(): Promise<boolean> {
    if (!partnerEmail.trim()) return true; // hoppa över
    setInviteError(null);
    const res = await fetch("/api/couple/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partner_email: partnerEmail.trim() }),
    });
    if (res.ok) { setInviteSent(true); return true; }
    const d = await res.json().catch(() => ({})) as { error?: string };
    setInviteError(d.error ?? "Kunde inte skicka inbjudan.");
    return false;
  }

  async function saveStep3(): Promise<boolean> {
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        child_bedtime_weekday: form.childBedtimeWeekday,
        child_bedtime_weekend: form.childBedtimeWeekend,
        evening_end_weekday:   form.eveningEndWeekday,
        evening_end_weekend:   form.eveningEndWeekend,
      }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({})) as { error?: string };
    setStepError(d.error ?? "Kunde inte spara tider.");
    return false;
  }

  async function saveStep4(): Promise<boolean> {
    const general_rules = [
      ...(form.noSundays         ? [{ rule: "no_sundays" }]          : []),
      ...(form.noWeekdays        ? [{ rule: "no_weekdays" }]         : []),
      ...(form.notBeforeMidnight ? [{ rule: "not_before_midnight" }] : []),
    ];
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recurring_blocks: form.blocks.map((b) => ({
          day: b.day, start: b.start, end: b.end,
          ...(b.label ? { label: b.label } : {}),
        })),
        general_rules,
      }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({})) as { error?: string };
    setStepError(d.error ?? "Kunde inte spara regler.");
    return false;
  }

  async function saveStep5(): Promise<boolean> {
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: userName || "Användare",
        tone_pref:    form.tonePref,
        codename:     form.codename || "Kvällstid",
      }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({})) as { error?: string };
    setStepError(d.error ?? "Kunde inte spara inställningar.");
    return false;
  }

  async function saveStep6(): Promise<boolean> {
    if (!form.cycleRelevant) return true;
    if (!form.lastPeriodStart) {
      setStepError("Ange datum för senaste mens.");
      return false;
    }
    const res = await fetch("/api/cycle", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_period_start:      form.lastPeriodStart,
        cycle_length_days:      form.cycleLengthDays,
        period_length_days:     form.periodLengthDays,
        low_interest_start_day: form.lowInterestStart,
        low_interest_end_day:   form.lowInterestEnd,
      }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({})) as { error?: string };
    setStepError(d.error ?? "Kunde inte spara cykeldata.");
    return false;
  }

  async function saveStep7(): Promise<boolean> {
    if (!form.icsUrl.trim()) return true; // ingen ICS, hoppa över
    const res = await fetch("/api/calendar/connect/ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ics_url: form.icsUrl.trim() }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({})) as { error?: string };
    setIcsError(d.error ?? "Ogiltig ICS-URL.");
    return false;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function handleNext() {
    setStepError(null);
    setSaving(true);
    try {
      let ok = true;
      if (step === 2) ok = await saveStep2();
      if (step === 3) ok = await saveStep3();
      if (step === 4) ok = await saveStep4();
      if (step === 5) ok = await saveStep5();
      if (step === 6) ok = await saveStep6();
      if (step === 7) ok = await saveStep7();
      if (ok) setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function skipStep() {
    setStepError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isLastStep  = step === TOTAL_STEPS;
  const showBack    = step > 1;
  const showNext    = step < TOTAL_STEPS;
  const showSkip    = step === 2 || step === 6 || step === 7;

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
        <ProgressDots current={step} total={TOTAL_STEPS} />

        <Card>
          {/* Steginnehåll */}
          <div style={{ minHeight: 220 }}>
            {step === 1 && <Step1 userName={userName} />}
            {step === 2 && (
              <Step2
                partnerEmail={partnerEmail}
                setPartnerEmail={setPartnerEmail}
                inviteSent={inviteSent}
                inviteError={inviteError}
              />
            )}
            {step === 3 && <Step3 data={form} update={update} />}
            {step === 4 && (
              <Step4
                data={form}
                updateBlock={updateBlock}
                addBlock={addBlock}
                removeBlock={removeBlock}
                toggleRule={toggleRule}
              />
            )}
            {step === 5 && (
              <Step5
                data={form}
                setTonePref={(v) => setForm((f) => ({ ...f, tonePref: v }))}
                setCodename={(v) => setForm((f) => ({ ...f, codename: v }))}
              />
            )}
            {step === 6 && (
              <Step6
                data={form}
                update={update}
                updateNum={updateNum}
                setCycleRelevant={(v) => setForm((f) => ({ ...f, cycleRelevant: v }))}
                setLowInterest={(s, e) => setForm((f) => ({ ...f, lowInterestStart: s, lowInterestEnd: e }))}
              />
            )}
            {step === 7 && (
              <Step7
                icsUrl={form.icsUrl}
                setIcsUrl={(v) => setForm((f) => ({ ...f, icsUrl: v }))}
                icsError={icsError}
              />
            )}
            {step === 8 && <Step8 webcalUrl={webcalUrl} />}
          </div>

          {/* Felmeddelande */}
          {stepError && (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: "10px 14px",
                backgroundColor: "rgba(196,117,106,0.08)",
                border: "1px solid rgba(196,117,106,0.25)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--color-error)",
              }}
            >
              {stepError}
            </div>
          )}

          {/* Navigeringsknappar */}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {isLastStep ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => { window.location.href = "/settings"; }}
              >
                Gå till inställningar
              </Button>
            ) : (
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                onClick={handleNext}
              >
                {step === 1 ? "Kom igång" : "Nästa"}
              </Button>
            )}

            {showSkip && !isLastStep && (
              <Button variant="ghost" fullWidth onClick={skipStep} disabled={saving}>
                {step === 2 ? "Jag har redan en inbjudan — hoppa över" : "Hoppa över"}
              </Button>
            )}

            {showBack && (
              <Button variant="ghost" fullWidth onClick={handleBack} disabled={saving}>
                Tillbaka
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
