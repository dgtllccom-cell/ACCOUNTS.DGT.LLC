import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/bill-expenses/reports?report=<key>
 *
 * The BILL COST, EXPENSES & PROFIT report suite. Returns { columns, rows, totals }
 * for one of 12 report keys. Read-only; scope enforced server-side (a user cannot
 * widen country/branch with query params). No accounting is created and no FX is
 * recomputed — every stored functional-currency figure is read as posted.
 *
 * Shared filters: from, to, countryId, branchId, module, party, expenseType,
 * currency, status (bill status), postingStatus (line posting).
 */

const REPORTS = [
  "bill_wise_expense",
  "bill_wise_final_cost",
  "purchase_cost",
  "sales_and_profit",
  "expense_type",
  "country_wise",
  "branch_wise",
  "party_wise",
  "container_shipment_cost",
  "currency_wise_expense",
  "outstanding_unpaid_expense",
  "profit_loss_by_bill"
] as const;
type ReportKey = (typeof REPORTS)[number];

const PURCHASE_MODULES = ["purchase_booking", "local_purchase", "shipping_bl", "clearing_bill"];
const SALES_MODULES = ["sales_booking", "local_sales"];

const n = (v: any) => (v == null || v === "" ? 0 : Number(v) || 0);
const round2 = (v: number) => +v.toFixed(2);

type Col = { key: string; label: string; align?: "left" | "right" | "center"; kind?: "money" | "qty" | "text" | "date" };

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const scope = resolveReportScope(session);
    const sp = request.nextUrl.searchParams;

    const report = (sp.get("report") || "bill_wise_expense") as ReportKey;
    if (!REPORTS.includes(report)) {
      throw new ApiClientError(`Unknown report "${report}"`, { status: 400, code: "UNKNOWN_REPORT" });
    }

    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      sp.get("countryId") && sp.get("countryId") !== "all" ? sp.get("countryId") : null,
      sp.get("branchId") && sp.get("branchId") !== "all" ? sp.get("branchId") : null
    );
    const from = sp.get("from") || null;
    const to = sp.get("to") || null;
    const moduleF = sp.get("module") && sp.get("module") !== "all" ? sp.get("module") : null;
    const partyF = (sp.get("party") || "").trim();
    const expenseTypeF = sp.get("expenseType") && sp.get("expenseType") !== "all" ? sp.get("expenseType") : null;
    const currencyF = sp.get("currency") && sp.get("currency") !== "all" ? sp.get("currency") : null;
    const statusF = sp.get("status") && sp.get("status") !== "all" ? sp.get("status") : null;
    const postingF = sp.get("postingStatus") && sp.get("postingStatus") !== "all" ? sp.get("postingStatus") : null;

    const payload = await withLocalPg(async (sql) => {
      // ---- base: bills in scope + posted/draft expense rollups -----------------
      const bills = await sql`
        select
          be.id, be.source_module, be.source_id, be.source_table, be.bill_no, be.manual_bill_no,
          be.bill_date, be.transaction_date, be.country_id, be.city_branch_id, be.country_branch_id,
          be.party_name, be.party_account_no, be.currency, be.original_bill_amount,
          be.eligibility, be.status,
          c.name as country_name, c.currency_code as country_currency,
          coalesce(cib.local_currency, ccb.local_currency, c.currency_code, 'USD') as functional_currency,
          coalesce(cib.city_name, ccb.name, c.name, '—') as branch_label,
          coalesce(pl.posted_total, 0) as posted_expense_total,
          coalesce(pl.draft_total, 0)  as draft_expense_total,
          coalesce(pl.line_count, 0)   as line_count
        from public.bill_expenses be
        left join public.countries c on c.id = be.country_id
        left join public.city_branches cib on cib.id = be.city_branch_id
        left join public.country_branches ccb on ccb.id = be.country_branch_id
        left join lateral (
          select
            sum(case when l.posting_status = 'posted' then l.grand_amount else 0 end) as posted_total,
            sum(case when l.posting_status <> 'posted' then l.grand_amount else 0 end) as draft_total,
            count(*) as line_count
          from public.bill_expense_lines l
          where l.bill_expense_id = be.id and l.deleted_at is null
        ) pl on true
        where be.deleted_at is null
          ${effectiveCountryId ? sql`and be.country_id = ${effectiveCountryId}` : sql``}
          ${effectiveBranchId ? sql`and be.city_branch_id = ${effectiveBranchId}` : sql``}
          ${from ? sql`and be.transaction_date >= ${from}` : sql``}
          ${to ? sql`and be.transaction_date <= ${to}` : sql``}
          ${moduleF ? sql`and be.source_module = ${moduleF}` : sql``}
          ${partyF ? sql`and be.party_name ilike ${`%${partyF}%`}` : sql``}
          ${statusF ? sql`and be.status = ${statusF}` : sql``}
        order by be.transaction_date desc nulls last, be.created_at desc
      `;

      const billIds = bills.map((b: any) => b.id);

      // ---- lines (for line-level reports) ------------------------------------
      const lines = billIds.length
        ? await sql`
            select l.id, l.bill_expense_id, l.row_serial, l.expense_type, l.details, l.currency,
                   l.amount, l.exchange_rate, l.local_amount, l.tax_amount, l.grand_amount,
                   l.posting_status, l.posted_at, l.roznamcha_entry_id,
                   re.journal_no
            from public.bill_expense_lines l
            left join public.roznamcha_entries re on re.id = l.roznamcha_entry_id
            where l.bill_expense_id = any(${billIds}::uuid[]) and l.deleted_at is null
              ${expenseTypeF ? sql`and l.expense_type = ${expenseTypeF}` : sql``}
              ${currencyF ? sql`and upper(l.currency) = ${currencyF.toUpperCase()}` : sql``}
              ${postingF ? sql`and l.posting_status = ${postingF}` : sql``}
            order by l.row_serial asc
          `
        : [];

      const billById = new Map(bills.map((b: any) => [b.id, b]));

      // ---- linked sales + landed costs for profit reports -------------------
      const purchaseOrderIds = new Set<string>();
      for (const b of bills) {
        if (b.source_table === "purchase_orders") purchaseOrderIds.add(b.source_id);
      }
      // shipping/sales rows may carry a purchase_order_id link
      const shipSrcIds = bills.filter((b: any) => b.source_table === "shipping_bl_records").map((b: any) => b.source_id);
      const shipLinks = shipSrcIds.length
        ? await sql`select id, purchase_order_id from public.shipping_bl_records where id = any(${shipSrcIds}::uuid[])`
        : [];
      const shipToPo = new Map(shipLinks.map((s: any) => [s.id, s.purchase_order_id]));
      for (const p of shipToPo.values()) if (p) purchaseOrderIds.add(p);

      const salesSrcIds = bills.filter((b: any) => b.source_table === "sales_orders").map((b: any) => b.source_id);
      const salesRows = salesSrcIds.length
        ? await sql`
            select id, purchase_order_id, order_total, base_currency_amount, currency_code,
                   original_currency_code, exchange_rate, quantity, customer_name
            from public.sales_orders where id = any(${salesSrcIds}::uuid[]) and deleted_at is null`
        : [];
      const salesBySrcId = new Map(salesRows.map((s: any) => [s.id, s]));
      for (const s of salesRows) if (s.purchase_order_id) purchaseOrderIds.add(s.purchase_order_id);

      const poArr = [...purchaseOrderIds];
      const poRows = poArr.length
        ? await sql`
            select id, order_total, landed_cost_original, landed_cost_local, currency_code,
                   purchase_currency, exchange_rate, form_data
            from public.purchase_orders where id = any(${poArr}::uuid[])`
        : [];
      const poById = new Map(poRows.map((p: any) => [p.id, p]));

      const linkedSales = poArr.length
        ? await sql`
            select purchase_order_id,
                   sum(coalesce(base_currency_amount, order_total * coalesce(exchange_rate,1))) as revenue,
                   sum(coalesce(quantity,0)) as qty, count(*) as cnt
            from public.sales_orders
            where purchase_order_id = any(${poArr}::uuid[]) and deleted_at is null
            group by purchase_order_id`
        : [];
      const salesByPo = new Map(linkedSales.map((s: any) => [s.purchase_order_id, s]));

      const poFunctional = (po: any, fc: string) => {
        if (!po) return { original: 0, landed: 0, qty: 0 };
        // landed_cost_local is already frozen in functional currency (multi-currency
        // engine) — never re-multiply by a rate. Fall back to order_total as-is.
        const landed = n(po.landed_cost_local) || n(po.order_total);
        const original = landed;
        const ge = Array.isArray(po.form_data?.goodsEntries)
          ? po.form_data.goodsEntries
          : Array.isArray(po.form_data?.form?.goodsEntries)
            ? po.form_data.form.goodsEntries
            : [];
        const qty = ge.reduce((s: number, it: any) => s + n(it.qtyNo ?? it.quantity ?? it.qty), 0);
        return { original, landed, qty };
      };

      // Per-bill computed model
      const model = bills.map((b: any) => {
        const fc = String(b.functional_currency || "USD").toUpperCase().slice(0, 3);
        const posted = round2(n(b.posted_expense_total));
        const draft = round2(n(b.draft_expense_total));
        const originalFunctional = round2(n(b.original_bill_amount));
        const isPurchase = PURCHASE_MODULES.includes(b.source_module);
        const isSales = SALES_MODULES.includes(b.source_module);

        // landed cost
        let landed = round2(originalFunctional + posted);

        // profit
        let revenue = 0;
        let costBase = 0;
        let profit: number | null = null;
        let soldQty = 0;
        let purchasedQty = 0;

        if (b.source_table === "purchase_orders" || (b.source_table === "shipping_bl_records" && shipToPo.get(b.source_id))) {
          const poId = b.source_table === "purchase_orders" ? b.source_id : shipToPo.get(b.source_id);
          const po = poById.get(poId);
          const pf = poFunctional(po, fc);
          purchasedQty = pf.qty;
          // Trust the register snapshot for the original bill amount; add posted expenses.
          landed = round2(originalFunctional + posted);
          const ls = salesByPo.get(poId);
          if (ls) {
            revenue = round2(n(ls.revenue));
            soldQty = n(ls.qty);
            const unit = purchasedQty > 0 ? landed / purchasedQty : 0;
            costBase = round2(Math.min(soldQty, purchasedQty || soldQty) * unit);
            profit = round2(revenue - costBase);
          }
        } else if (b.source_table === "sales_orders") {
          const so = salesBySrcId.get(b.source_id);
          if (so) {
            const rate = n(so.exchange_rate) || 1;
            revenue = round2(n(so.base_currency_amount) || n(so.order_total) * rate);
            soldQty = n(so.quantity);
            let linkedCost = 0;
            if (so.purchase_order_id) {
              const po = poById.get(so.purchase_order_id);
              const pf = poFunctional(po, fc);
              linkedCost = pf.landed;
            }
            costBase = round2(linkedCost);
            profit = round2(revenue - linkedCost - posted);
          }
        }

        return {
          id: b.id,
          module: b.source_module,
          billNo: b.bill_no,
          manualBillNo: b.manual_bill_no,
          date: b.transaction_date || b.bill_date,
          countryId: b.country_id,
          countryName: b.country_name || "—",
          branchLabel: b.branch_label,
          party: b.party_name || b.party_account_no || "—",
          currency: b.currency,
          functionalCurrency: fc,
          originalFunctional,
          postedExpense: posted,
          draftExpense: draft,
          lineCount: n(b.line_count),
          landed,
          revenue,
          costOfSold: costBase,
          profit,
          purchasedQty,
          soldQty,
          isPurchase,
          isSales,
          eligibility: b.eligibility,
          status: b.status
        };
      });

      // ---- report shaping --------------------------------------------------
      const fcOf = model[0]?.functionalCurrency || "USD";
      let columns: Col[] = [];
      let rows: Record<string, any>[] = [];
      let totals: Record<string, any> = {};

      const groupSum = (keyFn: (m: any) => string, labelKey: string) => {
        const map = new Map<string, any>();
        for (const m of model) {
          const g = keyFn(m) || "—";
          const cur = map.get(g) || { group: g, bills: 0, original: 0, posted: 0, landed: 0, revenue: 0, profit: 0 };
          cur.bills += 1;
          cur.original += m.originalFunctional;
          cur.posted += m.postedExpense;
          cur.landed += m.landed;
          cur.revenue += m.revenue;
          cur.profit += m.profit ?? 0;
          map.set(g, cur);
        }
        columns = [
          { key: "group", label: labelKey, kind: "text" },
          { key: "bills", label: "Bills", align: "right", kind: "qty" },
          { key: "original", label: "Original", align: "right", kind: "money" },
          { key: "posted", label: "Posted Expenses", align: "right", kind: "money" },
          { key: "landed", label: "Landed Cost", align: "right", kind: "money" }
        ];
        rows = [...map.values()].map((r) => ({
          group: r.group,
          bills: r.bills,
          original: round2(r.original),
          posted: round2(r.posted),
          landed: round2(r.landed)
        }));
        totals = {
          bills: model.length,
          original: round2(rows.reduce((s, r) => s + r.original, 0)),
          posted: round2(rows.reduce((s, r) => s + r.posted, 0)),
          landed: round2(rows.reduce((s, r) => s + r.landed, 0))
        };
      };

      switch (report) {
        case "bill_wise_expense": {
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "module", label: "Source", kind: "text" },
            { key: "date", label: "Date", kind: "date" },
            { key: "party", label: "Party", kind: "text" },
            { key: "branchLabel", label: "Branch", kind: "text" },
            { key: "lineCount", label: "Lines", align: "right", kind: "qty" },
            { key: "postedExpense", label: "Posted Expenses", align: "right", kind: "money" },
            { key: "draftExpense", label: "Unposted Expenses", align: "right", kind: "money" }
          ];
          rows = model.map((m) => ({
            billNo: m.billNo, module: m.module, date: m.date, party: m.party, branchLabel: m.branchLabel,
            lineCount: m.lineCount, postedExpense: m.postedExpense, draftExpense: m.draftExpense
          }));
          totals = {
            bills: model.length,
            postedExpense: round2(model.reduce((s, m) => s + m.postedExpense, 0)),
            draftExpense: round2(model.reduce((s, m) => s + m.draftExpense, 0))
          };
          break;
        }
        case "bill_wise_final_cost": {
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "module", label: "Source", kind: "text" },
            { key: "party", label: "Party", kind: "text" },
            { key: "originalFunctional", label: "Original Bill", align: "right", kind: "money" },
            { key: "postedExpense", label: "Posted Expenses", align: "right", kind: "money" },
            { key: "landed", label: "Landed / Final Cost", align: "right", kind: "money" }
          ];
          rows = model.map((m) => ({
            billNo: m.billNo, module: m.module, party: m.party,
            originalFunctional: m.originalFunctional, postedExpense: m.postedExpense, landed: m.landed
          }));
          totals = {
            bills: model.length,
            originalFunctional: round2(model.reduce((s, m) => s + m.originalFunctional, 0)),
            postedExpense: round2(model.reduce((s, m) => s + m.postedExpense, 0)),
            landed: round2(model.reduce((s, m) => s + m.landed, 0))
          };
          break;
        }
        case "purchase_cost": {
          const pm = model.filter((m) => m.isPurchase);
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "module", label: "Source", kind: "text" },
            { key: "party", label: "Supplier / Party", kind: "text" },
            { key: "purchasedQty", label: "Qty", align: "right", kind: "qty" },
            { key: "originalFunctional", label: "Purchase Cost", align: "right", kind: "money" },
            { key: "postedExpense", label: "Added Expenses", align: "right", kind: "money" },
            { key: "landed", label: "Landed Cost", align: "right", kind: "money" }
          ];
          rows = pm.map((m) => ({
            billNo: m.billNo, module: m.module, party: m.party, purchasedQty: m.purchasedQty,
            originalFunctional: m.originalFunctional, postedExpense: m.postedExpense, landed: m.landed
          }));
          totals = {
            bills: pm.length,
            originalFunctional: round2(pm.reduce((s, m) => s + m.originalFunctional, 0)),
            postedExpense: round2(pm.reduce((s, m) => s + m.postedExpense, 0)),
            landed: round2(pm.reduce((s, m) => s + m.landed, 0))
          };
          break;
        }
        case "sales_and_profit": {
          const sm = model.filter((m) => m.isSales || (m.isPurchase && m.revenue > 0));
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "module", label: "Source", kind: "text" },
            { key: "party", label: "Party", kind: "text" },
            { key: "revenue", label: "Revenue", align: "right", kind: "money" },
            { key: "costOfSold", label: "Cost of Sold", align: "right", kind: "money" },
            { key: "postedExpense", label: "Expenses", align: "right", kind: "money" },
            { key: "profit", label: "Profit / Loss", align: "right", kind: "money" }
          ];
          rows = sm.map((m) => ({
            billNo: m.billNo, module: m.module, party: m.party, revenue: m.revenue,
            costOfSold: m.costOfSold, postedExpense: m.postedExpense, profit: m.profit
          }));
          totals = {
            bills: sm.length,
            revenue: round2(sm.reduce((s, m) => s + m.revenue, 0)),
            costOfSold: round2(sm.reduce((s, m) => s + m.costOfSold, 0)),
            postedExpense: round2(sm.reduce((s, m) => s + m.postedExpense, 0)),
            profit: round2(sm.reduce((s, m) => s + (m.profit ?? 0), 0))
          };
          break;
        }
        case "expense_type": {
          const map = new Map<string, any>();
          for (const l of lines) {
            const t = l.expense_type || "other";
            const cur = map.get(t) || { group: t, lines: 0, posted: 0, unposted: 0 };
            cur.lines += 1;
            if (l.posting_status === "posted") cur.posted += n(l.grand_amount);
            else cur.unposted += n(l.grand_amount);
            map.set(t, cur);
          }
          columns = [
            { key: "group", label: "Expense Type", kind: "text" },
            { key: "lines", label: "Lines", align: "right", kind: "qty" },
            { key: "posted", label: "Posted", align: "right", kind: "money" },
            { key: "unposted", label: "Unposted", align: "right", kind: "money" },
            { key: "total", label: "Total", align: "right", kind: "money" }
          ];
          rows = [...map.values()].map((r) => ({
            group: r.group, lines: r.lines, posted: round2(r.posted), unposted: round2(r.unposted),
            total: round2(r.posted + r.unposted)
          }));
          totals = {
            lines: lines.length,
            posted: round2(rows.reduce((s, r) => s + r.posted, 0)),
            unposted: round2(rows.reduce((s, r) => s + r.unposted, 0)),
            total: round2(rows.reduce((s, r) => s + r.total, 0))
          };
          break;
        }
        case "country_wise":
          groupSum((m) => m.countryName, "Country");
          break;
        case "branch_wise":
          groupSum((m) => m.branchLabel, "Branch");
          break;
        case "party_wise":
          groupSum((m) => m.party, "Party");
          break;
        case "container_shipment_cost": {
          const cm = model.filter((m) => m.module === "shipping_bl" || m.module === "clearing_bill");
          columns = [
            { key: "billNo", label: "BL / Bill No.", kind: "text" },
            { key: "module", label: "Type", kind: "text" },
            { key: "party", label: "Line / Agent", kind: "text" },
            { key: "date", label: "Date", kind: "date" },
            { key: "originalFunctional", label: "Declared", align: "right", kind: "money" },
            { key: "postedExpense", label: "Added Expenses", align: "right", kind: "money" },
            { key: "landed", label: "Total Shipment Cost", align: "right", kind: "money" }
          ];
          rows = cm.map((m) => ({
            billNo: m.billNo, module: m.module, party: m.party, date: m.date,
            originalFunctional: m.originalFunctional, postedExpense: m.postedExpense, landed: m.landed
          }));
          totals = {
            bills: cm.length,
            originalFunctional: round2(cm.reduce((s, m) => s + m.originalFunctional, 0)),
            postedExpense: round2(cm.reduce((s, m) => s + m.postedExpense, 0)),
            landed: round2(cm.reduce((s, m) => s + m.landed, 0))
          };
          break;
        }
        case "currency_wise_expense": {
          const map = new Map<string, any>();
          for (const l of lines) {
            const cur = (l.currency || "—").toUpperCase();
            const g = map.get(cur) || { group: cur, lines: 0, original: 0, functional: 0 };
            g.lines += 1;
            g.original += n(l.amount);
            g.functional += n(l.grand_amount);
            map.set(cur, g);
          }
          columns = [
            { key: "group", label: "Currency", kind: "text" },
            { key: "lines", label: "Lines", align: "right", kind: "qty" },
            { key: "original", label: "Original Amount", align: "right", kind: "money" },
            { key: "functional", label: "Functional (Grand)", align: "right", kind: "money" }
          ];
          rows = [...map.values()].map((r) => ({
            group: r.group, lines: r.lines, original: round2(r.original), functional: round2(r.functional)
          }));
          totals = {
            lines: lines.length,
            functional: round2(rows.reduce((s, r) => s + r.functional, 0))
          };
          break;
        }
        case "outstanding_unpaid_expense": {
          const outstanding = lines.filter((l: any) => l.posting_status !== "posted");
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "expenseType", label: "Expense Type", kind: "text" },
            { key: "details", label: "Details", kind: "text" },
            { key: "currency", label: "Currency", align: "center", kind: "text" },
            { key: "grand", label: "Grand (Functional)", align: "right", kind: "money" },
            { key: "postingStatus", label: "Posting", align: "center", kind: "text" }
          ];
          rows = outstanding.map((l: any) => {
            const b = billById.get(l.bill_expense_id) as any;
            return {
              billNo: b?.bill_no || "—",
              expenseType: l.expense_type,
              details: l.details || "—",
              currency: l.currency,
              grand: round2(n(l.grand_amount)),
              postingStatus: l.posting_status
            };
          });
          totals = { lines: outstanding.length, grand: round2(rows.reduce((s, r) => s + r.grand, 0)) };
          break;
        }
        case "profit_loss_by_bill": {
          const pm = model.filter((m) => m.profit != null);
          columns = [
            { key: "billNo", label: "Bill No.", kind: "text" },
            { key: "module", label: "Source", kind: "text" },
            { key: "party", label: "Party", kind: "text" },
            { key: "landed", label: "Landed Cost", align: "right", kind: "money" },
            { key: "revenue", label: "Revenue", align: "right", kind: "money" },
            { key: "profit", label: "Profit / Loss", align: "right", kind: "money" }
          ];
          rows = pm.map((m) => ({
            billNo: m.billNo, module: m.module, party: m.party,
            landed: m.landed, revenue: m.revenue, profit: m.profit
          }));
          totals = {
            bills: pm.length,
            landed: round2(pm.reduce((s, m) => s + m.landed, 0)),
            revenue: round2(pm.reduce((s, m) => s + m.revenue, 0)),
            profit: round2(pm.reduce((s, m) => s + (m.profit ?? 0), 0))
          };
          break;
        }
      }

      return {
        report,
        functionalCurrency: fcOf,
        scope: { level: scope.level, countryId: effectiveCountryId, branchId: effectiveBranchId, label: scope.scopeLabel },
        filters: { from, to, module: moduleF, party: partyF || null, expenseType: expenseTypeF, currency: currencyF, status: statusF, postingStatus: postingF },
        columns,
        rows,
        totals,
        rowCount: rows.length,
        generatedAt: new Date().toISOString()
      };
    });

    if (!payload) throw new ApiClientError("Bill-expenses reports need a direct database connection.", { status: 503 });
    return apiOk(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
