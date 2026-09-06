import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  shipmentType: z.string().optional(),
  status: z.string().optional(),
  party: z.string().optional(),
  countryId: z.string().uuid().optional().or(z.literal("all")),
  branchId: z.string().uuid().optional().or(z.literal("all")),
  salesmanId: z.string().uuid().optional().or(z.literal("all")),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

interface JourneyStep {
  name: string;
  status: "completed" | "active" | "pending";
  dateTime: string;
  operator: string;
  branch: string;
}

interface BillGoodsItem {
  name: string;
  size?: string;
  brand?: string;
  origin?: string;
  quantity: number;
  qtyName: string;
  rate: number;
  amount: number;
}

interface BillPaymentItem {
  type: "Advance" | "Remaining" | "Final";
  amount: number;
  currency: string;
  localAmount: number;
  localCurrency: string;
  date: string;
  method: string;
  status: string;
}

interface JournalBillRecord {
  id: string;
  journal_no: string;
  date: string;
  party: string;
  shipmentType: "Warehouse" | "Loading" | "Export";
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  currentStatus: string;
  nextStep: string;
  nextStepColor: "green" | "orange" | "red" | "blue" | "gray";
  // Set directly from row.created_by on real purchase_orders / local_purchases rows.
  salesmanId?: string | null;
  journey: JourneyStep[];
  goods: BillGoodsItem[];
  payments: BillPaymentItem[];
  purchaseCurrency?: string;
  paymentCurrency?: string;
  exchangeRate?: number;
  superAdminSerialNo: string;
  countrySerialNo: string;
  branchSerialNo: string;
  purchaseAccount: string;
  salesAccount: string;
  totalQuantity: number;
  qtyUnit: string;
  grossWeight: string | number;
  netWeight: string | number;
  paymentCondition: string;
  branchCode?: string;
  buyerDetails?: string;
}


export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = request.nextUrl;
    const parsed = querySchema.parse({
      shipmentType: searchParams.get("shipmentType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      party: searchParams.get("party") ?? undefined,
      countryId: searchParams.get("countryId") ?? "all",
      branchId: searchParams.get("branchId") ?? "all",
      salesmanId: searchParams.get("salesmanId") ?? "all",
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    const admin = createSupabaseAdminClient();

    // Query actual purchase orders from DB
    let query = admin
      .from("purchase_orders")
      .select(`
        id,
        purchase_order_no,
        created_at,
        order_total,
        advance_paid,
        remaining_paid,
        remaining_due,
        payment_status,
        ledger_posting_status,
        currency_code,
        form_data,
        created_by,
        countries!purchase_orders_country_id_fkey(id, name, currency_code),
        city_branches!purchase_orders_city_branch_id_fkey(id, name, code),
        super_admin_serial_number,
        country_transaction_serial_number,
        branch_transaction_serial_number,
        exchange_rate
      `)
      .is("deleted_at", null);

    const reportScope = resolveReportScope(session);
    const { effectiveCountryId, effectiveBranchId } = enforceScopeFilters(
      reportScope,
      parsed.countryId && parsed.countryId !== "all" ? parsed.countryId : null,
      parsed.branchId && parsed.branchId !== "all" ? parsed.branchId : null
    );

    if (effectiveCountryId) {
      query = query.eq("country_id", effectiveCountryId);
    }
    if (effectiveBranchId) {
      query = query.eq("city_branch_id", effectiveBranchId);
    }
    if (parsed.salesmanId && parsed.salesmanId !== "all") {
      query = query.eq("created_by", parsed.salesmanId);
    }

    const { data: dbData, error } = await query;
    if (error) throw error;

    interface GoodsEntry {
      goodsName?: string;
      [key: string]: any;
    }
    // form_data is untyped JSON persisted from many form versions; keep the known
    // fields for readability but allow any additional key so the mapping below
    // (purchaseAccountName, totalGrossWeight, goodsEntries, buyerName, …) type-checks.
    interface FormPayload {
      form?: {
        supplierName?: string;
        goodsName?: string;
        shipmentType?: string;
        lifecycleStatus?: string;
        goodsEntries?: GoodsEntry[];
        [key: string]: any;
      };
      goodsEntries?: GoodsEntry[];
      [key: string]: any;
    }

    // Map db data and filter for confirmed orders (where advance is paid, status is completed/confirmed, or ledger is posted)
    const dbRecords: JournalBillRecord[] = (dbData ?? [])
      .map(row => {
        const fd = (row.form_data as unknown as FormPayload) ?? {};
        const form = fd.form ?? {};
        const partyName = form.supplierName || "—";
        
        const rawShipment = String(form.shipmentType || "Warehouse").toLowerCase();
        const shipmentType: "Warehouse" | "Loading" | "Export" = rawShipment.includes("load") 
          ? "Loading" 
          : rawShipment.includes("ex") 
            ? "Export" 
            : "Warehouse";

        const amount = Number(row.order_total || 0);
        const paidAmount = Number(row.advance_paid || 0) + Number(row.remaining_paid || 0);
        const remainingAmount = Number(row.remaining_due || 0);

        // Determine statuses
        const isCompleted = row.payment_status === "completed";
        const currentStatus = isCompleted ? "Delivered" : shipmentType === "Export" ? "In Transit (Export)" : `In ${shipmentType}`;
        
        let nextStep = "Invoice Payment Pending";
        let nextStepColor: "green" | "orange" | "red" | "blue" | "gray" = "orange";
        if (isCompleted) {
          nextStep = "Invoice Payment Hua";
          nextStepColor = "green";
        } else if (paidAmount > 0 && remainingAmount > 0) {
          nextStep = "Remaining Payment";
          nextStepColor = "red";
        } else if (paidAmount > 0 && remainingAmount === 0) {
          nextStep = "Invoice Payment Hua";
          nextStepColor = "green";
        } else {
          nextStep = "Invoice Payment Pending";
          nextStepColor = "orange";
        }

        // Real booking timestamp only — downstream step times are not tracked yet, so
        // they are shown as "—" instead of a fabricated created_at + N minutes.
        const createdStr = String(row.created_at || "");
        const createdDate = new Date(createdStr || Date.now());
        const step1Time = createdStr
          ? createdDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
            createdDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
          : "—";
        const brName = row.city_branches?.name || "—";
        const ledgerPosted = (row as any).ledger_posting_status === "posted";

        const journey: JourneyStep[] = [
          { name: "Booking Created", status: "completed", dateTime: step1Time, operator: "—", branch: brName },
          { name: "Accepted", status: (paidAmount > 0 || ledgerPosted || isCompleted) ? "completed" : "pending", dateTime: "—", operator: "—", branch: brName },
          { name: "Transferred", status: ledgerPosted ? "completed" : "pending", dateTime: "—", operator: "—", branch: brName },
          { name: shipmentType === "Export" ? "In Transit (Export)" : `In ${shipmentType}`, status: isCompleted ? "completed" : (ledgerPosted ? "active" : "pending"), dateTime: "—", operator: "—", branch: brName },
          { name: "Customs Clearance", status: isCompleted ? "completed" : "pending", dateTime: "—", operator: "—", branch: "—" },
          { name: "Delivered / Completed", status: isCompleted ? "completed" : "pending", dateTime: isCompleted ? step1Time : "—", operator: "—", branch: "—" }
        ];

        const goodsEntries = Array.isArray(form.goodsEntries) 
          ? form.goodsEntries 
          : Array.isArray(fd.goodsEntries) 
            ? fd.goodsEntries 
            : [];
            
        const mappedGoods: BillGoodsItem[] = goodsEntries.map((g: any) => ({
          name: g.goodsName || g.productName || "—",
          size: g.size || "-",
          brand: g.brand || "-",
          origin: g.origin || "-",
          quantity: Number(g.qty || g.quantity || 0),
          qtyName: g.qtyName || g.unitName || "",
          rate: Number(g.rateOriginal || g.coursePrice || g.purchaseRate || 0),
          amount: Number(g.totalOriginal || g.finalAmount || g.totalAmount || 0)
        }));

        const baseCurrency = String((row as any).currency_code || (row.countries as any)?.currency_code || "").toUpperCase();
        const exchangeRate = Number(row.exchange_rate || form.exchangeRate || 1);
        const localCurrency = (row.countries as any)?.currency_code || "";
        
        const mappedPayments: BillPaymentItem[] = [];
        if (Number(row.advance_paid || 0) > 0) {
          mappedPayments.push({
            type: "Advance",
            amount: Number(row.advance_paid || 0) / exchangeRate,
            currency: baseCurrency,
            localAmount: Number(row.advance_paid || 0),
            localCurrency,
            date: String(row.created_at || "").slice(0, 10),
            method: form.paymentMode || "—",
            status: "—"
          });
        }
        if (Number(row.remaining_paid || 0) > 0) {
          mappedPayments.push({
            type: "Remaining",
            amount: Number(row.remaining_paid || 0) / exchangeRate,
            currency: baseCurrency,
            localAmount: Number(row.remaining_paid || 0),
            localCurrency,
            date: String((row as any).updated_at || row.created_at || "").slice(0, 10),
            method: form.paymentMode || "—",
            status: "—"
          });
        }

        const superAdminSerialNo = row.super_admin_serial_number || row.purchase_order_no || "-";
        const countrySerialNo = row.country_transaction_serial_number || "-";
        const branchSerialNo = row.branch_transaction_serial_number || "-";
        
        const purchaseAccount = form.purchaseAccountName || form.purchaseAccountNo || "-";
        const salesAccount = form.salesAccountName || form.salesAccountNo || "-";
        
        const grossWeight = form.totalGrossWeight || form.grossWeight || "-";
        const netWeight = form.totalNetWeight || form.netWeight || "-";
        const totalQuantity = form.quantity || form.totalQty || goodsEntries.reduce((sum: number, item: any) => sum + Number(item.qty || item.quantity || 0), 0) || 0;
        const qtyUnit = form.qtyName || (goodsEntries[0] && goodsEntries[0].qtyName) || "";
        const paymentCondition = form.paymentType || row.payment_status || "—";

        return {
          id: row.id,
          journal_no: row.purchase_order_no,
          date: String(row.created_at || "").slice(0, 10),
          party: partyName,
          shipmentType,
          amount,
          paidAmount,
          remainingAmount,
          currentStatus,
          nextStep,
          nextStepColor,
          salesmanId: row.created_by,
          journey,
          goods: mappedGoods,
          payments: mappedPayments,
          purchaseCurrency: baseCurrency,
          paymentCurrency: localCurrency,
          exchangeRate,
          superAdminSerialNo,
          countrySerialNo,
          branchSerialNo,
          purchaseAccount,
          salesAccount,
          totalQuantity: Number(totalQuantity),
          qtyUnit,
          grossWeight,
          netWeight,
          paymentCondition,
          branchCode: (row.city_branches as any)?.code || "—",
          buyerDetails: form.buyerName || form.buyer_name || "—"
        };
      })
      .filter(r => {
        const rawRow = dbData.find(d => d.id === r.id);
        if (!rawRow) return false;
        const isConfirmed = Number(rawRow.advance_paid || 0) > 0 ||
                            (rawRow.payment_status && rawRow.payment_status !== "pending" && rawRow.payment_status !== "draft") ||
                            (rawRow as any).ledger_posting_status === "posted" ||
                            String((rawRow.form_data as any)?.form?.lifecycleStatus || "").toLowerCase().includes("confirm");
        return isConfirmed;
      });

    // Query and map local purchase orders from DB
    let localDbRecords: JournalBillRecord[] = [];
    try {
      let localQuery = admin
        .from("local_purchases")
        .select(`
          id,
          goods_name,
          supplier_name,
          created_at,
          purchase_cost,
          advance_amount,
          remaining_balance,
          final_cost,
          status,
          journal_serial_no,
          country_serial_no,
          branch_serial_no,
          purchase_account_no,
          sales_account_no,
          brand,
          size,
          quantity_name,
          quantity_kgs,
          total_gross_weight,
          net_weight,
          purchase_rate,
          purchase_currency,
          exchange_rate,
          local_currency,
          created_by,
          countries(id, name),
          city_branches(id, name, code)
        `)
        .is("deleted_at", null);

      if (parsed.countryId && parsed.countryId !== "all") {
        localQuery = localQuery.eq("country_id", parsed.countryId);
      }
      if (parsed.branchId && parsed.branchId !== "all") {
        localQuery = localQuery.eq("city_branch_id", parsed.branchId);
      }
      if (parsed.salesmanId && parsed.salesmanId !== "all") {
        localQuery = localQuery.eq("created_by", parsed.salesmanId);
      }

      const { data: localDbData, error: localErr } = await localQuery;
      if (!localErr && localDbData) {
        localDbRecords = localDbData.map(row => {
          const partyName = row.supplier_name || "—";
          const amount = Number(row.final_cost || row.purchase_cost || 0);
          const paidAmount = Number(row.advance_amount || 0);
          const remainingAmount = Number(row.remaining_balance || 0);
          
          const isCompleted = row.status === "posted";
          const currentStatus = isCompleted ? "Delivered" : "In Warehouse";
          
          let nextStep = "Invoice Payment Pending";
          let nextStepColor: "green" | "orange" | "red" | "blue" | "gray" = "orange";
          if (isCompleted) {
            nextStep = "Invoice Payment Hua";
            nextStepColor = "green";
          } else if (paidAmount > 0 && remainingAmount > 0) {
            nextStep = "Remaining Payment";
            nextStepColor = "red";
          } else if (paidAmount > 0 && remainingAmount === 0) {
            nextStep = "Invoice Payment Hua";
            nextStepColor = "green";
          } else {
            nextStep = "Invoice Payment Pending";
            nextStepColor = "orange";
          }

          const createdStr = String(row.created_at || "");
          const createdDate = new Date(createdStr || Date.now());
          const formatTimeStr = (d: Date) => {
            return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
                   d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
          };

          const step1Time = createdStr
            ? formatTimeStr(createdDate)
            : "—";
          const brName = row.city_branches?.name || "—";
          const isTransferred = row.status === "transferred" || row.status === "posted";

          const journey: JourneyStep[] = [
            { name: "Booking Created", status: "completed", dateTime: step1Time, operator: "—", branch: brName },
            { name: "Accepted", status: (row.status === "accepted" || isTransferred || isCompleted) ? "completed" : "pending", dateTime: "—", operator: "—", branch: brName },
            { name: "Transferred", status: isTransferred ? "completed" : "pending", dateTime: "—", operator: "—", branch: brName },
            { name: "In Warehouse", status: isCompleted ? "completed" : (isTransferred ? "active" : "pending"), dateTime: "—", operator: "—", branch: brName },
            { name: "Delivered / Completed", status: isCompleted ? "completed" : "pending", dateTime: isCompleted ? step1Time : "—", operator: "—", branch: "—" }
          ];

          const mappedGoods: BillGoodsItem[] = [{
            name: row.goods_name || "—",
            size: row.size || "-",
            brand: row.brand || "-",
            origin: (row as any).origin_country_name || "—",
            quantity: Number(row.quantity_kgs || 0),
            qtyName: row.quantity_name || "",
            rate: Number(row.purchase_rate || 0),
            amount: Number(row.purchase_cost || 0)
          }];

          const baseCurrency = String(row.purchase_currency || "").toUpperCase();
          const exchangeRate = Number(row.exchange_rate || 1);
          const localCurrency = row.local_currency || "";

          const mappedPayments: BillPaymentItem[] = [];
          if (Number(row.advance_amount || 0) > 0) {
            mappedPayments.push({
              type: "Advance",
              amount: Number(row.advance_amount || 0),
              currency: baseCurrency,
              localAmount: Number(row.advance_amount || 0) * exchangeRate,
              localCurrency,
              date: String(row.created_at || "").slice(0, 10),
              method: (row as any).payment_mode || "—",
              status: "—"
            });
          }

          const superAdminSerialNo = row.journal_serial_no || `LP-JRN-${row.id.slice(0, 8).toUpperCase()}`;
          const countrySerialNo = row.country_serial_no || "-";
          const branchSerialNo = row.branch_serial_no || "-";
          
          const purchaseAccount = row.purchase_account_no || "-";
          const salesAccount = row.sales_account_no || "-";
          
          const grossWeight = row.total_gross_weight || "-";
          const netWeight = row.net_weight || "-";
          const totalQuantity = row.quantity_kgs || 0;
          const qtyUnit = row.quantity_name || "";
          const paymentCondition = (row as any).payment_mode || "—";

          return {
            id: row.id,
            journal_no: row.journal_serial_no || `LP-JRN-${row.id.slice(0, 8).toUpperCase()}`,
            date: String(row.created_at || "").slice(0, 10),
            party: partyName,
            shipmentType: "Warehouse" as const,
            amount,
            paidAmount,
            remainingAmount,
            currentStatus,
            nextStep,
            nextStepColor,
            salesmanId: row.created_by,
            journey,
            goods: mappedGoods,
            payments: mappedPayments,
            purchaseCurrency: baseCurrency,
            paymentCurrency: localCurrency,
            exchangeRate,
            superAdminSerialNo,
            countrySerialNo,
            branchSerialNo,
            purchaseAccount,
            salesAccount,
            totalQuantity: Number(totalQuantity),
            qtyUnit,
            grossWeight,
            netWeight,
            paymentCondition,
            branchCode: (row.city_branches as any)?.code || "PK",
            buyerDetails: "Daman Business Group"
          };
        }).filter(r => {
          const rawRow = localDbData.find(d => d.id === r.id);
          if (!rawRow) return false;
          return Number(rawRow.advance_amount || 0) > 0 || 
                 ["accepted", "transferred", "posted"].includes(rawRow.status || "");
        });
      }
    } catch (e) {
      console.warn("Could not load local purchases in journal report:", e);
    }

    // Real journal data only — booking-order records + local-purchase records. No mock rows.
    let finalRecords = [...dbRecords, ...localDbRecords];

    // Apply all search and filters uniformly
    finalRecords = finalRecords.filter(r => {
      if (parsed.shipmentType && parsed.shipmentType !== "all" && r.shipmentType !== parsed.shipmentType) return false;
      
      if (parsed.status && parsed.status !== "all") {
        const matchesStatus = r.currentStatus.toLowerCase() === parsed.status.toLowerCase() ||
                              r.nextStep.toLowerCase() === parsed.status.toLowerCase();
        if (!matchesStatus) return false;
      }
      
      if (parsed.party && parsed.party.trim() !== "") {
        const term = parsed.party.trim().toLowerCase();
        const matchesParty = r.party.toLowerCase().includes(term) ||
                             r.journal_no.toLowerCase().includes(term);
        if (!matchesParty) return false;
      }

      if (parsed.salesmanId && parsed.salesmanId !== "all" && r.salesmanId !== parsed.salesmanId) return false;
      if (parsed.dateFrom && r.date < parsed.dateFrom) return false;
      if (parsed.dateTo && r.date > parsed.dateTo) return false;

      return true;
    });

    // Total counts & metrics
    const summary = finalRecords.reduce(
      (acc, r) => {
        acc.totalBills += 1;
        if (r.nextStepColor === "green") acc.invoicePaymentHua += 1;
        if (r.nextStepColor === "orange" || r.nextStepColor === "red") acc.invoicePaymentPending += 1;
        return acc;
      },
      {
        totalBills: 0,
        invoicePaymentHua: 0,
        invoicePaymentPending: 0
      }
    );

    return apiOk({
      records: finalRecords,
      summary,
      filters: parsed
    });
  } catch (error) {
    console.error("JOURNAL_REPORT_API_ERROR:", error);
    return handleApiError(error);
  }
}
