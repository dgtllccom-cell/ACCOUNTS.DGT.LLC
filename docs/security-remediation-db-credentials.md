# Security remediation — hard-coded database credentials in scripts

Status: **Codemod APPLIED (literals removed from the working tree). Live credential
NOT rotated — awaiting owner approval. Git history still contains the secret.**
Date: 2026-08-29

## 1. What is exposed

Two distinct PostgreSQL connection strings (each embeds the DB password) are
written as **string literals** in tracked repo files:

| Credential | Project ref | Where | Tracked files (working tree) |
|---|---|---|---|
| Production DB | `inmayhrxucimxqhgseqi` | maintenance / migration / inspection scripts | **89** (`scripts/*.mjs`, one `.ts`, 2 `.md`) |
| Dev DB | `csesvyxxjivnkkozgopt` (+ one typo variant) | root-level throwaway scripts | ~10 (`check-db.mjs`, `fix.mjs`, `inspect-po.mjs`, `reload-schema.mjs`, `LOCAL_PROD_SYNC_REPORT.md`, a few `scripts/*`) |

The credential values are **not reproduced here** by policy. To list the exact
files locally (no values printed):

```bash
git grep -l "postgres.inmayhrxucimxqhgseqi:" -- '*.mjs' '*.ts' '*.md'
git grep -l "postgres.csesvyx" -- '*.mjs' '*.ts' '*.md'
```

### Not affected (already correct)

- `scripts/db-apply-all-migrations.mjs` — the runner that auto-applies registered
  migrations to production. Reads `DATABASE_URL` from `.env` / `.env.local`. **No
  literal.** This is the only script on the production write path.
- `.env`, `.env.local`, `.env.production` — gitignored, never tracked.
- `lib/db/local-postgres.ts` (`withLocalPg`) — env-only.

## 2. Git history

`git grep` over history shows the production literal present since the VPS /
production-reconciliation work (the `scripts/*vps*`, `scripts/migrate-*`,
`scripts/reconcile-*` batches). Removing it from the working tree does **not**
remove it from history — anyone with repo access (or a fork/clone already taken)
still has it. **History rewrite (git filter-repo / BFG) OR credential rotation is
required for true remediation.** Rotation is the lower-risk option and is the
recommended path.

## 3. The fix (code)

1. `scripts/lib/prod-db-url.mjs` — added. `resolveDbUrl("prod"|"dev"|"local")`
   reads `PROD_DATABASE_URL` / `DEV_DATABASE_URL` / `DATABASE_URL` from
   `.env.local` or the process env; exits 1 with a clear message if unset.
2. `.env.example` — documents `PROD_DATABASE_URL` / `DEV_DATABASE_URL`.
3. Codemod `scripts/remediate-db-credentials.mjs` (added, **run manually**):
   - for each tracked `.mjs`/`.ts` script containing a literal, replace the
     literal with `resolveDbUrl("prod")` / `resolveDbUrl("dev")` and inject
     `import { resolveDbUrl } from "<rel>/lib/prod-db-url.mjs";`
   - `.md` files: replace the literal with `postgresql://USER:PASSWORD@HOST/...`.
   - prints a per-file diff summary; `--write` to apply.
4. After the codemod: `node --check` every touched script; run a
   representative read-only script (e.g. `scripts/list-tables.mjs`) against a
   throwaway env to confirm the resolver path works.

Most of the 89 files are historical one-offs (`inspect-*`, `debug-*`,
`migrate-*`, `reconcile-*`, `test-*`) that need a live DB and are not part of any
automated flow — they will not be individually functionally re-verified. The
codemod keeps them runnable for anyone who sets `PROD_DATABASE_URL`.

## 4. Rotation procedure (DO NOT RUN without owner approval)

Preconditions:
- Owner has reviewed this doc and approved rotation.
- `.env.local` on every machine/CI that runs `db-apply-all-migrations.mjs` (and
  the app's own deployment env) is ready to receive the new value.
- A rollback window is agreed.

Steps:
1. Supabase Dashboard → project `inmayhrxucimxqhgseqi` → Settings → Database →
   **Reset database password**. Copy the new pooler URL.
2. Immediately update the new value in:
   - production app env (`DATABASE_URL` / `SUPABASE_*` as applicable),
   - the migration-runner env (`.env.local` where `db-apply-all-migrations.mjs`
     runs),
   - `PROD_DATABASE_URL` in any operator `.env.local`.
3. Smoke test: app loads, one read query, `node scripts/db-apply-all-migrations.mjs`
   dry (no pending) succeeds.
4. Rollback: Supabase allows re-resetting; if the new password breaks a consumer,
   reset again and restore the env values from the pre-rotation copy. (There is
   no way to restore the *old* password — rollback = roll forward to another new
   one + revert env.)

Do the same for the dev credential (`csesvyxxjivnkkozgopt`) — lower urgency,
same steps.

## 5. Checklist

- [x] Exposure scoped (89 prod + ~10 dev tracked files; history also affected)
- [x] `resolveDbUrl` resolver added (env-only)
- [x] `.env.example` documents the keys
- [x] Codemod written (`scripts/remediate-db-credentials.mjs`)
- [x] Codemod applied — 133 files, 0 residual literals in tracked `.mjs`/`.ts`/`.md`, all touched `.mjs` pass `node --check`
- [ ] Per-script functional re-run against a live DB (historical one-offs — not done; run on demand with `PROD_DATABASE_URL` set)
- [ ] Production credential rotated (owner approval REQUIRED)
- [ ] Dev credential rotated
- [ ] History rewrite OR accepted-risk sign-off
