import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/bill-expenses/[id]/drilldown
 *
 * One scope-enforced payload powering the one-page bill drill-down of the
 * BILL COST, EXPENSES & PROFIT module:
 *   Bill details → Goods → Original purchase/sale (frozen rate) →
 *   Related expense lines + journal/voucher refs → Payments → DR/CR entries →
 *   Total expense → Landed / final cost → Related sales →
 *   Purchased / Sold / Remaining qty + value → Revenue → Profit / Loss →
 *   Documents → Audit trail.
 *
 * NOTHING is recomputed against today's FX — every historical rate is read
 * frozen from the source row. No accounting is created here; this is read-only.
 */

type Money = {
  originalCurrency: string;
  originalAmount: number;
  effectiveRate: number;
  convertedAmount: number;
  functionalCurrency: string;
};

const num = (v: any) => (v == null || v === "" ? 0 : Number(v) || 0);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const scope = resolveReportScope(session);

    const payload = await withLocalPg(async (sql) => {
      const [be] = await sql`
        select be.*, c.name as country_name, c.iso2 as country_code, c.currency_code as country_currency,
               cb.name as country_branch_name,
               cib.city_name as city_branch_name, cib.name as city_branch_alt_name,
               cib.local_currency as branch_currency
        from public.bill_expenses be
        left join public.countries c on c.id = be.country_id
        left join public.country_branches cb on cb.id = be.country_branch_id
        left join public.city_branches cib on cib.id = be.city_branch_id
        where be.id = ${id}::uuid and be.deleted_at is null
        limit 1
      `;
      if (!be) return { notFound: true } as const;

      if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
        return { forbidden: true } as const;
      }
      if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
        return { forbidden: true } as const;
      }

      const fc = String(be.branch_currency || be.country_currency || "USD").toUpperCase().slice(0, 3) || "USD";
      const money = (originalCurrency: string, originalAmount: number, rate: number): Money => {
        const oc = String(originalCurrency || fc).toUpperCase().slice(0, 3) || fc;
        const r = oc === fc ? 1 : rate > 0 ? rate : 1;
        return {
          originalCurrency: oc,
          originalAmount: +originalAmount.toFixed(4),
          effectiveRate: r,
          convertedAmount: +(originalAmount * r).toFixed(2),
          functionalCurrency: fc
        };
      };

      // ---- expense lines (+ journal/voucher for posted lines) --------------------
      const lines = await sql`
        select l.id, l.row_serial, l.expense_type, l.details, l.currency, l.amount, l.exchange_rate,
               l.local_amount, l.tax_pct, l.tax_amount, l.grand_amount,
               l.expense_account_id, l.counter_account_id, l.roznamcha_entry_id,
               l.posting_status, l.posted_at, l.created_at,
               re.journal_no, re.voucher_no, re.entry_date as rz_date, re.status as rz_status,
               ea.name as expense_account_name, ea.code as expense_account_code,
               ca.name as counter_account_name, ca.code as counter_account_code
        from public.bill_expense_lines l
        left join public.roznamcha_entries re on re.id = l.roznamcha_entry_id
        left join public.ledgers ea on ea.id = l.expense_account_id
        left join public.ledgers ca on ca.id = l.counter_account_id
        where l.bill_expense_id = ${id}::uuid and l.deleted_at is null
        order by l.row_serial asc, l.created_at asc
      `;

      const expenseLines = (lines ?? []).map((l: any) => ({
        id: l.id,
        rowSerial: l.row_serial,
        expenseType: l.expense_type,
        details: l.details,
        postingStatus: l.posting_status,
        postedAt: l.posted_at,
        createdAt: l.created_at,
        amount: money(l.currency, num(l.amount), num(l.exchange_rate)),
        taxPct: num(l.tax_pct),
        taxAmount: num(l.tax_amount),
        grandAmount: num(l.grand_amount), // already functional currency
        expenseAccount: l.expense_account_id
          ? { id: l.expense_account_id, code: l.expense_account_code, name: l.expense_account_name }
          : null,
        counterAccount: l.counter_account_id
          ? { id: l.counter_account_id, code: l.counter_account_code, name: l.counter_account_name }
          : null,
        roznamcha: l.roznamcha_entry_id
          ? { id: l.roznamcha_entry_id, journalNo: l.journal_no, voucherNo: l.voucher_no, entryDate: l.rz_date, status: l.rz_status }
          : null
      }));

      const postedExpenseTotal = +expenseLines
        .filter((l) => l.postingStatus === "posted")
        .reduce((s, l) => s + l.grandAmount, 0)
        .toFixed(2);
      const draftExpenseTotal = +expenseLines
        .filter((l) => l.postingStatus !== "posted")
        .reduce((s, l) => s + l.grandAmount, 0)
        .toFixed(2);

      // ---- source bill projection + goods + original figures --------------------
      let sourceBill: any = null;
      let goods: any[] = [];
      let original: { amount: Money; landedCost: Money | null; label: string } | null = null;
      let linkedPurchaseOrderId: string | null = null;
      let purchasedQty = 0;

      const parseGoods = (formData: any) => {
        const entries = Array.isArray(formData?.goodsEntries)
          ? formData.goodsEntries
          : Array.isArray(formData?.form?.goodsEntries)
            ? formData.form.goodsEntries
            : Array.isArray(formData?.goods)
              ? formData.goods
              : [];
        return entries.map((it: any, i: number) => {
          const qty = num(it.qtyNo ?? it.quantity ?? it.qty ?? it.numbers);
          const rate = num(it.rate ?? it.unitPrice ?? it.purchaseRate);
          return {
            row: i + 1,
            name: it.goodsName ?? it.name ?? it.description ?? it.itemName ?? "—",
            variation: it.variationName ?? it.variation ?? it.brand ?? null,
            qty,
            unit: it.unit ?? it.qtyUnit ?? it.uom ?? null,
            weightKgs: num(it.netWeight ?? it.weightKgs ?? it.weight),
            rate,
            amount: num(it.amount ?? it.total ?? qty * rate)
          };
        });
      };

      if (be.source_table === "purchase_orders") {
        const [po] = await sql`
          select id, purchase_order_no, purchase_contract_no, currency_code, purchase_currency,
                 order_total, landed_cost_original, landed_cost_local, exchange_rate,
                 total_goods_original, total_expenses_original, status, ledger_posting_status,
                 payment_status, form_data
          from public.purchase_orders where id = ${be.source_id}::uuid limit 1`;
        if (po) {
          linkedPurchaseOrderId = po.id;
          goods = parseGoods(po.form_data);
          purchasedQty = goods.reduce((s, g) => s + g.qty, 0);
          const oc = po.purchase_currency || po.currency_code || fc;
          const rate = num(po.exchange_rate) || 1;
          original = {
            label: "purchase_order",
            amount: money(oc, num(po.order_total), rate),
            landedCost: po.landed_cost_original != null ? money(oc, num(po.landed_cost_original), rate) : null
          };
          sourceBill = {
            kind: "purchase_orders",
            billNo: po.purchase_order_no,
            contractNo: po.purchase_contract_no,
            status: po.status,
            ledgerPostingStatus: po.ledger_posting_status,
            paymentStatus: po.payment_status,
            currency: oc,
            exchangeRate: rate
          };
        }
      } else if (be.source_table === "local_purchases") {
        const [lp] = await sql`
          select id, manual_bill_no, journal_serial_no, supplier_name, goods_name, purchase_account_no,
                 purchase_currency, local_currency, exchange_rate, final_cost, purchase_cost,
                 quantity_kgs, numbers, net_weight, purchase_rate, rate_type, status, roznamcha_entry_id
          from public.local_purchases where id = ${be.source_id}::uuid limit 1`;
        if (lp) {
          const oc = lp.purchase_currency || fc;
          const rate = num(lp.exchange_rate) || 1;
          const qty = num(lp.numbers) || num(lp.quantity_kgs);
          purchasedQty = qty;
          goods = [{
            row: 1, name: lp.goods_name || "—", variation: lp.rate_type || null,
            qty, unit: lp.rate_type === "weight" ? "kg" : null,
            weightKgs: num(lp.net_weight), rate: num(lp.purchase_rate), amount: num(lp.purchase_cost)
          }];
          original = {
            label: "local_purchase",
            amount: money(oc, num(lp.purchase_cost), rate),
            landedCost: lp.final_cost != null ? money(oc, num(lp.final_cost), rate) : null
          };
          sourceBill = {
            kind: "local_purchases",
            billNo: lp.manual_bill_no || lp.journal_serial_no,
            supplierName: lp.supplier_name,
            status: lp.status,
            currency: oc,
            exchangeRate: rate,
            roznamchaEntryId: lp.roznamcha_entry_id
          };
        }
      } else if (be.source_table === "sales_orders") {
        const [so] = await sql`
          select id, sales_order_no, sales_contract_no, customer_name, account_number, product_summary,
                 currency_code, original_currency_code, exchange_rate, order_total, base_currency_amount,
                 quantity, purchase_order_id, sales_status, ledger_posting_status, payment_status, form_data
          from public.sales_orders where id = ${be.source_id}::uuid limit 1`;
        if (so) {
          linkedPurchaseOrderId = so.purchase_order_id ?? null;
          goods = parseGoods(so.form_data);
          purchasedQty = goods.reduce((s, g) => s + g.qty, 0) || num(so.quantity);
          const oc = so.original_currency_code || so.currency_code || fc;
          const rate = num(so.exchange_rate) || 1;
          original = {
            label: "sales_order",
            amount: money(oc, num(so.order_total), rate),
            landedCost: null
          };
          sourceBill = {
            kind: "sales_orders",
            billNo: so.sales_order_no,
            contractNo: so.sales_contract_no,
            customerName: so.customer_name,
            accountNumber: so.account_number,
            status: so.sales_status,
            ledgerPostingStatus: so.ledger_posting_status,
            paymentStatus: so.payment_status,
            currency: oc,
            exchangeRate: rate
          };
        }
      } else if (be.source_table === "shipping_bl_records") {
        const [bl] = await sql`
          select id, bl_number, container_number, vessel_name, voyage_number, shipping_line_name,
                 loading_port, discharge_port, etd, eta, account_number, debit, credit,
                 currency_code, shipment_status, purchase_order_id, sales_order_id, roznamcha_entry_id
          from public.shipping_bl_records where id = ${be.source_id}::uuid limit 1`;
        if (bl) {
          linkedPurchaseOrderId = bl.purchase_order_id ?? null;
          const oc = bl.currency_code || fc;
          const amt = num(bl.debit) || num(bl.credit);
          original = { label: "shipping_bl", amount: money(oc, amt, 1), landedCost: null };
          sourceBill = {
            kind: "shipping_bl_records",
            billNo: bl.bl_number,
            containerNo: bl.container_number,
            vesselName: bl.vessel_name,
            voyageNumber: bl.voyage_number,
            shippingLineName: bl.shipping_line_name,
            route: [bl.loading_port, bl.discharge_port].filter(Boolean).join(" → "),
            etd: bl.etd,
            eta: bl.eta,
            status: bl.shipment_status,
            currency: oc,
            linkedSalesOrderId: bl.sales_order_id ?? null,
            roznamchaEntryId: bl.roznamcha_entry_id
          };
        }
      } else if (be.source_table === "clearing_payment_bills") {
        const [cp] = await sql`
          select id, bill_no, gd_number, bl_number, order_no, agent_name, port_name,
                 customs_duty, port_charges, demurrage_charges, clearance_fee, freight_charges,
                 other_charges, total_amount, currency_code, payment_status, payment_method, status
          from public.clearing_payment_bills where id = ${be.source_id}::uuid limit 1`;
        if (cp) {
          const oc = cp.currency_code || fc;
          original = { label: "clearing_bill", amount: money(oc, num(cp.total_amount), 1), landedCost: null };
          sourceBill = {
            kind: "clearing_payment_bills",
            billNo: cp.bill_no || cp.gd_number,
            gdNumber: cp.gd_number,
            blNumber: cp.bl_number,
            orderNo: cp.order_no,
            agentName: cp.agent_name,
            portName: cp.port_name,
            charges: {
              customsDuty: num(cp.customs_duty), portCharges: num(cp.port_charges),
              demurrage: num(cp.demurrage_charges), clearanceFee: num(cp.clearance_fee),
              freight: num(cp.freight_charges), other: num(cp.other_charges)
            },
            paymentStatus: cp.payment_status,
            paymentMethod: cp.payment_method,
            status: cp.status,
            currency: oc
          };
        }
      }

      // ---- payments -------------------------------------------------------------
      let payments: any[] = [];
      if (be.source_table === "purchase_orders") {
        const rows = await sql`
          select id, kind, entry_date, amount, currency_code, exchange_rate, status,
                 reference_no, narration, roznamcha_entry_id
          from public.purchase_order_payments
          where purchase_order_id = ${be.source_id}::uuid and deleted_at is null
          order by entry_date asc, created_at asc`;
        payments = (rows ?? []).map((p: any) => ({
          id: p.id, kind: p.kind, date: p.entry_date, status: p.status,
          referenceNo: p.reference_no, narration: p.narration,
          roznamchaEntryId: p.roznamcha_entry_id,
          amount: money(p.currency_code, num(p.amount), num(p.exchange_rate))
        }));
      } else if (be.source_table === "sales_orders") {
        const rows = await sql`
          select id, payment_kind, payment_date, amount, currency_code, exchange_rate, status,
                 manual_reference_number, remarks, roznamcha_entry_id
          from public.sales_order_payments
          where sales_order_id = ${be.source_id}::uuid and deleted_at is null
          order by payment_date asc, created_at asc`;
        payments = (rows ?? []).map((p: any) => ({
          id: p.id, kind: p.payment_kind, date: p.payment_date, status: p.status,
          referenceNo: p.manual_reference_number, narration: p.remarks,
          roznamchaEntryId: p.roznamcha_entry_id,
          amount: money(p.currency_code, num(p.amount), num(p.exchange_rate))
        }));
      }

      // ---- DR/CR entries (roznamcha) — source posting + each expense line + payments
      const entryIds = new Set<string>();
      for (const l of expenseLines) if (l.roznamcha?.id) entryIds.add(l.roznamcha.id);
      for (const p of payments) if (p.roznamchaEntryId) entryIds.add(p.roznamchaEntryId);
      if (sourceBill?.roznamchaEntryId) entryIds.add(sourceBill.roznamchaEntryId);
      // also anything the roznamcha engine tagged against the source id
      const tagged = await sql`
        select id from public.roznamcha_entries
        where source_transaction_id = ${be.source_id}::uuid and deleted_at is null`;
      for (const r of tagged ?? []) entryIds.add(r.id);

      let drCrEntries: any[] = [];
      if (entryIds.size) {
        const idArr = [...entryIds];
        const entries = await sql`
          select e.id, e.journal_no, e.voucher_no, e.entry_date, e.type, e.status, e.narration,
                 e.source_module, e.source_reference_no
          from public.roznamcha_entries e
          where e.id = any(${idArr}::uuid[])
          order by e.entry_date asc, e.created_at asc`;
        const rzLines = await sql`
          select rl.roznamcha_entry_id, rl.description, rl.debit, rl.credit, rl.currency,
                 lg.code as ledger_code, lg.name as ledger_name
          from public.roznamcha_lines rl
          left join public.ledgers lg on lg.id = rl.ledger_id
          where rl.roznamcha_entry_id = any(${idArr}::uuid[])
          order by rl.debit desc nulls last`;
        drCrEntries = (entries ?? []).map((e: any) => ({
          id: e.id, journalNo: e.journal_no, voucherNo: e.voucher_no, entryDate: e.entry_date,
          type: e.type, status: e.status, narration: e.narration,
          sourceModule: e.source_module, sourceReferenceNo: e.source_reference_no,
          lines: (rzLines ?? [])
            .filter((rl: any) => rl.roznamcha_entry_id === e.id)
            .map((rl: any) => ({
              ledgerCode: rl.ledger_code, ledgerName: rl.ledger_name, description: rl.description,
              debit: num(rl.debit), credit: num(rl.credit), currency: rl.currency
            }))
        }));
      }

      // ---- landed / final cost -------------------------------------------------
      const originalFunctional = original ? original.amount.convertedAmount : num(be.original_bill_amount);
      const landedCost = +(originalFunctional + postedExpenseTotal).toFixed(2);

      // ---- related sales + qty tracking + profit -----------------------------
      let relatedSales: any[] = [];
      let soldQty = 0;
      let salesRevenueFunctional = 0;
      const isPurchaseSide = ["purchase_orders", "local_purchases", "shipping_bl_records", "clearing_bill", "clearing_payment_bills"].includes(be.source_table);

      if (isPurchaseSide && linkedPurchaseOrderId) {
        const sales = await sql`
          select id, sales_order_no, customer_name, order_date, quantity, currency_code,
                 original_currency_code, exchange_rate, order_total, base_currency_amount, sales_status
          from public.sales_orders
          where purchase_order_id = ${linkedPurchaseOrderId}::uuid and deleted_at is null
          order by order_date asc`;
        relatedSales = (sales ?? []).map((s: any) => {
          const oc = s.original_currency_code || s.currency_code || fc;
          const rate = num(s.exchange_rate) || 1;
          const m = s.base_currency_amount != null
            ? money(fc, num(s.base_currency_amount), 1)
            : money(oc, num(s.order_total), rate);
          soldQty += num(s.quantity);
          salesRevenueFunctional += m.convertedAmount;
          return {
            id: s.id, salesOrderNo: s.sales_order_no, customerName: s.customer_name,
            orderDate: s.order_date, quantity: num(s.quantity), status: s.sales_status,
            revenue: m
          };
        });
      } else if (be.source_table === "sales_orders") {
        // this bill IS a sale — revenue is its own total
        soldQty = purchasedQty;
        salesRevenueFunctional = original ? original.amount.convertedAmount : 0;
        relatedSales = [];
      }

      salesRevenueFunctional = +salesRevenueFunctional.toFixed(2);
      const remainingQty = +(purchasedQty - soldQty).toFixed(4);
      const unitLandedCost = purchasedQty > 0 ? landedCost / purchasedQty : 0;
      const remainingValue = +(Math.max(remainingQty, 0) * unitLandedCost).toFixed(2);
      const costOfSold = +(Math.min(soldQty, purchasedQty || soldQty) * unitLandedCost).toFixed(2);

      let profit: number | null = null;
      let profitBasis = "";
      if (be.source_table === "sales_orders") {
        // sale bill: revenue - (linked purchase landed cost share) - own extra expenses
        let linkedPurchaseCost = 0;
        if (linkedPurchaseOrderId) {
          const [lp] = await sql`
            select landed_cost_local, landed_cost_original, exchange_rate, purchase_currency, currency_code
            from public.purchase_orders where id = ${linkedPurchaseOrderId}::uuid limit 1`;
          if (lp) {
            linkedPurchaseCost = num(lp.landed_cost_local)
              || money(lp.purchase_currency || lp.currency_code || fc, num(lp.landed_cost_original), num(lp.exchange_rate) || 1).convertedAmount;
          }
        }
        profit = +(salesRevenueFunctional - linkedPurchaseCost - postedExpenseTotal).toFixed(2);
        profitBasis = "sale_revenue_minus_linked_purchase_landed_cost_minus_expenses";
      } else if (isPurchaseSide) {
        profit = relatedSales.length
          ? +(salesRevenueFunctional - costOfSold).toFixed(2)
          : null;
        profitBasis = "linked_sales_revenue_minus_landed_cost_of_sold_qty";
      }

      // ---- documents --------------------------------------------------------
      const docEntityIds = [be.id, be.source_id, ...expenseLines.map((l) => l.id)];
      const documents = await sql`
        select id, name, entity_type, entity_id, mime_type, size_bytes, created_at
        from public.erp_documents
        where entity_id = any(${docEntityIds}::uuid[]) and deleted_at is null
        order by created_at desc`;

      // ---- audit trail -----------------------------------------------------
      const auditIds = [be.id, be.source_id, ...expenseLines.map((l) => l.id)];
      const audit = await sql`
        select a.id, a.action, a.entity_table, a.entity_id, a.created_at,
               p.full_name as actor_name
        from public.audit_logs a
        left join public.profiles p on p.id = a.actor_id
        where a.entity_id = any(${auditIds}::uuid[])
        order by a.created_at desc
        limit 100`;

      return {
        functionalCurrency: fc,
        bill: {
          id: be.id,
          sourceModule: be.source_module,
          sourceTable: be.source_table,
          sourceId: be.source_id,
          billNo: be.bill_no,
          manualBillNo: be.manual_bill_no,
          billDate: be.bill_date,
          transactionDate: be.transaction_date,
          party: { name: be.party_name, accountNo: be.party_account_no },
          country: { id: be.country_id, name: be.country_name, code: be.country_code },
          branchLabel: be.city_branch_name || be.city_branch_alt_name || be.country_branch_name || be.country_name || "—",
          currency: be.currency,
          eligibility: be.eligibility,
          sourceStatus: be.source_status,
          status: be.status,
          createdAt: be.created_at,
          updatedAt: be.updated_at
        },
        sourceBill,
        goods,
        original,
        expenseLines,
        expenseTotals: {
          posted: postedExpenseTotal,
          draft: draftExpenseTotal,
          all: +(postedExpenseTotal + draftExpenseTotal).toFixed(2),
          functionalCurrency: fc
        },
        payments,
        drCrEntries,
        cost: {
          originalBillFunctional: +originalFunctional.toFixed(2),
          postedExpenseTotal,
          landedCost,
          unitLandedCost: +unitLandedCost.toFixed(4),
          functionalCurrency: fc
        },
        quantity: {
          purchased: +purchasedQty.toFixed(4),
          sold: +soldQty.toFixed(4),
          remaining: remainingQty,
          remainingValue,
          functionalCurrency: fc
        },
        relatedSales,
        profitAndLoss: {
          revenue: salesRevenueFunctional,
          costOfSold,
          landedCost,
          profit,
          basis: profitBasis,
          functionalCurrency: fc
        },
        documents: (documents ?? []).map((d: any) => ({
          id: d.id, name: d.name, entityType: d.entity_type, entityId: d.entity_id,
          mimeType: d.mime_type, sizeBytes: d.size_bytes, createdAt: d.created_at
        })),
        audit: (audit ?? []).map((a: any) => ({
          id: a.id, action: a.action, entityTable: a.entity_table, entityId: a.entity_id,
          actorName: a.actor_name, createdAt: a.created_at
        })),
        generatedAt: new Date().toISOString()
      };
    });

    if (!payload) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });
    if ("notFound" in payload) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });
    if ("forbidden" in payload) throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });

    return apiOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
