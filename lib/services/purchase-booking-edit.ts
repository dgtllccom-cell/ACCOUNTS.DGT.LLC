import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { TransactionSql } from "postgres";
import type { z } from "zod";
import { ApiClientError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import type { purchaseOrderUpdateSchema } from "@/lib/api/erp-validation";
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { purchaseOrderTranslationFields } from "@/lib/i18n/purchase-order-translations";
import { calculateBookingEditTotals, bookingAdjustmentLines, roundBookingAmount } from "@/lib/purchases/booking-edit-totals";
import { BOOKING_REPORT_REMARK_FIELDS } from "@/lib/purchases/booking-report";
import { billFxOperator, effectiveFxRate } from "@/lib/purchases/fx-operator";
import { isLedgerPosted, paymentInPurchaseCurrency, verifiedPaid } from "@/lib/purchases/loaded-payable";
import { canEditTransferredPurchaseBooking } from "./purchase-booking-transfer-routing";
import { savePurchaseOrderTranslations } from "./purchase-order-local-pg";

type Row = Record<string, any>;
type EditBody = z.infer<typeof purchaseOrderUpdateSchema>;

function conflict(message: string, code = "BOOKING_CORRECTION_REQUIRED"): never {
  throw new ApiClientError(message, { status: 409, code });
}

function object(value: any): Row {
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const sameMoney = (a: unknown, b: unknown) =>
  Math.abs(Number(a ?? 0) - Number(b ?? 0)) < 0.00011;

const scopeColumns = {
  countryId: "country_id", countryBranchId: "country_branch_id", cityBranchId: "city_branch_id",
  destCountryId: "dest_country_id", destCountryBranchId: "dest_country_branch_id", destCityBranchId: "dest_city_branch_id",
} as const;
const postedAccountFields = ["purchaseAccountId", "purchaseAccountNo", "purchaseAccountLedgerId",
  "salesAccountId", "salesAccountNo", "salesAccountLedgerId", "supplierId", "supplierAccountId",
  "supplierAccountNo", "customerId", "paymentType"];

async function postAdjustment(tx: TransactionSql, order: Row, payments: Row[], oldBase: number,
  newBase: number, baseCurrency: string, reason: string) {
  const booking = payments.filter((row) => row.kind === "booking" && row.status === "posted");
  const original = booking[0];
  if (booking.length !== 1 || !isLedgerPosted(original) || original.debit_ledger_id === original.credit_ledger_id) {
    conflict("The original booking posting could not be identified. Reconcile its journal before changing the amount.");
  }
  const journals = await tx`
    select id, type, country_id, country_branch_id, city_branch_id, status
    from public.roznamcha_entries
    where deleted_at is null and (id = ${original.roznamcha_entry_id}::uuid
      or (source_module = 'purchase' and source_transaction_type = 'purchase_booking_adjustment'
        and source_reference_no = ${order.purchase_order_no}))
  `;
  const entry = journals.find((journal) => journal.id === original.roznamcha_entry_id);
  if (!entry || journals.some((journal) => journal.status !== "posted")) {
    conflict("The booking journal contains an inactive posting. Reconcile it before changing the amount.");
  }
  const lines = await tx`
    select roznamcha_entry_id, ledger_id, debit, credit, currency, usd_rate
    from public.roznamcha_lines where roznamcha_entry_id = any(${journals.map((journal) => journal.id)}::uuid[])
  `;
  const net = (ledger: string) => roundBookingAmount(lines.filter((line) => line.ledger_id === ledger)
    .reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0));
  if (!lines.length || lines.some((line) => String(line.currency).toUpperCase() !== baseCurrency ||
    ![original.debit_ledger_id, original.credit_ledger_id].includes(line.ledger_id)) ||
    !sameMoney(net(original.debit_ledger_id), oldBase) ||
    !sameMoney(net(original.credit_ledger_id), -oldBase)) {
    conflict("The original journal and its adjustments do not reconcile to the saved booking total.");
  }

  const plan = bookingAdjustmentLines(oldBase, newBase, original.debit_ledger_id, original.credit_ledger_id);
  if (!plan) return null;
  const { delta, amount, debitLedger, creditLedger } = plan;
  const ref = `PB-ADJ-${randomUUID()}`;
  const description = `Purchase Booking ${order.purchase_order_no} adjustment: ${reason}`;
  const sourceRate = Number(lines.find((line) => line.roznamcha_entry_id === entry.id)?.usd_rate || 1);
  const postingLines = [
    { ledgerId: debitLedger, paymentEntryType: "debit", description, debit: amount, credit: 0, currency: baseCurrency, usdRate: sourceRate },
    { ledgerId: creditLedger, paymentEntryType: "credit", description, debit: 0, credit: amount, currency: baseCurrency, usdRate: sourceRate },
  ];
  // Use the journal's posting engine so period, serial and ledger rules apply to the adjustment.
  const [posted] = await tx`
    select public.post_roznamcha_entry(${entry.type}::roznamcha_type, ${entry.country_id}::uuid,
      ${entry.country_branch_id}::uuid, ${entry.city_branch_id}::uuid,
      ${ref}, ${ref}, current_date, null, ${order.purchase_order_no}, ${description},
      ${tx.json(postingLines)}, false) as id
  `;
  const adjustmentId = posted?.id;
  if (!adjustmentId) throw new Error("Booking adjustment was not posted.");
  const [adjustmentEntry] = await tx`
    update public.roznamcha_entries
    set source_module = 'purchase', source_transaction_type = 'purchase_booking_adjustment',
        source_transaction_id = ${adjustmentId}::uuid, source_reference_no = ${order.purchase_order_no},
        original_currency_code = ${baseCurrency}, currency_name = ${baseCurrency}, base_currency_amount = ${amount},
        entry_category = 'business', operational_domain = 'business'
    where id = ${adjustmentId}::uuid
    returning super_admin_serial_number
  `;
  const adjustmentLines = await tx`
    select ledger_id, debit, credit, currency from public.roznamcha_lines where roznamcha_entry_id = ${adjustmentId}::uuid
  `;
  if (adjustmentLines.length !== 2 || adjustmentLines.some((line) => line.currency !== baseCurrency) ||
    !adjustmentLines.some((line) => line.ledger_id === debitLedger && sameMoney(line.debit, amount) && sameMoney(line.credit, 0)) ||
    !adjustmentLines.some((line) => line.ledger_id === creditLedger && sameMoney(line.credit, amount) && sameMoney(line.debit, 0))) {
    throw new Error("Booking adjustment failed debit and credit verification.");
  }
  return { adjustmentId, originalEntryId: entry.id, serial: adjustmentEntry.super_admin_serial_number ?? ref, delta, currency: baseCurrency };
}

export async function editPurchaseBooking({ session, orderId, body, ipAddress }: {
  session: ErpSession; orderId: string; body: EditBody; ipAddress: string | null;
}) {
  if (!session.userId) throw new ApiClientError("An authenticated editor is required.", { status: 403, code: "EDITOR_REQUIRED" });
  const result = await withLocalPg((sql) => sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: "authenticated" })}, true)`;
    const [order] = await tx`
      select po.*, po.updated_at::text as edit_version,
        (select upper(currency_code) from public.countries where id = po.country_id) as base_currency
      from public.purchase_orders po where po.id = ${orderId}::uuid and po.deleted_at is null for update
    `;
    if (!order) throw new ApiClientError("Purchase Booking not found.", { status: 404, code: "BOOKING_NOT_FOUND" });
    authorizeApiScope(session, { resource: "purchases", action: "update", countryId: order.country_id,
      countryBranchId: order.country_branch_id, cityBranchId: order.city_branch_id });
    const [version] = await tx`select ${order.edit_version}::timestamptz = ${body.expectedUpdatedAt}::timestamptz as matches`;
    if (!version.matches) conflict("This booking changed after it was opened. Reload it before saving.", "BOOKING_CHANGED");
    if (order.ledger_posting_status === "cancelled" || order.payment_status === "cancelled") {
      conflict("A cancelled booking cannot be edited.");
    }
    if (body.purchaseOrderNo && body.purchaseOrderNo !== order.purchase_order_no) {
      conflict("The original booking number cannot be changed.", "BOOKING_NUMBER_IMMUTABLE");
    }

    const previousData = object(order.form_data);
    const inputData = object(body.formData);
    const previousForm = object(previousData.form);
    const hasGoodsEdit = body.items !== undefined;
    const formPatch = object(inputData.form);
    const editableRemarks = Object.fromEntries(Object.values(BOOKING_REPORT_REMARK_FIELDS)
      .filter((field) => typeof formPatch[field] === "string")
      .map((field) => [field, formPatch[field]]));
    const nextForm: Row = { ...previousForm, ...(hasGoodsEdit ? formPatch : editableRemarks),
      purchaseOrderNo: order.purchase_order_no };
    const posted = ["posted", "transferred"].includes(order.ledger_posting_status) ||
      String(previousData.workflow?.transferStatus).toLowerCase() === "transferred";
    if (posted && !canEditTransferredPurchaseBooking(session)) {
      throw new ApiClientError("Only an administrator can edit a posted booking.", { status: 403, code: "BOOKING_EDIT_FORBIDDEN" });
    }
    // Booking identity and scope are also used as source keys by loading and stock reports.
    for (const [key, column] of Object.entries(scopeColumns) as [keyof typeof scopeColumns, string][]) {
      const requested = body[key] ?? nextForm[key];
      const saved = order[column] ?? previousForm[key] ?? null;
      if (requested && requested !== saved) conflict("The origin and destination of a saved booking require a separate correction.");
    }
    if (posted && postedAccountFields.some((key) => String(nextForm[key] || "") !== String(previousForm[key] || ""))) {
      conflict("Changing the accounts or terms of a posted booking requires a separate accounting correction.");
    }
    if (posted && body.supplierCompanyId && body.supplierCompanyId !== order.supplier_company_id) {
      conflict("Changing the supplier of a posted booking requires a separate accounting correction.");
    }

    const payments = await tx`select * from public.purchase_order_payments where purchase_order_id = ${orderId}::uuid and deleted_at is null`;
    const settled = payments.some((payment) => payment.kind !== "booking" && payment.status === "posted");
    const loading = await tx`
      select id, loaded_quantity, loading_status, report_payload, total_quantity, loading_percentage
      from public.purchase_loading_records where deleted_at is null and loading_status <> 'cancelled'
        and (purchase_order_id = ${orderId}::uuid or purchase_order_no = ${order.purchase_order_no})
    `;
    const [dependencies] = await tx`
      select exists (select 1 from public.stock_movements where purchase_order_id = ${orderId}::uuid)
        or exists (select 1 from public.sales_orders where purchase_order_id = ${orderId}::uuid)
        or exists (select 1 from public.journal_stock_transfers where purchase_order_id = ${orderId}::uuid) as downstream
    `;
    const loadedQuantity = (row: Row) => {
      const report = object(row.report_payload);
      return Number(row.loaded_quantity || report.loadedQuantity || report.loadingQuantity || 0);
    };
    const loaded = roundBookingAmount(loading.reduce((total, row) => total + loadedQuantity(row), 0));
    const oldGoods = Array.isArray(previousData.goodsEntries) ? previousData.goodsEntries : [];
    const incomingGoods = inputData.goodsEntries;
    if (hasGoodsEdit && (!Array.isArray(incomingGoods) || incomingGoods.length !== body.items?.length)) {
      conflict("Save the complete list of booking goods and prices together.");
    }
    const currency = body.currencyCode ?? order.currency_code;
    const payCurrency = body.paymentCurrencyCode ?? order.payment_currency;
    const rate = body.exchangeRate ?? Number(order.exchange_rate || 1);
    const operator = billFxOperator({ ...previousData, ...inputData, form: nextForm });
    const fxChanged = rate !== Number(order.exchange_rate) || operator !== billFxOperator(previousData) ||
      currency !== order.currency_code || payCurrency !== order.payment_currency;
    if (!hasGoodsEdit && (fxChanged || (body.orderTotal !== undefined && !sameMoney(body.orderTotal, order.order_total)) ||
      (incomingGoods !== undefined && !isDeepStrictEqual(incomingGoods, oldGoods)))) {
      conflict("Changes to the currency, goods or total require a complete booking save.");
    }
    if ((posted || settled) && (currency !== order.currency_code || payCurrency !== order.payment_currency)) {
      conflict("Changing currencies on a posted or paid booking requires a separate accounting correction.");
    }
    if (body.expenses !== undefined) conflict("Use the booking expenses workflow to correct expenses.");

    const patch: Row = { updated_at: tx`clock_timestamp()` };
    if (body.purchaseContractNo !== undefined) patch.purchase_contract_no = body.purchaseContractNo || null;
    if (body.supplierCompanyId !== undefined && !posted) patch.supplier_company_id = body.supplierCompanyId ?? null;
    const formData: Row = { ...previousData, form: nextForm,
      ...(hasGoodsEdit && inputData.reports !== undefined ? { reports: inputData.reports } : {}) };
    const beforeItems = await tx`select * from public.purchase_order_items where purchase_order_id = ${orderId}::uuid order by created_at, id`;
    let adjustment: Awaited<ReturnType<typeof postAdjustment>> = null;
    let changedItems = false;
    let revisedQuantity: number | undefined;
    if (hasGoodsEdit) {
      let calculation: ReturnType<typeof calculateBookingEditTotals>;
      try { calculation = calculateBookingEditTotals(incomingGoods, rate, operator); }
      catch (error) { throw new ApiClientError((error as Error).message, { status: 400, code: "INVALID_BOOKING_GOODS" }); }
      const { lines, totals, multiplier } = calculation;
      Object.assign(nextForm, { exchangeRate: rate, operator, currencyType: currency, purchaseCurrency: currency });
      if (payCurrency) nextForm.secondaryCurrency = payCurrency;
      const goodsValues = (goods: Row[]) => goods.map((line) => ({
        identity: ["goodsName", "goodsId", "productId", "qtyName", "hsCode", "size", "brand", "origin", "priceType", "divideType"]
          .map((field) => String(line[field] || "").trim()),
        values: ["qtyNo", "qtyKgs", "emptyKgs", "divideWeight", "coursePrice", "grossWeight", "netWeight", "totalAmount", "finalAmount"]
          .map((field) => roundBookingAmount(Number(line[field] || 0))),
      }));
      changedItems = !isDeepStrictEqual(goodsValues(lines), goodsValues(oldGoods)) || fxChanged;
      if (changedItems && (dependencies.downstream || loading.length)) {
        const [beforeLine] = goodsValues(oldGoods);
        const [afterLine] = goodsValues(lines);
        const [beforeGoods] = oldGoods;
        const [afterGoods] = lines;
        const sameBasis = oldGoods.length === 1 && lines.length === 1 && beforeGoods && afterGoods &&
          isDeepStrictEqual(beforeLine.identity, afterLine.identity) &&
          isDeepStrictEqual(beforeLine.values.slice(1, 5), afterLine.values.slice(1, 5)) &&
          sameMoney(Number(beforeGoods.netWeight) / Number(beforeGoods.qtyNo), afterGoods.netWeight / afterGoods.qtyNo) &&
          sameMoney(Number(beforeGoods.totalAmount) / Number(beforeGoods.qtyNo), afterGoods.totalAmount / afterGoods.qtyNo);
        if (dependencies.downstream || fxChanged || settled || !sameBasis || !Number.isFinite(loaded) ||
          totals.totalQty < loaded || loading.some((row) => !loadedQuantity(row) &&
            !["draft", "pending"].includes(row.loading_status))) {
          conflict("The change conflicts with recorded loading, payment, inventory, or sales. Use the linked correction workflow.");
        }
        // Only the outstanding single-goods quantity can change here. Existing
        // loaded weights, costs, actual quantities and operational records are retained.
        revisedQuantity = totals.totalQty;
      }
      const baseCurrency = order.base_currency || payCurrency;
      if (baseCurrency && payCurrency !== baseCurrency) conflict("The converted booking currency must match the booking country's currency.");
      const paymentRate = currency === baseCurrency ? 1 : multiplier;
      const paid = verifiedPaid(payments, currency, paymentRate);
      if (paid.ledgerGaps) conflict("A linked payment is missing its ledger posting. Reconcile it before changing the booking.");
      if (paid.settledFC > totals.grandPrimaryFinal + 0.0001) {
        conflict("The corrected amount is below what has already been paid. Use the settlement correction workflow.");
      }
      if (posted && (changedItems || !sameMoney(totals.grandFinal, order.order_total))) {
        if (!baseCurrency || totals.grandFinal <= 0) conflict("A posted booking requires a positive amount in its ledger currency.");
        adjustment = await postAdjustment(tx, order, payments, Number(order.order_total), totals.grandFinal, baseCurrency, body.editReason);
      }
      const sumPaid = (kind: string) => roundBookingAmount(payments
        .filter((payment) => payment.kind === kind && isLedgerPosted(payment))
        .reduce((sum, payment) => sum + paymentInPurchaseCurrency(payment, currency, paymentRate), 0));
      const due = Math.max(0, roundBookingAmount(totals.grandPrimaryFinal - paid.settledFC));
      Object.assign(patch, { currency_code: currency, purchase_currency: currency, payment_currency: payCurrency,
        exchange_rate: rate, order_total: totals.grandFinal, total_goods_original: totals.grandPrimaryFinal,
        total_goods_local: totals.grandFinal, total_goods_usd: totals.grandPrimaryFinal,
        advance_paid: paid.advanceFC, remaining_paid: sumPaid("remaining"), credit_amount: sumPaid("credit"),
        remaining_due: due, payment_status: due === 0 && totals.grandPrimaryFinal > 0 ? "completed" : paid.settledFC > 0 ? "partial" : "pending" });
      if (posted) patch.is_edited_since_transfer = false;
      formData.goodsEntries = lines.map((line) => ({ ...line, purchaseCurrency: currency, currencyType: currency,
        ...(payCurrency ? { secondaryCurrency: payCurrency } : {}) }));
      formData.totals = { ...previousData.totals, ...totals, totalQuantity: totals.totalQty };
      const workflow = object(previousData.workflow);
      formData.workflow = { ...workflow, totalQuantity: totals.totalQty,
        remainingQuantity: Math.max(0, roundBookingAmount(totals.totalQty - loaded)) };
      if (revisedQuantity !== undefined) {
        formData.workflow.containerStatus = totals.totalQty === loaded ? "Fully Loaded" : "Partially Loaded";
      }
      if (adjustment) {
        formData.workflow.lastBookingAdjustment = adjustment;
        const posting = previousData.workflow?.posting;
        if (posting?.debit && posting?.credit) {
          const side = { amount: totals.grandFinal, originalAmount: totals.grandPrimaryFinal };
          formData.workflow.posting = { ...posting, rate, op: operator, adjustment,
            debit: { ...posting.debit, ...side }, credit: { ...posting.credit, ...side } };
        }
      }
    }

    // Keep the immutable booking keys and workflow supplied by the server.
    if (body.formData !== undefined || hasGoodsEdit) patch.form_data = tx.json(formData as never);
    await tx`update public.purchase_orders set ${tx(patch)} where id = ${orderId}::uuid`;
    const loadingAfter = revisedQuantity === undefined ? loading : await tx`update public.purchase_loading_records set total_quantity = ${revisedQuantity},
        loading_percentage = round(loaded_quantity / ${revisedQuantity}::numeric * 100, 4)
        where id = any(${loading.map((row) => row.id)}::uuid[])
        returning id, loaded_quantity, loading_status, report_payload, total_quantity, loading_percentage`;

    if (changedItems) {
      const lines: Row[] = formData.goodsEntries;
      for (const [index, line] of lines.entries()) {
        const candidate = body.items?.[index];
        const old = beforeItems[index];
        const isTaxable = candidate?.isTaxable ?? old?.is_taxable ?? true;
        const vatRate = Number(candidate?.vatRate ?? old?.vat_rate ?? 5);
        const taxable = isTaxable ? line.finalAmount : 0;
        const productId = candidate?.productId;
        const [product] = productId ? await tx`select id from public.products where id::text = ${String(productId)}` : [];
        const row = { product_id: product?.id ?? old?.product_id ?? null, goods_name: String(line.goodsName), hs_code: line.hsCode ?? null, size: line.size ?? null,
          brand: line.brand ?? null, origin: line.origin ?? null, quantity: line.qtyNo, unit_name: String(line.qtyName || "pcs"),
          unit_weight: line.divideWeight, gross_weight: line.grossWeight, net_weight: line.netWeight,
          rate_original: line.coursePrice, rate_local: roundBookingAmount(line.coursePrice * effectiveFxRate(rate, operator)), rate_usd: line.coursePrice,
          total_original: line.totalAmount, total_local: line.finalAmount, total_usd: line.totalAmount,
          is_taxable: isTaxable, vat_rate: vatRate, taxable_amount: taxable, vat_amount: Math.round(taxable * vatRate) / 100 };
        if (old) {
          await tx`update public.purchase_order_items set ${tx(row)}, updated_at = now() where id = ${old.id}::uuid`;
        } else {
          await tx`insert into public.purchase_order_items ${tx({ ...row, purchase_order_id: orderId })}`;
        }
      }
      const removed = beforeItems.slice(lines.length).map((item) => item.id);
      if (removed.length) await tx`delete from public.purchase_order_items where id = any(${removed}::uuid[])`;
    }

    if (body.formData !== undefined || changedItems) {
      const previousFields = new Map(purchaseOrderTranslationFields(previousData, oldGoods)
        .map((field) => [field.fieldName, field.value]));
      await savePurchaseOrderTranslations(tx, {
        recordId: orderId, actorId: session.userId, originalLanguage: body.originalLanguage ??
          previousData.translationOriginalLanguage ?? session.preferredLanguage ?? "en",
        fields: purchaseOrderTranslationFields(formData, formData.goodsEntries ?? [])
          .filter((field) => field.value !== previousFields.get(field.fieldName) || body.translations?.[field.fieldName])
          .map((field) => ({
            ...field, translations: body.translations?.[field.fieldName],
          })),
      });
    }
    const [saved] = await tx`select *, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as version
      from public.purchase_orders where id = ${orderId}::uuid`;
    const afterItems = changedItems
      ? await tx`select * from public.purchase_order_items where purchase_order_id = ${orderId}::uuid order by created_at, id`
      : beforeItems;
    await tx`
      insert into public.audit_logs (actor_id, action, entity_table, entity_id, before, after, ip_address)
      values (${session.userId}::uuid, 'purchase_booking.edit', 'purchase_orders', ${orderId}::uuid,
        ${tx.json({ order, items: beforeItems, loading } as never)},
        ${tx.json({ order: saved, items: afterItems, loading: loadingAfter, reason: body.editReason, adjustment } as never)}, ${ipAddress})
    `;
    return { purchaseOrderId: saved.id, purchaseOrderNo: saved.purchase_order_no,
      updatedAt: saved.version, ledgerPostingStatus: saved.ledger_posting_status, adjustment };
  }));
  if (!result) throw new ApiClientError("Transactional booking edits are unavailable.", { status: 503, code: "BOOKING_WRITE_UNAVAILABLE" });
  return result;
}
