/**
 * Consignment Stock & Sales Register — service.
 *
 * TRACKING ONLY. Nothing here writes to purchase_orders / sales_orders /
 * roznamcha_* / ledger_* / journal_* / settlement_*. "Transfer to Accounting"
 * is a later owner-approved phase.
 *
 * Reuses existing masters (enterprise_accounts / customers / goods / product_units
 * / countries / country_branches / city_branches). Country/Branch scoped
 * server-side via resolveReportScope + session ids (same model as Customer Inquiry).
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type {
  ConsignmentRow,
  ConsignmentReport,
  ContainerGoodRow,
  ContainerRow,
  ExpenseRow,
  ReceiptRow,
  SaleRow,
} from "./types";

async function pg<T>(fn: Parameters<typeof withLocalPg<T>>[0]): Promise<T> {
  const out = await withLocalPg(fn);
  if (out === null) throw new ApiClientError("Database is temporarily unavailable.", { status: 503, code: "CNS_ERROR" });
  return out;
}

function schemaMissing(e: unknown): boolean {
  const err = e as any;
  return (err?.code || err?.cause?.code) === "42P01" || /relation "?public\.consignment/i.test(String(err?.message || e || ""));
}

export function mapConsignmentError(e: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (e instanceof ApiClientError) return { code: (e as any).code || "CNS_ERROR", message: e.message, status: (e as any).status || 400 };
  if (schemaMissing(e)) return { code: "SETUP_PENDING", message: "Consignment Register is not set up on this database yet (run migration 20261028).", status: 200, setupPending: true };
  console.error("[consignment]", e instanceof Error ? e.stack || e.message : e);
  return { code: "CNS_ERROR", message: "Consignment Register is temporarily unavailable.", status: 503 };
}

// ── scope ────────────────────────────────────────────────────────────────────
type Scope = { isManager: boolean; level: "global" | "country" | "branch"; countryIds: string[]; countryBranchIds: string[]; cityBranchIds: string[]; countryId: string | null; countryBranchId: string | null; cityBranchId: string | null };
const MANAGER = new Set(["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]);

export function consignmentScope(session: ErpSession): Scope {
  const rs = resolveReportScope(session);
  return {
    isManager: session.isSuperAdmin || session.roles.some((r) => MANAGER.has(r)),
    level: rs.level,
    countryIds: session.isSuperAdmin ? [] : session.countryIds ?? [],
    countryBranchIds: session.isSuperAdmin ? [] : session.countryBranchIds ?? [],
    cityBranchIds: session.isSuperAdmin ? [] : session.cityBranchIds ?? [],
    countryId: rs.countryId,
    countryBranchId: rs.countryBranchId,
    cityBranchId: rs.branchId,
  };
}

function visibleSql(sql: any, session: ErpSession) {
  if (session.isSuperAdmin) return sql`true`;
  const s = consignmentScope(session);
  // own rows always, plus scope-managed rows
  return sql`(
    c.created_by = ${session.userId}::uuid
    OR (c.country_id IS NULL AND c.country_branch_id IS NULL AND c.city_branch_id IS NULL)
    OR c.country_id = ANY(${s.countryIds}::uuid[])
    OR c.country_branch_id = ANY(${s.countryBranchIds}::uuid[])
    OR c.city_branch_id = ANY(${s.cityBranchIds}::uuid[])
  )`;
}

// ── consignment head ─────────────────────────────────────────────────────────
export interface ConsignmentInput {
  partyAccountId?: string | null;
  partyCustomerId?: string | null;
  partyName: string;
  partyContact?: string | null;
  partyPhone?: string | null;
  title?: string | null;
  referenceNo?: string | null;
  baseCurrency?: string | null;
  consignmentDate?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  notes?: string | null;
  originalLanguage?: SupportedLanguage;
  status?: ConsignmentRow["status"];
}

export async function createConsignment(session: ErpSession, input: ConsignmentInput): Promise<{ id: string; consignmentNo: string }> {
  const name = (input.partyName || "").trim();
  if (!name) throw new ApiClientError("Party name is required.", { status: 400, code: "VALIDATION" });
  const s = consignmentScope(session);
  const countryId = input.countryId ?? (s.level !== "global" ? s.countryId : null);
  const countryBranchId = input.countryBranchId ?? (s.level === "branch" ? s.countryBranchId : null);
  const cityBranchId = input.cityBranchId ?? (s.level === "branch" ? s.cityBranchId : null);
  if (!session.isSuperAdmin && s.level === "country" && countryId && s.countryIds.length && !s.countryIds.includes(countryId)) {
    throw new ApiClientError("Consignment country is outside your scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }
  const lang = (input.originalLanguage as SupportedLanguage) || "en";

  const row = await pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment (
        country_id, country_branch_id, city_branch_id,
        party_account_id, party_customer_id, party_name, party_contact, party_phone,
        title, reference_no, base_currency, consignment_date, status, notes, original_language_code, created_by
      ) values (
        ${countryId}, ${countryBranchId}, ${cityBranchId},
        ${input.partyAccountId ?? null}, ${input.partyCustomerId ?? null}, ${name}, ${input.partyContact ?? null}, ${input.partyPhone ?? null},
        ${input.title ?? null}, ${input.referenceNo ?? null}, ${(input.baseCurrency || "USD").toUpperCase()},
        ${input.consignmentDate || new Date().toISOString().slice(0, 10)}, ${input.status || "open"},
        ${input.notes ?? null}, ${lang}, ${session.userId}::uuid
      )
      returning id, consignment_no
    `) as unknown as Array<{ id: string; consignment_no: string }>;
    return rows[0];
  });

  try {
    await translateMasterRecord("consignment", row.id, { party_name: name, title: input.title ?? undefined, notes: input.notes ?? undefined }, lang, session.userId);
  } catch {
    /* non-fatal */
  }
  return { id: row.id, consignmentNo: row.consignment_no };
}

export async function updateConsignment(session: ErpSession, id: string, patch: Partial<ConsignmentInput> & { status?: ConsignmentRow["status"] }): Promise<void> {
  await assertCanEdit(session, id);
  await pg(async (sql) => {
    const set: any[] = [];
    const add = (frag: any) => set.push(frag);
    if ("partyName" in patch) add(sql`party_name = ${(patch.partyName || "").trim()}`);
    if ("partyAccountId" in patch) add(sql`party_account_id = ${patch.partyAccountId ?? null}`);
    if ("partyCustomerId" in patch) add(sql`party_customer_id = ${patch.partyCustomerId ?? null}`);
    if ("partyContact" in patch) add(sql`party_contact = ${patch.partyContact ?? null}`);
    if ("partyPhone" in patch) add(sql`party_phone = ${patch.partyPhone ?? null}`);
    if ("title" in patch) add(sql`title = ${patch.title ?? null}`);
    if ("referenceNo" in patch) add(sql`reference_no = ${patch.referenceNo ?? null}`);
    if ("baseCurrency" in patch) add(sql`base_currency = ${(patch.baseCurrency || "USD").toUpperCase()}`);
    if ("consignmentDate" in patch) add(sql`consignment_date = ${patch.consignmentDate || null}`);
    if ("notes" in patch) add(sql`notes = ${patch.notes ?? null}`);
    if ("status" in patch && patch.status) add(sql`status = ${patch.status}`);
    if (!set.length) return;
    let frag = set[0];
    for (let i = 1; i < set.length; i++) frag = sql`${frag}, ${set[i]}`;
    await sql`update public.consignment set ${frag} where id = ${id}::uuid and deleted_at is null`;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${id}::uuid, ${session.userId}::uuid, 'updated', ${patch.status ? "status → " + patch.status : "details edited"})`;
  });
}

export async function deleteConsignment(session: ErpSession, id: string): Promise<void> {
  await assertCanEdit(session, id);
  await pg(async (sql) => {
    await sql`update public.consignment set deleted_at = now() where id = ${id}::uuid`;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${id}::uuid, ${session.userId}::uuid, 'deleted', null)`;
  });
}

async function assertCanEdit(session: ErpSession, id: string): Promise<void> {
  const ok = await pg(async (sql) => {
    const scoped = visibleSql(sql, session);
    const rows = (await sql`select 1 from public.consignment c where c.id = ${id}::uuid and c.deleted_at is null and ${scoped}`) as unknown as any[];
    return rows.length > 0;
  });
  if (!ok) throw new ApiClientError("Consignment not found or not in your scope.", { status: 404, code: "NOT_FOUND" });
}

// ── list / register ──────────────────────────────────────────────────────────
export async function listConsignments(
  session: ErpSession,
  opts: { q?: string | null; status?: string | null; lang?: SupportedLanguage; limit?: number } = {},
): Promise<Array<ConsignmentRow & { container_count: number; total_sales: number; total_receipts: number }>> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const lang = opts.lang || "en";
  const rows = await pg(async (sql) => {
    const scoped = visibleSql(sql, session);
    const st = opts.status ? sql`and c.status = ${opts.status}` : sql``;
    const q = opts.q?.trim() ? sql`and (c.party_name ilike ${"%" + opts.q.trim() + "%"} or c.consignment_no ilike ${"%" + opts.q.trim() + "%"} or coalesce(c.title,'') ilike ${"%" + opts.q.trim() + "%"} or coalesce(c.reference_no,'') ilike ${"%" + opts.q.trim() + "%"})` : sql``;
    return (await sql`
      select c.*,
        (select count(*) from public.consignment_container k where k.consignment_id = c.id and k.deleted_at is null) as container_count,
        coalesce((select sum(s.amount) from public.consignment_sale s where s.consignment_id = c.id and s.deleted_at is null),0) as total_sales,
        coalesce((select sum(r.amount) from public.consignment_receipt r where r.consignment_id = c.id and r.deleted_at is null),0) as total_receipts
      from public.consignment c
      where c.deleted_at is null and ${scoped} ${st} ${q}
      order by c.created_at desc
      limit ${limit}
    `) as unknown as any[];
  });
  const localized = await localizeRecordFields(rows.map((r) => ({ id: r.id, party_name: r.party_name, title: r.title })), "consignment", ["party_name", "title"], lang).catch(() => rows);
  const byId = new Map((localized as any[]).map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, party_name: byId.get(r.id)?.party_name ?? r.party_name, title: byId.get(r.id)?.title ?? r.title }));
}

// ── full report ──────────────────────────────────────────────────────────────
export async function getConsignmentReport(session: ErpSession, id: string, lang: SupportedLanguage = "en"): Promise<ConsignmentReport> {
  const data = await pg(async (sql) => {
    const scoped = visibleSql(sql, session);
    const [head] = (await sql`select c.* from public.consignment c where c.id = ${id}::uuid and c.deleted_at is null and ${scoped}`) as unknown as ConsignmentRow[];
    if (!head) throw new ApiClientError("Consignment not found or not in your scope.", { status: 404, code: "NOT_FOUND" });
    const containers = (await sql`select * from public.consignment_container where consignment_id = ${id}::uuid and deleted_at is null order by coalesce(loading_date, created_at::date), created_at`) as unknown as ContainerRow[];
    const goods = (await sql`select * from public.consignment_container_good where consignment_id = ${id}::uuid and deleted_at is null order by created_at`) as unknown as ContainerGoodRow[];
    const expenses = (await sql`select * from public.consignment_expense where consignment_id = ${id}::uuid and deleted_at is null order by expense_date, created_at`) as unknown as ExpenseRow[];
    const sales = (await sql`select * from public.consignment_sale where consignment_id = ${id}::uuid and deleted_at is null order by sale_date, created_at`) as unknown as SaleRow[];
    const receipts = (await sql`select * from public.consignment_receipt where consignment_id = ${id}::uuid and deleted_at is null order by receipt_date, created_at`) as unknown as ReceiptRow[];
    const events = (await sql`select id, event_type, detail, actor_name, created_at from public.consignment_event where consignment_id = ${id}::uuid order by created_at`) as unknown as any[];
    return { head, containers, goods, expenses, sales, receipts, events };
  });

  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // per-goods stock position
  const stockMap = new Map<string, { goodsName: string; unit: string | null; received: number; sold: number }>();
  for (const g of data.goods) {
    const key = (g.goods_id || g.goods_name || "").toLowerCase().trim() || "unknown";
    const e = stockMap.get(key) ?? { goodsName: g.goods_name, unit: g.unit_label, received: 0, sold: 0 };
    e.received += num(g.quantity);
    stockMap.set(key, e);
  }
  for (const s of data.sales) {
    const key = (s.goods_id || s.goods_name || "").toLowerCase().trim() || "unknown";
    const e = stockMap.get(key) ?? { goodsName: s.goods_name, unit: s.unit_label, received: 0, sold: 0 };
    e.sold += num(s.quantity);
    stockMap.set(key, e);
  }
  const stockByGoods = [...stockMap.entries()].map(([goodsKey, v]) => ({
    goodsKey,
    goodsName: v.goodsName,
    unit: v.unit,
    received: v.received,
    sold: v.sold,
    remaining: v.received - v.sold,
  }));

  const totalSales = data.sales.reduce((a, s) => a + num(s.amount), 0);
  const totalExpenses = data.expenses.reduce((a, e) => a + num(e.amount), 0);
  const totalReceipts = data.receipts.reduce((a, r) => a + num(r.amount), 0);
  const goodsReceivedQty = data.goods.reduce((a, g) => a + num(g.quantity), 0);
  const goodsSoldQty = data.sales.reduce((a, s) => a + num(s.quantity), 0);

  const byContainer = new Map<string, ContainerGoodRow[]>();
  for (const g of data.goods) {
    const list = byContainer.get(g.container_id) ?? [];
    list.push(g);
    byContainer.set(g.container_id, list);
  }

  return {
    consignment: data.head,
    containers: data.containers.map((c) => ({ ...c, goods: byContainer.get(c.id) ?? [] })),
    expenses: data.expenses,
    sales: data.sales,
    receipts: data.receipts,
    events: data.events,
    stockByGoods,
    totals: {
      containerCount: data.containers.length,
      goodsReceivedQty,
      goodsSoldQty,
      remainingStockQty: goodsReceivedQty - goodsSoldQty,
      totalGrossWeight: data.goods.reduce((a, g) => a + num(g.gross_weight), 0),
      totalNetWeight: data.goods.reduce((a, g) => a + num(g.net_weight), 0),
      totalSales,
      totalExpenses,
      totalReceipts,
      remainingReceivable: totalSales - totalReceipts,
      netPosition: totalSales - totalExpenses - totalReceipts,
    },
  };
}

// ── child-row CRUD (all scope-checked via the parent consignment) ─────────────
async function guard(session: ErpSession, consignmentId: string): Promise<void> {
  await assertCanEdit(session, consignmentId);
}

export async function addContainer(session: ErpSession, consignmentId: string, input: Partial<ContainerRow>): Promise<{ id: string }> {
  await guard(session, consignmentId);
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment_container
        (consignment_id, container_no, bl_no, loading_date, arrival_date, vessel_name, shipping_line, origin_country_id, seal_no, total_cartons, total_gross_weight, total_net_weight, status, notes, created_by)
      values (${consignmentId}::uuid, ${input.container_no ?? null}, ${input.bl_no ?? null}, ${input.loading_date ?? null}, ${input.arrival_date ?? null},
        ${input.vessel_name ?? null}, ${input.shipping_line ?? null}, ${input.origin_country_id ?? null}, ${input.seal_no ?? null},
        ${input.total_cartons ?? null}, ${input.total_gross_weight ?? null}, ${input.total_net_weight ?? null}, ${input.status || "received"}, ${input.notes ?? null}, ${session.userId}::uuid)
      returning id
    `) as unknown as Array<{ id: string }>;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${consignmentId}::uuid, ${session.userId}::uuid, 'container_added', ${input.container_no ?? input.bl_no ?? null})`;
    return rows[0];
  });
}

export async function addContainerGood(session: ErpSession, consignmentId: string, containerId: string, input: Partial<ContainerGoodRow>): Promise<{ id: string }> {
  await guard(session, consignmentId);
  const name = (input.goods_name || "").trim();
  if (!name) throw new ApiClientError("Goods name is required.", { status: 400, code: "VALIDATION" });
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment_container_good
        (container_id, consignment_id, goods_id, goods_name, unit_id, unit_label, cartons, quantity, gross_weight, net_weight, rate, amount, currency, notes, created_by)
      values (${containerId}::uuid, ${consignmentId}::uuid, ${input.goods_id ?? null}, ${name}, ${input.unit_id ?? null}, ${input.unit_label ?? null},
        ${input.cartons ?? null}, ${Number(input.quantity) || 0}, ${input.gross_weight ?? null}, ${input.net_weight ?? null},
        ${input.rate ?? null}, ${input.amount ?? (input.rate && input.quantity ? Number(input.rate) * Number(input.quantity) : null)}, ${input.currency ?? null}, ${input.notes ?? null}, ${session.userId}::uuid)
      returning id
    `) as unknown as Array<{ id: string }>;
    return rows[0];
  });
}

export async function addExpense(session: ErpSession, consignmentId: string, input: Partial<ExpenseRow>): Promise<{ id: string }> {
  await guard(session, consignmentId);
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment_expense (consignment_id, container_id, expense_type, description, currency, amount, expense_date, paid_by, reference_no, notes, created_by)
      values (${consignmentId}::uuid, ${input.container_id ?? null}, ${input.expense_type || "other"}, ${input.description ?? null},
        ${(input.currency || "USD").toUpperCase()}, ${Number(input.amount) || 0}, ${input.expense_date || new Date().toISOString().slice(0, 10)}, ${input.paid_by ?? null}, ${input.reference_no ?? null}, ${input.notes ?? null}, ${session.userId}::uuid)
      returning id
    `) as unknown as Array<{ id: string }>;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${consignmentId}::uuid, ${session.userId}::uuid, 'expense_added', ${(input.expense_type || "other") + " " + (input.amount ?? "")})`;
    return rows[0];
  });
}

export async function addSale(session: ErpSession, consignmentId: string, input: Partial<SaleRow>): Promise<{ id: string }> {
  await guard(session, consignmentId);
  const name = (input.goods_name || "").trim();
  if (!name) throw new ApiClientError("Goods name is required.", { status: 400, code: "VALIDATION" });
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment_sale (consignment_id, container_id, sale_date, buyer_name, goods_id, goods_name, unit_id, unit_label, quantity, rate, currency, amount, reference_no, notes, created_by)
      values (${consignmentId}::uuid, ${input.container_id ?? null}, ${input.sale_date || new Date().toISOString().slice(0, 10)}, ${input.buyer_name ?? null},
        ${input.goods_id ?? null}, ${name}, ${input.unit_id ?? null}, ${input.unit_label ?? null}, ${Number(input.quantity) || 0}, ${input.rate ?? null},
        ${(input.currency || "USD").toUpperCase()}, ${Number(input.amount) || (input.rate && input.quantity ? Number(input.rate) * Number(input.quantity) : 0)}, ${input.reference_no ?? null}, ${input.notes ?? null}, ${session.userId}::uuid)
      returning id
    `) as unknown as Array<{ id: string }>;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${consignmentId}::uuid, ${session.userId}::uuid, 'sale_added', ${name})`;
    return rows[0];
  });
}

export async function addReceipt(session: ErpSession, consignmentId: string, input: Partial<ReceiptRow>): Promise<{ id: string }> {
  await guard(session, consignmentId);
  return pg(async (sql) => {
    const rows = (await sql`
      insert into public.consignment_receipt (consignment_id, receipt_date, amount, currency, method, reference_no, notes, created_by)
      values (${consignmentId}::uuid, ${input.receipt_date || new Date().toISOString().slice(0, 10)}, ${Number(input.amount) || 0},
        ${(input.currency || "USD").toUpperCase()}, ${input.method || "cash"}, ${input.reference_no ?? null}, ${input.notes ?? null}, ${session.userId}::uuid)
      returning id
    `) as unknown as Array<{ id: string }>;
    await sql`insert into public.consignment_event (consignment_id, actor_id, event_type, detail) values (${consignmentId}::uuid, ${session.userId}::uuid, 'receipt_added', ${String(input.amount ?? "")})`;
    return rows[0];
  });
}

/** delete a child row (container / good / expense / sale / receipt), scope-checked. */
export async function deleteChild(session: ErpSession, kind: "container" | "good" | "expense" | "sale" | "receipt", consignmentId: string, childId: string): Promise<void> {
  await guard(session, consignmentId);
  const table = { container: "consignment_container", good: "consignment_container_good", expense: "consignment_expense", sale: "consignment_sale", receipt: "consignment_receipt" }[kind];
  await pg(async (sql) => {
    await sql`update public.${sql(table)} set deleted_at = now() where id = ${childId}::uuid and consignment_id = ${consignmentId}::uuid`;
  });
}

export async function consignmentSummary(session: ErpSession): Promise<Record<string, number>> {
  return pg(async (sql) => {
    const scoped = visibleSql(sql, session);
    const [row] = (await sql`
      select
        count(*)::int as total,
        count(*) filter (where c.status in ('open','in_progress'))::int as active,
        count(*) filter (where c.status in ('completed','closed'))::int as done
      from public.consignment c where c.deleted_at is null and ${scoped}
    `) as unknown as Array<Record<string, number>>;
    return row ?? {};
  });
}
