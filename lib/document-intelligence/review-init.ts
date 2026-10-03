/**
 * Build the review screen's starting state for ONE intake job — pure, shared by the UI and the tests.
 *
 *   saved draft (_review)  ──►  restored exactly (this is how Queue → Open → Edit → Save → Refresh → Reopen
 *                                keeps every correction, account and reference without re-uploading)
 *   no saved draft         ──►  extracted fields + line items, mapped to the form
 *
 * Unfound values stay EMPTY (shown as "Not found"); nothing is invented and no sample data is used.
 */

import type { ReviewContext } from "@/lib/services/document-intake-review-service";
import { EMPTY_ACCOUNT_SELECTION, type IntakeModule, pruneAccountsForModule, type AccountSelection } from "./intake-modules";
import { EMPTY_EXCHANGE, EMPTY_FORM, emptyReview, recomputeExchange, type ReviewForm, type ReviewItem, type ReviewState } from "./review-state";

type FieldRow = { field_key: string; field_label?: string | null; validation_status?: string | null; corrected_value?: string | null; normalized_value?: string | null; raw_value?: string | null; page_number?: number | null; confidence?: number | string | null; verified?: boolean };
type LineRow = Record<string, any>;

export type JobBundle = { job: Record<string, any>; fields: FieldRow[]; lineItems: LineRow[]; draft?: { draft_payload?: Record<string, any> | null; status?: string | null } | null };

export function fieldValue(f: FieldRow | undefined): string {
  if (!f) return "";
  return String(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? "").trim();
}

export function fieldMap(fields: FieldRow[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of fields) m[f.field_key] = fieldValue(f);
  return m;
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export function formFromFields(m: Record<string, string>, job: Record<string, any>): ReviewForm {
  return {
    ...EMPTY_FORM,
    contractNo: m.contract_number || job.contract_reference || "",
    documentDate: m.document_date || "",
    reference: job.document_reference || m.invoice_number || "",
    currency: (m.currency || "").toUpperCase(),
    totalAmount: m.grand_total || m.subtotal || "",
    paymentTerms: m.payment_terms || "",
    deliveryTerms: m.delivery_terms || "",
    incoterm: m.incoterm || "",
    deliveryPlace: m.delivery_place || "",
    quality: m.quality || "",
    packing: m.packing || "",
    hsCode: m.hs_codes || "",
    lotNo: m.lot_number || "",
    variety: m.variety || "",
    goodsDescription: m.goods_description || "",
    grossWeight: m.gross_weight || "",
    tareWeight: m.tare_weight || "",
    netWeight: m.net_weight || "",
    truckNo: m.truck_number || "",
    blNo: m.bl_number || job.bl_reference || "",
    containerNos: m.container_numbers || job.container_reference || "",
    notes: "",
  };
}

export function itemsFromBundle(b: JobBundle, m: Record<string, string>, form: ReviewForm): ReviewItem[] {
  if (b.lineItems.length) {
    return b.lineItems.map((li) => ({
      description: String(li.description ?? ""),
      hsCode: String(li.hs_code ?? ""),
      quantity: n(li.quantity),
      unit: String(li.unit ?? ""),
      unitPrice: n(li.unit_price),
      amount: n(li.amount),
      grossWeight: n(li.gross_weight),
      tareWeight: null,
      netWeight: n(li.net_weight),
      lotNo: form.lotNo,
      variety: form.variety,
      quality: form.quality,
      sourcePage: n(li.page_number),
    }));
  }
  if (m.goods_description || m.quantity || m.unit_price) {
    return [{
      description: m.goods_description || "", hsCode: m.hs_codes || "", quantity: n(m.quantity), unit: m.unit || "", unitPrice: n(m.unit_price),
      amount: n(m.grand_total), grossWeight: n(m.gross_weight), tareWeight: n(m.tare_weight), netWeight: n(m.net_weight),
      lotNo: m.lot_number || "", variety: m.variety || "", quality: m.quality || "", sourcePage: null,
    }];
  }
  return [];
}

/** A single linked account that fits the role is safe to pre-select; several → the reviewer chooses. */
function autoAccounts(mod: IntakeModule, ctx: ReviewContext | null): Partial<AccountSelection> {
  const out: Partial<AccountSelection> = {};
  if (!ctx || !ctx.selectedPartyId) return out;
  const party = ctx.candidates.find((c) => c.id === ctx.selectedPartyId);
  const linked = (party?.accountIds ?? []).filter((id) => ctx.accountOptions.some((a) => a.id === id));
  if (linked.length === 1) {
    if (mod.roles.includes("supplier")) out.supplierAccountId = linked[0];
    if (mod.roles.includes("customer")) out.customerAccountId = linked[0];
  }
  return out;
}

export function initialReview(b: JobBundle, mod: IntakeModule, ctx: ReviewContext | null): ReviewState {
  const saved = (b.draft?.draft_payload?._review ?? null) as Partial<ReviewState> | null;
  const m = fieldMap(b.fields);
  const base = emptyReview(mod.id);

  let state: ReviewState;
  if (saved && typeof saved === "object") {
    state = {
      ...base,
      ...saved,
      moduleId: mod.id,
      form: { ...EMPTY_FORM, ...(saved.form ?? {}) },
      party: { ...base.party, ...(saved.party ?? {}) },
      accounts: pruneAccountsForModule({ ...EMPTY_ACCOUNT_SELECTION, ...(saved.accounts ?? {}) }, mod),
      items: Array.isArray(saved.items) ? (saved.items as ReviewItem[]) : [],
      exchange: { ...EMPTY_EXCHANGE, ...(saved.exchange ?? {}) },
      bank: { ...base.bank, ...(saved.bank ?? {}) },
    };
  } else {
    const form = formFromFields(m, b.job);
    state = {
      ...base,
      form,
      items: itemsFromBundle(b, m, form),
      party: { id: null, kind: null, name: "", documentName: ctx?.documentPartyName ?? "" },
      accounts: pruneAccountsForModule({}, mod),
      exchange: {
        ...EMPTY_EXCHANGE,
        originalAmount: n(form.totalAmount),
        originalCurrency: form.currency,
        finalCurrency: ctx?.rate.baseCurrency ?? form.currency,
      },
      bank: { decision: null, bankId: null },
    };
  }

  // Reconcile with the live context (party / account / rate) without overriding what the reviewer saved.
  if (ctx) {
    state.party.documentName = ctx.documentPartyName ?? state.party.documentName;
    if (!state.party.id && ctx.selectedPartyId) {
      const c = ctx.candidates.find((x) => x.id === ctx.selectedPartyId);
      if (c) state.party = { id: c.id, kind: c.kind, name: c.name, documentName: ctx.documentPartyName ?? "" };
    }
    if (!saved) state.accounts = { ...state.accounts, ...pruneAccountsForModule({ ...state.accounts, ...autoAccounts(mod, ctx) }, mod) };
    const ex = state.exchange;
    if (!saved && ctx.rate.rate != null && ex.originalCurrency && ex.finalCurrency && ex.originalCurrency !== ex.finalCurrency) {
      state.exchange = { ...ex, rate: ctx.rate.rate, rateDate: ctx.rate.rateDate, rateSource: "master", direction: "multiply" };
    }
  }
  state.exchange = recomputeExchange(state.exchange);
  return state;
}

/** Required-for-this-module values still empty — shown as "Not found" and blocking nothing but the reviewer's attention. */
export function missingFields(mod: IntakeModule, s: ReviewState): string[] {
  const out: string[] = [];
  const f = s.form;
  if (!f.contractNo && !f.reference) out.push("contractNo");
  if (!f.documentDate) out.push("documentDate");
  if (mod.party && !s.party.id) out.push("party");
  if (mod.financial) {
    if (!f.currency) out.push("currency");
    if (!f.totalAmount) out.push("totalAmount");
  }
  if (!s.items.length) out.push("items");
  return out;
}
