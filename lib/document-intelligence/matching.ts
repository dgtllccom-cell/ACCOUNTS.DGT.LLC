/**
 * AI Document Intake — scope-constrained master / source-record matching.
 *
 * Rules:
 *   * Match ONLY within the authorized operational domain + country + branch +
 *     (shipping) agent scope.
 *   * NEVER match on Contract Number alone. A single contract/order signal is
 *     capped below the auto-link threshold; a real match needs the scope PLUS a
 *     composite of {booking/PO/SO/BL number, party name, amount, container,
 *     currency}.
 *   * A Dubai CON-1001 and a Pakistan CON-1001 are different records — the
 *     country filter separates them and the composite score keeps them apart
 *     even for a global user.
 *   * If a reference was read but nothing safe is found in scope → status
 *     'out_of_scope' (the caller routes to QVC and shows NO_MATCH_MESSAGE);
 *     the document is NOT attached.
 */

import { withLocalPg } from "@/lib/db/local-postgres";
import type { FieldCandidate } from "./types";
import type { IntakeScope } from "./scope";

export type MatchCandidate = {
  matchKind: "source_record" | "company" | "customer" | "account";
  sourceModule: string;
  sourceId: string;
  label: string;
  score: number;
  scopeOk: boolean;
  reason: string;
  isSelected?: boolean;
};

// Document type → General-Office master to search for an existing record so the
// user can Link / Update rather than create a duplicate. The AI only suggests.
const MASTER_DOCS: Record<string, { table: string; kind: MatchCandidate["matchKind"]; module: string }> = {
  company_registration: { table: "companies", kind: "company", module: "companies" },
  bank_account_document: { table: "banks", kind: "account", module: "banks" },
  kyc_document: { table: "customers", kind: "customer", module: "customers" },
  service_agreement: { table: "companies", kind: "company", module: "companies" },
};

export type MatchOutcome = {
  status: "none" | "auto" | "ambiguous" | "out_of_scope";
  matchedModule: string | null;
  matchedId: string | null;
  matchedScore: number | null;
  reason: string | null;
  candidates: MatchCandidate[];
};

function fv(fields: FieldCandidate[], key: string): string | null {
  const f = fields.find((x) => x.key === key);
  return (f?.normalizedValue || f?.rawValue || null)?.toString().trim() || null;
}
function num(s: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function norm(s: string | null | undefined): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const PURCHASE_DOCS = ["purchase_contract", "purchase_booking", "purchase_order", "proforma_invoice", "commercial_invoice", "packing_list", "loading_document", "receiving_document", "advance_receipt", "payment_confirmation"];
const SALES_DOCS = ["sales_contract", "sales_booking", "sales_order", "customer_po", "sales_invoice", "delivery_note", "sales_receipt", "payment_confirmation", "dispatch_document"];
const BL_DOCS = ["bill_of_lading", "house_bl", "master_bl", "air_waybill", "shipping_booking"];

export async function runScopedMatching(input: {
  job: any;
  scope: IntakeScope;
  docTypeCode: string;
  fields: FieldCandidate[];
}): Promise<MatchOutcome> {
  const { job, scope, docTypeCode, fields } = input;
  const domain = job.operational_domain as "business" | "shipping";

  const contract = norm(fv(fields, "contract_number") || fv(fields, "manual_contract_number") || job.contract_reference);
  const booking = norm(fv(fields, "booking_number"));
  const poNo = norm(fv(fields, "po_number"));
  const soNo = norm(fv(fields, "so_number"));
  const blNo = norm(fv(fields, "bl_number") || job.bl_reference);
  const containers = (fv(fields, "container_numbers") || job.container_reference || "").split(/[, ]+/).map(norm).filter(Boolean);
  const party = (fv(fields, "supplier_name") || fv(fields, "customer_name") || fv(fields, "shipper") || fv(fields, "consignee") || "").toUpperCase();
  const total = num(fv(fields, "grand_total"));
  const currency = (fv(fields, "currency") || "").toUpperCase();

  const masterDoc = MASTER_DOCS[docTypeCode];

  // Master-data documents (Company / Bank / KYC / Contract) — search the existing
  // master for a likely duplicate so the user can Link / Update instead of
  // creating a new record. Runs even when no trade reference is present.
  if (masterDoc) {
    const candidates: MatchCandidate[] = [];
    const nameSig = (fv(fields, "company_name") || fv(fields, "account_title") || fv(fields, "customer_name")
      || fv(fields, "contract_parties") || fv(fields, "supplier_name") || "").toUpperCase().replace(/\s+/g, " ").trim();
    const regSig = norm(fv(fields, "registration_number"));
    const trnSig = norm(fv(fields, "trn"));
    const acctSig = norm(fv(fields, "account_number"));
    const ibanSig = norm(fv(fields, "iban"));
    const idSig = norm(fv(fields, "national_id"));

    await withLocalPg(async (sql) => {
      const scopeCountry = scope.countryIds === null ? sql`TRUE` : sql`(t.country_id = ANY(${scope.countryIds}) OR t.country_id IS NULL)`;
      if (masterDoc.table === "companies") {
        const rows = await sql`
          SELECT t.id, t.name, t.legal_name, t.company_code, t.registrations, t.country_id
          FROM public.companies t
          WHERE t.deleted_at IS NULL AND ${scopeCountry}
            AND (${nameSig ? sql`(upper(t.name) LIKE ${"%" + nameSig.slice(0, 14) + "%"} OR upper(coalesce(t.legal_name,'')) LIKE ${"%" + nameSig.slice(0, 14) + "%"})` : sql`FALSE`}
                 ${regSig ? sql`OR t.registrations::text ILIKE ${"%" + regSig + "%"}` : sql``})
          LIMIT 15`;
        for (const r of rows ?? []) {
          const nm = String(r.name || r.legal_name || "").toUpperCase();
          let score = 0; const rs: string[] = [];
          if (nameSig && nm && (nm.includes(nameSig.slice(0, 12)) || nameSig.includes(nm.slice(0, 12)))) { score += 0.55; rs.push("company name"); }
          if (regSig && String(r.registrations || "").toUpperCase().replace(/[^A-Z0-9]/g, "").includes(regSig)) { score += 0.4; rs.push("registration no"); }
          if (trnSig && String(r.registrations || "").toUpperCase().replace(/[^A-Z0-9]/g, "").includes(trnSig)) { score += 0.35; rs.push("TRN"); }
          candidates.push({ matchKind: "company", sourceModule: "companies", sourceId: r.id, score: Math.min(1, Number(score.toFixed(2))), scopeOk: true,
            label: `${r.name || r.legal_name}${r.company_code ? ` · ${r.company_code}` : ""}`, reason: rs.length ? `Matched on: ${rs.join(", ")}` : "Name similarity" });
        }
      } else if (masterDoc.table === "banks") {
        const rows = await sql`
          SELECT t.id, t.bank_name, t.account_title, t.account_number, t.iban_number, t.account_code, t.country_id
          FROM public.banks t
          WHERE t.deleted_at IS NULL AND ${scopeCountry}
            AND (${acctSig ? sql`regexp_replace(coalesce(t.account_number,''),'[^0-9]','','g') = ${acctSig}` : sql`FALSE`}
                 ${ibanSig ? sql`OR upper(regexp_replace(coalesce(t.iban_number,''),'[^A-Z0-9]','','g')) = ${ibanSig}` : sql``}
                 ${nameSig ? sql`OR upper(coalesce(t.account_title,'')) LIKE ${"%" + nameSig.slice(0, 14) + "%"}` : sql``})
          LIMIT 15`;
        for (const r of rows ?? []) {
          let score = 0; const rs: string[] = [];
          if (ibanSig && norm(r.iban_number) === ibanSig) { score += 0.7; rs.push("IBAN"); }
          if (acctSig && String(r.account_number || "").replace(/[^0-9]/g, "") === acctSig) { score += 0.6; rs.push("account number"); }
          if (nameSig && String(r.account_title || "").toUpperCase().includes(nameSig.slice(0, 12))) { score += 0.2; rs.push("account title"); }
          candidates.push({ matchKind: "account", sourceModule: "banks", sourceId: r.id, score: Math.min(1, Number(score.toFixed(2))), scopeOk: true,
            label: `${r.bank_name} · ${r.account_title || r.account_number}${r.account_code ? ` (${r.account_code})` : ""}`, reason: rs.length ? `Matched on: ${rs.join(", ")}` : "Weak match" });
        }
      } else if (masterDoc.table === "customers") {
        const rows = await sql`
          SELECT t.id, t.customer_name, t.company_name, t.father_name, t.person_code, t.country_id
          FROM public.customers t
          WHERE t.deleted_at IS NULL AND ${scopeCountry}
            AND ${nameSig ? sql`upper(coalesce(t.customer_name, t.company_name, '')) LIKE ${"%" + nameSig.slice(0, 14) + "%"}` : sql`FALSE`}
          LIMIT 15`;
        for (const r of rows ?? []) {
          const nm = String(r.customer_name || r.company_name || "").toUpperCase();
          let score = 0; const rs: string[] = [];
          if (nameSig && nm && (nm.includes(nameSig.slice(0, 12)) || nameSig.includes(nm.slice(0, 12)))) { score += 0.55; rs.push("name"); }
          candidates.push({ matchKind: "customer", sourceModule: "customers", sourceId: r.id, score: Math.min(1, Number(score.toFixed(2))), scopeOk: true,
            label: `${r.customer_name || r.company_name}${r.person_code ? ` · ${r.person_code}` : ""}`, reason: rs.length ? `Matched on: ${rs.join(", ")}` : "Name similarity" });
        }
      }
    });

    const sorted = candidates.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
    if (sorted.length === 0) {
      return { status: "none", matchedModule: null, matchedId: null, matchedScore: null,
        reason: "No existing master record matched — the reviewed draft will be for a NEW record.", candidates: [] };
    }
    // Never auto-link a master; always present it for the user to confirm.
    return { status: "ambiguous", matchedModule: sorted[0].sourceModule, matchedId: null, matchedScore: sorted[0].score,
      reason: `${sorted.length} possible existing ${masterDoc.table.replace(/s$/, "")} record(s) — review and choose Link / Update / Create-new.`,
      candidates: sorted.slice(0, 10) };
  }

  const anyRef = Boolean(contract || booking || poNo || soNo || blNo || containers.length || job.purchase_order_id || job.sales_order_id);
  if (!anyRef) {
    return {
      status: "none", matchedModule: null, matchedId: null, matchedScore: null,
      reason: "No contract / booking / PO / BL / container reference could be read from the document.",
      candidates: [],
    };
  }

  const candidates: MatchCandidate[] = [];

  await withLocalPg(async (sql) => {
    const scopeCountry = scope.countryIds === null ? sql`TRUE` : sql`(t.country_id = ANY(${scope.countryIds}) OR t.country_id IS NULL)`;
    const scopeCity = scope.cityBranchIds ? sql`(t.city_branch_id = ANY(${scope.cityBranchIds}) OR t.city_branch_id IS NULL)` : sql`TRUE`;

    if (domain === "business") {
      if (PURCHASE_DOCS.includes(docTypeCode) || job.purchase_order_id) {
        const rows = await sql`
          SELECT t.id, t.country_id, t.city_branch_id,
                 COALESCE(t.purchase_contract_no, '') AS contract_no,
                 COALESCE(NULLIF(t.purchase_order_no,''), t.global_reference_id, '') AS booking_no,
                 t.order_total, COALESCE(t.purchase_currency, t.currency_code) AS ccy, t.form_data, t.status
          FROM public.purchase_orders t
          WHERE t.deleted_at IS NULL AND ${scopeCountry} AND ${scopeCity}
            AND (${job.purchase_order_id ? sql`t.id = ${job.purchase_order_id}` : sql`FALSE`}
                 OR upper(regexp_replace(coalesce(t.purchase_contract_no,''),'[^A-Za-z0-9]','','g')) = ${contract || "~"}
                 OR upper(regexp_replace(coalesce(t.purchase_order_no,''),'[^A-Za-z0-9]','','g')) IN (${booking || "~"}, ${poNo || "~"})
                 OR upper(regexp_replace(coalesce(t.global_reference_id,''),'[^A-Za-z0-9]','','g')) IN (${booking || "~"}, ${poNo || "~"}))
          LIMIT 25`;
        for (const r of rows ?? []) {
          const form = r.form_data?.form ?? r.form_data ?? {};
          candidates.push(scoreCandidate("purchase_orders", r, { contract, booking, poNo, party, total, currency, containers },
            { finalAmount: r.order_total, currency: r.ccy, ...form }));
        }
      }
      if (SALES_DOCS.includes(docTypeCode) || job.sales_order_id) {
        const rows = await sql`
          SELECT t.id, t.country_id, t.city_branch_id,
                 COALESCE(NULLIF(t.sales_contract_no,''), t.manual_reference_number, '') AS contract_no,
                 COALESCE(t.sales_order_no, '') AS booking_no,
                 COALESCE(t.customer_name, '') AS party_name, t.order_total, t.currency_code AS ccy, t.form_data, t.sales_status AS status
          FROM public.sales_orders t
          WHERE t.deleted_at IS NULL AND ${scopeCountry} AND ${scopeCity}
            AND (${job.sales_order_id ? sql`t.id = ${job.sales_order_id}` : sql`FALSE`}
                 OR upper(regexp_replace(coalesce(t.sales_contract_no,''),'[^A-Za-z0-9]','','g')) = ${contract || "~"}
                 OR upper(regexp_replace(coalesce(t.manual_reference_number,''),'[^A-Za-z0-9]','','g')) IN (${contract || "~"}, ${soNo || "~"}, ${booking || "~"})
                 OR upper(regexp_replace(coalesce(t.sales_order_no,''),'[^A-Za-z0-9]','','g')) IN (${soNo || "~"}, ${booking || "~"}))
          LIMIT 25`;
        for (const r of rows ?? []) {
          const form = r.form_data?.form ?? r.form_data ?? {};
          candidates.push(scoreCandidate("sales_orders", r, { contract, booking, poNo: soNo, party, total, currency, containers },
            { partyName: r.party_name, finalAmount: r.order_total, currency: r.ccy, ...form }));
        }
      }
    } else {
      const scopeAgent = scope.clearingAgentIds ? sql`t.clearing_agent_id = ANY(${scope.clearingAgentIds})` : sql`TRUE`;
      if (BL_DOCS.includes(docTypeCode)) {
        const rows = await sql`
          SELECT t.id, t.country_id, t.city_branch_id, t.clearing_agent_id,
                 COALESCE(t.bl_number,'') AS bl_no, COALESCE(t.container_number,'') AS container_no,
                 COALESCE(t.shipping_line_name,'') AS line_name, t.shipment_status AS status
          FROM public.shipping_bl_records t
          WHERE t.deleted_at IS NULL AND ${scopeCountry} AND ${scopeCity} AND ${scopeAgent}
            AND (upper(regexp_replace(coalesce(t.bl_number,''),'[^A-Za-z0-9]','','g')) = ${blNo || "~"}
                 ${containers.length ? sql`OR upper(regexp_replace(coalesce(t.container_number,''),'[^A-Za-z0-9]','','g')) = ANY(${containers})` : sql``})
          LIMIT 25`;
        for (const r of rows ?? []) {
          candidates.push(scoreCandidate("shipping_bl_records", r,
            { contract: "", booking: "", poNo: "", party, total: null, currency: "", containers, blNo },
            { blNo: r.bl_no, containerNumbers: r.container_no, partyName: r.line_name }));
        }
      }
    }
  });

  const inScope = candidates.filter((c) => c.scopeOk).sort((a, b) => b.score - a.score);

  if (inScope.length === 0) {
    return {
      status: "out_of_scope", matchedModule: null, matchedId: null, matchedScore: null,
      reason: "No authorized matching record was found in your country/branch scope.",
      candidates: candidates.slice(0, 10),
    };
  }
  const top = inScope[0];
  const second = inScope[1];
  if (top.score >= 0.8 && (!second || top.score - second.score >= 0.2)) {
    top.isSelected = true;
    return { status: "auto", matchedModule: top.sourceModule, matchedId: top.sourceId, matchedScore: top.score, reason: top.reason, candidates: inScope.slice(0, 10) };
  }
  return {
    status: "ambiguous", matchedModule: null, matchedId: null, matchedScore: top.score,
    reason: "Multiple in-scope records could match — please select the correct one.",
    candidates: inScope.slice(0, 10),
  };
}

function scoreCandidate(
  sourceModule: string,
  row: any,
  sig: { contract: string; booking: string; poNo: string; party: string; total: number | null; currency: string; containers: string[]; blNo?: string },
  form: any,
): MatchCandidate {
  let score = 0;
  const reasons: string[] = [];
  const rowContract = norm(row.contract_no || form.contractNo || form.manualContractNo);
  const rowBooking = norm(row.booking_no || form.bookingNo || form.globalReferenceId);
  const rowParty = String(row.party_name || form.partyName || form.supplierName || form.customerName || "").toUpperCase();
  const rowTotal = Number(form.finalAmount || form.grandTotal || form.totalAmount || 0) || null;
  const rowCurrency = String(form.currency || form.finalCurrency || form.originalCurrency || "").toUpperCase();
  const rowBl = norm(row.bl_no);
  const rowContainers = String(row.container_numbers || row.container_no || "").split(/[, ]+/).map(norm).filter(Boolean);

  if (sig.contract && rowContract && sig.contract === rowContract) { score += 0.45; reasons.push("contract number"); }
  if (sig.booking && rowBooking && sig.booking === rowBooking) { score += 0.35; reasons.push("booking number"); }
  if (sig.poNo && rowBooking && sig.poNo === rowBooking) { score += 0.3; reasons.push("order number"); }
  if (sig.blNo && rowBl && sig.blNo === rowBl) { score += 0.5; reasons.push("B/L number"); }
  if (sig.containers.length && rowContainers.length && sig.containers.some((c) => rowContainers.includes(c))) { score += 0.3; reasons.push("container number"); }
  if (sig.party && rowParty && (rowParty.includes(sig.party.slice(0, 12)) || sig.party.includes(rowParty.slice(0, 12)))) { score += 0.15; reasons.push("party name"); }
  if (sig.total && rowTotal && Math.abs(sig.total - rowTotal) / Math.max(sig.total, rowTotal) < 0.02) { score += 0.15; reasons.push("amount"); }
  if (sig.currency && rowCurrency && sig.currency === rowCurrency) { score += 0.05; reasons.push("currency"); }

  // NEVER auto-match on a single contract/order signal.
  if (reasons.length === 1 && (reasons[0] === "contract number" || reasons[0] === "order number")) {
    score = Math.min(score, 0.55);
  }

  return {
    matchKind: "source_record",
    sourceModule,
    sourceId: row.id,
    label: `${sourceModule.replace(/_/g, " ")} · ${row.contract_no || row.bl_no || row.booking_no || String(row.id).slice(0, 8)}${row.status ? ` (${row.status})` : ""}`,
    score: Math.min(1, Number(score.toFixed(2))),
    scopeOk: true,
    reason: reasons.length ? `Matched on: ${reasons.join(", ")}` : "Weak / partial match",
  };
}
