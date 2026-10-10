# GitHub `production` protection + server branch switch — prepared, NOT applied

I cannot change GitHub (no `gh` CLI / no repository-admin rights here) and I will not switch the live server without your explicit approval.

## 1. GitHub ruleset (owner, ~5 minutes)
Repository → **Settings → Rules → Rulesets → New ruleset → Import a ruleset** → choose `docs/production-github-ruleset.json` (included next to this file). Or by hand:

| Setting | Value |
|---|---|
| Name / Enforcement | `production-release-lock` / **Active** |
| Target branches | `production` |
| Bypass list | **empty** (rules apply to admins too) |
| Restrict deletions | on |
| Block force pushes | on |
| Require a pull request before merging | on — required approvals **1**, dismiss stale approvals, **require approval of the most recent push** |
| Require linear history | on |
| Restrict updates (only the owner may push) | on, with only your account |

Then also: Settings → Collaborators/Teams → keep only people you trust; Deploy keys / GitHub Apps / Personal-access-token approvals → remove anything you do not recognise. Optional: protect `main` against force-push/deletion.

## 2. Server branch switch (needs your separate approval; one command, no rebuild, no restart)
Current live checkout: branch `main`, commit `8546f39`. **Before switching, decide the Daily-Payments question** in `production-state-comparison-20261010.md`: the switch would move the live checkout to `origin/production` = `5d60151`, i.e. the *older* code, so the live checkout would no longer match the running build. Therefore the correct order is:

1. Decide A/B/C (comparison doc).
2. Merge the approved commits into `production` via pull request (you approve on GitHub).
3. `dgt-approve-deploy <that commit>` then `dgt-deploy` (backup → build → atomic restart; migrations only with `--migrations`). The gate sets `DGT_DEPLOY_GATE=1`, so the ref lock allows exactly this move.
4. Only then `switch-vps-to-production-branch.sh` (it exports `DGT_DEPLOY_GATE=1`); revert with `--revert`.

Do **not** run the switch before step 3 — it would fall back to old code without a build.

## 3. Unused SSH keys (no change made)
`claude-deploy-20260803` and `codex-vps-cleanup-temporary`: 0 logins in 28 days; private keys are not on this laptop; created by AI sessions. I can show their fingerprints on request but cannot prove who holds them. **Recommendation:** disable both (move to a backup file, restorable) after you confirm no other computer of yours uses them. Waiting for your yes.
