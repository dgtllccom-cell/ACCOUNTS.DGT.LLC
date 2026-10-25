import { ApiClientError } from "@/lib/api/response";

/** Anything that behaves like the postgres.js tagged template (a connection or a transaction). */
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]> & any;

export type TaxOption = {
  /** the code the user picks and the line stores */
  code: string;
  name: string;
  /** percentage, e.g. 5 for 5% */
  rate: number;
  appliesTo: string | null;
  isDefault: boolean;
  source: "country_tax_settings" | "tax_codes";
};

export type BranchExpenseContext = {
  cityBranchId: string;
  countryBranchId: string | null;
  countryId: string | null;
  countryName: string | null;
  /** the accounting BASE currency, read from the branch / country configuration — never assumed */
  baseCurrency: string;
};

/** Reads the configured base currency of a city branch (branch override first, then its country). Throws 422 when none is configured. */
export async function resolveBranchExpenseContext(sql: Sql, cityBranchId: string): Promise<BranchExpenseContext> {
  const rows = await sql`
    select cb.id as city_branch_id, cb.country_branch_id, cb.country_id, c.name as country_name,
           upper(coalesce(nullif(cb.local_currency, ''), c.currency_code)) as base_currency
    from public.city_branches cb
    left join public.countries c on c.id = cb.country_id
    where cb.id = ${cityBranchId}::uuid and cb.deleted_at is null
    limit 1`;
  const r = rows[0];
  if (!r) throw new ApiClientError("The selected branch was not found.", { status: 422, code: "BRANCH_NOT_FOUND" });
  if (!r.base_currency) {
    throw new ApiClientError("The base currency of this branch / country is not configured. Set it in the country or branch settings first.", { status: 422, code: "NO_BASE_CURRENCY" });
  }
  return {
    cityBranchId: r.city_branch_id,
    countryBranchId: r.country_branch_id ?? null,
    countryId: r.country_id ?? null,
    countryName: r.country_name ?? null,
    baseCurrency: String(r.base_currency).toUpperCase()
  };
}

/** The tax codes configured for a country: the per-country tax master first, the legacy tax-code list (matched by country name) after it. */
export async function listCountryTaxOptions(sql: Sql, ctx: Pick<BranchExpenseContext, "countryId" | "countryName">): Promise<TaxOption[]> {
  const out: TaxOption[] = [];
  if (ctx.countryId) {
    const rows = await sql`
      select coalesce(nullif(tax_code, ''), tax_name) as code, tax_name, tax_rate, applies_to, coalesce(is_default, false) as is_default
      from public.country_tax_settings
      where country_id = ${ctx.countryId}::uuid and coalesce(is_active, true) = true
      order by is_default desc, tax_name asc`;
    for (const r of rows) out.push({ code: String(r.code), name: String(r.tax_name), rate: Number(r.tax_rate), appliesTo: r.applies_to ?? null, isDefault: Boolean(r.is_default), source: "country_tax_settings" });
  }
  if (ctx.countryName) {
    const rows = await sql`
      select tax_name, tax_pct from public.tax_codes
      where lower(country_name) = lower(${ctx.countryName}) and coalesce(is_active, true) = true
      order by tax_name asc`;
    for (const r of rows) {
      if (out.some((o) => o.code.toLowerCase() === String(r.tax_name).toLowerCase())) continue;
      out.push({ code: String(r.tax_name), name: String(r.tax_name), rate: Number(r.tax_pct), appliesTo: null, isDefault: false, source: "tax_codes" });
    }
  }
  return out;
}

/**
 * The configured rate for a tax code in this country, or throws 422. A row can only use a tax code that belongs to ITS country, with
 * that code's configured rate — the same percentage is never applied to every country or every expense.
 */
export async function requireConfiguredTax(sql: Sql, ctx: Pick<BranchExpenseContext, "countryId" | "countryName">, code: string, submittedPct: number): Promise<TaxOption> {
  const options = await listCountryTaxOptions(sql, ctx);
  if (options.length === 0) {
    throw new ApiClientError(`No tax code is configured for ${ctx.countryName || "this country"}. Add it under Settings → Tax first, or mark the row tax-exempt.`, { status: 422, code: "NO_TAX_CONFIG" });
  }
  const hit = options.find((o) => o.code.toLowerCase() === String(code || "").trim().toLowerCase());
  if (!hit) {
    throw new ApiClientError(`Tax code "${code}" is not configured for ${ctx.countryName || "this country"}.`, { status: 422, code: "TAX_CODE_UNKNOWN" });
  }
  if (Math.abs(hit.rate - submittedPct) > 0.0001) {
    throw new ApiClientError(`Tax code "${hit.code}" is configured at ${hit.rate}% for ${ctx.countryName || "this country"} but the row used ${submittedPct}%.`, { status: 422, code: "TAX_RATE_MISMATCH" });
  }
  return hit;
}
