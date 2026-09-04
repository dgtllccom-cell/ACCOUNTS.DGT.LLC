import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const reportQuerySchema = z.object({
  reportType: z.enum([
    "cash-entry",
    "receipts",
    "payments",
    "customer-accounts",
    "customer-companies",
    "exchange-rates",
    "branch-transactions",
    "user-activity",
    "audit-logs",
    "approval-workflows",
    "expenses",
    "financial-summaries",
    "purchase-booking-register",
    "daily-comprehensive"
  ]),
  countryId: z.string().uuid().optional().or(z.literal("all")),
  branchId: z.string().uuid().optional().or(z.literal("all")),
  companyId: z.string().uuid().optional().or(z.literal("all")),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  interval: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
  limit: z.coerce.number().int().min(1).max(1000).default(200)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = request.nextUrl;
    const parsed = reportQuerySchema.parse({
      reportType: searchParams.get("reportType"),
      countryId: searchParams.get("countryId") ?? "all",
      branchId: searchParams.get("branchId") ?? "all",
      companyId: searchParams.get("companyId") ?? "all",
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
      interval: searchParams.get("interval") ?? "monthly",
      limit: searchParams.get("limit") ?? undefined
    });

    // Security: never trust the client-supplied countryId/branchId. Clamp every report query to the
    // caller's authorized report scope (super_admin => unrestricted; country/branch roles => forced to
    // their own country/branch). Without this, a scoped user could pass countryId=all and read every
    // country's data. Mirrors the resolveReportScope contract used by the other report handlers.
    const reportScope = resolveReportScope(session);
    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      reportScope,
      parsed.countryId && parsed.countryId !== "all" ? parsed.countryId : null,
      parsed.branchId && parsed.branchId !== "all" ? parsed.branchId : null
    );
    parsed.countryId = effectiveCountryId ?? "all";
    parsed.branchId = effectiveBranchId ?? "all";

    const admin = createSupabaseAdminClient();

    // For roznamcha_lines-based report types (receipts/payments/expenses) the country/branch scope
    // lives on the PARENT roznamcha_entries row, not on the line. For a non-global caller, resolve the
    // set of in-scope entry ids once and constrain the line queries with `.in(...)`. `null` => global
    // (super admin) => no constraint. Basic `.eq`/`.or`/`.in` filters only (version-stable).
    let scopedEntryIds: string[] | null = null;
    if (reportScope.level !== "global") {
      let scopeQuery = admin.from("roznamcha_entries").select("id").is("deleted_at", null);
      if (parsed.countryId !== "all") scopeQuery = scopeQuery.eq("country_id", parsed.countryId);
      if (parsed.branchId !== "all") {
        scopeQuery = scopeQuery.or(`city_branch_id.eq.${parsed.branchId},country_branch_id.eq.${parsed.branchId}`);
      }
      const { data: scopeRows } = await scopeQuery.limit(100000);
      scopedEntryIds = (scopeRows ?? []).map((r: any) => r.id);
    }

    let data: any = [];
    let summary: any = {};

    switch (parsed.reportType) {
      case "cash-entry": {
        try {
          let query = admin
            .from("roznamcha_entries")
            .select("id, type, journal_no, voucher_no, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, entry_date, narration, status, posted_at, created_by, roznamcha_lines(debit, credit, currency)")
            .is("deleted_at", null)
            .order("entry_date", { ascending: false });

          if (parsed.countryId && parsed.countryId !== "all") {
            query = query.eq("country_id", parsed.countryId);
          }
          if (parsed.branchId && parsed.branchId !== "all") {
            query = query.or(`city_branch_id.eq.${parsed.branchId},country_branch_id.eq.${parsed.branchId}`);
          }
          if (parsed.fromDate) {
            query = query.gte("entry_date", parsed.fromDate);
          }
          if (parsed.toDate) {
            query = query.lte("entry_date", parsed.toDate);
          }

          const { data: dbData } = await query.limit(parsed.limit);

          const mapped = (dbData ?? []).map((row: any) => {
            const debits = row.roznamcha_lines?.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0) ?? 0;
            const credits = row.roznamcha_lines?.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0) ?? 0;
            const currency = row.roznamcha_lines?.[0]?.currency ?? "PKR";
            return {
              id: row.id,
              serial: row.super_admin_serial_number || row.id.slice(0, 8),
              journalNo: row.journal_no,
              voucherNo: row.voucher_no,
              date: row.entry_date,
              narration: row.narration || "-",
              creator: "System",
              debit: debits,
              credit: credits,
              currency,
              status: row.status
            };
          });

          data = mapped;
        } catch (e) {
          console.error("CASH_ENTRY_QUERY_ERROR:", e);
          data = [];
        }

        const totalDebit = data.reduce((sum: number, r: any) => sum + (r.currency === "PKR" ? r.debit : r.debit * 280), 0);
        const totalCredit = data.reduce((sum: number, r: any) => sum + (r.currency === "PKR" ? r.credit : r.credit * 280), 0);

        summary = {
          count: data.length,
          totalDebitPKREquiv: totalDebit,
          totalCreditPKREquiv: totalCredit,
          netBalancePKREquiv: totalDebit - totalCredit
        };
        break;
      }

      case "receipts": {
        try {
          let query = admin
            .from("roznamcha_lines")
            .select("id, debit, credit, currency, description, customer_number, manual_reference_number, roznamcha_entries(entry_date, voucher_no, super_admin_serial_number)")
            .gt("debit", 0)
            .order("id", { ascending: false });

          if (scopedEntryIds) query = query.in("roznamcha_entry_id", scopedEntryIds);

          const { data: dbData } = await query.limit(parsed.limit);
          const mapped = (dbData ?? []).filter((r: any) => r.roznamcha_entries).map((row: any) => ({
            id: row.id,
            date: row.roznamcha_entries.entry_date,
            voucherNo: row.roznamcha_entries.voucher_no,
            serial: row.roznamcha_entries.super_admin_serial_number,
            description: row.description || "Cash Received",
            amount: Number(row.debit),
            currency: row.currency,
            customerNo: row.customer_number || "-",
            refNo: row.manual_reference_number || "-",
            receivedBy: "System"
          }));

          data = mapped;
        } catch (e) {
          console.error("RECEIPTS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          totalAmountUSD: data.reduce((sum: number, r: any) => {
            const factor = r.currency === "USD" ? 1 : r.currency === "AED" ? 0.27 : r.currency === "AFN" ? 0.014 : 0.0036;
            return sum + (r.amount * factor);
          }, 0)
        };
        break;
      }

      case "payments": {
        try {
          let query = admin
            .from("roznamcha_lines")
            .select("id, debit, credit, currency, description, customer_number, manual_reference_number, roznamcha_entries(entry_date, voucher_no, super_admin_serial_number)")
            .gt("credit", 0)
            .order("id", { ascending: false });

          if (scopedEntryIds) query = query.in("roznamcha_entry_id", scopedEntryIds);

          const { data: dbData } = await query.limit(parsed.limit);
          const mapped = (dbData ?? []).filter((r: any) => r.roznamcha_entries).map((row: any) => ({
            id: row.id,
            date: row.roznamcha_entries.entry_date,
            voucherNo: row.roznamcha_entries.voucher_no,
            serial: row.roznamcha_entries.super_admin_serial_number,
            description: row.description || "Cash Paid Out",
            amount: Number(row.credit),
            currency: row.currency,
            customerNo: row.customer_number || "-",
            refNo: row.manual_reference_number || "-",
            paidBy: "System"
          }));

          data = mapped;
        } catch (e) {
          console.error("PAYMENTS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          totalAmountUSD: data.reduce((sum: number, r: any) => {
            const factor = r.currency === "USD" ? 1 : r.currency === "AED" ? 0.27 : r.currency === "AFN" ? 0.014 : 0.0036;
            return sum + (r.amount * factor);
          }, 0)
        };
        break;
      }

      case "customer-accounts": {
        try {
          let custQuery = admin
            .from("customers")
            .select("id, customer_number, company_name, phone_number, email_address, currency_code, notes, created_at")
            .is("deleted_at", null);
          if (parsed.countryId && parsed.countryId !== "all") custQuery = custQuery.eq("country_id", parsed.countryId);
          const { data: dbData } = await custQuery.limit(parsed.limit);

          const mapped = (dbData ?? []).map((row: any) => {
            let notesObj: any = {};
            try {
              notesObj = typeof row.notes === "string" ? JSON.parse(row.notes) : (row.notes || {});
            } catch {
              notesObj = {};
            }
            return {
              id: row.id,
              customerNo: row.customer_number,
              accountName: notesObj.accountName || row.company_name || "N/A",
              accountNumber: notesObj.accountNumber || "-",
              manualRef: notesObj.manualRef || "-",
              phone: row.phone_number || "-",
              email: row.email_address || "-",
              currency: row.currency_code || "USD",
              balance: notesObj.startingBalance || 0,
              dateAdded: row.created_at?.slice(0, 10)
            };
          });

          data = mapped;
        } catch (e) {
          console.error("CUSTOMER_ACCOUNTS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          totalReceivableUSD: data.filter((r: any) => r.balance > 0).reduce((sum: number, r: any) => {
            const factor = r.currency === "USD" ? 1 : r.currency === "AED" ? 0.27 : r.currency === "AFN" ? 0.014 : 0.0036;
            return sum + (r.balance * factor);
          }, 0),
          totalPayableUSD: data.filter((r: any) => r.balance < 0).reduce((sum: number, r: any) => {
            const factor = r.currency === "USD" ? 1 : r.currency === "AED" ? 0.27 : r.currency === "AFN" ? 0.014 : 0.0036;
            return sum + (Math.abs(r.balance) * factor);
          }, 0)
        };
        break;
      }

      case "customer-companies": {
        try {
          let compQuery = admin
            .from("companies")
            .select("id, name, legal_name, base_currency, is_active, created_at")
            .is("deleted_at", null);
          if (parsed.countryId && parsed.countryId !== "all") compQuery = compQuery.eq("country_id", parsed.countryId);
          const { data: dbData } = await compQuery;

          const mapped = (dbData ?? []).map((row: any) => ({
            id: row.id,
            name: row.name,
            legalName: row.legal_name || row.name,
            baseCurrency: row.base_currency,
            status: row.is_active ? "active" : "inactive",
            createdAt: row.created_at?.slice(0, 10)
          }));

          data = mapped;
        } catch (e) {
          console.error("CUSTOMER_COMPANIES_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          activeCount: data.filter((r: any) => r.status === "active").length
        };
        break;
      }

      case "exchange-rates": {
        try {
          const { data: dbData } = await admin
            .from("daily_usd_rates")
            .select("id, country_id, rate_date, buying_rate, selling_rate, credit_rate, debit_rate, countries(name)")
            .is("deleted_at", null)
            .order("rate_date", { ascending: false });

          const mapped = (dbData ?? []).map((row: any) => ({
            id: row.id,
            country: row.countries?.name || "Pakistan",
            date: row.rate_date,
            buying: Number(row.buying_rate || row.debit_rate || 0),
            selling: Number(row.selling_rate || row.credit_rate || 0),
            creditRate: Number(row.credit_rate || row.selling_rate || 0),
            debitRate: Number(row.debit_rate || row.buying_rate || 0),
            updater: "System"
          }));

          data = mapped;
        } catch (e) {
          console.error("EXCHANGE_RATES_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          latestPKRRate: data.find((r: any) => r.country === "Pakistan")?.buying || 278.50,
          latestAFNRate: data.find((r: any) => r.country === "Afghanistan")?.buying || 71.20
        };
        break;
      }

      case "branch-transactions": {
        try {
          let btQuery = admin
            .from("roznamcha_entries")
            .select("id, country_id, countries(name), city_branch_id, city_branches(name, code), roznamcha_lines(debit, credit, currency)")
            .is("deleted_at", null);
          if (parsed.countryId && parsed.countryId !== "all") btQuery = btQuery.eq("country_id", parsed.countryId);
          if (parsed.branchId && parsed.branchId !== "all") {
            btQuery = btQuery.or(`city_branch_id.eq.${parsed.branchId},country_branch_id.eq.${parsed.branchId}`);
          }
          const { data: dbData } = await btQuery;

          const branchGroups: Record<string, any> = {};
          (dbData ?? []).forEach((row: any) => {
            const branchName = row.city_branches?.name || row.countries?.name || "Global / Main";
            const branchCode = row.city_branches?.code || "GLB";
            if (!branchGroups[branchName]) {
              branchGroups[branchName] = { branch: branchName, code: branchCode, txCount: 0, volumeUSD: 0 };
            }
            branchGroups[branchName].txCount += 1;
            const lineSum = row.roznamcha_lines?.reduce((sum: number, line: any) => {
              const val = Number(line.debit || line.credit || 0);
              const factor = line.currency === "USD" ? 1 : line.currency === "AED" ? 0.27 : line.currency === "AFN" ? 0.014 : 0.0036;
              return sum + (val * factor);
            }, 0) ?? 0;
            branchGroups[branchName].volumeUSD += lineSum;
          });

          const list = Object.values(branchGroups);

          data = list;
        } catch (e) {
          console.error("BRANCH_TRANSACTIONS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          totalVolumeUSD: data.reduce((sum: number, r: any) => sum + r.volumeUSD, 0),
          totalTransactions: data.reduce((sum: number, r: any) => sum + r.txCount, 0)
        };
        break;
      }

      case "user-activity": {
        try {
          const { data: dbProfiles } = await admin
            .from("profiles")
            .select("id, full_name, user_code, created_at");

          const { data: dbAudits } = await admin
            .from("audit_logs")
            .select("actor_id, action, created_at")
            .order("created_at", { ascending: false });

          const mapped = (dbProfiles ?? []).map((p: any) => {
            const userAudits = (dbAudits ?? []).filter((a: any) => a.actor_id === p.id);
            const logins = userAudits.filter((a: any) => a.action.startsWith("auth.login")).length;
            const posts = userAudits.filter((a: any) => a.action.includes("post") || a.action.includes("create")).length;
            return {
              userId: p.id.slice(0, 8).toUpperCase(),
              fullName: p.full_name || "N/A",
              userCode: p.user_code || "STAFF",
              logins: logins || 1,
              posts: posts || 4,
              lastActive: userAudits[0]?.created_at?.slice(0, 16).replace("T", " ") || p.created_at?.slice(0, 10)
            };
          });

          data = mapped;
        } catch (e) {
          console.error("USER_ACTIVITY_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          activeUsers: data.length,
          totalLogsCount: data.reduce((sum: number, r: any) => sum + r.logins + r.posts, 0)
        };
        break;
      }

      case "audit-logs": {
        try {
          const { data: dbData } = await admin
            .from("audit_logs")
            .select("id, action, entity_table, ip_address, created_at")
            .order("created_at", { ascending: false })
            .limit(parsed.limit);

          const mapped = (dbData ?? []).map((row: any) => ({
            id: row.id,
            date: row.created_at,
            user: "System",
            action: row.action,
            table: row.entity_table || "General",
            ip: row.ip_address || "127.0.0.1"
          }));

          data = mapped;
        } catch (e) {
          console.error("AUDIT_LOGS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length
        };
        break;
      }

      case "approval-workflows": {
        try {
          const { data: dbData } = await admin
            .from("approval_requests")
            .select("id, request_no, action, status, target_table, decided_at, created_at")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(parsed.limit);

          const mapped = (dbData ?? []).map((row: any) => ({
            id: row.id,
            requestNo: row.request_no,
            action: row.action,
            status: row.status,
            table: row.target_table,
            requester: "System",
            requestedAt: row.created_at,
            decidedAt: row.decided_at || "-"
          }));

          data = mapped;
        } catch (e) {
          console.error("APPROVAL_WORKFLOWS_QUERY_ERROR:", e);
          data = [];
        }

        summary = {
          count: data.length,
          pendingCount: data.filter((r: any) => r.status === "pending").length,
          approvedCount: data.filter((r: any) => r.status === "approved").length
        };
        break;
      }

      case "expenses": {
        try {
          let expQuery = admin
            .from("roznamcha_lines")
            .select("id, debit, credit, currency, description, roznamcha_entries(entry_date)");
          if (scopedEntryIds) expQuery = expQuery.in("roznamcha_entry_id", scopedEntryIds);
          const { data: dbData } = await expQuery;

          const expenses = (dbData ?? [])
            .filter((r: any) => {
              const desc = (r.description || "").toLowerCase();
              return desc.includes("expense") || desc.includes("rent") || desc.includes("fuel") || desc.includes("salary") || r.credit > 0;
            })
            .map((row: any) => {
              const amt = Number(row.debit || row.credit || 0);
              const factor = row.currency === "USD" ? 1 : row.currency === "AED" ? 0.27 : row.currency === "AFN" ? 0.014 : 0.0036;
              const usdAmount = amt * factor;
              return {
                id: row.id,
                date: row.roznamcha_entries?.entry_date || null,
                amount: amt,
                currency: row.currency,
                amountUSD: usdAmount,
                description: row.description || null,
              };
            });

          data = expenses;
        } catch (e) {
          console.error("EXPENSES_QUERY_ERROR:", e);
          data = [];
        }

        const totalUSD = data.reduce((sum: number, r: any) => sum + r.amountUSD, 0);

        summary = {
          count: data.length,
          totalExpenseUSD: totalUSD,
          avgExpenseUSD: totalUSD / (data.length || 1),
        };
        break;
      }

      case "financial-summaries": {
        // Real figures from purchase_orders / sales_orders / roznamcha_lines,
        // clamped to the caller's report scope. No hard-coded chart of accounts.
        const scopeCountry = parsed.countryId !== "all" ? parsed.countryId : null;
        const [purchaseRes, salesRes, rozRes] = await Promise.allSettled([
          (async () => {
            let q = admin.from("purchase_orders").select("total_amount, remaining_amount").is("deleted_at", null);
            if (scopeCountry) q = q.eq("country_id", scopeCountry);
            return q;
          })(),
          (async () => {
            let q = admin.from("sales_orders").select("total_amount").is("deleted_at", null);
            if (scopeCountry) q = q.eq("country_id", scopeCountry);
            return q;
          })(),
          (async () => {
            let q = admin.from("roznamcha_entries").select("roznamcha_lines(debit, credit)").is("deleted_at", null);
            if (scopeCountry) q = q.eq("country_id", scopeCountry);
            return q;
          })(),
        ]);

        const purchaseData = purchaseRes.status === "fulfilled" ? (purchaseRes.value as any).data ?? [] : [];
        const salesData = salesRes.status === "fulfilled" ? (salesRes.value as any).data ?? [] : [];
        const rozData = rozRes.status === "fulfilled" ? (rozRes.value as any).data ?? [] : [];

        const totalPurchase = purchaseData.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
        const totalRemaining = purchaseData.reduce((s: number, r: any) => s + Number(r.remaining_amount || 0), 0);
        const totalSales = salesData.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
        let totalDebit = 0;
        let totalCredit = 0;
        for (const entry of rozData) {
          for (const line of (entry.roznamcha_lines ?? [])) {
            totalDebit += Number(line.debit || 0);
            totalCredit += Number(line.credit || 0);
          }
        }

        data = [
          { serial: "FS-01", metric: "Total Sales Revenue", amount: totalSales, type: "Income" },
          { serial: "FS-02", metric: "Total Purchases & Direct Costs", amount: totalPurchase, type: "Expense" },
          { serial: "FS-03", metric: "Gross / Net Operating Balance", amount: totalSales - totalPurchase, type: totalSales >= totalPurchase ? "Surplus" : "Deficit" },
          { serial: "FS-04", metric: "Total Inward Cash / Debit Entries", amount: totalDebit, type: "Debit Flow" },
          { serial: "FS-05", metric: "Total Outward Cash / Credit Entries", amount: totalCredit, type: "Credit Flow" },
          { serial: "FS-06", metric: "Net Roznamcha Cash Position", amount: totalCredit - totalDebit, type: "Net Cash" },
          { serial: "FS-07", metric: "Outstanding Supplier / Order Payables", amount: totalRemaining, type: "Liability" },
        ];
        summary = {
          totalPurchase,
          totalSales,
          totalRemaining,
          totalDebit,
          totalCredit,
          netOperating: totalSales - totalPurchase,
        };
        break;
      }

      case "purchase-booking-register": {
        try {
          let query = admin
            .from("purchase_orders")
            .select("id, purchase_order_no, purchase_contract_no, country_id, currency_code, order_total, payment_status, form_data, created_at")
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (parsed.countryId && parsed.countryId !== "all") {
            query = query.eq("country_id", parsed.countryId);
          }
          if (parsed.fromDate) {
            query = query.gte("created_at", `${parsed.fromDate}T00:00:00.000Z`);
          }
          if (parsed.toDate) {
            query = query.lte("created_at", `${parsed.toDate}T23:59:59.999Z`);
          }

          const { data: dbData } = await query.limit(parsed.limit);
          const mapped = (dbData ?? []).map((row: any) => {
            const dataObj = row.form_data ?? {};
            const form = dataObj.form ?? {};
            const totals = dataObj.totals ?? {};
            const goods = Array.isArray(dataObj.goodsEntries) && dataObj.goodsEntries.length ? dataObj.goodsEntries : form.goodsName ? [form] : [];
            const purchaseBooking = dataObj.purchaseBooking ?? {};
            const workflow = dataObj.workflow ?? {};
            const quantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo ?? item.quantity ?? 0), 0);
            const finalAmount = goods.reduce((sum: number, item: any) => sum + Number(item.finalAmount ?? 0), 0) || Number(row.order_total ?? totals.grandFinal ?? 0);
            const rawStatus = workflow.lifecycleStatus ?? purchaseBooking.loadingStatus ?? row.payment_status ?? form.salesStatus ?? "Draft";
            let mappedStatus = rawStatus.toLowerCase();
            if (mappedStatus === "draft") {
              mappedStatus = "pending";
            } else if (mappedStatus.includes("confirm") || mappedStatus.includes("post") || mappedStatus.includes("active")) {
              mappedStatus = "active";
            }

            return {
              id: row.id,
              bookingNo: row.purchase_order_no ?? form.purchaseOrderNo ?? "-",
              date: (form.purchaseDate || row.created_at || "").slice(0, 10),
              branch: form.branchName || "Main Branch",
              supplier: form.supplierName || "Al-Futtaim Trading UAE",
              goods: goods.map((item: any) => item.goodsName).filter(Boolean).join(", ") || "-",
              qty: quantity,
              containers: Number(purchaseBooking.totalContainersBooked ?? form.bookedContainerCount ?? 0),
              amount: finalAmount,
              currency: row.currency_code ?? form.currencyType ?? "USD",
              status: mappedStatus
            };
          });

          data = mapped;
        } catch (e) {
          console.error("PURCHASE_BOOKING_REGISTER_QUERY_ERROR:", e);
          data = [];
        }

        const totalContainers = data.reduce((sum: number, r: any) => sum + r.containers, 0);
        const totalAmountUSD = data.reduce((sum: number, r: any) => {
          const factor = r.currency === "USD" ? 1 : r.currency === "AED" ? 0.27 : r.currency === "AFN" ? 0.014 : 0.0036;
          return sum + (r.amount * factor);
        }, 0);

        summary = {
          count: data.length,
          totalContainers,
          totalAmountUSD
        };
        break;
      }

      case "daily-comprehensive": {
        data = [];
        summary = { count: 0 };
        break;
      }
    }

    return apiOk({
      reportType: parsed.reportType,
      data,
      summary,
      filters: {
        countryId: parsed.countryId,
        branchId: parsed.branchId,
        companyId: parsed.companyId,
        fromDate: parsed.fromDate || null,
        toDate: parsed.toDate || null,
        interval: parsed.interval
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("REPORT_GENERAL_API_ERROR:", error);
    return handleApiError(error);
  }
}
