"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Accordion from "@/components/Accordion";
import Button from "@/components/Button";
import Input from "@/components/Input";
import TimeSelect from "@/components/TimeSelect";
import CycleMap from "@/components/CycleMap";
import ConfirmDialog from "@/components/ConfirmDialog";

// ─── Typer ────────────────────────────────────────────────────────────────────

type Block = { day: string; start: string; end: string; label: string };

type ProfileData   = { email: string; display_name: string; tone_pref: string; codename: string };
type PrefData      = { child_bedtime_weekday: string; child_bedtime_weekend: string; evening_end_weekday: string; evening_end_weekend: string; recurring_blocks: Block[]; general_rules: { rule: string }[] };
type CycleData     = { last_period_start: string; cycle_length_days: number; period_length_days: number; low_interest_start_day: number; low_interest_end_day: number } | null;
type CalendarData  = { connected: boolean; provider?: string; status?: string; last_synced_at?: string | null };
type CoupleData    = { coupled: boolean; status?: string; partner_name?: string | null };

// ─── Konstanter ───────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { value: "monday", label: "Måndag" }, { value: "tuesday",  label: "Tisdag"  },
  { value: "wednesday", label: "Onsdag" }, { value: "thursday", label: "Torsdag" },
  { value: "friday", label: "Fredag"  }, { value: "saturday", label: "Lördag"  },
  { value: "sunday",  label: "Söndag"  },
];

const SELECT_STYLE: React.CSSProperties = {
  padding: "10px 12px", border: "1px solid var(--color-input-border)", borderRadius: "var(--radius-input)",
  fontSize: 15, fontFamily: "inherit", color: "var(--color-text)", backgroundColor: "var(--color-surface)",
  minHeight: 44, cursor: "pointer", outline: "none", width: "100%",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionMsg({ text, error }: { text?: string; error?: string }) {
  if (error) return <p style={{ fontSize: 13, color: "var(--color-error)", marginTop: 10 }}>{error}</p>;
  if (text)  return <p style={{ fontSize: 13, color: "var(--color-primary)", marginTop: 10 }}>{text}</p>;
  return null;
}

function SectionSave({ onClick, loading, msg, err }: { onClick: () => void; loading: boolean; msg?: string; err?: string }) {
  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
      <Button variant="primary" onClick={onClick} loading={loading}>Spara</Button>
      <SectionMsg text={msg} error={err} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 6 }}>{children}</div>;
}

// ─── Sektion 1: Profil ────────────────────────────────────────────────────────

function ProfileSection({ initial }: { initial: ProfileData }) {
  const [data,    setData]    = useState(initial);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");
  const [err,     setErr]     = useState("");

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const res = await fetch("/api/user/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: data.display_name, tone_pref: data.tone_pref, codename: data.codename }),
    });
    setSaving(false);
    if (res.ok) setMsg("Sparat!");
    else { const d = await res.json().catch(() => ({})) as { error?: string }; setErr(d.error ?? "Fel vid sparning."); }
  }

  const tones: { value: string; label: string; example: string }[] = [
    { value: "playful",  label: "Lekfull",  example: "Psst! Onsdag kväll ser lovande ut 💛" },
    { value: "discreet", label: "Diskret",  example: "Påminnelse: onsdag kväll. Svara här." },
    { value: "direct",   label: "Rak",      example: "Förslag: onsdag kväll. Ja eller nej?" },
  ];

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Input id="display-name" label="Namn" value={data.display_name}
        onChange={(e) => setData((d) => ({ ...d, display_name: e.target.value }))} />
      <div>
        <FieldLabel>E-post</FieldLabel>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", padding: "10px 0" }}>{initial.email}</p>
      </div>
      <div>
        <FieldLabel>Tonalitet för notiser</FieldLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tones.map((t) => {
            const active = data.tone_pref === t.value;
            return (
              <label key={t.value} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                borderRadius: 8, cursor: "pointer", backgroundColor: active ? "rgba(139,168,154,0.06)" : "transparent" }}>
                <input type="radio" name="tone-pref" value={t.value} checked={active}
                  onChange={() => setData((d) => ({ ...d, tone_pref: t.value }))}
                  style={{ marginTop: 2, accentColor: "var(--color-primary)", cursor: "pointer" }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>{t.label}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{t.example}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
      <Input id="codename" label="Kodord" value={data.codename}
        onChange={(e) => setData((d) => ({ ...d, codename: e.target.value }))}
        placeholder="T.ex. Yoga, Bokklubb, PT-session" />
      <SectionSave onClick={save} loading={saving} msg={msg} err={err} />
    </div>
  );
}

// ─── Sektion 2: Tider ─────────────────────────────────────────────────────────

function TimesSection({ initial }: { initial: PrefData }) {
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const res = await fetch("/api/preferences", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ child_bedtime_weekday: d.child_bedtime_weekday, child_bedtime_weekend: d.child_bedtime_weekend,
        evening_end_weekday: d.evening_end_weekday, evening_end_weekend: d.evening_end_weekend }),
    });
    setSaving(false);
    if (res.ok) setMsg("Sparat!"); else { const j = await res.json().catch(() => ({})) as { error?: string }; setErr(j.error ?? "Fel."); }
  }

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <FieldLabel>Barnens sovtid</FieldLabel>
        <div style={{ display: "flex", gap: 12 }}>
          <TimeSelect label="Vardagar" value={d.child_bedtime_weekday} onChange={(v) => setD((x) => ({ ...x, child_bedtime_weekday: v }))} />
          <TimeSelect label="Helger"   value={d.child_bedtime_weekend} onChange={(v) => setD((x) => ({ ...x, child_bedtime_weekend: v }))} />
        </div>
      </div>
      <div>
        <FieldLabel>Senaste tid på kvällen</FieldLabel>
        <div style={{ display: "flex", gap: 12 }}>
          <TimeSelect label="Vardagar" value={d.evening_end_weekday} onChange={(v) => setD((x) => ({ ...x, evening_end_weekday: v }))} />
          <TimeSelect label="Helger"   value={d.evening_end_weekend} onChange={(v) => setD((x) => ({ ...x, evening_end_weekend: v }))} />
        </div>
      </div>
      <SectionSave onClick={save} loading={saving} msg={msg} err={err} />
    </div>
  );
}

// ─── Sektion 3: Blockerare ────────────────────────────────────────────────────

function BlockersSection({ initial }: { initial: PrefData }) {
  const [blocks, setBlocks] = useState<Block[]>(initial.recurring_blocks);
  const [noSundays,         setNoSundays]         = useState(initial.general_rules.some((r) => r.rule === "no_sundays"));
  const [noWeekdays,        setNoWeekdays]        = useState(initial.general_rules.some((r) => r.rule === "no_weekdays"));
  const [notBeforeMidnight, setNotBeforeMidnight] = useState(initial.general_rules.some((r) => r.rule === "not_before_midnight"));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  async function save() {
    setSaving(true); setMsg(""); setErr("");
    const general_rules = [
      ...(noSundays         ? [{ rule: "no_sundays" }]          : []),
      ...(noWeekdays        ? [{ rule: "no_weekdays" }]         : []),
      ...(notBeforeMidnight ? [{ rule: "not_before_midnight" }] : []),
    ];
    const res = await fetch("/api/preferences", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurring_blocks: blocks, general_rules }),
    });
    setSaving(false);
    if (res.ok) setMsg("Sparat!"); else { const j = await res.json().catch(() => ({})) as { error?: string }; setErr(j.error ?? "Fel."); }
  }

  function updateBlock(i: number, field: keyof Block, value: string) {
    setBlocks((bs) => bs.map((b, j) => j === i ? { ...b, [field]: value } : b));
  }

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px", border: "1px solid var(--color-input-border)",
    borderRadius: "var(--radius-input)", fontSize: 15, fontFamily: "inherit",
    color: "var(--color-text)", backgroundColor: "var(--color-surface)", minHeight: 44, outline: "none", width: "100%",
  };

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {blocks.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 90px" }}>
            <FieldLabel>Dag</FieldLabel>
            <select value={b.day} onChange={(e) => updateBlock(i, "day", e.target.value)} style={SELECT_STYLE}>
              {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 70px" }}>
            <FieldLabel>Start</FieldLabel>
            <TimeSelect label="" value={b.start} onChange={(v) => updateBlock(i, "start", v)} />
          </div>
          <div style={{ flex: "1 1 70px" }}>
            <FieldLabel>Slut</FieldLabel>
            <TimeSelect label="" value={b.end} onChange={(v) => updateBlock(i, "end", v)} />
          </div>
          <div style={{ flex: "2 1 110px" }}>
            <FieldLabel>Etikett</FieldLabel>
            <input value={b.label} onChange={(e) => updateBlock(i, "label", e.target.value)}
              placeholder="T.ex. Padel" style={inputStyle} />
          </div>
          <button type="button" onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
            aria-label="Ta bort" style={{ background: "none", border: "none", color: "var(--color-error)", cursor: "pointer", fontSize: 20, paddingBottom: 10, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <Button variant="secondary"
        onClick={() => setBlocks((bs) => [...bs, { day: "monday", start: "18:00", end: "20:00", label: "" }])}>
        + Lägg till blockerare
      </Button>

      <div style={{ marginTop: 8 }}>
        <FieldLabel>Generella regler</FieldLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {([
            { state: noSundays,         setter: setNoSundays,         label: "Aldrig på söndagar" },
            { state: noWeekdays,        setter: setNoWeekdays,        label: "Inte på vardagar" },
            { state: notBeforeMidnight, setter: setNotBeforeMidnight, label: "Inte efter midnatt" },
          ] as const).map(({ state: checked, setter, label }) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 15 }}>
              <input type="checkbox" checked={checked} onChange={() => setter((v) => !v)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <SectionSave onClick={save} loading={saving} msg={msg} err={err} />
    </div>
  );
}

// ─── Sektion 4: Menscykel ─────────────────────────────────────────────────────

function CycleSection({ initial }: { initial: CycleData }) {
  const [enabled, setEnabled] = useState(initial !== null);
  const [lastPeriod, setLastPeriod]   = useState(initial?.last_period_start?.slice(0, 10) ?? "");
  const [cycleLen,   setCycleLen]     = useState(initial?.cycle_length_days  ?? 28);
  const [periodLen,  setPeriodLen]    = useState(initial?.period_length_days ?? 5);
  const [liStart,    setLiStart]      = useState(initial?.low_interest_start_day ?? 1);
  const [liEnd,      setLiEnd]        = useState(initial?.low_interest_end_day   ?? 5);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  async function save() {
    if (!enabled) { setMsg("Cykeldata är inaktiverat."); return; }
    if (!lastPeriod) { setErr("Ange datum för senaste mens."); return; }
    setSaving(true); setMsg(""); setErr("");
    const res = await fetch("/api/cycle", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_period_start: lastPeriod, cycle_length_days: cycleLen,
        period_length_days: periodLen, low_interest_start_day: liStart, low_interest_end_day: liEnd }),
    });
    setSaving(false);
    if (res.ok) setMsg("Sparat!"); else { const j = await res.json().catch(() => ({})) as { error?: string }; setErr(j.error ?? "Fel."); }
  }

  const cycleLengthOpts = Array.from({ length: 15 }, (_, i) => i + 21);
  const periodLengthOpts = Array.from({ length: 7 },  (_, i) => i + 2);

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 15, fontWeight: 500 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }} />
        Aktivera cykeldata
      </label>

      {enabled && (
        <>
          <Input id="last-period" label="Senaste mens startade" type="date" value={lastPeriod}
            onChange={(e) => setLastPeriod(e.target.value)} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Cykellängd</FieldLabel>
              <select value={cycleLen} onChange={(e) => { const n = Number(e.target.value); setCycleLen(n); if (liEnd > n) setLiEnd(n); }} style={SELECT_STYLE}>
                {cycleLengthOpts.map((n) => <option key={n} value={n}>{n} dagar</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Menslängd</FieldLabel>
              <select value={periodLen} onChange={(e) => { const n = Number(e.target.value); setPeriodLen(n); setLiStart(1); setLiEnd(n); }} style={SELECT_STYLE}>
                {periodLengthOpts.map((n) => <option key={n} value={n}>{n} dagar</option>)}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>Dagar med lågt intresse</FieldLabel>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
              Klicka eller dra för att markera.
            </p>
            <CycleMap cycleLength={cycleLen} start={liStart} end={liEnd}
              onChange={(s, e) => { setLiStart(s); setLiEnd(e); }} />
          </div>
        </>
      )}
      <SectionSave onClick={save} loading={saving} msg={msg} err={err} />
    </div>
  );
}

// ─── Sektion 5: Kalender ─────────────────────────────────────────────────────

function CalendarSection({ initial }: { initial: CalendarData; }) {
  const [data,      setData]      = useState(initial);
  const [icsUrl,    setIcsUrl]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState("");
  const [err,       setErr]       = useState("");
  const [showIcs,   setShowIcs]   = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [disconnecting,     setDisconnecting]     = useState(false);

  async function connectIcs() {
    setSaving(true); setMsg(""); setErr("");
    const res = await fetch("/api/calendar/connect/ics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ics_url: icsUrl }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Kalender ansluten!"); setShowIcs(false); setData({ connected: true, provider: "ics_url", status: "active" }); }
    else { const j = await res.json().catch(() => ({})) as { error?: string }; setErr(j.error ?? "Ogiltig URL."); }
  }

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch("/api/calendar/disconnect", { method: "DELETE" });
    setDisconnecting(false); setDisconnectConfirm(false);
    if (res.ok) { setData({ connected: false }); setMsg("Frånkopplad."); }
    else setErr("Kunde inte koppla bort.");
  }

  const providerLabel = data.provider === "google" ? "Google Calendar" : data.provider === "ics_url" ? "iCal/ICS" : "";
  const syncedAt = data.last_synced_at
    ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.last_synced_at))
    : null;

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {data.connected ? (
        <>
          <div style={{ padding: "12px 14px", backgroundColor: "rgba(139,168,154,0.08)", borderRadius: 8, border: "1px solid rgba(139,168,154,0.2)" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)", marginBottom: 2 }}>
              Ansluten: {providerLabel}
            </p>
            {syncedAt && <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Senast synkad: {syncedAt}</p>}
            {data.status === "error"   && <p style={{ fontSize: 13, color: "var(--color-error)" }}>Synkfel — kontrollera anslutningen.</p>}
            {data.status === "expired" && <p style={{ fontSize: 13, color: "var(--color-error)" }}>Token har gått ut — anslut på nytt.</p>}
          </div>
          <Button variant="destructive" onClick={() => setDisconnectConfirm(true)}>Koppla bort kalender</Button>
          {data.provider === "google" && (
            <Button variant="secondary" onClick={() => { window.location.href = "/api/calendar/connect/google"; }}>
              Återanslut Google Calendar
            </Button>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Ingen kalender ansluten.</p>
          <Button variant="primary" onClick={() => { window.location.href = "/api/calendar/connect/google"; }}>
            Anslut Google Calendar
          </Button>
          <Button variant="ghost" onClick={() => setShowIcs((v) => !v)}>
            {showIcs ? "Dölj iCal-formulär" : "Anslut iCal/ICS-länk"}
          </Button>
          {showIcs && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Input id="ics-url-settings" label="ICS-URL" type="url" value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)} placeholder="webcal:// eller https://" />
              <Button variant="primary" loading={saving} onClick={connectIcs}>Anslut</Button>
            </div>
          )}
        </>
      )}
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        Vi läser bara din kalender, aldrig skriver till den. Inga eventdetaljer sparas.
      </p>
      <SectionMsg text={msg} error={err} />
      <ConfirmDialog open={disconnectConfirm} title="Koppla bort kalender"
        message="Kalenderanslutningen och all sparad tillgänglighetsdata tas bort. Du kan ansluta igen när som helst."
        confirmLabel="Koppla bort" confirmVariant="destructive" loading={disconnecting}
        onConfirm={disconnect} onCancel={() => setDisconnectConfirm(false)} />
    </div>
  );
}

// ─── Sektion 6: Par ───────────────────────────────────────────────────────────

function CoupleSection({ initial }: { initial: CoupleData }) {
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [dissolving,   setDissolving]   = useState(false);
  const [err, setErr] = useState("");

  async function dissolve() {
    setDissolving(true);
    const res = await fetch("/api/couple/dissolve", { method: "POST" });
    setDissolving(false); setDissolveOpen(false);
    if (res.ok) window.location.href = "/dashboard";
    else setErr("Kunde inte bryta koppling.");
  }

  return (
    <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {initial.coupled ? (
        <>
          <div style={{ padding: "12px 14px", backgroundColor: "var(--color-bg)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 2 }}>Partner</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text)" }}>
              {initial.partner_name ?? "Väntar på att partner accepterar"}
            </p>
            {initial.status === "pending" && (
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>Inbjudan ej accepterad</p>
            )}
          </div>
          <Button variant="destructive" onClick={() => setDissolveOpen(true)}>Bryt koppling</Button>
          {err && <p style={{ fontSize: 13, color: "var(--color-error)" }}>{err}</p>}
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Inget aktivt par.</p>
          <a href="/onboarding" style={{ fontSize: 14, color: "var(--color-primary)", fontWeight: 500 }}>Bjud in din partner →</a>
        </>
      )}
      <ConfirmDialog open={dissolveOpen} title="Bryt koppling"
        message="Kopplingen till din partner bryts omedelbart. Aktiva förslag avslutas. Åtgärden kan inte ångras."
        confirmLabel="Ja, bryt koppling" confirmVariant="destructive" loading={dissolving}
        onConfirm={dissolve} onCancel={() => setDissolveOpen(false)} />
    </div>
  );
}

// ─── Sektion 7: Konto ─────────────────────────────────────────────────────────

function AccountSection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [err, setErr] = useState("");

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/user/account", { method: "DELETE" });
    setDeleting(false);
    if (res.ok) window.location.href = "/";
    else setErr("Kunde inte radera kontot. Försök igen.");
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
        Tar bort ditt konto, alla personuppgifter, kalenderanslutningar och förslag. Åtgärden kan inte ångras.
      </p>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Radera mitt konto och all data</Button>
      {err && <p style={{ fontSize: 13, color: "var(--color-error)", marginTop: 10 }}>{err}</p>}
      <ConfirmDialog open={deleteOpen} title="Radera konto"
        message="All din data raderas permanent, inklusive kalenderanslutningar, preferenser och förslag. Din partner påverkas inte men kopplingen bryts."
        confirmLabel="Radera permanent" confirmVariant="destructive" requireText="RADERA" loading={deleting}
        onConfirm={deleteAccount} onCancel={() => setDeleteOpen(false)} />
    </div>
  );
}

// ─── Sidinnehåll (hanterar query params) ─────────────────────────────────────

type AllData = {
  profile:  ProfileData;
  prefs:    PrefData;
  cycle:    CycleData;
  calendar: CalendarData;
  couple:   CoupleData;
};

const DEFAULT_PREFS: PrefData = {
  child_bedtime_weekday: "20:00", child_bedtime_weekend: "20:30",
  evening_end_weekday:   "23:00", evening_end_weekend:   "23:30",
  recurring_blocks: [], general_rules: [],
};

function SettingsContent() {
  const searchParams = useSearchParams();
  const calendarMsg = searchParams.get("calendar_connected") === "1"
    ? "Kalender ansluten!"
    : searchParams.get("calendar_error")
    ? "Det gick inte att ansluta kalendern. Försök igen."
    : null;

  const [data,    setData]    = useState<AllData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/profile").then((r) => r.json() as Promise<ProfileData>),
      fetch("/api/preferences").then((r) => r.ok ? r.json() as Promise<PrefData> : Promise.resolve(DEFAULT_PREFS)),
      fetch("/api/cycle").then((r)       => r.ok ? r.json() as Promise<CycleData>    : Promise.resolve(null)),
      fetch("/api/calendar/status").then((r) => r.json() as Promise<CalendarData>),
      fetch("/api/couple/status").then((r)   => r.json() as Promise<CoupleData>),
    ]).then(([profile, prefs, cycle, calendar, couple]) => {
      setData({ profile, prefs: prefs ?? DEFAULT_PREFS, cycle, calendar, couple });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)" }}>Laddar…</p>
      </div>
    );
  }

  if (!data) {
    return <p style={{ fontSize: 15, color: "var(--color-error)" }}>Kunde inte ladda inställningar.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {calendarMsg && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, marginBottom: 8, fontSize: 14,
          backgroundColor: searchParams.get("calendar_connected") ? "rgba(139,168,154,0.1)" : "rgba(196,117,106,0.08)",
          border: `1px solid ${searchParams.get("calendar_connected") ? "rgba(139,168,154,0.3)" : "rgba(196,117,106,0.25)"}`,
          color: searchParams.get("calendar_connected") ? "var(--color-primary)" : "var(--color-error)",
        }}>
          {calendarMsg}
        </div>
      )}

      <Accordion title="Profil">
        <ProfileSection initial={data.profile} />
      </Accordion>
      <Accordion title="Tider">
        <TimesSection initial={data.prefs} />
      </Accordion>
      <Accordion title="Blockerare och regler">
        <BlockersSection initial={data.prefs} />
      </Accordion>
      <Accordion title="Menscykeldata">
        <CycleSection initial={data.cycle} />
      </Accordion>
      <Accordion title="Kalender">
        <CalendarSection initial={data.calendar} />
      </Accordion>
      <Accordion title="Par">
        <CoupleSection initial={data.couple} />
      </Accordion>
      <Accordion title="Konto">
        <AccountSection />
      </Accordion>
    </div>
  );
}

// ─── Sida ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px 16px 64px", backgroundColor: "var(--color-bg)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text)" }}>Inställningar</h1>
          <a href="/dashboard" style={{ fontSize: 14, color: "var(--color-primary)", textDecoration: "none" }}>← Dashboard</a>
        </div>
        <Suspense fallback={<p style={{ color: "var(--color-text-secondary)" }}>Laddar…</p>}>
          <SettingsContent />
        </Suspense>
      </div>
    </main>
  );
}
