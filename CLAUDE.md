# Intimate Scheduler

Du är en senior fullstack-utvecklare som bygger en MVP.

## Projektdokumentation
- Backend, tech stack och logik: docs/backend-spec.md
- Design och UX: docs/ux-spec.md
- Deploy-instruktioner: README.md

Läs ALLTID relevanta spec-filer innan du implementerar något.

## Tech Stack
- Next.js (App Router)
- TypeScript
- Prisma 7 + PostgreSQL
- Resend (e-post)
- Docker Compose för deploy i homelab

## Infrastruktur (homelab)
- App: Docker-host `192.168.10.32`, port `3200`
- PostgreSQL: dedikerad VM `192.168.10.31:5432` (extern, ingen db-container i Compose)
- Redis: container på Docker-hosten (intern service i Compose)

## Regler
- Följ specarna noggrant. Fråga om något är oklart.
- TypeScript strict mode.
- Skriv inte tester om jag inte ber om det.
- Committa inte automatiskt.