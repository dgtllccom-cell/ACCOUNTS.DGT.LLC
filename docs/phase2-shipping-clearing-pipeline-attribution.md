# Phase 2 Shipping/Clearing Pipeline — commit attribution

**Why this file exists.** The auto-deploy bot sweeps the whole working tree
into one commit every ~20 minutes under its own message (see the
`deploybot-autocommit` pattern used throughout this repo's history). Commit
`f7f948b067a68605ecca0096b1b1d06f12026c45` — message *"feat(erp): unified
document intake, 5-level directory hierarchy, purchase account routing and
clearing pipeline"* — bundled **two unrelated workstreams** together: the
Phase 2 Shipping/Clearing Pipeline (this document's subject) and a separate,
concurrent document-intake / directory-hierarchy / purchase-account-routing
change. The commit message names both but reads primarily as the document
work. This file is the authoritative, versioned record of exactly which
files in that commit are the Phase 2 pipeline, so the audit trail is not
ambiguous.

## Phase 2 Shipping/Clearing Pipeline — files in `f7f948b`

| File | +/- | What |
|---|---|---|
| `supabase/migrations/20261126_shipping_clearing_pipeline.sql` | +123 | Schema: `clearing_customer_order_legs.stage`/`transfer_center_id`, `clearing_customer_orders.current_stage`/`current_leg_id`, new `clearing_customer_order_goods_verifications` table |
| `lib/services/clearing-order-workflow-service.ts` | +401 | New file: truck-task assignment, goods verification, leg handoff, stage advance, Transfer Center sync hook |
| `app/api/erp/clearing-agent/customer-order/[id]/workflow/route.ts` | +75 | New: order+legs+verifications+transfers read model |
| `app/api/erp/clearing-agent/customer-order/[id]/legs/[legId]/assign-truck-task/route.ts` | +30 | New |
| `app/api/erp/clearing-agent/customer-order/[id]/legs/[legId]/goods-verification/route.ts` | +37 | New |
| `app/api/erp/clearing-agent/customer-order/[id]/legs/[legId]/handoff/route.ts` | +26 | New |
| `app/api/erp/clearing-agent/customer-order/[id]/legs/[legId]/stage/route.ts` | +21 | New |
| `features/clearing-agent/components/order-workflow-view.tsx` | +455 | New file: the Shipping/Clearing pipeline UI |
| `app/dashboard/clearing-agent/customer-order/[id]/workflow/page.tsx` | +20 | New route |
| `app/api/erp/transfer-center/[id]/route.ts` | +45/-8 | Modified (Phase 1 file): added the `syncLegFromTransferAction` post-action hook |
| `features/clearing-agent/components/customer-order-management-view.tsx` | +8/-2 | Modified (pre-existing 4700+-line file, NOT otherwise touched): the order-number cell now links to `.../workflow` |
| `lib/i18n/ui.ts` | +376 (shared) | Contains the Phase 2 `owf.*` keys ×5 languages among other additions in the same window |

Total Phase 2 footprint in this commit: **11 files, ~1,241 lines**, all
authored in this session and already reported (Issue → Root cause →
Correction → Retest, live DEV E2E, deployment SHAs) in this conversation
before this commit existed — the code was correct and verified locally before
DeployBot's sweep created this specific commit.

## NOT Phase 2 — the other workstream in the same commit

| File | +/- | Workstream |
|---|---|---|
| `features/documents/components/document-manager.tsx` | +361/-* | Concurrent session's document-intake work |
| `features/document-intelligence/components/document-intake-center.tsx` | +146 | Concurrent session's document-intake work |
| `features/purchases/components/purchase-order-wizard.jsx` | +57 | Concurrent session's purchase-account-routing work |

These three files were observed mid-edit (syntax-broken) earlier in this
session and deliberately left untouched; by the time `f7f948b` was created
they were complete and the combined tree built clean (verified: local
`npm run build` and VPS `npm run build` both exited 0 at this commit).

## Why this wasn't split into two commits

Both workstreams were already unstaged in the same shared working tree when
the auto-deploy bot ran; it commits the whole tree on its own schedule,
independent of either session. Splitting them after the fact would mean
rewriting a commit that is already on `origin/main` and already deployed to
production — a force-push on the shared branch, which risks the concurrent
session's history and the live deployment for a cosmetic history fix. This
file is the safer, permanent alternative: an unambiguous, versioned record
that resolves attribution without touching shared git history.
