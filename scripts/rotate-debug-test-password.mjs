// Rotates the shared TEST-DB "superadmin@dgt.llc" legacy raw_password used by
// the local debug/Playwright scripts (scripts/debug-after-click.mjs,
// scripts/debug-roznamcha.mjs, scripts/verify-all-flows-playwright.mjs,
// scripts/verify-locations-playwright.mjs, scripts/verify-roznamcha-playwright.mjs)
// after the previous literal password was found committed in plaintext (see
// git history for scripts/debug-after-click.mjs prior to this commit).
//
// Safety:
//  - Refuses to run unless DATABASE_URL points at the TEST project
//    (csesvyxxjivnkkozgopt) - never production.
//  - Only updates public.profiles.raw_password for this one named test
//    account - no other row is touched.
//  - Prints the new value once to stdout only, for the operator to place in
//    their local .env as DGT_TEST_PASSWORD (never committed).
//
// Usage (test DB only):
//   node scripts/rotate-debug-test-password.mjs
import fs from "node:fs";
import postgres from "postgres";
import crypto from "node:crypto";

function loadEnvFile(p) { if (!fs.existsSync(p)) return {}; return Object.fromEntries(fs.readFileSync(p, "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })); }
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };

const TEST_PROJECT_REF = "csesvyxxjivnkkozgopt";
if (!env.DATABASE_URL || !env.DATABASE_URL.includes(TEST_PROJECT_REF)) {
  console.error(`Refusing to run: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF}).`);
  process.exit(1);
}

const newPassword = "Qa" + crypto.randomBytes(6).toString("base64url") + "!9";

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
try {
  const rows = await sql`
    UPDATE public.profiles p
    SET raw_password = ${newPassword}
    FROM auth.users u
    WHERE u.id = p.id AND u.email ILIKE 'superadmin@dgt.llc'
    RETURNING p.id, u.email
  `;
  console.log(`Rotated ${rows.length} row(s): ${rows.map((r) => r.email).join(", ")}`);
  console.log(`Set this in your local .env (never commit it): DGT_TEST_PASSWORD=${newPassword}`);
} finally {
  await sql.end();
}
