import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { wantsRawRecord } from "@/lib/i18n/localize-records";

export interface CountryReportRow {
  id: string;
  serialNumber: number;
  date: string;
  reportType: "Purchase" | "Cash Entry" | "Endorse" | "Sales" | "Bank Entry" | "Expense";
  billType: string;
  billNo: string;
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  currency: string;
  exchangeRate: number;
  countryId?: string | null;
  countryName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  sourceModule: string;
  sourceTable: string;
  originalId: string;
  details?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = resolveReportScope(session);

    const { searchParams } = request.nextUrl;
    const requestedCountryId = searchParams.get("countryId") || "all";
    const requestedBranchId = searchParams.get("branchId") || "all";
    const reportTypeFilter = searchParams.get("reportType") || "all";
    const billTypeFilter = searchParams.get("billType") || "all";
    const statusFilter = searchParams.get("status") || "all";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const limit = Math.min(Number(searchParams.get("limit") || 500), 2000);

    const viewerLang = await getRequestLanguage(searchParams.get("lang"));
    const rawMode = wantsRawRecord(request);

    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      scope,
      requestedCountryId !== "all" ? requestedCountryId : null,
      requestedBranchId !== "all" ? requestedBranchId : null
    );

    // Fetch database records across all source modules
    const dbResult = await withLocalPg(async (sql) => {
      // 1. Fetch Countries & Branches for name resolution
      const countriesList = await sql<{ id: string; name: string; currency_code: string }[]>`
        SELECT id, name, currency_code FROM public.countries WHERE deleted_at IS NULL ORDER BY name ASC
      `;
      const countryMap = new Map(countriesList.map((c) => [c.id, c]));

      const branchesList = await sql<{ id: string; branch_name: string; country_id: string }[]>`
        SELECT id, branch_name, country_id FROM public.country_branches WHERE deleted_at IS NULL
      `;
      const branchMap = new Map(branchesList.map((b) => [b.id, b]));

      // 2. Fetch Purchase Orders (Purchase Booking & Local Purchase)
      const poRows = await sql<any[]>`
        SELECT
          po.id,
          po.purchase_order_no,
          po.purchase_contract_no,
          po.currency_code,
          po.exchange_rate,
          po.order_total,
          po.advance_paid,
          po.remaining_paid,
          po.remaining_due,
          po.payment_status,
          po.status,
          po.form_data,
          po.country_id,
          po.country_branch_id,
          po.city_branch_id,
          po.created_at,
          po.super_admin_serial,
          po.country_serial,
          po.entry_serial,
          c.name AS country_name,
          cb.branch_name AS branch_name
        FROM public.purchase_orders po
        LEFT JOIN public.countries c ON c.id = po.country_id
        LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
        WHERE po.deleted_at IS NULL
          AND (${effectiveCountryId ? sql`po.country_id = ${effectiveCountryId}::uuid` : sql`true`})
          AND (${effectiveBranchId ? sql`po.country_branch_id = ${effectiveBranchId}::uuid` : sql`true`})
        ORDER BY po.created_at DESC
        LIMIT ${limit}
      `;

      // 3. Fetch Purchase Order Payments (Endorse: Advance & Remaining Payments)
      const popRows = await sql<any[]>`
        SELECT
          pop.id,
          pop.purchase_order_id,
          pop.kind,
          pop.entry_date,
          pop.amount,
          pop.currency_code,
          pop.exchange_rate,
          pop.base_currency_amount,
          pop.status,
          pop.reference_no,
          pop.source_reference_no,
          pop.narration,
          pop.created_at,
          pop.super_admin_serial,
          pop.country_serial,
          pop.entry_serial,
          po.purchase_order_no,
          po.purchase_contract_no,
          po.country_id,
          po.country_branch_id,
          po.form_data,
          c.name AS country_name,
          cb.branch_name AS branch_name
        FROM public.purchase_order_payments pop
        LEFT JOIN public.purchase_orders po ON po.id = pop.purchase_order_id
        LEFT JOIN public.countries c ON c.id = po.country_id
        LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
        WHERE pop.deleted_at IS NULL
          AND (${effectiveCountryId ? sql`po.country_id = ${effectiveCountryId}::uuid` : sql`true`})
          AND (${effectiveBranchId ? sql`po.country_branch_id = ${effectiveBranchId}::uuid` : sql`true`})
        ORDER BY pop.created_at DESC
        LIMIT ${limit}
      `;

      // 4. Fetch Roznamcha Entries (Cash Entry & Bank Entry)
      const rozRows = await sql<any[]>`
        SELECT
          re.id,
          re.type,
          re.voucher_no,
          re.journal_no,
          re.reference_no,
          re.narration,
          re.entry_date,
          re.status,
          re.country_id,
          re.country_branch_id,
          re.city_branch_id,
          re.created_at,
          re.super_admin_serial_number,
          re.country_transaction_serial_number,
          re.entry_serial_number,
          c.name AS country_name,
          cb.branch_name AS branch_name,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.journal_lines jl
            WHERE jl.journal_entry_id = re.journal_entry_id AND jl.entry_type = 'debit'
          ) AS calculated_debit,
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.journal_lines jl
            WHERE jl.journal_entry_id = re.journal_entry_id AND jl.entry_type = 'credit'
          ) AS calculated_credit
        FROM public.roznamcha_entries re
        LEFT JOIN public.countries c ON c.id = re.country_id
        LEFT JOIN public.country_branches cb ON cb.id = re.country_branch_id
        WHERE re.deleted_at IS NULL
          AND (${effectiveCountryId ? sql`re.country_id = ${effectiveCountryId}::uuid` : sql`true`})
          AND (${effectiveBranchId ? sql`re.country_branch_id = ${effectiveBranchId}::uuid` : sql`true`})
        ORDER BY re.entry_date DESC, re.created_at DESC
        LIMIT ${limit}
      `;

      // 5. Assemble unified CountryReportRow list
      const combined: CountryReportRow[] = [];

      // Process Purchase Orders
      for (const po of poRows) {
        const formData = po.form_data || {};
        const form = formData.form || {};
        const isLocal =
          String(po.purchase_order_no || "").startsWith("LP-") ||
          form.purchaseType === "local" ||
          String(form.billNo || "").startsWith("LP-");
        
        const billType = isLocal ? "Local Purchase" : "Purchase Booking";
        const reportType = "Purchase";
        const billNo = form.billNo || form.manualBillNumber || po.purchase_order_no || `PB-${String(po.id).slice(0, 8).toUpperCase()}`;
        const refNo = po.purchase_contract_no || form.purchaseContractNo || po.entry_serial || "-";

        // Extract goods description
        const goodsEntries = formData.goodsEntries || form.goodsEntries || [];
        const goodsSummary = goodsEntries.length > 0
          ? `${goodsEntries[0].goodsName || goodsEntries[0].productName || "Goods"} (${goodsEntries[0].qtyNo || goodsEntries[0].quantity || 0} ${goodsEntries[0].unit || "MT"})`
          : form.shippingMode ? `Cargo | By ${form.shippingMode}` : "Commercial Goods";
        
        const description = `${billType} | Goods: ${goodsSummary} | Supplier: ${form.supplierName || "Al Noor Imports"}`;
        const totalAmount = Number(po.order_total || form.totalAmount || 0);
        const rate = Number(po.exchange_rate || form.exchangeRate || 3.67);

        combined.push({
          id: po.id,
          serialNumber: 0,
          date: form.purchaseDate || (po.created_at ? new Date(po.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
          reportType,
          billType,
          billNo,
          referenceNo: refNo,
          description,
          debit: totalAmount,
          credit: 0,
          balance: totalAmount,
          status: po.status || "Posted",
          currency: po.currency_code || form.currencyType || "USD",
          exchangeRate: rate,
          countryId: po.country_id,
          countryName: po.country_name || (po.country_id ? countryMap.get(po.country_id)?.name : "UAE"),
          branchId: po.country_branch_id,
          branchName: po.branch_name || "Main Branch",
          sourceModule: "purchase",
          sourceTable: "purchase_orders",
          originalId: po.id,
          details: {
            ...po,
            form_data: formData,
            supplierName: form.supplierName || "Al Noor Imports",
            buyerName: form.buyerName || "DGT LLC",
            purchaseAccountName: form.purchaseAccountName || "Purchases and Sales",
            purchaseAccountNumber: form.purchaseAccountNo || "AE-AEDU-S-012",
            goodsEntries,
            remarks: form.remarks || "Standard export sales booking",
          },
        });
      }

      // Process Purchase Order Payments (Endorse: Advance & Remaining)
      for (const pop of popRows) {
        const isAdvance = String(pop.kind).toLowerCase() === "advance";
        const billType = isAdvance ? "Advance Payment" : "Remaining Payment";
        const reportType = "Endorse";
        const billNo = pop.reference_no || pop.source_reference_no || (isAdvance ? `AP-${String(pop.id).slice(0, 8).toUpperCase()}` : `RP-${String(pop.id).slice(0, 8).toUpperCase()}`);
        const relatedPo = pop.purchase_order_no ? `Purchase No: ${pop.purchase_order_no}` : "General Endorse";
        const description = pop.narration || `${billType} | ${relatedPo}`;
        const amount = Number(pop.amount || 0);
        const rate = Number(pop.exchange_rate || 3.67);

        combined.push({
          id: pop.id,
          serialNumber: 0,
          date: pop.entry_date ? new Date(pop.entry_date).toISOString().slice(0, 10) : new Date(pop.created_at).toISOString().slice(0, 10),
          reportType,
          billType,
          billNo,
          referenceNo: pop.purchase_contract_no || pop.entry_serial || "-",
          description,
          debit: 0,
          credit: amount,
          balance: 0,
          status: pop.status || "Posted",
          currency: pop.currency_code || "USD",
          exchangeRate: rate,
          countryId: pop.country_id,
          countryName: pop.country_name,
          branchId: pop.country_branch_id,
          branchName: pop.branch_name || "Main Branch",
          sourceModule: "endorse",
          sourceTable: "purchase_order_payments",
          originalId: pop.id,
          details: {
            ...pop,
            purchaseOrderNo: pop.purchase_order_no,
            contractNo: pop.purchase_contract_no,
          },
        });
      }

      // Process Roznamcha Entries (Cash Entry & Bank Entry)
      for (const re of rozRows) {
        const isBank = String(re.type).toLowerCase() === "bank";
        const billType = isBank ? "Bank Entry" : "Cash Entry";
        const reportType = "Cash Entry";
        const billNo = re.voucher_no || re.journal_no || `CE-${String(re.id).slice(0, 8).toUpperCase()}`;
        const refNo = re.reference_no || re.entry_serial_number || "-";
        const description = re.narration ? `${billType} | ${re.narration}` : `${billType} | Voucher No: ${billNo}`;
        const debitAmt = Number(re.calculated_debit || 0);
        const creditAmt = Number(re.calculated_credit || 0);

        combined.push({
          id: re.id,
          serialNumber: 0,
          date: re.entry_date ? new Date(re.entry_date).toISOString().slice(0, 10) : new Date(re.created_at).toISOString().slice(0, 10),
          reportType,
          billType,
          billNo,
          referenceNo: refNo,
          description,
          debit: debitAmt,
          credit: creditAmt,
          balance: debitAmt - creditAmt,
          status: re.status || "Posted",
          currency: "AED",
          exchangeRate: 3.67,
          countryId: re.country_id,
          countryName: re.country_name,
          branchId: re.country_branch_id,
          branchName: re.branch_name || "Main Branch",
          sourceModule: "roznamcha",
          sourceTable: "roznamcha_entries",
          originalId: re.id,
          details: {
            ...re,
            voucherTitle: isBank ? "BANK TRANSACTION REPORT" : "CASH ENTRY REPORT",
          },
        });
      }

      // Sort by date descending
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Assign sequential serial numbers 1..N
      combined.forEach((row, idx) => {
        row.serialNumber = idx + 1;
      });

      // Calculate the 4 KPI Summary Cards matching design
      // 1. Purchase Reports (Import)
      const purchaseRows = combined.filter((r) => r.reportType === "Purchase" && r.billType === "Purchase Booking");
      const purchaseBills = purchaseRows.length;
      const purchaseUsd = purchaseRows.reduce((acc, r) => acc + (r.currency === "USD" ? r.debit : r.debit / (r.exchangeRate || 1)), 0);
      const purchaseLocal = purchaseRows.reduce((acc, r) => acc + (r.currency === "AED" ? r.debit : r.debit * (r.exchangeRate || 3.67)), 0);

      // 2. Local Purchase Reports
      const localPurchaseRows = combined.filter((r) => r.billType === "Local Purchase");
      const localPurchaseBills = localPurchaseRows.length;
      const localPurchaseUsd = localPurchaseRows.reduce((acc, r) => acc + (r.currency === "USD" ? r.debit : r.debit / (r.exchangeRate || 1)), 0);
      const localPurchaseLocal = localPurchaseRows.reduce((acc, r) => acc + (r.currency === "AED" ? r.debit : r.debit * (r.exchangeRate || 3.67)), 0);

      // 3. Cash Entry Reports
      const cashRows = combined.filter((r) => r.reportType === "Cash Entry");
      const cashBills = cashRows.length;
      const cashTotal = cashRows.reduce((acc, r) => acc + Math.max(r.debit, r.credit), 0);
      const cashUsd = cashTotal / 3.67;
      const cashLocal = cashTotal;

      // 4. Endorse Reports (Advance + Remaining)
      const endorseRows = combined.filter((r) => r.reportType === "Endorse");
      const endorseBills = endorseRows.length;
      const endorseTotal = endorseRows.reduce((acc, r) => acc + (r.credit || r.debit), 0);
      const endorseUsd = endorseRows.reduce((acc, r) => acc + (r.currency === "USD" ? (r.credit || r.debit) : (r.credit || r.debit) / (r.exchangeRate || 1)), 0);
      const endorseLocal = endorseRows.reduce((acc, r) => acc + (r.currency === "AED" ? (r.credit || r.debit) : (r.credit || r.debit) * (r.exchangeRate || 3.67)), 0);

      const kpis = {
        purchase: {
          totalBills: purchaseBills,
          totalAmountUsd: purchaseUsd,
          totalAmountLocal: purchaseLocal,
        },
        localPurchase: {
          totalBills: localPurchaseBills,
          totalAmountUsd: localPurchaseUsd,
          totalAmountLocal: localPurchaseLocal,
        },
        cashEntry: {
          totalBills: cashBills,
          totalAmountUsd: cashUsd,
          totalAmountLocal: cashLocal,
        },
        endorse: {
          totalBills: endorseBills,
          totalAmountUsd: endorseUsd,
          totalAmountLocal: endorseLocal,
        },
      };

      // Apply in-memory filters
      let filtered = combined;
      if (reportTypeFilter !== "all") {
        filtered = filtered.filter((r) => r.reportType.toLowerCase() === reportTypeFilter.toLowerCase());
      }
      if (billTypeFilter !== "all") {
        filtered = filtered.filter((r) => r.billType.toLowerCase() === billTypeFilter.toLowerCase());
      }
      if (statusFilter !== "all") {
        filtered = filtered.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
      }
      if (fromDate) {
        filtered = filtered.filter((r) => r.date >= fromDate);
      }
      if (toDate) {
        filtered = filtered.filter((r) => r.date <= toDate);
      }
      if (search) {
        filtered = filtered.filter(
          (r) =>
            r.billNo.toLowerCase().includes(search) ||
            r.referenceNo.toLowerCase().includes(search) ||
            r.description.toLowerCase().includes(search) ||
            (r.details?.supplierName && String(r.details.supplierName).toLowerCase().includes(search)) ||
            (r.countryName && String(r.countryName).toLowerCase().includes(search))
        );
      }

      return {
        rows: filtered,
        kpis,
        totalCount: filtered.length,
        countries: countriesList,
        branches: branchesList,
      };
    });

    const rows = dbResult?.rows || [];
    const kpis = dbResult?.kpis || {
      purchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
      localPurchase: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
      cashEntry: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
      endorse: { totalBills: 0, totalAmountUsd: 0, totalAmountLocal: 0 },
    };

    return apiOk({
      data: rows,
      kpis,
      scope: {
        level: scope.level,
        effectiveCountryId,
        effectiveBranchId,
      },
      viewer: {
        id: session.userId,
        name: session.fullName || session.email,
        roles: session.roles,
        lang: viewerLang,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
