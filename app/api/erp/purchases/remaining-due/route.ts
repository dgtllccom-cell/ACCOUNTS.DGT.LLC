import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { buildBillPayment } from "@/lib/services/purchase-loading-payment-service";
import { parseJsonish } from "@/lib/stock-journal/model";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

/**
 * Bills that are waiting for a Remaining Payment: loaded (at least one loading with a loaded quantity), not Credit, and — for Advance /
 * Endorsement bills — with the required advance paid. For each bill: the original bill, quantities (total / loaded / balance), the money
 * (bill total, advance required / paid, remaining paid, total paid, outstanding) and every loading with what it is worth, the advance allocated
 * to it, what was paid against it and what is payable now. The figures come from buildBillPayment — the same rules the payment API enforces —
 * so what this list shows as payable is exactly what a payment may be for. Read-only; same scope rules as the payments list.
 *
 *   GET /api/erp/purchases/remaining-due[?orderNo=AE-001-0007][&includeSettled=1]
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read" });
    const { searchParams } = new URL(request.url);
    const orderNo = (searchParams.get("orderNo") || "").trim();
    const includeSettled = searchParams.get("includeSettled") === "1";
    const lang = await getRequestLanguage(searchParams.get("lang"));

    const scopedCountryIds = !session.isSuperAdmin && session.countryIds.length > 0 ? session.countryIds : null;
    const scopedCountryBranchIds = !session.isSuperAdmin && session.countryBranchIds.length > 0 ? session.countryBranchIds : null;
    const scopedCityBranchIds = !session.isSuperAdmin && session.cityBranchIds.length > 0 ? session.cityBranchIds : null;

    const data = await withLocalPg(async (sql) => {
      const pos = await sql`
        select po.id::text as id, po.country_id::text as country_id, po.dest_country_id::text as dest_country_id,
               po.city_branch_id::text as city_branch_id, po.purchase_order_no, po.currency_code, po.purchase_currency, po.exchange_rate, po.order_total, po.total_goods_original,
               po.advance_paid, po.remaining_paid, po.credit_amount, po.remaining_due, po.payment_status, po.form_data, po.created_at,
               c.name as country_name, dc.name as dest_country_name, c.currency_code as base_currency, cib.city_name as branch_name
        from public.purchase_orders po
        left join public.countries c on c.id = po.country_id
        left join public.countries dc on dc.id = po.dest_country_id
        left join public.city_branches cib on cib.id = po.city_branch_id
        where po.deleted_at is null
          and exists (select 1 from public.purchase_loading_records l where l.purchase_order_id = po.id and l.deleted_at is null and coalesce(l.loaded_quantity, 0) > 0)
          and (${orderNo ? sql`po.purchase_order_no = ${orderNo}` : sql`true`})
          and (${scopedCityBranchIds ? sql`po.city_branch_id = any(${scopedCityBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && scopedCountryBranchIds ? sql`po.country_branch_id = any(${scopedCountryBranchIds}::uuid[])` : sql`true`})
          and (${!scopedCityBranchIds && !scopedCountryBranchIds && scopedCountryIds ? sql`po.country_id = any(${scopedCountryIds}::uuid[])` : sql`true`})
        order by po.created_at desc
        limit 400`;
      const ids = pos.map((p: any) => p.id as string);
      if (!ids.length) return { pos, loadings: [] as any[], payments: [] as any[] };
      const loadings = await sql`
        select id::text as id, purchase_order_id::text as purchase_order_id, loading_record_no, container_number, vehicle_no,
               loaded_quantity, net_weight, gross_weight,
               origin_text, destination_text, loading_location, receiving_location,
               loaded_at, received_at, actual_arrival_date,
               loading_status, report_payload, created_at
        from public.purchase_loading_records
        where purchase_order_id = any(${ids}::uuid[]) and deleted_at is null and coalesce(loaded_quantity, 0) > 0
        order by created_at asc, id asc`;
      const payments = await sql`
        select purchase_order_id::text as purchase_order_id, loading_record_id::text as loading_record_id, amount, currency_code, exchange_rate, base_currency_amount
        from public.purchase_order_payments
        where purchase_order_id = any(${ids}::uuid[]) and deleted_at is null and status = 'posted' and kind::text = 'remaining'`;
      return { pos, loadings: loadings as any[], payments: payments as any[] };
    });

    // country / branch names follow the viewer's language (the bill's own numbers, supplier and goods are business data and stay as saved)
    const posLocalized = await localizeJoinedNames((data?.pos ?? []) as any[], lang, [
      { idField: "country_id", nameField: "country_name", table: "countries" },
      { idField: "dest_country_id", nameField: "dest_country_name", table: "countries" },
      { idField: "city_branch_id", nameField: "branch_name", table: "city_branches", field: "name" }
    ]);
    const bills: any[] = [];
    for (const po of posLocalized as any[]) {
      const myLoadings = (data?.loadings ?? []).filter((l: any) => l.purchase_order_id === po.id);
      const myPayments = (data?.payments ?? []).filter((p: any) => p.purchase_order_id === po.id);
      const bill = buildBillPayment(po, myLoadings, myPayments);
      if (bill.condition === "credit") continue; // Credit bills follow their own approved credit rules, not this list
      const advanceCleared = bill.advanceRequired > 0 ? bill.advancePaid >= bill.advanceRequired - 0.05 : bill.advancePaid > 0 || !bill.gated;
      if (bill.gated && !advanceCleared) continue; // an Advance bill appears here only once its required advance is paid
      const rows = myLoadings.map((l: any) => {
        const st = bill.byLoading.get(String(l.id));
        return {
          id: String(l.id),
          loadingNo: l.loading_record_no ?? null,
          container: l.container_number ?? null,
          vehicleNo: l.vehicle_no ?? null,
          quantity: Number(l.loaded_quantity || 0),
          netWeightKg: Number(l.net_weight || 0),
          grossWeightKg: l.gross_weight == null ? null : Number(l.gross_weight),
          originText: l.origin_text ?? null,
          destinationText: l.destination_text ?? null,
          loadingLocation: l.loading_location ?? null,
          receivingLocation: l.receiving_location ?? null,
          loadedAt: l.loaded_at ?? l.created_at ?? null,
          receivedAt: l.received_at ?? l.actual_arrival_date ?? null,
          reportPayload: l.report_payload ?? null,
          value: st?.valueFC ?? 0,
          advanceAllocated: st?.advanceAllocFC ?? 0,
          paid: st?.paidFC ?? 0,
          outstanding: st?.outstandingFC ?? 0,
          complete: st?.complete ?? false
        };
      });
      const payableNow = rows.reduce((s: number, r: any) => s + (r.complete ? 0 : r.outstanding), 0);
      if (!includeSettled && payableNow <= 0.05) continue;
      const fd = parseJsonish(po.form_data) || {};
      const form = fd.form || {};
      const goodsNames = Array.isArray(fd.goodsEntries) ? [...new Set(fd.goodsEntries.map((g: any) => String(g?.goodsName || "").trim()).filter(Boolean))] : [];
      bills.push({
        id: po.id,
        billNo: po.purchase_order_no,
        manualBillNo: form.manualBillNumber || form.manualBillNo || null,
        supplier: form.supplierName || form.salesAccountName || null,
        goods: goodsNames.join(", "),
        country: po.country_name ?? null,
        destCountry: po.dest_country_name ?? null,
        branch: po.branch_name ?? null,
        currency: bill.currency,
        localCurrency: String(po.base_currency || "").toUpperCase(),
        exchangeRate: bill.currency === String(po.base_currency || "").toUpperCase() ? 1 : Number(po.exchange_rate || 0),
        purchaseAccount: form.purchaseAccountName || null,
        purchaseAccountNo: form.purchaseAccountNo || null,
        salesAccount: form.salesAccountName || null,
        salesAccountNo: form.salesAccountNo || null,
        totalContainers: Number(fd.workflow?.totalContainers || 0),
        loadedContainers: Number(fd.workflow?.loadedContainers || 0),
        remainingContainers: Number(fd.workflow?.remainingContainers || 0),
        condition: bill.condition,
        billTotal: bill.billTotal,
        advancePercent: bill.advancePercent,
        advanceRequired: bill.advanceRequired,
        advancePaid: bill.advancePaid,
        remainingPaid: bill.remainingPaid,
        totalPaid: bill.totalPaid,
        outstanding: bill.outstanding,
        totalQuantity: bill.totalQuantity,
        loadedQuantity: bill.loadedQuantity,
        balanceQuantity: bill.balanceQuantity,
        payableNow: Math.round(payableNow * 10000) / 10000,
        loadings: rows
      });
    }
    return apiOk({ bills });
  } catch (error) {
    return handleApiError(error);
  }
}
