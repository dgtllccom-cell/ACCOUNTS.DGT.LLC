import { withReadPg } from "@/lib/db/local-postgres";
import { assertRowInScope, jobScopeWhere, type IntakeScope } from "@/lib/document-intelligence/scope";
import { resolveModule, type IntakeModule } from "@/lib/document-intelligence/intake-modules";
import { compareBank, crossRate, partyNameScore, significantTokens, type BankComparison, type KnownBank } from "@/lib/document-intelligence/party-match";

/**
 * Review context for ONE document inside the module the user chose: which counter-party the document
 * names for OUR side of the deal, the existing authorised party / linked-account / bank records that
 * match it, the selectable accounts, a rate suggestion and duplicate warnings.
 *
 * Read-only. It never creates a party, account, bank or ledger — uncertain matches are returned as
 * candidates for the user to choose.
 */

export type PartyCandidate = {
  id: string;
  kind: "customer" | "company";
  name: string;
  /** supplier / customer master code (person_code / company_code) */
  code: string | null;
  countryId: string | null;
  score: number;
  accountIds: string[];
  banks: Array<{ id: string; bankName: string | null; branchName: string | null; accountTitle: string | null; accountNumber: string | null; iban: string | null; swift: string | null; currency: string | null }>;
};

export type AccountOption = {
  id: string;
  code: string;
  name: string;
  kind: string | null;
  currency: string | null;
  linkedPartyIds: string[];
};

export type ReviewContext = {
  moduleId: string | null;
  side: IntakeModule["side"] | null;
  partyRole: "supplier" | "customer" | null;
  /** the name the document prints for the counter-party (Seller for purchases, Buyer for sales) */
  documentPartyName: string | null;
  /** the document's other party — normally OUR company */
  documentOwnName: string | null;
  partyStatus: "matched" | "ambiguous" | "not_found" | "not_applicable";
  selectedPartyId: string | null;
  candidates: PartyCandidate[];
  accountOptions: AccountOption[];
  bank: BankComparison & { extracted: { beneficiary: string | null; bankName: string | null; accountNo: string | null; iban: string | null; swift: string | null } };
  rate: { fromCurrency: string | null; toCurrency: string | null; baseCurrency: string | null; rate: number | null; rateDate: string | null; source: "currency_rates" | null };
  duplicates: Array<{ id: string; jobNo: string; status: string; reason: string; draftReference: string | null }>;
  /** side-mismatch warning: the selected counter-party looks like OUR OWN company */
  sideWarning: string | null;
};

type FieldMap = Record<string, string>;

const val = (m: FieldMap, k: string) => (m[k] ?? "").trim() || null;

/** SQL scope for enterprise_accounts aliased `a` — own country / branches; branch users also see parent-level accounts of their country. */
function accountScope(sql: any, scope: IntakeScope) {
  const parts: any[] = [];
  if (scope.countryIds) parts.push(sql`a.country_id = ANY(${scope.countryIds})`);
  if (scope.countryBranchIds) parts.push(sql`(a.country_branch_id = ANY(${scope.countryBranchIds}) OR a.country_branch_id IS NULL)`);
  if (scope.cityBranchIds) parts.push(sql`(a.city_branch_id = ANY(${scope.cityBranchIds}) OR a.city_branch_id IS NULL)`);
  if (!parts.length) return sql`TRUE`;
  return parts.reduce((x, p, i) => (i === 0 ? p : sql`${x} AND ${p}`));
}

const ACCOUNT_SELECT = (sql: any) => sql`
  a.id, a.code, a.name, a.kind::text AS kind, a.currency,
  array_remove(
    ARRAY[a.customer_id, a.company_id]::uuid[]
    || COALESCE((SELECT array_agg(x.customer_id) FROM public.account_customer_owners x WHERE x.account_id = a.id), '{}')
    || COALESCE((SELECT array_agg(x.company_id) FROM public.account_companies x WHERE x.account_id = a.id), '{}'),
    NULL) AS linked`;

export async function buildReviewContext(
  jobId: string,
  scope: IntakeScope,
  opts: { moduleId?: string | null; partyId?: string | null; baseCurrency?: string | null } = {},
): Promise<ReviewContext | null> {
  return withReadPg(async (sql) => {
    const job = (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
    if (!job) return null;
    assertRowInScope(scope, job);

    const rows = await sql`SELECT field_key, corrected_value, normalized_value, raw_value FROM public.document_intake_fields WHERE job_id = ${jobId}`;
    const f: FieldMap = {};
    for (const r of rows as any[]) f[r.field_key] = String(r.corrected_value ?? r.normalized_value ?? r.raw_value ?? "");

    const mod = resolveModule(opts.moduleId ?? job.source_module_hint, job.target_module);
    const partyRole = mod?.party ?? null;
    // Seller → our supplier (purchase side); Buyer → our customer (sales side). Never decided by the document title.
    const sellerName = val(f, "supplier_name");
    const buyerName = val(f, "customer_name");
    const documentPartyName = partyRole === "supplier" ? sellerName : partyRole === "customer" ? buyerName : null;
    const documentOwnName = partyRole === "supplier" ? buyerName : partyRole === "customer" ? sellerName : null;

    // ── candidate party masters (customers + companies), authorised by scope ─────────────────────────
    let candidates: PartyCandidate[] = [];
    const tokens = significantTokens(documentPartyName).slice(0, 3);
    if (partyRole && tokens.length) {
      const patterns = tokens.map((t) => `%${t.replace(/[%_\\]/g, "")}%`);
      const custRows = await sql`
        SELECT id, COALESCE(NULLIF(customer_name,''), company_name) AS name, person_code AS code, country_id
        FROM public.customers
        WHERE deleted_at IS NULL AND (lower(coalesce(customer_name,'') || ' ' || coalesce(company_name,'')) ILIKE ANY(${patterns}::text[]))
        LIMIT 40`;
      const compRows = await sql`
        SELECT id, COALESCE(NULLIF(name,''), legal_name) AS name, company_code AS code, country_id
        FROM public.companies
        WHERE deleted_at IS NULL AND (lower(coalesce(name,'') || ' ' || coalesce(legal_name,'')) ILIKE ANY(${patterns}::text[]))
        LIMIT 40`;
      const raw: Array<{ id: string; kind: "customer" | "company"; name: string; code: string | null; countryId: string | null; score: number }> = [];
      for (const r of custRows as any[]) raw.push({ id: r.id, kind: "customer", name: r.name, code: r.code ?? null, countryId: r.country_id, score: partyNameScore(documentPartyName, r.name) });
      for (const r of compRows as any[]) raw.push({ id: r.id, kind: "company", name: r.name, code: r.code ?? null, countryId: r.country_id, score: partyNameScore(documentPartyName, r.name) });
      const top = raw.filter((c) => c.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 8);

      for (const c of top) {
        const accts = (await sql`
          SELECT a.id FROM public.enterprise_accounts a
          WHERE a.deleted_at IS NULL AND ${accountScope(sql, scope)}
            AND (${c.kind === "customer" ? sql`a.customer_id = ${c.id}` : sql`a.company_id = ${c.id}`}
              OR a.id IN (SELECT x.account_id FROM ${c.kind === "customer" ? sql`public.account_customer_owners x WHERE x.customer_id = ${c.id}` : sql`public.account_companies x WHERE x.company_id = ${c.id}`}))
          LIMIT 50`) as any[];
        const banks = (await sql`
          SELECT b.id, b.bank_name, b.branch_name, b.account_title, b.account_number, b.iban_number, b.swift_bic, b.currency
          FROM public.banks b
          WHERE b.deleted_at IS NULL AND (
            ${c.kind === "company" ? sql`b.owner_company_id = ${c.id}` : sql`b.owner_person_id = ${c.id}`}
            OR b.id IN (SELECT ab.bank_id FROM public.account_banks ab WHERE ab.account_id = ANY(${accts.map((x) => x.id)}::uuid[])))
          LIMIT 30`) as any[];
        // A party is "authorised" for this user when it is in their country OR has an account in their scope.
        const inCountry = !scope.countryIds || (c.countryId && scope.countryIds.includes(c.countryId));
        if (!inCountry && accts.length === 0) continue;
        candidates.push({
          id: c.id, kind: c.kind, name: c.name, code: c.code, countryId: c.countryId, score: Number(c.score.toFixed(2)),
          accountIds: accts.map((x) => x.id),
          banks: banks.map((b) => ({ id: b.id, bankName: b.bank_name, branchName: b.branch_name, accountTitle: b.account_title, accountNumber: b.account_number, iban: b.iban_number, swift: b.swift_bic, currency: b.currency })),
        });
      }
      // If the caller picked a party that did not come up by name, load it (still scope-checked above by account scope).
      if (opts.partyId && !candidates.some((c) => c.id === opts.partyId)) {
        const one = (await sql`
          SELECT id, 'customer' AS kind, COALESCE(NULLIF(customer_name,''), company_name) AS name, person_code AS code, country_id FROM public.customers WHERE id = ${opts.partyId} AND deleted_at IS NULL
          UNION ALL
          SELECT id, 'company', COALESCE(NULLIF(name,''), legal_name), company_code, country_id FROM public.companies WHERE id = ${opts.partyId} AND deleted_at IS NULL LIMIT 1`)?.[0] as any;
        if (one && (!scope.countryIds || (one.country_id && scope.countryIds.includes(one.country_id)))) {
          candidates.unshift({ id: one.id, kind: one.kind, name: one.name, code: one.code ?? null, countryId: one.country_id, score: 0, accountIds: [], banks: [] });
        }
      }
    }

    // ── choose the party: explicit > unambiguous exact > none (user must pick) ─────────────────────────────
    let selectedPartyId: string | null = null;
    let partyStatus: ReviewContext["partyStatus"] = partyRole ? "not_found" : "not_applicable";
    if (partyRole) {
      if (opts.partyId && candidates.some((c) => c.id === opts.partyId)) {
        selectedPartyId = opts.partyId;
        partyStatus = "matched";
      } else if (candidates.length) {
        const [first, second] = candidates;
        if (first.score >= 0.95 && (!second || second.score < first.score - 0.15)) {
          selectedPartyId = first.id;
          partyStatus = "matched";
        } else {
          partyStatus = "ambiguous";
        }
      }
    }
    const selected = candidates.find((c) => c.id === selectedPartyId) ?? null;

    // ── selectable accounts (scoped), party-linked first ────────────────────────────────────────────────
    const jobCountry = job.country_id as string | null;
    const accts = (await sql`
      SELECT ${ACCOUNT_SELECT(sql)}
      FROM public.enterprise_accounts a
      WHERE a.deleted_at IS NULL AND ${accountScope(sql, scope)}
        ${jobCountry ? sql`AND (a.country_id = ${jobCountry} OR a.id = ANY(${(selected?.accountIds ?? []) as string[]}::uuid[]))` : sql``}
      ORDER BY a.code
      LIMIT 1500`) as any[];
    const accountOptions: AccountOption[] = accts.map((a) => ({ id: a.id, code: a.code, name: a.name, kind: a.kind, currency: a.currency, linkedPartyIds: a.linked ?? [] }));
    const linkedFirst = new Set(selected?.accountIds ?? []);
    accountOptions.sort((a, b) => Number(linkedFirst.has(b.id)) - Number(linkedFirst.has(a.id)));

    // ── bank details on the document vs the selected party's linked banks ────────────────────────────────
    const extractedBank = {
      beneficiary: val(f, "beneficiary_name") ?? val(f, "account_title"),
      bankName: val(f, "bank_name"),
      accountNo: val(f, "account_number"),
      iban: val(f, "iban"),
      swift: val(f, "swift_bic"),
    };
    const known: KnownBank[] = (selected?.banks ?? []).map((b) => ({ id: b.id, bankName: b.bankName, accountTitle: b.accountTitle, accountNumber: b.accountNumber, iban: b.iban, swift: b.swift }));
    const bank = { ...compareBank(extractedBank, known), extracted: extractedBank };

    // ── rate suggestion (doc currency → base currency) from the existing currency_rates master ───────────
    const docCurrency = (val(f, "currency") ?? "").toUpperCase() || null;
    let baseCurrency = (opts.baseCurrency ?? "").toUpperCase() || null;
    if (!baseCurrency && jobCountry) {
      baseCurrency = ((await sql`SELECT currency_code FROM public.countries WHERE id = ${jobCountry}`)?.[0] as any)?.currency_code?.toUpperCase() ?? null;
    }
    const toUsd = async (cur: string | null): Promise<{ v: number | null; date: string | null }> => {
      if (!cur) return { v: null, date: null };
      if (cur === "USD") return { v: 1, date: null };
      const r = (await sql`
        SELECT COALESCE(credit_rate, rate)::float AS v, effective_date::text AS d FROM public.currency_rates
        WHERE deleted_at IS NULL AND from_currency = ${cur} AND to_currency = 'USD' AND (country_id IS NULL ${jobCountry ? sql`OR country_id = ${jobCountry}` : sql``})
        ORDER BY (country_id IS NULL), created_at DESC LIMIT 1`)?.[0] as any;
      return { v: r?.v ?? null, date: r?.d ?? null };
    };
    let rate: number | null = null;
    let rateDate: string | null = null;
    if (docCurrency && baseCurrency) {
      if (docCurrency === baseCurrency) { rate = 1; }
      else {
        const [a, b] = await Promise.all([toUsd(docCurrency), toUsd(baseCurrency)]);
        rate = crossRate(a.v, b.v);
        rateDate = a.date ?? b.date;
      }
    }

    // ── duplicate warnings (same file, or same contract no. from the same counter-party) ──────────────────
    const dupRows = (await sql`
      SELECT j.id, j.job_no, j.status, j.draft_reference, j.file_sha256, j.contract_reference
      FROM public.document_intake_queue_v j
      WHERE ${jobScopeWhere(sql, scope)} AND j.id <> ${jobId} AND j.status NOT IN ('cancelled')
        AND (j.file_sha256 = ${job.file_sha256}
          OR (${val(f, "contract_number") ? sql`upper(j.contract_reference) = upper(${val(f, "contract_number")})` : sql`FALSE`}))
      ORDER BY j.created_at DESC LIMIT 10`) as any[];
    const duplicates = dupRows.map((d) => ({
      id: d.id, jobNo: d.job_no, status: d.status, draftReference: d.draft_reference,
      reason: d.file_sha256 === job.file_sha256 ? "same_file" : "same_contract_no",
    }));

    // ── side mismatch: does the picked counter-party look like OUR own company? ────────────────────────────
    let sideWarning: string | null = null;
    if (partyRole && documentPartyName) {
      const own = (await sql`
        SELECT DISTINCT n FROM (
          SELECT cb.branding_company_name AS n FROM public.country_branches cb WHERE cb.id = ${job.country_branch_id ?? null}
          UNION ALL SELECT c.name FROM public.companies c JOIN public.country_branches cb ON cb.company_id = c.id WHERE cb.id = ${job.country_branch_id ?? null}
        ) x WHERE n IS NOT NULL`) as any[];
      if (own.some((o) => partyNameScore(documentPartyName, o.n) >= 0.9)) {
        sideWarning = "counterparty_is_own_company";
      }
    }

    return {
      moduleId: mod?.id ?? null,
      side: mod?.side ?? null,
      partyRole,
      documentPartyName,
      documentOwnName,
      partyStatus,
      selectedPartyId,
      candidates,
      accountOptions,
      bank,
      rate: { fromCurrency: docCurrency, toCurrency: baseCurrency, baseCurrency, rate, rateDate, source: rate != null && docCurrency !== baseCurrency ? "currency_rates" : null },
      duplicates,
      sideWarning,
    } satisfies ReviewContext;
  });
}

/** Ids that are NOT a live enterprise account inside the caller's scope (empty = all good). */
export async function verifyAccountsInScope(sql: any, ids: string[], scope: IntakeScope): Promise<string[]> {
  if (!ids.length) return [];
  const ok = (await sql`
    SELECT a.id FROM public.enterprise_accounts a
    WHERE a.deleted_at IS NULL AND a.id = ANY(${ids}::uuid[]) AND ${accountScope(sql, scope)}`) as any[];
  const good = new Set(ok.map((r) => r.id));
  return ids.filter((i) => !good.has(i));
}

/** A supplier / customer master the caller may use: it exists and is in their country OR has an in-scope account. */
export async function verifyPartyInScope(sql: any, id: string, kind: "customer" | "company" | null, scope: IntakeScope): Promise<boolean> {
  const row = (kind === "company"
    ? await sql`SELECT id, country_id FROM public.companies WHERE id = ${id} AND deleted_at IS NULL`
    : await sql`SELECT id, country_id FROM public.customers WHERE id = ${id} AND deleted_at IS NULL`)?.[0] as any;
  if (!row) return false;
  if (!scope.countryIds || (row.country_id && scope.countryIds.includes(row.country_id))) return true;
  const linked = (await sql`
    SELECT 1 FROM public.enterprise_accounts a
    WHERE a.deleted_at IS NULL AND ${accountScope(sql, scope)}
      AND (${kind === "company" ? sql`a.company_id = ${id}` : sql`a.customer_id = ${id}`}
        OR a.id IN (SELECT x.account_id FROM ${kind === "company" ? sql`public.account_companies x WHERE x.company_id = ${id}` : sql`public.account_customer_owners x WHERE x.customer_id = ${id}`}))
    LIMIT 1`) as any[];
  return linked.length > 0;
}

export type AccountRowLite = { id: string; code: string; name: string; currency: string | null; kind: string | null; customer_id: string | null; company_id: string | null };

/** The live enterprise accounts (inside the caller's scope) for the given ids, keyed by id. Missing id = invalid / out of scope. */
export async function loadAccountsInScope(sql: any, ids: string[], scope: IntakeScope): Promise<Map<string, AccountRowLite>> {
  const out = new Map<string, AccountRowLite>();
  if (!ids.length) return out;
  const rows = (await sql`
    SELECT a.id, a.code, a.name, a.currency, a.kind::text AS kind, a.customer_id, a.company_id
    FROM public.enterprise_accounts a
    WHERE a.deleted_at IS NULL AND a.id = ANY(${ids}::uuid[]) AND ${accountScope(sql, scope)}`) as AccountRowLite[];
  for (const r of rows) out.set(r.id, r);
  return out;
}
