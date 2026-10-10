# Production comparison — last approved `5d60151` vs what is running now (`8546f39`)

Prepared 2026-10-10. **Nothing was rolled back or approved.** This is the information needed for your decision.

## Facts
* Last version you approved: `5d60151` (also the tip of branch `production`).
* Version running on the live server now: `8546f39` (build id `T6DPnHDpd9fnCPlVUzc8I`). It reached the server through the same unauthorised path as the 05:23 / 05:56 / 06:20 deployments — an agent/script that pushed to `main` and ran a server reset+build with the shared laptop key. The **database was not changed**: only migration `20261232` was added in the range and it was **never applied to Production**.
* 16 commits between the two (listed below), 167 files, of which only **31 files of source code** are executed by the live app (the rest are Android/iOS projects, docs, scripts, tests). The 15,853-line change shown for `purchase-order-wizard.jsx` is a line-ending (CRLF→LF) change only: ignoring it, the file differs by 9 added / 2 removed lines.
* Live site: HTTP 200, PM2 `dgt-nextjs` online, restart counter 3.

## What changed in the live code
| # | Change | Who/what | Effect on Production | Risk | My view |
|---|---|---|---|---|---|
| 1 | **Daily Payments** — `components/daily-payments/standardized-daily-payment-form.tsx` (+57/−2) and `lib/services/canonical-daily-payment-posting-service.ts` (+17/−2): auto-picks payment method from the selected ledger, new duplicate check "Bank account + TT reference" in posted `roznamcha_entries`, new A4 payment-voucher print | another agent (commit `3a5bc9e`), **not** part of my work, never approved by you | **touches accounting posting**. I verified the columns it queries exist in Production (`roznamcha_entries.bank_id`, `reference_no`, `status='posted'`), so it should not error — but it can now *reject* a payment as a duplicate and it changes default methods | **Medium** (accounting path, unreviewed, untested by me on Production data) | **Needs your review** before staying |
| 2 | **Device approval / activation system** (`lib/mobile/*`, `/api/erp/auth/device/*`, `/api/erp/mobile-devices/*`, `/auth/device`, Super-Admin page, session wrapper in `lib/auth/session.ts`, login route/page gate, middleware `/legal`) | my work (`830f2fc`, `ac08479`) | Only requests tagged `DGTllc-B/1`/`DGTllc-BS/1` (the store apps) are checked; normal browsers take the old path unchanged. The tables do **not** exist in Production, so a tagged request fails closed (access denied) — nobody can use the store apps on Production today, which is the intended safe state until you approve the migration | **Low** for normal users; code is dormant without the migration | Safe to keep, but it is "unfinished" on Production (no migration) — consistent with your instruction not to deploy it until approved |
| 3 | `/legal/privacy` public page + 100+ i18n keys (`lib/i18n/ui.ts` +405 lines, 5 languages) | my work | adds a public page and strings; guard green | Low | Keep |
| 4 | Login page: the "Preview / Sandbox Mode" drawer that listed real account ids (Super Admin, Country Admin …) is now hidden unless `NEXT_PUBLIC_ENABLE_SANDBOX_LOGIN=true` | my work | **improves security** — public login no longer shows account ids | Low | Keep (positive) |
| 5 | `app/api/erp/locations/route.ts` (7/7): optional query parameters no longer cause HTTP 422 when absent | my work (`514012d`) | bug fix | Low | Keep |
| 6 | Sidebar (+2 lines), `route-policy.ts` (+1), `table-headers-extra.ts` (+1), install-app banner hidden inside store apps (+3/−1), app-access page | my work | tiny | Low | Keep |
| 7 | Android/iOS projects, `capacitor.config.json`, `mobile/*`, `docs/*`, `scripts/*`, `.githooks`, 20 legacy deploy scripts changed to a one-line "DISABLED" stop, `supabase/migrations/20261232…` (file only) | my work | **none on the running web app** (not served); the legacy deploy scripts now refuse to run | None | Keep |

## Recommendation
1. **Do not auto-roll back.** A rollback would itself be a deployment (restart, build, brief outage) and would remove the sandbox-drawer fix; items 2–7 are low risk and mine.
2. **Do not auto-approve `8546f39` either.** The only item I cannot vouch for is **#1 (Daily Payments / accounting)** — it was written by another agent and has had no review by you. Decision options for you:
   * **A (recommended):** keep the running site as is (no downtime), and have the Daily-Payments change reviewed by you; if you reject it, I prepare one reviewed commit on `production` that reverts only those two files, and you approve its deployment through the gate. Until then the new duplicate-check can only block a duplicate — it cannot post anything new.
   * **B:** approve the current version as-is after you personally test one Daily Payment on the Testing database.
   * **C:** roll back to `5d60151` using the pre-change build (`.next.rollback` is **not** a copy of `5d60151` — a fresh build from the `production` branch would be needed), accepting a short maintenance window.
3. Whatever you choose, the live server will not change again without your approval: the **ref lock** (installed today, see below) refuses `git pull`/`reset`/`checkout` on the live checkout.
4. The live checkout is on commit `8546f39`, which is **not on `origin/production`**; the deploy gate therefore refuses to treat it as approved (verified). When you decide, the commit you approve must be merged into `production` first.

## Commits in the range (oldest → newest)
`5a5d14e` two store apps · `53c5afa` store guides · `25a35da` sweep test · `a5d2938` keystore naming · `830f2fc` device approval · `bd0cce8` docs · `3cd7255` pre-push gate · `fe36c68` install guide · `2134e64` production branch + gate · `514012d` locations fix · `ac08479` activation fix · `236a2b7` Capacitor configs · `f4755e6` prod-safety docs · **`3a5bc9e` Daily Payments (other agent)** · `783f866` START-HERE · `8546f39` UA tag fix.

## What was installed on the live server today (reversible, app/DB/PM2 not touched)
* Fresh verified backup first: `/root/backups/prod-before-reflock-20261010-171711.dump` (340 table-data entries, sha256 `182ea987…a021e`) + copy of `authorized_keys`, `sshd_config.d`, git hooks.
* **Ref lock** — `reference-transaction` hook in `/usr/local/lib/dgt/githooks`, `core.hooksPath` of the live checkout points there (my first attempt in `.git/hooks` was silently ignored because the live checkout sets `core.hooksPath=.githooks`; found by testing on the real server, fixed, sandbox test now 11/11 including a repository-supplied hook that tries to bypass it).
  Verified on the live server: creating a branch, `git reset --hard`, `git pull`, `git checkout -b` are all **refused**; the same command with the gate's `DGT_DEPLOY_GATE=1` is allowed; fetch is allowed; site 200, PM2 online, restart counter unchanged (3).
* **Rollback of the lock tested for real:** `bash /root/prodctl-new/install-ref-lock.sh remove` restored `core.hooksPath=.githooks` and git worked normally; re-installed afterwards.
* Gate refreshed (sets `DGT_DEPLOY_GATE=1` for its own reset). Dry-run with an approval for a commit that is not on `origin/production` → refused (correct); approval file deleted again.
* Honest limit: someone with root **and** knowledge of the lock can still remove it. It stops normal `git pull` / `reset` scripts (the path used by the unauthorised deployments) — which is what actually happened. The remaining control is key hygiene (see the SSH section of `production-deployment-control.md`).
