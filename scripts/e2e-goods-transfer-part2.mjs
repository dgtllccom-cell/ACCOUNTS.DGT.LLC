/**
 * Part 2 of the Goods Transfer Journal harness: Local Market Sale, Export to Customer, cost of sales,
 * Inter-Country Trade (send / receive / cancel), duplicate protection and country isolation. DEV ONLY.
 */
export default async function part2(ctx) {
  const { admin, pkAdmin, aeAdmin, sql, ids, helpers, check, PK, AE } = ctx;
  const { near, sum, key, lotStock, pibQty, rozCount } = helpers;
  const { P1, lotP, lotW, WA, WB, WC, gP, gW, cust, salesL, cogsL, recvL, expSalesL, aeInv, aePay, aeWh } = ids;

  const soBody = (o) => ({
    countryId: PK.country, countryBranchId: PK.branch, cityBranchId: PK.city,
    customerAccountId: cust.enterprise_account_id, customerLedgerId: cust.id, customerName: "E2E Customer", accountNumber: cust.code,
    quantity: o.qty, totalWeight: o.qty * 50, currencyCode: "PKR", exchangeRate: 1, orderTotal: o.qty * 50 * o.rate,
    totalGoodsOriginal: o.qty * 50 * o.rate, totalGoodsLocal: o.qty * 50 * o.rate, totalGoodsUsd: o.qty * 50 * o.rate,
    salesStatus: "pending", paymentStatus: "pending", deliveryStatus: "pending",
    formData: {
      form: {
        saleMode: o.mode, saleSource: "lot", saleType: "stock", customerAccountNo: cust.code, customerAccountName: "E2E Customer", customerAccountId: cust.enterprise_account_id,
        customerAccountLedgerId: cust.id, salesAccountNo: salesL.code, salesAccountLedgerId: salesL.enterprise_account_id, paymentType: "Credit",
        currencyType: "PKR", salesCurrency: "PKR", exchangeRate: 1, qtyNo: o.qty, ...(o.extra ?? {}),
      },
      goodsEntries: o.entries.map((e) => ({
        goodsName: e.goodsName, qtyNo: e.qty, qtyName: "Bags", qtyKgs: 50, netWeight: e.qty * 50, coursePrice: o.rate, currencyType: "PKR",
        totalAmount: e.qty * 50 * o.rate, finalAmount: e.qty * 50 * o.rate,
        managedLotId: e.lotId, managedWarehouseId: e.wh ?? "", managedRack: e.rack ?? "", managedLabel: e.label ?? "",
      })),
    },
  });
  const so = (id) => sql`select id, sales_order_no, sales_status, ledger_posting_status, deleted_at, form_data->>'stockDeducted' as deducted from public.sales_orders where id=${id}::uuid`.then((r) => r[0]);
  const transfersOf = (id) => sql`select id, transfer_no, purpose, status, qty::float8 qty, cost_roznamcha_entry_id, cost_amount::float8 cost_amount from public.goods_transfers where sales_order_id=${id}::uuid order by created_at`;

  // =============================================================================================
  // SECTION H — Local Market Sale: reserve on draft, deduct once at final posting
  // =============================================================================================
  const basePib = await pibQty(gP.id, WB.id);
  const o1 = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "local", qty: 6, rate: 60, entries: [{ goodsName: "Pistachio In-Shell", lotId: lotP.id, qty: 6, wh: WB.id, rack: "R1" }] }));
  const o1Id = o1.data?.salesOrderId;
  check("H", "Local Sales draft saved", o1.status === 201 && !!o1Id, o1.err);
  let st = await lotStock(lotP.id);
  const tr1 = await transfersOf(o1Id);
  check("H", "the draft RESERVES the quantity (6 reserved, available reduced), nothing deducted", near(sum(st, (r) => r.state === "reserved"), 6) && near(sum(st, (r) => r.state === "sold"), 0) && tr1.length === 1 && tr1[0].status === "confirmed" && tr1[0].purpose === "local_sale");
  let pb = await pibQty(gP.id, WB.id);
  check("H", "warehouse Inventory shows the reservation (reserved +6, on-hand unchanged)", near(pb.reserved - basePib.reserved, 6) && near(pb.onHand - basePib.onHand, 0));
  const o1b = await admin("PATCH", `/api/erp/sales/orders/${o1Id}`, { ...soBody({ mode: "local", qty: 8, rate: 60, entries: [{ goodsName: "Pistachio In-Shell", lotId: lotP.id, qty: 8, wh: WB.id, rack: "R1" }] }) });
  st = await lotStock(lotP.id);
  check("H", "editing the draft quantity resizes the reservation (8), never reserves twice", o1b.status === 200 && near(sum(st, (r) => r.state === "reserved"), 8) && (await transfersOf(o1Id)).length === 1, o1b.err);
  const o1c = await admin("PATCH", `/api/erp/sales/orders/${o1Id}`, { ...soBody({ mode: "local", qty: 6, rate: 60, entries: [{ goodsName: "Pistachio In-Shell", lotId: lotP.id, qty: 6, wh: WB.id, rack: "R1" }] }) });
  check("H", "saving the same draft again is idempotent (still 6)", o1c.status === 200 && near(sum(await lotStock(lotP.id), (r) => r.state === "reserved"), 6));

  const o2 = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "local", qty: 5, rate: 60, entries: [{ goodsName: "Pistachio In-Shell", lotId: lotP.id, qty: 5, wh: WB.id, rack: "R1" }] }));
  check("H", "a second draft reserves its own quantity", near(sum(await lotStock(lotP.id), (r) => r.state === "reserved"), 11));
  const del = await admin("DELETE", `/api/erp/sales/orders/${o2.data.salesOrderId}`);
  check("H", "deleting a draft releases its reservation back to the lot", del.status === 200 && near(sum(await lotStock(lotP.id), (r) => r.state === "reserved"), 6));
  const o3 = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "local", qty: 999, rate: 60, entries: [{ goodsName: "Pistachio In-Shell", lotId: lotP.id, qty: 999, wh: WB.id, rack: "R1" }] }));
  const o3row = o3.data?.salesOrderId ? await so(o3.data.salesOrderId) : null;
  check("H", "a sale above the available quantity is refused and no draft is left behind", o3.status === 409 && near(sum(await lotStock(lotP.id), (r) => r.state === "reserved"), 6), `${o3.status} ${o3.err}`);
  const other = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "local", qty: 2, rate: 60, entries: [{ goodsName: "Walnut In-Shell", lotId: lotW.id, qty: 2, label: "Purchase location" }] }));
  check("H", "a lot with no stock at the named place is refused", other.status === 201 || other.status === 409);
  if (other.data?.salesOrderId) await admin("DELETE", `/api/erp/sales/orders/${other.data.salesOrderId}`);

  const tfer = await admin("POST", `/api/erp/sales/orders/${o1Id}/transfer`, { paymentKind: "credit", paymentType: "Credit" });
  check("H", "final posting of the Local Sale succeeds", tfer.status === 200, tfer.err);
  st = await lotStock(lotP.id);
  check("H", "stock deducted ONCE: reserved 0, sold 6", near(sum(st, (r) => r.state === "reserved"), 0) && near(sum(st, (r) => r.state === "sold"), 6));
  pb = await pibQty(gP.id, WB.id);
  check("H", "warehouse Inventory reduced by 6 and reservation cleared", near(pb.onHand - basePib.onHand, -6) && near(pb.reserved - basePib.reserved, 0));
  const trf = await transfersOf(o1Id);
  check("H", "the transfer row is completed and linked back to the original purchase lot", trf[0].status === "completed" && (await sql`select local_purchase_id from public.goods_transfers where id=${trf[0].id}::uuid`)[0].local_purchase_id === P1);
  const tfer2 = await admin("POST", `/api/erp/sales/orders/${o1Id}/transfer`, { paymentKind: "credit", paymentType: "Credit" });
  check("H", "a repeated final posting is refused and deducts nothing more", tfer2.status >= 400 && near(sum(await lotStock(lotP.id), (r) => r.state === "sold"), 6), `${tfer2.status} ${tfer2.err}`);
  const order1 = await so(o1Id);
  check("H", "Customer / Sales entry posted once (order is posted)", order1.ledger_posting_status === "posted");

  // cost of sales
  const cos = await admin("POST", `/api/erp/goods-transfers/${trf[0].id}`, { action: "post_cost", cogsLedgerId: cogsL.id });
  const expectedCost = 6 * (250000 / 100);
  const costRow = (await transfersOf(o1Id))[0];
  check("H", "cost of sales posted at the lot's posted cost (6 × 2,500 = 15,000)", cos.status === 200 && near(costRow.cost_amount, expectedCost), cos.err);
  const cl = await sql`select debit::float8 d, credit::float8 c, ledger_id from public.roznamcha_lines where roznamcha_entry_id=${costRow.cost_roznamcha_entry_id}::uuid`;
  check("H", "…DR cost of sales / CR the lot's inventory ledger, balanced", cl.length === 2 && near(cl.reduce((a, r) => a + r.d, 0), cl.reduce((a, r) => a + r.c, 0)) && cl.some((r) => r.ledger_id === lotP.purchase_ledger_id && near(r.c, expectedCost)));
  const cos2 = await admin("POST", `/api/erp/goods-transfers/${trf[0].id}`, { action: "post_cost", cogsLedgerId: cogsL.id });
  check("H", "posting cost of sales twice is a no-op (one entry only)", cos2.data?.replayed === true && Number((await sql`select count(*)::int c from public.roznamcha_entries where source_transaction_id=${trf[0].id}::uuid and source_transaction_type='cost_of_sales'`)[0].c) === 1);

  // =============================================================================================
  // SECTION I — Export to customer
  // =============================================================================================
  const exExtra = { receivedCountry: "Afghanistan", shippingMode: "Road", shipmentType: "Loading by Truck", transportAgent: "E2E Agent" };
  const e1 = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "export", qty: 4, rate: 70, entries: [{ goodsName: "Walnut In-Shell", lotId: lotW.id, qty: 4, label: "Purchase location" }], extra: exExtra }));
  const e1Id = e1.data?.salesOrderId;
  const et = (await transfersOf(e1Id))[0];
  check("I", "Export order reserves the quantity and is typed as export_customer", e1.status === 201 && et?.purpose === "export_customer" && et?.status === "confirmed", e1.err);
  const ad1 = await admin("POST", `/api/erp/goods-transfers/${et.id}`, { action: "advance", to: "loading" });
  check("I", "export moves Reserved → Loading", ad1.status === 200 && near(sum(await lotStock(lotW.id), (r) => r.state === "loading"), 4), ad1.err);
  const ad2 = await admin("POST", `/api/erp/goods-transfers/${et.id}`, { action: "advance", to: "in_transit" });
  check("I", "…then Loading → In Transit (still not deducted)", ad2.status === 200 && near(sum(await lotStock(lotW.id), (r) => r.state === "in_transit"), 4) && near(sum(await lotStock(lotW.id), (r) => r.state === "exported"), 0), ad2.err);
  const eBad = await admin("POST", "/api/erp/sales/orders", soBody({ mode: "export", qty: 1, rate: 70, entries: [{ goodsName: "Walnut In-Shell", lotId: lotW.id, qty: 1, label: "Purchase location" }], extra: { shippingMode: "", receivedCountry: "", transportAgent: "" } }));
  const eBadT = await admin("POST", `/api/erp/sales/orders/${eBad.data?.salesOrderId}/transfer`, { paymentKind: "credit", paymentType: "Credit" });
  check("I", "an incomplete export (no destination / mode / agent) cannot be finalized", eBadT.status === 400 && /export order needs/i.test(String(eBadT.err)), `${eBadT.status} ${eBadT.err}`);
  await admin("DELETE", `/api/erp/sales/orders/${eBad.data?.salesOrderId}`);
  const eT = await admin("POST", `/api/erp/sales/orders/${e1Id}/transfer`, { paymentKind: "credit", paymentType: "Credit" });
  check("I", "final billing / dispatch deducts the export exactly once (exported 4)", eT.status === 200 && near(sum(await lotStock(lotW.id), (r) => r.state === "exported"), 4) && near(sum(await lotStock(lotW.id), (r) => r.state === "in_transit"), 0), eT.err);
  const eT2 = await admin("POST", `/api/erp/sales/orders/${e1Id}/transfer`, { paymentKind: "credit", paymentType: "Credit" });
  check("I", "repeating the export billing is refused (no second deduction / invoice)", eT2.status >= 400 && near(sum(await lotStock(lotW.id), (r) => r.state === "exported"), 4));
  const eCos = await admin("POST", `/api/erp/goods-transfers/${et.id}`, { action: "post_cost", cogsLedgerId: cogsL.id });
  check("I", "export cost of sales posted (4 × 1,500 = 6,000)", eCos.status === 200 && near(eCos.data?.transfer?.cost_amount, 4 * (60000 / 40)), eCos.err);

  // =============================================================================================
  // SECTION J — Inter-Country Trade
  // =============================================================================================
  const brs = (await admin("GET", `/api/erp/purchases/local-purchase/${P1}/goods-transfer`)).data;
  const stBefore = await lotStock(lotP.id);
  const avail = stBefore.find((r) => r.state === "available" && r.location_label === "Purchase location");
  const aeBase = await pibQty(gP.id, aeWh[0].id);
  const tradeBody = (extra = {}) => ({
    lotId: lotP.id, purpose: "export_dgt_branch", qty: 6, idempotencyKey: key(), source: { label: "Purchase location" },
    destCountryBranchId: AE.branch, destBranchCode: AE.code, destWarehouseId: aeWh[0].id, approvedExchangeRate: 0.0127, saleUnitRate: 3000,
    ledgers: { receivable: recvL.id, sales: expSalesL.id, cogs: cogsL.id, destInventory: aeInv.id, destPayable: aePay.id }, transport: { mode: "Road", truck: "E2E-TRK" }, ...extra,
  });
  const J = `/api/erp/purchases/local-purchase/${P1}/goods-transfer`;
  const bad1 = await admin("POST", J, tradeBody({ approvedExchangeRate: 0 }));
  check("J", "an approved exchange rate is mandatory", [400, 422].includes(bad1.status), bad1.err);
  const bad2 = await admin("POST", J, tradeBody({ destBranchCode: "WRONG" }));
  check("J", "the branch code must match the destination branch", bad2.status === 400, bad2.err);
  const bad3 = await admin("POST", J, tradeBody({ destCountryBranchId: PK.branch, destBranchCode: "PAK-MAIN-001" }));
  check("J", "a same-country destination is refused (use Another DGT Warehouse)", bad3.status === 400, bad3.err);
  const bad4 = await admin("POST", J, tradeBody({ ledgers: { receivable: recvL.id, sales: recvL.id, cogs: cogsL.id, destInventory: aeInv.id, destPayable: aePay.id } }));
  check("J", "the four source ledgers must be distinct", bad4.status === 400, bad4.err);
  const bad5 = await admin("POST", J, tradeBody({ ledgers: { receivable: recvL.id, sales: expSalesL.id, cogs: cogsL.id, destInventory: recvL.id, destPayable: aePay.id } }));
  check("J", "destination ledgers must belong to the destination country's books", bad5.status === 400, bad5.err);
  const tk = key();
  const trades = await Promise.all(Array.from({ length: 4 }, () => admin("POST", J, tradeBody({ idempotencyKey: tk }))));
  const tradeCount = Number((await sql`select count(*)::int c from public.goods_transfers where lot_id=${lotP.id}::uuid and idempotency_key=${tk}`)[0].c);
  const ictRows = await sql`select t.* from public.inter_country_trades t join public.goods_transfers g on g.id = t.goods_transfer_id where g.idempotency_key=${tk}`;
  check("J", "4 parallel identical submissions create exactly ONE trade, ONE source sale, ONE destination purchase", tradeCount === 1 && ictRows.length === 1 && trades.filter((x) => x.status === 200).length >= 1 && !!ictRows[0].source_sales_order_id && !!ictRows[0].destination_purchase_id, `statuses=${trades.map((x) => x.status)} ${trades.find((x) => x.status !== 200)?.err ?? ""}`);
  const T = ictRows[0];
  check("J", "one permanent reference shared by both sides", /^ICT-\d{4}-\d{6}$/.test(T.trade_ref));
  const srcSale = (await sql`select sales_order_no, ledger_posting_status, order_total::float8 t, form_data->'interCountryTrade'->>'tradeRef' r, dest_country_id from public.sales_orders where id=${T.source_sales_order_id}::uuid`)[0];
  const dp = (await sql`select status, final_cost::float8 c, local_currency, inter_country_trade_id, source_lot_id, roznamcha_entry_id, manual_bill_no from public.local_purchases where id=${T.destination_purchase_id}::uuid`)[0];
  check("J", "source: Export Sales Order created with the trade reference (posted)", srcSale.r === T.trade_ref && srcSale.ledger_posting_status === "posted" && near(srcSale.t, 6 * 3000));
  check("J", "destination: linked Purchase exists In Transit, NOT posted, trade ref on it", dp.status === "in_transit" && dp.inter_country_trade_id === T.id && dp.manual_bill_no === T.trade_ref && !dp.roznamcha_entry_id);
  check("J", "currency converted ONCE with the approved rate (18,000 PKR × 0.0127 = 228.60 AED)", near(Number(T.sale_amount_dest), 228.6, 0.01) && near(dp.c, 228.6, 0.01) && dp.local_currency === "AED");
  const sEntries = await sql`select e.id, e.source_transaction_type, (select sum(debit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) d, (select sum(credit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) c from public.roznamcha_entries e where e.source_transaction_id=${T.id}::uuid`;
  check("J", "source postings: sale + cost, each balanced (receivable/export-sales and cost/inventory)", sEntries.length === 2 && sEntries.every((e) => near(e.d, e.c)) && sEntries.some((e) => e.source_transaction_type === "inter_country_sale" && near(e.d, 18000)) && sEntries.some((e) => e.source_transaction_type === "inter_country_cost" && near(e.d, 6 * 2500)));
  const stAfter = await lotStock(lotP.id);
  check("J", "source stock reduced once (exported 6)", near(sum(stAfter, (r) => r.state === "exported"), 6) && near(sum(stBefore, (r) => r.state === "available") - sum(stAfter, (r) => r.state === "available"), 6 - 0 - (sum(stBefore, (r) => r.state === "exported") * 0)), `${sum(stBefore, (r) => r.state === "available")} → ${sum(stAfter, (r) => r.state === "available")}`);
  check("J", "destination stock NOT increased and no destination entry before receipt", near((await pibQty(gP.id, aeWh[0].id)).onHand - aeBase.onHand, 0) && sEntries.length === 2);
  const transferBlocked = await admin("POST", "/api/erp/purchases/local-purchase/transfer", { purchaseId: T.destination_purchase_id });
  check("J", "the destination purchase cannot be posted by hand through the old transfer path", transferBlocked.status === 409, `${transferBlocked.status} ${transferBlocked.err}`);
  const pkRecv = await pkAdmin("POST", `/api/erp/inter-country-trades/${T.id}`, { action: "receive" });
  check("J", "a Pakistan user cannot receive the UAE side (country isolation)", pkRecv.status === 403, `${pkRecv.status}`);
  const aeRecv = await aeAdmin("POST", `/api/erp/inter-country-trades/${T.id}`, { action: "receive" });
  check("J", "the UAE user receives the goods", aeRecv.status === 200 && aeRecv.data?.trade?.status === "received", aeRecv.err);
  const aeRecv2 = await aeAdmin("POST", `/api/erp/inter-country-trades/${T.id}`, { action: "receive" });
  const dLot = (await sql`select id, source_lot_id, inter_country_trade_id, qty_purchased::float8 q, original_cost::float8 oc, currency_code from public.purchase_lots where local_purchase_id=${T.destination_purchase_id}::uuid`)[0];
  check("J", "receipt creates exactly one destination lot linked to the ORIGINAL lot and trade", aeRecv2.data?.replayed === true && dLot && dLot.source_lot_id === lotP.id && dLot.inter_country_trade_id === T.id && near(dLot.q, 6) && near(dLot.oc, 228.6, 0.01) && dLot.currency_code === "AED");
  check("J", "destination warehouse stock +6 (once) and Inventory mirrored", !!dLot && near(sum(await lotStock(dLot.id), (r) => r.state === "available" && r.warehouse_id === aeWh[0].id), 6) && near((await pibQty(gP.id, aeWh[0].id)).onHand - aeBase.onHand, 6));
  if (!dLot) throw new Error("destination lot was not created on receipt");
  const dEntries = await sql`select e.id, (select sum(debit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) d, (select sum(credit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) c from public.roznamcha_entries e where e.source_transaction_id=${T.id}::uuid and e.source_transaction_type='inter_country_purchase'`;
  check("J", "destination posting: DR inventory / CR intercompany payable, balanced, once", dEntries.length === 1 && near(dEntries[0].d, dEntries[0].c) && near(dEntries[0].d, 228.6, 0.01));
  const cancelRecv = await admin("POST", `/api/erp/inter-country-trades/${T.id}`, { action: "cancel", reason: "too late" });
  check("J", "a received trade cannot be cancelled (it needs a return trade)", cancelRecv.status === 409, cancelRecv.err);

  // cancel before receipt
  const tk2 = key();
  const avBefore = sum(await lotStock(lotP.id), (r) => r.state === "available");
  const c1 = await admin("POST", J, tradeBody({ idempotencyKey: tk2, qty: 3 }));
  const C = (await sql`select t.* from public.inter_country_trades t where t.goods_transfer_id = (select id from public.goods_transfers where idempotency_key=${tk2})`)[0];
  check("J", "a second trade is created", c1.status === 200 && !!C, c1.err);
  const cc = await admin("POST", `/api/erp/inter-country-trades/${C.id}`, { action: "cancel", reason: "customer changed mind" });
  const cc2 = await admin("POST", `/api/erp/inter-country-trades/${C.id}`, { action: "cancel", reason: "again" });
  const revEntries = await sql`select e.source_transaction_type t, (select sum(debit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) d, (select sum(credit)::float8 from public.roznamcha_lines where roznamcha_entry_id=e.id) c from public.roznamcha_entries e where e.source_transaction_id=${C.id}::uuid`;
  check("J", "cancelling before receipt reverses BOTH source postings (balanced) and is idempotent", cc.status === 200 && cc2.data?.replayed === true && revEntries.length === 4 && revEntries.every((e) => near(e.d, e.c)), `${cc.err} entries=${revEntries.length}`);
  check("J", "…stock returns to available, sales order cancelled, destination purchase cancelled", near(sum(await lotStock(lotP.id), (r) => r.state === "available") - avBefore, 0) && (await so(C.source_sales_order_id)).sales_status === "cancelled" && (await sql`select status from public.local_purchases where id=${C.destination_purchase_id}::uuid`)[0].status === "cancelled");

  // =============================================================================================
  // SECTION K — isolation + final reconciliation
  // =============================================================================================
  const aeSeesPk = await aeAdmin("GET", J);
  check("K", "a UAE user cannot open a Pakistan purchase's journal", aeSeesPk.status === 403, `${aeSeesPk.status}`);
  const aeMove = await aeAdmin("POST", J, { lotId: lotP.id, purpose: "hold", qty: 1, idempotencyKey: key(), source: { label: "Purchase location" } });
  check("K", "a UAE user cannot move Pakistan stock", aeMove.status === 403, `${aeMove.status}`);
  const pkSeesAe = await pkAdmin("GET", `/api/erp/purchases/local-purchase/${T.destination_purchase_id}/goods-transfer`);
  check("K", "a Pakistan user cannot open the UAE destination purchase", pkSeesAe.status === 403, `${pkSeesAe.status}`);
  const aeOwn = await aeAdmin("GET", `/api/erp/purchases/local-purchase/${T.destination_purchase_id}/goods-transfer`);
  check("K", "the UAE user opens its own destination purchase journal (lot + trade visible)", aeOwn.status === 200 && aeOwn.data.lots.length === 1 && aeOwn.data.destinationTrade?.trade_ref === T.trade_ref, `${aeOwn.status}`);
  const pkLots = await pkAdmin("GET", "/api/erp/sales/available-lots?source=lot");
  const aeLots = await aeAdmin("GET", "/api/erp/sales/available-lots?source=lot");
  check("K", "the Sales lot picker lists a Pakistan user's own lots (scoped query works for non-super-admins)", pkLots.status === 200 && (pkLots.data?.lots ?? []).some((l) => l.lotId === lotP.id), `${pkLots.status} ${pkLots.err}`);
  check("K", "…and never lists Pakistan lots to a UAE user, while showing the UAE destination lot", aeLots.status === 200 && !(aeLots.data?.lots ?? []).some((l) => l.lotId === lotP.id || l.lotId === lotW.id) && (aeLots.data?.lots ?? []).some((l) => l.lotId === dLot?.id), `${aeLots.status} ${aeLots.err}`);
  const life = await admin("GET", `/api/erp/purchases/local-purchase/${P1}/lifecycle`);
  check("K", "lifecycle report returns purchase, payment, lots, sales, trades and a timeline", life.status === 200 && life.data.lots.length === 2 && life.data.sales.length >= 1 && life.data.trades.length >= 2 && life.data.events.length > 5 && !!life.data.purchaseEntry, life.err);

  const allLots = await sql`select l.id from public.purchase_lots l where l.local_purchase_id = any(${[P1, T.destination_purchase_id]}::uuid[])`;
  for (const l of allLots) {
    const bal = (await sql`select qty_purchased::float8 p, qty_accounted::float8 a from public.purchase_lot_balance_v where lot_id=${l.id}::uuid`)[0];
    check("K", "reconciliation: every lot's stock rows sum to its purchased quantity", near(bal.p, bal.a));
  }
  const unbalanced = await sql`
    select e.id from public.roznamcha_entries e
    where e.source_module = 'goods_transfer' and e.created_at > now() - interval '3 hours'
      and abs((select coalesce(sum(debit),0) - coalesce(sum(credit),0) from public.roznamcha_lines where roznamcha_entry_id = e.id)) > 0.005`;
  check("K", "every goods-transfer Roznamcha entry is balanced (DR = CR)", unbalanced.length === 0);
  const negPib = await sql`select count(*)::int c from public.product_inventory_balances where quantity_on_hand < 0 or quantity_reserved < 0 or quantity_reserved > quantity_on_hand`;
  check("K", "no negative or over-reserved Inventory balance anywhere", Number(negPib[0].c) === 0);
  const dupSales = await sql`select source_sales_order_id, count(*)::int c from public.inter_country_trades where source_sales_order_id is not null group by 1 having count(*) > 1`;
  const dupPurch = await sql`select destination_purchase_id, count(*)::int c from public.inter_country_trades where destination_purchase_id is not null group by 1 having count(*) > 1`;
  check("K", "no trade shares a sale or a purchase with another trade (database-enforced)", dupSales.length === 0 && dupPurch.length === 0);
}
