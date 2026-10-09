export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getJournal, localizeLotNames } from "@/lib/services/goods-transfer-service";
import { getRequestLanguage } from "@/lib/i18n/server";

/**
 * Full lifecycle of one Local Purchase: purchase & supplier, payment condition and ledger activity, the lot(s), every
 * warehouse / sale / export / inter-country movement, and one merged audit timeline. Read-only.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    z.string().uuid().parse(id);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const out = await withLocalPg(async (sql) => {
      const [p] = await sql`select * from public.local_purchases where id = ${id}::uuid and deleted_at is null`;
      if (!p) throw new ApiClientError("Purchase not found.", { status: 404, code: "PURCHASE_NOT_FOUND" });
      authorizeApiScope(session, {
        resource: "purchases", action: "read",
        countryId: p.country_id, countryBranchId: p.country_branch_id, cityBranchId: p.city_branch_id ?? null,
      });

      const journal = await getJournal(sql, id);
      const lotIds: string[] = journal.lots.map((l: any) => l.id);
      const payableLedgerId = journal.lots[0]?.payable_ledger_id ?? null;
      const tradeEntryIds: string[] = [];
      for (const t of journal.trades) for (const k of ["source_roznamcha_entry_id", "source_cost_roznamcha_entry_id", "dest_roznamcha_entry_id"]) if ((t as any)[k]) tradeEntryIds.push((t as any)[k]);
      const nameIds = [p.created_by, p.accepted_by, ...journal.transfers.map((t: any) => t.created_by), ...journal.movements.map((m: any) => m.created_by)].filter(Boolean);

      // Independent reads, issued together (the database is remote: round trips are the cost).
      const [purchaseEntryRows, payableActivity, payableLedgerRows, costEntries, tradeEntries, destPurchases, destLots, names] = await Promise.all([
        p.roznamcha_entry_id
          ? sql`
              select e.id, e.voucher_no, e.journal_no, e.entry_date, e.status, e.narration, e.reference_no,
                     e.super_admin_serial_number, e.country_transaction_serial_number, e.branch_transaction_serial_number,
                     (select json_agg(json_build_object('ledger_id', l.ledger_id, 'code', lg.code, 'name', lg.name, 'debit', l.debit, 'credit', l.credit, 'currency', l.currency) order by l.id)
                        from public.roznamcha_lines l left join public.ledgers lg on lg.id = l.ledger_id where l.roznamcha_entry_id = e.id) as lines
              from public.roznamcha_entries e where e.id = ${p.roznamcha_entry_id}::uuid`
          : Promise.resolve([] as any[]),
        // later supplier payments are posted through the Payment Journals against the supplier's payable ledger
        payableLedgerId
          ? sql`
              select e.id, e.entry_date, e.voucher_no, e.narration, e.reference_no, e.source_module, e.source_transaction_type, e.status,
                     l.debit::float8 as debit, l.credit::float8 as credit, l.currency
              from public.roznamcha_lines l join public.roznamcha_entries e on e.id = l.roznamcha_entry_id
              where l.ledger_id = ${payableLedgerId}::uuid and e.deleted_at is null and e.status <> 'cancelled'
              order by e.entry_date desc, e.created_at desc limit 15`
          : Promise.resolve([] as any[]),
        payableLedgerId
          ? sql`select id, code, name, current_balance::float8 as balance, currency from public.ledgers where id = ${payableLedgerId}::uuid`
          : Promise.resolve([] as any[]),
        journal.costEntryIds.length
          ? sql`select id, voucher_no, entry_date, narration, source_transaction_type, base_currency_amount::float8 as amount, original_currency_code as currency from public.roznamcha_entries where id = any(${journal.costEntryIds}::uuid[])`
          : Promise.resolve([] as any[]),
        tradeEntryIds.length
          ? sql`select id, voucher_no, entry_date, narration, source_transaction_type, base_currency_amount::float8 as amount, original_currency_code as currency from public.roznamcha_entries where id = any(${tradeEntryIds}::uuid[])`
          : Promise.resolve([] as any[]),
        // destination-country purchases created by this purchase's trades
        journal.trades.length
          ? sql`
              select p2.id, p2.status, p2.goods_name, p2.numbers::float8 as qty, p2.final_cost::float8 as amount, p2.local_currency, p2.country_id, c.name as country_name,
                     t.trade_ref, t.status as trade_status
              from public.inter_country_trades t
              join public.local_purchases p2 on p2.id = t.destination_purchase_id
              left join public.countries c on c.id = p2.country_id
              where t.source_lot_id = any(${lotIds}::uuid[])`
          : Promise.resolve([] as any[]),
        journal.trades.length
          ? sql`select l.lot_ref, l.local_purchase_id, l.qty_purchased::float8 as qty, b.qty_available::float8 as available, b.qty_sold::float8 as sold, b.qty_exported::float8 as exported
                 from public.purchase_lots l join public.purchase_lot_balance_v b on b.lot_id = l.id where l.source_lot_id = any(${lotIds}::uuid[])`
          : Promise.resolve([] as any[]),
        nameIds.length ? sql`select id, full_name from public.profiles where id = any(${nameIds}::uuid[])` : Promise.resolve([] as any[]),
      ]);
      const purchaseEntry = purchaseEntryRows[0] ?? null;
      const payableLedger = payableLedgerRows[0] ?? null;
      const nameOf = (uid: string | null) => names.find((n: any) => n.id === uid)?.full_name ?? null;

      type Ev = { at: string; kind: string; text: string; ref?: string | null; by?: string | null; qty?: number | null };
      const events: Ev[] = [];
      events.push({ at: p.created_at, kind: "purchase_created", text: "Purchase created", ref: p.journal_serial_no, by: nameOf(p.created_by) });
      if (p.accepted_at) events.push({ at: p.accepted_at, kind: "purchase_accepted", text: "Purchase accepted", by: nameOf(p.accepted_by) });
      if (p.transferred_at) events.push({ at: p.transferred_at, kind: "purchase_posted", text: "Posted to Roznamcha / Ledger", ref: purchaseEntry?.voucher_no ?? null });
      for (const m of journal.movements as any[]) events.push({ at: m.created_at, kind: `mv_${m.movement_type}`, text: m.movement_type, ref: m.reference_no, by: m.user_name ?? nameOf(m.created_by), qty: Number(m.qty) });
      for (const t of journal.transfers as any[]) if (t.cost_posted_at) events.push({ at: t.cost_posted_at, kind: "cost_posted", text: "Cost of sales posted", ref: t.transfer_no, qty: Number(t.qty) });
      for (const t of journal.trades as any[]) if (t.received_at) events.push({ at: t.received_at, kind: "trade_received", text: "Destination received the trade", ref: t.trade_ref });
      events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      const loading = {
        shippingMode: p.shipping_mode, truckNo: p.truck_no, driverName: p.driver_name, loadingDate: p.loading_date,
        details: p.loading_details ?? {}, warehouseName: p.warehouse_name, warehousePlotNo: p.warehouse_plot_no,
        warehouseTransferStatus: p.warehouse_transfer_status, loadingStatus: p.loading_status, exportStatus: p.export_status,
      };
      const lots = await localizeLotNames(journal.lots as any[], lang);
      return { ...journal, lots, purchaseEntry, payableActivity, payableLedger, costEntries, tradeEntries, destPurchases, destLots, events, loading, extraCharges: p.extra_charges ?? [] };
    });
    return apiOk(out);
  } catch (error) {
    return handleApiError(error);
  }
}
