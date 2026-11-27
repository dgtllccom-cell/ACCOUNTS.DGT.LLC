import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { sessionInDomain, type ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { demoAccountPayload, demoBranchCode, demoCountry, demoRequestSchema, type DemoRowResult } from "@/lib/accounts-demo-import";
import { POST as createSingleAccount } from "@/app/api/erp/accounting/accounts/route";
import { getProdRef, refFromDatabaseUrl, refFromSupabaseUrl } from "@/lib/env/environment";

/** Demo accounts belong in TESTING only (CLAUDE.md: no demo data in Production). True when this server talks to the Production database. */
export function demoImportBlockedHere(): boolean {
  const prod = getProdRef();
  return (process.env.APP_ENV || "").trim().toLowerCase() === "production"
    || refFromDatabaseUrl(process.env.DATABASE_URL) === prod
    || refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) === prod
    || refFromSupabaseUrl(process.env.SUPABASE_URL) === prod;
}

export async function processAlRasDemoBulk(session: ErpSession, input: unknown) {
  if (demoImportBlockedHere()) {
    return apiError("DEMO_NOT_IN_PRODUCTION", "Demo accounts can only be created in the TESTING database, never in Production.", 403);
  }
  if (!session.isSuperAdmin || !sessionInDomain(session, "business")) {
    return apiError("DEMO_FORBIDDEN", "This demo import is for Business-authorized Super Admins only.", 403);
  }
  const body = demoRequestSchema.parse(input);
  const backing = await withLocalPg(async (sql) => {
    const branches = await sql<{ id: string; countryId: string; countryBranchId: string }[]>`
      select cb.id, cb.country_id as "countryId", cb.country_branch_id as "countryBranchId"
      from public.city_branches cb join public.countries c on c.id = cb.country_id
      where upper(cb.code) = ${demoBranchCode} and cb.status = 'active' and cb.deleted_at is null
        and upper(cb.local_currency) = 'AED' and upper(c.iso2) = 'AE' and c.deleted_at is null
    `;
    if (branches.length !== 1) return { branch: null } as const;
    const branch = branches[0];
    authorizeApiScope(session, { resource: "accounts", action: "create",
      countryId: branch.countryId, countryBranchId: branch.countryBranchId, cityBranchId: branch.id });
    const countries = await sql<{ id: string; iso2: string }[]>`
      select id, upper(iso2) as iso2 from public.countries
      where deleted_at is null and upper(iso2) in ${sql([...new Set(body.rows.map((row) => demoCountry(row.reference)))])}
    `;
    const matches = await sql<{ id: string; reference: string; name: string; code: string; category: string; branch: string;
      address: string; domain: string; currency: string; deleted_at: string | null }[]>`
      select id, upper(btrim(manual_reference_number)) as reference, name,
        coalesce(account_number, code) as code, category, city_branch_id as branch,
        address_country_id as address, operational_domain as domain, currency, deleted_at
      from public.enterprise_accounts
      where upper(btrim(manual_reference_number)) in ${sql(body.rows.map((row) => row.reference))}
    `;
    return { branch, countries, matches };
  });
  if (!backing) return apiError("DEMO_DB_REQUIRED", "Transactional PostgreSQL is required for demo import.", 503);
  if (!backing.branch) return apiError("DEMO_TARGET", "The approved UAE Business branch is missing or ambiguous.", 409);
  const { branch, countries, matches } = backing;
  const results: DemoRowResult[] = [];
  for (const row of body.rows) {
    const country = demoCountry(row.reference);
    const item = { ...row, country };
    const targets = countries.filter((c) => c.iso2 === country);
    if (targets.length !== 1) {
      results.push({ ...item, status: "blocked", reason: "Address country is missing or ambiguous; no UAE fallback is allowed." });
      continue;
    }
    const addressId = targets[0].id;
    const known = matches.filter((m) => m.reference === row.reference);
    if (known.length) {
      const m = known[0];
      if (known.length === 1 && !m.deleted_at && m.branch === branch.id && m.address === addressId &&
          m.name === row.name && m.category === row.category && m.domain === "business" && m.currency === "AED") {
        results.push({ ...item, status: "existing", code: m.code });
      } else {
        results.push({ ...item, status: "blocked", reason: "Reference is already in use or differs from the reviewed account." });
      }
      continue;
    }
    if (body.action === "preview") {
      results.push({ ...item, status: "ready" });
      continue;
    }
    try {
      const res = await createSingleAccount(new NextRequest("http://internal/api/erp/accounting/accounts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(demoAccountPayload(row, branch, addressId)),
      }));
      const json = await res.json();
      const code = json?.data?.accountNumber;
      if (res.ok && typeof code === "string") {
        results.push({ ...item, status: "created", code });
        continue;
      }
    } catch {
      // A failed response does not prove the transaction did not commit.
    }
    results.push({ ...item, status: "unknown", reason: "Re-run Preview before resuming; the write status must be reconciled." });
    break;
  }
  return apiOk({ branchCode: demoBranchCode, results });
}
