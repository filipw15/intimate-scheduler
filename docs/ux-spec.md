# Intimate Scheduler — Design & UX Spec (MVP)

> Målgrupp: Utvecklare som ska implementera frontend, UI och användarupplevelse.
> Fas: MVP
> Senast uppdaterad: Mars 2026

---

## 1. Designprinciper

### 1.1 Övergripande känsla

Appen ska kännas som en **neutral, väldesignad verktygsapp**. Tänk "kalenderapp" eller "familjeplanerare", inte "dejtingapp". Om någon ser den snabbt på en skärm ska den inte väcka frågor.

- **Pastell-palett** med dämpad ton. Ingen röd, rosa eller annan färg som signalerar romantik.
- **Ren typografi.** Inget lekfullt/handskrivet typsnitt.
- **Minimal UI.** Mycket whitespace, få element per vy.
- **Ingen illustrativ konst** som antyder intimitet, par, eller romantik. Om ikoner behövs: abstrakta geometriska former, kalender-ikoner, check-marks.

### 1.2 Målgrupp

30-50 år, ganska techvana. De använder appar dagligen men har inte tålamod med onödig komplexitet. Onboarding måste vara snabb och tydlig.

### 1.3 Designreferenser (mood)

- Tonal inspiration: Things (uppgiftshanterare), Linear (projektverktyg), eller Notion (clean, neutral)
- INTE: Flo (menscykelapp, för explicit), Clue (bra men färgstarkt), Tinder (absolut inte)

---

## 2. Färgpalett

| Roll | Färg | Hex | Användning |
|---|---|---|---|
| Primary | Dämpad salviagrön | `#8BA89A` | Knappar, aktiva element, bekräftelser |
| Primary dark | Mörkare salvia | `#6B8A7A` | Hover states |
| Secondary | Varm grå-beige | `#C4B9A8` | Sekundära element, bakgrundsaccenter |
| Background | Varm off-white | `#F7F5F2` | Sidans bakgrund |
| Surface | Vit | `#FFFFFF` | Kort, modaler, inputfält |
| Text primary | Mjuk svart | `#2D2D2D` | Rubriker, brödtext |
| Text secondary | Grå | `#7A7A7A` | Hjälptext, labels |
| Accent (sparsamt) | Dämpad lavendel | `#A8A0C4` | Notiser, badges |
| Error | Mjuk terrakotta | `#C4756A` | Felmeddelanden |
| Success | Primary (salvia) | `#8BA89A` | Bekräftelser (återanvänd primary) |

**Inga starka, mättade färger.** Allt ska kännas som urvattnad akvarell.

---

## 3. Typografi

| Element | Font | Storlek | Vikt |
|---|---|---|---|
| H1 | Inter (eller system-ui) | 28px | 600 |
| H2 | Inter | 22px | 600 |
| H3 | Inter | 18px | 500 |
| Body | Inter | 16px | 400 |
| Small/label | Inter | 14px | 400 |
| Caption | Inter | 12px | 400 |

Använd systemfont-stacken som fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

---

## 4. Vyer och flöden

### 4.1 Övergripande appstruktur

MVP har fem huvudvyer. Appen är i princip notis-driven (man gör det mesta via e-post), men behöver en inloggad vy för inställningar och onboarding.

```
1. Landing/Login
2. Onboarding (stegvis)
3. Dashboard (minimal)
4. Inställningar
5. Consent-svar (öppen sida, kräver ej inloggning)
```

### 4.2 Landing / Login

**Syftet:** Första kontaktytan. Ska vara diskret och professionell.

**Innehåll:**
- Logotyp (textbaserad, ingen ikon-logga i MVP)
- Kort tagline: "Hitta tid för det som är viktigt." (neutral, ingen referens till intimitet)
- E-postfält + "Skicka inloggningslänk"-knapp
- Länk: "Fått en inbjudan? Klicka här."

**Design:**
- Centrerat på sidan, mycket luft runt.
- Ingen hero-bild, inga illustrationer.
- Bakgrund: `#F7F5F2`, kort i `#FFFFFF` med subtil skugga.

### 4.3 Onboarding

Stegvist flöde med progress-indikator (steg 1 av 5, etc.). Varje steg är en enskild fråga eller ett litet kluster av relaterade frågor.

**Steg 1: Välkommen**
- "Välkommen, [namn]. Låt oss ställa in några saker."
- Kort förklaring av hur appen fungerar (2-3 meningar, max).

**Steg 2: Bjud in din partner**
- "Ange din partners e-postadress."
- E-postfält + "Skicka inbjudan"-knapp.
- Notera: "Inbjudan är neutralt formulerad. Ingen information om appens syfte delas."
- Möjlighet att hoppa över om man redan har en inbjudan.

**Steg 3: Tider**
- "När brukar barnen somna?"
  - Två tidväljare: Vardagar / Helger
- "När är din senaste tid på kvällen?"
  - Två tidväljare: Vardagar / Helger
- Tid-input: rullgardinsmeny med 15-minuters intervall (19:00, 19:15, 19:30, ...).

**Steg 4: Blockerare och regler**
- "Finns det kvällar som aldrig fungerar?"
  - Återkommande blockerare: veckodag + tidsspan + valfri etikett.
  - "Lägg till blockerare"-knapp (expanderbar lista).
- "Andra regler?"
  - Checkboxar: "Aldrig på söndagar", "Inte på vardagar", "Inte efter midnatt"
  - Utbyggbart med fler regler senare.

**Steg 5: Personalisering**
- "Välj tonalitet för notiser"
  - Tre alternativ med exempeltext:
    - **Lekfull:** "Psst! Onsdag kväll ser lovande ut 💛"
    - **Diskret:** "Påminnelse: onsdag kväll. Svara här."
    - **Rak:** "Förslag: onsdag kväll. Ja eller nej?"
- "Välj ett kodord för kalenderevents"
  - Textfält med placeholder: "T.ex. Yoga, Bokklubb, PT-session"
  - Hjälptext: "Det här syns som titel i din kalender."

**Steg 6: Menscykeldata (valfritt)**
- Visa bara om relevant (låt användaren välja om det är tillämpligt).
- "Vill du lägga till menscykeldata? Det hjälper oss att ta hänsyn till dina preferenser."
- Om ja:
  - "När började din senaste mens?" (datumväljare)
  - "Hur lång är din cykel normalt?" (rullgardinsmeny: 21-35 dagar, default 28)
  - "Hur många dagar brukar mensen vara?" (rullgardinsmeny: 2-8 dagar, default 5)
  - "Vilka dagar i cykeln vill du inte få förslag?" 
    - Visuell cykelkarta (se sektion 5.1 nedan) där man markerar dagar.
    - Defaultmarkering: dag 1 till periodens längd.

**Steg 7: Kalenderanslutning**
- "Koppla din kalender för automatisk schemaläggning"
- Två alternativ:
  - "Google Calendar" (OAuth-knapp)
  - "Annan kalender (iCal/ICS)" (textfält för URL + hjälptext om hur man hittar sin ICS-URL)
- Hjälptext: "Vi läser bara din kalender, aldrig skriver till den. Inga eventdetaljer sparas."

**Steg 8: Klar!**
- "Allt är inställt. Du får ditt första förslag inom kort."
- "Prenumerera på din kalender" (webcal-länk med instruktioner för iOS/Android/dator).
- CTA: "Gå till inställningar" eller "Stäng"

**UX-regler för onboarding:**
- En fråga/kluster per sida. Aldrig scrollning.
- "Tillbaka"-knapp på varje steg.
- Progressindikator visar steg, men inte "steg 3 av 8" (det avskräcker). Använd en enkel linje/dot-indikator.
- Steg 6 (cykeldata) ska kunna hoppas över helt utan att det känns som att man missar något.

### 4.4 Dashboard

Minimal. Appen är notis-driven, så dashboarden behöver inte göra mycket.

**Innehåll:**
- Status-kort: "Nästa förslag skickas [dag]" eller "Du har ett aktivt förslag" eller "Inga aktiva förslag just nu."
- Om aktivt förslag: visa datum + tid + "Väntar på svar" / "Du har svarat, väntar på din partner" / "Matchat! Kolla din kalender."
- Webcal-prenumerationslänk (för den som missat den i onboarding).
- Länk till inställningar.

**Design:**
- Ett enda kort i mitten av skärmen.
- Inget feed-tänk, inga listor, ingen historik.
- Känsla: "allt är under kontroll, inget att göra här just nu."

### 4.5 Inställningar

Alla inställningar samlade på en sida med expanderbara sektioner.

**Sektioner:**
1. **Profil:** Namn, e-post (read-only), tonalitet, kodord.
2. **Tider:** Barnens sovtid (vardag/helg), kvällens slut (vardag/helg).
3. **Blockerare:** Återkommande blockerare (lista med redigera/ta bort). Generella regler (checkboxar).
4. **Menscykeldata:** Cykelinfo + visuell cykelkarta. Knapp: "Uppdatera senaste mens". Toggle för att slå av helt.
5. **Kalender:** Anslutningsstatus, möjlighet att koppla bort/koppla om. Synktidpunkt.
6. **Par:** Partnernamn, status. "Bryt koppling"-knapp (med bekräftelsedialog).
7. **Konto:** "Radera mitt konto och all data" (med bekräftelsedialog + tydlig varning).

**Design:**
- Accordion-layout (expandera/kollapsa sektioner).
- Spara-knapp per sektion, inte en global "Spara allt".
- Destruktiva handlingar (bryt koppling, radera konto) i röd terrakotta med bekräftelsesteg.

### 4.6 Consent-svar (e-postlänk)

Den sida som visas efter att man klickat Ja/Nej i e-posten.

**Scenario A: Svar registrerat**
- "Tack! Ditt svar är registrerat."
- Om man svarade ja: "Om det blir en match meddelar vi dig."
- Om man svarade nej: "Inga problem. Vi provar igen nästa vecka."
- Ingen information om partnerns svar.
- Länk: "Öppna appen" (tillbaka till dashboard).

**Scenario B: Redan besvarat**
- "Du har redan svarat på det här förslaget."

**Scenario C: Förslaget har löpt ut**
- "Det här förslaget har tyvärr gått ut."

**Design:** Enkel, centrerad sida. Samma visuella stil som resten av appen. Inga ytterligare CTA:er eller fluff.

---

## 5. Komponenter och patterns

### 5.1 Visuell cykelkarta

En horisontell rad med numrerade dagar (1-28/35) som representerar menscykeln. Användaren trycker/klickar på dagar för att markera "lågt intresse"-perioden.

```
[ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ][ 9 ]...[ 28 ]
 ███  ███  ███  ███  ███  ███  ███  ○○○  ○○○       ○○○
```

- Markerade dagar (lågt intresse): fylld i sekundär färg (`#C4B9A8`).
- Omarkerade dagar: transparent med tunn kant.
- Mensperioden (dag 1 till period_length) förmarkerad som default.
- Drag-to-select för snabb markering av intervall.
- Mobilanpassning: tillräckligt stora touch-targets (minst 44x44px per dag).

### 5.2 Tidväljare

Rullgardinsmeny (select) med 15-minuters intervall, 18:00 till 01:00. Inte en fri tids-input (för många felkällor). Styled som övriga formulärfält (inte native browser-select om möjligt).

### 5.3 Knappar

| Typ | Stil | Användning |
|---|---|---|
| Primary | Fylld, `#8BA89A`, vit text, rundade hörn (8px) | Huvudaktion per vy |
| Secondary | Outline, `#8BA89A`-kant, transparent bakgrund | Sekundära handlingar |
| Destructive | Fylld, `#C4756A`, vit text | Radera, bryt koppling |
| Ghost | Ingen kant/bakgrund, textfärg primary | Navigering, "hoppa över" |

Alla knappar: minst 44px höjd, tydlig hover/focus-state.

### 5.4 Kort (Card)

Vit bakgrund, 1px border `#E8E4DF`, border-radius 12px, padding 24px. Subtil box-shadow: `0 1px 3px rgba(0,0,0,0.04)`.

### 5.5 Inputfält

Border: 1px solid `#D4D0CB`. Border-radius: 8px. Padding: 12px 16px. Focus state: border-color `#8BA89A`, ring 2px `#8BA89A33`.

---

## 6. Responsivitet

MVP är en webbapp, responsiv design krävs.

| Breakpoint | Layout |
|---|---|
| < 640px (mobil) | Enkolumns-layout, fullbreddskort, stor touch-target |
| 640-1024px (tablet) | Centrerad container (max 600px) |
| > 1024px (desktop) | Centrerad container (max 540px), mycket luft |

Appen har inte komplex layout. Det är i princip alltid en centrerad kolumn med kort/formulär. Responsivitet handlar mest om padding, fontstorlek och touch-targets.

---

## 7. E-postdesign

E-post måste matcha appens visuella stil.

### 7.1 Layout

- Max bredd: 540px.
- Bakgrund: `#F7F5F2`.
- Innehålls-block: vit bakgrund med samma border-radius som kort.
- Font: systemfonter (e-postklienter stöder inte custom fonts pålitligt).

### 7.2 CTA-knappar i e-post

Ja/Nej-knappar sida vid sida. Ja-knapp i primary-färg, Nej-knapp i secondary/outline. Minst 44px höjd, tillräcklig padding för mobila e-postklienter.

### 7.3 Avsändare

Från-namn: "Intimate Scheduler" eller kodordet (konfigurerbart i v2). Från-adress: `noreply@[domän]`. Reply-to: ingen (undvik att folk svarar på mejlet).

---

## 8. Notis-tonalitet (fullständig mallguide)

Varje e-post som skickas har tre varianter. Utvecklaren implementerar alla tre och systemet väljer baserat på mottagarens `tone_pref`.

### 8.1 Förslag (Proposal)

**Playful:**
- Ämne: "Psst, [dag] ser lovande ut"
- Kropp: "Hej [namn]! [Dag] kväll efter [sovtid] ser ut att kunna funka. Vad säger du? Bara du ser ditt svar."
- CTA: "Ja, det låter bra" / "Inte den här gången"

**Discreet:**
- Ämne: "[Kodord]: [dag]"
- Kropp: "[Dag] kväll, kl [sovtid]. Svara nedan."
- CTA: "Ja" / "Nej"

**Direct:**
- Ämne: "Förslag: [dag] kväll"
- Kropp: "[Dag] efter kl [sovtid]. Ja eller nej?"
- CTA: "Ja" / "Nej"

### 8.2 Bekräftelse (Match)

**Playful:**
- Ämne: "Det blev en match! 🎉"
- Kropp: "[Dag] kväll är bokad. Kolla din kalender för [kodord]."

**Discreet:**
- Ämne: "[Kodord] bekräftat"
- Kropp: "[Dag] kväll bekräftat. Se din kalender."

**Direct:**
- Ämne: "Bekräftat: [dag] kväll"
- Kropp: "[Dag] efter kl [sovtid]. Event tillagt i din prenumerationskalender."

### 8.3 Månadsvis underhåll

Samma tonalitet, men alla tre varianter är relativt neutrala:

**Playful:**
- "Dags för en snabb check-in! Stämmer dina inställningar fortfarande?"

**Discreet:**
- "Månatlig uppdatering. Verifiera dina inställningar."

**Direct:**
- "Dags att uppdatera inställningar. Klicka här."

---

## 9. Microinteractions och feedback

Appen har få interaktioner, men de som finns ska vara tydliga:

- **Spara preferenser:** Subtil animation (checkmark som fadar in) + kort text "Sparat" som försvinner efter 2s.
- **Kalenderanslutning:** Loading-spinner under OAuth-flödet, sedan grön checkmark + "Ansluten".
- **Bryt koppling / radera konto:** Bekräftelsedialog med "Skriv RADERA för att bekräfta"-pattern.
- **Onboarding-steg:** Smooth slide-transition mellan steg (transform + opacity), inte hård page-load.
- **Cykelkarta:** Visuell markering direkt vid tap/click, ingen delay.

---

## 10. Tillgänglighet (a11y)

- Alla interaktiva element: keyboard-navigerbara.
- Kontrast: alla text/bakgrundskombinationer ska klara WCAG AA (4.5:1 för normal text).
- Formulärfält: synliga labels (inte bara placeholders).
- Error states: röd border + felmeddelande under fältet (inte bara färg, text krävs).
- Focus-indikatorer: synliga och tydliga (inte borttagna för estetik).
- E-post-CTA: tillräcklig storlek för touch.

---

## 11. Saker appen INTE ska göra (UX-principer)

1. **Aldrig visa statistik eller historik.** "Ni har matchat 3 gånger den här månaden" skapar press. Ingen gamification.
2. **Aldrig avslöja den andra partens svar** (utom vid mutual ja). Inte ens att de "har svarat".
3. **Aldrig skicka push-notiser i MVP.** Enbart e-post. Push kommer i v2 med mobilapp.
4. **Aldrig använda ord som "sex", "intimitet", eller liknande** i UI eller e-post. Använd neutrala formuleringar: "kvalitetstid", "kvällen", "tillfälle".
5. **Aldrig ge känslan av en to-do-lista.** Inga listor med förslag, ingen inbox-metaphor. Ett förslag i taget, tar-det-eller-lämnar-det.
6. **Aldrig kräva daglig interaktion.** Appen ska vara passiv. Man ställer in, sen sköter den sig själv med en check-in per månad.
