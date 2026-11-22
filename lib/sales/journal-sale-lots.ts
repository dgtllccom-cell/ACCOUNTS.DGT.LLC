/**
 * Stock Journal lots sold through a Sales booking.
 *
 * A goods line picked from a confirmed Stock Journal allocation carries `journalTransferId`. On save, the sold quantity is
 * split off that allocation and RESERVED for the booking (the same reservation the Stock Journal uses for Export / Direct
 * Sale), so nothing else can sell it. At final billing the Stock Journal issues the linked piece (issueForSalesOrder), which
 * deducts the physical stock once. Releasing a draft gives the reservation back. The original allocation keeps the rest:
 * 2,100 confirmed − 100 sold = 2,000 remaining.
 *
 * Every write runs in the caller's transaction, so a refusal rolls back the whole booking save or posting.
 */
import { ApiClientError } from "@/lib/api/response";
import { nextJournalTransferNo, reserveJournalStockForSale } from "@/lib/services/stock-journal-service";

const EPS = 0.0001;
type Tx = any;

export interface JournalSaleLine {
  transferId: string;
  qty: number;
  name: string;
}

/** The Stock Journal lines of a booking, one entry per allocation (quantities summed). Managed-lot lines are excluded. */
export function journalSaleLinesOf(formData: any): JournalSaleLine[] {
  const goods: any[] = Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : [];
  const byId = new Map<string, JournalSaleLine>();
  for (const g of goods) {
    if (!g || g.managedLotId) continue;
    const id = String(g.journalTransferId || "").trim();
    if (!id) continue;
    const qty = Number(g.qtyNo ?? g.quantity ?? 0);
    const prev = byId.get(id);
    byId.set(id, {
      transferId: id,
      qty: (prev?.qty ?? 0) + (Number.isFinite(qty) ? qty : 0),
      name: String(g.goodsName || g.lotNo || id),
    });
  }
  return [...byId.values()];
}

let columnCache: string[] | null = null;
async function journalColumns(tx: Tx): Promise<string[]> {
  if (!columnCache) {
    const rows = await tx`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'journal_stock_transfers' order by ordinal_position`;
    columnCache = rows.map((r: any) => String(r.column_name));
  }
  return columnCache ?? [];
}

/** True when this booking already has an issued (billed) Stock Journal piece: its stock links are no longer changed. */
export async function hasIssuedJournalLinks(tx: Tx, salesOrderId: string): Promise<boolean> {
  const rows = await tx`
    select 1 from public.journal_stock_transfers
    where sales_order_id = ${salesOrderId}::uuid and status = 'issued' and deleted_at is null limit 1`;
  return rows.length > 0;
}

/** Gives back every reservation this booking holds in the Stock Journal (draft edits, deletes). Issued pieces are not touched. */
export async function releaseJournalLinksForOrder(tx: Tx, salesOrderId: string): Promise<number> {
  const rows = await tx`
    select id, goods_id, warehouse_id, quantity from public.journal_stock_transfers
    where sales_order_id = ${salesOrderId}::uuid and status = 'confirmed' and reserved = true and deleted_at is null
    for update`;
  for (const r of rows) {
    if (r.goods_id && r.warehouse_id) {
      await reserveJournalStockForSale(tx, String(r.goods_id), String(r.warehouse_id), Number(r.quantity), -1);
    }
    await tx`
      update public.journal_stock_transfers
      set reserved = false, sales_order_id = null, sales_order_no = null, updated_at = now()
      where id = ${r.id}::uuid`;
  }
  return rows.length;
}

/**
 * Reserves the booking's Stock Journal lines. Each line splits the sold quantity off its allocation and holds it for this
 * booking. A line whose allocation is taken, reserved, not confirmed, or short is refused (the caller rolls back).
 */
export async function linkJournalLinesForOrder(
  tx: Tx,
  o: { salesOrderId: string; salesOrderNo: string | null; lines: JournalSaleLine[] }
): Promise<void> {
  for (const line of o.lines) {
    if (!(line.qty > EPS)) {
      throw new ApiClientError(`Enter the quantity to sell from ${line.name}.`, { status: 400, code: "QTY_REQUIRED" });
    }
    const rows = await tx`select * from public.journal_stock_transfers where id = ${line.transferId}::uuid and deleted_at is null for update`;
    const row = rows[0];
    if (!row || row.status !== "confirmed" || row.reserved) {
      throw new ApiClientError(`Stock lot ${line.name} is no longer available. Select the stock again.`, { status: 409, code: "STOCK_NOT_AVAILABLE" });
    }
    if (row.sales_order_id && String(row.sales_order_id) !== o.salesOrderId) {
      throw new ApiClientError(`Stock lot ${row.transfer_no} is already booked on another sales booking.`, { status: 409, code: "STOCK_ALREADY_BOOKED" });
    }
    if (!row.goods_id || !row.warehouse_id) {
      throw new ApiClientError(`Stock lot ${row.transfer_no} has no linked goods or warehouse, so it cannot be sold.`, { status: 409, code: "GOODS_NOT_LINKED" });
    }
    const available = Number(row.quantity);
    if (line.qty > available + EPS) {
      throw new ApiClientError(`Only ${available} remain in ${row.transfer_no}; ${line.qty} cannot be sold.`, { status: 409, code: "STOCK_EXCEEDED" });
    }

    // holds the physical stock first: refuses when the warehouse has no free quantity
    await reserveJournalStockForSale(tx, String(row.goods_id), String(row.warehouse_id), line.qty, 1);

    if (line.qty < available - EPS) {
      // the sold piece is a copy of the allocation with its own number; the original keeps the rest
      const newNo = await nextJournalTransferNo(tx);
      const cols = await journalColumns(tx);
      const select = cols
        .map((c) => {
          if (c === "id") return "gen_random_uuid()";
          if (c === "transfer_no") return "$2::text";
          if (c === "quantity") return "$3::numeric";
          if (c === "reserved") return "true";
          if (c === "sales_order_id") return "$4::uuid";
          if (c === "sales_order_no") return "$5::text";
          if (c === "idempotency_key") return "null";
          return `"${c}"`;
        })
        .join(", ");
      const inserted = await tx.unsafe(
        `insert into public.journal_stock_transfers (${cols.map((c) => `"${c}"`).join(", ")})
         select ${select} from public.journal_stock_transfers where id = $1::uuid returning id`,
        [row.id, newNo, line.qty, o.salesOrderId, o.salesOrderNo]
      );
      if (!inserted[0]?.id) throw new ApiClientError("The sold piece of the stock lot could not be created.", { status: 500, code: "JOURNAL_SPLIT_FAILED" });
      await tx`
        update public.journal_stock_transfers set quantity = quantity - ${line.qty}, updated_at = now()
        where id = ${row.id}::uuid`;
    } else {
      await tx`
        update public.journal_stock_transfers
        set reserved = true, sales_order_id = ${o.salesOrderId}::uuid, sales_order_no = ${o.salesOrderNo}, updated_at = now()
        where id = ${row.id}::uuid`;
    }
  }
}

/** Brings the booking's Stock Journal links in line with its saved goods lines (idempotent). Issued bookings are left alone. */
export async function syncJournalLinksForOrder(
  tx: Tx,
  o: { salesOrderId: string; salesOrderNo: string | null; formData: any }
): Promise<void> {
  if (await hasIssuedJournalLinks(tx, o.salesOrderId)) return;
  await releaseJournalLinksForOrder(tx, o.salesOrderId);
  const lines = journalSaleLinesOf(o.formData);
  if (lines.length > 0) await linkJournalLinesForOrder(tx, { salesOrderId: o.salesOrderId, salesOrderNo: o.salesOrderNo, lines });
}
