# Production deployment control (Option B — dedicated `production` branch)

**Status: prepared and tested in a sandbox. NOT yet active on the live server.** Switching the live server needs the owner's separate approval (steps 3–5).

## Why
On 2026-10-10 the live server moved to a new version three times by itself (05:23, 05:56, 06:20 Dubai). The server has no webhook, cron job or timer; the VPS git log shows `reset --hard origin/main` each time within about a minute of a push to `main`. The cause is a deploy script (the repository contains ~25 of them) being run from some computer or agent that holds root SSH access, plus the fact that `main` doubles as the release branch. Three SSH keys can log in as root: this laptop, an older Claude key (`claude-deploy-20260803`) and a **temporary Codex key** (`codex-vps-cleanup-temporary`). SSH password login is also still enabled.

## The design
| Layer | Control | Stops |
|---|---|---|
| Release branch | The live server may only deploy commits that are on **`origin/production`**. `main` is for development and may be pushed freely. `production` already exists at the commit the live server runs now (`5d60151`). | a push to `main` from any agent / computer reaching the live site |
| GitHub | `production` is a **protected branch**: no direct pushes, no force-push, merge by pull request that **the owner approves**, rules apply to admins too. | any agent pushing to `production` |
| Server gate | `dgt-deploy` (installed on the VPS) deploys **only the one commit the owner approved with `dgt-approve-deploy`**: approval expires (default 4 h), is single-use, the commit must be on `origin/production`, a database backup must succeed first, and a commit that adds migrations is refused unless the owner approved it with `--migrations`. Everything is written to `/var/log/dgt-deploy.log`; `dgt-deploy --rollback` restores the previous build. | scripts or people who SSH in and run their own build; unreviewed migrations |
| Repository scripts | Every legacy deploy/push script now stops immediately (`DISABLED… DGT_ALLOW_LEGACY_DEPLOY=1`). `.githooks/pre-push` blocks pushes to `main` from this PC unless `DGT_PROD_PUSH_APPROVED=1`. | accidental use of old scripts |
| SSH | Only the owner's key may log in as root; password login off. | other agents / computers that still hold a key |

**Honest limit:** anyone who can log in as root on the VPS can still change it. The gate controls the normal path and leaves an audit trail; the SSH key clean-up (step 4) is what removes other agents' ability to bypass it.

## Tested
`bash scripts/production/test-gate.sh` — 20/20 PASS in a throw-away sandbox (temp git repos, fake build): no approval refused; commit only on `main` refused; approved production commit deploys once; replay refused; migration commit refused without `--migrations`; expired / malformed approval refused; backup failure stops before anything changes; concurrent deploy refused; rollback works. No server was touched by the test.

## Steps — each marked who must act
1. **Done (no effect on the live site):** branch `production` created at the live commit; gate scripts, installer, tests and this document committed; legacy scripts disabled; pre-push hook.
2. **OWNER, GitHub web (5 minutes):** Repository → Settings → Branches → *Add branch protection rule* for `production`: require a pull request before merging; require approvals = 1 (you); *Do not allow bypassing the above settings*; restrict who can push (only you); block force pushes and deletions. Optional: also protect `main` against force-push/deletion. Make sure only you (and people you trust) have Admin on the repository, and review Settings → Deploy keys / Collaborators / GitHub Apps for other agents' access.
3. **Needs your approval — installs on the live server:** run `scripts/production/install-gate-on-vps.sh` as root on the VPS. It copies the gate, creates `/etc/dgt-deploy`, and does not touch the app, the database or PM2. Check with `dgt-deploy --dry-run` (expected "REFUSED: no approval file").
4. **Needs your approval — SSH clean-up on the live server:** remove `codex-vps-cleanup-temporary` and (after you confirm nobody needs it) `claude-deploy-20260803` from `/root/.ssh/authorized_keys`; remove the duplicate laptop line; set `PasswordAuthentication no` in `/etc/ssh/sshd_config.d/50-cloud-init.conf` (it currently says `yes` and wins over the `no` in 60-cloudimg-settings.conf) and reload sshd — **keep one SSH session open while testing a second login so you cannot lock yourself out**.
5. **Needs your approval — switch the live server to `production`:** on the VPS `git fetch origin production && git checkout -B production origin/production` (same commit, no rebuild, no restart) so any stray `git pull` can only ever receive production commits.
6. **Day to day after activation:** develop on `main` / feature branches → open a pull request `main → production` → owner approves/merges on GitHub → owner runs `dgt-approve-deploy <commit>` (add `--migrations` only if the migration files were reviewed and applied) → `dgt-deploy`. Agents can prepare everything but cannot release.

## What stays untouched
The live site keeps running throughout; no business data, user, customer, shipping or accounting record is read or changed by any of these steps. Database migrations are never applied by the gate — they remain a separate, reviewed step.
