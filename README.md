# Intimate Scheduler

## Infrastruktur

| Komponent | Host | Adress |
|---|---|---|
| App (Next.js) | Docker-host | 192.168.10.32:3200 |
| PostgreSQL | Dedikerad VM | 192.168.10.31:5432 |
| Redis | Docker-host (container) | intern: redis:6379 |

---

## Förutsättningar på Docker-hosten (192.168.10.32)

- Docker och Docker Compose installerat
- Port 3200 öppen i eventuell brandvägg
- Nätverksåtkomst till 192.168.10.31:5432

---

## Deploy — steg för steg

### 1. Förbered databasen (på 192.168.10.31)

Logga in på PostgreSQL-VM och skapa databas och användare:

```sql
CREATE DATABASE intimate;
CREATE USER intimate_user WITH PASSWORD 'byt-ut-detta';
GRANT ALL PRIVILEGES ON DATABASE intimate TO intimate_user;
-- PostgreSQL 15+: ge rättigheter på public schema
\c intimate
GRANT ALL ON SCHEMA public TO intimate_user;
```

Kontrollera att `pg_hba.conf` tillåter anslutningar från `192.168.10.0/24`:

```
# /etc/postgresql/16/main/pg_hba.conf
host    intimate    intimate_user    192.168.10.0/24    scram-sha-256
```

Ladda om PostgreSQL efter ändringar: `systemctl reload postgresql`

### 2. Klona projektet på Docker-hosten

```bash
ssh user@192.168.10.32
git clone <repo-url> /opt/intimate-scheduler
cd /opt/intimate-scheduler
```

### 3. Skapa .env

```bash
cp .env.example .env
nano .env
```

Fyll i minst:

```env
DATABASE_URL="postgresql://intimate_user:byt-ut-detta@192.168.10.31:5432/intimate"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://192.168.10.32:3200"
BASE_URL="http://192.168.10.32:3200"
ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 4. Kör initial databas-migration

Migrationerna körs direkt från din utvecklingsdator mot 192.168.10.31 (eller via en tillfällig container på hosten):

```bash
# Från din dev-dator med tillgång till 192.168.10.31:
DATABASE_URL="postgresql://intimate_user:byt-ut-detta@192.168.10.31:5432/intimate" \
  npx prisma migrate deploy
```

Eller på hosten med en engångs-container:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://intimate_user:byt-ut-detta@192.168.10.31:5432/intimate" \
  -v $(pwd)/prisma:/app/prisma \
  node:22-alpine sh -c "cd /app && npx prisma migrate deploy"
```

### 5. Bygg och starta

```bash
docker compose up -d --build
```

Verifiera att allt är igång:

```bash
docker compose ps
curl http://localhost:3200/api/health
# Förväntat: {"status":"ok","db":true}
```

### 6. Loggar

```bash
docker compose logs -f app
docker compose logs -f redis
```

---

## Uppdatera appen

```bash
git pull
docker compose up -d --build app
```

Om det finns nya migrationer:

```bash
DATABASE_URL="postgresql://intimate_user:byt-ut-detta@192.168.10.31:5432/intimate" \
  npx prisma migrate deploy
docker compose up -d --build app
```

---

## Reverse proxy (valfritt)

Om du vill exponera appen via Caddy eller Traefik med TLS:

**Caddy:**

```
intimate.yourdomain.com {
    reverse_proxy 192.168.10.32:3200
}
```

Uppdatera sedan `BASE_URL` och `NEXTAUTH_URL` i `.env` till `https://intimate.yourdomain.com` och kör `docker compose up -d app`.

---

## Miljövariabler — fullständig referens

| Variabel | Beskrivning | Exempel |
|---|---|---|
| `DATABASE_URL` | PostgreSQL-anslutning | `postgresql://user:pass@192.168.10.31:5432/intimate` |
| `REDIS_URL` | Redis-anslutning (intern) | `redis://redis:6379` |
| `NEXTAUTH_SECRET` | Slumpmässig hemlighet för sessioner | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Appens publika URL | `http://192.168.10.32:3200` |
| `BASE_URL` | Används i e-postlänkar | `http://192.168.10.32:3200` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | |
| `RESEND_API_KEY` | API-nyckel från resend.com | `re_...` |
| `RESEND_FROM_EMAIL` | Avsändar-adress för e-post | `noreply@yourdomain.com` |
| `ENCRYPTION_KEY` | AES-256 nyckel för OAuth-tokens (hex, 64 tecken) | `node -e "..."` |
