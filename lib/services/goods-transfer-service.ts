/**
 * Goods Transfer Journal — the ONE place a purchased lot changes state or place.
 *
 * Financial posting stays on the existing Local Purchase transfer (Roznamcha + ledger). This module only
 * decides and records where the purchased goods physically go, keeping every quantity tied to one permanent
 * purchase_lots identity. Every function takes an open transaction (`tx`) and the caller holds the lot row
 * lock (lockLot) so repeated clicks / concurrent requests serialize instead of double-moving stock.
 *
 * Warehouse stock is mirrored into product_inventory_balances (+ stock_movements) so the existing Inventory
 * screens stay correct; the legacy sale-source lists subtract the lot-managed part (see available-lots.ts)
 * so the same stock is never offered twice.
 */
import { ApiClientError } from "@/lib/api/response";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export type StockState = "available" | "reserved" | "loading" | "in_transit" | "sold" | "exported";
export type TransferPurpose =
  | "own_warehouse"
  | "dgt_warehouse"
  | "third_party_warehouse"
  | "local_sale"
  | "export_customer"
  | "export_dgt_branch"
  | "hold";

export type Place = {
  state: StockState;
  warehouseId?: string | null;
  label?: string;
  rack?: string;
  referenceId?: string | null;
};

const q4 = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
};
const EPS = 0.00005;

/** States that physically sit inside a warehouse (mirrored into product_inventory_balances). */
const IN_WAREHOUSE: StockState[] = ["available", "reserved"];

export function conflict(message: string, code = "CONFLICT"): ApiClientError {
  return new ApiClientError(message, { status: 409, code });
}

// ------------------------------------------------------------------------------------------------
// Lots
// ------------------------------------------------------------------------------------------------

export async function lockLot(tx: Tx, lotId: string) {
  const rows = await tx`select * from public.purchase_lots where id = ${lotId}::uuid for update`;
  if (!rows[0]) throw new ApiClientError("Lot not found.", { status: 404, code: "LOT_NOT_FOUND" });
  return rows[0];
}

type RawLine = Record<string, any>;

function parseLines(p: any): RawLine[] {
  const items: RawLine[] = Array.isArray(p.line_items) ? p.line_items : [];
  if (items.length > 0) return items;
  // Older single-row bill: one line synthesized from the header columns.
  const qty = Number(p.numbers ?? 0) || Number(p.quantity_kgs ?? 0);
  if (qty <= 0) return [];
  return [
    {
      id: `legacy-${p.id}`,
      goodsId: p.goods_id,
      goodsName: p.goods_name,
      brand: p.brand,
      size: p.size,
      origin: p.origin_country_name,
      lotNo: p.lot_no,
      quantityName: p.quantity_name,
      numbers: qty,
      netWeight: p.net_weight,
      totalGrossWeight: p.total_gross_weight,
      finalCost: p.final_cost,
      amount: p.purchase_cost,
    },
  ];
}

/**
 * Creates (once) the permanent lot identity for every line of a POSTED local purchase and puts its
 * quantity at the purchase's current location. Idempotent: never recreates or changes existing lots.
 */
export async function ensureLotsForPurchase(tx: Tx, purchaseId: string, userId: string | null) {
  const [p] = await tx`select * from public.local_purchases where id = ${purchaseId}::uuid and deleted_at is null for update`;
  if (!p) throw new ApiClientError("Purchase not found.", { status: 404, code: "PURCHASE_NOT_FOUND" });
  if (p.status !== "posted" || !p.roznamcha_entry_id) {
    throw conflict("Goods can be transferred only after the purchase is confirmed and posted to Roznamcha/Ledger.", "PURCHASE_NOT_POSTED");
  }
  const existing = await tx`select id from public.purchase_lots where local_purchase_id = ${purchaseId}::uuid limit 1`;
  if (existing[0]) return false;

  const lines = parseLines(p).filter((l) => q4(l.numbers ?? l.quantityCount ?? l.qty ?? 0) > 0);
  if (lines.length === 0) {
    throw conflict("This purchase has no goods quantity, so there is nothing to transfer.", "NO_QUANTITY");
  }

  // Ledgers used by the original posting (DR = purchase/inventory, CR = supplier/payable).
  const rozLines = await tx`
    select ledger_id, debit, credit from public.roznamcha_lines
    where roznamcha_entry_id = ${p.roznamcha_entry_id}::uuid order by id`;
  const purchaseLedgerId = rozLines.find((l: any) => Number(l.debit) > 0)?.ledger_id ?? null;
  const payableLedgerId = rozLines.find((l: any) => Number(l.credit) > 0)?.ledger_id ?? null;

  const currency = String(p.local_currency || p.purchase_currency || "USD").toUpperCase();
  const posted = q4(p.final_cost);
  const lineCost = (l: RawLine) => q4(l.finalCost ?? l.amount ?? l.purchaseCost ?? 0);
  const sumLines = lines.reduce((s, l) => s + lineCost(l), 0);
  // Lot costs always add up to exactly what was posted.
  const factor = sumLines > 0 && posted > 0 ? posted / sumLines : 1;

  const charges: any[] = Array.isArray(p.extra_charges) ? p.extra_charges : [];
  const allocatable = q4(charges.filter((c) => c?.allocate).reduce((s, c) => s + Number(c.amount || 0), 0));

  // Charges flagged "Add to landed cost" are shared by net weight — the SAME basis the Voucher's
  // Charges & Landed Cost table uses (equal split when no weights), so the lot and the voucher agree.
  const totalNet = lines.reduce((s, l) => s + Number(l.netWeight || 0), 0);
  const weightShare = (l: RawLine) => (totalNet > 0 ? Number(l.netWeight || 0) / totalNet : 1 / lines.length);

  let allocatedSoFar = 0;
  let costSoFar = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const qty = q4(l.numbers ?? l.quantityCount ?? l.qty ?? 0);
    if (qty <= 0) continue;
    const isLast = i === lines.length - 1;
    const original = isLast ? q4(posted - costSoFar) : q4(lineCost(l) * factor);
    costSoFar += original;
    const share = allocatable > 0 ? (isLast ? q4(allocatable - allocatedSoFar) : q4(allocatable * weightShare(l))) : 0;
    allocatedSoFar += share;
    const landed = q4(original + share);

    const [lot] = await tx`
      insert into public.purchase_lots (
        lot_ref, local_purchase_id, line_key, goods_id, goods_name, brand, size, origin, lot_no, unit_name,
        country_id, country_branch_id, city_branch_id, qty_purchased, net_weight_kg, gross_weight_kg,
        currency_code, exchange_rate, local_currency, original_cost, landed_cost, unit_cost,
        roznamcha_entry_id, purchase_ledger_id, payable_ledger_id, created_by, source_lot_id, inter_country_trade_id
      ) values (
        ${"LOT-" + new Date().toISOString().slice(2, 4) + new Date().toISOString().slice(5, 7) + "-"}
          || lpad(nextval('public.purchase_lot_seq')::text, 6, '0'),
        ${purchaseId}::uuid, ${String(l.id ?? `line-${i}`)}, ${l.goodsId ?? null}::uuid,
        ${String(l.goodsName || p.goods_name || "Goods")}, ${l.brand ?? null}, ${l.size ?? null},
        ${l.origin ?? null}, ${l.lotNo || p.lot_no || null}, ${String(l.quantityName || p.quantity_name || "Bags")},
        ${p.country_id}::uuid, ${p.country_branch_id}::uuid, ${p.city_branch_id ?? null}::uuid,
        ${qty}, ${q4(l.netWeight ?? 0)}, ${q4(l.totalGrossWeight ?? 0)},
        ${currency}, ${Number(p.exchange_rate || 1) || 1}, ${currency},
        ${original}, ${landed}, ${qty > 0 ? Math.round((landed / qty) * 1e6) / 1e6 : 0},
        ${p.roznamcha_entry_id}::uuid, ${purchaseLedgerId}::uuid, ${payableLedgerId}::uuid, ${userId ?? null}::uuid,
        ${p.source_lot_id ?? null}::uuid, ${p.inter_country_trade_id ?? null}::uuid
      ) returning *`;

    const startWarehouseId: string | null = p.warehouse_id ?? null;
    const startLabel = startWarehouseId ? "" : String(p.warehouse_name || "").trim() || "Purchase location";
    await tx`
      insert into public.lot_stock (lot_id, state, warehouse_id, location_label, rack_bin, qty)
      values (${lot.id}::uuid, 'available', ${startWarehouseId}::uuid, ${startLabel}, '', ${qty})`;
    await tx`
      insert into public.lot_movements (lot_id, movement_type, to_state, qty, to_warehouse_id, reference_type, reference_id, reference_no, notes, created_by)
      values (${lot.id}::uuid, 'initial_receipt', 'available', ${qty}, ${startWarehouseId}::uuid, 'local_purchase', ${purchaseId}::uuid,
              ${p.journal_serial_no ?? null}, 'Lot created from the posted purchase', ${userId ?? null}::uuid)`;

    if (startWarehouseId && lot.goods_id) {
      await mirrorWarehouse(tx, lot, {
        warehouseId: startWarehouseId,
        onHand: qty,
        reserved: 0,
        movementType: "STOCK_IN",
        note: `Lot ${lot.lot_ref} received at purchase warehouse`,
        userId,
        referenceNo: lot.lot_ref,
      });
    }
  }
  return true;
}

// ------------------------------------------------------------------------------------------------
// Stock primitive
// ------------------------------------------------------------------------------------------------

function sameKey(place: Place) {
  return {
    state: place.state,
    wh: place.warehouseId ?? "-",
    rack: place.rack ?? "",
    label: place.label ?? "",
    ref: place.referenceId ?? "-",
  };
}

async function findRow(tx: Tx, lotId: string, place: Place) {
  const k = sameKey(place);
  const rows = await tx`
    select id, qty from public.lot_stock
    where lot_id = ${lotId}::uuid and state = ${k.state}
      and coalesce(warehouse_id::text, '-') = ${k.wh}
      and rack_bin = ${k.rack} and location_label = ${k.label}
      and coalesce(reference_id::text, '-') = ${k.ref}
    for update`;
  return rows[0] ?? null;
}

async function takeFrom(tx: Tx, lotId: string, place: Place, qty: number) {
  const row = await findRow(tx, lotId, place);
  const have = q4(row?.qty ?? 0);
  if (!row || have + EPS < qty) {
    throw conflict(
      `Only ${have} is ${place.state.replace("_", " ")} at that place; ${qty} was requested. A transfer or sale can never exceed the available quantity.`,
      "INSUFFICIENT_STOCK",
    );
  }
  const left = q4(have - qty);
  if (left <= EPS) await tx`delete from public.lot_stock where id = ${row.id}::uuid`;
  else await tx`update public.lot_stock set qty = ${left}, updated_at = now() where id = ${row.id}::uuid`;
}

async function putInto(tx: Tx, lotId: string, place: Place, qty: number) {
  const row = await findRow(tx, lotId, place);
  if (row) {
    await tx`update public.lot_stock set qty = ${q4(Number(row.qty) + qty)}, updated_at = now() where id = ${row.id}::uuid`;
  } else {
    await tx`
      insert into public.lot_stock (lot_id, state, warehouse_id, location_label, rack_bin, qty, reference_id)
      values (${lotId}::uuid, ${place.state}, ${place.warehouseId ?? null}::uuid, ${place.label ?? ""}, ${place.rack ?? ""}, ${qty}, ${place.referenceId ?? null}::uuid)`;
  }
}

/** Mirrors a warehouse quantity change into product_inventory_balances (+ one stock_movements audit row). */
async function mirrorWarehouse(
  tx: Tx,
  lot: any,
  o: { warehouseId: string; onHand: number; reserved: number; movementType: "STOCK_IN" | "STOCK_OUT" | "TRANSFER" | null; note: string; userId: string | null; referenceNo: string | null },
) {
  if (!lot.goods_id) return; // custom goods have no goods master row to mirror against
  const now = new Date().toISOString();
  if (o.onHand !== 0 || o.reserved !== 0) {
    const [g] = await tx`select goods_name, chs_code from public.goods where id = ${lot.goods_id}::uuid`;
    const code = g?.chs_code || "PRD-" + String(lot.goods_id).slice(0, 8);
    await tx`
      insert into public.products (id, product_code, product_name, hs_code, country_id, is_active, created_at, updated_at)
      values (${lot.goods_id}::uuid, ${code}, ${g?.goods_name || lot.goods_name}, ${code}, ${lot.country_id}::uuid, true, ${now}, ${now})
      on conflict (id) do nothing`;
    await tx`
      insert into public.product_inventory_balances (product_id, country_id, country_branch_id, city_branch_id, warehouse_id, quantity_on_hand, quantity_reserved, updated_at)
      values (${lot.goods_id}::uuid, ${lot.country_id}::uuid, ${lot.country_branch_id}::uuid, ${lot.city_branch_id ?? null}::uuid, ${o.warehouseId}::uuid,
              ${Math.max(0, o.onHand)}, ${Math.max(0, o.reserved)}, ${now})
      on conflict (product_id, warehouse_id) do update set
        quantity_on_hand = GREATEST(0, public.product_inventory_balances.quantity_on_hand + ${o.onHand}),
        quantity_reserved = GREATEST(0, public.product_inventory_balances.quantity_reserved + ${o.reserved}),
        updated_at = ${now}`;
  }
  if (o.movementType) {
    const qty = Math.abs(o.onHand);
    if (qty > 0) {
      await tx`
        insert into public.stock_movements (movement_type, goods_id, warehouse_id, country_id, country_branch_id, city_branch_id,
          quantity, unit_cost, total_amount, reference_no, notes, movement_date, created_by, created_at, updated_at)
        values (${o.movementType}, ${lot.goods_id}::uuid, ${o.warehouseId}::uuid, ${lot.country_id}::uuid, ${lot.country_branch_id}::uuid,
                ${lot.city_branch_id ?? null}::uuid, ${qty}, ${Number(lot.unit_cost || 0)}, ${q4(qty * Number(lot.unit_cost || 0))},
                ${o.referenceNo}, ${o.note}, ${now}, ${o.userId ?? null}::uuid, ${now}, ${now})`;
    }
  }
}

export type MoveInput = {
  lot: any;
  from: Place;
  to: Place;
  qty: number;
  movementType: string;
  transferId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  userId: string | null;
};

/** Moves `qty` of a lot from one place/state to another, mirrors warehouse stock, and appends history. */
export async function moveStock(tx: Tx, m: MoveInput) {
  const qty = q4(m.qty);
  if (!(qty > 0)) throw new ApiClientError("Quantity must be greater than zero.", { status: 400, code: "BAD_QTY" });
  await takeFrom(tx, m.lot.id, m.from, qty);
  await putInto(tx, m.lot.id, m.to, qty);

  const fromIn = IN_WAREHOUSE.includes(m.from.state) && m.from.warehouseId ? m.from.warehouseId : null;
  const toIn = IN_WAREHOUSE.includes(m.to.state) && m.to.warehouseId ? m.to.warehouseId : null;
  const fromRes = m.from.state === "reserved" ? 1 : 0;
  const toRes = m.to.state === "reserved" ? 1 : 0;
  const goneKind: "STOCK_OUT" | "TRANSFER" = m.to.state === "sold" || m.to.state === "exported" ? "STOCK_OUT" : "TRANSFER";
  const ref = m.referenceNo ?? m.lot.lot_ref;

  if (fromIn && toIn && fromIn === toIn) {
    // same warehouse: only the reserved portion of the balance can change (rack moves keep total stock)
    if (fromRes !== toRes) {
      await mirrorWarehouse(tx, m.lot, { warehouseId: fromIn, onHand: 0, reserved: (toRes - fromRes) * qty, movementType: null, note: "", userId: m.userId, referenceNo: ref });
    }
  } else {
    if (fromIn) {
      await mirrorWarehouse(tx, m.lot, { warehouseId: fromIn, onHand: -qty, reserved: -fromRes * qty, movementType: goneKind, note: `${m.movementType}: ${m.lot.lot_ref} out`, userId: m.userId, referenceNo: ref });
    }
    if (toIn) {
      await mirrorWarehouse(tx, m.lot, { warehouseId: toIn, onHand: qty, reserved: toRes * qty, movementType: "STOCK_IN", note: `${m.movementType}: ${m.lot.lot_ref} in`, userId: m.userId, referenceNo: ref });
    }
  }

  await tx`
    insert into public.lot_movements (lot_id, transfer_id, movement_type, from_state, to_state, qty, from_warehouse_id, to_warehouse_id,
      from_rack_bin, to_rack_bin, reference_type, reference_id, reference_no, notes, created_by)
    values (${m.lot.id}::uuid, ${m.transferId ?? null}::uuid, ${m.movementType}, ${m.from.state}, ${m.to.state}, ${qty},
            ${m.from.warehouseId ?? null}::uuid, ${m.to.warehouseId ?? null}::uuid, ${m.from.rack ?? ""}, ${m.to.rack ?? ""},
            ${m.referenceType ?? null}, ${m.referenceId ?? null}::uuid, ${m.referenceNo ?? null}, ${m.notes ?? null}, ${m.userId ?? null}::uuid)`;
}

// ------------------------------------------------------------------------------------------------
// Transfers
// ------------------------------------------------------------------------------------------------

export type TransferInput = {
  lotId: string;
  purpose: TransferPurpose;
  qty: number;
  idempotencyKey: string;
  source: { warehouseId?: string | null; label?: string; rack?: string };
  dest?: {
    warehouseId?: string | null;
    rack?: string;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
  };
  provider?: {
    accountId?: string | null;
    name?: string;
    address?: string;
    city?: string;
    contractRef?: string;
    storageCharge?: number | null;
    chargeCurrency?: string | null;
  };
  transport?: Record<string, unknown>;
  notes?: string | null;
  userId: string | null;
};

async function nextTransferNo(tx: Tx) {
  const [r] = await tx`select 'GT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.goods_transfer_seq')::text, 6, '0') as no`;
  return r.no as string;
}

async function loadWarehouse(tx: Tx, id: string | null | undefined, label: string) {
  if (!id) throw new ApiClientError(`${label} is required. Select it from the Warehouse Master.`, { status: 400, code: "WAREHOUSE_REQUIRED" });
  const [w] = await tx`select id, warehouse_code, warehouse_name, country_id, status, is_active, deleted_at from public.warehouses where id = ${id}::uuid`;
  if (!w || w.deleted_at || w.is_active === false) {
    throw new ApiClientError(`${label} was not found in the Warehouse Master or is inactive.`, { status: 400, code: "WAREHOUSE_NOT_FOUND" });
  }
  return w;
}

export async function createTransfer(tx: Tx, input: TransferInput) {
  const lot = await lockLot(tx, input.lotId);
  const qty = q4(input.qty);
  if (!(qty > 0)) throw new ApiClientError("Transfer quantity must be greater than zero.", { status: 400, code: "BAD_QTY" });
  if (!input.idempotencyKey) throw new ApiClientError("An idempotency key is required.", { status: 400, code: "IDEMPOTENCY_REQUIRED" });

  // A repeated click / repeated API call returns the SAME transfer instead of moving stock again.
  const dup = await tx`select * from public.goods_transfers where lot_id = ${lot.id}::uuid and idempotency_key = ${input.idempotencyKey}`;
  if (dup[0]) return { transfer: dup[0], replayed: true };

  const src: Place = { state: "available", warehouseId: input.source.warehouseId ?? null, label: input.source.label ?? "", rack: input.source.rack ?? "" };
  const purpose = input.purpose;
  let destPlace: Place | null = null;
  let status: string = "completed";
  let movementType = "transfer";
  let destWh: any = null;

  if (purpose === "hold") {
    movementType = "hold";
    destPlace = { ...src };
  } else if (purpose === "own_warehouse") {
    destWh = await loadWarehouse(tx, input.dest?.warehouseId, "Destination warehouse");
    if (lot.country_id && destWh.country_id && destWh.country_id !== lot.country_id) {
      throw new ApiClientError("An own warehouse must be in the same country as the purchase. Use Export to Another DGT Country Branch for another country.", { status: 400, code: "WRONG_COUNTRY" });
    }
    const rack = String(input.dest?.rack ?? "").trim();
    if ((src.warehouseId ?? null) === destWh.id && (src.rack ?? "") === rack) {
      throw new ApiClientError("Source and destination are the same warehouse and rack/bin. Choose a different destination.", { status: 400, code: "SAME_PLACE" });
    }
    movementType = (src.warehouseId ?? null) === destWh.id ? "rack_move" : "warehouse_receipt";
    destPlace = { state: "available", warehouseId: destWh.id, rack };
  } else if (purpose === "dgt_warehouse") {
    destWh = await loadWarehouse(tx, input.dest?.warehouseId, "Destination warehouse");
    if (lot.country_id && destWh.country_id && destWh.country_id !== lot.country_id) {
      throw new ApiClientError("The destination warehouse is in another country. That is an Inter-Country Trade: use Export to Another DGT Country Branch.", { status: 400, code: "WRONG_COUNTRY" });
    }
    if (!input.dest?.countryBranchId) {
      throw new ApiClientError("Destination branch is required.", { status: 400, code: "BRANCH_REQUIRED" });
    }
    if ((src.warehouseId ?? null) === destWh.id) {
      throw new ApiClientError("The destination is the same warehouse. Use Own Warehouse for a rack/bin move.", { status: 400, code: "SAME_PLACE" });
    }
    movementType = "dispatch";
    status = "in_transit";
  } else if (purpose === "third_party_warehouse") {
    const pr = input.provider ?? {};
    const missing = [
      !pr.accountId && "provider account",
      !String(pr.name || "").trim() && "warehouse name",
      !String(pr.city || "").trim() && "city",
      !String(pr.address || "").trim() && "address",
      !String(pr.contractRef || "").trim() && "contract/reference",
      (pr.storageCharge == null || Number.isNaN(Number(pr.storageCharge))) && "storage/handling charge",
      !String(pr.chargeCurrency || "").trim() && "charge currency",
    ].filter(Boolean);
    if (missing.length) {
      throw new ApiClientError(`Third-party warehouse requires: ${missing.join(", ")}.`, { status: 400, code: "PROVIDER_FIELDS_REQUIRED" });
    }
    const [acct] = await tx`select id, deleted_at from public.enterprise_accounts where id = ${pr.accountId}::uuid`;
    if (!acct || acct.deleted_at) {
      throw new ApiClientError("The warehouse provider account does not exist. Create it in Account Setup first; accounts are never auto-created.", { status: 400, code: "PROVIDER_ACCOUNT_NOT_FOUND" });
    }
    movementType = "third_party_custody";
    // The goods stay DGT-owned: held at a labelled third-party place, not sold or handed to a customer.
    destPlace = { state: "available", warehouseId: null, label: `3P: ${String(pr.name).trim()} — ${String(pr.city).trim()}`, rack: "" };
  } else {
    throw new ApiClientError(`The purpose "${purpose}" is not handled by this endpoint.`, { status: 400, code: "BAD_PURPOSE" });
  }

  const transferNo = await nextTransferNo(tx);
  const [row] = await tx`
    insert into public.goods_transfers (
      transfer_no, local_purchase_id, lot_id, purpose, status, qty,
      source_warehouse_id, source_location_label, source_rack_bin,
      dest_warehouse_id, dest_rack_bin, dest_country_id, dest_country_branch_id, dest_city_branch_id,
      provider_account_id, provider_name, provider_address, provider_city, contract_ref, storage_charge, charge_currency,
      transport, idempotency_key, notes, created_by, completed_at
    ) values (
      ${transferNo}, ${lot.local_purchase_id}::uuid, ${lot.id}::uuid, ${purpose}, ${status}, ${qty},
      ${src.warehouseId ?? null}::uuid, ${src.label ?? ""}, ${src.rack ?? ""},
      ${destWh?.id ?? null}::uuid, ${String(input.dest?.rack ?? "")}, ${destWh?.country_id ?? input.dest?.countryId ?? null}::uuid,
      ${input.dest?.countryBranchId ?? null}::uuid, ${input.dest?.cityBranchId ?? null}::uuid,
      ${input.provider?.accountId ?? null}::uuid, ${input.provider?.name ?? null}, ${input.provider?.address ?? null}, ${input.provider?.city ?? null},
      ${input.provider?.contractRef ?? null}, ${input.provider?.storageCharge ?? null}, ${input.provider?.chargeCurrency ?? null},
      ${tx.json((input.transport ?? {}) as any)}, ${input.idempotencyKey}, ${input.notes ?? null}, ${input.userId ?? null}::uuid,
      ${status === "completed" ? new Date().toISOString() : null}
    ) returning *`;

  if (purpose === "dgt_warehouse") {
    await moveStock(tx, {
      lot, from: src, to: { state: "in_transit", referenceId: row.id, label: `To ${destWh.warehouse_name}` }, qty,
      movementType, transferId: row.id, referenceType: "goods_transfer", referenceId: row.id, referenceNo: transferNo,
      notes: input.notes ?? null, userId: input.userId,
    });
  } else if (destPlace) {
    await moveStock(tx, {
      lot, from: src, to: destPlace, qty, movementType, transferId: row.id, referenceType: "goods_transfer", referenceId: row.id,
      referenceNo: transferNo, notes: input.notes ?? null, userId: input.userId,
    });
  }
  await syncDestinationQueueFlags(tx, lot.local_purchase_id, purpose, input.userId);
  return { transfer: row, replayed: false };
}

/** Keeps the existing Warehouse Transfer / Loading / Export queue pages in step with what was actually decided. */
async function syncDestinationQueueFlags(tx: Tx, purchaseId: string, purpose: TransferPurpose, userId: string | null) {
  if (purpose === "own_warehouse" || purpose === "dgt_warehouse" || purpose === "third_party_warehouse") {
    await tx`
      update public.local_purchases set warehouse_transfer_status = coalesce(warehouse_transfer_status, 'in_progress'), updated_at = now()
      where id = ${purchaseId}::uuid and (warehouse_transfer_status is null or warehouse_transfer_status = '')`;
  }
}

export async function receiveTransfer(tx: Tx, transferId: string, o: { rack?: string; userId: string | null }) {
  const [t0] = await tx`select lot_id from public.goods_transfers where id = ${transferId}::uuid`;
  if (!t0) throw new ApiClientError("Transfer not found.", { status: 404, code: "TRANSFER_NOT_FOUND" });
  const lot = await lockLot(tx, t0.lot_id);
  const [t] = await tx`select * from public.goods_transfers where id = ${transferId}::uuid for update`;
  if (t.status === "received" || t.status === "completed") return { transfer: t, replayed: true };
  if (t.status !== "in_transit") throw conflict(`Only an In Transit transfer can be received (this one is ${t.status}).`, "NOT_IN_TRANSIT");
  const [wh] = await tx`select warehouse_name from public.warehouses where id = ${t.dest_warehouse_id}::uuid`;
  const rack = String(o.rack ?? t.dest_rack_bin ?? "").trim();
  await moveStock(tx, {
    lot,
    from: { state: "in_transit", referenceId: t.id, label: `To ${wh?.warehouse_name ?? ""}` },
    to: { state: "available", warehouseId: t.dest_warehouse_id, rack },
    qty: Number(t.qty), movementType: "warehouse_receipt", transferId: t.id, referenceType: "goods_transfer", referenceId: t.id,
    referenceNo: t.transfer_no, notes: "Received at destination warehouse", userId: o.userId,
  });
  const [u] = await tx`
    update public.goods_transfers set status = 'completed', dest_rack_bin = ${rack}, completed_at = now(), updated_at = now()
    where id = ${t.id}::uuid returning *`;
  return { transfer: u, replayed: false };
}

/**
 * Reverses a transfer that has not been sold/exported. In Transit / confirmed → back to the source place;
 * already received/completed → returned from the destination back to the source. Always an audited movement.
 */
export async function cancelTransfer(tx: Tx, transferId: string, o: { reason: string; userId: string | null }) {
  const [t0] = await tx`select lot_id from public.goods_transfers where id = ${transferId}::uuid`;
  if (!t0) throw new ApiClientError("Transfer not found.", { status: 404, code: "TRANSFER_NOT_FOUND" });
  const lot = await lockLot(tx, t0.lot_id);
  const [t] = await tx`select * from public.goods_transfers where id = ${transferId}::uuid for update`;
  if (t.status === "cancelled" || t.status === "returned") return { transfer: t, replayed: true };
  if (!String(o.reason || "").trim()) throw new ApiClientError("A reason is required to cancel or return a transfer.", { status: 400, code: "REASON_REQUIRED" });
  if (["local_sale", "export_customer", "export_dgt_branch"].includes(t.purpose)) {
    throw conflict("Sale and export transfers are cancelled from the Sales Order / Inter-Country Trade, not from here.", "USE_SALES_FLOW");
  }
  const srcPlace: Place = { state: "available", warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "" };
  let from: Place;
  if (t.status === "in_transit") {
    const [wh] = await tx`select warehouse_name from public.warehouses where id = ${t.dest_warehouse_id}::uuid`;
    from = { state: "in_transit", referenceId: t.id, label: `To ${wh?.warehouse_name ?? ""}` };
  } else if (t.purpose === "third_party_warehouse") {
    from = { state: "available", warehouseId: null, label: `3P: ${String(t.provider_name).trim()} — ${String(t.provider_city).trim()}`, rack: "" };
  } else if (t.purpose === "hold") {
    const [u] = await tx`update public.goods_transfers set status='cancelled', cancel_reason=${o.reason}, updated_at=now() where id=${t.id}::uuid returning *`;
    await tx`insert into public.lot_movements (lot_id, transfer_id, movement_type, from_state, to_state, qty, reference_type, reference_id, reference_no, notes, created_by)
             values (${lot.id}::uuid, ${t.id}::uuid, 'cancel', 'available', 'available', ${t.qty}, 'goods_transfer', ${t.id}::uuid, ${t.transfer_no}, ${o.reason}, ${o.userId ?? null}::uuid)`;
    return { transfer: u, replayed: false };
  } else {
    from = { state: "available", warehouseId: t.dest_warehouse_id, rack: t.dest_rack_bin ?? "" };
  }
  await moveStock(tx, {
    lot, from, to: srcPlace, qty: Number(t.qty),
    movementType: t.status === "in_transit" ? "cancel" : "return",
    transferId: t.id, referenceType: "goods_transfer", referenceId: t.id, referenceNo: t.transfer_no, notes: o.reason, userId: o.userId,
  });
  const [u] = await tx`
    update public.goods_transfers set status = ${t.status === "in_transit" ? "cancelled" : "returned"}, cancel_reason = ${o.reason}, updated_at = now()
    where id = ${t.id}::uuid returning *`;
  return { transfer: u, replayed: false };
}

// ------------------------------------------------------------------------------------------------
// Journal read model
// ------------------------------------------------------------------------------------------------

export async function getJournal(tx: Tx, purchaseId: string) {
  const [p] = await tx`
    select lp.*, co.name as country_name, cb.name as branch_name, cib.city_name as city_name
    from public.local_purchases lp
    left join public.countries co on co.id = lp.country_id
    left join public.country_branches cb on cb.id = lp.country_branch_id
    left join public.city_branches cib on cib.id = lp.city_branch_id
    where lp.id = ${purchaseId}::uuid and lp.deleted_at is null`;
  if (!p) throw new ApiClientError("Purchase not found.", { status: 404, code: "PURCHASE_NOT_FOUND" });

  // Independent reads are issued together (pipelined on the one connection): the DB can be a long way away,
  // so the number of round trips, not the size of the data, is what the user waits for.
  const [lots, transfers, destTradeRows] = await Promise.all([
    tx`
      select l.*, b.qty_available, b.qty_reserved, b.qty_loading, b.qty_in_transit, b.qty_sold, b.qty_exported, b.qty_accounted
      from public.purchase_lots l join public.purchase_lot_balance_v b on b.lot_id = l.id
      where l.local_purchase_id = ${purchaseId}::uuid order by l.created_at, l.line_key`,
    tx`
      select t.*, sw.warehouse_name as source_warehouse_name, dw.warehouse_name as dest_warehouse_name, dw.warehouse_code as dest_warehouse_code
      from public.goods_transfers t
      left join public.warehouses sw on sw.id = t.source_warehouse_id
      left join public.warehouses dw on dw.id = t.dest_warehouse_id
      where t.local_purchase_id = ${purchaseId}::uuid order by t.created_at desc`,
    p.inter_country_trade_id
      ? tx`
          select t.*, sc.name as source_country_name, dc.name as dest_country_name, sp.goods_name as goods_name
          from public.inter_country_trades t
          left join public.countries sc on sc.id = t.source_country_id
          left join public.countries dc on dc.id = t.dest_country_id
          left join public.local_purchases sp on sp.id = t.source_purchase_id
          where t.id = ${p.inter_country_trade_id}::uuid`
      : Promise.resolve([] as any[]),
  ]);
  const lotIds = lots.map((l: any) => l.id);
  const saleIds = Array.from(new Set(transfers.map((t: any) => t.sales_order_id).filter(Boolean)));
  const [stock, movements, trades, sales] = await Promise.all([
    lotIds.length
      ? tx`
          select s.*, w.warehouse_code, w.warehouse_name
          from public.lot_stock s left join public.warehouses w on w.id = s.warehouse_id
          where s.lot_id = any(${lotIds}::uuid[]) order by s.state, w.warehouse_name nulls last`
      : Promise.resolve([] as any[]),
    lotIds.length
      ? tx`
          select m.*, fw.warehouse_name as from_warehouse_name, tw.warehouse_name as to_warehouse_name, l.lot_ref, pr.full_name as user_name
          from public.lot_movements m
          join public.purchase_lots l on l.id = m.lot_id
          left join public.warehouses fw on fw.id = m.from_warehouse_id
          left join public.warehouses tw on tw.id = m.to_warehouse_id
          left join public.profiles pr on pr.id = m.created_by
          where m.lot_id = any(${lotIds}::uuid[]) order by m.created_at, m.id`
      : Promise.resolve([] as any[]),
    lotIds.length
      ? tx`select * from public.inter_country_trades where source_lot_id = any(${lotIds}::uuid[]) order by created_at desc`
      : Promise.resolve([] as any[]),
    saleIds.length
      ? tx`
          select id, sales_order_no, customer_name, order_total, currency_code, ledger_posting_status, payment_status, sales_status, delivery_status, order_date,
                 dest_country_id, form_data->'interCountryTrade'->>'tradeRef' as trade_ref,
                 (form_data->'form'->>'saleMode') as sale_mode,
                 jsonb_strip_nulls(jsonb_build_object(
                   'containerNumbers', form_data->'form'->'containerNumbers', 'containerCount', form_data->'form'->'containerCount',
                   'containerSize', form_data->'form'->'containerSize', 'vesselName', form_data->'form'->'vesselName', 'sealNumber', form_data->'form'->'sealNumber',
                   'loadingCountry', form_data->'form'->'loadingCountry', 'loadingPort', form_data->'form'->'loadingPort', 'loadingDate', form_data->'form'->'loadingDate',
                   'receivedCountry', form_data->'form'->'receivedCountry', 'receivedPort', form_data->'form'->'receivedPort', 'receivedDate', form_data->'form'->'receivedDate',
                   'transportAgent', form_data->'form'->'transportAgent', 'airlineName', form_data->'form'->'airlineName')) as shipping
          from public.sales_orders where id = any(${saleIds}::uuid[])`
      : Promise.resolve([] as any[]),
  ]);
  const destTrade = destTradeRows[0];
  const costEntryIds = transfers.map((t: any) => t.cost_roznamcha_entry_id).filter(Boolean);
  const received = (lotId: string) =>
    movements.filter((m: any) => m.lot_id === lotId && m.movement_type === "initial_receipt").reduce((s: number, m: any) => s + Number(m.qty), 0);

  return {
    purchase: {
      id: p.id, status: p.status, supplier: p.supplier_name, goods: p.goods_name, paymentMode: p.payment_mode,
      finalCost: Number(p.final_cost), currency: p.local_currency || p.purchase_currency, exchangeRate: Number(p.exchange_rate),
      advanceAmount: Number(p.advance_amount ?? 0), remainingBalance: Number(p.remaining_balance ?? 0),
      journalSerialNo: p.journal_serial_no, roznamchaEntryId: p.roznamcha_entry_id, postedAt: p.transferred_at,
      countryId: p.country_id, countryBranchId: p.country_branch_id, cityBranchId: p.city_branch_id,
      countryName: p.country_name, branchName: p.branch_name, cityName: p.city_name,
      warehouseId: p.warehouse_id, warehouseName: p.warehouse_name, manualBillNo: p.manual_bill_no, lotNo: p.lot_no,
      extraCharges: p.extra_charges ?? [], loadingDetails: p.loading_details ?? {},
      interCountryTradeId: p.inter_country_trade_id, sourceLotId: p.source_lot_id,
    },
    lots: lots.map((l: any) => ({
      ...l,
      balance: {
        purchased: Number(l.qty_purchased), received: received(l.id), reserved: Number(l.qty_reserved), loading: Number(l.qty_loading),
        inTransit: Number(l.qty_in_transit), sold: Number(l.qty_sold), exported: Number(l.qty_exported), available: Number(l.qty_available),
        transferred: transfers.filter((t: any) => t.lot_id === l.id && ["in_transit", "completed", "received"].includes(t.status) && t.purpose !== "hold").reduce((s: number, t: any) => s + Number(t.qty), 0),
      },
      stock: stock.filter((s: any) => s.lot_id === l.id),
    })),
    transfers,
    movements,
    trades,
    sales,
    destinationTrade: destTrade ?? null,
    costEntryIds,
  };
}

// ------------------------------------------------------------------------------------------------
// Sales (Local Market Sale / Export to Customer)
// A Sales Order DRAFT reserves quantity; the final billing/dispatch confirmation deducts it exactly once.
// ------------------------------------------------------------------------------------------------

export type SaleEntry = {
  lotId: string;
  qty: number;
  warehouseId?: string | null;
  rack?: string;
  label?: string;
};

const placeKey = (e: { warehouseId?: string | null; rack?: string; label?: string }) =>
  `${e.warehouseId ?? "-"}:${e.rack ?? ""}:${e.label ?? ""}`;

/**
 * Makes the reservations for a Sales Order match its goods lines (create / resize / release).
 * Idempotent per (order, lot, place): saving the draft again never reserves twice.
 */
export async function syncSaleReservations(
  tx: Tx,
  o: { salesOrderId: string; salesOrderNo: string | null; mode: "local" | "export"; countryId: string | null; entries: SaleEntry[]; userId: string | null },
) {
  const purpose: TransferPurpose = o.mode === "export" ? "export_customer" : "local_sale";
  const wanted = new Map<string, SaleEntry>();
  for (const e of o.entries) {
    if (!e.lotId || !(q4(e.qty) > 0)) continue;
    const k = `sale:${o.salesOrderId}:${e.lotId}:${placeKey(e)}`;
    const prev = wanted.get(k);
    wanted.set(k, prev ? { ...prev, qty: q4(prev.qty + e.qty) } : { ...e, qty: q4(e.qty) });
  }

  const existing = await tx`
    select t.* from public.goods_transfers t
    where t.sales_order_id = ${o.salesOrderId}::uuid and t.purpose in ('local_sale','export_customer') and t.status = 'confirmed'
    for update`;
  const existingByKey = new Map<string, any>(existing.map((t: any) => [t.idempotency_key, t]));
  const results: any[] = [];

  // release reservations whose line was removed
  for (const t of existing) {
    if (!wanted.has(t.idempotency_key)) await releaseOne(tx, t, "Removed from the sales order", o.userId);
  }

  for (const [key, e] of wanted) {
    const lot = await lockLot(tx, e.lotId);
    if (o.countryId && lot.country_id && lot.country_id !== o.countryId) {
      throw new ApiClientError(`Lot ${lot.lot_ref} belongs to another country and cannot be sold from this scope.`, { status: 403, code: "LOT_COUNTRY_MISMATCH" });
    }
    const src: Place = { state: "available", warehouseId: e.warehouseId ?? null, label: e.label ?? "", rack: e.rack ?? "" };
    const cur = existingByKey.get(key);
    if (!cur) {
      const transferNo = await nextTransferNo(tx);
      const [row] = await tx`
        insert into public.goods_transfers (transfer_no, local_purchase_id, lot_id, purpose, status, qty, source_warehouse_id, source_location_label,
          source_rack_bin, sales_order_id, idempotency_key, notes, created_by)
        values (${transferNo}, ${lot.local_purchase_id}::uuid, ${lot.id}::uuid, ${purpose}, 'confirmed', ${e.qty}, ${src.warehouseId ?? null}::uuid,
          ${src.label ?? ""}, ${src.rack ?? ""}, ${o.salesOrderId}::uuid, ${key}, ${`Reserved by sales order ${o.salesOrderNo ?? ""}`.trim()}, ${o.userId ?? null}::uuid)
        returning *`;
      await moveStock(tx, {
        lot, from: src, to: { state: "reserved", warehouseId: src.warehouseId ?? null, label: src.label ?? "", rack: src.rack ?? "", referenceId: row.id }, qty: e.qty,
        movementType: "reserve", transferId: row.id, referenceType: "sales_order", referenceId: o.salesOrderId, referenceNo: o.salesOrderNo, userId: o.userId,
      });
      results.push(row);
    } else if (q4(cur.qty) !== e.qty) {
      const diff = q4(e.qty - Number(cur.qty));
      const resPlace: Place = { state: "reserved", warehouseId: src.warehouseId ?? null, label: src.label ?? "", rack: src.rack ?? "", referenceId: cur.id };
      if (diff > 0) {
        await moveStock(tx, { lot, from: src, to: resPlace, qty: diff, movementType: "reserve", transferId: cur.id, referenceType: "sales_order", referenceId: o.salesOrderId, referenceNo: o.salesOrderNo, notes: "Order quantity increased", userId: o.userId });
      } else {
        await moveStock(tx, { lot, from: resPlace, to: src, qty: -diff, movementType: "release", transferId: cur.id, referenceType: "sales_order", referenceId: o.salesOrderId, referenceNo: o.salesOrderNo, notes: "Order quantity reduced", userId: o.userId });
      }
      const [u] = await tx`update public.goods_transfers set qty = ${e.qty}, updated_at = now() where id = ${cur.id}::uuid returning *`;
      results.push(u);
    } else {
      results.push(cur);
    }
  }
  return results;
}

async function releaseOne(tx: Tx, t: any, reason: string, userId: string | null) {
  const lot = await lockLot(tx, t.lot_id);
  const res: Place = { state: "reserved", warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "", referenceId: t.id };
  const back: Place = { state: "available", warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "" };
  // an export reservation may already be loading / in transit: release from wherever it currently sits
  const holders = await tx`
    select state, warehouse_id, location_label, rack_bin, qty from public.lot_stock
    where lot_id = ${t.lot_id}::uuid and reference_id = ${t.id}::uuid and state in ('reserved','loading','in_transit') for update`;
  for (const h of holders.length ? holders : [{ state: "reserved", warehouse_id: res.warehouseId, location_label: res.label, rack_bin: res.rack, qty: t.qty }]) {
    await moveStock(tx, {
      lot, from: { state: h.state, warehouseId: h.warehouse_id, label: h.location_label, rack: h.rack_bin, referenceId: t.id }, to: back, qty: Number(h.qty),
      movementType: "release", transferId: t.id, referenceType: "sales_order", referenceId: t.sales_order_id, referenceNo: t.transfer_no, notes: reason, userId,
    });
  }
  await tx`update public.goods_transfers set status = 'cancelled', cancel_reason = ${reason}, updated_at = now() where id = ${t.id}::uuid`;
}

/** Releases every still-open line of a sales order (order deleted / cancelled before final billing). */
export async function releaseSaleReservations(tx: Tx, salesOrderId: string, reason: string, userId: string | null) {
  const rows = await tx`
    select * from public.goods_transfers where sales_order_id = ${salesOrderId}::uuid and purpose in ('local_sale','export_customer') and status = 'confirmed' for update`;
  for (const t of rows) await releaseOne(tx, t, reason, userId);
  return rows.length;
}

/**
 * Final billing/dispatch confirmation: reserved (or loading / in transit) → sold / exported, exactly once.
 * A second call finds no `confirmed` transfer and does nothing.
 */
export async function finalizeSaleStock(tx: Tx, o: { salesOrderId: string; salesOrderNo: string | null; userId: string | null }) {
  const rows = await tx`
    select * from public.goods_transfers where sales_order_id = ${o.salesOrderId}::uuid and purpose in ('local_sale','export_customer') and status = 'confirmed' for update`;
  const done: any[] = [];
  for (const t of rows) {
    const lot = await lockLot(tx, t.lot_id);
    const final: StockState = t.purpose === "export_customer" ? "exported" : "sold";
    const holders = await tx`
      select state, warehouse_id, location_label, rack_bin, qty from public.lot_stock
      where lot_id = ${t.lot_id}::uuid and reference_id = ${t.id}::uuid and state in ('reserved','loading','in_transit') for update`;
    let remaining = Number(t.qty);
    for (const h of holders) {
      const take = Math.min(remaining, Number(h.qty));
      if (take <= 0) continue;
      await moveStock(tx, {
        lot,
        from: { state: h.state, warehouseId: h.warehouse_id, label: h.location_label, rack: h.rack_bin, referenceId: t.id },
        to: { state: final, warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "", referenceId: t.id },
        qty: take, movementType: final === "exported" ? "export" : "sale", transferId: t.id, referenceType: "sales_order", referenceId: o.salesOrderId,
        referenceNo: o.salesOrderNo, notes: "Final billing / dispatch confirmed", userId: o.userId,
      });
      remaining = q4(remaining - take);
    }
    if (remaining > EPS) throw conflict(`Reserved stock for lot ${lot.lot_ref} is short by ${remaining}; the sale cannot be finalized.`, "RESERVATION_SHORT");
    const [u] = await tx`update public.goods_transfers set status = 'completed', completed_at = now(), updated_at = now() where id = ${t.id}::uuid returning *`;
    done.push(u);
  }
  return done;
}

/** Export order progress before final billing: reserved → loading → in transit (still not deducted). */
export async function advanceExportStock(tx: Tx, o: { transferId: string; to: "loading" | "in_transit"; userId: string | null }) {
  const [t0] = await tx`select lot_id from public.goods_transfers where id = ${o.transferId}::uuid`;
  if (!t0) throw new ApiClientError("Transfer not found.", { status: 404, code: "TRANSFER_NOT_FOUND" });
  const lot = await lockLot(tx, t0.lot_id);
  const [t] = await tx`select * from public.goods_transfers where id = ${o.transferId}::uuid for update`;
  if (t.purpose !== "export_customer" || t.status !== "confirmed") throw conflict("Only an open export reservation can move to Loading / In Transit.", "NOT_EXPORT_OPEN");
  const fromState: StockState = o.to === "loading" ? "reserved" : "loading";
  const [h] = await tx`select state, warehouse_id, location_label, rack_bin from public.lot_stock where lot_id = ${t.lot_id}::uuid and reference_id = ${t.id}::uuid and state = ${fromState}`;
  if (!h) throw conflict(`The quantity is not in the ${fromState.replace("_", " ")} state, so it cannot move to ${o.to.replace("_", " ")}.`, "WRONG_STATE");
  await moveStock(tx, {
    lot, from: { state: fromState, warehouseId: h.warehouse_id, label: h.location_label, rack: h.rack_bin, referenceId: t.id },
    to: { state: o.to, warehouseId: o.to === "loading" ? h.warehouse_id : null, label: o.to === "loading" ? h.location_label : "In transit to customer", rack: o.to === "loading" ? h.rack_bin : "", referenceId: t.id },
    qty: Number(t.qty), movementType: o.to, transferId: t.id, referenceType: "goods_transfer", referenceId: t.id, referenceNo: t.transfer_no, userId: o.userId,
  });
  return t;
}

const rozType = (row: any) => (row.city_branch_id ? "branch" : row.country_branch_id ? "branch" : row.country_id ? "country" : "super_admin");

/**
 * Cost-of-sales / inventory effect for a finalized sale or export. A separate human-confirmed posting:
 * DR Cost of Sales (chosen ledger) / CR Inventory (the lot's own purchase ledger) at the lot's POSTED cost,
 * so the inventory account nets to zero for the quantity sold. Once only (unique entry per transfer).
 */
export async function postCostOfSales(tx: Tx, o: { transferId: string; cogsLedgerId: string; userId: string | null }) {
  const [t0] = await tx`select lot_id from public.goods_transfers where id = ${o.transferId}::uuid`;
  if (!t0) throw new ApiClientError("Transfer not found.", { status: 404, code: "TRANSFER_NOT_FOUND" });
  const lot = await lockLot(tx, t0.lot_id);
  const [t] = await tx`select * from public.goods_transfers where id = ${o.transferId}::uuid for update`;
  if (t.cost_roznamcha_entry_id) return { transfer: t, replayed: true };
  if (t.status !== "completed" || !["local_sale", "export_customer", "export_dgt_branch"].includes(t.purpose)) {
    throw conflict("Cost of sales can be posted only after the sale / export is finalized.", "NOT_FINALIZED");
  }
  if (!lot.purchase_ledger_id) throw conflict("This lot has no inventory (purchase) ledger recorded, so the inventory effect cannot be posted.", "NO_INVENTORY_LEDGER");
  const [cogs] = await tx`select id, country_id, country_branch_id, city_branch_id, deleted_at from public.ledgers where id = ${o.cogsLedgerId}::uuid`;
  if (!cogs || cogs.deleted_at) throw new ApiClientError("The selected cost-of-sales ledger does not exist.", { status: 400, code: "COGS_LEDGER_NOT_FOUND" });
  if (cogs.id === lot.purchase_ledger_id) throw new ApiClientError("Cost of sales and inventory must be different ledgers.", { status: 400, code: "SAME_LEDGER" });
  if (cogs.country_id && lot.country_id && cogs.country_id !== lot.country_id) {
    throw new ApiClientError("The cost-of-sales ledger belongs to another country.", { status: 400, code: "COGS_COUNTRY_MISMATCH" });
  }
  const amount = q4((Number(t.qty) * Number(lot.original_cost)) / Number(lot.qty_purchased));
  if (!(amount > 0)) throw conflict("The cost amount is zero, so there is nothing to post.", "ZERO_COST");
  const cur = String(lot.currency_code);
  const lines = [
    { ledgerId: cogs.id, paymentEntryType: "debit", description: `DR: Cost of Sales - ${lot.goods_name} (${lot.lot_ref})`, debit: amount, credit: 0, currency: cur, exchangeRate: 1 },
    { ledgerId: lot.purchase_ledger_id, paymentEntryType: "credit", description: `CR: Inventory - ${lot.goods_name} (${lot.lot_ref})`, debit: 0, credit: amount, currency: cur, exchangeRate: 1 },
  ];
  const ref = `COS-${t.transfer_no}`;
  const [posted] = await tx`
    select post_roznamcha_entry(${rozType(lot)}::roznamcha_type, ${lot.country_id}::uuid, ${lot.country_branch_id}::uuid, ${lot.city_branch_id ?? null}::uuid,
      ${`JV-${ref}`}, ${`ROZ-${ref}`}, ${new Date().toISOString().slice(0, 10)}::date, ${null}, ${ref},
      ${`Cost of sales: ${lot.goods_name} ${t.qty} ${lot.unit_name} - lot ${lot.lot_ref} - ${t.transfer_no}`}, ${tx.json(lines as any)}, true) as id`;
  const entryId = posted?.id as string | undefined;
  if (!entryId) throw new Error("Roznamcha posting did not return an entry id.");
  await tx`
    update public.roznamcha_entries set source_module = 'goods_transfer', source_transaction_type = 'cost_of_sales', source_transaction_id = ${t.id}::uuid,
      source_reference_no = ${ref}, original_currency_code = ${cur}, currency_name = ${cur}, base_currency_amount = ${amount}, entry_category = 'business', updated_at = now()
    where id = ${entryId}::uuid`;
  const [u] = await tx`
    update public.goods_transfers set cost_roznamcha_entry_id = ${entryId}::uuid, cost_amount = ${amount}, cost_currency = ${cur}, cost_posted_at = now(),
      cost_posted_by = ${o.userId ?? null}::uuid, updated_at = now() where id = ${t.id}::uuid returning *`;
  return { transfer: u, replayed: false };
}

// ------------------------------------------------------------------------------------------------
// Inter-Country Trade (export to another DGT country branch)
// DGT keeps separate accounting per country, so this is a real trade, not a stock transfer:
//   source country : Export Sale (inter-country receivable / export sales) + cost of sales / inventory
//   destination    : linked Purchase, In Transit until an authorized receipt; only then DR inventory /
//                    CR intercompany payable and warehouse stock +qty.
// Both sides carry ONE permanent trade reference. The destination currency amount is converted ONCE here.
// ------------------------------------------------------------------------------------------------

async function loadLedgerInCountry(tx: Tx, id: string | null | undefined, countryId: string, label: string) {
  if (!id) throw new ApiClientError(`${label} is required.`, { status: 400, code: "LEDGER_REQUIRED" });
  const [l] = await tx`
    select l.id, l.code, l.name, l.enterprise_account_id, l.deleted_at,
           coalesce(l.country_id, (select c.country_id from public.city_branches c where c.id = l.city_branch_id),
                    (select b.country_id from public.country_branches b where b.id = l.country_branch_id)) as eff_country
    from public.ledgers l where l.id = ${id}::uuid`;
  if (!l || l.deleted_at) throw new ApiClientError(`${label} does not exist. Ledgers are never auto-created; choose an existing one.`, { status: 400, code: "LEDGER_NOT_FOUND" });
  if (l.eff_country && l.eff_country !== countryId) {
    throw new ApiClientError(`${label} belongs to another country's books.`, { status: 400, code: "LEDGER_COUNTRY_MISMATCH" });
  }
  return l;
}

async function postTwoLine(
  tx: Tx,
  o: {
    scope: { country_id: string; country_branch_id: string | null; city_branch_id: string | null };
    ref: string;
    narration: string;
    drLedgerId: string;
    crLedgerId: string;
    amount: number;
    currency: string;
    sourceType: string;
    sourceId: string;
    drDesc: string;
    crDesc: string;
  },
) {
  const lines = [
    { ledgerId: o.drLedgerId, paymentEntryType: "debit", description: o.drDesc, debit: o.amount, credit: 0, currency: o.currency, exchangeRate: 1 },
    { ledgerId: o.crLedgerId, paymentEntryType: "credit", description: o.crDesc, debit: 0, credit: o.amount, currency: o.currency, exchangeRate: 1 },
  ];
  const [posted] = await tx`
    select post_roznamcha_entry(${rozType(o.scope)}::roznamcha_type, ${o.scope.country_id}::uuid, ${o.scope.country_branch_id}::uuid, ${o.scope.city_branch_id ?? null}::uuid,
      ${`JV-${o.ref}`}, ${`ROZ-${o.ref}`}, ${new Date().toISOString().slice(0, 10)}::date, ${null}, ${o.ref}, ${o.narration}, ${tx.json(lines as any)}, true) as id`;
  const entryId = posted?.id as string | undefined;
  if (!entryId) throw new Error("Roznamcha posting did not return an entry id.");
  await tx`
    update public.roznamcha_entries set source_module = 'goods_transfer', source_transaction_type = ${o.sourceType}, source_transaction_id = ${o.sourceId}::uuid,
      source_reference_no = ${o.ref}, original_currency_code = ${o.currency}, currency_name = ${o.currency}, base_currency_amount = ${o.amount},
      entry_category = 'business', updated_at = now()
    where id = ${entryId}::uuid`;
  return entryId;
}

export type TradeInput = {
  lotId: string;
  qty: number;
  idempotencyKey: string;
  source: { warehouseId?: string | null; label?: string; rack?: string };
  destCountryBranchId: string;
  destCityBranchId?: string | null;
  destBranchCode: string;
  destWarehouseId: string;
  approvedExchangeRate: number;
  saleUnitRate: number;
  ledgers: { receivable: string; sales: string; cogs: string; destInventory: string; destPayable: string };
  transport?: Record<string, unknown>;
  notes?: string | null;
  userId: string | null;
};

export async function createInterCountryTrade(tx: Tx, input: TradeInput) {
  const lot = await lockLot(tx, input.lotId);
  const qty = q4(input.qty);
  const rate = Number(input.approvedExchangeRate);
  const unitRate = Number(input.saleUnitRate);
  if (!(qty > 0)) throw new ApiClientError("Quantity must be greater than zero.", { status: 400, code: "BAD_QTY" });
  if (!(rate > 0)) throw new ApiClientError("An approved exchange rate greater than zero is required.", { status: 400, code: "RATE_REQUIRED" });
  if (!(unitRate > 0)) throw new ApiClientError("The inter-country sale rate is required.", { status: 400, code: "SALE_RATE_REQUIRED" });
  if (!input.idempotencyKey) throw new ApiClientError("An idempotency key is required.", { status: 400, code: "IDEMPOTENCY_REQUIRED" });

  const dup = await tx`select * from public.goods_transfers where lot_id = ${lot.id}::uuid and idempotency_key = ${input.idempotencyKey}`;
  if (dup[0]) {
    const [trade] = await tx`select * from public.inter_country_trades where goods_transfer_id = ${dup[0].id}::uuid`;
    return { transfer: dup[0], trade, replayed: true };
  }

  const [branch] = await tx`
    select b.id, b.country_id, b.code, b.name, b.local_currency, b.deleted_at from public.country_branches b where b.id = ${input.destCountryBranchId}::uuid`;
  if (!branch || branch.deleted_at) throw new ApiClientError("The destination branch does not exist.", { status: 400, code: "DEST_BRANCH_NOT_FOUND" });
  if (branch.country_id === lot.country_id) {
    throw new ApiClientError("The destination branch is in the same country. Use Another DGT Warehouse for a same-country transfer.", { status: 400, code: "SAME_COUNTRY" });
  }
  if (String(branch.code ?? "").trim().toUpperCase() !== String(input.destBranchCode ?? "").trim().toUpperCase()) {
    throw new ApiClientError("The branch code does not match the selected destination branch.", { status: 400, code: "BRANCH_CODE_MISMATCH" });
  }
  const destCurrency = String(branch.local_currency ?? "").trim().toUpperCase();
  if (!destCurrency) throw new ApiClientError("The destination branch has no local currency set.", { status: 400, code: "DEST_CURRENCY_MISSING" });
  if (input.destCityBranchId) {
    const [city] = await tx`select id, country_branch_id, deleted_at from public.city_branches where id = ${input.destCityBranchId}::uuid`;
    if (!city || city.deleted_at || city.country_branch_id !== branch.id) {
      throw new ApiClientError("The destination city branch does not belong to the destination branch.", { status: 400, code: "DEST_CITY_MISMATCH" });
    }
  }
  const destWh = await loadWarehouse(tx, input.destWarehouseId, "Destination warehouse");
  if (destWh.country_id !== branch.country_id) {
    throw new ApiClientError("The destination warehouse is not in the destination country.", { status: 400, code: "WRONG_COUNTRY" });
  }

  const L = input.ledgers;
  const recv = await loadLedgerInCountry(tx, L.receivable, lot.country_id, "The inter-country (receivable) account");
  const salesL = await loadLedgerInCountry(tx, L.sales, lot.country_id, "The export sales ledger");
  const cogsL = await loadLedgerInCountry(tx, L.cogs, lot.country_id, "The cost-of-sales ledger");
  await loadLedgerInCountry(tx, L.destInventory, branch.country_id, "The destination inventory/purchase ledger");
  await loadLedgerInCountry(tx, L.destPayable, branch.country_id, "The destination intercompany payable ledger");
  if (!lot.purchase_ledger_id) throw conflict("This lot has no inventory ledger on record, so the inventory effect cannot be posted.", "NO_INVENTORY_LEDGER");
  if (new Set([recv.id, salesL.id, cogsL.id, lot.purchase_ledger_id]).size !== 4) {
    throw new ApiClientError("The receivable, export sales, cost-of-sales and inventory ledgers must all be different.", { status: 400, code: "LEDGERS_NOT_DISTINCT" });
  }

  const srcCurrency = String(lot.currency_code).toUpperCase();
  const saleSource = q4(qty * unitRate);
  const saleDest = q4(saleSource * rate); // the ONE currency conversion for this trade
  const cost = q4((qty * Number(lot.original_cost)) / Number(lot.qty_purchased));
  if (!(saleSource > 0) || !(saleDest > 0)) throw new ApiClientError("The trade amount must be greater than zero.", { status: 400, code: "ZERO_AMOUNT" });

  const [purchase] = await tx`select * from public.local_purchases where id = ${lot.local_purchase_id}::uuid`;
  const src: Place = { state: "available", warehouseId: input.source.warehouseId ?? null, label: input.source.label ?? "", rack: input.source.rack ?? "" };
  const transferNo = await nextTransferNo(tx);
  const [t] = await tx`
    insert into public.goods_transfers (transfer_no, local_purchase_id, lot_id, purpose, status, qty, source_warehouse_id, source_location_label, source_rack_bin,
      dest_warehouse_id, dest_country_id, dest_country_branch_id, dest_city_branch_id, transport, idempotency_key, notes, created_by)
    values (${transferNo}, ${lot.local_purchase_id}::uuid, ${lot.id}::uuid, 'export_dgt_branch', 'in_transit', ${qty}, ${src.warehouseId ?? null}::uuid, ${src.label ?? ""}, ${src.rack ?? ""},
      ${destWh.id}::uuid, ${branch.country_id}::uuid, ${branch.id}::uuid, ${input.destCityBranchId ?? null}::uuid, ${tx.json((input.transport ?? {}) as any)},
      ${input.idempotencyKey}, ${input.notes ?? null}, ${input.userId ?? null}::uuid)
    returning *`;

  const [seq] = await tx`select 'ICT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.inter_country_trade_seq')::text, 6, '0') as ref`;
  const tradeRef = seq.ref as string;
  const [trade] = await tx`
    insert into public.inter_country_trades (trade_ref, goods_transfer_id, source_lot_id, source_purchase_id, qty,
      source_country_id, source_country_branch_id, source_city_branch_id, dest_country_id, dest_country_branch_id, dest_city_branch_id, dest_branch_code, dest_warehouse_id,
      source_currency, dest_currency, approved_exchange_rate, sale_unit_rate, sale_amount_source, sale_amount_dest, cost_amount_source,
      source_receivable_ledger_id, source_sales_ledger_id, source_inventory_ledger_id, source_cogs_ledger_id, dest_inventory_ledger_id, dest_payable_ledger_id,
      transport, status, created_by)
    values (${tradeRef}, ${t.id}::uuid, ${lot.id}::uuid, ${lot.local_purchase_id}::uuid, ${qty},
      ${lot.country_id}::uuid, ${lot.country_branch_id}::uuid, ${lot.city_branch_id ?? null}::uuid, ${branch.country_id}::uuid, ${branch.id}::uuid, ${input.destCityBranchId ?? null}::uuid,
      ${branch.code}, ${destWh.id}::uuid, ${srcCurrency}, ${destCurrency}, ${rate}, ${unitRate}, ${saleSource}, ${saleDest}, ${cost},
      ${recv.id}::uuid, ${salesL.id}::uuid, ${lot.purchase_ledger_id}::uuid, ${cogsL.id}::uuid, ${L.destInventory}::uuid, ${L.destPayable}::uuid,
      ${tx.json((input.transport ?? {}) as any)}, 'in_transit', ${input.userId ?? null}::uuid)
    returning *`;
  await tx`update public.goods_transfers set inter_country_trade_id = ${trade.id}::uuid where id = ${t.id}::uuid`;

  // 1) source stock leaves the books once
  await moveStock(tx, {
    lot, from: src, to: { state: "exported", warehouseId: src.warehouseId ?? null, label: src.label ?? "", rack: src.rack ?? "", referenceId: t.id }, qty,
    movementType: "export", transferId: t.id, referenceType: "inter_country_trade", referenceId: trade.id, referenceNo: tradeRef, notes: input.notes ?? null, userId: input.userId,
  });

  // 2) source-country Export Sales Order (visible in the Sales register) — one per trade
  const [so] = await tx`
    insert into public.sales_orders (country_id, country_branch_id, city_branch_id, dest_country_id, dest_country_branch_id, dest_city_branch_id,
      customer_account_id, customer_ledger_id, sales_order_no, order_date, customer_name, product_summary, quantity, total_weight, currency_code, exchange_rate,
      order_total, total_goods_original, total_goods_local, paid_amount, remaining_amount, sales_status, payment_status, delivery_status, ledger_posting_status,
      form_data, created_by)
    values (${lot.country_id}::uuid, ${lot.country_branch_id}::uuid, ${lot.city_branch_id ?? null}::uuid, ${branch.country_id}::uuid, ${branch.id}::uuid, ${input.destCityBranchId ?? null}::uuid,
      ${recv.enterprise_account_id ?? null}::uuid, ${recv.id}::uuid, ${`${tradeRef}-S`}, ${new Date().toISOString().slice(0, 10)}::date, ${`DGT ${branch.name}`},
      ${`${lot.goods_name} x ${qty} ${lot.unit_name}`}, ${qty}, ${q4((Number(lot.net_weight_kg) / Number(lot.qty_purchased)) * qty)}, ${srcCurrency}, 1,
      ${saleSource}, ${saleSource}, ${saleSource}, 0, ${saleSource}, 'transferred', 'pending', 'in_transit', 'posted',
      ${tx.json({
        interCountryTrade: { tradeRef, tradeId: trade.id, destCountryBranchId: branch.id, destBranchCode: branch.code, approvedExchangeRate: rate, destCurrency, destAmount: saleDest },
        form: { saleMode: "export", isExportSale: true, saleSource: "lot", managedLotId: lot.id, customerAccountName: `DGT ${branch.name}` },
        goodsEntries: [{ goodsName: lot.goods_name, qtyNo: qty, qtyName: lot.unit_name, coursePrice: unitRate, currencyType: srcCurrency, managedLotId: lot.id, lotRef: lot.lot_ref, totalAmount: saleSource, finalAmount: saleSource }],
        stockDeducted: true,
      } as any)}, ${input.userId ?? null}::uuid)
    returning id, sales_order_no`;

  // 3) source-country postings: sale (DR inter-country receivable / CR export sales), then cost of sales / inventory
  const saleEntry = await postTwoLine(tx, {
    scope: lot, ref: `${tradeRef}-S`, narration: `Inter-Country Trade ${tradeRef}: export of ${lot.goods_name} ${qty} ${lot.unit_name} to ${branch.name}`,
    drLedgerId: recv.id, crLedgerId: salesL.id, amount: saleSource, currency: srcCurrency, sourceType: "inter_country_sale", sourceId: trade.id,
    drDesc: `DR: Inter-country receivable - ${branch.name}`, crDesc: `CR: Export sales - ${lot.goods_name}`,
  });
  const costEntry = await postTwoLine(tx, {
    scope: lot, ref: `${tradeRef}-C`, narration: `Inter-Country Trade ${tradeRef}: cost of ${lot.goods_name} ${qty} ${lot.unit_name} (lot ${lot.lot_ref})`,
    drLedgerId: cogsL.id, crLedgerId: lot.purchase_ledger_id, amount: cost, currency: srcCurrency, sourceType: "inter_country_cost", sourceId: trade.id,
    drDesc: `DR: Cost of sales - ${lot.goods_name}`, crDesc: `CR: Inventory - ${lot.goods_name} (${lot.lot_ref})`,
  });

  // 4) destination-country linked Purchase: In Transit, nothing posted and no stock until an authorized receipt
  const line = {
    id: `ict-${trade.id}`, goodsId: lot.goods_id, goodsName: lot.goods_name, brand: lot.brand, size: lot.size, origin: lot.origin, lotNo: lot.lot_no,
    quantityName: lot.unit_name, numbers: qty, quantityCount: qty, netWeight: q4((Number(lot.net_weight_kg) / Number(lot.qty_purchased)) * qty),
    finalCost: saleDest, amount: saleDest, purchaseCost: saleDest, currency: destCurrency, exchangeRate: 1,
  };
  const [dp] = await tx`
    insert into public.local_purchases (country_id, country_branch_id, city_branch_id, goods_id, goods_name, supplier_name, quantity_name, numbers, quantity_kgs,
      net_weight, purchase_rate, purchase_currency, exchange_rate, local_currency, purchase_cost, final_cost, purchase_account_no, sales_account_no, payment_mode,
      shipping_mode, origin_country_name, warehouse_id, status, line_items, inter_country_trade_id, source_lot_id, lot_no, manual_bill_no, created_by)
    values (${branch.country_id}::uuid, ${branch.id}::uuid, ${input.destCityBranchId ?? null}::uuid, ${lot.goods_id}::uuid, ${lot.goods_name}, ${`DGT inter-country (${tradeRef})`},
      ${lot.unit_name}, ${qty}, ${qty}, ${line.netWeight}, ${q4(unitRate * rate)}, ${destCurrency}, 1, ${destCurrency}, ${saleDest}, ${saleDest},
      ${L.destInventory}, ${L.destPayable}, 'Credit', 'Inter-Country', ${lot.origin ?? "DGT"}, ${destWh.id}::uuid, 'in_transit', ${tx.json([line] as any)},
      ${trade.id}::uuid, ${lot.id}::uuid, ${lot.lot_no ?? null}, ${tradeRef}, ${input.userId ?? null}::uuid)
    returning id`;

  const [tr2] = await tx`
    update public.inter_country_trades set source_sales_order_id = ${so.id}::uuid, destination_purchase_id = ${dp.id}::uuid,
      source_roznamcha_entry_id = ${saleEntry}::uuid, source_cost_roznamcha_entry_id = ${costEntry}::uuid, updated_at = now()
    where id = ${trade.id}::uuid returning *`;
  await tx`update public.goods_transfers set sales_order_id = ${so.id}::uuid, cost_roznamcha_entry_id = ${costEntry}::uuid, cost_amount = ${cost}, cost_currency = ${srcCurrency},
            cost_posted_at = now(), cost_posted_by = ${input.userId ?? null}::uuid where id = ${t.id}::uuid`;
  const [t2] = await tx`select * from public.goods_transfers where id = ${t.id}::uuid`;
  return { transfer: t2, trade: tr2, replayed: false, salesOrderNo: so.sales_order_no, destinationPurchaseId: dp.id, purchase };
}

/** Authorized receipt at the destination: posts the destination purchase and brings the goods into stock — once. */
export async function receiveInterCountryTrade(tx: Tx, tradeId: string, o: { userId: string | null }) {
  const [t0] = await tx`select source_lot_id from public.inter_country_trades where id = ${tradeId}::uuid`;
  if (!t0) throw new ApiClientError("Trade not found.", { status: 404, code: "TRADE_NOT_FOUND" });
  await lockLot(tx, t0.source_lot_id);
  const [trade] = await tx`select * from public.inter_country_trades where id = ${tradeId}::uuid for update`;
  if (trade.status === "received") return { trade, replayed: true };
  if (trade.status !== "in_transit" && trade.status !== "confirmed") throw conflict(`This trade is ${trade.status} and cannot be received.`, "NOT_RECEIVABLE");

  const [dp] = await tx`select * from public.local_purchases where id = ${trade.destination_purchase_id}::uuid for update`;
  if (!dp || dp.status !== "in_transit") throw conflict("The destination purchase is not waiting for receipt.", "NOT_IN_TRANSIT");
  const amount = q4(trade.sale_amount_dest);
  const ref = `${trade.trade_ref}-P`;
  const entryId = await postTwoLine(tx, {
    scope: { country_id: dp.country_id, country_branch_id: dp.country_branch_id, city_branch_id: dp.city_branch_id ?? null },
    ref, narration: `Inter-Country Trade ${trade.trade_ref}: receipt of ${dp.goods_name} ${dp.numbers} ${dp.quantity_name}`,
    drLedgerId: trade.dest_inventory_ledger_id, crLedgerId: trade.dest_payable_ledger_id, amount, currency: trade.dest_currency,
    sourceType: "inter_country_purchase", sourceId: trade.id, drDesc: `DR: Inventory / Purchase - ${dp.goods_name}`, crDesc: `CR: Intercompany payable - ${trade.trade_ref}`,
  });
  await tx`
    update public.local_purchases set status = 'posted', transferred_at = now(), roznamcha_entry_id = ${entryId}::uuid, journal_serial_no = ${ref}, updated_at = now()
    where id = ${dp.id}::uuid`;
  await ensureLotsForPurchase(tx, dp.id, o.userId);
  const [u] = await tx`
    update public.inter_country_trades set status = 'received', received_at = now(), received_by = ${o.userId ?? null}::uuid, dest_roznamcha_entry_id = ${entryId}::uuid, updated_at = now()
    where id = ${trade.id}::uuid returning *`;
  await tx`update public.goods_transfers set status = 'completed', completed_at = now(), updated_at = now() where id = ${trade.goods_transfer_id}::uuid`;
  return { trade: u, replayed: false };
}

/** Cancels a trade that has NOT been received: reverses both source postings, returns the stock, withdraws the destination purchase. */
export async function cancelInterCountryTrade(tx: Tx, tradeId: string, o: { reason: string; userId: string | null }) {
  const [t0] = await tx`select source_lot_id from public.inter_country_trades where id = ${tradeId}::uuid`;
  if (!t0) throw new ApiClientError("Trade not found.", { status: 404, code: "TRADE_NOT_FOUND" });
  const lot = await lockLot(tx, t0.source_lot_id);
  const [trade] = await tx`select * from public.inter_country_trades where id = ${tradeId}::uuid for update`;
  if (trade.status === "cancelled") return { trade, replayed: true };
  if (trade.status === "received") throw conflict("The destination has already received these goods. Return them with a new inter-country trade in the opposite direction.", "ALREADY_RECEIVED");
  if (!String(o.reason || "").trim()) throw new ApiClientError("A reason is required to cancel a trade.", { status: 400, code: "REASON_REQUIRED" });

  const scope = lot;
  await postTwoLine(tx, {
    scope, ref: `${trade.trade_ref}-S-REV`, narration: `Reversal of Inter-Country Trade ${trade.trade_ref} sale: ${o.reason}`,
    drLedgerId: trade.source_sales_ledger_id, crLedgerId: trade.source_receivable_ledger_id, amount: q4(trade.sale_amount_source), currency: trade.source_currency,
    sourceType: "inter_country_sale_reversal", sourceId: trade.id, drDesc: "DR: Export sales (reversal)", crDesc: "CR: Inter-country receivable (reversal)",
  });
  await postTwoLine(tx, {
    scope, ref: `${trade.trade_ref}-C-REV`, narration: `Reversal of Inter-Country Trade ${trade.trade_ref} cost: ${o.reason}`,
    drLedgerId: trade.source_inventory_ledger_id, crLedgerId: trade.source_cogs_ledger_id, amount: q4(trade.cost_amount_source), currency: trade.source_currency,
    sourceType: "inter_country_cost_reversal", sourceId: trade.id, drDesc: "DR: Inventory (reversal)", crDesc: "CR: Cost of sales (reversal)",
  });
  const [t] = await tx`select * from public.goods_transfers where id = ${trade.goods_transfer_id}::uuid for update`;
  await moveStock(tx, {
    lot, from: { state: "exported", warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "", referenceId: t.id },
    to: { state: "available", warehouseId: t.source_warehouse_id, label: t.source_location_label ?? "", rack: t.source_rack_bin ?? "" }, qty: Number(trade.qty),
    movementType: "return", transferId: t.id, referenceType: "inter_country_trade", referenceId: trade.id, referenceNo: trade.trade_ref, notes: o.reason, userId: o.userId,
  });
  await tx`update public.sales_orders set sales_status = 'cancelled', delivery_status = 'cancelled', ledger_posting_status = 'reversed', updated_at = now() where id = ${trade.source_sales_order_id}::uuid`;
  await tx`update public.local_purchases set status = 'cancelled', updated_at = now() where id = ${trade.destination_purchase_id}::uuid`;
  await tx`update public.goods_transfers set status = 'cancelled', cancel_reason = ${o.reason}, updated_at = now() where id = ${t.id}::uuid`;
  const [u] = await tx`update public.inter_country_trades set status = 'cancelled', updated_at = now() where id = ${trade.id}::uuid returning *`;
  return { trade: u, replayed: false };
}

/** Goods names are master data: show them in the viewer's language (the lot keeps the original as a snapshot). */
export async function localizeLotNames<T extends { goods_id?: string | null; goods_name?: string | null }>(lots: T[], lang: SupportedLanguage): Promise<T[]> {
  const withId = lots.filter((l) => l.goods_id);
  if (!withId.length || lang === "en") return lots;
  const loc = await localizeRecordNames(withId.map((l) => ({ id: l.goods_id as string, goods_name: l.goods_name ?? "" })), "goods", "goods_name", lang).catch(() => null);
  if (!loc) return lots;
  const byId = new Map<string, string>((loc as any[]).map((r) => [r.id, r.goods_name]));
  return lots.map((l) => (l.goods_id && byId.has(l.goods_id) ? { ...l, goods_name: byId.get(l.goods_id) as string } : l));
}
