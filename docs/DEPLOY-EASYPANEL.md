# Deploying to Easypanel

Protocolo BIM ships a production `Dockerfile`. The container migrates its own
database and seeds the ISO 19650 catalogue on every start, so a deploy is a
single service plus a PostgreSQL service.

**Use the Dockerfile build method, not Nixpacks.** The default autodetected
build produces a Node image without Chromium, and the PDF export needs a real
browser.

---

## Before you start

| | |
| --- | --- |
| RAM | 2 GB minimum, 4 GB recommended. The Next.js build and `npm ci` are the peak; rendering a PDF adds roughly 300–500 MB while it runs. |
| Disk | About 4 GB free. The image is ~1.6 GB (Chromium accounts for most of it) and the build cache needs room on top. |
| Repository | Easypanel needs read access to `jseborga/Protocolo-BIM`. Connect GitHub under **Settings → GitHub** first if you have not already. |

---

## 1. Create the project

**Projects → Create project**, name it `protocolo-bim`.

## 2. Add the database

1. **Create service → Postgres**, name it `db`.
2. Choose PostgreSQL 16.
3. Create it, then open the service and copy the **internal connection URL**.
   It looks like:

   ```
   postgres://postgres:PASSWORD@protocolo-bim_db:5432/db
   ```

   That hostname only resolves inside the project's network, which is what you
   want: the database is never exposed publicly.

## 3. Add the application

1. **Create service → App**, name it `web`.
2. **Source** tab: choose GitHub, repository `jseborga/Protocolo-BIM`, branch
   `claude/bim-protocol-web-app-b06upw`.
3. **Build** tab: select **Dockerfile**, path `Dockerfile`.
4. **Environment** tab:

   ```env
   DATABASE_URL=postgresql://postgres:PASSWORD@protocolo-bim_db:5432/db?schema=public
   AUTH_SECRET=paste-a-32-byte-random-string
   NEXT_PUBLIC_APP_URL=https://protocolo.tu-dominio.com
   ```

   Generate the secret on your machine with `openssl rand -base64 32`. Sessions
   are signed with it, so changing it later signs everybody out.

   `postgres://` and `postgresql://` are both accepted; `?schema=public` is
   what Prisma expects.

5. **Domains** tab: add your domain, set the port to **3000**, and turn HTTPS
   on so Easypanel issues the certificate.
6. **Deploy**.

## 4. What the first deploy does

The build takes a few minutes (it installs dependencies, builds Next.js and
downloads Chromium). On start, the container logs:

```
→ Applying database migrations
→ Seeding catalogue
→ Starting Protocolo BIM
```

Migrations and the catalogue (12 disciplines and the 27-section ISO 19650
template) are applied automatically. The catalogue seeding upserts, so it is
safe on every restart.

**No demo data is created.** Open the site, go to `/es/register` and create the
first account: it becomes the owner of its organisation.

## 5. Updating

Push to the branch and press **Deploy** (or enable auto-deploy in the Source
tab). New migrations are applied at start, before the server accepts traffic,
so a deploy never lands on a schema the code does not expect.

---

## Optional settings

| Variable | Purpose |
| --- | --- |
| `SEED_DEMO=true` | Creates the sample project and four demo accounts with the password `demo1234`. Useful to evaluate the app; **remove it and delete the data before going live.** |
| `CHROMIUM_EXECUTABLE_PATH` | Defaults to `/usr/bin/chromium`, the browser inside the image. Only set it if you supply your own. |
| `PORT` | Defaults to 3000. Keep it aligned with the port in the Domains tab. |

---

## Troubleshooting

**The build runs out of memory.** Next.js needs roughly 2 GB to build. Either
resize the VPS, add swap, or build the image elsewhere and deploy it as a
Docker image instead of from source.

**`DATABASE_URL is not set` / `AUTH_SECRET is not set`.** The container refuses
to start without them rather than coming up half-configured. Check the
Environment tab and redeploy.

**`Can't reach database server`.** The host in `DATABASE_URL` must be the
internal name Easypanel shows on the Postgres service (`project_service`), not
`localhost`. Both services must be in the same project.

**The PDF export fails or times out.** It launches Chromium, which needs memory
and a few seconds on the first run. Check the service logs; if the container is
being killed, give it more RAM. The renderer already runs with
`--disable-dev-shm-usage`, so a small `/dev/shm` is not the problem.

**Migrations fail with a drift error.** The database already has tables that do
not match the migration history — usually from pointing at a database that was
used for something else. Point at an empty database, or reset it from the
Postgres service.

**Everything deployed but the site is unreachable.** Check that the Domains tab
maps the domain to port 3000 and the DNS `A` record points at the server.

---

## Any other Docker host

`docker-compose.prod.yml` brings up the app and PostgreSQL together:

```bash
export POSTGRES_PASSWORD=$(openssl rand -base64 24)
export AUTH_SECRET=$(openssl rand -base64 32)
export NEXT_PUBLIC_APP_URL=https://protocolo.tu-dominio.com
docker compose -f docker-compose.prod.yml up -d --build
```

Put a reverse proxy with TLS in front of port 3000. The same environment
variables apply.
