// Resets the Supabase Auth password for every ACTIVE (non-deleted) ERP user
// profile to a caller-supplied temporary password, and flags each one
// `must_change_password = true` so /auth/set-new-password forces a real,
// private password on next login (see app/dashboard/layout.tsx).
//
// Safety:
//  - Refuses to run unless DATABASE_URL points at the TEST project
//    (csesvyxxjivnkkozgopt) - never production - per CLAUDE.md policy.
//  - The temporary password is NEVER hardcoded here: pass it via the
//    RESET_TEMP_PASSWORD env var so it can never land in git history.
//  - Uses Supabase Auth's own admin API (bcrypt hashing) - no plaintext
//    password is ever written to any table.
//  - Only touches profiles with deleted_at IS NULL - no soft-deleted
//    account, no historical record, is modified.
//
// Usage (test DB only):
//   RESET_TEMP_PASSWORD='...' node scripts/reset-active-user-passwords.mjs [--dry-run]

import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8").split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
  );
}
// .env.local overrides .env, matching Next.js's own precedence.
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };

const TEST_PROJECT_REF = "csesvyxxjivnkkozgopt";
if (!env.DATABASE_URL || !env.DATABASE_URL.includes(TEST_PROJECT_REF)) {
  console.error(`Refusing to run: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF}). This script must never touch production.`);
  process.exit(1);
}

const tempPassword = process.env.RESET_TEMP_PASSWORD;
if (!tempPassword || tempPassword.length < 8) {
  console.error("Set RESET_TEMP_PASSWORD (>= 8 chars) in the environment before running. Never hardcode it in this file.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || `https://${TEST_PROJECT_REF}.supabase.co`;
const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error("SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY missing from .env / .env.local.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const profiles = await sql`
    select p.id, p.full_name,
      (select array_agg(distinct ura.role) from public.user_role_assignments ura where ura.user_id = p.id and ura.is_active = true and ura.deleted_at is null) as roles
    from public.profiles p
    where p.deleted_at is null
    order by p.full_name
  `;

  console.log(`${dryRun ? "[DRY RUN] " : ""}Resetting ${profiles.length} active profile(s) on test DB (${TEST_PROJECT_REF})...\n`);

  let ok = 0;
  let failed = 0;
  for (const p of profiles) {
    const roles = (p.roles ?? []).join(", ") || "(no active role assignment)";
    if (dryRun) {
      console.log(`[DRY RUN] would reset: ${p.full_name ?? p.id} — ${roles}`);
      continue;
    }
    const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(p.id);
    if (getErr || !authUser?.user) {
      console.log(`SKIP (no Supabase Auth user): ${p.full_name ?? p.id} — ${roles}`);
      continue;
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(p.id, { password: tempPassword });
    if (updateErr) {
      console.log(`FAILED: ${p.full_name ?? p.id} (${authUser.user.email}) — ${updateErr.message}`);
      failed += 1;
      continue;
    }
    await sql`update public.profiles set must_change_password = true where id = ${p.id}::uuid`;
    console.log(`OK: ${p.full_name ?? p.id} (${authUser.user.email}) — ${roles}`);
    ok += 1;
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}Done. ${dryRun ? profiles.length + " would be reset" : `${ok} reset, ${failed} failed`}.`);
} finally {
  await sql.end();
}
