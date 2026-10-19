# Work-card register (owner order of 2026-10-18) — facts only, verified 2026-10-18 ~21:40 Dubai

Sources: session list, `git` branches/commits of this repository, the live server (read-only), my own work. "Not inspected" means I did not open that session's transcript — its owner must fill that row in. Nothing here is archived.

## 0. RESOLVED 2026-10-19 — Production was moved without the gate (found 2026-10-18)
**Status update (verified read-only 2026-10-19):** the Main Master released a reconciled commit through the gate — live `HEAD` = `906dd2c` (gate log: DEPLOYED 2026-10-19 09:40:38Z after fresh backups), `core.hooksPath` = `/usr/local/lib/dgt/githooks` (lock intact), stock-balance report files present, site HTTP 200, `origin/production` = `906dd2c`. The text below is the original finding, kept as the record. Remaining: per-agent SSH keys (owner decision).

| Fact | Evidence |
|---|---|
| Live checkout `/var/www/dgt-nextjs` is on `05283dc` (a `main` commit, 21:10 Dubai); the app was rebuilt from it at 21:14 and PM2 restarted at 21:15 | `git rev-parse`, `.next/BUILD_ID` mtime, PM2 uptime |
| The deploy gate log's last entry is `c596edf` (DEPLOYED 12:04 Dubai). `05283dc` was **not** approved or deployed through the gate | `/var/log/dgt-deploy.log` |
| `c596edf` (the `production` branch) is **not** an ancestor of the live commit: the live code is **missing** the Goods Movement / Stock Balance report (`app/api/erp/reports/stock-balance/*`, `lib/services/stock-balance-report-service.ts` are absent on the server) and the `20261236/20261237` migration files | file checks on the server |
| The pulls/resets that moved it came from the office/laptop IP `92.97.54.171` (the shared laptop key — every agent on this PC uses it) at 16:48, 20:02, 21:07, 21:12 Dubai | server `reflog` + `auth.log` |
| **Root cause of the lock bypass:** `package.json` → `"prepare": "node scripts/setup-git-hooks.mjs"` forced `core.hooksPath=.githooks` on every `npm install` / deploy build, silently removing the live ref lock | `.git/config` (rewritten 16:02 UTC), script source |
| **Done (config only, no app restart):** script fixed in the repo (`scripts/setup-git-hooks.mjs` no longer overwrites a protected path or runs on the server); the ref lock was re-asserted on the server and tested (branch create / reset refused, `HEAD` unchanged, site HTTP 200, PM2 online) | this session |
| **Not done (needs the owner):** the live app is NOT rolled back and NOT re-released. `main` lacks 16 commits that `production` has; `production` lacks 7 that `main` has. A merge `production → main` is **conflict-free** (`git merge-tree` → tree `b5b8c9e`). The reconciled commit must go through tests → fresh backup → `dgt-approve-deploy` → `dgt-deploy`. | `git rev-list`, `git merge-tree` |
| Remaining weakness | all agents share ONE root SSH key; a separate key per agent (or a deploy-only restricted key) is still the real fix — owner decision |

## 1. Cards
| Card (session) | Branch · last commit | Assigned task | Done | Remaining | DEV tests | Production | Blocker / next action |
|---|---|---|---|---|---|---|---|
| **MAIN MASTER** `local_abb57f1e…` (running) | `main` · `05283dc` | Coordinate all agents, release control | *not inspected* | *not inspected* | — | owns the release | Must decide the reconciled release (section 0) |
| **roles-security** `local_61c00f0a…` (idle) | `claude/festive-morse-84e7c6`; work on `feat/domain-separation-user-verification` · `3fa58b8` "per-user verification report (DEV, 29 users)" | Roles / Chaman workflow / users audit | per memory: Business/Shipping/Global separation, 2-stage Shipping approval, per-user verification (DEV) | *not inspected* | per-user report in commit `3fa58b8` | not deployed (memory: DEV only) | its owner to list remaining items |
| **mobile-apps-b-bs-finish** `local_ab87d0d7…` (idle) | `claude/elegant-hugle-ed1145` · `6d79c8c`; its design set is on `feat/stock-balance-report` · `f95a914` | Mobile design set (Figma-ready) + builds | 47-screens × 2 apps design set, 5 languages + RTL, tokens, components, 120/120 checks (docs/store/design) | Figma import; builds need devices/accounts. **NOTE: a mobile biometric/iOS-manifest commit was reverted on `production` (`c596edf`) — reason not inspected** | its own check script 120/120 | not deployed | **Overlaps with my concepts A/B/C — master must reconcile (below)** |
| **Mobile review pass / concepts** `local_cce573a1…` (this session) | `main` (commits `ef5aec3`, `04a41fc`, `40743d0`, `42d6f22`, design `docs/design/mobile-concepts`) | Store-review access, sweep fixes, design concepts, Production-safety | see section 2 | see section 2 | see section 2 | nothing deployed by me | Figma Connect click; owner picks A/B/C; approval for Production migrations |
| Branches **without a visible session**: `claude/vigilant-newton-ce1473` (`be908de` shipment-tracking enterprise redesign, DEV), `audit/dgt-connected-workflows-20261018` (`36bf86e`), `feat/stock-balance-report` (`f95a914`), `release/2026-10-18` = `production` (`c596edf`) | — | — | — | — | — | `production`/`release` = live release branch | Do **not** delete or archive; master to assign owners |

### Two mobile design efforts exist (decision needed)
* Mine: three concepts A Harbour Ledger / B Night Dock / C Manifest, 10 screens each, English + Urdu, converted to editable Figma layers by a plugin (`docs/design/mobile-concepts`, Desktop `DGT-Mobile-Design-Concepts`). These are the ones the owner has seen.
* `mobile-apps-b-bs-finish`: a different, larger set (47 screens × 2 apps, 5 languages, "3D-style tiles", Figma import plan) in `docs/store/design` on `feat/stock-balance-report`.
* The owner said not to replace the three concepts with unrelated designs; the owner has not seen the second set. **Master/owner to decide**: show both, or fold the 47-screen set in as the "full" build of the chosen concept.

## 2. My card in detail
**Done and verified (DEV only):** review pass for store reviewers (`e2e-review-pass` 32/32); reviewer account (`e2e-reviewer-account` 26/26); device approval 35/35; app channel 12/12; migration `20261233` applied to DEV only; sweep of 9,550 device/language/route cases run, real defects fixed (hydration error on 3 branch pages in ar/fa/ps, edit-history API payload, Transfer Center and Business Edit Invoice narrow-layout) and re-verified 250/250; reviewer-access design doc; three design concepts; Figma plugin; Production-safety lock fix (section 0).
**Remaining:** Figma connection (owner click) → import → owner review → corrections → approval; implement the chosen design in both apps; rebuild signed AAB/APKs (the existing ones predate the app-tag fixes — do not upload); regenerate store screenshots after approval; real-device tests (owner's Samsung/iPhone/iPad); iOS build needs a Mac + Apple account; store registrations (owner: D-U-N-S, accounts, OTP, payments); Production migrations `20261232`/`20261233` (needs verified backup + approval).
**Known open defects:** Edit History loads in ~5–20 s on DEV (query over 5,000 history rows); 20 older `tsc` errors in other agents' files; Edit-history, `cash-entry`/`location-master` identifier wrapping (cosmetic).
**Production status:** none of my work is on Production.

## 3. Schedule (my workstreams only; other cards to be filled in by their owners)
| Workstream | Target | Depends on |
|---|---|---|
| Figma connected | minutes after the owner's click | owner |
| Concepts imported into Figma + share links | same day as the connection | Figma access |
| Owner corrections applied | 1 working day after feedback | owner feedback |
| Full approved Figma design (both apps, 5 languages, light/dark, phone/tablet) | Thu 2026-10-22 18:00 if a concept is chosen by Mon 2026-10-19 12:00 | owner choice |
| Implementation in both apps | Tue 2026-10-27 | approved design |
| Signed builds + store-listing assets | Wed 2026-10-28 | implementation |
| Production release of the reconciled code + device/review-pass migrations | after master decision in section 0 and owner approval | owner + gate |
| Store submissions (Google → Samsung → Apple) | Play ≈ 28 Oct; live ≈ 1–5 Nov (Samsung ≈ 5–8 Nov, Apple ≈ 10–15 Nov) | owner registrations |
