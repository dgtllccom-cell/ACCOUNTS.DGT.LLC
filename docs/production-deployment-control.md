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

---
## Status update — 2026-10-10 (owner approved the security preparation; live changes verified first)

### Backup taken and verified before any change (on the VPS, mode 600, never downloaded because it contains `.env`)
| File | What | Check |
|---|---|---|
| `/root/backups/prod-before-security-20261010-133830.dump` | full `public` schema, custom format, 16.6 MB | `pg_restore --list` = 340 table-data entries; full SQL generated without error (340 COPY blocks, 9,770 rows seen in the first tables, exit 0); sha256 `c16ff25a…8295e` |
| `/root/backups/prod-server-config-20261010-133830.tar.gz` | `/etc/ssh`, `authorized_keys`, nginx, app tree without `node_modules/.next/.git` (incl. `.env`), pm2 dump, cron | gzip integrity OK, 5,531 files; sha256 `9d19f5d4…1b1d` |
| `/root/backups/authorized_keys.before-hardening` | copy of root's `authorized_keys` | — |
The older snapshot `B:\accounts.dgt.llc.code_project\prod-backups\prod-full-before-tracking-gt-20261009-192247.dump` still exists on the laptop.

### SSH keys that can log in as root — identified from 28 days of `auth.log` (13 Sep – 10 Oct)
| Key (fingerprint) | Comment | Logins in 28 days | Attribution |
|---|---|---|---|
| `SHA256:Y1NYd1Fl…ke4` (RSA 4096, listed twice) | `dgtll@LAPTOP-MAA3ASID` | **23,136** from 11 networks (office `92.97.54.171` + UAE mobile networks) — including the three deployments of 10 Oct 05:23 / 05:56 / 06:20 | the owner's laptop. **Every program on that laptop shares this key** (Claude, Codex, other IDE agents, deploy scripts) — which is why key clean-up alone cannot stop unapproved deploys |
| `SHA256:fGk8zllJ…hfV0` (ED25519) | `claude-deploy-20260803` | **0** | created 3 Aug by an AI session; its private key is **not** on this laptop |
| `SHA256:DxrH6gof…ldg` (ED25519) | `codex-vps-cleanup-temporary` | **0** | created by a Codex session as a temporary key; private key **not** on this laptop |
No other user can log in (`ubuntu` has no keys). The provider's web console logins (`169.254.0.1`) are a separate path. **Accepted password logins in 28 days: 0** — the 1,802+ password attempts seen came from outside addresses and were all refused.
**No key was removed.** Because I cannot prove who holds the two unused keys, removal is your decision (see "Needs you" below).

### Applied on the live server today (reversible; the app, database and PM2 were not touched; restarts still 1)
1. **Deploy gate installed** (`dgt-deploy`, `dgt-approve-deploy`, `/etc/dgt-deploy`). Verified on the live checkout: with no approval → REFUSED; with an approval for the current commit → `--dry-run` passes all checks and changes nothing. The approval file was deleted again afterwards. Audit log: `/var/log/dgt-deploy.log`.
2. **SSH hardening** (`/etc/ssh/sshd_config.d/00-dgt-hardening.conf`): password login off, keyboard-interactive off, root login by key only. Done with a safety net: a second key login stayed open, an auto-revert timer was armed, a new key login was tested, a password login was shown to be refused, and the **rollback was tested for real** (revert → password login allowed again, key login fine → re-applied). The site stayed up (login page 200 throughout).

### Rollback procedures (tested where marked)
| Change | How to undo |
|---|---|
| SSH hardening (tested) | `dgt-ssh-harden revert` (or delete `/etc/ssh/sshd_config.d/00-dgt-hardening.conf` and `systemctl reload ssh`). If you are ever locked out: provider web console → same command |
| `authorized_keys` | `cp /root/backups/authorized_keys.before-hardening /root/.ssh/authorized_keys` |
| Deploy gate | `rm /usr/local/sbin/dgt-deploy /usr/local/sbin/dgt-approve-deploy; rm -r /usr/local/lib/dgt /etc/dgt-deploy` — the old deploy paths are unaffected by the gate until they are closed |
| App version after a future gated deploy (sandbox-tested) | `dgt-deploy --rollback` (previous build is kept in `.next.rollback`) |
| Branch switch | `scripts/production/switch-vps-to-production-branch.sh --revert` |
| Database | restore from the dump above only on your instruction: `pg_restore --clean --if-exists -d "$DATABASE_URL" <dump>` |

### Prepared, NOT done (needs your separate final approval)
* **Switch the live checkout from `main` to `production`**: `scripts/production/switch-vps-to-production-branch.sh` (dry-run run on the server: live HEAD = origin/production = origin/main = `5d60151`, it would only rename the tracked branch, no rebuild, no restart).
* Remove the two unused agent keys; GitHub protection of `production`; separate key for agents (see below).

### Needs you
1. **Approve the branch switch** (one command, reversible).
2. **Decide the two unused keys** (`claude-deploy-20260803`, `codex-vps-cleanup-temporary`): tell me whether you know their holders; if not, I recommend disabling them (kept in a backup file, restorable).
3. **GitHub:** protect branch `production` (steps in section "Steps", item 2).
4. **Stop unattended agents from deploying:** they all use the laptop key. Recommended: create a second key with a **passphrase** for you (kept off this laptop, e.g. another PC/phone), and give the laptop key a restricted role (status/logs/dry-run only). I did not change the laptop key because that could interrupt tools you use today.
