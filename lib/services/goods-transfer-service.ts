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
        roznamcha_entry_id, purchase_ledger_id, payable_ledger_id, created_by
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
        ${p.roznamcha_entry_id}::uuid, ${purchaseLedgerId}::uuid, ${payableLedgerId}::uuid, ${userId ?? null}::uuid
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

  const lots = await tx`
    select l.*, b.qty_available, b.qty_reserved, b.qty_loading, b.qty_in_transit, b.qty_sold, b.qty_exported, b.qty_accounted
    from public.purchase_lots l join public.purchase_lot_balance_v b on b.lot_id = l.id
    where l.local_purchase_id = ${purchaseId}::uuid order by l.created_at, l.line_key`;
  const lotIds = lots.map((l: any) => l.id);
  const stock = lotIds.length
    ? await tx`
        select s.*, w.warehouse_code, w.warehouse_name
        from public.lot_stock s left join public.warehouses w on w.id = s.warehouse_id
        where s.lot_id = any(${lotIds}::uuid[]) order by s.state, w.warehouse_name nulls last`
    : [];
  const transfers = await tx`
    select t.*, sw.warehouse_name as source_warehouse_name, dw.warehouse_name as dest_warehouse_name, dw.warehouse_code as dest_warehouse_code
    from public.goods_transfers t
    left join public.warehouses sw on sw.id = t.source_warehouse_id
    left join public.warehouses dw on dw.id = t.dest_warehouse_id
    where t.local_purchase_id = ${purchaseId}::uuid order by t.created_at desc`;
  const movements = lotIds.length
    ? await tx`
        select m.*, fw.warehouse_name as from_warehouse_name, tw.warehouse_name as to_warehouse_name, l.lot_ref, pr.full_name as user_name
        from public.lot_movements m
        join public.purchase_lots l on l.id = m.lot_id
        left join public.warehouses fw on fw.id = m.from_warehouse_id
        left join public.warehouses tw on tw.id = m.to_warehouse_id
        left join public.profiles pr on pr.id = m.created_by
        where m.lot_id = any(${lotIds}::uuid[]) order by m.created_at, m.id`
    : [];
  const trades = lotIds.length
    ? await tx`select * from public.inter_country_trades where source_lot_id = any(${lotIds}::uuid[]) order by created_at desc`
    : [];

  const received = (lotId: string) =>
    movements.filter((m: any) => m.lot_id === lotId && ["initial_receipt", "warehouse_receipt"].includes(m.movement_type)).reduce((s: number, m: any) => s + Number(m.qty), 0);

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
  };
}
