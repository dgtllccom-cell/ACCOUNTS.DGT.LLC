import { withLocalPg } from "@/lib/db/local-postgres";
// Reuses the account creation route as-is (identity numbers, duplicate rules, approval chain and the
// linked ledger all come from that handler) instead of copying its logic here.
import { POST as createEnterpriseAccount } from "@/app/api/erp/accounting/accounts/route";

export type CityBranchAccountInput = {
  cityBranchId: string;
  countryId: string;
  countryBranchId: string;
  operationalDomain: "business" | "shipping";
  name: string;
  currency: string;
  customerId: string | null;
};

export type CityBranchAccountResult =
  | { created: true; existed: boolean; accountId: string; ledgerId: string | null; accountCode: string; status: string }
  | { created: false; reason: string };

/**
 * Creates the New Account for a City Branch automatically (business or shipping domain).
 * Idempotent: if the branch already has a live account, that account is returned and nothing is created.
 */
export async function createCityBranchAccount(request: Request, input: CityBranchAccountInput): Promise<CityBranchAccountResult> {
  const existing = await withLocalPg(async (sql) => {
    const rows = await sql`
      select id, code, status::text as status
      from public.enterprise_accounts
      where scope = 'city_branch'
        and city_branch_id = ${input.cityBranchId}::uuid
        and deleted_at is null
      limit 1
    `;
    return (rows as any[])[0] ?? null;
  });
  if (existing) {
    return { created: true, existed: true, accountId: String(existing.id), ledgerId: null, accountCode: String(existing.code), status: String(existing.status) };
  }

  const body = {
    scope: "city_branch",
    countryId: input.countryId,
    countryBranchId: input.countryBranchId,
    cityBranchId: input.cityBranchId,
    operationalDomain: input.operationalDomain,
    code: "AUTO",
    name: input.name,
    kind: "asset",
    currency: input.currency,
    customerId: input.customerId ?? undefined,
    contacts: []
  };

  const res = await createEnterpriseAccount(
    new Request(new URL("/api/erp/accounting/accounts", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
        "x-erp-lang": request.headers.get("x-erp-lang") ?? ""
      },
      body: JSON.stringify(body)
    }) as any
  );
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const reason = json?.error?.message ?? json?.message ?? `Account not created (HTTP ${res.status}).`;
    return { created: false, reason: String(reason) };
  }
  const d = json?.data ?? json;
  return {
    created: true,
    existed: false,
    accountId: String(d.accountId),
    ledgerId: d.ledgerId ? String(d.ledgerId) : null,
    accountCode: String(d.accountCode),
    status: String(d.status ?? "active")
  };
}
