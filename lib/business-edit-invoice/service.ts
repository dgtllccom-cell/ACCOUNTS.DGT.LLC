import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import { resolveBrandingServer } from "@/lib/branding/server";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import {
  purchaseOrderToTradeInput, salesOrderToTradeInput, localPurchaseToTradeInput,
} from "@/lib/reports/trade-documents/from-transaction";
import type { TradeDocType, TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  BEI_DOC_TYPES, BEI_SOURCE_MODULES, type BeiDocType, type BeiInvoice, type BeiLine,
  type BeiSourceModule, type CreateBeiInput,
} from "./types";
import { canEditInvoice, canManageBusinessEditInvoice, canUseBusinessEditInvoice } from "./access";

export const BEI_TRANSLATABLE_FIELDS = ["party_name", "destination", "notes", "signature_name"];
const ORIGINAL_LANGS: SupportedLanguage[] = ["en", "ur", "ps", "fa", "ar"];

function schemaMissing(e: unknown): boolean {
  const err = e as any;
  return err?.code === "42P01" || /relation "?public\.business_edit_invoice/i.test(String(err?.message || err));
}

export function mapBeiError(e: unknown): { code: string; message: string; status: number; setupPending?: boolean } {
  if (e instanceof ApiClientError) return { code: (e as any).code || "BEI_ERROR", message: e.message, status: (e as any).status || 400 };
  if (schemaMissing(e)) return { code: "SETUP_PENDING", message: "Business Edit Invoice is not set up on this database yet. Run migration 20261023.", status: 200, setupPending: true };
  console.error("[business-edit-invoice]", e instanceof Error ? e.stack || e.message : e);
  const dev = (process.env.APP_ENV || "").toLowerCase() === "development" && e instanceof Error ? ` [dev: ${e.message}]` : "";
  return { code: "BEI_ERROR", message: "Business Edit Invoice is temporarily unavailable." + dev, status: 503 };
}

function assertUse(session: ErpSession) {
  if (!canUseBusinessEditInvoice(session)) {
    throw new ApiClientError("You do not have access to Business Edit Invoice.", { status: 403, code: "FORBIDDEN" });
  }
}

function scopeParams(session: ErpSession, countryId?: string | null, branchId?: string | null) {
  const scope = resolveReportScope(session);
  return enforceScopeFilters(scope, countryId && countryId !== "all" ? countryId : null, branchId && branchId !== "all" ? branchId : null);
}

const SOURCE_TABLE: Record<BeiSourceModule, string> = {
  purchase_booking: "purchase_orders",
  sales_booking: "sales_orders",
  local_sales: "sales_orders",
  local_purchase: "local_purchases",
};

// ── available finalized bills (from the shared bill_expenses register) ──────
export async function listAvailableBills(session: ErpSession, opts: { module?: string; q?: string; countryId?: string; branchId?: string; limit?: number }) {
  assertUse(session);
  const { effectiveCountryId, effectiveBranchId } = scopeParams(session, opts.countryId, opts.branchId);
  const moduleFilter = BEI_SOURCE_MODULES.includes((opts.module ?? "") as BeiSourceModule) ? opts.module : null;
  const q = (opts.q || "").trim();
  const limit = Math.min(Math.max(Number(opts.limit || 300), 1), 1000);

  const rows = await withLocalPg(async (sql) => sql`
    select
      be.source_module, be.source_id, be.source_table, be.bill_no, be.manual_bill_no,
      be.bill_date, be.transaction_date, be.country_id, be.country_branch_id, be.city_branch_id,
      be.party_name, be.currency, be.original_bill_amount, be.source_status,
      c.name as country_name, cb.name as country_branch_name, cib.city_name as city_branch_name,
      (select count(*)::int from public.business_edit_invoices bei
        where bei.source_module = be.source_module and bei.source_id = be.source_id and bei.deleted_at is null) as existing_invoice_count
    from public.bill_expenses be
    left join public.countries c on c.id = be.country_id
    left join public.country_branches cb on cb.id = be.country_branch_id
    left join public.city_branches cib on cib.id = be.city_branch_id
    where be.deleted_at is null and be.eligibility = 'active'
      ${moduleFilter ? sql`and be.source_module = ${moduleFilter}` : sql``}
      ${effectiveCountryId ? sql`and be.country_id = ${effectiveCountryId}` : sql``}
      ${effectiveBranchId ? sql`and be.city_branch_id = ${effectiveBranchId}` : sql``}
      ${q ? sql`and (be.bill_no ilike ${`%${q}%`} or be.manual_bill_no ilike ${`%${q}%`} or be.party_name ilike ${`%${q}%`})` : sql``}
    order by be.transaction_date desc nulls last, be.created_at desc
    limit ${limit}
  `);

  return (rows ?? []).map((r: any) => ({
    sourceModule: r.source_module as BeiSourceModule,
    sourceId: r.source_id,
    sourceTable: r.source_table,
    billNo: r.bill_no,
    manualBillNo: r.manual_bill_no,
    billDate: r.bill_date,
    transactionDate: r.transaction_date,
    countryId: r.country_id,
    countryName: r.country_name,
    countryBranchId: r.country_branch_id,
    cityBranchId: r.city_branch_id,
    branchLabel: r.city_branch_name || r.country_branch_name || r.country_name || "—",
    partyName: r.party_name,
    currency: r.currency,
    originalBillAmount: Number(r.original_bill_amount || 0),
    sourceStatus: r.source_status,
    existingInvoiceCount: Number(r.existing_invoice_count || 0),
  }));
}

// ── map a source record → the fields we snapshot into a BEI ────────────────
function mapSourceRecord(sourceModule: BeiSourceModule, rec: any, docType: TradeDocType): TradeDocumentInput {
  const emptyBranding = { entityName: null, legalName: null, logoUrl: null, stampUrl: null, letterheadUrl: null,
    reportHeader: null, address: null, phone: null, email: null, website: null, registrationNumber: null,
    taxNumber: null, countryName: null, branchName: null, baseCurrency: null, bank: null } as any;
  const opts = { docType, lang: "en" as SupportedLanguage, branding: emptyBranding };
  if (sourceModule === "purchase_booking") return purchaseOrderToTradeInput(rec, opts);
  if (sourceModule === "local_purchase") return localPurchaseToTradeInput(rec, opts);
  return salesOrderToTradeInput(rec, opts); // sales_booking + local_sales
}

async function loadSource(sourceModule: BeiSourceModule, sourceId: string) {
  const table = SOURCE_TABLE[sourceModule];
  return withLocalPg(async (sql) => {
    const r = (await sql`select * from public.${sql(table)} where id = ${sourceId}::uuid and deleted_at is null limit 1`) as any[];
    return r[0] ?? null;
  });
}

// ── create an editable invoice FROM a finalized bill (no source write) ─────
export async function createFromBill(session: ErpSession, input: CreateBeiInput): Promise<BeiInvoice> {
  assertUse(session);
  const sourceModule = input.sourceModule;
  if (!BEI_SOURCE_MODULES.includes(sourceModule)) throw new ApiClientError("Unknown source module.", { status: 400, code: "VALIDATION" });
  const docType: BeiDocType = BEI_DOC_TYPES.includes(input.docType as BeiDocType) ? (input.docType as BeiDocType) : "commercial_invoice";
  const lang = (ORIGINAL_LANGS.includes(input.lang as SupportedLanguage) ? input.lang : "en") as SupportedLanguage;

  const src = await loadSource(sourceModule, input.sourceId);
  if (!src) throw new ApiClientError("Original bill not found.", { status: 404, code: "NOT_FOUND" });

  // scope check on the source
  const { effectiveCountryId, effectiveBranchId } = scopeParams(session);
  if (effectiveCountryId && src.country_id && src.country_id !== effectiveCountryId) {
    throw new ApiClientError("This bill is outside your scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }
  if (effectiveBranchId && src.city_branch_id && src.city_branch_id !== effectiveBranchId) {
    throw new ApiClientError("This bill is outside your branch scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }

  const mapped = mapSourceRecord(sourceModule, src, docType);
  const txnKind = sourceModule.includes("sales") ? "sales" : "purchase";
  const currency = mapped.currency || src.currency_code || src.purchase_currency || "USD";
  const originalTotal = Number(mapped.totals?.grandTotal ?? src.order_total ?? src.final_cost ?? 0) || null;

  const billNo = src.purchase_order_no || src.sales_order_no || src.manual_bill_no || null;
  const billDate = (mapped.docDate ? String(mapped.docDate).slice(0, 10) : null) || (src.created_at ? String(src.created_at).slice(0, 10) : null);

  const row = await withLocalPg(async (sql) => {
    const inserted = (await sql`
      insert into public.business_edit_invoices (
        source_module, source_id, source_table, original_bill_no, original_manual_bill_no,
        original_bill_date, original_currency, original_exchange_rate, original_total_value,
        doc_type, document_currency, document_exchange_rate, document_total_value, document_date,
        country_id, country_branch_id, city_branch_id, company_id,
        txn_kind, trade_scope, party_name, party_details, seller, buyer, notify_party,
        destination, incoterms, payment_terms, transport, reference_nos,
        original_language_code, created_by
      ) values (
        ${sourceModule}, ${input.sourceId}::uuid, ${SOURCE_TABLE[sourceModule]},
        ${billNo}, ${src.manual_bill_no ?? null},
        ${billDate}, ${currency}, ${mapped.exchangeRate ?? src.exchange_rate ?? null}, ${originalTotal},
        ${docType}, ${currency}, ${mapped.exchangeRate ?? src.exchange_rate ?? null}, ${originalTotal}, ${billDate},
        ${src.country_id ?? null}, ${src.country_branch_id ?? null}, ${src.city_branch_id ?? null},
        ${src.company_id ?? src.supplier_company_id ?? null},
        ${txnKind}, ${mapped.tradeScope},
        ${txnKind === "sales" ? (mapped.buyer?.name ?? src.customer_name ?? null) : (mapped.seller?.name ?? src.supplier_name ?? null)},
        ${JSON.stringify(txnKind === "sales" ? mapped.buyer ?? {} : mapped.seller ?? {})}::jsonb,
        ${JSON.stringify(mapped.seller ?? {})}::jsonb, ${JSON.stringify(mapped.buyer ?? {})}::jsonb, ${null},
        ${mapped.transport?.finalDestination ?? mapped.transport?.portOfDischarge ?? null},
        ${mapped.delivery?.incoterms ?? null}, ${mapped.delivery?.paymentTerms ?? null},
        ${JSON.stringify(mapped.transport ?? null)}::jsonb, ${JSON.stringify(mapped.referenceNos ?? {})}::jsonb,
        ${lang}, ${session.userId ?? null}
      ) returning *
    `) as any[];
    const inv = inserted[0];

    // lines — original prices frozen; document prices seeded equal, user edits later
    let sort = 0;
    for (const g of mapped.goods ?? []) {
      await sql`
        insert into public.business_edit_invoice_lines (
          invoice_id, sort_order, goods_name, description, hs_code, brand, size, packing,
          packages, quantity, unit, net_weight, gross_weight,
          original_unit_price, original_amount, document_unit_price, document_amount
        ) values (
          ${inv.id}::uuid, ${sort++}, ${g.description ?? null}, ${g.description ?? null}, ${g.hsCode ?? null},
          ${g.brand ?? null}, ${g.size ?? null}, ${g.packing ?? null},
          ${g.packages ?? null}, ${g.quantity ?? null}, ${g.unit ?? null}, ${g.netWeight ?? null}, ${g.grossWeight ?? null},
          ${g.unitPrice ?? null}, ${g.amount ?? null}, ${g.unitPrice ?? null}, ${g.amount ?? null}
        )
      `;
    }
    await sql`
      insert into public.business_edit_invoice_versions (invoice_id, version_no, snapshot, document_total_value, changed_by, note)
      values (${inv.id}::uuid, 1, ${JSON.stringify({ header: inv, lines: mapped.goods })}::jsonb, ${originalTotal}, ${session.userId ?? null}, 'created from bill')
    `;
    return inv;
  });

  if (!row) throw new ApiClientError("Could not create the invoice.", { status: 500, code: "DB" });

  // translated views for the register (party/destination/notes) — never blocks the create
  try {
    await translateMasterRecord("business_edit_invoices", row.id, {
      party_name: row.party_name, destination: row.destination, notes: row.notes,
    }, lang, session.userId ?? null);
  } catch { /* non-fatal */ }

  return getInvoice(session, row.id, { original: true });
}

// ── read one invoice (+ lines) ────────────────────────────────────────────
export async function getInvoice(session: ErpSession, id: string, opts: { lang?: string; original?: boolean } = {}): Promise<BeiInvoice> {
  assertUse(session);
  const data = await withLocalPg(async (sql) => {
    const h = (await sql`select * from public.business_edit_invoices where id = ${id}::uuid and deleted_at is null`) as any[];
    if (!h.length) return null;
    const lines = (await sql`select * from public.business_edit_invoice_lines where invoice_id = ${id}::uuid order by sort_order`) as any[];
    return { header: h[0], lines };
  });
  if (!data) throw new ApiClientError("Invoice not found.", { status: 404, code: "NOT_FOUND" });

  const { effectiveCountryId, effectiveBranchId } = scopeParams(session);
  if (effectiveCountryId && data.header.country_id && data.header.country_id !== effectiveCountryId) {
    throw new ApiClientError("This invoice is outside your scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }
  if (effectiveBranchId && data.header.city_branch_id && data.header.city_branch_id !== effectiveBranchId) {
    throw new ApiClientError("This invoice is outside your branch scope.", { status: 403, code: "OUT_OF_SCOPE" });
  }

  let h = data.header;
  const lang = (opts.lang || "en") as SupportedLanguage;
  if (!opts.original && lang !== "en") {
    const [loc] = await localizeRecordFields([h], "business_edit_invoices", BEI_TRANSLATABLE_FIELDS, lang);
    h = { ...h, ...loc };
  }

  return toInvoiceDto(h, data.lines, {
    canEdit: canEditInvoice(session, h),
    isManager: canManageBusinessEditInvoice(session),
  });
}

function toInvoiceDto(h: any, lines: any[], extra: Partial<BeiInvoice> = {}): BeiInvoice {
  return {
    id: h.id,
    invoiceNo: h.invoice_no,
    sourceModule: h.source_module,
    sourceId: h.source_id,
    sourceTable: h.source_table,
    originalBillNo: h.original_bill_no,
    originalManualBillNo: h.original_manual_bill_no,
    originalBillDate: h.original_bill_date,
    originalCurrency: h.original_currency,
    originalExchangeRate: h.original_exchange_rate != null ? Number(h.original_exchange_rate) : null,
    originalTotalValue: h.original_total_value != null ? Number(h.original_total_value) : null,
    docType: h.doc_type,
    documentNo: h.document_no,
    documentDate: h.document_date,
    documentCurrency: h.document_currency,
    documentExchangeRate: h.document_exchange_rate != null ? Number(h.document_exchange_rate) : null,
    documentTotalValue: h.document_total_value != null ? Number(h.document_total_value) : null,
    countryId: h.country_id, countryBranchId: h.country_branch_id, cityBranchId: h.city_branch_id, companyId: h.company_id,
    txnKind: h.txn_kind, tradeScope: h.trade_scope,
    partyName: h.party_name,
    partyDetails: h.party_details ?? {},
    consignee: h.consignee ?? null, notifyParty: h.notify_party ?? null, seller: h.seller ?? null, buyer: h.buyer ?? null,
    destination: h.destination, incoterms: h.incoterms, paymentTerms: h.payment_terms,
    transport: h.transport ?? null, bank: h.bank ?? null, referenceNos: h.reference_nos ?? {},
    notes: h.notes, validity: h.validity, signatureName: h.signature_name, headerFields: h.header_fields ?? {},
    originalLanguageCode: h.original_language_code,
    status: h.status, versionNo: h.version_no,
    createdBy: h.created_by, createdAt: h.created_at, updatedAt: h.updated_at,
    lines: (lines ?? []).map((l): BeiLine => ({
      id: l.id, sortOrder: l.sort_order, goodsName: l.goods_name, description: l.description, hsCode: l.hs_code,
      brand: l.brand, size: l.size, packing: l.packing,
      packages: numOrNull(l.packages), quantity: numOrNull(l.quantity), unit: l.unit,
      netWeight: numOrNull(l.net_weight), grossWeight: numOrNull(l.gross_weight),
      originalUnitPrice: numOrNull(l.original_unit_price), originalAmount: numOrNull(l.original_amount),
      documentUnitPrice: numOrNull(l.document_unit_price), documentAmount: numOrNull(l.document_amount),
    })),
    ...extra,
  };
}
const numOrNull = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

// ── list the register ─────────────────────────────────────────────────────
export async function listInvoices(session: ErpSession, opts: { q?: string; docType?: string; status?: string; countryId?: string; branchId?: string; lang?: string; original?: boolean; limit?: number }) {
  assertUse(session);
  const { effectiveCountryId, effectiveBranchId } = scopeParams(session, opts.countryId, opts.branchId);
  const q = (opts.q || "").trim();
  const limit = Math.min(Math.max(Number(opts.limit || 300), 1), 1000);

  let rows = await withLocalPg(async (sql) => sql`
    select bei.*, cib.city_name as city_branch_name, cb.name as country_branch_name, c.name as country_name
    from public.business_edit_invoices bei
    left join public.countries c on c.id = bei.country_id
    left join public.country_branches cb on cb.id = bei.country_branch_id
    left join public.city_branches cib on cib.id = bei.city_branch_id
    where bei.deleted_at is null
      ${opts.docType && BEI_DOC_TYPES.includes(opts.docType as BeiDocType) ? sql`and bei.doc_type = ${opts.docType}` : sql``}
      ${opts.status && ["draft","finalized","void"].includes(opts.status) ? sql`and bei.status = ${opts.status}` : sql``}
      ${effectiveCountryId ? sql`and bei.country_id = ${effectiveCountryId}` : sql``}
      ${effectiveBranchId ? sql`and bei.city_branch_id = ${effectiveBranchId}` : sql``}
      ${q ? sql`and (bei.invoice_no ilike ${`%${q}%`} or bei.original_bill_no ilike ${`%${q}%`} or bei.party_name ilike ${`%${q}%`} or bei.document_no ilike ${`%${q}%`})` : sql``}
    order by bei.created_at desc
    limit ${limit}
  `) as any[] | null;
  rows = rows ?? [];

  const lang = (opts.lang || "en") as SupportedLanguage;
  if (!opts.original && lang !== "en" && rows.length) {
    rows = await localizeRecordFields(rows, "business_edit_invoices", BEI_TRANSLATABLE_FIELDS, lang) as any[];
  }

  return rows.map((r: any) => ({
    ...toInvoiceDto(r, []),
    branchLabel: r.city_branch_name || r.country_branch_name || r.country_name || "—",
  }));
}

// ── EDIT (document layer only — NEVER touches the source) ──────────────────
export async function updateInvoice(session: ErpSession, id: string, patch: any): Promise<BeiInvoice> {
  assertUse(session);
  const current = await withLocalPg(async (sql) => {
    const r = (await sql`select * from public.business_edit_invoices where id = ${id}::uuid and deleted_at is null`) as any[];
    return r[0] ?? null;
  });
  if (!current) throw new ApiClientError("Invoice not found.", { status: 404, code: "NOT_FOUND" });
  if (!canEditInvoice(session, current)) throw new ApiClientError("You cannot edit this invoice.", { status: 403, code: "FORBIDDEN" });

  const H: Record<string, any> = {};
  const setIf = (col: string, val: any) => { if (val !== undefined) H[col] = val; };
  setIf("doc_type", BEI_DOC_TYPES.includes(patch.docType) ? patch.docType : undefined);
  setIf("document_no", patch.documentNo);
  setIf("document_date", patch.documentDate);
  setIf("document_currency", patch.documentCurrency);
  setIf("document_exchange_rate", patch.documentExchangeRate);
  // when line edits are supplied, the document total is ALWAYS recomputed from the
  // edited line amounts below — never trust a client-sent total in that case.
  if (!Array.isArray(patch.lines)) setIf("document_total_value", patch.documentTotalValue);
  setIf("party_name", patch.partyName);
  setIf("destination", patch.destination);
  setIf("incoterms", patch.incoterms);
  setIf("payment_terms", patch.paymentTerms);
  setIf("notes", patch.notes);
  setIf("validity", patch.validity);
  setIf("signature_name", patch.signatureName);
  setIf("company_id", patch.companyId);
  setIf("trade_scope", ["local", "international"].includes(patch.tradeScope) ? patch.tradeScope : undefined);
  for (const j of ["party_details", "consignee", "notify_party", "seller", "buyer", "transport", "bank", "reference_nos", "header_fields"]) {
    const camel = j.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (patch[camel] !== undefined) H[j] = JSON.stringify(patch[camel]);
  }

  const nextVersion = Number(current.version_no || 1) + 1;

  const updated = await withLocalPg(async (sql) => {
    let h = current;
    if (Object.keys(H).length) {
      const cols = Object.keys(H);
      const sets = cols.map((c, i) => `${c} = $${i + 2}${["party_details","consignee","notify_party","seller","buyer","transport","bank","reference_nos","header_fields"].includes(c) ? "::jsonb" : ""}`);
      const res = (await sql.unsafe(
        `update public.business_edit_invoices set ${sets.join(", ")}, version_no = ${nextVersion}, updated_by = ${session.userId ? `'${session.userId}'` : "null"} where id = $1::uuid returning *`,
        [id, ...cols.map((c) => H[c])],
      )) as any[];
      h = res[0];
    }

    // line edits — the ORIGINAL (frozen) unit price / amount are NEVER taken from
    // the client: they are preserved from the pre-edit row at the same position.
    if (Array.isArray(patch.lines)) {
      const prevLines = (await sql`select * from public.business_edit_invoice_lines where invoice_id = ${id}::uuid order by sort_order`) as any[];
      await sql`delete from public.business_edit_invoice_lines where invoice_id = ${id}::uuid`;
      let sort = 0;
      for (const l of patch.lines) {
        const prev = prevLines[sort] ?? null;
        const dQty = l.quantity == null || l.quantity === "" ? null : Number(l.quantity);
        const dPrice = l.documentUnitPrice == null || l.documentUnitPrice === "" ? null : Number(l.documentUnitPrice);
        // server is authoritative: document_amount = document unit price × quantity whenever
        // both are known — a stale client-sent documentAmount is never trusted.
        const dAmount = dPrice != null && dQty != null
          ? Number((dPrice * dQty).toFixed(4))
          : (l.documentAmount == null || l.documentAmount === "" ? null : Number(l.documentAmount));
        // frozen originals come ONLY from the pre-edit row; a line the user adds for
        // the document has no "original" price (null) — the client can never set it.
        const origPrice = prev ? prev.original_unit_price : null;
        const origAmount = prev ? prev.original_amount : null;
        await sql`
          insert into public.business_edit_invoice_lines (
            invoice_id, sort_order, goods_name, description, hs_code, brand, size, packing,
            packages, quantity, unit, net_weight, gross_weight,
            original_unit_price, original_amount, document_unit_price, document_amount
          ) values (
            ${id}::uuid, ${sort++}, ${l.goodsName ?? null}, ${l.description ?? null}, ${l.hsCode ?? null},
            ${l.brand ?? null}, ${l.size ?? null}, ${l.packing ?? null},
            ${l.packages ?? null}, ${dQty}, ${l.unit ?? null}, ${l.netWeight ?? null}, ${l.grossWeight ?? null},
            ${origPrice}, ${origAmount},
            ${dPrice},
            ${dAmount}
          )
        `;
      }
    }

    const lines = (await sql`select * from public.business_edit_invoice_lines where invoice_id = ${id}::uuid order by sort_order`) as any[];
    const lineSum = lines.reduce((s, l) => s + (Number(l.document_amount) || 0), 0);
    // line edits → recompute from lines; header-only edit → keep the stored/explicit total
    const docTotal = Array.isArray(patch.lines)
      ? (lines.length ? lineSum : (h.document_total_value ?? null))
      : (h.document_total_value ?? lineSum);
    if (docTotal != null && Number(docTotal) !== Number(h.document_total_value ?? -1)) {
      await sql`update public.business_edit_invoices set document_total_value = ${docTotal} where id = ${id}::uuid`;
      h.document_total_value = docTotal;
    }

    await sql`
      insert into public.business_edit_invoice_versions (invoice_id, version_no, snapshot, document_total_value, changed_by, note)
      values (${id}::uuid, ${nextVersion}, ${JSON.stringify({ header: h, lines })}::jsonb, ${h.document_total_value ?? null}, ${session.userId ?? null}, ${patch.versionNote ?? "edited"})
    `;
    await sql`
      insert into public.business_edit_invoice_events (invoice_id, event_type, detail, actor_id, actor_name)
      values (${id}::uuid, 'edited',
        ${JSON.stringify({ version: nextVersion, original_total: current.original_total_value, document_total: h.document_total_value })}::jsonb,
        ${session.userId ?? null}, ${session.fullName ?? session.email ?? null})
    `;
    return { header: h, lines };
  });

  if (!updated) throw new ApiClientError("Update failed.", { status: 500, code: "DB" });
  try {
    await translateMasterRecord("business_edit_invoices", id, {
      party_name: updated.header.party_name, destination: updated.header.destination, notes: updated.header.notes,
    }, updated.header.original_language_code || "en", session.userId ?? null);
  } catch { /* non-fatal */ }

  return getInvoice(session, id, { original: true });
}

export async function setStatus(session: ErpSession, id: string, status: "draft" | "finalized" | "void"): Promise<BeiInvoice> {
  assertUse(session);
  if (!["draft", "finalized", "void"].includes(status)) throw new ApiClientError("Bad status.", { status: 400, code: "VALIDATION" });
  if (!canManageBusinessEditInvoice(session) && status !== "draft") {
    throw new ApiClientError("Only a manager can finalize or void a document.", { status: 403, code: "FORBIDDEN" });
  }
  await withLocalPg(async (sql) => {
    const r = (await sql`update public.business_edit_invoices set status = ${status} where id = ${id}::uuid and deleted_at is null returning id`) as any[];
    if (!r.length) throw new ApiClientError("Invoice not found.", { status: 404, code: "NOT_FOUND" });
    await sql`insert into public.business_edit_invoice_events (invoice_id, event_type, detail, actor_id, actor_name)
             values (${id}::uuid, ${status === "finalized" ? "finalized" : status === "void" ? "voided" : "reopened"}, '{}'::jsonb, ${session.userId ?? null}, ${session.fullName ?? session.email ?? null})`;
  });
  return getInvoice(session, id, { original: true });
}

export async function getVersions(session: ErpSession, id: string) {
  await getInvoice(session, id, { original: true }); // scope guard
  const rows = await withLocalPg(async (sql) => sql`
    select v.version_no, v.document_total_value, v.changed_at, v.note, v.changed_by, p.full_name as changed_by_name
    from public.business_edit_invoice_versions v
    left join public.profiles p on p.id = v.changed_by
    where v.invoice_id = ${id}::uuid order by v.version_no desc
  `);
  return (rows ?? []).map((r: any) => ({
    versionNo: r.version_no, documentTotalValue: r.document_total_value != null ? Number(r.document_total_value) : null,
    changedAt: r.changed_at, note: r.note, changedByName: r.changed_by_name || "—",
  }));
}

export async function auditTrail(session: ErpSession, id: string) {
  await getInvoice(session, id, { original: true });
  const rows = await withLocalPg(async (sql) => sql`
    select event_type, detail, actor_name, created_at
    from public.business_edit_invoice_events where invoice_id = ${id}::uuid order by created_at desc limit 200
  `);
  return (rows ?? []).map((r: any) => ({ type: r.event_type, detail: r.detail ?? {}, actor: r.actor_name || "—", at: r.created_at }));
}

// Branding is resolved via the shared server resolver (lib/branding/server.ts) —
// same country_company_profiles source + per-branch overlay used everywhere.

// ── render the document (uses the EDITED values + branch/company branding) ──
export async function renderDocumentHtml(session: ErpSession, id: string, lang: SupportedLanguage): Promise<{ html: string; title: string }> {
  const inv = await getInvoice(session, id, { original: true });

  const branding = await resolveBrandingServer({
    countryId: inv.countryId,
    countryBranchId: inv.countryBranchId,
    cityBranchId: inv.cityBranchId,
  });

  await withLocalPg(async (sql) => {
    await sql`insert into public.business_edit_invoice_events (invoice_id, event_type, detail, actor_id, actor_name)
             values (${id}::uuid, 'printed', ${JSON.stringify({ lang })}::jsonb, ${session.userId ?? null}, ${session.fullName ?? session.email ?? null})`;
  });

  const goods = inv.lines.map((l) => ({
    description: l.description || l.goodsName,
    hsCode: l.hsCode, brand: l.brand, size: l.size, packing: l.packing,
    packages: l.packages ?? undefined, quantity: l.quantity ?? undefined, unit: l.unit,
    unitPrice: l.documentUnitPrice ?? undefined, // ← the EDITED price
    netWeight: l.netWeight ?? undefined, grossWeight: l.grossWeight ?? undefined,
    amount: l.documentAmount ?? undefined,
  }));
  const subTotal = goods.reduce((s, g) => s + (Number(g.amount) || 0), 0);

  const input: TradeDocumentInput = {
    docType: inv.docType as TradeDocType,
    txnKind: inv.txnKind,
    tradeScope: inv.tradeScope,
    lang,
    branding,
    docNo: inv.documentNo || inv.invoiceNo,
    docDate: inv.documentDate,
    referenceNos: {
      ...(inv.referenceNos as any),
      invoice: inv.originalBillNo || inv.originalManualBillNo || (inv.referenceNos as any)?.invoice,
    },
    seller: (inv.seller as any) || (inv.txnKind === "purchase" ? { name: inv.partyName } : { name: branding.entityName }),
    buyer: (inv.buyer as any) || (inv.txnKind === "sales" ? { name: inv.partyName } : { name: branding.entityName }),
    notifyParty: (inv.notifyParty as any) ?? null,
    delivery: { incoterms: inv.incoterms, paymentTerms: inv.paymentTerms },
    transport: (inv.transport as any) ?? null,
    goods,
    currency: inv.documentCurrency || inv.originalCurrency || "USD",
    exchangeRate: inv.documentExchangeRate ?? undefined,
    totals: {
      subTotal: subTotal || undefined,
      grandTotal: inv.documentTotalValue ?? subTotal ?? undefined,
      totalQuantity: goods.reduce((s, g) => s + (Number(g.quantity) || 0), 0) || undefined,
      totalNetWeight: goods.reduce((s, g) => s + (Number(g.netWeight) || 0), 0) || undefined,
      totalGrossWeight: goods.reduce((s, g) => s + (Number(g.grossWeight) || 0), 0) || undefined,
      totalPackages: goods.reduce((s, g) => s + (Number(g.packages) || 0), 0) || undefined,
    },
    bank: (inv.bank as any) ?? null,
    validity: inv.validity,
    notes: inv.notes,
    signatureName: inv.signatureName,
    orientation: "portrait",
  };

  const html = buildTradeDocumentHtml(input);
  return { html, title: `${inv.invoiceNo}` };
}

export async function deleteInvoice(session: ErpSession, id: string) {
  assertUse(session);
  if (!canManageBusinessEditInvoice(session)) throw new ApiClientError("Only a manager can delete a document.", { status: 403, code: "FORBIDDEN" });
  await withLocalPg(async (sql) => {
    const r = (await sql`update public.business_edit_invoices set deleted_at = now() where id = ${id}::uuid and deleted_at is null returning id`) as any[];
    if (!r.length) throw new ApiClientError("Invoice not found.", { status: 404, code: "NOT_FOUND" });
  });
  return { ok: true };
}
