# LeadHub CRM — Session Handoff

Paste this into a new session to continue work. It captures the product, stack, how to run, what's built, key files, gotchas, and open ideas.

## What it is
**LeadHub** — a CRM for an affiliate **lead broker/distributor**. The customer receives leads from **affiliates**, distributes/sells them to **offices** (external CRMs/brands) via API, syncs lead statuses back in real time, and tracks progress + affiliate payouts.

Three core entities (keep these straight):
- **Affiliate** = where a lead *came from* (traffic source; paid per successful lead via CPA).
- **Office** = where a lead is *sent to* (external CRM/brand; has an API connector).
- **Agent** = internal team member who *works* leads (not a login account).

Design is 1:1 with a provided mockup (dark/light). All UI in Russian, code/identifiers in English.

## Location & stack
- Project: `~/leadhub/leadhub-crm/` (sibling to a separate Python app `mytrendview-admin/` — ignore that).
- **Next.js 14 (App Router) + TypeScript (strict) + Tailwind** + **MongoDB/Mongoose** + **NextAuth (credentials)** + **lucide-react**.
- Design system is ported verbatim into `src/app/globals.css` (NOT Tailwind utilities) to guarantee mockup fidelity.
- **Encryption at rest (AES-256-GCM)** for PII (name/email/phone/raw) + all office API keys/webhook secrets; passwords bcrypt; JWT sessions.

## How to run (IMPORTANT quirks)
- This Mac has **no system Node/Mongo**. Node 20 is installed locally at `~/leadhub/.toolchain/node` — **prepend `~/leadhub/.toolchain/node/bin` to PATH** in every Bash call: `export PATH="/path/to/.toolchain/node/bin:$PATH"`.
- Dev DB uses **mongodb-memory-server** (in-memory, auto-seeds on empty). No MongoDB install needed for dev.
- **Start the app via the preview harness, not Bash**: `preview_start({name:"leadhub"})` (config in `.claude/launch.json`, port 3000; it runs `scripts/dev-launch.mjs` which `chdir`s into the project — needed because the harness launches from the workspace root, which otherwise breaks Tailwind globs + `.env.local`).
- **BUILD GOTCHA:** never run `npm run build` while `next dev` is running — both write `.next/` and the dev server then serves unstyled pages. Sequence: stop dev → `npm run build` → `rm -rf .next` → restart dev.
- Demo logins: `admin@leadhub.local` / `admin12345` (ADMIN), `ivan@leadhub.local` / `demo1234` (USER).
- Env: `.env.local` is gitignored (has generated secrets + `MVCRM_API_TOKEN`); `.env.example` documents everything. Secrets: `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `BLIND_INDEX_KEY` (each `openssl rand -base64 32`).

## What's built (all verified; `npm run build` passes)
- **Auth/RBAC:** NextAuth credentials, middleware-protected pages, roles **ADMIN** (creates users, manages keys/offices) / **USER** (creates teams/agents). Admin→users, users→teams both work.
- **Intake:** universal HMAC webhook `POST /api/intake/:sourceId` (valid→201, tampered→401), field mapping, phone/email normalization, dedup + idempotency, CSV import (mapping/preview/summary), Google Apps Script snippet. Sources screen at `/import`.
- **Injection:** CRM client (`lib/crm/client.ts`) REST_JSON / FORM_URLENCODED / XML + **dry-run sandbox**; send with retries; Delivery records; lead→SENT + externalId. Send modal (single + bulk).
- **Real-time status sync:** callback webhook `POST /api/status/:integrationId` (HMAC), status normalization via StatusMapping, **SSE** `/api/events/stream`, live-updating leads table, background demo poller (`lib/demoTicker.ts`, gated by `DEMO_TICKER`, only runs while an SSE client is connected).
- **Analytics (`/reports`):** calendar/preset period, office filter, KPIs, by-day chart, status distribution, office comparison, CSV export.
- **Real connector MVCRM ("MyView CRM"):** `https://mvcrm.online`, `POST /customers/integration?api_token=…` (query auth), JSON, `Accept: application/json`; external id = `customer_id`; HTTP-200 `{success:false}` treated as error. Created from env `MVCRM_API_TOKEN` (seed makes it `sandbox:false`). Token validated read-only; **no live POST sent** (user declined). Field map: firstName→first_name, lastName→last_name, email→email, phone→phone, geo→country, affiliateTag→source.
- **Full CRUD:** delete leads (bulk+row)/agents/offices/affiliates/users/teams; create+edit affiliates & agents; connector create/edit/delete via `ConnectorForm` (incl. editable field + **status mappings**); lead bulk status-change & assign-agent.
- **Operational:** topbar **Добавить лид** (manual create), global **search**, functional leads **filter bar** (status/tag/agent/geo/office/balance/date + search), CSV **export**, notifications bell dropdown, **routing rules** (`RoutingRule` + `lib/routing.ts` auto-route on intake; 2 seeded disabled).
- **Affiliate payouts:** `Affiliate.cpa` (payout per FTD) + `Payout` ledger. Affiliates screen shows Начислено (=FTD×CPA) / Выплачено / К выплате + per-row "Выплатить" modal with history. Dashboard "Топ аффилиатов" and lead card show earnings.
- **Custom lead fields:** `Lead.custom` (Mixed) + `LeadField` defs (managed in Settings) → shown on lead card, in Add-Lead form, and as CSV-import targets (`custom:<key>`). Seeded funnel/ad.
- **Comments:** `LeadNote` model + `/api/leads/[id]/notes`. Imported comment columns (map `comment`) become an "Импорт" note; lead detail has a comments thread + add-comment. Lead status **timeline is chronological** (oldest top → newest bottom, chat-style).
- **Agent load:** `Agent.capacity` → «нагрузка» = assigned/capacity (was relative-to-busiest). Create form has capacity field.
- **Distribution tracking (customer's key need):** `lib/officeStats.ts officeSummaryMap()` = per-office sent/inWork/deposits/churn(WRONG_INFO+NOT_INTERESTED+REJECTED)/conversion/deliveries/successPct. Office cards show отправлено/депозит/слив + «Отслеживать →». **Office detail page `/distribution/[officeId]`**: KPIs, status distribution, by-day chart, **full filter bar** (office-scoped, office dropdown hidden) + live LeadsTable of that office's leads. "Работать с этими лидами →" → `/leads?office=<id>`.
- **Bulk select-all-across-filter:** Gmail-style "Выбрать все N по фильтру" banner; bulk endpoints accept `{leadIds}` OR `{allMatching:true, filter:<querystring>}` via `lib/bulk.ts resolveLeadFilter` (send capped 500).
- **Searchable encryption:** email/phone via blind index (exact); **name via `Lead.nameTokensHash`** (blind-index of lowercased name word-tokens) → exact-word name search works; tag/geo/externalId regex.

## Data models (`src/models/`)
User, Team, Agent (capacity), Office, Integration (apiKeyEnc, callbackSecretEnc, field/status mappings, sandbox), Source, Affiliate (cpa), Lead (encrypted PII + emailHash/phoneHash/nameTokensHash, custom, comment, status, office, agent, sentAt, externalId), Delivery, StatusEvent, AuditLog, RoutingRule, Payout, LeadField, LeadNote.

## Key files / architecture
- `src/lib/`: `db.ts` (mongoose + in-memory + seed), `crypto.ts` (AES-GCM + blind index + HMAC), `auth.ts`/`rbac.ts`, `intake.ts`, `injection.ts`, `statusSync.ts`, `routing.ts`, `officeStats.ts`, `leadQuery.ts` (buildLeadFilter — status/tag/agent/office/geo/balance/date/q), `bulk.ts`, `events.ts`/`demoTicker.ts`, `seed.ts`, `enums.ts`, `nav.ts`, `format.ts`, `normalize.ts`, `csv.ts`, `leadView.ts`.
- `src/components/`: LeadsTable (SSE live + bulk + select-all + basePath), LeadsFilters (basePath/hideOffice), SendModal, ConnectorForm, RoutingRules, AffiliatesManager, LeadNotes, LeadFieldsManager, DistributionTabs, AddLeadModal, NotificationsBell, AreaChart, RowActions, Sidebar/Topbar/ThemeToggle.
- Pages under `src/app/(app)/`: dashboard, leads, leads/[id], agents, affiliates, distribution, distribution/[officeId], import, reports, teams, users, settings. Auth pages: `login`. APIs under `src/app/api/`.

## Gotchas / notes
- After a server restart the DB reseeds fresh → **office/lead ids change** (stale `/distribution/<id>` URLs 404; navigate fresh).
- Name search matches whole words only (encryption tradeoff); email/phone exact; tag/geo/externalId substring.
- Reusing a session cookie across reseed can leave audit "who" as "—" until re-login (JWT uid points at pre-reseed user).
- Settings dedup-window (30 дней) is informational text, not editable.

## Open ideas (not done)
- Per-FTD CPA snapshots (freeze commission at conversion vs recompute from current CPA).
- Affiliate earnings report by period in Отчёты; export per office.
- Editable custom fields on the lead card; filter leads by custom field.
- Partial-name search (decrypt-scan or n-gram) if needed.
- Packaging for deploy: Dockerfile + MongoDB Atlas (`MONGODB_URI`) instead of in-memory.
