"use client";

import React, { useMemo, useState } from "react";
import { RemainingBookingTable } from "./remaining-booking-table";
import { remainingBookingRow } from "@/lib/journal/remaining-booking-table";
import { resolveAgreedDueDate } from "@/lib/services/payment-due-tracking";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import { LoadingReceivingCell } from "./loading-receiving-cell";
import { purchaseInvoiceSummary } from "@/lib/journal/purchase-invoice-summary";
import { PurchaseInvoiceSection } from "./purchase-invoice-summary";
import { usePurchaseInvoiceHistory } from "./use-purchase-invoice-history";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
type LanguageCode = string;
import { FileSpreadsheet, BookOpen, Globe, Download, ChevronDown, RotateCcw, Search, Shield, WalletCards, Calendar } from "lucide-react";

export interface SourceFilteredTableProps {
  sourceFilter: "all" | "purchase_booking" | "local_purchase";
  onSourceChange: (source: "all" | "purchase_booking" | "local_purchase") => void;
  rows: any[];
  counts: { all: number; booking: number; local: number };
  lang: LanguageCode;
  onSelectOrder: (orderId: string) => void;
  onOpenFullBill: (row: any) => void;
  onPrintStatement: (row: any) => void;
  tGlobal: (lang: LanguageCode, key: string, fallback: string) => string;
  activeMode: string;
  invoiceRefresh?: number;
  invoiceFinalCurrency?: (row: any) => string;
  loadingRecords?: any[];
  dueBills?: any[];
  onSelectLoading?: (orderId: string, loadingId: string) => void;
  session?: any;
}

export function SourceFilteredTable({
  sourceFilter,
  onSourceChange,
  rows,
  counts,
  lang,
  onSelectOrder,
  onOpenFullBill,
  onPrintStatement,
  tGlobal,
  activeMode,
  loadingRecords = [],
  dueBills = [],
  onSelectLoading,
  session,
  invoiceRefresh = 0,
  invoiceFinalCurrency,
}: SourceFilteredTableProps) {
  // Format numbers helper
  const fmt = (n: any, decimals = 2) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0.00" : val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtQty = (n: any) => {
    const val = Number(n || 0);
    return isNaN(val) ? "0" : val.toLocaleString();
  };

  const isLocalPurchase = (row: any) => row.is_local_purchase || row.order_type === "local_purchase" || row.source_type === "local_purchase" || Boolean(row.local_purchase_id);
  // A loading can appear more than once in the incoming list. General shows one financial
  // summary per saved bill; the Booking tab remains the per-loading movement register.
  const uniqueRows = useMemo(() => {
    return [...new Map(rows.map(row => [`${isLocalPurchase(row) ? "local" : "booking"}:${String(row.id)}`, row])).values()];
  }, [rows]);

  const dueByOrderId = useMemo(() => new Map(dueBills.map(bill => [String(bill.id), bill])), [dueBills]);
  const generalRows = useMemo(() => {
    return uniqueRows.filter(row => {
      if (activeMode !== "remaining" || isLocalPurchase(row)) return true;
      const due = dueByOrderId.get(String(row.id));
      return Boolean(due?.loadings?.some((entry: any) => Number(entry.outstanding || 0) > 0.05));
    });
  }, [uniqueRows, activeMode, dueByOrderId]);

  const label = (value: string) => translateHeader(lang, value);
  const displayDate = (value: string | null | undefined) => value ? String(value).slice(0, 10) : "—";

  // Role-based visibility
  const isSuperAdmin = Boolean(session?.isSuperAdmin || session?.roles?.includes("super_admin"));
  const isCountryAdmin = !isSuperAdmin && Boolean(session?.roles?.some((role: string) => role === "country_admin" || role === "country_user") || session?.countryId || (session?.countryIds && session.countryIds.length > 0));
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  // Filter rows for Advance mode based on active source tab
  const advanceRowsToRender = useMemo(() => {
    if (sourceFilter === "purchase_booking") {
      return uniqueRows.filter((r) => !isLocalPurchase(r));
    }
    if (sourceFilter === "local_purchase") {
      return uniqueRows.filter((r) => isLocalPurchase(r));
    }
    return uniqueRows;
  }, [sourceFilter, uniqueRows]);

  // Frozen invoice values and each payment's own posted rate. The 23-column
  // register keeps its role-aware metadata and groups the three invoice sections.
  const invoiceLabels = useErpScreen("pis", lang);
  const invoiceIds = JSON.stringify([...new Set(uniqueRows.map(row => String(row.id)))]);
  const invoiceHistory = usePurchaseInvoiceHistory(invoiceIds, activeMode === "advance", invoiceRefresh);
  const getAdvanceInvoiceFinancials = (row: any) => {
    const history = invoiceHistory[String(row.id)];
    const summary = purchaseInvoiceSummary(row, history?.payments ?? null, invoiceFinalCurrency?.(row) ?? "", history?.complete ?? false);
    return {
      summary, purchCurr: summary.purchaseCurrency, finalCurr: summary.finalCurrency, exRate: summary.invoiceRate,
      loading: !history || history.loading,
      status: summary.remaining.purchase == null ? "—" : summary.remaining.purchase <= 0.05 ? "Fully Paid" : (summary.paid.purchase ?? 0) > 0 ? "Partially Paid" : "Pending",
    };
  };

  // Loading-based calculation logic for Remaining Payment Journal (Per Confirmed Truck/Loading)
  const allRemainingRows = useMemo(() => {
    if (activeMode !== "remaining") return [];

    const result: Array<{
      id: string;
      orderId: string;
      loadingId: string;
      source: "purchase_booking" | "local_purchase";
      orderType?: string;
      billNo: string;
      billDate?: string;
      purchaseAccount?: string;
      branch?: string;
      brand?: string;
      size?: string;
      origin?: string;
      loadingNo: string;
      truckNo: string;
      goodsName: string;
      loadedQty: number;
      unit: string;
      grossWeight: number;
      netWeight: number;
      loadCountry: string;
      loadPort: string;
      loadDate: string;
      receiveCountry: string;
      receivePort: string;
      receiveDate: string;
      purchCurr: string;
      finalCurr: string;
      exRate: number;
      loadedInvoicePC: number;
      loadedInvoiceFC: number;
      paidPC: number;
      paidFC: number;
      advancePaidPC?: number;
      advancePaidFC?: number;
      remainingPaidPC?: number;
      remainingPaidFC?: number;
      remainingPC: number;
      remainingFC: number;
      dueDate: string;
      paymentStatus: string;
    }> = [];

    const lrMap = new Map((loadingRecords || []).map((lr: any) => [String(lr.id), lr]));
    const rowMap = new Map(uniqueRows.map((r: any) => [String(r.id), r]));

    // 1. Purchase Booking loadings
    if (Array.isArray(dueBills) && dueBills.length > 0) {
      for (const bill of dueBills) {
        const po = rowMap.get(String(bill.id));
        const poForm = (po?.form_data?.form || {}) as Record<string, any>;
        const billNo = bill.billNo || po?.purchase_order_no || po?.bill_no || "—";
        const purchCurr = String(bill.currency || po?.currency_code || poForm.currency || "USD").toUpperCase();
        const finalCurr = String(bill.localCurrency || po?.dest_countries?.currency_code || poForm.branchCurrency || poForm.finalCurrency || "AED").toUpperCase();
        const exRate = Number(bill.exchangeRate || po?.exchange_rate || poForm.exchangeRate || 1) || 1;
        const rawDueDate = bill.dueDate || (po ? resolveAgreedDueDate(po) : null) || po?.due_date || "—";

        const loadings = Array.isArray(bill.loadings) ? bill.loadings : [];
        for (const l of loadings) {
          const qty = Number(l.quantity || 0);
          if (qty <= 0) continue;
          const lr = lrMap.get(String(l.id));
          const payload = (lr?.report_payload || l.reportPayload || {}) as Record<string, any>;

          const loadingNo = l.loadingNo || lr?.loading_record_no || `LD-${String(l.id).slice(0, 8)}`;
          const truckNo = lr?.vehicle_no || l.vehicleNo || payload.truckNo || payload.vehicleNo || l.container || lr?.container_number || "—";
          const goodsName = payload.goodsName || lr?.goods_name || bill.goods || po?.goods_name || "—";
          const unit = payload.qtyName || poForm.qtyName || po?.unit || "PCS";
          const grossWeight = Number(l.grossWeightKg ?? lr?.gross_weight ?? payload.grossWeight ?? 0);
          const netWeight = Number(l.netWeightKg ?? lr?.net_weight ?? payload.netWeight ?? 0);

          const loadCountry = String(
            payload.loadingCountry ||
            payload.originCountry ||
            poForm.originCountry ||
            poForm.countryName ||
            lr?.loading_country ||
            lr?.origin_country ||
            po?.country_name ||
            bill.country ||
            "—"
          ).trim() || "—";

          const loadPort = String(
            payload.loadingPort ||
            payload.originPort ||
            payload.loadingPlace ||
            payload.border ||
            lr?.loading_location ||
            l.loadingLocation ||
            lr?.origin_text ||
            l.originText ||
            poForm.loadingPort ||
            poForm.originPort ||
            poForm.loadingLocation ||
            "—"
          ).trim() || "—";

          const loadDate = String(
            l.loadedAt ? String(l.loadedAt).slice(0, 10) :
            (lr?.loaded_at ? String(lr.loaded_at).slice(0, 10) :
            (payload.loadingDate ? String(payload.loadingDate).slice(0, 10) :
            (lr?.created_at ? String(lr.created_at).slice(0, 10) : "—")))
          ).trim() || "—";

          const receiveCountry = String(
            payload.receivingCountry ||
            payload.destinationCountry ||
            poForm.destCountry ||
            poForm.destinationCountry ||
            bill.destCountry ||
            po?.dest_country_name ||
            po?.dest_countries?.name ||
            lr?.receiving_country ||
            "—"
          ).trim() || "—";

          const receivePort = String(
            payload.receivingPort ||
            payload.destPort ||
            payload.destinationPort ||
            payload.dischargePort ||
            lr?.receiving_location ||
            l.receivingLocation ||
            lr?.destination_text ||
            l.destinationText ||
            poForm.destPort ||
            poForm.destinationPort ||
            poForm.receivingLocation ||
            "—"
          ).trim() || "—";

          const rawReceiveDate =
            l.receivedAt ? String(l.receivedAt).slice(0, 10) :
            (lr?.received_at ? String(lr.received_at).slice(0, 10) :
            (lr?.actual_arrival_date ? String(lr.actual_arrival_date).slice(0, 10) :
            (payload.receivedAt ? String(payload.receivedAt).slice(0, 10) :
            (payload.actualArrivalDate ? String(payload.actualArrivalDate).slice(0, 10) :
            (payload.arrivalDate ? String(payload.arrivalDate).slice(0, 10) : null)))));

          const receiveDate = rawReceiveDate || (payload.etaDate ? `${String(payload.etaDate).slice(0, 10)} (ETA)` : "— / Pending");

          const loadedInvoicePC = Number(l.value ?? 0);
          const loadedInvoiceFC = loadedInvoicePC * exRate;
          const paidPC = Number(l.paid ?? 0);
          const paidFC = paidPC * exRate;
          const remainingPC = Math.max(0, loadedInvoicePC - paidPC);
          const remainingFC = Math.max(0, loadedInvoiceFC - paidFC);

          let paymentStatus = "Open";
          if (remainingPC <= 0.05 && remainingFC <= 0.05) {
            paymentStatus = "Fully Paid";
          } else if (paidPC > 0.05 || paidFC > 0.05) {
            paymentStatus = "Partially Paid";
          }

          const billDate = bill?.order_date || poForm.orderDate || poForm.billDate || bill?.created_at?.slice(0, 10) || "—";
          const branch = poForm.branchName || bill?.branch_name || poForm.branchCode || "—";
          const purchaseAccount = poForm.purchaseAccountName || poForm.purchaseAccountNo || bill?.purchase_account_name || bill?.purchase_account_no || bill?.supplier_name || "—";
          const brand = payload.brand || poForm.brand || poForm.brandName || "";
          const size = payload.size || poForm.size || poForm.goodsSize || "";
          const origin = loadCountry || poForm.originCountry || "—";
          const billTotalQty = Number(bill.totalQuantity || bill.quantity || po?.total_quantity || poForm.totalQuantity || 1);
          const advancePaidPC = Number(l.advanceAllocated ?? (Number(bill?.advance_paid || 0) * (qty / (billTotalQty || 1))));
          const advancePaidFC = advancePaidPC * exRate;
          const remainingPaidPC = Math.max(0, paidPC - advancePaidPC);
          const remainingPaidFC = remainingPaidPC * exRate;
          const orderType = (poForm.purchaseType as string) || "Booking";

          result.push({
            id: `pb-${l.id}`,
            orderId: String(bill.id),
            loadingId: String(l.id),
            source: "purchase_booking",
            orderType,
            billNo,
            billDate,
            purchaseAccount,
            branch,
            brand,
            size,
            origin,
            loadingNo,
            truckNo,
            goodsName,
            loadedQty: qty,
            unit,
            grossWeight,
            netWeight,
            loadCountry,
            loadPort,
            loadDate,
            receiveCountry,
            receivePort,
            receiveDate,
            purchCurr,
            finalCurr,
            exRate,
            loadedInvoicePC,
            loadedInvoiceFC,
            paidPC,
            paidFC,
            advancePaidPC,
            advancePaidFC,
            remainingPaidPC,
            remainingPaidFC,
            remainingPC,
            remainingFC,
            dueDate: displayDate(rawDueDate),
            paymentStatus,
          });
        }
      }
    } else if (Array.isArray(loadingRecords) && loadingRecords.length > 0) {
      for (const lr of loadingRecords) {
        const qty = Number(lr.loaded_quantity || 0);
        if (qty <= 0) continue;
        const po = rowMap.get(String(lr.purchase_order_id));
        const poForm = (po?.form_data?.form || {}) as Record<string, any>;
        const payload = (lr.report_payload || {}) as Record<string, any>;
        const billNo = lr.purchase_order_no || po?.purchase_order_no || "—";
        const purchCurr = String(po?.currency_code || "USD").toUpperCase();
        const finalCurr = String(po?.dest_countries?.currency_code || "AED").toUpperCase();
        const exRate = Number(po?.exchange_rate || 1) || 1;
        const rawDueDate = po ? resolveAgreedDueDate(po) : "—";

        const totalQty = Number(po?.total_quantity || 1);
        const totalAmt = Number(po?.order_total || 0);
        const unitPrice = totalQty > 0 ? totalAmt / totalQty : 0;
        const loadedInvoicePC = qty * unitPrice;
        const loadedInvoiceFC = loadedInvoicePC * exRate;
        const ratio = totalQty > 0 ? qty / totalQty : 1;
        const paidPC = (Number(po?.advance_paid || 0) + Number(po?.remaining_paid || 0)) * ratio;
        const paidFC = paidPC * exRate;
        const remainingPC = Math.max(0, loadedInvoicePC - paidPC);
        const remainingFC = Math.max(0, loadedInvoiceFC - paidFC);

        let paymentStatus = "Open";
        if (remainingPC <= 0.05 && remainingFC <= 0.05) {
          paymentStatus = "Fully Paid";
        } else if (paidPC > 0.05 || paidFC > 0.05) {
          paymentStatus = "Partially Paid";
        }

        const loadCountry = String(payload.loadingCountry || payload.originCountry || poForm.originCountry || po?.country_name || "—").trim() || "—";
        const loadPort = String(payload.loadingPort || payload.originPort || lr.loading_location || lr.origin_text || "—").trim() || "—";
        const loadDate = String(lr.loaded_at ? String(lr.loaded_at).slice(0, 10) : (lr.created_at ? String(lr.created_at).slice(0, 10) : "—")).trim() || "—";
        const receiveCountry = String(payload.receivingCountry || payload.destinationCountry || poForm.destCountry || po?.dest_country_name || "—").trim() || "—";
        const receivePort = String(payload.receivingPort || payload.destPort || lr.receiving_location || lr.destination_text || "—").trim() || "—";
        const rawReceiveDate = lr.received_at ? String(lr.received_at).slice(0, 10) : (lr.actual_arrival_date ? String(lr.actual_arrival_date).slice(0, 10) : null);
        const receiveDate = rawReceiveDate || (payload.etaDate ? `${String(payload.etaDate).slice(0, 10)} (ETA)` : "— / Pending");

        const billDate = po?.order_date || poForm.orderDate || poForm.billDate || po?.created_at?.slice(0, 10) || "—";
        const branch = poForm.branchName || po?.branch_name || poForm.branchCode || "—";
        const purchaseAccount = poForm.purchaseAccountName || poForm.purchaseAccountNo || po?.purchase_account_name || po?.purchase_account_no || po?.supplier_name || "—";
        const brand = payload.brand || poForm.brand || poForm.brandName || "";
        const size = payload.size || poForm.size || poForm.goodsSize || "";
        const origin = loadCountry || poForm.originCountry || "—";
        const advancePaidPC = Number(po?.advance_paid || 0) * ratio;
        const advancePaidFC = advancePaidPC * exRate;
        const remainingPaidPC = Number(po?.remaining_paid || 0) * ratio;
        const remainingPaidFC = remainingPaidPC * exRate;
        const orderType = (poForm.purchaseType as string) || "Booking";

        result.push({
          id: `pb-${lr.id}`,
          orderId: String(lr.purchase_order_id),
          loadingId: String(lr.id),
          source: "purchase_booking",
          orderType,
          billNo,
          billDate,
          purchaseAccount,
          branch,
          brand,
          size,
          origin,
          loadingNo: lr.loading_record_no || `LD-${String(lr.id).slice(0, 8)}`,
          truckNo: lr.vehicle_no || payload.truckNo || lr.container_number || "—",
          goodsName: payload.goodsName || lr.goods_name || po?.goods_name || "—",
          loadedQty: qty,
          unit: payload.qtyName || po?.unit || "PCS",
          grossWeight: Number(lr.gross_weight || payload.grossWeight || 0),
          netWeight: Number(lr.net_weight || payload.netWeight || 0),
          loadCountry,
          loadPort,
          loadDate,
          receiveCountry,
          receivePort,
          receiveDate,
          purchCurr,
          finalCurr,
          exRate,
          loadedInvoicePC,
          loadedInvoiceFC,
          paidPC,
          paidFC,
          advancePaidPC,
          advancePaidFC,
          remainingPaidPC,
          remainingPaidFC,
          remainingPC,
          remainingFC,
          dueDate: displayDate(rawDueDate),
          paymentStatus,
        });
      }
    }

    // 2. Local Purchase loadings
    const localPurchases = uniqueRows.filter((r: any) => isLocalPurchase(r));
    for (const lp of localPurchases) {
      const details = typeof lp.loading_details === "object" ? lp.loading_details : {};
      const entries: any[] = Array.isArray(details?.entries) ? details.entries : [];
      const billNo = lp.manual_bill_no || lp.entry_serial || lp.journal_serial_no || String(lp.id).slice(0, 8);
      const purchCurr = String(lp.currency || "AED").toUpperCase();
      const finalCurr = String(lp.currency || "AED").toUpperCase();
      const exRate = Number(lp.exchange_rate || 1) || 1;
      const totalCost = Number(lp.final_cost || lp.order_total || lp.purchase_cost || 0);
      const totalBillQty = Number(lp.numbers || 1);
      const unitPrice = totalBillQty > 0 ? totalCost / totalBillQty : 0;
      const dueDate = lp.due_date || "—";
      const loadCountry = String(lp.country_name || lp.country || "UAE").trim();
      const loadPort = String(lp.origin || lp.loading_location || lp.loading_port || "Local Yard").trim();
      const receiveCountry = String(lp.country_name || lp.country || "UAE").trim();
      const receivePort = String(lp.warehouse_name || lp.destination || lp.receiving_location || "Local Warehouse").trim();

      const billDate = lp.date ? String(lp.date).slice(0, 10) : (lp.created_at ? String(lp.created_at).slice(0, 10) : "—");
      const branch = lp.branch_name || lp.branch_code || "—";
      const purchaseAccount = lp.supplier_name || lp.account_name || lp.purchase_account || "—";

      if (entries.length > 0) {
        entries.forEach((e: any, idx: number) => {
          const qty = Number(e.loadedQuantity || 0);
          if (qty <= 0) return;
          const loadingNo = e.loadingNo || e.entryNo || `LD-${idx + 1}`;
          const truckNo = e.truckNo || e.vehicleNo || lp.truck_no || "—";
          const loadDate = String(e.loadingDate ? String(e.loadingDate).slice(0, 10) : (lp.date ? String(lp.date).slice(0, 10) : (lp.created_at ? String(lp.created_at).slice(0, 10) : "—"))).trim();
          const goodsName = e.goodsName || lp.goods_name || "—";
          const unit = e.unit || lp.quantity_name || "PCS";
          const grossWeight = Number(e.grossWeight || 0);
          const netWeight = Number(e.netWeight || 0);
          const receiveDate = lp.received_at ? String(lp.received_at).slice(0, 10) : (lp.date ? String(lp.date).slice(0, 10) : "— / Pending");

          const brand = e.brand || lp.brand || "";
          const size = e.size || lp.size || "";
          const origin = lp.origin || lp.country_name || "—";

          const loadedInvoicePC = qty * unitPrice;
          const loadedInvoiceFC = loadedInvoicePC * exRate;
          const ratio = totalBillQty > 0 ? qty / totalBillQty : 1;
          const paidPC = (Number(lp.advance_paid || 0) + Number(lp.remaining_paid || 0)) * ratio;
          const paidFC = paidPC * exRate;
          const advancePaidPC = Number(lp.advance_paid || 0) * ratio;
          const advancePaidFC = advancePaidPC * exRate;
          const remainingPaidPC = Number(lp.remaining_paid || 0) * ratio;
          const remainingPaidFC = remainingPaidPC * exRate;
          const remainingPC = Math.max(0, loadedInvoicePC - paidPC);
          const remainingFC = Math.max(0, loadedInvoiceFC - paidFC);

          let paymentStatus = "Open";
          if (remainingPC <= 0.05 && remainingFC <= 0.05) {
            paymentStatus = "Fully Paid";
          } else if (paidPC > 0.05 || paidFC > 0.05) {
            paymentStatus = "Partially Paid";
          }

          result.push({
            id: `lp-${lp.id}-${idx}`,
            orderId: String(lp.id),
            loadingId: String(e.id || `${lp.id}-${idx}`),
            source: "local_purchase",
            orderType: "Local",
            billNo,
            billDate,
            purchaseAccount,
            branch,
            brand,
            size,
            origin,
            loadingNo,
            truckNo,
            goodsName,
            loadedQty: qty,
            unit,
            grossWeight,
            netWeight,
            loadCountry,
            loadPort,
            loadDate,
            receiveCountry,
            receivePort,
            receiveDate,
            purchCurr,
            finalCurr,
            exRate,
            loadedInvoicePC,
            loadedInvoiceFC,
            paidPC,
            paidFC,
            advancePaidPC,
            advancePaidFC,
            remainingPaidPC,
            remainingPaidFC,
            remainingPC,
            remainingFC,
            dueDate: displayDate(dueDate),
            paymentStatus,
          });
        });
      } else if (Number(lp.numbers || 0) > 0) {
        const qty = Number(lp.numbers || 0);
        const loadingNo = lp.entry_serial || `LD-1`;
        const truckNo = lp.truck_no || "—";
        const loadDate = String(lp.date ? String(lp.date).slice(0, 10) : (lp.created_at ? String(lp.created_at).slice(0, 10) : "—")).trim();
        const goodsName = lp.goods_name || "—";
        const unit = lp.quantity_name || "PCS";
        const grossWeight = Number(lp.total_gross_weight || 0);
        const netWeight = Number(lp.net_weight || 0);
        const receiveDate = lp.received_at ? String(lp.received_at).slice(0, 10) : (lp.date ? String(lp.date).slice(0, 10) : "— / Pending");

        const brand = lp.brand || "";
        const size = lp.size || "";
        const origin = lp.origin || lp.country_name || "—";

        const loadedInvoicePC = totalCost;
        const loadedInvoiceFC = loadedInvoicePC * exRate;
        const paidPC = Number(lp.advance_paid || 0) + Number(lp.remaining_paid || 0);
        const paidFC = paidPC * exRate;
        const advancePaidPC = Number(lp.advance_paid || 0);
        const advancePaidFC = advancePaidPC * exRate;
        const remainingPaidPC = Number(lp.remaining_paid || 0);
        const remainingPaidFC = remainingPaidPC * exRate;
        const remainingPC = Math.max(0, loadedInvoicePC - paidPC);
        const remainingFC = Math.max(0, loadedInvoiceFC - paidFC);

        let paymentStatus = "Open";
        if (remainingPC <= 0.05 && remainingFC <= 0.05) {
          paymentStatus = "Fully Paid";
        } else if (paidPC > 0.05 || paidFC > 0.05) {
          paymentStatus = "Partially Paid";
        }

        result.push({
          id: `lp-${lp.id}`,
          orderId: String(lp.id),
          loadingId: String(lp.id),
          source: "local_purchase",
          orderType: "Local",
          billNo,
          billDate,
          purchaseAccount,
          branch,
          brand,
          size,
          origin,
          loadingNo,
          truckNo,
          goodsName,
          loadedQty: qty,
          unit,
          grossWeight,
          netWeight,
          loadCountry,
          loadPort,
          loadDate,
          receiveCountry,
          receivePort,
          receiveDate,
          purchCurr,
          finalCurr,
          exRate,
          loadedInvoicePC,
          loadedInvoiceFC,
          paidPC,
          paidFC,
          advancePaidPC,
          advancePaidFC,
          remainingPaidPC,
          remainingPaidFC,
          remainingPC,
          remainingFC,
          dueDate: displayDate(dueDate),
          paymentStatus,
        });
      }
    }

    return result;
  }, [activeMode, dueBills, loadingRecords, uniqueRows]);

  const remainingRowsToRender = useMemo(() => {
    if (activeMode !== "remaining") return [];
    if (sourceFilter === "purchase_booking") {
      return allRemainingRows.filter((r) => r.source === "purchase_booking");
    }
    if (sourceFilter === "local_purchase") {
      return allRemainingRows.filter((r) => r.source === "local_purchase");
    }
    return allRemainingRows;
  }, [activeMode, sourceFilter, allRemainingRows]);

  const activeCounts = useMemo(() => {
    if (activeMode === "remaining") {
      const booking = allRemainingRows.filter((r) => r.source === "purchase_booking").length;
      const local = allRemainingRows.filter((r) => r.source === "local_purchase").length;
      return { all: booking + local, booking, local };
    }
    return counts;
  }, [activeMode, counts, allRemainingRows]);

  const [filterCountry, setFilterCountry] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterGoods, setFilterGoods] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [remainingBranchFilter, setRemainingBranchFilter] = useState("all");
  const [exportOpen, setExportOpen] = useState(false);

  const formatDashDate = (str: string | null | undefined): string => {
    if (!str || str === "—") return "—";
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(str).slice(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[d.getMonth()];
    const yr = d.getFullYear();
    return `${day}-${mon}-${yr}`;
  };

  const advanceFilterOptions = useMemo(() => {
    const countries = new Set<string>();
    const branches = new Set<string>();
    const accounts = new Set<string>();
    const goods = new Set<string>();

    advanceRowsToRender.forEach((r: any) => {
      const form = r.form_data?.form || {};
      const c = r.country_name || form.countryName;
      if (c && c !== "—") countries.add(c);
      const b = r.branch_name || form.branchName;
      if (b && b !== "—") branches.add(b);
      const a = r.purchase_account_name || r.purchase_account_no || form.purchaseAccountName;
      if (a && a !== "—") accounts.add(a);
      const g = r.goods_name || form.goodsName;
      if (g && g !== "—") goods.add(g);
    });

    return {
      countries: Array.from(countries),
      branches: Array.from(branches),
      accounts: Array.from(accounts),
      goods: Array.from(goods),
    };
  }, [advanceRowsToRender]);

  const advanceFinalRows = useMemo(() => {
    let list = advanceRowsToRender;
    if (filterCountry !== "all") {
      list = list.filter((r: any) => {
        const c = String(r.country_name || r.form_data?.form?.countryName || "").toLowerCase();
        return c.includes(filterCountry.toLowerCase());
      });
    }
    if (filterBranch !== "all") {
      list = list.filter((r: any) => {
        const b = String(r.branch_name || r.form_data?.form?.branchName || "").toLowerCase();
        return b.includes(filterBranch.toLowerCase());
      });
    }
    if (filterAccount !== "all") {
      list = list.filter((r: any) => {
        const a = String(r.purchase_account_name || r.purchase_account_no || r.form_data?.form?.purchaseAccountName || "").toLowerCase();
        return a.includes(filterAccount.toLowerCase());
      });
    }
    if (filterGoods !== "all") {
      list = list.filter((r: any) => {
        const g = String(r.goods_name || r.product_name || r.form_data?.form?.goodsName || "").toLowerCase();
        return g.includes(filterGoods.toLowerCase());
      });
    }
    if (filterStatus !== "all") {
      list = list.filter((r: any) => {
        const fin = getAdvanceInvoiceFinancials(r);
        return fin.status.toLowerCase() === filterStatus.toLowerCase();
      });
    }
    if (filterDateFrom) {
      list = list.filter((r: any) => {
        const d = String(r.order_date || r.form_data?.form?.orderDate || "").slice(0, 10);
        return d >= filterDateFrom;
      });
    }
    if (filterDateTo) {
      list = list.filter((r: any) => {
        const d = String(r.order_date || r.form_data?.form?.orderDate || "").slice(0, 10);
        return d <= filterDateTo;
      });
    }
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      list = list.filter((r: any) => {
        const bill = String(r.purchase_order_no || r.bill_no || "").toLowerCase();
        const goods = String(r.goods_name || "").toLowerCase();
        const acc = String(r.purchase_account_name || "").toLowerCase();
        return bill.includes(q) || goods.includes(q) || acc.includes(q);
      });
    }
    return list;
  }, [advanceRowsToRender, filterCountry, filterBranch, filterAccount, filterGoods, filterStatus, filterDateFrom, filterDateTo, filterQuery]);

  const advanceTotals = useMemo(() => {
    let totalQty = 0;
    let qtyUnit = "MT";
    let totalGross = 0;
    let totalNet = 0;
    let totalPurchPC = 0;
    let totalPurchFC = 0;
    let totalAdvReqPC = 0;
    let totalAdvReqFC = 0;
    let totalAdvPaidPC = 0;
    let totalAdvPaidFC = 0;
    let totalAdvBalPC = 0;
    let totalAdvBalFC = 0;

    advanceFinalRows.forEach((r: any) => {
      const form = r.form_data?.form || {};
      const exRate = Number(r.exchange_rate || form.exchangeRate || 3.6725) || 3.6725;
      const qty = Number(r.total_quantity || form.totalQuantity || r.quantity || 0);
      if (form.quantityUnit || form.unit || r.quantity_name) {
        qtyUnit = form.quantityUnit || form.unit || r.quantity_name;
      }
      const gross = Number(r.gross_weight || form.grossWeight || 0);
      const net = Number(r.net_weight || form.netWeight || 0);

      const purchPC = Number(r.total_goods_original || r.purchase_cost || form.totalAmount || r.order_total || 0);
      const purchFC = purchPC * exRate;

      const advPct = Number(form.advancePercent || form.advancePercentage || r.advance_percent || 10) || 10;
      const advReqPC = Number(form.advanceAmount || form.advanceRequired || ((purchPC * advPct) / 100));
      const advReqFC = advReqPC * exRate;

      const advPaidPC = Number(r.advance_paid || form.advancePaid || 0);
      const advPaidFC = advPaidPC * exRate;

      const advBalPC = Math.max(0, advReqPC - advPaidPC);
      const advBalFC = advBalPC * exRate;

      totalQty += qty;
      totalGross += gross;
      totalNet += net;
      totalPurchPC += purchPC;
      totalPurchFC += purchFC;
      totalAdvReqPC += advReqPC;
      totalAdvReqFC += advReqFC;
      totalAdvPaidPC += advPaidPC;
      totalAdvPaidFC += advPaidFC;
      totalAdvBalPC += advBalPC;
      totalAdvBalFC += advBalFC;
    });

    return {
      bills: advanceFinalRows.length,
      qty: totalQty,
      unit: qtyUnit,
      gross: totalGross,
      net: totalNet,
      purchPC: totalPurchPC,
      purchFC: totalPurchFC,
      advReqPC: totalAdvReqPC,
      advReqFC: totalAdvReqFC,
      advPaidPC: totalAdvPaidPC,
      advPaidFC: totalAdvPaidFC,
      advBalPC: totalAdvBalPC,
      advBalFC: totalAdvBalFC,
    };
  }, [advanceFinalRows]);

  const remainingFinalRows = useMemo(() => {
    let list = remainingRowsToRender;
    if (remainingBranchFilter !== "all") {
      list = list.filter((r) => String(r.branch || "").toLowerCase().includes(remainingBranchFilter.toLowerCase()));
    }
    return list;
  }, [remainingRowsToRender, remainingBranchFilter]);

  const availableRemainingBranches = useMemo(() => {
    const set = new Set<string>();
    allRemainingRows.forEach((r) => { if (r.branch && r.branch !== "—") set.add(r.branch); });
    return Array.from(set);
  }, [allRemainingRows]);

  const isEmpty = activeMode === "advance"
    ? advanceFinalRows.length === 0
    : activeMode === "remaining"
      ? remainingFinalRows.length === 0
      : (sourceFilter === "all" ? generalRows.length === 0 : rows.length === 0);

  return (
    <div dir={invoiceLabels.dir} className="mx-2 sm:mx-6 mb-6 min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      {/* ── Blue Selector Bar Matching Design ── */}
      {activeMode === "advance" ? (
        <>
          <div className="bg-[#1e40af] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white shadow-xs">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <span className="text-base font-black tracking-wide">
                {label("Advance Payment Journal")}
              </span>
              <span className="text-blue-300 font-bold">|</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-100">
                <Globe className="h-3.5 w-3.5" />
                <span>Super Admin: Country &gt; Branch Wise &gt; Branch User: Branch only</span>
              </div>
            </div>

            {/* Export Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                className="inline-flex items-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{label("Export") || "Export"}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-9 z-50 min-w-[140px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs font-semibold">
                  <button
                    type="button"
                    className="w-full text-start px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    onClick={() => { setExportOpen(false); window.print(); }}
                  >
                    Print / PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Advance Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Country</label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <option value="all">{label("ALL COUNTRIES")}</option>
                {advanceFilterOptions.countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("BRANCH")}</label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <option value="all">{label("ALL BRANCHES")}</option>
                {advanceFilterOptions.branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("PURCHASE ACCOUNT")}</label>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <option value="all">{label("ALL ACCOUNTS")}</option>
                {advanceFilterOptions.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("GOODS")}</label>
              <select
                value={filterGoods}
                onChange={(e) => setFilterGoods(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <option value="all">{label("ALL GOODS")}</option>
                {advanceFilterOptions.goods.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("PAYMENT STATUS")}</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs cursor-pointer"
              >
                <option value="all">{label("ALL STATUS")}</option>
                <option value="Fully Paid">{label("FULLY PAID")}</option>
                <option value="Partially Paid">{label("PARTIALLY PAID")}</option>
                <option value="Pending">{label("PENDING")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("DATE FROM")}</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{label("DATE TO")}</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 px-2 rounded-md border border-slate-300 bg-white text-slate-800 font-semibold text-xs"
              />
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase">&nbsp;</label>
              <input
                type="text"
                placeholder={label("SEARCH BILL NO., GOODS, ACCOUNT...")}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-800 font-medium text-xs"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">&nbsp;</label>
              <button
                type="button"
                className="h-8 px-4 inline-flex items-center gap-1.5 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{label("SEARCH")}</span>
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">&nbsp;</label>
              <button
                type="button"
                onClick={() => {
                  setFilterCountry("all");
                  setFilterBranch("all");
                  setFilterAccount("all");
                  setFilterGoods("all");
                  setFilterStatus("all");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                  setFilterQuery("");
                }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{label("RESET")}</span>
              </button>
            </div>
          </div>
        </>
      ) : activeMode === "remaining" ? (
        <div className="bg-[#1e40af] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white border border-white/20">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-black tracking-wide">
              Remaining Payment Records
            </span>
            <div className="inline-flex rounded-lg bg-blue-900/60 p-1 border border-blue-400/30 ml-2">
              <button
                type="button"
                onClick={() => onSourceChange("all")}
                className={cn(
                  "px-3.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "all"
                    ? "bg-[#2563eb] text-white shadow-sm"
                    : "bg-white text-slate-800 hover:bg-slate-100"
                )}
              >
                All ({activeCounts.all})
              </button>
              <button
                type="button"
                onClick={() => onSourceChange("purchase_booking")}
                className={cn(
                  "px-3.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "purchase_booking"
                    ? "bg-[#2563eb] text-white shadow-sm"
                    : "bg-white text-slate-800 hover:bg-slate-100"
                )}
              >
                Purchase Booking ({activeCounts.booking})
              </button>
              <button
                type="button"
                onClick={() => onSourceChange("local_purchase")}
                className={cn(
                  "px-3.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "local_purchase"
                    ? "bg-[#2563eb] text-white shadow-sm"
                    : "bg-white text-slate-800 hover:bg-slate-100"
                )}
              >
                Local Purchase ({activeCounts.local})
              </button>
            </div>
          </div>

          {/* Right: Show: [All Branches v] */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-100">Show:</span>
            <select
              value={remainingBranchFilter}
              onChange={(e) => setRemainingBranchFilter(e.target.value)}
              className="bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-300 shadow-sm outline-none cursor-pointer"
            >
              <option value="all">{label("ALL BRANCHES")}</option>
              {availableRemainingBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="bg-[#1e40af] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1e40af] font-black text-sm shadow-xs">
              {sourceFilter === "all" ? "1" : sourceFilter === "purchase_booking" ? "2" : "3"}
            </span>
            <span className="text-sm font-black tracking-wide">
              {sourceFilter === "all" && "Journal / All Sources selected"}
              {sourceFilter === "purchase_booking" && "Purchase Booking selected"}
              {sourceFilter === "local_purchase" && "Local Purchase selected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-100">Source:</span>
            <div className="inline-flex rounded-lg bg-blue-900/60 p-1 border border-blue-400/30">
              <button
                type="button"
                onClick={() => onSourceChange("all")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "all"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-blue-100 hover:text-white hover:bg-blue-800/50"
                )}
              >
                All Sources ({activeCounts.all})
              </button>
              <button
                type="button"
                onClick={() => onSourceChange("purchase_booking")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "purchase_booking"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-blue-100 hover:text-white hover:bg-blue-800/50"
                )}
              >
                Purchase Booking ({activeCounts.booking})
              </button>
              <button
                type="button"
                onClick={() => onSourceChange("local_purchase")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer",
                  sourceFilter === "local_purchase"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-blue-100 hover:text-white hover:bg-blue-800/50"
                )}
              >
                Local Purchase ({activeCounts.local})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Container ── */}
      <div className="overflow-x-auto">
        {/* ========================================================================= */}
        {/* ADVANCE PAYMENT JOURNAL — EXACT 15-COLUMN STACKED FINANCIAL REPORT         */}
        {/* ========================================================================= */}
        {activeMode === "advance" ? (
          <table className="w-full min-w-[2200px] border-collapse text-start text-xs">
            <thead>
              <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("BILL NO. / DATE")}</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("PURCHASE ACCOUNT")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("BRANCH")}</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("GOODS BRAND / SIZE")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("QTY (UNIT)")}</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">{label("GROSS WT NET WT (KG)")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("ORIGIN")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("PURCHASE AMOUNT (USD) / FINAL AMOUNT (AED)")}</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">{label("ADV %")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("ADVANCE REQUIRED (USD / AED)")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("ADVANCE PAID (USD / AED)")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("ADVANCE BALANCE (USD / AED)")}</th>
                <th colSpan={2} className="py-3 px-3 text-start border-r border-amber-300 whitespace-nowrap">{label("INVOICE AMOUNT (PC)")}</th>
                <th colSpan={2} className="py-3 px-3 text-start border-r border-amber-300 whitespace-nowrap">{label("PAID AMOUNT (PC)")}</th>
                <th colSpan={2} className="py-3 px-3 text-start border-r border-amber-300 whitespace-nowrap">{label("REMAINING BALANCE (PC)")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("PAYMENT DATE")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("LOADING DATE RECEIVE DATE")}</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">{label("ACTION")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {advanceFinalRows.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-8 text-center text-xs text-slate-400 font-medium">
                    {label("NO ADVANCE BILLS FOUND")}
                  </td>
                </tr>
              ) : (
                advanceFinalRows.map((r, i) => {
                  const form = r.form_data?.form || {};
                  const billNo = r.purchase_order_no || r.bill_no || r.order_no || form.billNo || "—";
                  const billDate = formatDashDate(r.order_date || form.orderDate || form.billDate || r.created_at);
                  const branchName = r.branch_name || form.branchName || form.branchCode || "UAE";
                  const purchaseAccount = form.purchaseAccountName || form.purchaseAccountNo || r.purchase_account_name || r.purchase_account_no || r.supplier_name || "—";
                  const goodsName = r.goods_name || form.goodsName || "Walnut Kernel";
                  const brand = form.brand || form.brandName || r.brand || "DGT";
                  const size = form.size || form.goodsSize || r.size || "32/34";
                  const qty = Number(r.total_quantity || form.totalQuantity || r.quantity || 0);
                  const unit = form.quantityUnit || form.unit || r.quantity_name || "MT";
                  const grossKg = Number(r.gross_weight || form.grossWeight || 0);
                  const netKg = Number(r.net_weight || form.netWeight || 0);
                  const origin = form.originCountry || form.originCountryName || r.origin_country_name || "USA";

                  const purchCurr = String(r.currency_code || form.currencyType || "USD").toUpperCase();
                  const finalCurr = String(r.dest_countries?.currency_code || form.secondaryCurrency || "AED").toUpperCase();
                  const exRate = Number(r.exchange_rate || form.exchangeRate || 3.6725) || 3.6725;

                  const purchAmtPC = Number(r.total_goods_original || r.purchase_cost || form.totalAmount || r.order_total || 0);
                  const purchAmtFC = purchAmtPC * exRate;

                  const advPct = Number(form.advancePercent || form.advancePercentage || r.advance_percent || 10) || 10;
                  const advReqPC = Number(form.advanceAmount || form.advanceRequired || ((purchAmtPC * advPct) / 100));
                  const advReqFC = advReqPC * exRate;

                  const advPaidPC = Number(r.advance_paid || form.advancePaid || 0);
                  const advPaidFC = advPaidPC * exRate;

                  const advBalPC = Math.max(0, advReqPC - advPaidPC);
                  const advBalFC = advBalPC * exRate;

                  const fin = getAdvanceInvoiceFinancials(r);
                  const paymentDate = formatDashDate(r.advance_payment_date || (fin.summary?.payments && fin.summary.payments[0]?.date) || (advPaidPC > 0 ? billDate : null));

                  const loadDate = formatDashDate(form.loadingDate || form.expectedLoadingDate || r.loading_date);
                  const receiveDate = formatDashDate(form.receivingDate || form.expectedReceivingDate || r.receiving_date);

                  const isFullyPaid = advBalPC <= 0.05;

                  return (
                    <tr key={r.id || i} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Bill No. / Date */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-blue-700 dark:text-blue-400">{billNo}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>📅</span>
                          <span>{billDate}</span>
                        </div>
                      </td>

                      {/* 2. Purchase Account */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-[170px] truncate" title={purchaseAccount}>
                        {purchaseAccount}
                      </td>

                      {/* 3. Branch */}
                      <td className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {branchName}
                      </td>

                      {/* 4. Goods Brand / Size */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5" title={goodsName}>
                          <span>🥜</span>
                          <span className="truncate">{goodsName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={[brand && `Brand: ${brand}`, size && `Size: ${size}`].filter(Boolean).join(" | ")}>
                          {[brand && `Brand: ${brand}`, size && `Size: ${size}`].filter(Boolean).join(" | ") || "—"}
                        </div>
                      </td>

                      {/* 5. Qty (Unit) */}
                      <td className="py-2.5 px-2 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{fmtQty(qty)} {unit}</div>
                      </td>

                      {/* 6. Gross Wt Net Wt (Kg) */}
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{fmt(grossKg)}</div>
                        <div className="text-[10px] text-slate-500">{fmt(netKg)}</div>
                      </td>

                      {/* 7. Origin */}
                      <td className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {origin}
                      </td>

                      {/* 8. Purchase Amount (USD) / Final Amount (AED) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          <span className="text-[10px] text-slate-500 font-semibold mr-1">{purchCurr}</span>
                          {fmt(purchAmtPC)}
                        </div>
                        <div className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                          <span className="text-[10px] text-slate-400 font-semibold mr-1">{finalCurr}</span>
                          {fmt(purchAmtFC)}
                        </div>
                      </td>

                      {/* 9. Adv % */}
                      <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {advPct}%
                      </td>

                      {/* 10. Advance Required (USD / AED) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          <span className="text-[10px] text-slate-500 font-semibold mr-1">{purchCurr}</span>
                          {fmt(advReqPC)}
                        </div>
                        <div className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                          <span className="text-[10px] text-slate-400 font-semibold mr-1">{finalCurr}</span>
                          {fmt(advReqFC)}
                        </div>
                      </td>

                      {/* 11. Advance Paid (USD / AED) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{purchCurr}</span>
                          {fmt(advPaidPC)}
                        </div>
                        <div className="font-semibold text-emerald-600/90 dark:text-emerald-400/90 text-[11px]">
                          <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{finalCurr}</span>
                          {fmt(advPaidFC)}
                        </div>
                      </td>

                      {/* 12. Advance Balance (USD / AED) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                        <div className={cn("font-bold", isFullyPaid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          <span className="text-[10px] opacity-70 font-semibold mr-1">{purchCurr}</span>
                          {fmt(advBalPC)}
                        </div>
                        <div className={cn("font-semibold text-[11px]", isFullyPaid ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-rose-600/90 dark:text-rose-400/90")}>
                          <span className="text-[10px] opacity-70 font-semibold mr-1">{finalCurr}</span>
                          {fmt(advBalFC)}
                        </div>
                      </td>

                      {/* 12b. Invoice / Paid / Remaining summary (invoice-level, per currency) */}
                      {(["invoice", "paid", "remaining"] as const).map((section) => (
                        <td key={section} colSpan={2} className="align-top px-3 py-2.5 border-r border-slate-200 dark:border-slate-800">
                          <PurchaseInvoiceSection compact lang={lang} section={section} summary={fin.summary} loading={fin.loading} />
                        </td>
                      ))}

                      {/* 13. Payment Date */}
                      <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {paymentDate}
                      </td>

                      {/* 14. Loading Date Receive Date */}
                      <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-mono text-[10px] whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300">
                          <span>📅</span>
                          <span>{loadDate}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-slate-500 mt-0.5">
                          <span>📅</span>
                          <span>{receiveDate}</span>
                        </div>
                      </td>

                      {/* 15. Action */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isFullyPaid ? (
                          <button
                            type="button"
                            onClick={() => onOpenFullBill(r)}
                            className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            View
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer whitespace-nowrap"
                          >
                            Advance Entry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Advance Table Total Row */}
            <tfoot>
              <tr className="bg-[#ffd257] text-slate-900 font-black text-xs border-t-2 border-amber-300">
                <td className="py-2.5 px-3 border-r border-amber-300 whitespace-nowrap">
                  Total ({advanceTotals.bills} Bills)
                </td>
                <td className="py-2.5 px-3 border-r border-amber-300" />
                <td className="py-2.5 px-2.5 border-r border-amber-300" />
                <td className="py-2.5 px-3 border-r border-amber-300" />
                <td className="py-2.5 px-2 text-right border-r border-amber-300 font-mono whitespace-nowrap">
                  {fmtQty(advanceTotals.qty)} {advanceTotals.unit}
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-amber-300 font-mono whitespace-nowrap">
                  <div>{fmt(advanceTotals.gross)}</div>
                  <div className="text-[10px] text-slate-700">{fmt(advanceTotals.net)}</div>
                </td>
                <td className="py-2.5 px-2.5 border-r border-amber-300" />
                <td className="py-2.5 px-3 text-right border-r border-amber-300 font-mono whitespace-nowrap">
                  <div><span className="text-[10px] text-slate-700 font-semibold mr-1">USD</span>{fmt(advanceTotals.purchPC)}</div>
                  <div className="text-[11px] text-slate-800"><span className="text-[10px] text-slate-600 font-semibold mr-1">AED</span>{fmt(advanceTotals.purchFC)}</div>
                </td>
                <td className="py-2.5 px-2 text-center border-r border-amber-300 font-mono">
                  10%
                </td>
                <td className="py-2.5 px-3 text-right border-r border-amber-300 font-mono whitespace-nowrap">
                  <div><span className="text-[10px] text-slate-700 font-semibold mr-1">USD</span>{fmt(advanceTotals.advReqPC)}</div>
                  <div className="text-[11px] text-slate-800"><span className="text-[10px] text-slate-600 font-semibold mr-1">AED</span>{fmt(advanceTotals.advReqFC)}</div>
                </td>
                <td className="py-2.5 px-3 text-right border-r border-amber-300 font-mono whitespace-nowrap text-emerald-800">
                  <div><span className="text-[10px] font-semibold mr-1">USD</span>{fmt(advanceTotals.advPaidPC)}</div>
                  <div className="text-[11px]"><span className="text-[10px] font-semibold mr-1">AED</span>{fmt(advanceTotals.advPaidFC)}</div>
                </td>
                <td className="py-2.5 px-3 text-right border-r border-amber-300 font-mono whitespace-nowrap text-rose-700">
                  <div><span className="text-[10px] font-semibold mr-1">USD</span>{fmt(advanceTotals.advBalPC)}</div>
                  <div className="text-[11px]"><span className="text-[10px] font-semibold mr-1">AED</span>{fmt(advanceTotals.advBalFC)}</div>
                </td>
                <td className="py-2.5 px-2.5 text-center border-r border-amber-300 font-mono text-slate-700">
                  -
                </td>
                <td className="py-2.5 px-2.5 border-r border-amber-300" />
                <td className="py-2.5 px-3" />
              </tr>
            </tfoot>
          </table>
        ) : activeMode === "remaining" ? (
          /* ========================================================================= */
          /* REMAINING PAYMENT JOURNAL — EXACT COMPACT 16-COLUMN STACKED FINANCIAL REPORT */
          /* ========================================================================= */
          <table className="w-full min-w-[1900px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("BILL NO., DATE")}</th>
                <th className="py-3 px-2 border-r border-amber-300 text-center whitespace-nowrap">{label("TYPE")}</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("PURCHASE ACCOUNT")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("BRANCH")}</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">{label("GOODS BRAND / SIZE")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("QTY (CTNS)")}</th>
                <th className="py-3 px-2 text-right border-r border-amber-300 whitespace-nowrap">{label("GROSS WT / NET WT (KG)")}</th>
                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">{label("ORIGIN")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("PURCHASE AMOUNT (USD) / FINAL AMOUNT (AED)")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("ADVANCE PAID (TO) (AED)")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("REMAINING PAID (TO) (AED)")}</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">{label("BALANCE (REMAINING) (USD) / (AED)")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("LOADING DATE / RECEIVE DATE")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("DUE DATE")}</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">{label("STATUS")}</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">{label("JOURNAL")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {remainingFinalRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-8 text-center text-xs text-slate-400 font-medium">
                    {label("NO CONFIRMED LOADINGS FOUND")}
                  </td>
                </tr>
              ) : (
                remainingFinalRows.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors">
                    {/* 1. Bill No., Date */}
                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-blue-700 dark:text-blue-400">{r.billNo}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <span>📅</span>
                        <span>{displayDate(r.billDate)}</span>
                      </div>
                    </td>

                    {/* 2. Type */}
                    <td className="py-2.5 px-2 border-r border-slate-200 dark:border-slate-800 text-center whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        r.orderType === "Local" || r.source === "local_purchase"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                          : r.orderType === "Purchase"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      )}>
                        {r.orderType || (r.source === "local_purchase" ? "Local" : "Booking")}
                      </span>
                    </td>

                    {/* 3. Purchase Account */}
                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-[160px] truncate" title={r.purchaseAccount}>
                      {r.purchaseAccount}
                    </td>

                    {/* 4. Branch */}
                    <td className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {r.branch}
                    </td>

                    {/* 5. Goods Brand / Size */}
                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap max-w-[200px]">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5" title={r.goodsName}>
                        <span>🥜</span>
                        <span className="truncate">{r.goodsName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate" title={[r.brand && `Brand: ${r.brand}`, r.size && `Size: ${r.size}`].filter(Boolean).join(" | ")}>
                        {[r.brand && `Brand: ${r.brand}`, r.size && `Size: ${r.size}`].filter(Boolean).join(" | ") || "—"}
                      </div>
                    </td>

                    {/* 6. Qty (Ctns) */}
                    <td className="py-2.5 px-2 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">{fmtQty(r.loadedQty)}</div>
                      <div className="text-[10px] text-slate-500">{r.unit || "Ctns"}</div>
                    </td>

                    {/* 7. Gross Wt / Net Wt (Kg) */}
                    <td className="py-2.5 px-2 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{fmt(r.grossWeight)}</div>
                      <div className="text-[10px] text-slate-500">{fmt(r.netWeight)}</div>
                    </td>

                    {/* 8. Origin */}
                    <td className="py-2.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {r.origin}
                    </td>

                    {/* 9. Purchase Amount (USD) / Final Amount (AED) */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-blue-700 dark:text-blue-400">
                        <span className="text-[10px] text-blue-500/70 font-semibold mr-1">{r.purchCurr}</span>
                        {fmt(r.loadedInvoicePC)}
                      </div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                        <span className="text-[10px] text-slate-400 font-semibold mr-1">{r.finalCurr}</span>
                        {fmt(r.loadedInvoiceFC)}
                      </div>
                    </td>

                    {/* 10. Advance Paid (to) (AED) */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{r.purchCurr}</span>
                        {fmt(r.advancePaidPC)}
                      </div>
                      <div className="font-semibold text-emerald-600/90 dark:text-emerald-400/90 text-[11px]">
                        <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{r.finalCurr}</span>
                        {fmt(r.advancePaidFC)}
                      </div>
                    </td>

                    {/* 11. Remaining Paid (to) (AED) */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{r.purchCurr}</span>
                        {fmt(r.remainingPaidPC)}
                      </div>
                      <div className="font-semibold text-emerald-600/90 dark:text-emerald-400/90 text-[11px]">
                        <span className="text-[10px] text-emerald-500/70 font-semibold mr-1">{r.finalCurr}</span>
                        {fmt(r.remainingPaidFC)}
                      </div>
                    </td>

                    {/* 12. Balance (Remaining) (USD) / (AED) */}
                    <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                      <div className="font-bold text-rose-600 dark:text-rose-400">
                        <span className="text-[10px] text-rose-500/70 font-semibold mr-1">{r.purchCurr}</span>
                        {fmt(r.remainingPC)}
                      </div>
                      <div className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                        <span className="text-[10px] text-rose-500/70 font-semibold mr-1">{r.finalCurr}</span>
                        {fmt(r.remainingFC)}
                      </div>
                    </td>

                    {/* 13. Loading Date / Receive Date */}
                    <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-mono text-[10px] whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300">
                        <span>📅</span>
                        <span>{r.loadDate ? displayDate(r.loadDate) : "—"}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-slate-500 mt-0.5">
                        <span>📅</span>
                        <span>{r.receiveDate ? displayDate(r.receiveDate) : "—"}</span>
                      </div>
                    </td>

                    {/* 14. Due Date */}
                    <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.dueDate}
                    </td>

                    {/* 15. Status */}
                    <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        r.paymentStatus === "Fully Paid"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : r.paymentStatus === "Partially Paid"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      )}>
                        {label(r.paymentStatus.toUpperCase())}
                      </span>
                    </td>

                    {/* 16. Journal */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (r.source === "purchase_booking" && onSelectLoading) {
                            onSelectLoading(r.orderId, r.loadingId);
                          } else {
                            onSelectOrder(r.orderId);
                          }
                        }}
                        className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                      >
                        {label("JOURNAL")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* ========================================================================= */
          /* OTHER PAYMENT MODES (REMAINING, CREDIT, ETC.)                              */
          /* ========================================================================= */
          <>
            {/* VIEW 1: ALL SOURCES (JOURNAL) */}
            {sourceFilter === "all" && (
              <table className="w-full min-w-[1350px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">{label("BILL NO.")}</th>
                    <th className="py-3 px-2 border-r border-amber-300 text-center">{label("SOURCE")}</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">{label("DATE")}</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">{label("COUNTRY / BRANCH")}</th>
                    <th className="py-3 px-3 border-r border-amber-300">{label("SUPPLIER / PURCHASE ACCOUNT")}</th>
                    <th className="py-3 px-3 border-r border-amber-300">{label("GOODS / BRAND / SIZE")}</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">{label("QTY")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">{label("UNIT")}</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">{label("GROSS KG")}</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">{label("NET KG")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">{label("CURRENCY")}</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">{label("BILL TOTAL")}</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">{label("PAID")}</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">{label("BALANCE")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300 font-mono">{label("DR ACCOUNT")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300 font-mono">{label("CR ACCOUNT")}</th>
                    <th className="py-3 px-2.5 text-center border-r border-amber-300">{activeMode === "remaining" ? label("REMAINING DUE DATE") : label("DUE DATE")} / {label("STATUS")}</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">{label("EXCHANGE RATE")}</th>
                    <th className="py-3 px-3 text-center">{label("JOURNAL")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {generalRows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const isLocal = isLocalPurchase(r);
                    const booking = !isLocal && activeMode === "remaining" ? remainingBookingRow(r, loadingRecords, dueByOrderId.get(String(r.id))) : null;
                    const sourceLabel = isLocal ? "Local" : "Booking";
                    const date = booking?.date || r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = booking?.supplier || r.supplier_name || form.supplierName || "—";
                    const goods = booking?.goods || r.goods_name || form.goodsName || "—";
                    const qty = booking ? booking.quantity : (r.total_quantity ?? form.totalQuantity ?? 0);
                    const unit = booking?.unit || form.quantityUnit || "—";
                    const grossKg = booking ? booking.grossKg : (r.gross_weight ?? form.grossWeight ?? 0);
                    const netKg = booking ? booking.netKg : (r.net_weight ?? form.netWeight ?? 0);
                    const ccy = booking?.currency || r.currency_code || form.currency || "—";
                    const total = booking ? booking.total : Number(r.order_total ?? form.totalAmount ?? 0);
                    const paid = booking ? booking.paid : Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = booking ? booking.balance : Math.max(0, Number(r.remaining_due ?? (total - paid)));
                    const dr = form.purchaseAccountNo || r.purchase_account_no || "—";
                    const cr = form.salesAccountNo || form.supplierAccountNo || r.sales_account_no || "—";
                    const dueDate = resolveAgreedDueDate(r, activeMode === "remaining" ? "remaining" : undefined);
                    const status = bal <= 0.05 ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Open";
                    const exRate = Number(booking?.exchangeRate ?? r.exchange_rate ?? form.exchangeRate ?? 1).toFixed(4);

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", isLocal ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800")}>
                            {sourceLabel}
                          </span>
                        </td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{grossKg == null ? "—" : fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{netKg == null ? "—" : fmtQty(netKg)}</td>
                        <td className="py-3 px-2 text-center font-bold text-indigo-600">{ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-black">{fmt(total)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-emerald-600">{fmt(paid)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-rose-600">{fmt(bal)}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500">{dr}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500">{cr}</td>
                        <td className="py-3 px-2.5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-[11px] text-slate-600">{displayDate(dueDate)}</span>
                            <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-bold", bal <= 0 ? "bg-emerald-100 text-emerald-700" : paid > 0 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700")}>
                              {status}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono">{exRate}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* VIEW 2: PURCHASE BOOKING */}
            {sourceFilter === "purchase_booking" && activeMode === "remaining" && (
              <RemainingBookingTable rows={rows} loadingRecords={loadingRecords} dueBills={dueBills} lang={lang} onSelectOrder={onSelectOrder} onSelectLoading={onSelectLoading} />
            )}
            {sourceFilter === "purchase_booking" && activeMode !== "remaining" && (
              <table className="w-full min-w-[1700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">Bill No</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Date</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Country / Branch</th>
                    <th className="py-3 px-3 border-r border-amber-300">Supplier</th>
                    <th className="py-3 px-3 border-r border-amber-300">Goods Name</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Qty</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Unit</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Gross kg</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Net kg</th>
                    <th className="py-3 px-4 border-r border-amber-300 bg-amber-200/90 text-center min-w-[340px]">
                      {label("Loading & Receiving")}
                    </th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Currency</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Exchange Rate</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Bill Total</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Paid</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Balance</th>
                    <th className="py-3 px-3 text-center">Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {rows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const date = r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = r.supplier_name || form.supplierName || "—";
                    const goods = r.goods_name || form.goodsName || "—";
                    const qty = r.total_quantity || form.totalQuantity || 0;
                    const unit = form.quantityUnit || "Cartons";
                    const grossKg = r.gross_weight || form.grossWeight || 0;
                    const netKg = r.net_weight || form.netWeight || 0;
                    const ccy = r.currency_code || form.currency || "USD";
                    const total = Number(r.order_total || form.totalAmount || 0);
                    const paid = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = Math.max(0, total - paid);
                    const exRate = Number(form.exchangeRate || 1).toFixed(4);

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(netKg)}</td>
                        <td className="py-2.5 px-3 bg-slate-50/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 align-top">
                          <LoadingReceivingCell row={r} loadingRecords={loadingRecords} lang={lang} />
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-indigo-600">{ccy}</td>
                        <td className="py-3 px-2 text-center font-mono">{exRate}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-black">{fmt(total)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-emerald-600">{fmt(paid)}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-rose-600">{fmt(bal)}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* VIEW 3: LOCAL PURCHASE */}
            {sourceFilter === "local_purchase" && (
              <table className="w-full min-w-[1300px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300">
                    <th className="py-3 px-3 border-r border-amber-300">Bill No</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Date</th>
                    <th className="py-3 px-2.5 border-r border-amber-300">Country / Branch</th>
                    <th className="py-3 px-3 border-r border-amber-300">Supplier</th>
                    <th className="py-3 px-3 border-r border-amber-300">Goods Name</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Qty</th>
                    <th className="py-3 px-2 text-center border-r border-amber-300">Unit</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Gross kg</th>
                    <th className="py-3 px-2 text-right border-r border-amber-300">Net kg</th>
                    <th className="py-3 px-4 border-r border-amber-300 bg-amber-200/90 text-center min-w-[340px]">{label("Loading & Receiving")}</th>
                    <th className="py-3 px-3 text-right border-r border-amber-300">Bill Total</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Paid</th>
                    <th className="py-3 px-2.5 text-right border-r border-amber-300">Balance</th>
                    <th className="py-3 px-3 text-center">Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {rows.map((r, i) => {
                    const form = r.form_data?.form || {};
                    const billNo = r.purchase_order_no || r.bill_no || r.order_no || "—";
                    const date = r.order_date || form.orderDate || r.created_at?.slice(0, 10) || "—";
                    const countryBranch = [form.countryCode || r.country_code || r.country_name, form.branchCode || r.branch_code || r.branch_name].filter(Boolean).join(" / ") || "—";
                    const supplier = r.supplier_name || form.supplierName || "—";
                    const goods = r.goods_name || form.goodsName || "—";
                    const qty = r.total_quantity || form.totalQuantity || 0;
                    const unit = form.quantityUnit || "Cartons";
                    const grossKg = r.gross_weight || form.grossWeight || 0;
                    const netKg = r.net_weight || form.netWeight || 0;
                    const total = Number(r.order_total || form.totalAmount || 0);
                    const paid = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
                    const bal = Math.max(0, Number(r.remaining_due ?? (total - paid)));
                    const ccy = r.currency_code || form.currency || "—";

                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</td>
                        <td className="py-3 px-2.5 font-mono">{date}</td>
                        <td className="py-3 px-2.5 font-mono text-slate-600 dark:text-slate-400">{countryBranch}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{supplier}</td>
                        <td className="py-3 px-3 font-semibold">{goods}</td>
                        <td className="py-3 px-2 text-right font-mono font-bold">{fmtQty(qty)}</td>
                        <td className="py-3 px-2 text-center text-slate-500">{unit}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(grossKg)}</td>
                        <td className="py-3 px-2 text-right font-mono">{fmtQty(netKg)}</td>
                        <td className="py-2.5 px-3 bg-slate-50/70 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 align-top">
                          <LoadingReceivingCell row={r} loadingRecords={loadingRecords} lang={lang} />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black">{fmt(total)} {ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-600">{fmt(paid)} {ccy}</td>
                        <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-600">{fmt(bal)} {ccy}</td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectOrder(r.id)}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs shadow-sm transition cursor-pointer"
                          >
                            Journal
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Empty State */}
        {isEmpty && (
          <div className="py-16 text-center text-slate-400">
            <FileSpreadsheet className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-semibold">No records found for this view.</p>
          </div>
        )}
      </div>

      {/* ── Footer Guidance Strip Matching Screenshot ── */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11.5px] font-medium text-slate-500 flex items-center justify-between">
        <div>
          <span className="font-bold text-blue-600">ⓘ Journal button</span> opens the selected bill details and Print on demand. | Alternative tab states — app shows one selected table at a time.
        </div>
      </div>
    </div>
  );
}
