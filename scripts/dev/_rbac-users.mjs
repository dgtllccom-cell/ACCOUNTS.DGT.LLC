/**
 * DB-backed DEV test identities for the RBAC / domain harnesses.
 *
 *  - "[E2E TEST]" users are created through the REAL users API (so the creation guards are exercised); their ids are kept in a
 *    small registry file in the OS temp dir (ids and e-mails only - never passwords, which are random and never stored).
 *  - existing DEV users (real or rbac-test) are looked up READ-ONLY in the DEV database and can be acted as through
 *    POST /api/erp/auth/dev-session { userId }: the live resolver then re-reads that user's REAL assignment + permission set.
 *    No password is typed, read or needed. DEV only: the DATABASE_URL project ref is verified before every query.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { login, client } from "./_rbac-lib.mjs";

export const E2E_DOMAIN = "e2e-test.dev";
const REGISTRY = join(process.env.TEMP || ".", "dgt-e2e-users.json");

function readRegistry() { try { return existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, "utf8")) : {}; } catch { return {}; } }
function writeRegistry(r) { writeFileSync(REGISTRY, JSON.stringify(r, null, 2)); }
export function registeredE2EUsers() { return readRegistry(); }

function devDbUrl() {
  let url = process.env.DATABASE_URL || "";
  if (!url) {
    const f = join(process.cwd(), ".env.local");
    if (existsSync(f)) url = (readFileSync(f, "utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
  }
  if (!url.includes("csesvyxxjivnkkozgopt") || url.includes("inmayhrxucimxqhgseqi")) throw new Error("DEV database only: DATABASE_URL must point at csesvyxxjivnkkozgopt");
  return url;
}

/** Read-only query against the DEV database. */
export async function devQuery(fn) {
  const sql = postgres(devDbUrl(), { ssl: "require", prepare: false, max: 1 });
  try { return await fn(sql); } finally { await sql.end({ timeout: 5 }); }
}

export async function lookupUserId(email) {
  const r = await devQuery((sql) => sql`select id from auth.users where lower(email) = ${email.toLowerCase()} limit 1`);
  return r[0]?.id ?? null;
}

export async function globalClient() {
  return client(await login({ role: "super_admin" }));
}

export function randomPassword() {
  return "E2e-" + randomBytes(9).toString("base64url") + "9a";
}

/** Create (or reuse from the registry) a DEV test user via POST /api/erp/users as the Global Super Admin. */
export async function ensureTestUser(g, spec) {
  const email = `${spec.key}@${E2E_DOMAIN}`;
  const reg = readRegistry();
  // e2e-cleanup.mjs deactivates these identities at the end of a run, so a reused one is re-activated first (a deactivated user's
  // session is revoked and every request would redirect to login)
  const reactivate = async (id) => { await g.req("PATCH", "/api/erp/users", { userId: id, isActive: true }); };
  if (reg[spec.key]) { await reactivate(reg[spec.key]); return { id: reg[spec.key], created: false, email }; }
  const existing = await lookupUserId(email);
  if (existing) { reg[spec.key] = existing; writeRegistry(reg); await reactivate(existing); return { id: existing, created: false, email }; }
  const res = await g.req("POST", "/api/erp/users", {
    fullName: `[E2E TEST] ${spec.name}`, email, password: randomPassword(), preferredLanguage: "en",
    role: spec.role, operationalDomain: spec.domain, countryId: spec.countryId ?? null, countryBranchId: spec.countryBranchId ?? null,
    cityBranchId: spec.cityBranchId ?? null, accessProfile: spec.accessProfile ?? null, ledgerVisibility: spec.ledgerVisibility,
  });
  const id = res.json?.data?.userId ?? null;
  if (id) { reg[spec.key] = id; writeRegistry(reg); }
  return { id, created: Boolean(id), email, res };
}

/** A session for a DB-backed user (the role in the body is a placeholder; the live resolver re-reads the REAL assignment). */
export async function loginAsUser(userId) {
  return client(await login({ role: "country_admin", userId }));
}
