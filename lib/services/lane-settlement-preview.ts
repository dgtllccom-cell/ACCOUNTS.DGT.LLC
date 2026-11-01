import { withLocalPg } from "@/lib/db/local-postgres";
import { parseJsonish } from "@/lib/stock-journal/model";
import { laneSettlement } from "@/lib/purchases/lane-settlement";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import type { ErpSession } from "@/lib/auth/session";
import { resolveBookingRate } from "@/lib/sales/sales-goods-model";

const num = (v: unknown) => Number(v || 0);
/** Caller first resolves the lane through getLaneLoad, retaining its scope check. No writes. */
export async function laneSettlementPreview(session: ErpSession, lane: Record<string, any>) {
  const sales = lane.source_type === "sales_booking" || lane.source_type === "local_sales";
  if (!sales && lane.source_type !== "local_purchase") return null;
  return withLocalPg(async sql => {
    const sourceId = sales ? lane.sales_order_id || lane.source_id : lane.local_purchase_id || lane.source_id;
    const rows = sales
      ? await sql`select so.*, c.currency_code as final_currency, c.name as country_name, cb.name as branch_name from public.sales_orders so left join public.countries c on c.id=so.country_id left join public.city_branches cb on cb.id=so.city_branch_id where so.id=${sourceId}::uuid and so.deleted_at is null`
      : await sql`select lp.*, c.currency_code as final_currency, c.name as country_name, cb.name as branch_name from public.local_purchases lp left join public.countries c on c.id=lp.country_id left join public.city_branches cb on cb.id=lp.city_branch_id where lp.id=${sourceId}::uuid and lp.deleted_at is null`;
    const row = rows[0];
    if (!row || [row.status,row.sales_status].some(s => ["cancelled","canceled","void"].includes(String(s || "").toLowerCase()))) return null;
    authorizeApiScope(session, { resource: sales ? "sales" : "purchases", action: "read", countryId: row.country_id, countryBranchId: row.country_branch_id, cityBranchId: row.city_branch_id });
    const fd = parseJsonish(row.form_data) || {};
    const form = fd.form || {};
    const currency = String(sales ? row.original_currency_code || form.currencyType || form.salesCurrency || row.currency_code || "" : row.purchase_currency || "").toUpperCase();
    const localCurrency = String(row.final_currency || "").toUpperCase();
    const resolved = resolveBookingRate({ invoiceCurrency: currency, settlementCurrency: localCurrency, exchangeRate: row.exchange_rate, operator: form.operator });
    const exchangeRate = resolved.ok ? resolved.operator === "/" ? 1 / resolved.rate : resolved.rate : 0;
    const total = sales ? num(row.total_goods_original || (Array.isArray(fd.goodsEntries) ? fd.goodsEntries.reduce((sum: number,g: any) => sum+num(g.totalAmount),0) : 0) || fd.totals?.grandPrimaryFinal) : num(row.final_cost);
    const quantity = sales ? num(row.quantity) : num(row.numbers);
    const sourceLanes = await sql`select id,source_id,loaded_quantity,net_weight,gross_weight,container_number,loading_record_no from public.purchase_lane_loads where source_type=${lane.source_type} and source_id=${sourceId}::uuid and deleted_at is null order by created_at,id`;
    // A booking transfer is an accrual, even if its legacy payment_kind says "advance". It is NEVER a receipt.
    const receipts = sales ? await sql`select p.payment_kind,p.currency_code,p.amount,p.base_currency_amount from public.sales_order_payments p join public.roznamcha_entries re on re.id=p.roznamcha_entry_id where p.sales_order_id=${sourceId}::uuid and p.deleted_at is null and p.status='posted' and p.payment_kind <> 'booking' and re.deleted_at is null and re.status='posted' and re.source_transaction_type in ('sales_payment','sales_order_payment','sales_advance_payment','sales_remaining_payment','sales_cash_payment','sales_invoice_payment','sales_credit_payment')` : [];
    let paid = 0, advance = 0;
    let paymentKnown = sales;
    for (const p of receipts) {
      const ccy = String(p.currency_code || "").toUpperCase();
      const value = ccy === currency ? num(p.amount) : exchangeRate > 0 && p.base_currency_amount != null ? num(p.base_currency_amount) / exchangeRate : NaN;
      if (!Number.isFinite(value)) { paymentKnown = false; continue; }
      paid += value;
      if (String(p.payment_kind).toLowerCase() === "advance") advance += value;
    }
    // Local Purchase's advance_amount is entered in the booking form, not a verified cash/bank payment.
    // Keep it informational; never turn it into a paid ledger balance in this read-only report.
    const settlement = laneSettlement({ total, quantity, currency, finalCurrency: localCurrency, rate: exchangeRate, advance, paid, loadings: sourceLanes.map(l => ({ id: String(l.source_id), quantity: num(l.loaded_quantity) })) });
    if (!settlement || total <= 0 || quantity <= 0) return null;
    const loadings = sourceLanes.map(l => { const st = settlement.states.find(s => s.id === String(l.source_id))!; return { id: String(l.source_id), loadingNo: l.loading_record_no, container: l.container_number, quantity: num(l.loaded_quantity), netWeightKg: num(l.net_weight), grossWeightKg: l.gross_weight == null ? null : num(l.gross_weight), value: st.valueFC, advanceAllocated: paymentKnown ? st.advanceAllocFC : null, paid: paymentKnown ? st.paidFC : null, outstanding: paymentKnown ? st.outstandingFC : null, complete: paymentKnown && st.complete }; });
    const loadedQuantity = sourceLanes.reduce((sum,l) => sum+num(l.loaded_quantity),0);
    return { id: String(row.id), billNo: lane.purchase_ref_no, manualBillNo: form.billNo || row.manual_bill_no || null, supplier: row.customer_name || row.supplier_name, goods: row.product_summary || row.goods_name || lane.goods_name, country: row.country_name, branch: row.branch_name,
      purchaseAccount: form.purchaseAccountName, purchaseAccountNo: form.purchaseAccountNo || row.purchase_account_no, salesAccount: form.salesAccountName, salesAccountNo: form.salesAccountNo || row.sales_account_no,
      currency, localCurrency, exchangeRate, condition: form.paymentType || row.payment_mode, billTotal: total, advancePercent: num(form.advancePercent || row.advance_percentage), advanceRequired: total*num(form.advancePercent || row.advance_percentage)/100,
      advancePaid: paymentKnown ? advance : null, remainingPaid: paymentKnown ? paid-advance : null, totalPaid: paymentKnown ? paid : null, outstanding: paymentKnown ? settlement.outstanding : null,
      paymentKnown, totalQuantity: quantity, loadedQuantity, balanceQuantity: Math.max(0,quantity-loadedQuantity), payableNow: paymentKnown ? loadings.reduce((sum,l) => sum+num(l.outstanding),0) : null, loadings };
  });
}
