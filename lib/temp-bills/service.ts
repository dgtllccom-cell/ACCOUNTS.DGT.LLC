/**
 * Temporary Purchase & Sales Bills Register — service.
 *
 * HISTORICAL TRACKING ONLY. Nothing here writes to purchase_orders /
 * sales_orders / roznamcha_* / ledger_* / journal_* / stock_* / voucher_* /
 * settlement_*. There is NO "transfer to Main ERP" — these records stay
 * independent by design (owner requirement 2026-09-08).
 *
 * The main ERP is used ONLY as the source for selecting existing master data
 * (Party from enterprise_accounts | customers, Goods from goods). Country /
 * Branch scoped server-side via resolveReportScope + session ids, same model as
 * the Consignment Register and Customer Inquiry.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type TempBillKind = "purchase" | "sale";

export interface TempBillRow {
  id: string;
  entry_no: string | null;
  bill_kind: TempBillKind;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  party_account_id: string | null;
  party_customer_id: string | null;
  party_name: string;
  reference_no: string | null;
  goods_id: string | null;
  goods_name: string | null;
  bill_no: string | null;
  container_no: string | null;
  bl_no: string | null;
  bill_date: string;
  quantity: number | null;
  weight_cartons: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  currency_code: string;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TempBillInput {
  billKind: TempBillKind;
  partyAccountId?: string | null;
  partyCustomerId?: string | null;
  partyName: string;
  referenceNo?: string | null;
  goodsId?: string | null;
  goodsName?: string | null;
  billNo?: string | null;
  containerNo?: string | null;
  blNo?: string | null;
  billDate?: string | null;
  quantity?: number | null;
  weightCartons?: number | null;
  unit?: string | null;
  rate?: number | null;
  amount?: number | null;
  currencyCode?: string | null;
  remarks?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
}

async function pgWrite<T>(fn: Parameters<typeof withLocalPg<T>>[0]): Promise<T> {
  const out = await withLocalPg(fn);
  if (out === null) throw new ApiClientError("Database is temporarily unavailable.", { status: 503, code: "TBILL_ERROR" });
  return out;
}
async function pgRead<T>(fn: Parameters<typeof withReadPg<T>>[0]): Promise<T> {
  const out = await withReadPg(fn);
  if (out === null) throw new ApiClientError("Database is temporarily unavailable.", { status: 503, code: "TBILL_ERROR" });
  return out;
}

function schemaMissing(e: unknown): boolean {
  const err = e as any;
  return (err?.code || err?.cause?.code) === "42P01" || /relation "?public\.temp_bill/i.test(String(err?.message || e || ""));
}

export function mapTempBillError(e: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (e instanceof ApiClientError) return { code: (e as any).code || "TBILL_ERROR", message: e.message, status: (e as any).status || 400 };
  if (schemaMissing(e)) return { code: "SETUP_PENDING", message: "Temporary Bills Register is not set up on this database yet (run migration 20261114).", status: 200, setupPending: true };
  console.error("[temp-bills]", e instanceof Error ? e.stack || e.message : e);
  return { code: "TBILL_ERROR", message: "Temporary Bills Register is temporarily unavailable.", status: 503 };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Scope = {
  countryIds: string[];
  countryBranchIds: string[];
  cityBranchIds: string[];
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
};

function tempBillScope(session: ErpSession): Scope {
  const rs = resolveReportScope(session);
  return {
    countryIds: session.isSuperAdmin ? [] : session.countryIds ?? [],
    countryBranchIds: session.isSuperAdmin ? [] : session.countryBranchIds ?? [],
    cityBranchIds: session.isSuperAdmin ? [] : session.cityBranchIds ?? [],
    countryId: rs.countryId,
    countryBranchId: rs.countryBranchId,
    cityBranchId: rs.branchId,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function scopeWhere(session: ErpSession, sql: any) {
  if (session.isSuperAdmin) return sql`true`;
  const s = tempBillScope(session);
  return sql`(
    t.created_by = ${session.userId}::uuid
    OR t.city_branch_id = ANY(${s.cityBranchIds}::uuid[])
    OR t.country_branch_id = ANY(${s.countryBranchIds}::uuid[])
    OR t.country_id = ANY(${s.countryIds}::uuid[])
  )`;
}

export async function listTempBills(
  session: ErpSession,
  opts: { kind?: string | null; q?: string | null; partyId?: string | null; referenceNo?: string | null; fromDate?: string | null; toDate?: string | null; lang?: SupportedLanguage; limit?: number },
): Promise<{ rows: TempBillRow[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const like = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const kind = opts.kind === "purchase" || opts.kind === "sale" ? opts.kind : null;
  const rows = await pgRead(async (sql) => {
    return (await sql`
      SELECT t.*,
             cnt.name  AS country_name,
             cb.name   AS country_branch_name,
             city.name AS city_branch_name
      FROM public.temp_bill t
      LEFT JOIN public.countries cnt ON cnt.id = t.country_id
      LEFT JOIN public.country_branches cb ON cb.id = t.country_branch_id
      LEFT JOIN public.city_branches city ON city.id = t.city_branch_id
      WHERE t.deleted_at IS NULL
        AND (${scopeWhere(session, sql)})
        AND (${kind ? sql`t.bill_kind = ${kind}` : sql`true`})
        AND (${opts.partyId ? sql`(t.party_account_id = ${opts.partyId}::uuid OR t.party_customer_id = ${opts.partyId}::uuid)` : sql`true`})
        AND (${opts.referenceNo ? sql`t.reference_no = ${opts.referenceNo}` : sql`true`})
        AND (${opts.fromDate ? sql`t.bill_date >= ${opts.fromDate}::date` : sql`true`})
        AND (${opts.toDate ? sql`t.bill_date <= ${opts.toDate}::date` : sql`true`})
        AND (${like ? sql`(t.party_name ILIKE ${like} OR t.reference_no ILIKE ${like} OR t.bill_no ILIKE ${like} OR t.goods_name ILIKE ${like} OR t.container_no ILIKE ${like} OR t.bl_no ILIKE ${like} OR t.remarks ILIKE ${like})` : sql`true`})
      ORDER BY t.bill_date DESC, t.created_at DESC
      LIMIT ${limit}
    `) as unknown as TempBillRow[];
  });
  const lang = opts.lang ?? "en";
  // ONE record → the viewer's language: party name transliterates, goods name translates.
  // Amounts, bill/container/BL numbers, dates and reference numbers are never touched.
  let out = await localizeRecordFields<any>(rows as any, "temp_bill", ["party_name", "goods_name"], lang);
  return { rows: out as TempBillRow[] };
}

export async function tempBillSummary(session: ErpSession): Promise<{
  purchase: { count: number; total: number };
  sale: { count: number; total: number };
  parties: number;
  currencies: string[];
}> {
  return pgRead(async (sql) => {
    const [agg] = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE bill_kind = 'purchase')                          AS p_count,
        COALESCE(SUM(amount) FILTER (WHERE bill_kind = 'purchase'), 0)          AS p_total,
        COUNT(*) FILTER (WHERE bill_kind = 'sale')                              AS s_count,
        COALESCE(SUM(amount) FILTER (WHERE bill_kind = 'sale'), 0)             AS s_total,
        COUNT(DISTINCT COALESCE(party_account_id::text, party_customer_id::text, lower(party_name))) AS parties,
        ARRAY_AGG(DISTINCT currency_code)                                      AS currencies
      FROM public.temp_bill t
      WHERE t.deleted_at IS NULL AND (${scopeWhere(session, sql)})
    `) as unknown as Array<any>;
    return {
      purchase: { count: Number(agg?.p_count ?? 0), total: Number(agg?.p_total ?? 0) },
      sale: { count: Number(agg?.s_count ?? 0), total: Number(agg?.s_total ?? 0) },
      parties: Number(agg?.parties ?? 0),
      currencies: (agg?.currencies ?? []).filter(Boolean),
    };
  });
}

export async function getTempBill(session: ErpSession, id: string, lang: SupportedLanguage = "en", raw = false): Promise<TempBillRow | null> {
  const row = await pgRead(async (sql) => {
    const [r] = (await sql`
      SELECT t.* FROM public.temp_bill t
      WHERE t.id = ${id}::uuid AND t.deleted_at IS NULL AND (${scopeWhere(session, sql)})
      LIMIT 1
    `) as unknown as TempBillRow[];
    return r ?? null;
  });
  if (!row || raw) return row;
  const [loc] = await localizeRecordFields<any>([row as any], "temp_bill", ["party_name", "goods_name"], lang);
  return loc as TempBillRow;
}

function assertScopeOnWrite(session: ErpSession, countryId: string | null | undefined) {
  if (session.isSuperAdmin || !countryId) return;
  const s = tempBillScope(session);
  if (s.countryIds.length && !s.countryIds.includes(countryId)) {
    throw new ApiClientError("You cannot create a bill outside your assigned country.", { status: 403, code: "FORBIDDEN" });
  }
}

export async function createTempBill(session: ErpSession, input: TempBillInput, lang: SupportedLanguage = "en"): Promise<{ id: string; entryNo: string }> {
  const countryId = input.countryId ?? session.countryIds?.[0] ?? null;
  assertScopeOnWrite(session, countryId);
  const name = input.partyName.trim();
  return pgWrite(async (sql) => {
    const [row] = (await sql`
      INSERT INTO public.temp_bill (
        bill_kind, country_id, country_branch_id, city_branch_id,
        party_account_id, party_customer_id, party_name, reference_no,
        goods_id, goods_name, bill_no, container_no, bl_no, bill_date,
        quantity, weight_cartons, unit, rate, amount, currency_code, remarks, created_by
      ) VALUES (
        ${input.billKind}, ${countryId}, ${input.countryBranchId ?? session.countryBranchIds?.[0] ?? null}, ${input.cityBranchId ?? session.cityBranchIds?.[0] ?? null},
        ${input.partyAccountId ?? null}, ${input.partyCustomerId ?? null}, ${name}, ${input.referenceNo ?? null},
        ${input.goodsId ?? null}, ${input.goodsName ?? null}, ${input.billNo ?? null}, ${input.containerNo ?? null}, ${input.blNo ?? null},
        ${input.billDate ?? null} ${input.billDate ? sql`::date` : sql``},
        ${num(input.quantity)}, ${num(input.weightCartons)}, ${input.unit ?? null}, ${num(input.rate)}, ${num(input.amount)},
        ${(input.currencyCode ?? "USD").toUpperCase()}, ${input.remarks ?? null}, ${session.userId}::uuid
      )
      RETURNING id, entry_no
    `) as unknown as Array<{ id: string; entry_no: string }>;
    try {
      await translateMasterRecord(
        "temp_bill",
        row.id,
        { party_name: name, goods_name: input.goodsName ?? undefined },
        lang,
        session.userId,
      );
    } catch {
      /* translation shell is best-effort — never blocks the write */
    }
    return { id: row.id, entryNo: row.entry_no };
  });
}

export async function updateTempBill(session: ErpSession, id: string, patch: Partial<TempBillInput>): Promise<void> {
  await pgWrite(async (sql) => {
    const [existing] = (await sql`
      SELECT id, country_id FROM public.temp_bill t
      WHERE t.id = ${id}::uuid AND t.deleted_at IS NULL AND (${scopeWhere(session, sql)}) LIMIT 1
    `) as unknown as Array<{ id: string; country_id: string | null }>;
    if (!existing) throw new ApiClientError("Bill not found or not in your scope.", { status: 404, code: "NOT_FOUND" });

    const set: Record<string, unknown> = {};
    if (patch.billKind !== undefined) set.bill_kind = patch.billKind;
    if (patch.partyAccountId !== undefined) set.party_account_id = patch.partyAccountId ?? null;
    if (patch.partyCustomerId !== undefined) set.party_customer_id = patch.partyCustomerId ?? null;
    if (patch.partyName !== undefined) set.party_name = patch.partyName.trim();
    if (patch.referenceNo !== undefined) set.reference_no = patch.referenceNo ?? null;
    if (patch.goodsId !== undefined) set.goods_id = patch.goodsId ?? null;
    if (patch.goodsName !== undefined) set.goods_name = patch.goodsName ?? null;
    if (patch.billNo !== undefined) set.bill_no = patch.billNo ?? null;
    if (patch.containerNo !== undefined) set.container_no = patch.containerNo ?? null;
    if (patch.blNo !== undefined) set.bl_no = patch.blNo ?? null;
    if (patch.billDate !== undefined && patch.billDate) set.bill_date = patch.billDate;
    if (patch.quantity !== undefined) set.quantity = num(patch.quantity);
    if (patch.weightCartons !== undefined) set.weight_cartons = num(patch.weightCartons);
    if (patch.unit !== undefined) set.unit = patch.unit ?? null;
    if (patch.rate !== undefined) set.rate = num(patch.rate);
    if (patch.amount !== undefined) set.amount = num(patch.amount);
    if (patch.currencyCode !== undefined) set.currency_code = (patch.currencyCode ?? "USD").toUpperCase();
    if (patch.remarks !== undefined) set.remarks = patch.remarks ?? null;

    if (Object.keys(set).length === 0) return;
    await sql`UPDATE public.temp_bill SET ${sql(set)} WHERE id = ${id}::uuid`;
  });
}

export async function deleteTempBill(session: ErpSession, id: string): Promise<void> {
  await pgWrite(async (sql) => {
    const res = await sql`
      UPDATE public.temp_bill SET deleted_at = now()
      WHERE id = ${id}::uuid AND deleted_at IS NULL AND (${scopeWhere(session, sql)})
    `;
    if ((res as any).count === 0) throw new ApiClientError("Bill not found or not in your scope.", { status: 404, code: "NOT_FOUND" });
  });
}
