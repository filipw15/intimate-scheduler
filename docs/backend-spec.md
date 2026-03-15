# Intimate Scheduler — Backend & Tech Spec (MVP)

> Målgrupp: Utvecklare som ska implementera backend, API och integrationer.
> Fas: MVP
> Senast uppdaterad: Mars 2026

---

## 1. Produktöversikt (kort)

Intimate Scheduler hjälper par att hitta lämpliga tillfällen för intimitet. Appen analyserar kalenderdata, personliga preferenser och valfri menscykeldata, identifierar kvällar där allt "klaffar", och kör sedan ett anonymt consent-flöde där bägge parter svarar oberoende.

**Kärnprincip:** Ingen part ser den andras svar förrän bägge har svarat.

---

## 2. Tech Stack (MVP)

| Komponent | Val | Motivering |
|---|---|---|
| Frontend | Next.js (React) | SSR, responsiv, enkel PWA-migration senare |
| Backend/API | Next.js API Routes + tRPC eller separata API-routes | Monorepo-approach för MVP, mindre infra att hantera |
| Databas | PostgreSQL | Relationsmodell passar datamodellen, JSONB för flexibla preferenser |
| ORM | Prisma | Typsäkert, bra migration-stöd, fungerar med Next.js |
| Auth | Magic link via e-post (eget flöde eller NextAuth.js med Email Provider) | Inga lösenord att hantera, lägre friktion |
| Kalendersynk | Google Calendar API (OAuth 2.0, `calendar.readonly`) | Täcker majoriteten av användare i MVP |
| E-post | Resend | Enkelt API, bra templating, gratis tier räcker för MVP |
| Webcal/ICS | `ics`-bibliotek (npm) | Genererar standard ICS-filer |
| Hosting (MVP) | Homelab via Docker Compose på `192.168.10.32:3200` | Låg kostnad, men arkitekturen ska vara portabel till Vercel + Railway/Fly.io |
| Scheduling | Node-cron eller BullMQ (Redis-backed) | Veckovis matchning + daglig expiry-check |

### Arkitekturprinciper

- **Containeriserad från start.** Docker Compose med separata containers för app och Redis. PostgreSQL körs på en dedikerad VM (`192.168.10.31`), inte som container.
- **Skalbarhet i tänket.** Inga hårdkodade antaganden om single-instance. Stateless API, databas som enda shared state.
- **Miljövariabler för all konfiguration.** Google OAuth-credentials, e-post-API-nycklar, databas-URL, etc.
- **Inga kalenderhändelsers rådata lagras.** Enbart deriverad GO/NO-GO per dag.

---

## 3. Datamodell

### 3.1 User

```
id              UUID, PK
email           String, unique
display_name    String
tone_pref       Enum: 'playful' | 'discreet' | 'direct'
codename        String (t.ex. "Yoga med Lisa")
created_at      Timestamp
updated_at      Timestamp
```

### 3.2 Couple

```
id              UUID, PK
user_a_id       FK → User
user_b_id       FK → User (nullable tills B registrerat sig)
status          Enum: 'pending' | 'active' | 'dissolved'
invite_token    String, unique (för inbjudningslänk)
created_at      Timestamp
dissolved_at    Timestamp, nullable
```

**Regler:**
- En User kan bara tillhöra ett aktivt Couple åt gången.
- `dissolved` innebär att kopplingen brutits. Historisk data (proposals etc.) behålls men systemet slutar generera nya förslag.
- Bägge parter kan initiera en "bryt koppling"-action. Det kräver ingen bekräftelse från den andra parten.

### 3.3 Preference

```
id                      UUID, PK
user_id                 FK → User
child_bedtime_weekday   Time (t.ex. 20:00)
child_bedtime_weekend   Time (t.ex. 20:30)
evening_end_weekday     Time (t.ex. 23:00)
evening_end_weekend     Time (t.ex. 23:30)
recurring_blocks        JSONB (array av objekt, se nedan)
general_rules           JSONB (array av regler, se nedan)
updated_at              Timestamp
```

**recurring_blocks format:**
```json
[
  { "day": "wednesday", "start": "18:00", "end": "20:00", "label": "Padel" },
  { "day": "friday", "start": "19:00", "end": "22:00", "label": "Afterwork" }
]
```

**general_rules format:**
```json
[
  { "rule": "no_sundays" },
  { "rule": "not_before_midnight" },
  { "rule": "no_weekdays" }
]
```

Reglerna är fördefinierade val i UI, inte fritext. Backend validerar mot en känd lista av rule-typer.

### 3.4 CycleData

```
id                      UUID, PK
user_id                 FK → User
last_period_start       Date
cycle_length_days       Integer (default 28)
period_length_days      Integer (default 5)
low_interest_start_day  Integer (dag i cykeln, t.ex. 1)
low_interest_end_day    Integer (dag i cykeln, t.ex. 7)
updated_at              Timestamp
```

**Notera:** `low_interest_start_day` / `low_interest_end_day` anger vilka dagar i cykeln personen typiskt inte är intresserad. Detta kan vara bredare än själva mensperioden. Personen väljer själv detta intervall.

**Cykelprognos:** Enkel framräkning. `last_period_start + cycle_length_days` = nästa förväntade period. Ingen historik av flera cykler i MVP.

**Månadsvis bekräftelse:** Systemet frågar en gång per månad: "Kom mensen som förväntat?" Om inte, uppdateras `last_period_start` med faktiskt startdatum.

### 3.5 CalendarConnection

```
id                  UUID, PK
user_id             FK → User
provider            Enum: 'google' | 'ics_url'
oauth_token         String, encrypted (för Google)
refresh_token       String, encrypted (för Google)
ics_url             String (för ICS/iCal-prenumeration)
last_synced_at      Timestamp
status              Enum: 'active' | 'expired' | 'error'
```

**Google Calendar:** OAuth 2.0, scope `calendar.readonly`. Token refresh hanteras automatiskt.

**ICS-import (generisk):** Användaren klistrar in en webcal/ICS-URL. Systemet pollar denna URL med jämna intervall. Täcker Apple Calendar, Outlook (via publicerad ICS), och andra.

### 3.6 Availability

```
id              UUID, PK
user_id         FK → User
date            Date
is_available    Boolean
reason_code     String (för intern debugging, aldrig exponerat till användare)
generated_at    Timestamp
```

**reason_code-värden:** `calendar_conflict`, `travel`, `early_morning`, `recurring_block`, `general_rule`, `cycle_low_interest`, `different_location`, `available`

Denna tabell regenereras vid varje kalendersynk. Den representerar deriverad data, inte rådata.

### 3.7 Proposal

```
id                  UUID, PK
couple_id           FK → Couple
proposed_date       Date
proposed_time       Time (= barnens sovtid för den dagen)
status              Enum: 'pending' | 'accepted' | 'declined' | 'expired'
user_a_response     Enum: 'yes' | 'no' | null
user_b_response     Enum: 'yes' | 'no' | null
user_a_token        String, unique (för e-postlänk)
user_b_token        String, unique (för e-postlänk)
created_at          Timestamp
expires_at          Timestamp (created_at + 24h)
resolved_at         Timestamp, nullable
```

**Regler:**
- Ingen part kan se den andras svar förrän bägge har svarat.
- Om bägge svarar `yes` → status = `accepted`, kalender-event skapas.
- Om någon svarar `no` → status = `declined`. Ingen notifikation till den andra parten.
- Om `expires_at` passeras utan att bägge svarat → status = `expired`. Ingen notifikation.
- Tokens är kryptografiskt slumpmässiga (minst 32 tecken, URL-safe).

### 3.8 CalendarSubscription

```
id                  UUID, PK
couple_id           FK → Couple
webcal_token        String, unique (URL-safe, minst 32 tecken)
```

Bekräftade events hämtas dynamiskt från Proposal-tabellen vid varje ICS-request. Ingen separat lagring av events.

---

## 4. API-endpoints

### 4.1 Auth

| Method | Path | Beskrivning |
|---|---|---|
| POST | `/api/auth/magic-link` | Skickar magic link till angiven e-post |
| GET | `/api/auth/verify?token=xxx` | Verifierar magic link, sätter session |
| POST | `/api/auth/logout` | Avslutar session |

### 4.2 Onboarding & parkoppling

| Method | Path | Beskrivning |
|---|---|---|
| POST | `/api/couple/invite` | Skapar Couple (pending), skickar inbjudan till partner |
| GET | `/api/couple/invite/:token` | Hämtar inbjudningsinfo (för B:s registreringssida) |
| POST | `/api/couple/accept/:token` | B accepterar, Couple → active |
| POST | `/api/couple/dissolve` | Bryt koppling. Kräver autentisering. |
| GET | `/api/couple/status` | Hämtar aktuell kopplingstatus |

### 4.3 Preferenser

| Method | Path | Beskrivning |
|---|---|---|
| GET | `/api/preferences` | Hämtar inloggad användares preferenser |
| PUT | `/api/preferences` | Uppdaterar preferenser |
| GET | `/api/cycle` | Hämtar menscykeldata |
| PUT | `/api/cycle` | Uppdaterar menscykeldata |
| POST | `/api/cycle/confirm` | Månadsvis bekräftelse ("kom mensen som förväntat?") |

### 4.4 Kalenderintegration

| Method | Path | Beskrivning |
|---|---|---|
| GET | `/api/calendar/connect/google` | Startar Google OAuth-flöde |
| GET | `/api/calendar/callback/google` | OAuth callback |
| POST | `/api/calendar/connect/ics` | Sparar en ICS-URL för polling |
| DELETE | `/api/calendar/disconnect` | Tar bort kalenderanslutning |
| GET | `/api/calendar/status` | Synkstatus |

### 4.5 Förslag & consent

| Method | Path | Beskrivning |
|---|---|---|
| GET | `/api/proposals` | Hämtar aktiva förslag för inloggad användare |
| GET | `/api/proposals/respond/:token/:response` | One-click svar (response = yes/no). Kräver INTE autentisering (token är hemligt). |

**Viktigt om one-click-svar:** E-postlänken pekar direkt på respond-endpointen med token + svar. Sidan som visas efter klick bekräftar att svaret registrerats. Ingen ytterligare bekräftelse krävs.

**Skydd mot prefetch/link-preview:** Endpointen måste vara GET (för att fungera som klickbar länk), men svaret ska bara registreras vid första anropet. Efterföljande anrop returnerar "redan besvarat". Lägg till en User-Agent-check som avvisar kända bot/preview-agenter (Slackbot, Googlebot, etc.) med en redirect till en infosida istället.

### 4.6 Webcal

| Method | Path | Beskrivning |
|---|---|---|
| GET | `/api/webcal/:token` | Returnerar ICS-fil med alla bekräftade events. Content-Type: text/calendar |

### 4.7 Kontoinställningar

| Method | Path | Beskrivning |
|---|---|---|
| GET | `/api/user/profile` | Hämtar profil |
| PUT | `/api/user/profile` | Uppdatera display_name, tone_pref, codename |
| DELETE | `/api/user/account` | Radera allt (GDPR right to erasure) |

---

## 5. Bakgrundsjobb

### 5.1 Kalendersynk

- **Frekvens:** Var 30:e minut (MVP). Konfigurerbart.
- **Logik:** För varje aktiv CalendarConnection:
  1. Hämta events för kommande 14 dagar.
  2. Extrahera: tidsblock (start/slut), plats (stad-nivå, inte exakt adress), heldagsflagga.
  3. Kassera eventnamn, beskrivningar, deltagare omedelbart.
  4. Beräkna Availability för varje dag/kväll baserat på matchningskriterierna.
  5. Spara deriverad GO/NO-GO till Availability-tabellen.

**Google Calendar:** Använd `events.list` med `timeMin`/`timeMax`. Extrahera `start`, `end`, `location` (parsa till stad om möjligt), `allDay`-flagga.

**ICS-import:** Fetch ICS-URL, parsa med `ical.js` eller liknande. Samma extraheringslogik.

### 5.2 Veckovis matchning

- **Frekvens:** En gång per vecka (konfigurerbar dag/tid, default måndag morgon).
- **Logik:**
  1. För varje aktivt Couple: hämta Availability för bägge parter, kommande 7-14 dagar.
  2. Identifiera dagar där bägge har `is_available = true`.
  3. Tillämpa menscykelfilter (om CycleData finns): beräkna om datumet faller inom `low_interest` intervallet.
  4. Tillämpa generella preferenser (no_sundays, etc.).
  5. Generera Proposal för varje matchande kväll.
  6. Skicka notis-e-post till bägge parter för varje Proposal.

**Observera:** Matchningen är binär. Ingen ranking eller viktning. Antingen klaffar det eller inte.

### 5.3 Expiry-check

- **Frekvens:** Varje timme.
- **Logik:** Hitta alla Proposals där `expires_at` har passerat och status fortfarande är `pending`. Sätt status till `expired`. Ingen notifikation skickas.

### 5.4 Månadsvis underhåll

- **Frekvens:** Första dagen i varje månad (eller 30 dagar efter senaste bekräftelse).
- **Logik:** Skicka e-post till alla aktiva användare med uppmaning att:
  - Verifiera preferenser (sovtider, blockerare).
  - Bekräfta/uppdatera menscykeldata (om tillämpligt).

---

## 6. Matchningsalgoritm (detalj)

För en given kväll och en given användare, evaluera följande i ordning:

```
1. KALENDER: Heldagsevent idag?                          → NO-GO (travel)
2. KALENDER: Flerdagsevent som täcker idag?               → NO-GO (travel)
3. KALENDER: Har events med platsdata i annan stad?       → NO-GO (different_location)
4. KALENDER: Events efter barnens sovtid?                 → NO-GO (calendar_conflict)
5. KALENDER: Första event imorgon börjar före 06:00?      → NO-GO (early_morning)
6. PREFERENS: Matchar en återkommande blockerare?          → NO-GO (recurring_block)
7. PREFERENS: Bryter mot generell regel?                  → NO-GO (general_rule)
8. CYKELDATA: Faller inom low_interest-intervall?          → NO-GO (cycle_low_interest)
9. TID: Är klockan mellan sovtid och evening_end?          → GO om ja, NO-GO om fönstret inte finns
```

**Bägge parter måste vara GO för att ett förslag genereras.**

### Tidszonshantering

- Alla tider lagras i UTC internt.
- Varje användare har en `timezone`-inställning (lägg till i User-modellen, default `Europe/Stockholm`).
- Matchningslogiken konverterar till lokal tid vid evaluering.
- Om en part reser (event med platsdata i annan tidszon), används eventets tidszon för den dagen.

### "Samma ort"-logik

- Om ingen platsdata finns → tolkas som "hemma".
- Om bägge har platsdata i samma stad → OK.
- Om en har platsdata i annan stad, den andra saknar platsdata → NO-GO (konservativt antagande).
- Stadsextraktion: parsa `location`-fältet, extrahera stad. Enkel string-matching räcker för MVP, ingen geocoding.

---

## 7. E-postnotiser

### 7.1 Tonalitetsmallar

Varje notis har tre varianter. Systemet använder den variant som matchar mottagarens `tone_pref`.

**Förslag-notis (Proposal skapad):**

| Tonalitet | Exempel |
|---|---|
| Playful | "Hej [namn]! Ser ut som att [dag] kväll kan bli mysig. Bara du vet om du vill. 💛" |
| Discreet | "[Kodord]-påminnelse: [dag] kväll. Svara här." |
| Direct | "Förslag: [dag] kväll efter [sovtid]. Ja eller nej?" |

**Bekräftelse (bägge svarade ja):**

| Tonalitet | Exempel |
|---|---|
| Playful | "Det blev en match! [dag] kväll är bokad. Kolla kalendern. 😊" |
| Discreet | "[Kodord] bekräftat för [dag]. Tillagt i din kalender." |
| Direct | "Bekräftat: [dag] kväll. Event tillagt." |

**Ingen match-notis skickas.** Om den andra parten svarar nej eller inte svarar, händer ingenting. Tystnad = integritet.

### 7.2 Inbjudningsmejl

Neutralt formulerat. Inga explicita referenser till intimitet. Exempel:

> "Hej! [Namn] har bjudit in dig till Intimate Scheduler, en app för att enklare hitta kvalitetstid tillsammans. Klicka här för att komma igång."

### 7.3 Tekniskt

- Resend API med HTML-mallar.
- Varje e-post innehåller unika tokens (inga session-baserade länkar).
- Ja/Nej-länkar pekar på `/api/proposals/respond/:token/yes` respektive `/api/proposals/respond/:token/no`.
- Unsubscribe-länk i varje e-post (GDPR-krav).

---

## 8. Webcal/ICS-output

Endpointen `/api/webcal/:token` genererar en ICS-fil dynamiskt:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Intimate Scheduler//EN
X-WR-CALNAME:[Kodord]
BEGIN:VEVENT
DTSTART:20260320T200000
DTEND:20260320T210000
SUMMARY:[Kodord]
UID:proposal-uuid@intimate-scheduler
END:VEVENT
END:VCALENDAR
```

- **Eventtid:** Från barnens sovtid till sovtid + 1 timme (eller till evening_end, beroende på vad som är rimligast). Välj sovtid + 1h som default, det är diskret.
- **Titel:** Användarens kodord. Samma för alla events.
- **Ingen beskrivning.** Tomt description-fält.
- **Historik behålls.** Passerade events ligger kvar i ICS-filen.
- Bägge parter har varsin unik webcal-URL.

---

## 9. Säkerhet

### 9.1 Autentisering
- Magic link med 15 minuters giltighetstid.
- Session via HTTP-only, Secure, SameSite=Strict cookie.
- Session-längd: 30 dagar (refresh vid aktivitet).

### 9.2 Dataintegritet
- Ingen kalenderhändelse-rådata lagras. Enbart deriverad GO/NO-GO.
- Menscykeldata lagras i PostgreSQL med standard encryption at rest.
- Reason-codes (varför en kväll är NO-GO) exponeras aldrig till den andra parten.
- GDPR: fullständig radering av all användardata vid request (kaskad-delete).

### 9.3 Tokens
- Alla tokens (invite, proposal-response, webcal) genereras med `crypto.randomBytes(32)`, hex-encodade.
- Proposal-response-tokens är engångs (first-write-wins).

### 9.4 HTTPS
- All trafik över HTTPS (i homelab: reverse proxy med Let's Encrypt, t.ex. Caddy eller Traefik).

---

## 10. Infrastruktur och Docker Compose (MVP-setup)

### Homelab-topologi

| Komponent | Host | Adress |
|---|---|---|
| App (Next.js) | Docker-host | `192.168.10.32:3200` |
| PostgreSQL | Dedikerad VM | `192.168.10.31:5432` |
| Redis | Docker-host (container) | intern: `redis:6379` |

Port 3200 valdes för att undvika konflikter med befintliga tjänster (n8n: 5678, uptime-kuma: 3001).

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "3200:3200"
    environment:
      - PORT=3200
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}
      - BASE_URL=${BASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    restart: unless-stopped

volumes:
  redisdata:
```

Ingen `db`-service — appen ansluter direkt till PostgreSQL på `192.168.10.31`. Se `README.md` för fullständiga deploy-instruktioner.

---

## 11. Öppna beslut (för utvecklare att flagga)

1. **Spontana förslag (samma kväll):** Produktbriefen säger "en vecka i förväg". MVP genererar förslag veckovis. Om bara en kväll per vecka matchar kan det vara värt att generera förslaget ändå, även om det bara är 2-3 dagar bort. Implementera med konfigurerbar `min_days_ahead`-parameter (default: 3).

2. **Rate-limiting mot Google Calendar API:** Med 10 par (20 användare) och polling var 30:e minut = 960 anrop/dag. Google Calendar API har 1M queries/dag-limit, så detta är inte ett problem. Men bygg med backoff/retry från start.

3. **Vad händer om en part aldrig kopplar sin kalender?** Systemet kan inte generera Availability utan kalenderdata. Lösning: tillåt manuell availability (användaren markerar kvällar som lediga/upptagna i appen). Kalenderintegration blir då ett bekvämlighetsval, inte ett krav.
