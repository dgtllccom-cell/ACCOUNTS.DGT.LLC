# ERP remaining-work gap matrix

_Snapshot 2026-09-09. Updated each time a tranche lands. Numbers are verifiable:
run the command in the last column._

## 0. Auto-i18n engine (permanent requirement) — ✅ DELIVERED

| Item | State | Evidence |
|---|---|---|
| `lib/i18n/auto-i18n.ts` — protected-token masking + acceptance gate + provenance over `translateErp()` | done | `generateFiveLanguages` / `generateForMany` |
| `scripts/i18n-autofill.mts` — closes `ui.ts` parity / silent-English gaps automatically | done | `npm run i18n:autofill` |
| Pre-commit hook auto-runs autofill on a staged `ui.ts` | done | `.githooks/pre-commit` |
| Guard points to the autofill on any gap | done | `scripts/i18n-ui-guard.mjs` |
| Docs | done | `docs/auto-i18n-engine.md` |
| Full-quality automatic coverage | **needs owner env** | set `AI_TRANSLATE_PROVIDER` + `AI_TRANSLATE_API_KEY` on VPS/CI |

Offline the engine auto-fills curated ERP vocabulary; with the AI env set it
covers arbitrary new English. It never fabricates a protected token and never
overrides approved terminology.

## 1. Design System adoption (#1) — shared layer complete, rollout uneven

Source: `docs/design-system.md` audit.

| Shared primitive | Feature views using it | Target |
|---|--:|---|
| `useErpScreen` | 64 | — (good) |
| `erp-date-picker` | 48 | — (good) |
| `openGenericErpReport` / `openUniversalPrintReport` | 24 / 17 | — (good) |
| `detail-drawer` | 11 | opportunistic |
| `dashboard-page-header` | 6 | **~25 hand-rolled headers to convert** |
| `unified-action-menu` | 6 | **~20 hand-rolled row menus** |
| `stat-card` / `report-kpi-cards` | 2 | **~20 hand-rolled KPI rows** |
| `erp-data-table` | 1 | **~25 hand-rolled tables** |
| `universal-report-shell` | 2 | 2 done on `feat/report-redesign` |

Remaining: convert module views (Purchase → Sales → Ledger/Roznamcha → Customers
→ Companies → Accounts → Goods → Logistics → HR → Reports) to
`dashboard-page-header` + `stat-card` + `erp-data-table` **without behaviour
change**, re-verifying 5 languages + RTL + mobile per screen.

## 2. Smart Operations sources (#2)

| Source | State |
|---|---|
| Smart Due (payments/dues) | ✅ in engine |
| Approvals (`approval_requests` pending) | ✅ added (`2d03119`) |
| User Tasks (`user_tasks` open) | ✅ added (`2d03119`) |
| Container arrivals / ETA | ❌ remaining |
| Loading / receiving pending | ❌ remaining |
| HR contract / KYC / document expiry | ❌ remaining |
| Customer outstanding balances | ❌ remaining |

No second engine — every source is another CTE in `smart-due/items` + `summary`.

## 3. Smart Summary rollout (#3)

`components/ui/smart-summary.tsx` shared layer done. Wired into: Smart Operations.
Remaining: ~15 dashboards/list pages (Purchase, Sales, Ledger, Customers,
Companies, Accounts, Goods, Logistics, HR, Settlement, Bill-Cost, Reports hub, …).

## 4. Health Center (#4) — ✅ preserved, read-only. Used to verify the above.

## 5. Multilingual rollout (#5)

| Sub-item | Metric | Command |
|---|--:|---|
| UI dictionary (`lib/i18n/ui.ts`) parity + silent-English | **0 gaps** / 14,522 keys × 5 | `npm run i18n:gap-matrix` |
| API routes still owing record-data localisation | **109** of 451 (41 exempt, 301 done/no-data) | `npm run i18n:contract` |
| `record_translations` reviewed backfill (common Customer / Company / City names) | pending — `status='needs_review'` rows exist | `scripts/backfill-record-translations-local.mts` |
| 5-language PDF matrix (every report renders EN/UR/AR/FA/PS, portrait + landscape, RTL) | partial — engine supports it (`print-improvements-sep-2026`); per-report matrix not captured | manual grid |

### The 109 routes (record-data localisation backlog)

Each needs, on GET: `const lang = await getRequestLanguage(searchParams.get("lang"))`
+ `localizeRecordFields(rows, "<table>", [<fields>], lang)` (guarded by
`wantsRawRecord(request)`); on POST/PATCH that creates a master row:
`translateMasterRecord(...)` instead of an identity `record_translations` insert.
Full list: `scripts/multilingual-contract-allowlist.json → unlocalizedRoutes`.

## Acceptance gates (unchanged, per tranche)

`npx tsc --noEmit` 0 · `npm run build` 0 · `i18n:guard` + `i18n:contract` +
`safety:guard` green · EN/UR/PS/FA/AR + RTL + mobile verified · RBAC preserved ·
no fake data · Print/PDF checked · accounting/stock posting untouched · Local =
GitHub = VPS one commit · Health Center scan clean.
