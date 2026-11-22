# DAMAAN ERP — Permanent development, GitHub and production deployment instructions

Owner instruction of 2026-11-22. Applies to **every developer and every future development session**. The short operational
version is in `CLAUDE.md` / `AGENTS.md` ("Release workflow"); this is the owner's full text.

**Objective:** one reliable ERP system, properly synchronized GitHub branches, and a safe, repeatable production deployment.

## 1. Complete all assigned development work
- Review the existing implementation; reuse the existing database, APIs, routes and modules.
- Fix the requested issue completely, preserve all previously completed development.
- No duplicate modules or financial records. Complete the necessary automated tests.
- Verify the actual result before reporting completion. No unfinished code or partial features.

## 2. GitHub repository management (`dgtllccom-cell/ACCOUNTS.DGT.LLC`)
1. Work on an appropriate development branch. 2. Commit all completed changes. 3. Push the branch.
4. Create a PR into `main`. 5. Pass all mandatory CI checks. 6. Merge the approved PR into `main`.
7. Promote the verified release from `main` into `production` through a separate PR.
8. Confirm both branches contain the latest approved code. 9. Verify no unrelated developer changes were overwritten.

Never push directly to protected `main` or `production`. No force-push, reset, branch deletion or overwriting genuine work without authorization.

## 3. Prevent conflicts between developers
Before merging or deploying: check the latest branch heads; identify other developers' pending changes; review new commits added
during the session; resolve merge conflicts safely; run CI on the final combined code; ensure no other developer is deploying.
**Only one production deployment may run at a time. Never replace another developer's active deployment approval.**

## 4. Mandatory testing before merging a release
TypeScript and Next.js build · required GitHub CI · five-language i18n checks · Stock Journal guard · purchase and sales workflows ·
ledger and Roznamcha integrity · payments and currency calculations · loading, receiving and stock balances · responsive layouts and
A4 printing. Use testing environments and read-only production checks. Never create real financial transactions for testing.

## 5. Production deployment preparation (VPS `72.60.209.121`, live `https://api.dgt.llc`)
Before requesting deployment: all required checks passed · the intended commit is on `production` · the latest production SHA
verified · no deployment already running · the current gate and approval mechanism checked · no pending approval from another
developer can overwrite the release · no unreviewed database migrations. Use only the authorized gate; never bypass its checks.

## 6. One final VPS command block for the owner
After everything is merged and verified, give ONE complete block with the exact commands. It must: use the correct approved
production commit (never yesterday's SHA — verify against the latest `production`); check for an active deployment first; respect
the approval safeguards; use the official gate; preserve production data; create the database backup; stop safely if a
prerequisite fails. If the gate changed, verify its installation and usage first. No incomplete commands, no guessing a SHA.

## 7. Verify the live deployment
After the owner runs the block: deployment log · correct live commit · backup created and intact · Next.js build completed ·
PM2 health · live domain availability · critical ERP workflows · five languages and mobile. Provide real screenshots and a final
report. Never report success from GitHub merges or a successful build alone.

## 8. Protect production data
Always preserve: purchase and sales bills · customer and supplier accounts · ledger and Roznamcha entries · bank and cash payments ·
warehouse and stock records · shipping and loading records · company and branch data · users and permissions.
Never delete genuine production data or create duplicate financial postings.

## 9. Daily completion procedure
Complete the work → commit and push → merge the approved PRs → synchronize `main` and `production` through the approved workflow →
confirm final CI → give the latest production SHA → prepare the safe VPS instructions → clearly report anything genuinely blocked.
Do not claim a release is live until it is deployed and verified.

## 10. Final report from every developer
| Item | Value |
|---|---|
| Development status | Completed / Pending / Blocked |
| GitHub `main` SHA | verified commit |
| GitHub `production` SHA | verified commit |
| CI status | Passed / Failed / Running |
| Production deployment | Completed / Pending |
| Database backup | Verified / Not verified |
| Live ERP status | Verified / Not verified |
| Screenshots | Attached / Pending |
| Required owner action | exact action, only if genuinely necessary |

## Owner authorization
All developers are authorized to complete approved development, testing, PR preparation, merging and deployment preparation.
Do not repeatedly ask for the same authorization. Request only a specific mandatory security approval, a new financial posting
decision or the owner-only release authorization.

**Permanent rule:** Complete development → push to GitHub → merge into `main` → verify CI → promote to `production` → prepare one
safe VPS command block → deploy through the authorized gate → verify Live ERP → provide screenshots and final report.
