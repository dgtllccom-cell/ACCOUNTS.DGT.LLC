/**
 * Builds docs/user-verification-<date>.md from the JSON written by tests/dev/user-verification.dev.test.ts plus the harness
 * evidence files. English, technical terms kept (the owner's Urdu report is produced from these tables).
 *
 *   node scripts/dev/user-verification-report.mjs <user-verification.json> <evidence.json> [out.md]
 */
import { readFileSync, writeFileSync } from "node:fs";

const [dataPath, evidencePath, outPath = `docs/user-verification-${new Date().toISOString().slice(0, 10)}.md`] = process.argv.slice(2);
const users = JSON.parse(readFileSync(dataPath, "utf8"));
const ev = JSON.parse(readFileSync(evidencePath, "utf8"));

// ---- per-user findings that need an owner decision (everything else is PASS) ---------------------------------------------------
const NOTES = {
  "shipping@dgt.llc": {
    issue: "Named 'Shipping Line Super Admin' but its assignment has operational_domain='both', so it resolves as the GLOBAL Super Admin (all Business data, all menus).",
    fix: "Code path verified: a Super Admin with operational_domain='shipping' resolves to shipping_super_admin (Shipping-only). Data NOT changed (real user). Owner: set the assignment domain to 'shipping' if this login must be Shipping-only.",
    status: "PASS (resolves) — OWNER DECISION",
  },
  "audit.superadmin@dgt.llc": {
    issue: "Named 'Audit' but holds the full Global Super Admin role (write access), not the read-only Reports Auditor role.",
    fix: "None applied (real user). Owner: re-issue as super_admin_reports (read-only) if audit-only is intended.",
    status: "PASS (resolves) — OWNER DECISION",
  },
  "quetta.shipping.admin.pakbr000002@dgt.llc": {
    issue: "Shipping-domain Branch Admin assigned to the BUSINESS branch 'Quetta City Branch' (no Shipping branch exists for Quetta in DEV).",
    fix: "Users API now refuses this combination for every creator (422 BRANCH_DOMAIN_MISMATCH). Existing row NOT altered (real user). Owner: create a Quetta Shipping & Clearing branch and move this user, or switch the user to the Business domain.",
    status: "PASS (resolves) — OWNER ACTION",
  },
  "quetta.shipping.agent@dgt.llc": {
    issue: "Shipping-domain agent_user assigned to the BUSINESS branch 'Quetta City Branch'.",
    fix: "Same guard as above; existing row NOT altered. Owner: reassign to a Shipping branch.",
    status: "PASS (resolves) — OWNER ACTION",
  },
  "rbac.sl.deira@rbac-test.dev": {
    issue: "Shipping-line user assigned to the BUSINESS branch 'Deira Dubai City Branch' (RBAC test fixture).",
    fix: "Test fixture, left unchanged; the guard prevents new ones.",
    status: "PASS (resolves) — TEST DATA",
  },
  "chaman.shipping@dgt.llc": {
    issue: "Saved custom permission set (2026-09-13) held only legacy form tokens: no accounts:create, customers:*, expenses:*, ledgers:read — Account Master creation answered 'Missing permission: accounts:create'.",
    fix: "DEV: 39 exact tokens added through the users API (scripts/dev/grant-chaman-shipping-permissions.mjs; owner-approved SHIPPING_APPROVED_BUNDLE + customers/companies/warehouses/ledgers/expenses). Production: owner repeats the grant in Permission Control Center (token list printed by the script).",
    status: "PASS (DEV fixed) — PROD OWNER ACTION",
  },
  "alras.shipping@dgt.llc": { issue: "Same legacy-token permission set as Chaman (45 tokens, no accounts:create).", fix: "Not changed (Task B is Chaman only). Same grant script pattern applies if wanted.", status: "PASS (resolves) — OWNER DECISION" },
  "kandahar.shipping@dgt.llc": { issue: "Same legacy-token permission set as Chaman (45 tokens, no accounts:create).", fix: "Not changed (Task B is Chaman only).", status: "PASS (resolves) — OWNER DECISION" },
  "quetta.branch@dgt.llc": { issue: "Manual permission set of only 4 tokens: the sidebar shows 3 entries; the Branch Admin cannot work in Quetta.", fix: "Not changed (real user). Owner: apply the Business branch template in Permission Control Center.", status: "PASS (resolves) — OWNER DECISION" },
};

const real = users.filter((u) => u.email.endsWith("@dgt.llc"));
const test = users.filter((u) => !u.email.endsWith("@dgt.llc"));
const domainLabel = (u) => (u.domainClass === "global" ? "Global (both)" : u.domainClass === "both" ? "Both" : u.domainClass === "business" ? "Business" : u.domainClass === "shipping" ? "Shipping" : "-");

function row(u) {
  const n = NOTES[u.email];
  const auto = u.issues.length && !n ? u.issues.join("; ") : null;
  const issue = n?.issue ?? auto ?? "—";
  const fix = n?.fix ?? (auto ? "See issue" : "—");
  const status = n?.status ?? (u.issues.length ? "FAIL" : "PASS");
  const perms = `${u.permissionCount ?? 0} effective tokens (${u.permSource ?? "role template"})${u.canViewFinancials === false ? ", no financial amounts" : ""}`;
  const loc = [u.country ?? "Global", u.countryBranch].filter(Boolean).join(" / ");
  return `| ${u.userCode ?? "-"} | ${u.email} | ${(u.effectiveRoles ?? [u.storedRole]).join(", ")} | ${u.country ?? "Global"} | ${u.cityBranch ?? u.countryBranch ?? "—"} | ${domainLabel(u)} | NOT VERIFIED* | ${u.dashboard ?? "—"} | ${perms} | ${issue} | ${fix} | ${status} |`;
}

const head = "| Username | Email | Role | Country | Branch | Business / Shipping | Login* | Dashboard | Permissions | Issue | Fix | Final status |\n|---|---|---|---|---|---|---|---|---|---|---|---|";

const menuRows = (list) =>
  list.map((u) => `| ${u.email} | ${u.menuCount ?? "—"} | ${(u.menuGroups ?? []).map((g) => g.replace("/dashboard", "").replace(/^\//, "") || "home").join(", ")} | ${u.urlCheck ? (u.domainClass === "business" ? `${u.urlCheck.shippingUrlsOpen.length === 0 ? "all Shipping URLs 403" : "LEAK " + u.urlCheck.shippingUrlsOpen.join(",")}` : u.domainClass === "shipping" ? `${u.urlCheck.businessUrlsOpen.length === 0 ? "all Business URLs 403" : "LEAK " + u.urlCheck.businessUrlsOpen.join(",")}` : "both domains allowed (by assignment)") : "—"} |`).join("\n");

const summary = {
  total: users.length, real: real.length, test: test.length,
  fail: users.filter((u) => u.issues.length && !NOTES[u.email]).length,
  owner: users.filter((u) => NOTES[u.email]).length,
};

const md = `# User-by-user verification — ${new Date().toISOString().slice(0, 10)}

**Environment:** DEV database \`csesvyxxjivnkkozgopt\` only (hard-guarded in the harness). Production \`inmayhrxucimxqhgseqi\` was not read or written.
**Branch:** \`feat/domain-separation-user-verification\` (from \`feat/stock-balance-report\`).
**Language:** English with technical terms; the owner's Urdu report is produced from these tables.

## 1. How many users are active? (13 or 14 — answered from the DEV database)

| Group | Count |
|---|---|
| Profiles in DEV (not soft-deleted) | ${ev.counts.profilesLive} |
| …with a live (active, not deleted) assignment → can have a session | **${summary.total}** |
| …of which real \`@dgt.llc\` accounts | **${summary.real}** |
| …of which \`@rbac-test.dev\` RBAC fixtures | ${summary.test} |
| Profiles with NO live assignment (cannot sign in — session is revoked) | ${ev.counts.noAssignment} |
| Soft-deleted profiles (historic / test) | ${ev.counts.softDeleted} |

The number is **not 13 or 14 in DEV**: ${summary.real} real \`@dgt.llc\` logins resolve to a session (${summary.total} including RBAC test fixtures). If the owner's 13/14 refers to Production, that database was deliberately not queried here. \`business.superadmin@dgt.llc\` does **not exist in the DEV database** (it is a Production account); it was mimicked with \`POST /api/erp/auth/dev-session { role: "super_admin", operationalDomain: "business" }\` (see §4).

## 2. Method (no password was typed, read or needed)

1. Users and assignments were read **read-only** from the DEV database.
2. For every user the production session resolver \`resolveEffectiveAccessForUser\` was called in-process — that is exactly the session the user's next request would get (live assignment, custom permission set, branch rules, domain). No cookie was issued.
3. From that session the sidebar (\`visibleMenuHrefsFor\`, the same filter the live sidebar uses), the dashboard route and the direct-URL decision (\`evaluateRouteAccess\`, the same policy the server layout uses for the 403 page) were computed.
4. API access and data isolation were exercised over HTTP against the running DEV server with \`dev-session\` identities (no real password): \`scripts/dev/domain-leak-scan.mjs\`, \`direct-url-api-matrix.mjs\`, \`user-creation-domain-e2e.mjs\`, \`shipping-account-approval-e2e.mjs\`.
5. **Login\\*** = real password sign-in cannot be performed by the assistant (CLAUDE.md: no real passwords). It is therefore marked **NOT VERIFIED** for every user, never PASS. "Session resolves" (step 2) is the verified part.

## 3. Per-user table — real accounts (@dgt.llc)

${head}
${real.map(row).join("\n")}

\\* Login = real password sign-in: **NOT VERIFIED** (see §6 for the secure reset process).

### 3b. Menus and direct-URL access per real account

| Email | Sidebar entries | Sidebar groups | Direct URL check (domain) |
|---|---|---|---|
${menuRows(real)}

## 3c. RBAC test fixtures (@rbac-test.dev)

${head}
${test.map(row).join("\n")}

## 3d. Profiles that cannot sign in (no live assignment)

${ev.noAssignment.map((u) => `- \`${u.email}\` — ${u.full_name} (${u.user_code ?? "no code"}): no active assignment → every request redirects to login (session revoked by design).`).join("\n")}

## 4. Business Admin vs Shipping Admin vs Full Super Admin

${ev.separation}

## 5. Isolation evidence

${ev.evidence}

## 6. Secure password-reset process (the assistant cannot verify real logins)

1. **User forgot the password:** \`/auth/forgot-password\` (e-mail reset link). Verify the e-mail provider is configured in the target environment — **NOT VERIFIED here**.
2. **Administrator reset:** Users screen → user → *Reset password* → \`POST /api/erp/users/password { userId, generateTemporary: true }\`. The API is scope-checked (\`userInManagerScope\` + \`domainManagerTargetError\`: a Country / Branch / Business / Shipping administrator can only reset users of their own country, branch **and domain**; Super Admin / Country Admin identities only by the Global Super Admin). A strong one-time temporary password (\`Dgt#\` + 10 random characters) is returned **once** to the administrator, set through Supabase Auth, and any legacy \`profiles.raw_password\` of that user is cleared. The password is never written to the audit trail.
3. **Hand-over:** give the temporary password out-of-band (in person / secure channel), never together with the user name by e-mail; the user changes it immediately at \`/auth/set-new-password\` or Profile → Change password (\`POST /api/erp/users/password { currentPassword, newPassword, confirmPassword }\`, current password re-verified).
4. **Evidence:** every reset writes an \`audit_logs\` row \`user.password_reset\` (actor, target, reason, timestamp) and every self-change \`user.password_self_changed\`.
   **Known gap (not changed here):** the server does **not** force the change — \`profiles.must_change_password\` is read by the session builder but \`mustChangePassword\` is hard-coded \`false\` and the dashboard layout does not redirect. Until that is built, the administrator must instruct the user to change the temporary password at first sign-in.
5. **Owner action:** the legacy plaintext column \`profiles.raw_password\` still holds non-NULL values for some DEV/PROD profiles (see memory *shipping-line-user-access*); purging it needs the owner's explicit approval and was **not** done.

## 7. Summary

- Users resolved: **${summary.total}** (real ${summary.real}, test ${summary.test}). Automatic domain-separation findings left unexplained: **${summary.fail}**.
- Accounts needing an owner decision/action (listed above): **${summary.owner}**.
`;
writeFileSync(outPath, md);
console.log("wrote", outPath, md.length, "chars");
