/**
 * Document verification checks — READ-ONLY.
 *
 * Compares a reviewed intake job against (a) other documents already in the system and (b) the
 * authoritative record it is matched to (purchase / sales order). It only reports; it never posts,
 * edits, reverses or links anything. The human decides in the existing module's own workflow.
 *
 *   duplicate_document       same file (sha256) already uploaded
 *   already_used_document    this file / its twin was already consumed into a record
 *   duplicate_invoice        same invoice number already on another document / bill
 *   party_mismatch           supplier / customer on the document ≠ the matched order
 *   currency_mismatch        document currency ≠ order currency
 *   exchange_rate_mismatch   document rate differs from the order's frozen rate (> 0.5 %)
 *   total_mismatch           document grand total ≠ order total
 *   quantity_mismatch        document quantity ≠ order quantity
 *   unit_rate_mismatch       line unit price differs from the order line rate (> 0.5 %)
 *   reference_mismatch       contract / invoice reference ≠ the order's reference
 *   duplicate_posting        (finance docs) an entry with the same reference + date exists
 */
import type { ErpSession } from "@/lib/auth/session";
import { withReadPg } from "@/lib/db/local-postgres";
import { rowInScope, type IntakeScope } from "@/lib/document-intelligence/scope";
import { recordInSessionScope } from "@/lib/api/scope-middleware";
import { roznamchaIntakePreviewService } from "@/lib/services/roznamcha-intake-preview-service";

export type CheckStatus = "pass" | "warning" | "fail" | "not_applicable";
export type VerificationCheck = { code: string; status: CheckStatus; expected?: string | null; found?: string | null; detail?: string | null };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const words = (s: string | null | undefined) =>
  new Set((s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter((w) => w.length > 2 && !["llc", "ltd", "co", "company", "trading", "the", "and", "general"].includes(w)));
const similar = (a?: string | null, b?: string | null) => {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return null;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
};
const relDiff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 1) : Math.abs(a - b) / Math.abs(b));
const fmt = (n: number | null) => (n === null ? null : n.toLocaleString("en-US", { maximumFractionDigits: 6 }));

export async function verifyIntakeJob(jobId: string, scope: IntakeScope, session: ErpSession): Promise<{ jobNo: string; targetModule: string | null; matched: { module: string; id: string; label: string | null } | null; checks: VerificationCheck[] } | null> {
  return withReadPg(async (sql) => {
    const job = ((await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId}::uuid AND deleted_at IS NULL`) as any[])[0];
    if (!job || !rowInScope(scope, job)) return null;
    const fieldRows = (await sql`SELECT field_key, corrected_value, normalized_value, raw_value FROM public.document_intake_fields WHERE job_id = ${jobId}::uuid`) as any[];
    const f: Record<string, string | null> = {};
    for (const r of fieldRows) f[r.field_key] = (r.corrected_value ?? r.normalized_value ?? r.raw_value ?? null) || null;
    const lines = (await sql`SELECT line_no, description, quantity, unit_price, amount FROM public.document_intake_line_items WHERE job_id = ${jobId}::uuid ORDER BY line_no`) as any[];
    const checks: VerificationCheck[] = [];
    const add = (c: VerificationCheck) => checks.push(c);

    // ── against other documents ────────────────────────────────────────────
    const twins = (await sql`
      SELECT id, job_no, status, matched_source_module, matched_source_id, country_id, country_branch_id, city_branch_id, clearing_agent_id, operational_domain
      FROM public.document_intake_jobs
      WHERE file_sha256 = ${job.file_sha256} AND id <> ${jobId}::uuid AND deleted_at IS NULL AND status <> 'cancelled'
      LIMIT 20
    `) as any[];
    const visibleTwins = twins.filter((t) => rowInScope(scope, t));
    add(visibleTwins.length
      ? { code: "duplicate_document", status: "warning", found: visibleTwins.map((t) => t.job_no).join(", "), detail: null }
      : { code: "duplicate_document", status: "pass" });

    const consumed = (await sql`
      SELECT d.draft_no, d.consumed_source_module, d.consumed_source_id, j.job_no
      FROM public.document_intake_drafts d JOIN public.document_intake_jobs j ON j.id = d.job_id
      WHERE d.status = 'consumed' AND d.deleted_at IS NULL
        AND (d.job_id = ${jobId}::uuid OR j.file_sha256 = ${job.file_sha256})
      LIMIT 5
    `) as any[];
    add(consumed.length
      ? { code: "already_used_document", status: "fail", found: consumed.map((c) => `${c.job_no} → ${c.consumed_source_module ?? ""}`).join(", ") }
      : { code: "already_used_document", status: "pass" });

    const inv = (f.invoice_number ?? "").trim();
    if (inv) {
      const invJobs = (await sql`
        SELECT j.job_no, j.country_id, j.country_branch_id, j.city_branch_id, j.clearing_agent_id, j.operational_domain
        FROM public.document_intake_fields fl JOIN public.document_intake_jobs j ON j.id = fl.job_id
        WHERE fl.field_key = 'invoice_number' AND lower(coalesce(fl.corrected_value, fl.normalized_value, fl.raw_value)) = lower(${inv})
          AND j.id <> ${jobId}::uuid AND j.deleted_at IS NULL AND j.status <> 'cancelled' AND j.file_sha256 <> ${job.file_sha256}
        LIMIT 10
      `) as any[];
      const invPos = (await sql`
        SELECT purchase_order_no, country_id, country_branch_id, city_branch_id FROM public.purchase_orders
        WHERE deleted_at IS NULL AND (lower(form_data->'form'->>'billNo') = lower(${inv}) OR lower(form_data->'form'->>'manualBillNo') = lower(${inv}) OR lower(purchase_contract_no) = lower(${inv}))
        LIMIT 5
      `) as any[];
      const hits = [
        ...invJobs.filter((t) => rowInScope(scope, t)).map((t) => t.job_no),
        ...invPos.filter((p) => recordInSessionScope(session, p)).map((p) => p.purchase_order_no),
      ];
      add(hits.length ? { code: "duplicate_invoice", status: "warning", found: hits.join(", "), expected: inv } : { code: "duplicate_invoice", status: "pass", found: inv });
    } else {
      add({ code: "duplicate_invoice", status: "not_applicable" });
    }

    // ── against the matched authoritative record ──────────────────────────
    let matched: { module: string; id: string; label: string | null } | null = null;
    const mod = job.matched_source_module as string | null;
    const mid = job.matched_source_id as string | null;
    let order: any = null;
    if (mod && mid && (mod === "purchase_orders" || mod === "sales_orders")) {
      order =
        mod === "purchase_orders"
          ? ((await sql`SELECT id, purchase_order_no AS ref, purchase_contract_no AS contract_no, coalesce(purchase_currency, currency_code) AS currency, exchange_rate, order_total, form_data, country_id, country_branch_id, city_branch_id FROM public.purchase_orders WHERE id = ${mid}::uuid AND deleted_at IS NULL`) as any[])[0]
          : ((await sql`SELECT id, sales_order_no AS ref, sales_contract_no AS contract_no, currency_code AS currency, exchange_rate, order_total, quantity, customer_name, form_data, country_id, country_branch_id, city_branch_id FROM public.sales_orders WHERE id = ${mid}::uuid AND deleted_at IS NULL`) as any[])[0];
      if (order && !recordInSessionScope(session, order)) order = null; // never compare against an out-of-scope record
      if (order) matched = { module: mod, id: order.id, label: order.ref ?? null };
    }
    const na = (code: string) => add({ code, status: "not_applicable", detail: matched ? null : "no_matched_order" });

    if (!order) {
      ["party_mismatch", "currency_mismatch", "exchange_rate_mismatch", "total_mismatch", "quantity_mismatch", "unit_rate_mismatch", "reference_mismatch"].forEach(na);
    } else {
      const form = order.form_data?.form ?? {};
      const goods: any[] = Array.isArray(order.form_data?.goodsEntries) ? order.form_data.goodsEntries : Array.isArray(form.goodsEntries) ? form.goodsEntries : [];
      // party
      const orderParty = mod === "purchase_orders" ? form.supplierName ?? null : order.customer_name ?? form.customerName ?? null;
      const docParty = mod === "purchase_orders" ? f.supplier_name ?? f.contract_parties ?? f.shipper ?? null : f.customer_name ?? f.consignee ?? null;
      const sim = similar(docParty, orderParty);
      add(sim === null ? { code: "party_mismatch", status: "not_applicable", expected: orderParty, found: docParty }
        : { code: "party_mismatch", status: sim >= 0.5 ? "pass" : "warning", expected: orderParty, found: docParty });
      // currency
      const dCur = (f.currency ?? "").toUpperCase().slice(0, 3);
      add(!dCur || !order.currency ? { code: "currency_mismatch", status: "not_applicable" }
        : { code: "currency_mismatch", status: dCur === String(order.currency).toUpperCase() ? "pass" : "fail", expected: order.currency, found: dCur });
      // exchange rate
      const dRate = num(f.exchange_rate), oRate = num(order.exchange_rate ?? form.exchangeRate);
      add(dRate === null || oRate === null || oRate === 0 ? { code: "exchange_rate_mismatch", status: "not_applicable" }
        : { code: "exchange_rate_mismatch", status: relDiff(dRate, oRate) <= 0.005 ? "pass" : "warning", expected: fmt(oRate), found: fmt(dRate) });
      // total
      const dTot = num(f.grand_total), oTot = num(order.order_total ?? form.totalAmount);
      add(dTot === null || oTot === null ? { code: "total_mismatch", status: "not_applicable" }
        : { code: "total_mismatch", status: Math.abs(dTot - oTot) <= 0.01 ? "pass" : "fail", expected: fmt(oTot), found: fmt(dTot) });
      // quantity
      const dQty = lines.reduce((a, l) => a + (num(l.quantity) ?? 0), 0);
      const oQty = goods.length ? goods.reduce((a, g) => a + (num(g.qtyNo ?? g.quantity) ?? 0), 0) : num(order.quantity ?? form.quantity);
      add(!lines.length || oQty === null ? { code: "quantity_mismatch", status: "not_applicable" }
        : { code: "quantity_mismatch", status: Math.abs(dQty - oQty) < 0.0001 ? "pass" : "warning", expected: fmt(oQty), found: fmt(dQty) });
      // unit rate (line by line, by position)
      const pairs = lines.map((l, i) => [num(l.unit_price), num(goods[i]?.priceRateC1 ?? goods[i]?.coursePrice ?? goods[i]?.unitPrice ?? goods[i]?.rate)] as const).filter(([a, b]) => a !== null && b !== null);
      const off = pairs.filter(([a, b]) => relDiff(a as number, b as number) > 0.005);
      add(!pairs.length ? { code: "unit_rate_mismatch", status: "not_applicable" }
        : { code: "unit_rate_mismatch", status: off.length ? "warning" : "pass", expected: pairs.map((p) => fmt(p[1])).join(" / "), found: pairs.map((p) => fmt(p[0])).join(" / ") });
      // reference
      const dRef = (f.contract_number ?? f.po_number ?? f.so_number ?? "").trim();
      const oRef = (order.contract_no ?? order.ref ?? "").trim();
      add(!dRef || !oRef ? { code: "reference_mismatch", status: "not_applicable", expected: oRef || null, found: dRef || null }
        : { code: "reference_mismatch", status: dRef.toLowerCase() === oRef.toLowerCase() || dRef.toLowerCase() === String(order.ref ?? "").toLowerCase() ? "pass" : "warning", expected: oRef, found: dRef });
    }

    // ── finance documents: duplicate posting (same rule as the pre-post preview) ──
    if ((job.target_module ?? "") === "roznamcha_entries") {
      const pv: any = await roznamchaIntakePreviewService.previewFromJob(jobId, scope).catch(() => null);
      const dup = pv?.preview?.duplicateOf ?? pv?.duplicateOf ?? null;
      add(dup ? { code: "duplicate_posting", status: "fail", found: dup.voucherNo ?? dup.entrySerial ?? dup.id } : { code: "duplicate_posting", status: pv ? "pass" : "not_applicable" });
    } else {
      add({ code: "duplicate_posting", status: "not_applicable" });
    }

    return { jobNo: job.job_no, targetModule: job.target_module ?? null, matched, checks };
  });
}
