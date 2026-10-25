# SSPACIA Sales Autopilot (ASMP)

Web ERP that runs SSPACIA's sales on Rahul Jain's ASMP sciences: Enquiry Capture → NBD Sales FMS (planned vs actual in working hours, red flags +2 h / +24 h / +72 h) → Proposals → CRM FMS after the win → SCOT calling of existing clients, plus MeCA, MCAP / 5-for-5, NBD-vs-CRR, Leaking Bucket, Wallet Share, G.P. Sheet, Gap Analysis, Plan the Year, Compounding 4X, Golden Client List, Lead Generation Plan, scripts and WhatsApp templates, DSR and Weekly Review.

## Stack
- Node.js ≥ 20, Express, MySQL (production on Hostinger) — SQLite via `node:sqlite` for local development.
- No build step; the front-end is plain HTML/CSS/JS in `public/`.

## Run locally
```
npm install
npm run dev          # SQLite file ./dev.sqlite, http://localhost:3000
```
First visit opens the setup wizard (creates the Executive account).

## Production (Hostinger Node.js website)
- Deploy the branch `sales-autopilot`; entry file `server.js`, build script `build` (no-op).
- Database: Hostinger "Setup website database" writes `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` and `DATABASE_URL` into the environment; the app reads them at start (`src/db.js`). No credentials live in the repository.
- Tables are created / migrated on boot (`src/schema.js`); seed data (centres, products, rate card, stage definitions, scripts, templates, SCOT accounts from `data/scot_accounts.json`, MeCA meeting log from `data/meca_meetings.json`) is inserted only when missing (`src/seed.js`) — nothing the team edits is overwritten.

## Layout
- `src/entities.js` — every table, field, label and permission (drives the API, the forms and the lists).
- `src/fms.js` — planned-time engine and red flags; `src/workhours.js` — working-hours calendar.
- `src/hooks.js` — business rules (won → client + CRM FMS; lost → win-back; SCOT call → next call; proposal → FMS step; ICP score; quote pricing).
- `src/routes/analytics.js` — MeCA, MCAP, NBD-CRR, Leaking Bucket, G.P. Sheet, SCOT board, dashboard, weekly review, digest.
- `src/routes/ops.js` — FMS actions, SCOT call logging, settings, calculators, templates, website intake API, backup.
- `public/app.js` (core + generic CRUD UI), `public/pages.js` (operational pages), `public/pages2.js` (growth sciences, settings).

## Website lead intake
`POST /api/public/enquiry` with header `X-Api-Key: <key from Settings>` and JSON `{name, mobile, email, company, centre, seats, requirement, preferred_visit_date, source}` creates an enquiry and starts the FMS.
