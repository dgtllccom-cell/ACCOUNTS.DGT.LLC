export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScopeEither } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ lang: z.string().trim().max(5).optional() });

type TimelineEvent = {
  stage: string;
  // actionKey selects the translated action-sentence template on the client (via tt()); the
  // event is never given a pre-built English sentence, so the timeline follows the viewer's
  // selected language exactly like every label and stage name already does. actionData carries
  // the real, untranslated business data (container numbers, company names, serials) that gets
  // interpolated into that template — per the "don't translate names/codes/numbers" rule, those
  // values are shown as-is in every language.
  actionKey: string;
  actionData: Record<string, string | number | null>;
  userName: string | null;
  at: string | null;
  sourceScope: string | null;
  destScope: string | null;
  quantity: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  referenceNo: string | null;
};

/**
 * One consolidated Country Purchase timeline, composed entirely from the timestamped fields
 * each existing stage already records (purchase_orders, purchase_order_payments +
 * roznamcha_entries, purchase_loading_records, stock_movements) — no separate "timeline"
 * table, matching how every other stage of this workflow reuses existing data.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const { searchParams } = new URL(request.url);
    const lang = normalizeLanguage(querySchema.parse({ lang: searchParams.get("lang") || undefined }).lang);

    const result = await withLocalPg(async (sql) => {
      const orderRows = await sql`
        select po.*, c.name as source_country_name, cb.name as source_branch_name,
               dc.name as dest_country_name, dcb.name as dest_branch_name,
               (select poi.product_id from purchase_order_items poi
                where poi.purchase_order_id = po.id and poi.product_id is not null limit 1) as goods_id
        from purchase_orders po
        left join countries c on c.id = po.country_id
        left join country_branches cb on cb.id = po.country_branch_id
        left join countries dc on dc.id = po.dest_country_id
        left join country_branches dcb on dcb.id = po.dest_country_branch_id
        where po.id = ${params.id}::uuid and po.deleted_at is null
        limit 1
      `;
      const order = orderRows[0] ?? null;
      if (!order) return null;

      const payments = await sql`
        select p.id, p.kind, p.amount, p.currency_code, p.created_at, p.status, p.reference_no,
               re.super_admin_serial_number, re.country_transaction_serial_number, pr.full_name as user_name
        from purchase_order_payments p
        left join roznamcha_entries re on re.id = p.roznamcha_entry_id
        left join profiles pr on pr.id = re.created_by
        where p.purchase_order_id = ${params.id}::uuid and p.deleted_at is null
        order by p.created_at asc
      `;

      const loadingRecords = await sql`
        select plr.id, plr.loading_record_no, plr.container_number, plr.loading_status, plr.loaded_quantity,
               plr.received_quantity, plr.transport_mode, plr.transport_company, plr.departure_date,
               plr.expected_arrival_date, plr.actual_arrival_date, plr.received_at, plr.received_by,
               plr.receiving_warehouse_id, plr.created_at, plr.updated_at,
               pr.full_name as received_by_name
        from purchase_loading_records plr
        left join profiles pr on pr.id = plr.received_by
        where plr.purchase_order_id = ${params.id}::uuid and plr.deleted_at is null
        order by plr.created_at asc
      `;

      const stockMovements = await sql`
        select sm.id, sm.movement_type, sm.quantity, sm.warehouse_id, sm.created_at, w.warehouse_name
        from stock_movements sm
        left join warehouses w on w.id = sm.warehouse_id
        where sm.purchase_order_id = ${params.id}::uuid and sm.deleted_at is null
        order by sm.created_at asc
      `;

      return { order, payments, loadingRecords, stockMovements };
    });

    if (!result) {
      return apiError("NOT_FOUND", "Purchase order not found.", 404);
    }

    const { order, payments, loadingRecords, stockMovements } = result as any;

    authorizeApiScopeEither(session, {
      resource: "purchases",
      action: "read",
      source: { countryId: order.country_id, countryBranchId: order.country_branch_id, cityBranchId: order.city_branch_id },
      destination: { countryId: order.dest_country_id, countryBranchId: order.dest_country_branch_id, cityBranchId: order.dest_city_branch_id }
    });

    // Country/branch names have real record_translations coverage — resolve them, not raw.
    const countryLookup: { id: string; name: string | null }[] = [];
    if (order.country_id) countryLookup.push({ id: order.country_id, name: order.source_country_name });
    if (order.dest_country_id) countryLookup.push({ id: order.dest_country_id, name: order.dest_country_name });
    const localizedCountries = await localizeRecordNames(countryLookup, "countries", "name", lang);
    const countryNameById = new Map(localizedCountries.map((c) => [c.id, c.name]));

    const branchLookup: { id: string; name: string | null }[] = [];
    if (order.country_branch_id) branchLookup.push({ id: order.country_branch_id, name: order.source_branch_name });
    if (order.dest_country_branch_id) branchLookup.push({ id: order.dest_country_branch_id, name: order.dest_branch_name });
    const localizedBranches = await localizeRecordNames(branchLookup, "country_branches", "name", lang);
    const branchNameById = new Map(localizedBranches.map((b) => [b.id, b.name]));

    const sourceCountryName = (order.country_id && countryNameById.get(order.country_id)) || order.source_country_name;
    const sourceBranchName = (order.country_branch_id && branchNameById.get(order.country_branch_id)) || order.source_branch_name;
    const destCountryName = (order.dest_country_id && countryNameById.get(order.dest_country_id)) || order.dest_country_name;
    const destBranchName = (order.dest_country_branch_id && branchNameById.get(order.dest_country_branch_id)) || order.dest_branch_name;

    const sourceScope = [sourceCountryName, sourceBranchName].filter(Boolean).join(" / ") || null;
    const destScope = [destCountryName, destBranchName].filter(Boolean).join(" / ") || null;
    const form = order.form_data?.form || {};
    const referenceNo = [order.purchase_order_no, order.purchase_contract_no].filter(Boolean).join(" / ");

    const events: TimelineEvent[] = [];

    events.push({
      stage: "purchase_created",
      actionKey: "ctimeline.action_purchase_created",
      actionData: {},
      userName: form.userName || null,
      at: order.created_at,
      sourceScope,
      destScope,
      quantity: Number(form.qtyNo || 0) || null,
      amount: Number(order.order_total || 0),
      currency: order.currency_code,
      status: order.payment_status,
      referenceNo
    });

    for (const p of payments) {
      events.push({
        stage: p.kind === "advance" ? "advance_credit" : "payment",
        actionKey: "ctimeline.action_payment_posted",
        actionData: { kind: String(p.kind || "payment").replace(/_/g, " ") },
        userName: p.user_name || null,
        at: p.created_at,
        sourceScope,
        destScope,
        quantity: null,
        amount: Number(p.amount || 0),
        currency: p.currency_code,
        status: p.status,
        referenceNo: p.reference_no
      });
      events.push({
        stage: "roznamcha_journal_ledger",
        actionKey: "ctimeline.action_roznamcha_posted",
        actionData: { serial: p.super_admin_serial_number || p.country_transaction_serial_number || "-" },
        userName: p.user_name || null,
        at: p.created_at,
        sourceScope,
        destScope,
        quantity: null,
        amount: Number(p.amount || 0),
        currency: p.currency_code,
        status: "posted",
        referenceNo: p.reference_no
      });
    }

    if (order.dest_country_id) {
      events.push({
        stage: "country_transfer",
        actionKey: "ctimeline.action_transfer_linked",
        actionData: {},
        userName: null,
        at: order.created_at,
        sourceScope,
        destScope,
        quantity: null,
        amount: null,
        currency: null,
        status: "linked",
        referenceNo
      });
    }

    for (const l of loadingRecords) {
      if (l.transport_mode) {
        events.push({
          stage: "transportation",
          actionKey: l.transport_company ? "ctimeline.action_transport_arranged_with_company" : "ctimeline.action_transport_arranged",
          actionData: { mode: l.transport_mode, company: l.transport_company || "" },
          userName: null,
          at: l.created_at,
          sourceScope,
          destScope,
          quantity: Number(l.loaded_quantity || 0) || null,
          amount: null,
          currency: null,
          status: l.loading_status,
          referenceNo: l.loading_record_no
        });
      }
      events.push({
        stage: "loading",
        actionKey: "ctimeline.action_loaded_container",
        actionData: { container: l.container_number || "-" },
        userName: null,
        at: l.created_at,
        sourceScope,
        destScope,
        quantity: Number(l.loaded_quantity || 0) || null,
        amount: null,
        currency: null,
        status: l.loading_status,
        referenceNo: l.loading_record_no
      });
      if (l.departure_date) {
        events.push({
          stage: "in_transit",
          actionKey: "ctimeline.action_departed",
          actionData: {},
          userName: null,
          at: l.departure_date,
          sourceScope,
          destScope,
          quantity: Number(l.loaded_quantity || 0) || null,
          amount: null,
          currency: null,
          status: "in_transit",
          referenceNo: l.loading_record_no
        });
      }
      if (l.received_at) {
        events.push({
          stage: "receiving",
          actionKey: Number(l.received_quantity || 0) >= Number(l.loaded_quantity || 0) ? "ctimeline.action_fully_received" : "ctimeline.action_partially_received",
          actionData: {},
          userName: l.received_by_name || null,
          at: l.received_at,
          sourceScope,
          destScope,
          quantity: Number(l.received_quantity || 0) || null,
          amount: null,
          currency: null,
          status: l.loading_status,
          referenceNo: l.loading_record_no
        });
      }
    }

    for (const m of stockMovements) {
      events.push({
        stage: "stock_warehouse",
        actionKey: "ctimeline.action_stock_in",
        actionData: { warehouse: m.warehouse_name || "-" },
        userName: null,
        at: m.created_at,
        sourceScope,
        destScope,
        quantity: Number(m.quantity || 0) || null,
        amount: null,
        currency: null,
        status: "posted",
        referenceNo
      });
    }

    const totalLoaded = loadingRecords.reduce((s: number, l: any) => s + Number(l.loaded_quantity || 0), 0);
    const totalReceived = loadingRecords.reduce((s: number, l: any) => s + Number(l.received_quantity || 0), 0);
    const purchasedQty = Number(form.qtyNo || 0);
    const isClosed = Number(order.remaining_due || 0) <= 0.01 && totalReceived >= totalLoaded && totalLoaded > 0;

    events.push({
      stage: "final_balance",
      actionKey: isClosed ? "ctimeline.action_closed" : "ctimeline.action_open",
      actionData: {},
      userName: null,
      at: null,
      sourceScope,
      destScope,
      quantity: purchasedQty || null,
      amount: Number(order.remaining_due || 0),
      currency: order.currency_code,
      status: isClosed ? "closed" : "open",
      referenceNo
    });

    events.sort((a, b) => {
      if (!a.at && !b.at) return 0;
      if (!a.at) return 1;
      if (!b.at) return -1;
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    });

    let goodsName: string | null = form.goodsName || null;
    if (order.goods_id) {
      const localizedGoods = await localizeRecordNames(
        [{ id: order.goods_id as string, goods_name: goodsName }],
        "goods",
        "goods_name",
        lang
      );
      goodsName = localizedGoods[0]?.goods_name ?? goodsName;
    }
    let supplierName: string | null = form.supplierName || null;
    if (order.supplier_company_id) {
      const localizedCompanies = await localizeRecordNames(
        [{ id: order.supplier_company_id as string, name: supplierName }],
        "companies",
        "name",
        lang
      );
      supplierName = localizedCompanies[0]?.name ?? supplierName;
    }

    return apiOk({
      purchaseOrderId: order.id,
      purchaseOrderNo: order.purchase_order_no,
      referenceNo,
      sourceScope,
      destScope,
      goodsName,
      supplierName,
      orderTotal: Number(order.order_total || 0),
      advancePaid: Number(order.advance_paid || 0),
      remainingDue: Number(order.remaining_due || 0),
      currency: order.currency_code,
      purchasedQty,
      loadedQty: totalLoaded,
      receivedQty: totalReceived,
      events
    });
  } catch (error) {
    return handleApiError(error);
  }
}
