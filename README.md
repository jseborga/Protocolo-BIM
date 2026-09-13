# Protocolo BIM

Web application for writing, versioning and **enforcing** BIM protocols under
ISO 19650, in Spanish, English and Portuguese.

Most BIM protocols live in a Word file: nobody can check whether the models
actually follow them, each discipline reads them differently, and by the third
month the document and the project have drifted apart. This application treats
the protocol as **data**: what the team agrees in the editor compiles into
rules that validate real names, and the sections describing the team, the
client, the software stack and the naming conventions are generated from live
project data instead of being retyped.

---

## Quick start

```bash
# 1. Database
docker compose up -d db

# 2. Configure
cp .env.example .env          # then edit DATABASE_URL and AUTH_SECRET

# 3. Install, migrate, seed
npm install
npx prisma migrate deploy
npm run db:seed               # disciplines + ISO 19650 template
npm run db:seed:demo          # …plus the sample project, for development

# 4. Run
npm run dev                   # http://localhost:3000/es
```

`db:seed` loads only the catalogue every installation needs: the 12 disciplines
and the 27-section ISO 19650 template. The demo data is separate and never
created by accident, so a production deployment cannot end up with a fake
project in it.

`db:seed:demo` adds a fully populated project (`EDI — Edificio Corporativo
Alameda`) and four users, all with the password `demo1234`:

| Email | Project role |
| --- | --- |
| `ana@demo.test` | Information manager |
| `bruno@demo.test` | BIM coordinator (structures) |
| `carla@demo.test` | BIM modeller (architecture) |
| `diego@demo.test` | Client |

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | 32+ character secret for session signing |
| `APP_URL` | Public base URL. Read at run time, so a hosting panel can set it without rebuilding; the OAuth redirect URI and invitation links are built from it |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Enables "Continue with Google" — see [`docs/AUTH-PROVIDERS.md`](docs/AUTH-PROVIDERS.md) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Optional. Enables "Continue with Microsoft"; `MICROSOFT_TENANT_ID` restricts it to one directory |
| `RESEND_API_KEY` or `SMTP_URL` | Optional. Delivers invitations by email. Without them the link is shown to pass on by hand |
| `CHROMIUM_EXECUTABLE_PATH` | Optional. Use a Chromium already on the host for PDF export instead of the one Playwright downloads |

---

## What is in phase 1

- **Accounts that span companies.** An account is personal and global, and
  project membership is the unit of access: an appointed party from another
  firm is invited to one project, joins it without entering the owning
  organisation, and sees nothing else of it. Sign-in is by password, Google or
  Microsoft, all reaching the same account.
- **Organisations, projects and teams.** Organisations own projects and hold
  billing and branding, with per-project visibility deciding whether the rest
  of the company can look in. Projects carry client and appointment-party data,
  disciplines, discipline teams, the ISO 19650 project roles and an editable
  RACI matrix.
- **The protocol.** 27 ISO 19650 sections in three languages, Markdown prose
  per language, section comments, the draft → review → approved → superseded
  workflow, and a line-level diff between versions.
- **The naming engine.** Conventions defined field by field, compiled into a
  regular expression, validated live with per-segment errors, plus an assisted
  name builder and test cases that gate activation.
- **Exports.** PDF and DOCX of the whole protocol, in the language you are
  reading, from a single shared document model.
- **Three languages, properly.** Not just the interface: the protocol content
  is stored per language, falls back to the project's base language when a
  section is not translated yet, and the dashboard reports translation
  coverage per language. Generated sections count towards neither gauge —
  there is no prose to write and nothing to translate.

Phase 2 and 3 surfaces (CDE folders, shared parameters, LOIN, TIDP/MIDP,
model audits) already exist in the data model and are marked in the interface;
their screens land with the Revit add-in.

---

## How it is put together

```
src/
├─ app/
│  ├─ [locale]/            # es | en | pt — every page lives under a locale
│  │  ├─ (auth)/           # sign in, sign up
│  │  └─ (app)/            # authenticated shell
│  │     ├─ projects/
│  │     └─ p/[projectId]/ # dashboard, protocol, team, naming, settings
│  └─ api/                 # exports and the machine-readable surface
├─ server/                 # all domain logic, framework-free and testable
│  ├─ naming/              # convention compiler + validator  ← the core
│  ├─ protocol/            # template, versioning, diff, completeness, generated sections
│  ├─ export/              # shared document model → PDF / DOCX
│  ├─ authz/               # ISO 19650 roles → abilities
│  ├─ auth/                # sessions
│  ├─ team/ · projects/    # server actions
├─ components/ · i18n/ · lib/
messages/{es,en,pt}.json   # 315 keys per language, parity enforced by a test
prisma/                    # schema, migration and seed
```

**The rule that shapes everything:** domain logic lives in `src/server/` as
pure functions. Pages and API routes only orchestrate. That is what lets the
naming compiler run unchanged in three places — the browser validator, the
export surface and, in phase 2, the Revit add-in and IFC auditor.

### The naming engine

A convention is a list of fields, not a hand-written regex:

```
FILE   PRJ-ORG-VOL-LVL-TYP-ROL-NUM
       ^   ^   ^   ^   ^   ^   ^
       │   │   │   │   │   │   └ numeric, exactly 4 digits
       │   │   │   │   │   └──── code table: A, S, M, E, P, C, L, Z
       │   │   │   │   └──────── code table: M3, M2, DR, SH, SP, RP, CM
       │   │   │   └──────────── code table: XX, ZZ, B1, 00, 01, 02
       │   │   └──────────────── code table: ZZ, 01, 02
       │   └──────────────────── code table, filled from the appointed parties
       └──────────────────────── regex [A-Z0-9]{2,10}
```

`compileConvention` derives the anchored pattern; `validateName` returns a
per-segment breakdown with machine-readable error codes, so the interface can
say *“field 3 (Volume): «99» is not in the table; allowed values: 01, 02, ZZ”*
in whichever language the reader uses, rather than “invalid name”.

Each convention carries **test cases**. Activation is refused when any of them
stops agreeing with the compiled rule — a convention can never silently drift
away from what the team agreed it should accept and reject.

### Generated sections

Five sections are rendered from live project data rather than typed: project
and client information, the delivery team, the RACI matrix, the software stack
and the active naming conventions. They produce Markdown, so the editor, the
PDF and the DOCX all receive them through the same path as authored prose.

---

## Deployment

The repository ships a production `Dockerfile`. The container applies its own
migrations and seeds the catalogue on start, so a deployment is one app service
plus a PostgreSQL service.

- **Easypanel**: step-by-step guide in [`docs/DEPLOY-EASYPANEL.md`](docs/DEPLOY-EASYPANEL.md).
  Use the Dockerfile build method — the autodetected Node build has no Chromium
  and the PDF export needs a real browser.
- **Sign-in providers**: [`docs/AUTH-PROVIDERS.md`](docs/AUTH-PROVIDERS.md) covers
  registering the application with Google and Microsoft, and how accounts are
  joined up between them.
- **Any Docker host**: `docker-compose.prod.yml` brings up the app and
  PostgreSQL together.

The image is around 1.6 GB, mostly Chromium. Building it needs roughly 2 GB of
RAM.

---

## Testing

```bash
npm run test           # 94 unit tests: naming engine, diff, permissions, markdown, i18n parity
npm run test:e2e       # 28 end-to-end tests through a real browser and a real database
npm run typecheck
npm run verify:naming  # every stored convention still agrees with its own test cases
npm run platform:role <email> ADMIN   # grant back-office access, from the server only
```

`npm run test:e2e` resets the demo organisation, re-seeds it and builds the app
on port 3100. The reset is what makes the suite repeatable: the tests approve a
protocol and branch a new version, so they need a known starting point. Point
the run at an already-running instance with
`E2E_BASE_URL=http://127.0.0.1:3100`, and reset the demo data on its own with
`npm run db:reset:demo`.

The i18n test fails the build if any language loses a key, gains one, or drifts
on ICU placeholders — which is the only practical way to keep three languages
honest.

---

## Security notes

- Session tokens are stored **hashed** (SHA-256); the raw token only ever lives
  in an HttpOnly cookie, so a database leak does not hand out usable sessions.
- Sign-in runs the password comparison even when the account does not exist, so
  a wrong email and a wrong password take the same time.
- Protocol prose is Markdown rendered through one hardened path: raw HTML is
  escaped rather than passed through, and link schemes are restricted to
  `http(s)`, `mailto`, `tel` and relative paths. A project member cannot inject
  markup into the document.
- A project the user cannot access and a project that does not exist both
  answer “not found”, so the application never confirms the existence of
  another organisation's work.
- A federated identity is attached to an existing account only when the provider
  vouches for the address, which keeps an unverified one from claiming somebody
  else's account.
- An invitation link is a bearer credential: only its hash is stored, it is
  checked against the signed-in account's address, and a lost one is replaced
  rather than recovered.

---

## Roadmap

**Phase 2 — executable rules and Revit**
CDE folder tree with WIP/Shared/Published/Archived states, downloadable as a ZIP
or a script · shared parameter library with GUIDs, exportable as a Revit shared
parameter file and mapped to IFC Psets · LOIN per element category and milestone
(EN 17412-1) · milestones, TIDP per appointed party and the aggregated MIDP ·
per-project API tokens · `/api/v1` ruleset and audit endpoints · **the Revit
add-in** (C# source, Revit 2022–2026) that downloads the ruleset, audits
families, types, sheets, views, worksets, levels and parameters, and publishes
its findings back to the project.

**Phase 3 — interoperability and analytics**
IFC audit with `web-ifc`, so models from ArchiCAD, Tekla or Allplan can be
checked without Revit · BCF 2.1/3.0 import and export, so findings reach
Navisworks, Solibri or BIMcollab without being recaptured · compliance
dashboard with history · trilingual BIM glossary · approval signatures ·
webhooks and a public API.

---

## Licence

Proprietary. All rights reserved.
