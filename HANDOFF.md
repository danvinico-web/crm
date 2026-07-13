# LeadHub CRM — Session Handoff

Paste this into a new session to continue work. It captures the product, stack, how to run, RBAC, what's built, key files, gotchas, and open items.

## What it is
Affiliate lead-distribution CRM. Customer receives leads from **Affiliates** → distributes/sells to **Offices** (external CRMs via API) → syncs statuses back → tracks payouts. Domain entities: Affiliate (CPA source), Office (destination CRM), Agent (worker; **now also a login account**). UI Russian, code English. Next.js 14 App Router + TS (strict) + Tailwind + MongoDB/Mongoose + NextAuth (credentials/JWT) + lucide-react. AES-256-GCM PII encryption, bcrypt passwords, blind-index search.

## How to run (critical quirks)
- **Node/Mongo not system-wide.** Toolchain Node 20 at `~/leadhub/.toolchain/node`. Prefix any Bash: `export PATH="/path/to/.toolchain/node/bin:$PATH"`.
- **Dev DB = mongodb-memory-server** (auto-seeds ~28 leads, 6 agents). Start via preview harness: `preview_start({name:"leadhub"})` (port 3000). `.claude/launch.json` exists (runs toolchain-node + `scripts/dev-launch.mjs`); it's **machine-specific, kept out of git**.
- **Never `npm run build` while dev runs** (clobbers `.next` → unstyled). To clear stale cache: **stop dev → `rm -rf .next` → restart** (a deleted component can linger in the webpack cache).
- **Reseed on restart** → ids churn (stale `/leads/<id>` / `/distribution/<id>` → 404). Data can accumulate across quick preview restarts within one session; a full stop + `rm -rf .next` + restart returns to a clean 28-lead seed.
- Verify changes with `npx tsc --noEmit` (safe; doesn't touch `.next`). Secrets in gitignored `.env.local` (real `MVCRM_API_TOKEN` + encryption keys).

## Accounts
- `admin@leadhub.local` / `admin12345` — **ADMIN** ("Главный админ")
- `ivan@leadhub.local` / `demo1234` — **USER**
- **Agents** are created on the Пользователи tab (role Агент) with an email+password and log in with those.

## Roles / RBAC (implemented: ADMIN, USER, AGENT — *not* the 4-tier w/ OWNER yet)
`src/lib/roles.ts` = `["ADMIN","USER","AGENT"]`. Scoping via `src/lib/leadScope.ts` `leadScopeFilter(user)`:
- **ADMIN** → all leads, all screens.
- **USER** → only their agents' leads (agents they own); no Дистрибуция/Дашборд.
- **AGENT** → only leads assigned to them; sidebar shows **only «Лиды»**; blocked from Дашборд, Дистрибуция, Агенты, Аффилиаты, Команды, Настройки, Пользователи (redirect → /leads); can't send to offices (send API 403, buttons hidden).
- Scope applied to: leads page, lead detail (404 out-of-scope), `/api/leads` GET, export, bulk status/assign/delete, single delete, activity bell, sidebar count. Page guards = `requirePageRole()`; API guards = `requireRoles()` / `requireAdmin()`. Root + login redirects are role-aware.

## Feature work done recently
1. **Configurable agent load** — `AppSettings` singleton (`loadStatuses` + global `loadCapacity`), edited in Настройки; agents page load% = in-work-status leads ÷ capacity.
2. **6-digit lead ref (`#100000+`)** — `Counter` model + Lead pre-save hook (covers all intake paths); shown in tables + lead card; searchable in the main search box.
3. **Saved filter groups** — localStorage chips on the leads filter bar (per view/basePath).
4. **Multi-select filters** — status/tags/agents/offices/geos via `MultiSelect` popover; comma-encoded in URL → Mongo `$in`.
5. **Editable statuses** — `LeadStatusDef` DB collection (seeded from enum), `StatusManager` in Настройки (rename/recolor/reorder/hide/add/delete; built-ins lock-protected, custom deletable if unused). Static enum kept as fallback. Lead/StatusEvent `enum` relaxed to plain string.
6. **Excel import** — `xlsx@0.18.5` (client-side parse only; has advisories). Handles **headerless** files (auto-synth columns + content-based auto-map: email/phone/geo/name/balance). Header toggle + preview. Reuses `/api/import/csv`.
7. **Balance import** — non-numeric balances (`$1000-10,000`, `$10,000+`) stored raw in `Lead.balanceRaw`, shown in the Баланс column (display-only; does NOT affect FTD/deposit analytics or the «С депозитом» filter). New "Баланс/капитал" import target, auto-detected.
8. **Configurable table columns** — `ColumnSettings` popover on leads table (show/hide, reorder, rename headers, + custom fields as columns); localStorage per view.
9. **Agent management** — removed "Добавить агента" from Агенты; agents now created on Пользователи tab (role Агент → sets Роль/Команда/Куратор + password; capacity field removed). Each agent card has a **pencil → edit modal** (name/role/team/curator/online). `User↔Agent` linked. `AgentCreate.tsx` deleted.
10. **Fixes** — MultiSelect/StatusManager transparency bug (used undefined `--surface-1`; real token is `--surface`).

## Key files (reference)
- **Models:** `Counter`, `AppSettings`, `LeadStatusDef`. Edited: `Lead` (+refId, +balanceRaw, status→string), `StatusEvent` (status→string), `User` (+agent ref, role+AGENT), `Agent` (+user ref).
- **Libs:** `refId.ts`, `settings.ts`, `statuses.ts`, `leadScope.ts`, `spreadsheet.ts`; extended `csv.ts` (`parseCsvAoa`, `aoaToParsed`, `looksLikeHeader`, `guessMappingByContent`), `enums.ts` (`StatusDef`, `statusLabelOf/BadgeOf/statusMetaMap`), `rbac.ts` (`requirePageRole`, `requireRoles`), plus pre-existing `db, crypto, auth, intake, injection, statusSync, routing, officeStats, leadQuery, bulk, events/demoTicker, seed, leadView`.
- **Components:** `MultiSelect`, `SavedFilters`, `LoadSettings`, `StatusManager`, `ColumnSettings`, `AgentEdit`. Deleted `AgentCreate`.
- **API:** `/api/settings`, `/api/lead-statuses` (+`[key]`).

## Known gaps / CRM readiness
Strong demo/prototype (~90% of the lifecycle works), **not production-ready (~40%)**. Blockers: (a) **in-memory DB — no persistence** (needs Atlas/Docker deploy); (b) **outbound send + status polling are sandbox/demo-ticker**, not real workers; (c) no automated tests. Also: OWNER role (true 4-tier) not built — top account is role ADMIN; the connector status-mapping picker + dashboard/reports still use built-in status labels only (renamed custom statuses won't reflect there); import is sequential per-row.

## Suggested next steps
Build the OWNER tier (true 4-tier) · real persistence + deploy (Atlas/Docker) · real send/polling workers · wire custom statuses into connector mapping & analytics.

## Gotchas seen this session
- `xlsx@0.18.5` added (only npm build; known advisories) → parse client-side only.
- Saved filters + column config persist in **localStorage per view** (browser-only, not DB).
- Load capacity is **global** (Settings), not per-agent.
- The example import file `READY 2.xlsx` had a **non-breaking space** (`\xa0`) in its filename — plain `ls`/`cp` failed; resolve via glob/Python.
- Browser automation flakiness: SSE re-renders invalidate element refs → drive forms via injected JS and re-read after a short wait.
