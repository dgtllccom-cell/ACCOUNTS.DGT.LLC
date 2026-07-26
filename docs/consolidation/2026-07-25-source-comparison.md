# Source Consolidation Audit - 2026-07-25

## Scope

The existing `ACCOUNTS.DGT.LLC` repository remains the authoritative and final
application. The following extracted snapshots were compared against it:

- `ACCOUNTS.DGT.LLC-main`
- `dht-nextjs-main`
- `vigilant-adventure-main`

The review covered application pages, components, API routes, libraries,
configuration, package manifests, environment references, and Supabase
migrations. No database migration or destructive database operation was
performed during this consolidation.

## Comparison Summary

| Snapshot | Files | Only in snapshot | Changed vs main | Identical | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| `ACCOUNTS.DGT.LLC-main` | 2,962 | 1,331 | 225 | 1,406 | Treat as the nearest historical snapshot; exclude archived conflicts and intentionally removed monitoring code |
| `dht-nextjs-main` | 1,124 | 56 | 210 | 858 | Older partial application; no unique production feature selected |
| `vigilant-adventure-main` | 1,051 | 35 | 207 | 809 | Older partial application; no unique production feature selected |

### `ACCOUNTS.DGT.LLC-main`

- 1,262 of its snapshot-only files are under `_review-conflicts`.
- Additional snapshot-only files are scratch or `_codex` artifacts.
- Its only coherent product feature absent from current main is the server
  monitoring module.
- Server monitoring was intentionally removed by commit `66eca3c` as part of
  the single-production-codebase cleanup. Restoring it would reverse an
  explicit consolidation decision, so it was not merged.
- Its package manifest and migration lineage match current main, but current
  main contains newer application changes.

### `dht-nextjs-main`

- This is an older partial version with no environment files and one fewer
  migration than current main.
- Snapshot-only files are predominantly scratch or development artifacts.
- Shared purchase, journal, dashboard, ledger, localization, and layout files
  are older or materially divergent. Wholesale copying would overwrite newer
  fixes and business logic.
- No unique production feature passed the safe-merge threshold.

### `vigilant-adventure-main`

- This is an older partial version with no Supabase migration history.
- It points to the same Supabase project as main but contains older application
  implementations and local artifacts.
- No unique production feature passed the safe-merge threshold.

## Environment and Database Alignment

- Current main Supabase project reference: `csesvyxxjivnkkozgopt`
- `ACCOUNTS.DGT.LLC-main`: same project reference
- `vigilant-adventure-main`: same project reference
- `dht-nextjs-main`: no environment configuration
- Current main has 89 migrations through
  `0078_centralized_multilingual_master_data.sql`.
- `ACCOUNTS.DGT.LLC-main` has the same migration lineage.
- `dht-nextjs-main` is missing migration `0078`.
- `vigilant-adventure-main` has no migration lineage.

Current main is therefore the only safe migration and environment authority.
Snapshot environment files, secrets, package manifests, and migrations must not
be copied into it.

## Merge Decisions

### Included

- A build-blocking duplicate declaration in the current purchase loading view
  was consolidated into the original contract amount calculation.
- Existing fallback support for `totalPurchase` and `totalAmount` was retained
  without replacing the current loading workflow.

### Excluded

- `_review-conflicts`, `_codex`, scratch, generated, and temporary files.
- Snapshot `.env*` files and credentials.
- Older package manifests and lockfiles.
- Older or incomplete migrations.
- The intentionally removed server monitoring module.
- Wholesale versions of high-risk purchase, payment, journal, roznamcha,
  ledger, dashboard, sidebar, and localization files.

## Backup

A repository safety point was created at:

`C:\tmp\ACCOUNTS-DGT-consolidation-20260725-213926`

It contains:

- Git repository bundle with all refs and history
- Working-tree patch
- Working-tree status
- Environment-file copies

A JSON database export was attempted but did not complete because the location
tables are very large. Its partial output is under the ignored `backups`
directory and is not considered a valid full restore point. No database
changes were made, so the live database remained untouched.

## Verification

- Production build: passed with Next.js 15.5.20.
- Static generation: 289 pages generated.
- TypeScript compilation during the production build: skipped by the existing
  project build configuration.
- Standalone `npm run typecheck`: still reports pre-existing generated iOS/Next
  validation errors and unrelated strict-type debt. No touched-file error
  remains in the purchase loading view.

- Test suite: 17 tests passed and 9 pre-existing tests failed. The failures are
  in stale authentication mocks, a validation fixture missing period dates, a
  database-inspection test that does not load `.env.local`, and an outdated
  goods-variation expectation. None originates from an imported snapshot
  because no snapshot application file was overlaid.

## Final Architecture Decision

The current `ACCOUNTS.DGT.LLC` main branch remains the single production
codebase. The extracted folders are historical references, not repositories to
overlay. Future recovery or feature work should cherry-pick reviewed,
file-level changes only and must preserve current environment, migration,
authentication, and business logic.

