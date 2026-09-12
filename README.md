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
npx prisma db seed

# 4. Run
npm run dev                   # http://localhost:3000/es
```

The seed creates a demo organisation with a fully populated project
(`EDI — Edificio Corporativo Alameda`) and four users, all with the password
`demo1234`:

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
| `NEXT_PUBLIC_APP_URL` | Public base URL |
| `CHROMIUM_EXECUTABLE_PATH` | Optional. Use a Chromium already on the host for PDF export instead of the one Playwright downloads |

---

## What is in phase 1

- **Organisations, projects and teams.** Multi-tenant organisations, projects
  with client and appointment-party data, disciplines, discipline teams, the
  ISO 19650 project roles and an editable RACI matrix.
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
  coverage per language.

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

## Testing

```bash
npm run test           # 66 unit tests: naming engine, diff, permissions, markdown, i18n parity
npm run test:e2e       # 17 end-to-end tests through a real browser and a real database
npm run typecheck
npm run verify:naming  # every stored convention still agrees with its own test cases
```

`npm run test:e2e` builds the app and starts it on port 3100 by default. Point
it at a running instance instead with `E2E_BASE_URL=http://127.0.0.1:3100`.

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
