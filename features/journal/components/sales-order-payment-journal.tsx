"use client";
 
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { printStore } from "@/lib/store/print-store";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Coins,
  CornerDownRight,
  DollarSign,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Fingerprint,
  Globe,
  Home,
  Info,
  Landmark,
  Lock,
  Minus,
  MoreVertical,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Scale,
  Search,
  Shield,
  Ship,
  ShoppingCart,
  Truck,
  User,
  Users,
  Wallet,
  WalletCards,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { OpenFullBillModal } from "@/components/invoices/open-full-bill-modal";
import { GoodsPopoverCell } from "@/components/ui/goods-popover-cell";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { openPurchaseA4ReportWindow, type PurchaseReportData } from "@/lib/reports/open-purchase-a4-report-window";
import { PaymentEditModal } from "./payment-edit-modal";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { getBankById } from "@/features/banks/bank-api";

import type { GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
import { Th } from "@/components/ui/translated-th";
import { t, tData, type LanguageCode } from "@/features/i18n/purchase-journal-translations";
import { t as tGlobal } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { rtlLanguages } from "@/lib/i18n/languages";
import { CurrencyTotalsGrid } from "@/components/payment-report/currency-totals-grid";
function isUuid(value: any): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

type PaymentMode = "advance" | "advance_completed" | "remaining" | "credit" | "charges" | "history";

type PurchaseOrderRow = {
  id: string;
  sales_order_no: string;
  sales_contract_no: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  currency_code: string | null;
  payment_currency?: string | null;
  currency?: string | null;
  exchange_rate: number | null;
  order_total: number | null;
  // Real sales_orders columns: running totals across every payment kind combined.
  paid_amount?: number | null;
  remaining_amount?: number | null;
  // The four fields below are NOT real sales_orders columns (they only exist on
  // purchase_orders) â kept here only because older code in this file still reads them via
  // fallback chains; every live call site now reads paid_amount/remaining_amount instead.
  advance_paid: number | null;
  remaining_paid: number | null;
  credit_amount: number | null;
  remaining_due: number | null;
  super_admin_serial_number?: string | null;
  country_transaction_serial_number?: string | null;
  branch_transaction_serial_number?: string | null;
  superAdminSerialNo?: string | null;
  countrySerialNo?: string | null;
  branchSerialNo?: string | null;
  branchName?: string | null;
  countryName?: string | null;
  sales_account_no?: string | null;
  sales_account_name?: string | null;
  purchase_account_no?: string | null;
  purchase_account_name?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  createdByName?: string | null;
  audit?: { branchCode?: string | null; userName?: string | null; userId?: string | null } | null;
  payment_status: string | null;
  ledger_posting_status: string | null;
  created_at: string | null;
  form_data?: any;
};

function handlePrintReceipt(payment: any, orderRow: any, ledgers: any[], localCurrency: string, autoPrint = true, lang: LanguageCode = "en") {
  const drLedger = ledgers.find((l) => (l.id || l.account_id) === payment.debit_ledger_id);
  const crLedger = ledgers.find((l) => (l.id || l.account_id) === payment.credit_ledger_id);
  const drLabel = drLedger ? (drLedger.account_name || drLedger.name) : "-";
  const crLabel = crLedger ? (crLedger.account_name || crLedger.name) : "-";
  const re = payment.roznamcha_entries || {};
  const form = orderRow?.form_data?.form || {};
  const th = (label: string) => translateHeader(lang, label);
  const isRtl = rtlLanguages.includes(lang);

  const companyName = form.salesCompanyName || form.companyName || form.salesAccountName || orderRow?.company_name || "";
  const receiptTitle = th("Payment Receipt");
  const receiptNo = payment.reference_no || re.super_admin_serial_number || "N/A";
  const printDate = new Date().toLocaleString();
  const paymentDate = new Date(payment.entry_date || payment.created_at).toLocaleDateString();
  const purchaseDate = form.orderDate ? new Date(form.orderDate).toLocaleDateString() : "N/A";
  const poNo = orderRow?.sales_order_no || "N/A";
  const contractNo = orderRow?.sales_contract_no || "N/A";
  const vendorName = form.vendorName || "N/A";
  
  const paymentAmt = Number(payment.amount || 0);
  const paymentExRate = Number(payment.exchange_rate || 1);
  const currency = payment.currency_code || localCurrency.toUpperCase();
  
  const prevPaid = Number(payment.previous_balance_paid || 0);
  const totalPaid = prevPaid + paymentAmt;
  
  const goodsTotal = orderRow?.form_data?.goodsEntries?.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0) || Number(form.subTotal || 0);
  const freight = Number(form.freightCharges || 0);
  const discount = Number(form.discount || 0);
  
  const grandTotalFC = Number(orderRow?.order_total || form.totalAmount || 0);
  const poExRate = Number(orderRow?.exchange_rate || 1);
  const outstanding = Math.max(0, grandTotalFC - totalPaid);
  
  let displayNarration = payment.narration || "-";

  const rtlFont = lang === "ur" ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" : lang === "ar" || lang === "ps" ? "'Cairo', 'Noto Naskh Arabic', sans-serif" : lang === "fa" ? "'Vazirmatn', sans-serif" : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  const html = `
    <!DOCTYPE html>
    <html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8">
      <title>${receiptTitle} - ${receiptNo}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: ${rtlFont}; font-size: 11px; color: #1e293b; margin: 0; padding: 0; }
        .container { width: 100%; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
        .header-left h1 { margin: 0; font-size: 26px; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase; font-weight: 900; }
        .header-left p { margin: 4px 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }
        .header-right { text-align: right; }
        .header-right h2 { margin: 0; font-size: 20px; color: #334155; font-weight: 800; }
        .header-right p { margin: 4px 0 0; font-size: 11px; font-weight: bold; color: #1e293b; }
        .section-title { background: #f1f5f9; padding: 6px 10px; font-weight: 800; font-size: 11px; border: 1px solid #cbd5e1; border-left: 4px solid #1e3a8a; margin: 20px 0 10px; text-transform: uppercase; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 11px; }
        th { background: #f8fafc; font-weight: 700; color: #475569; width: 25%; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .summary-box { display: flex; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-top: 15px; }
        .summary-item { flex: 1; padding: 12px; text-align: center; background: #f8fafc; border-right: 1px solid #cbd5e1; }
        .summary-item:last-child { border-right: none; }
        .summary-item .lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .summary-item .val { font-size: 16px; font-weight: 900; margin-top: 5px; color: #0f172a; }
        .summary-item.highlight { background: #eff6ff; }
        .summary-item.highlight .lbl { color: #1d4ed8; }
        .summary-item.highlight .val { color: #1e40af; }
        .footer { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { width: 22%; text-align: center; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 5px; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 50px; }
        .stamp-box { width: 90px; height: 90px; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-weight: 900; margin: 0 auto; border-radius: 50%; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .sys-gen { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 30px; font-style: italic; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
        .qr-placeholder { width: 60px; height: 60px; background: #f1f5f9; border: 1px solid #cbd5e1; float: right; margin-left: 15px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; text-align: center; font-weight: bold; }
        ${isRtl ? `
        body { direction: rtl; }
        th, td { text-align: right; }
        .text-right { text-align: left; }
        .header-right { text-align: left; }
        .qr-placeholder { float: left; margin-left: 0; margin-right: 15px; }
        .section-title { border-left: none; border-right: 4px solid #1e3a8a; }
        ` : ""}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-left">
            ${companyName ? `<h1>${companyName}</h1>` : ""}
            <p>${th("Purchase Payment Receipt")}</p>
          </div>
          <div class="header-right">
            <h2>${th("Payment Receipt")}</h2>
            <p>${tGlobal(lang, "common.no_abbr", "No")}: ${receiptNo}</p>
            <p style="font-weight: normal; color: #64748b; font-size: 10px;">${tGlobal(lang, "common.printed", "Printed")}: ${printDate}</p>
          </div>
        </div>

        <div class="section-title">${th("Purchase & Vendor Details")}</div>
        <table>
          <tr>
            <th>${th("Sales Order No")}</th><td><strong>${poNo}</strong></td>
            <th>${th("Contract / GRN No")}</th><td>${contractNo}</td>
          </tr>
          <tr>
            <th>${th("Supplier Name")}</th><td colspan="3"><strong>${vendorName}</strong></td>
          </tr>
          <tr>
            <th>${th("Purchase Date")}</th><td>${purchaseDate}</td>
            <th>${th("Currency")}</th><td><strong>${currency}</strong></td>
          </tr>
        </table>

        <div class="section-title">${th("Purchase Financial Summary")}</div>
        <table>
          <tr>
            <th>${th("Goods Total Amount")}</th><td class="text-right">${Number(goodsTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <th>${th("Discount")}</th><td class="text-right">${Number(discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <th>${th("Freight Charges")}</th><td class="text-right">${Number(freight).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <th>${th("Grand Total")} (${currency})</th><td class="text-right font-bold">${Number(grandTotalFC).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <div class="section-title">${th("Accounting & Audit Trail")}</div>
        <table>
          <tr>
            <th>${th("Debit Ledger (Dr)")}</th><td colspan="3">${drLabel}</td>
          </tr>
          <tr>
            <th>${th("Credit Ledger (Cr)")}</th><td colspan="3">${crLabel}</td>
          </tr>
          <tr>
            <th>${th("Payment Date")}</th><td>${paymentDate}</td>
            <th>${th("Posted By")}</th><td>${re.profiles?.full_name ? re.profiles.full_name.toUpperCase() : "â"}</td>
          </tr>
          <tr>
            <th>${th("Reference No")}</th><td>${payment.reference_no || "-"}</td>
            <th>${th("Journal Serial")}</th><td>${re.super_admin_serial_number || "-"}</td>
          </tr>
          <tr>
            <th>${th("Remarks")}</th><td colspan="3">${displayNarration || "-"}</td>
          </tr>
        </table>

        <div class="section-title">${th("Payment Summary")}</div>
        <div class="summary-box">
          <div class="summary-item">
            <div class="lbl">${th("Previously Paid")}</div>
            <div class="val">${Number(prevPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item highlight">
            <div class="lbl">${th("Current Payment")}</div>
            <div class="val">${Number(paymentAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl">${th("Total Paid to Date")}</div>
            <div class="val">${Number(totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl" style="color: #be123c;">${th("Running Purchase Balance")}</div>
            <div class="val" style="color: #be123c;">${Number(outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="footer">
          <div class="sig-block">
            <div class="sig-line">${th("Prepared By")}</div>
          </div>
          <div class="sig-block" style="width: auto;">
            <div class="stamp-box">${th("Company")}<br/>${th("Stamp")}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">${th("Authorized Signatory")}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">${th("Receiver Signature")}</div>
          </div>
        </div>

        <div class="sys-gen">
          <div class="qr-placeholder">${th("Verify")}<br/>QR</div>
          *** ${tGlobal(lang, "common.system_generated_document", "THIS IS A SYSTEM GENERATED DOCUMENT")} ***<br/>
          UUID: ${payment.id || "N/A"} | ${tGlobal(lang, "common.exchange_rate_applied", "Exchange Rate Applied")}: ${paymentExRate.toFixed(4)}
        </div>
      </div>
      <script>
        window.onload = function() { 
          if (${autoPrint}) { window.print(); window.close(); }
        }
      </script>
    </body>
    </html>
  `;
  printStore.openPrint(html, receiptTitle + " " + receiptNo);
}

type OrdersPayload = {
  orders?: PurchaseOrderRow[];
  limit?: number;
};

type KpiCard = {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "red" | "slate";
};

const modeLabels: Record<PaymentMode, string> = {
  advance: "Advance Payment",
  remaining: "Remaining Payment",
  credit: "Credit Payment",
  charges: "Credit Payment",
  history: "Payment History",
  advance_completed: "Advance Completed"
};

function money(value: unknown, currency = "") {
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

function numeric(value: unknown) {
  return Number(value || 0);
}

const COUNTRY_CURRENCY: Record<string, string> = {
  "united arab emirates": "AED",
  "uae": "AED",
  "pakistan": "PKR",
  "afghanistan": "AFN",
  "india": "INR",
  "iran": "IRR"
};

const COUNTRY_BANKS: Record<string, string[]> = {
  "united arab emirates": [
    "Emirates NBD",
    "Dubai Islamic Bank (DIB)",
    "Abu Dhabi Commercial Bank (ADCB)",
    "First Abu Dhabi Bank (FAB)",
    "Mashreq Bank",
    "Commercial Bank of Dubai (CBD)",
    "RAKBANK",
    "Ajman Bank",
    "Sharjah Islamic Bank",
    "MCB UAE Branch",
    "Habib Bank AG Zurich"
  ],
  "pakistan": [
    "HBL",
    "MCB",
    "UBL",
    "Meezan",
    "Bank Alfalah",
    "Allied Bank",
    "Bank AL Habib",
    "Faysal Bank",
    "Askari Bank",
    "National Bank of Pakistan"
  ],
  "afghanistan": [
    "Da Afghanistan Bank",
    "Afghanistan International Bank (AIB)",
    "Azizi Bank",
    "New Kabul Bank",
    "Pashtany Bank",
    "Ghazanfar Bank",
    "First MicroFinanceBank"
  ],
  "india": [
    "State Bank of India (SBI)",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Punjab National Bank",
    "Kotak Mahindra Bank"
  ]
};

function getCountryBankList(countryName: string): string[] {
  const c = String(countryName || "").toLowerCase().trim();
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai") || c.includes("abu dhabi") || c.includes("sharjah")) {
    return COUNTRY_BANKS["united arab emirates"];
  }
  if (c.includes("pakistan") || c.includes("quetta") || c.includes("karachi") || c.includes("chaman") || c.includes("lahore") || c.includes("islamabad")) {
    return COUNTRY_BANKS["pakistan"];
  }
  if (c.includes("afghanistan") || c.includes("kabul")) {
    return COUNTRY_BANKS["afghanistan"];
  }
  if (c.includes("india") || c.includes("mumbai") || c.includes("delhi")) {
    return COUNTRY_BANKS["india"];
  }
  return COUNTRY_BANKS["united arab emirates"];
}


function normalizeCurrency(value: unknown, fallback = "USD") {
  const raw = String(value || "").trim().toUpperCase();
  return raw || fallback;
}

function rowForm(row: PurchaseOrderRow) {
  return row.form_data?.form || {};
}

function rowCountryName(row: PurchaseOrderRow) {
  const form = rowForm(row);
  const rawCountry = String(row.countryName || form.branchCountry || form.countryName || form.loadingCountry || form.destinationCountry || form.originCountry || "Unknown Country").trim();
  const c = rawCountry.toUpperCase();
  if (c.includes("PAKISTAN") || c === "QUETTA" || c === "CHAMAN" || c === "KARACHI" || c === "ISLAMABAD" || c === "PESHAWAR" || c === "MULTAN" || c === "LAHORE") {
    return "Pakistan";
  }
  if (c.includes("UAE") || c.includes("EMIRATES") || c === "DUBAI" || c === "ABU DHABI" || c === "SHARJAH") {
    return "United Arab Emirates";
  }
  return rawCountry;
}

function rowBranchName(row: PurchaseOrderRow) {
  const form = rowForm(row);
  return String(form.branchName || form.purchaseAccountBranch || form.salesAccountBranch || "Unassigned Branch");
}

function rowCurrency(row: PurchaseOrderRow) {
  const form = rowForm(row);
  const explicit = normalizeCurrency(
    form.currencyType || 
    form.purchaseCurrency || 
    (row as any).currency || 
    form.currency || 
    row.currency_code || 
    form.baseCurrency || 
    form.purchaseAccountCurrency, 
    ""
  );
  if (explicit) return explicit;
  const country = rowCountryName(row).toLowerCase();
  return COUNTRY_CURRENCY[country] || "USD";
}

function rowOfficeCurrency(row: PurchaseOrderRow): string {
  const country = rowCountryName(row).toUpperCase();
  if (country.includes("PAKISTAN")) return "PKR";
  if (country.includes("EMIRATES") || country.includes("UAE") || country.includes("DUBAI")) return "AED";
  if (country.includes("CHINA")) return "CNY";
  if (country.includes("INDIA")) return "INR";
  if (country.includes("AFGHANISTAN")) return "AFN";
  return "USD";
}

function getUsdExchangeRate(cur: string, row: any, liveRates: any[] = []) {
  if (cur === "USD") return 1.0;
  const match = liveRates.find((r) => r.currency_code === cur);
  if (match && Number(match.exchange_rate || 0) > 0) return Number(match.exchange_rate);

  // No live rate: fall back only to the transaction's own frozen exchange rate.
  const form = row?.form_data?.form || {};
  const rowRate = row?.exchange_rate || form.exchangeRate || 1;
  if (rowRate > 1) {
    return 1 / rowRate;
  }
  return 1.0;
}

function getConversionRate(row: any, bookCur: string, officeCur: string, liveRates: any[] = []) {
  const bCur = bookCur.toUpperCase();
  const oCur = officeCur.toUpperCase();
  if (bCur === oCur) return 1.0;
  
  const form = row?.form_data?.form || {};
  const rowRate = Number(row?.exchange_rate || form.exchangeRate || 0);
  
  if (rowRate > 0) {
    if (bCur === "USD" && oCur === "PKR") return rowRate;
    if (bCur === "USD" && oCur === "AED") return rowRate;
    if (bCur === "PKR" && oCur === "AED") return 1 / rowRate;
    if (bCur === "AED" && oCur === "PKR") return rowRate;
  }
  
  const usdRateForBook = getUsdExchangeRate(bCur, row, liveRates);
  const usdRateForOffice = getUsdExchangeRate(oCur, row, liveRates);
  
  if (usdRateForOffice > 0) {
    return usdRateForBook / usdRateForOffice;
  }
  return 1.0;
}

function orderTotal(row: PurchaseOrderRow) {
  const form = rowForm(row);
  const goods = row.form_data?.goodsEntries || [];
  const totals = row.form_data?.totals || {};
  if (Number(row.order_total || 0) > 0) return Number(row.order_total || 0);
  if (Number(totals.grandFinal || 0) > 0) return Number(totals.grandFinal || 0);
  if (Array.isArray(goods) && goods.length) return goods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || g.localAmount || g.totalAmount || 0), 0);
  return Number(form.totalAmount || form.grandFinal || 0);
}

function requiredAdvanceAmount(row: PurchaseOrderRow) {
  const form = rowForm(row);
  const pct = Number(form.advancePercent || 0);
  return pct > 0 ? (orderTotal(row) * pct) / 100 : Number(row.paid_amount || 0);
}

function resolvePurchaseCalculations(row: PurchaseOrderRow, liveRates: any[] = []) {
  const form = rowForm(row);
  const purchCurr = rowCurrency(row) || "USD";
  const finalCurr = rowOfficeCurrency(row) || "PKR";
  
  // Resolve exchange rate
  const exRate = Number(row.exchange_rate || form.exchangeRate || 1) || 1;

  // Resolve base purchase amount in purchase currency
  const goods = row.form_data?.goodsEntries || [];
  let totalPurchaseFC = 0;
  if (Array.isArray(goods) && goods.length > 0) {
    totalPurchaseFC = goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0);
  } else {
    totalPurchaseFC = Number(row.form_data?.totals?.grandPrimaryFinal || form.subTotal || form.totalAmount || 0);
  }

  if (totalPurchaseFC <= 0) {
    const rawTotal = orderTotal(row);
    if (exRate > 1 && rawTotal > 1000000) {
      totalPurchaseFC = rawTotal / exRate;
    } else {
      totalPurchaseFC = rawTotal;
    }
  }

  // Advance Percentage
  const advancePercent = Number(form.advancePercent || 0);

  // Advance Amount in purchase currency
  let advanceAmountFC = 0;
  if (advancePercent > 0) {
    advanceAmountFC = (totalPurchaseFC * advancePercent) / 100;
  } else {
    const rawAdv = Number(row.paid_amount || form.advanceAmount || 0);
    if (exRate > 1 && rawAdv > totalPurchaseFC * 1.05) {
      advanceAmountFC = rawAdv / exRate;
    } else {
      advanceAmountFC = rawAdv;
    }
  }

  // Remaining Purchase in purchase currency
  const remainingPurchaseFC = Math.max(0, totalPurchaseFC - advanceAmountFC);

  // Converted Local Currency Amount
  const totalPurchaseLC = totalPurchaseFC * exRate;

  // Local Currency Advance
  const advanceAmountLC = advanceAmountFC * exRate;

  // Remaining Local Currency Balance
  const remainingPurchaseLC = remainingPurchaseFC * exRate;

  return {
    purchCurr,
    finalCurr,
    exRate,
    totalPurchaseFC,
    advancePercent,
    advanceAmountFC,
    remainingPurchaseFC,
    totalPurchaseLC,
    advanceAmountLC,
    remainingPurchaseLC
  };
}

export type PurchaseCurrencySummaryFC = {
  currency: string;
  totalPurchase: number;
  advancePaid: number;
  remainingBalance: number;
};

export type DashboardSummaryData = {
  country: string;
  branchName: string;
  userName: string;
  userId: string;
  role: string;
  
  totalTransactions: number;
  localCurrency: string;
  
  // Left side (Foreign Currencies)
  foreignCurrencies: Record<string, PurchaseCurrencySummaryFC>;
  totalAllFC: {
    totalPurchase: number;
    advancePaid: number;
    remainingBalance: number;
  };
  
  // Right side (Local Currency)
  totalPurchaseLC: number;
  advancePaidLC: number;
  remainingBalanceLC: number;
};

function getDashboardSummaryData(rows: PurchaseOrderRow[], session: any, mode: string): DashboardSummaryData | null {
  if (!rows || rows.length === 0) return null;

  const firstRow = rows[0];
  const country = rowCountryName(firstRow) || session?.countryName || "Unknown";
  const branchName = rowBranchName(firstRow) || session?.branchName || "Main Branch";
  
  const localCur = (country.toUpperCase().includes("PAKISTAN")) ? "PKR" : 
                   (country.toUpperCase().includes("EMIRATES") || country.toUpperCase().includes("UAE") || country.toUpperCase().includes("DUBAI")) ? "AED" : 
                   (country.toUpperCase().includes("CHINA")) ? "CNY" : 
                   (country.toUpperCase().includes("INDIA")) ? "INR" : 
                   (country.toUpperCase().includes("AFGHANISTAN")) ? "AFN" : 
                   (firstRow?.payment_currency ?? firstRow?.form_data?.form?.secondaryCurrency?.split(" ")[0] ?? "PKR");

  const summary: DashboardSummaryData = {
    country,
    branchName,
    userName: session?.name || session?.username || session?.user?.fullName || "—",
    userId: session?.userId || session?.user?.id || "SA001",
    role: session?.role || "â",
    
    totalTransactions: rows.length,
    localCurrency: localCur,
    
    foreignCurrencies: {},
    totalAllFC: { totalPurchase: 0, advancePaid: 0, remainingBalance: 0 },
    
    totalPurchaseLC: 0,
    advancePaidLC: 0,
    remainingBalanceLC: 0,
  };

  const parseNumber = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  rows.forEach((row) => {
    const currRaw = rowCurrency(row);
    let foreignCur = (currRaw && currRaw !== localCur) ? currRaw : "USD";
    if (!foreignCur || foreignCur === "UNDEFINED") {
       foreignCur = "USD";
    }

    const conversionRate = getConversionRate(row, currRaw, localCur);
    
    const invoiceAmountRaw = parseNumber(orderTotal(row));
    const invoiceAmountFC = (conversionRate > 1 && invoiceAmountRaw > 1000000) ? invoiceAmountRaw / conversionRate : invoiceAmountRaw;
    const invoiceAmountLC = invoiceAmountFC * conversionRate;

    const advancePaidRaw = parseNumber(row.paid_amount || 0);
    const advancePaidFC = (conversionRate > 1 && advancePaidRaw > invoiceAmountFC * 1.05) ? advancePaidRaw / conversionRate : advancePaidRaw;
    const advancePaidLC = advancePaidFC * conversionRate;

    const explicitRemainingRaw = parseNumber(row.remaining_amount || 0);
    const explicitRemainingFC = (conversionRate > 1 && explicitRemainingRaw > invoiceAmountFC * 1.05) ? explicitRemainingRaw / conversionRate : explicitRemainingRaw;
    const explicitRemainingLC = explicitRemainingFC * conversionRate;

    const remainingFC = explicitRemainingFC > 0 ? explicitRemainingFC : Math.max(0, invoiceAmountFC - advancePaidFC);
    const remainingLC = remainingFC * conversionRate;

    if (!summary.foreignCurrencies[foreignCur]) {
      summary.foreignCurrencies[foreignCur] = {
        currency: foreignCur,
        totalPurchase: 0,
        advancePaid: 0,
        remainingBalance: 0
      };
    }
    summary.foreignCurrencies[foreignCur].totalPurchase += invoiceAmountFC;
    summary.foreignCurrencies[foreignCur].advancePaid += advancePaidFC;
    summary.foreignCurrencies[foreignCur].remainingBalance += remainingFC;
    
    summary.totalAllFC.totalPurchase += invoiceAmountFC;
    summary.totalAllFC.advancePaid += advancePaidFC;
    summary.totalAllFC.remainingBalance += remainingFC;

    summary.totalPurchaseLC += invoiceAmountLC;
    summary.advancePaidLC += advancePaidLC;
    summary.remainingBalanceLC += remainingLC;
  });

  return summary;
}

function date(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}

function monthMatch(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function weekDue(value: string | null | undefined) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const sevenDays = new Date(now);
  sevenDays.setDate(now.getDate() + 7);
  return d >= now && d <= sevenDays;
}

function calcLoadingFinance(loadingRecord: any, poRow: any, form: any) {
  const payload = loadingRecord?.report_payload || {};
  const goods = poRow?.form_data?.goodsEntries || [];
  const firstGood = goods[0] || {};
  const totalPurchase = Number(
    payload.totalPurchase ||
    payload.purchaseAmount ||
    loadingRecord?.purchase_amount ||
    firstGood.totalAmount ||
    form.totalAmount ||
    poRow?.order_total ||
    0
  );
  const exchangeRate = Number(payload.exchangeRate || loadingRecord?.exchange_rate || poRow?.exchange_rate || form.exchangeRate || 1) || 1;
  return {
    amountUSD: totalPurchase,
    exRate: exchangeRate,
    netWeight: Number(payload.netWeight || payload.netWt || loadingRecord?.net_weight || firstGood.netWeight || firstGood.netWt || 0),
    grossWeight: Number(payload.grossWeight || payload.grossWt || loadingRecord?.gross_weight || firstGood.grossWeight || firstGood.grossWt || 0)
  };
}
function kpis(rows: PurchaseOrderRow[], baseCurrency: string, lang: LanguageCode): KpiCard[] {
  let totalPurchaseUSD = 0;
  let totalInvoiceValueLC = 0;
  let totalAdvancePaidLC = 0;
  let totalOutstandingBalanceLC = 0;
  let totalExchangeRate = 0;
  let exchangeRateCount = 0;

  rows.forEach((row) => {
    const calcs = resolvePurchaseCalculations(row);
    totalPurchaseUSD += calcs.totalPurchaseFC; // base currency (e.g. USD)
    totalInvoiceValueLC += calcs.totalPurchaseLC; // local currency (e.g. PKR/AED)
    
    const conversionRate = calcs.exRate;
    const paidAdvanceLC = Number(row.paid_amount || 0) * conversionRate;
    totalAdvancePaidLC += paidAdvanceLC;

    // Remaining local currency balance (outstanding)
    totalOutstandingBalanceLC += calcs.remainingPurchaseLC;

    if (calcs.exRate > 0) {
      totalExchangeRate += calcs.exRate;
      exchangeRateCount++;
    }
  });

  const avgExchangeRate = exchangeRateCount > 0 ? totalExchangeRate / exchangeRateCount : 1.0;

  const localCur = rows.length > 0 ? rowOfficeCurrency(rows[0]) : baseCurrency;
  const purchCur = rows.length > 0 ? rowCurrency(rows[0]) : "USD";

  return [
    {
      label: t("total_purchase_lc", lang),
      value: money(totalPurchaseUSD, purchCur),
      sublabel: translateHeader(lang, "Original Currency Total"),
      icon: <FileText className="h-5 w-5" />,
      tone: "blue"
    },
    {
      label: t("kpi_total_invoice_value", lang),
      value: money(totalInvoiceValueLC, localCur),
      sublabel: translateHeader(lang, "Local Currency Total"),
      icon: <Banknote className="h-5 w-5" />,
      tone: "green"
    },
    {
      label: t("kpi_total_advance_paid", lang),
      value: money(totalAdvancePaidLC, localCur),
      sublabel: translateHeader(lang, "Advance Paid to Date"),
      icon: <CheckCircle className="h-5 w-5" />,
      tone: "amber"
    },
    {
      label: t("kpi_total_outstanding_balance", lang),
      value: money(totalOutstandingBalanceLC, localCur),
      sublabel: translateHeader(lang, "Remaining Due to Clear"),
      icon: <XCircle className="h-5 w-5" />,
      tone: "red"
    },
    {
      label: t("kpi_average_exchange_rate", lang),
      value: avgExchangeRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      sublabel: `1 ${purchCur} to ${localCur}`,
      icon: <RefreshCw className="h-5 w-5" />,
      tone: "slate"
    }
  ];
}

function statusClass(status: string | null | undefined) {
  const value = (status || "Pending").toLowerCase();
  if (value.includes("paid") || value.includes("posted") || value.includes("clear")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (value.includes("overdue") || value.includes("expired")) return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (value.includes("pending") || value.includes("due")) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

function exportRows(rows: PurchaseOrderRow[], mode: PaymentMode) {
  try {
    const headers = ["PO Number", "Contract", "Date", "Currency", "Order Total", "Advance", "Remaining", "Credit", "Payment Status", "Journal Status"];
    const body = rows.map((row) =>
      [
        row.sales_order_no,
        row.sales_contract_no ?? "-",
        date(row.created_at),
        row.currency_code ?? "-",
        money(row.order_total),
        money((row as any).paid_amount),
        money((row as any).remaining_amount),
        "-",
        row.payment_status ?? "Pending",
        row.ledger_posting_status ?? "Pending"
      ].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const modeLabel = modeLabels[mode] || String(mode);
    anchor.download = `purchase-order-${modeLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to export rows:", error);
    alert("Failed to export to CSV. Please try again.");
  }
}

const SAVED_BANKS_KEY = "erp_saved_banks_v1";
const SAVED_METHODS_KEY = "erp_saved_payment_methods_v1";

type SavedBankItem = { name: string; address?: string };

function readLocalList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeLocalList(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore
  }
}

function readLocalBankList(key: string): SavedBankItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalBankList(key: string, values: SavedBankItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore
  }
}

function ledgerId(row: any): string | undefined {
  return row?.id ?? row?.ledgerId;
}

function ledgerCode(row: any): string {
  return String(row?.code ?? row?.ledgerCode ?? row?.accountCode ?? "");
}

function ledgerName(row: any): string {
  return String(row?.name ?? row?.ledgerName ?? row?.accountName ?? "");
}

function ledgerCurrency(row: any): string {
  return String(row?.currency ?? row?.ledgerCurrency ?? "");
}

function toLedgerOption(row: any): SearchSelectOption {
  const account = ledgerName(row);
  const accountNo = ledgerCode(row);
  const branch = row?.cityBranchName ?? row?.city_branch_name ?? row?.countryBranchName ?? row?.country_branch_name ?? "";
  const label = branch ? `[${branch}] ${accountNo} - ${account}` : `${accountNo} - ${account}`;
  const keywords = [accountNo, account, branch].filter(Boolean).join(" ");
  return { value: ledgerId(row) || "", label, keywords };
}

function getInitialPurchaseOrderNo(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("salesOrderNo") ?? "";
}

function FieldBlock({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function NestedRowActions({ payment, row, ledgers, localCurrency }: any) {
  const lang = useActiveLanguage();
  function handleAction(fn: () => void) {
    fn();
    const details = document.activeElement?.closest("details");
    if (details) (details as HTMLDetailsElement).open = false;
  }
  return (
    <details className="relative">
      <summary className="flex h-7 w-8 cursor-pointer list-none items-center justify-center rounded border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 [&::-webkit-details-marker]:hidden mx-auto" aria-label={tGlobal(lang, "pay.payment_actions", "Payment actions")} title={tGlobal(lang, "pa.actions", "Actions")}>
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl">
        <MenuAction icon={<Eye />} label={tGlobal(lang, "pay.view_details", "View Details")} onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, false, lang))} />
        <MenuAction icon={<Edit3 />} label={tGlobal(lang, "pay.edit_line", "Edit Line")} onClick={() => handleAction(() => window.dispatchEvent(new CustomEvent("open-edit-payment", { detail: { payment, row } })))} />
        <MenuAction icon={<Printer />} label={tGlobal(lang, "pay.print_receipt", "Print Receipt")} onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, true, lang))} />
      </div>
    </details>
  );
}

function NestedPaymentHistory({ 
  row, 
  ledgers, 
  baseCurrency, 
  activeMode,
  selectOrder,
  expandedIds,
  setExpandedIds,
  logClientError,
  onOpenFullBill
}: { 
  row: any, 
  ledgers: any[], 
  baseCurrency: string, 
  activeMode: string,
  selectOrder: (id: string) => void,
  expandedIds: Record<string, boolean>,
  setExpandedIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  logClientError: (msg: string) => void,
  onOpenFullBill?: () => void
}) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPayments() {
      setLoading(true);
      try {
        const response = await fetch(`/api/erp/sales/orders/${row.id}/payments?lang=${currentLanguage}`, { credentials: "include" });
        const body = await response.json();
        if (body?.ok && body.data?.payments && !cancelled) {
          setPayments(body.data.payments);
        }
      } catch (err) {
        console.error("Failed to load nested payments:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPayments();
    return () => { cancelled = true; };
  }, [row.id, currentLanguage]);

  const form = row.form_data?.form || {};
  const purchaseCurrency = String(
    form.currencyType ||
    form.currency ||
    row.currency_code ||
    row.form_data?.goodsEntries?.[0]?.purchaseCurrency ||
    "USD"
  ).toUpperCase();
  const orderExchangeRate = Number(row.exchange_rate || form.exchangeRate || form.usdRate || 1) || 1;
  const totalPrice = row.form_data?.goodsEntries?.length
    ? row.form_data.goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0)
    : Number(form.totalAmount || row.order_total || 0);
  const totalPurchaseLocal = totalPrice * orderExchangeRate;
  const advancePercent = Number(form.advancePercent || 0);
  const totalRequiredAdvanceFC = (totalPrice * advancePercent) / 100;
  
  // Filter out the initial booking liability transfer so it only shows actual payments
  const filteredPayments = payments.filter((p: any) => !p.narration?.toLowerCase().includes("initial booking transfer"));
  
  // Payments come newest first. Sort chronologically (oldest first) to compute running balances.
  const chronological = [...filteredPayments].sort((a: any, b: any) =>
    new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime()
  );

  let runningPaidForeign = 0;
  let runningPaidLocal = 0;

  const computedHistory = chronological.map((p: any) => {
    const drLedger = ledgers.find((l) => ledgerId(l) === p.debit_ledger_id);
    const crLedger = ledgers.find((l) => ledgerId(l) === p.credit_ledger_id);
    const localCurrency = (ledgerCurrency(drLedger) || ledgerCurrency(crLedger) || baseCurrency).toUpperCase();

    const paymentCurrency = String(p.currency_code || purchaseCurrency).toUpperCase();
    const rate = Number(p.exchange_rate || orderExchangeRate || 1) || 1;
    const rawAmount = Number(p.amount || 0);
    const storedLocalAmount = Number(p.local_currency_amount || p.base_currency_amount || 0);

    let amtForeign = 0;
    let amtLocal = 0;
    if (paymentCurrency === purchaseCurrency) {
      amtForeign = rawAmount;
      amtLocal = storedLocalAmount || rawAmount * rate;
    } else if (paymentCurrency === localCurrency || paymentCurrency === baseCurrency.toUpperCase()) {
      amtLocal = rawAmount;
      amtForeign = rate ? rawAmount / rate : rawAmount;
    } else {
      amtForeign = rawAmount;
      amtLocal = storedLocalAmount || rawAmount * rate;
    }

    runningPaidForeign += amtForeign;
    runningPaidLocal += amtLocal;

    // Remaining balance is calculated in purchase currency first, then converted to local currency.
    const remainingForeign = Math.max(0, totalPrice - runningPaidForeign);
    const remainingLocal = remainingForeign * rate;

    // Remaining required advance balance after this payment
    const remainingRequiredAdvance = Math.max(0, totalRequiredAdvanceFC - runningPaidForeign);

    return {
      ...p,
      purchaseCurrency,
      paymentCurrency,
      exchangeRateUsed: rate,
      amtForeign,
      amtLocal,
      localCurrency,
      runningPaidForeign,
      runningPaidLocal,
      originalPurchaseForeign: totalPrice,
      originalPurchaseLocal: totalPurchaseLocal,
      remainingForeign,
      remainingLocal,
      remainingRequiredAdvance
    };
  });

  const latestPaymentState = computedHistory[computedHistory.length - 1];
  const statementAdvanceRequiredForeign = totalRequiredAdvanceFC > 0 ? totalRequiredAdvanceFC : totalPrice;
  const statementRate = Number(latestPaymentState?.exchangeRateUsed || orderExchangeRate || 1) || 1;
  const statementAdvanceRequiredLocal = statementAdvanceRequiredForeign * statementRate;
  const statementReceivedForeign = Number(latestPaymentState?.runningPaidForeign || 0);
  const statementReceivedLocal = Number(latestPaymentState?.runningPaidLocal || 0);
  const statementBalanceForeign = Math.max(0, statementAdvanceRequiredForeign - statementReceivedForeign);
  const statementBalanceLocal = Math.max(0, statementAdvanceRequiredLocal - statementReceivedLocal);

  // Display newest first in UI table view (reversed chronological)
  const historyWithBalance = [...computedHistory].reverse();
  const calcs = resolvePurchaseCalculations(row);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 shadow-lg dark:border-slate-700">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 p-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">{translateHeader(currentLanguage, "Endorsement Audit Console")}</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <h3 className="text-2xl font-black tracking-tight">{row.sales_order_no || "Sales Order"}</h3>
              <span className="mb-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-100">{historyWithBalance.length} Posted Entries</span>
              <span className="mb-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-100">{purchaseCurrency} to {calcs.finalCurr}</span>
            </div>
            <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-slate-300">Complete endorsement payment audit: sales order, supplier, goods, debit ledger, credit ledger, exchange rate, local currency amount, running balance, and journal reference in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenFullBill && (
              <button
                type="button"
                onClick={onOpenFullBill}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-sm transition hover:bg-blue-50"
              >
                <Eye className="h-4 w-4" />
                {translateHeader(currentLanguage, "Open Full Bill")}
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-px bg-slate-800 p-px md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{translateHeader(currentLanguage, "Purchase Required")}</div>
            <div className="mt-1 font-mono text-lg font-black text-slate-950 dark:text-white">{money(statementAdvanceRequiredForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {money(statementAdvanceRequiredLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{translateHeader(currentLanguage, "Received / Paid")}</div>
            <div className="mt-1 font-mono text-lg font-black text-emerald-600">{money(statementReceivedForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {money(statementReceivedLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{translateHeader(currentLanguage, "Remaining Balance")}</div>
            <div className="mt-1 font-mono text-lg font-black text-rose-600">{statementBalanceForeign <= 0.01 ? "Cleared" : money(statementBalanceForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {statementBalanceLocal <= 0.01 ? "Cleared" : money(statementBalanceLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{translateHeader(currentLanguage, "Ledger Route")}</div>
            <div className="mt-1 truncate text-sm font-black text-blue-700 dark:text-blue-300" title={form.purchaseAccountName || "Debit Account"}>DR: {form.purchaseAccountName || "Debit Account"}</div>
            <div className="mt-1 truncate text-sm font-black text-rose-700 dark:text-rose-300" title={form.salesAccountName || "Credit Account"}>CR: {form.salesAccountName || "Credit Account"}</div>
          </div>
        </div>
      </div>
      {/* Visual Calculation Flow sequence */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/80 shadow-inner">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          {translateHeader(currentLanguage, "Sales Order Financial Conversion Flow")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Column 1: Original Currency Breakdown */}
          <div className="flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-3 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2.5">
              Original Currency Flow ({calcs.purchCurr})
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{translateHeader(currentLanguage, "Total Purchase Amount:")}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{money(calcs.totalPurchaseFC, calcs.purchCurr)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{translateHeader(currentLanguage, "Invoice / Advance %:")}</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-mono font-black dark:bg-blue-950/40 dark:text-blue-400">{calcs.advancePercent}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{translateHeader(currentLanguage, "Invoice / Advance Amount:")}</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{money(calcs.advanceAmountFC, calcs.purchCurr)}</span>
              </div>
              {Number(calcs.advancePercent) > 0 && form?.advancePaymentDate && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">{translateHeader(currentLanguage, "Advance Payment Due Date:")}</span>
                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-mono font-black dark:bg-amber-950/40 dark:text-amber-400">
                    {String(form.advancePaymentDate)}
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 my-1"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-800 dark:text-slate-200 font-bold">{translateHeader(currentLanguage, "Remaining Purchase Balance:")}</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(calcs.remainingPurchaseFC, calcs.purchCurr)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Conversion Rate Bridge */}
          <div className="flex flex-col justify-center items-center p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800/80 shadow-sm relative overflow-hidden text-center min-h-[92px]">
            <div className="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black bg-indigo-50 text-indigo-700 rounded-bl dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-widest">{translateHeader(currentLanguage, "BRIDGE")}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{translateHeader(currentLanguage, "Exchange Rate Applied")}</div>
            <div className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">{calcs.exRate.toFixed(4)}</div>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5">1 {calcs.purchCurr} = {calcs.exRate.toFixed(2)} {calcs.finalCurr}</div>
          </div>

          {/* Column 3: Converted Local Currency Breakdown */}
          <div className="flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-3 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2.5">
              {t("converted_currency_flow", currentLanguage)} ({calcs.finalCurr})
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{t("converted_local_amount", currentLanguage)}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{money(calcs.totalPurchaseLC, calcs.finalCurr)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">{t("local_currency_advance", currentLanguage)} ({calcs.advancePercent}%):</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{money(calcs.advanceAmountLC, calcs.finalCurr)}</span>
              </div>
              <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 my-1"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-800 dark:text-slate-200 font-bold">{t("remaining_local_balance", currentLanguage)}</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(calcs.remainingPurchaseLC, calcs.finalCurr)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
          {t("traceable_payment_history", currentLanguage)}
        </h4>
        {loading && (
          <span className="text-[10px] font-semibold text-slate-400 animate-pulse">{t("loading_history", currentLanguage)}</span>
        )}
      </div>
      {payments.length > 0 ? (
        <>
          <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">{translateHeader(currentLanguage, "Advance / Endorse Required")}</div>
              <div className="mt-0.5 font-mono text-sm font-black text-slate-900 dark:text-slate-100">{money(statementAdvanceRequiredForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {money(statementAdvanceRequiredLocal, calcs.finalCurr)}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{translateHeader(currentLanguage, "Total Received / Paid")}</div>
              <div className="mt-0.5 font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">{money(statementReceivedForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {money(statementReceivedLocal, calcs.finalCurr)}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 dark:border-rose-900 dark:bg-rose-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">{translateHeader(currentLanguage, "Final Advance Balance")}</div>
              <div className="mt-0.5 font-mono text-sm font-black text-rose-700 dark:text-rose-300">{statementBalanceForeign <= 0.01 ? "Cleared" : money(statementBalanceForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {statementBalanceLocal <= 0.01 ? "Cleared" : money(statementBalanceLocal, calcs.finalCurr)}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 border-b font-bold text-slate-600 uppercase text-[10px] tracking-wider">
                <Th className="px-3 py-2.5 border-r">{translateHeader(currentLanguage, "General Serial / Date")}</Th>
                <Th className="px-3 py-2.5 border-r">{translateHeader(currentLanguage, "Reference / User")}</Th>
                <Th className="px-3 py-2.5 border-r">{translateHeader(currentLanguage, "Debit & Credit Ledger Account")}</Th>
                <Th className="px-3 py-2.5 text-right border-r">Advance Required ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Received ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Balance ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-center border-r">{translateHeader(currentLanguage, "Exchange Rate")}</Th>
                <Th className="px-3 py-2.5 text-right border-r">Advance Required ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Received ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Balance ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-center w-28">{translateHeader(currentLanguage, "Actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {historyWithBalance.map((p) => {
                const drLedger = ledgers.find((l) => ledgerId(l) === p.debit_ledger_id);
                const crLedger = ledgers.find((l) => ledgerId(l) === p.credit_ledger_id);
                const drLabel = drLedger ? ledgerName(drLedger) : "-";
                const crLabel = crLedger ? ledgerName(crLedger) : "-";
                const re = p.roznamcha_entries || {};
                const journalSerial = re.super_admin_serial_number || p.super_admin_serial_number || "Pending";
                const countrySerial = re.country_transaction_serial_number || p.country_transaction_serial_number || "-";
                const branchSerial = re.branch_transaction_serial_number || p.branch_transaction_serial_number || "-";
                const debitSerialBase = String(re.debit_serial_number || p.debit_serial_number || journalSerial || "Pending");
                const creditSerialBase = String(re.credit_serial_number || p.credit_serial_number || journalSerial || "Pending");
                const debitSerial = debitSerialBase.endsWith("-DR") ? debitSerialBase : debitSerialBase + "-DR";
                const creditSerial = creditSerialBase.endsWith("-CR") ? creditSerialBase : creditSerialBase + "-CR";
                const requiredAdvanceForeign = totalRequiredAdvanceFC > 0 ? totalRequiredAdvanceFC : p.originalPurchaseForeign;
                const requiredAdvanceLocal = requiredAdvanceForeign * Number(p.exchangeRateUsed || 1);
                const remainingAdvanceForeign = Math.max(0, requiredAdvanceForeign - p.runningPaidForeign);
                const remainingAdvanceLocal = Math.max(0, requiredAdvanceLocal - p.runningPaidLocal);

                return (
                  <tr key={p.id} className="border-b border-indigo-100/50 hover:bg-indigo-50/40 transition">
                    <td className="px-3 py-2.5 border-r font-mono text-slate-900 dark:text-slate-100 text-[10px] align-top space-y-1 whitespace-nowrap">
                      <div><span className="text-muted-foreground font-semibold">{translateHeader(currentLanguage, "General:")}</span> <span className="font-bold">{journalSerial}</span></div>
                      <div><span className="text-muted-foreground font-semibold">{translateHeader(currentLanguage, "Country:")}</span> <span className="font-bold">{countrySerial}</span></div>
                      <div><span className="text-muted-foreground font-semibold">{translateHeader(currentLanguage, "Branch:")}</span> <span className="font-bold">{branchSerial}</span></div>
                      <div className="pt-1 text-slate-500">{date(p.entry_date || p.created_at)}</div>
                    </td>
                    <td className="px-3 py-2.5 border-r text-xs align-top space-y-1 min-w-[160px]">
                      <div className="font-mono text-[10px] text-slate-500">Ref: {p.reference_no || p.roznamcha_number || p.voucher_no || "-"}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{p.users?.full_name || row.form_data?.form?.userName || "Admin"}</div>
                      <div className="text-muted-foreground">{p.kind === "advance" ? "Advance Payment" : p.kind || "Payment"}</div>
                    </td>
                    <td className="px-3 py-2.5 border-r text-[10px] align-top min-w-[220px]">
                      <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 dark:border-blue-900 dark:bg-blue-950/20">
                        <div className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 font-mono text-[8px] font-black text-white shadow-sm">DR Serial: {debitSerial}</div>
                        <div className="font-semibold text-indigo-600 leading-tight" title={drLabel}><span className="font-black text-indigo-800 mr-1">DR:</span>{drLabel}</div>
                      </div>
                      <div className="mt-1 rounded-lg border border-violet-100 bg-violet-50/70 px-2 py-1 dark:border-violet-900 dark:bg-violet-950/20">
                        <div className="inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 font-mono text-[8px] font-black text-white shadow-sm">CR Serial: {creditSerial}</div>
                        <div className="font-semibold text-violet-600 leading-tight" title={crLabel}><span className="font-black text-violet-800 mr-1">CR:</span>{crLabel}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{money(requiredAdvanceForeign, p.purchaseCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">PO: {money(p.originalPurchaseForeign, p.purchaseCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600">{money(p.runningPaidForeign, p.purchaseCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Current: {money(p.amtForeign, p.purchaseCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-rose-600">{remainingAdvanceForeign <= 0.01 ? "Advance Cleared" : money(remainingAdvanceForeign, p.purchaseCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Purchase Bal: {money(p.remainingForeign, p.purchaseCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap border-r align-top">
                      <div className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold inline-block">
                        {Number(p.exchangeRateUsed || 1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{money(requiredAdvanceLocal, p.localCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">PO: {money(p.originalPurchaseLocal, p.localCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600">{money(p.runningPaidLocal, p.localCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Current: {money(p.amtLocal, p.localCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono border-r align-top whitespace-nowrap">
                      <div className="text-sm font-bold text-rose-600">{remainingAdvanceLocal <= 0.01 ? "Advance Cleared" : money(remainingAdvanceLocal, p.localCurrency)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Purchase Bal: {money(p.remainingLocal, p.localCurrency)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center align-top">
                      <NestedRowActions payment={p} row={row} ledgers={ledgers} localCurrency={p.localCurrency} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{translateHeader(currentLanguage, "Final Digital Balance Statement")}</div>
                <div className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Purchase currency balance is calculated first, then converted into the country / office currency.</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right md:min-w-[360px]">
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-slate-950/60">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Balance ({purchaseCurrency})</div>
                  <div className="font-mono text-sm font-black text-rose-600">{statementBalanceForeign <= 0.01 ? "Cleared" : money(statementBalanceForeign, purchaseCurrency)}</div>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-slate-950/60">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Balance ({calcs.finalCurr})</div>
                  <div className="font-mono text-sm font-black text-rose-600">{statementBalanceLocal <= 0.01 ? "Cleared" : money(statementBalanceLocal, calcs.finalCurr)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400 italic py-2">
          {loading ? "Loading payments..." : "No payments posted for this sales order yet."}
        </p>
      )}
    </div>
  );
}

const getCountryCode = (country: string) => {
  if (!country) return "GL";
  const c = country.toUpperCase();
  if (c.includes("PAKISTAN")) return "PK";
  if (c.includes("UNITED ARAB") || c === "UAE") return "AE";
  if (c.includes("UNITED STATES") || c === "USA") return "US";
  if (c.includes("SAUDI")) return "SA";
  if (c.includes("CHINA")) return "CN";
  if (c.includes("INDIA")) return "IN";
  if (c.includes("AFGHANISTAN")) return "AF";
  if (c.includes("UNITED KINGDOM") || c === "UK") return "UK";
  if (c.includes("CANADA")) return "CA";
  return "GL";
};

const renderCountryBadge = (countryName: string) => {
  const code = getCountryCode(countryName);
  const colorMap: Record<string, string> = {
    "PK": "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
    "AE": "bg-blue-50 text-blue-700 border-blue-250 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
    "US": "bg-indigo-50 text-indigo-700 border-indigo-250 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50",
    "SA": "bg-green-50 text-green-700 border-green-250 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50",
    "CN": "bg-red-50 text-red-700 border-red-255 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
    "IN": "bg-orange-50 text-orange-700 border-orange-255 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50",
    "AF": "bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
    "UK": "bg-purple-50 text-purple-700 border-purple-250 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50",
    "CA": "bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50"
  };
  const colorClass = colorMap[code] || "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800";
  return (
    <span className={cn("px-1.5 py-0.5 text-[9px] font-black rounded border tracking-wider select-none", colorClass)}>
      {code}
    </span>
  );
};

function DashboardSummaryHeader({ 
  summary, 
  mode, 
  isGroupSummary,
  isSuperAdmin,
  rows,
  expandedCountries,
  setExpandedCountries,
  selectedCountryForSummary,
  setSelectedCountryForSummary,
  session,
  lang = "en"
}: { 
  summary: DashboardSummaryData; 
  mode: string; 
  isGroupSummary?: boolean; 
  isSuperAdmin?: boolean; 
  rows?: PurchaseOrderRow[];
  expandedCountries?: Record<string, boolean>;
  setExpandedCountries?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedCountryForSummary?: string | null;
  setSelectedCountryForSummary?: (c: string | null) => void;
  lang?: LanguageCode;
  session?: any;
}) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [expandedSummaryCountries, setExpandedSummaryCountries] = useState<Record<string, boolean>>({});
  const [showAllCountries, setShowAllCountries] = useState(false);

  if (!summary) return null;

  const notTransferredPercentLC = summary.totalPurchaseLC > 0 ? (summary.remainingBalanceLC / summary.totalPurchaseLC) * 100 : 0;
  const numCurrencies = Object.keys(summary.foreignCurrencies).length;
  const reportType = mode === "advance" ? "Advance Payment Summary" : mode === "credit" ? "Credit Payment Summary" : "Purchase Payment Summary";
  const now = new Date();
  
  // Format Date & Time based on Pakistan time (or local system)
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();



  const getUsdRate = (currency: string, baseCurrency: string, rowRate: number) => {
    const cur = currency.toUpperCase();
    const base = baseCurrency.toUpperCase();
    if (cur === base || cur === "USD") return 1.0;
    // Use only the transaction's own frozen exchange rate â never a hard-coded placeholder.
    const r = Number(rowRate || 0);
    if (r > 1) return 1 / r;
    if (r > 0) return r;
    return 1.0;
  };

  // Group rows strictly by Country first, and nested by Branch
  const summaryRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    const groups: Record<string, {
      country: string;
      currency: string;
      purchase: number;
      sale: number;
      dollarRate: number;
      dollarTotal: number;
      finalTotal: number;
      requiredAdvance: number;
      paidAdvance: number;
      remainingAdvance: number;
      remainingDue: number;
      remPaid: number;
      branches: Record<string, {
        branch: string;
        currency: string;
        purchase: number;
        sale: number;
        dollarRate: number;
        dollarTotal: number;
        finalTotal: number;
        requiredAdvance: number;
        paidAdvance: number;
        remainingAdvance: number;
        remainingDue: number;
        remPaid: number;
      }>;
    }> = {};

    rows.forEach(row => {
      const country = rowCountryName(row);
      const branch = rowBranchName(row);
      const currency = rowCurrency(row);
      const officeCur = rowOfficeCurrency(row);

      const purchaseAmt = orderTotal(row);
      const goods = row.form_data?.goodsEntries || [];
      const saleAmt = goods.reduce((sum: number, g: any) => sum + Number(g.saleAmount || g.sellingAmount || (Number(g.saleRate || g.sellingRate || g.salePrice || g.sellingPrice || 0) * Number(g.qtyNo || g.quantity || 0)) || 0), 0) || (purchaseAmt * 1.15);

      const conversionRate = getConversionRate(row, currency, officeCur, []);
      const finalTotal = purchaseAmt * conversionRate;
      const usdRate = getUsdRate(currency, summary.localCurrency, row.exchange_rate || 1);
      const dollarTotal = (purchaseAmt + saleAmt) * usdRate;

      // Advance conversion & values in Local Currency
      const form = row.form_data?.form || {};
      const advancePercent = Number(form.advancePercent || 0);
      const requiredAdvance = finalTotal * advancePercent / 100;
      // sales_orders only has paid_amount/remaining_amount (running totals across every payment
      // kind combined) â no advance_paid/remaining_due/remaining_paid columns exist on this
      // table (those are purchase_orders fields this block was copy-pasted from).
      const totalPaidLocal = Number((row as any).paid_amount || 0) * conversionRate;
      const paidAdvance = Math.min(requiredAdvance, totalPaidLocal);
      const remainingAdvance = Math.max(0, requiredAdvance - paidAdvance);
      const remainingDue = Number((row as any).remaining_amount ?? 0) * conversionRate;
      const remPaid = Math.max(0, totalPaidLocal - requiredAdvance);

      if (!groups[country]) {
        groups[country] = {
          country,
          currency: officeCur,
          purchase: 0,
          sale: 0,
          dollarRate: usdRate,
          dollarTotal: 0,
          finalTotal: 0,
          requiredAdvance: 0,
          paidAdvance: 0,
          remainingAdvance: 0,
          remainingDue: 0,
          remPaid: 0,
          branches: {}
        };
      }

      groups[country].purchase += purchaseAmt;
      groups[country].sale += saleAmt;
      groups[country].dollarTotal += dollarTotal;
      groups[country].finalTotal += finalTotal;
      groups[country].requiredAdvance += requiredAdvance;
      groups[country].paidAdvance += paidAdvance;
      groups[country].remainingAdvance += remainingAdvance;
      groups[country].remainingDue += remainingDue;
      groups[country].remPaid += remPaid;

      if (!groups[country].branches[branch]) {
        groups[country].branches[branch] = {
          branch,
          currency: officeCur,
          purchase: 0,
          sale: 0,
          dollarRate: usdRate,
          dollarTotal: 0,
          finalTotal: 0,
          requiredAdvance: 0,
          paidAdvance: 0,
          remainingAdvance: 0,
          remainingDue: 0,
          remPaid: 0
        };
      }

      const br = groups[country].branches[branch];
      br.purchase += purchaseAmt;
      br.sale += saleAmt;
      br.dollarTotal += dollarTotal;
      br.finalTotal += finalTotal;
      br.requiredAdvance += requiredAdvance;
      br.paidAdvance += paidAdvance;
      br.remainingAdvance += remainingAdvance;
      br.remainingDue += remainingDue;
      br.remPaid += remPaid;
    });

    // Convert groups to array and convert branches Record to array, sorting them
    return Object.values(groups).map(g => ({
      ...g,
      branches: Object.values(g.branches).sort((a, b) => a.branch.localeCompare(b.branch))
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [rows, summary.localCurrency]);

  const renderSuperAdminSummaryTable = () => {
    if (!summaryRows || summaryRows.length === 0) {
      return (
        <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs font-semibold">
          {translateHeader(currentLanguage, "No summary data available")}
        </div>
      );
    }

    const grandTotals = summaryRows.reduce((acc, cur) => {
      acc.purchaseUSD += cur.purchase * cur.dollarRate;
      acc.saleUSD += cur.sale * cur.dollarRate;
      // Convert cur.finalTotal (which is in cur.currency) to summary.localCurrency
      const conversionRateToLocal = getConversionRate(null, cur.currency, summary.localCurrency, []);
      acc.finalTotal += cur.finalTotal * conversionRateToLocal;
      acc.dollarTotal += cur.dollarTotal;
      return acc;
    }, { purchaseUSD: 0, saleUSD: 0, finalTotal: 0, dollarTotal: 0 });

    const dir = ["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr";

    return (
      <div dir={dir} className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full">
        <table className={cn("w-full text-[10.5px] border-collapse bg-white dark:bg-slate-900", dir === "rtl" ? "text-right" : "text-left")}>
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[9.5px] text-slate-700 dark:text-slate-350 font-bold uppercase tracking-wider">
                <Th className={cn("px-2.5 py-2.5 font-extrabold", dir === "rtl" ? "text-right" : "text-left")}>{t("country", lang)}</Th>
                <Th className={cn("px-2.5 py-2.5 font-extrabold", dir === "rtl" ? "text-right" : "text-left")}>{t("col_currency", lang)}</Th>
                <Th className={cn("px-2.5 py-2.5 font-extrabold", dir === "rtl" ? "text-left" : "text-right")}>{t("col_total_value", lang)}</Th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((r, idx) => {
                const isSelected = selectedCountryForSummary === r.country;
                const isExpanded = !!expandedSummaryCountries[r.country];

                return (
                  <React.Fragment key={idx}>
                    <tr 
                      onClick={() => {
                        if (setSelectedCountryForSummary) {
                          setSelectedCountryForSummary(isSelected ? null : r.country);
                        }
                        setExpandedSummaryCountries(prev => ({
                          ...prev,
                          [r.country]: !prev[r.country]
                        }));
                      }}
                      className={cn(
                        "border-b border-slate-200 dark:border-slate-800 hover:bg-blue-50/60 dark:hover:bg-blue-900/30 cursor-pointer font-extrabold text-slate-800 dark:text-slate-200 transition-all",
                        isSelected && "bg-blue-50/90 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-black border-l-2 border-l-blue-600 shadow-sm"
                      )}
                    >
                      <td className="px-2.5 py-3 uppercase truncate max-w-[120px] flex items-center gap-1 select-none font-sans" title={r.country}>
                        <span className="text-slate-400 mr-0.5">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                        {renderCountryBadge(r.country)}
                        <span className="font-extrabold ml-1">{tData(r.country, lang)}</span>
                      </td>
                      <td className="px-2.5 py-3 font-black text-slate-900 dark:text-slate-100">{tData(r.currency, lang)}</td>
                      <td className={cn("px-2.5 py-3 font-sans font-black tabular-nums text-slate-900 dark:text-slate-100", dir === "rtl" ? "text-left" : "text-right")}>{r.finalTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                        <td colSpan={3} className="p-3">
                          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-inner dark:border-slate-850 dark:bg-slate-950 space-y-3">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                              <span>{tData(r.country, lang)} Branches Report Details</span>
                              <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold dark:bg-blue-950/40 dark:text-blue-400">
                                {r.branches.length} Branches
                              </span>
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-[10px] border-collapse">
                                <thead>
                                  <tr className="border-b text-slate-450 font-bold uppercase text-[9px] tracking-wider bg-slate-50/80 dark:bg-slate-900/50">
                                    <Th className="px-2 py-1.5">{t("branch", lang)}</Th>
                                    <Th className="px-2 py-1.5 text-right">{translateHeader(lang, "Total Purchase")}</Th>
                                    <Th className="px-2 py-1.5 text-right">{translateHeader(lang, "Required Adv")}</Th>
                                    <Th className="px-2 py-1.5 text-right">{translateHeader(lang, "Paid Adv")}</Th>
                                    <Th className="px-2 py-1.5 text-right">{translateHeader(lang, "Remaining Adv")}</Th>
                                    <Th className="px-2 py-1.5 text-right">{translateHeader(lang, "Remaining Due (Baqaya)")}</Th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {r.branches.map((b, bIdx) => (
                                    <tr key={bIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350">
                                      <td className="px-2 py-2 font-extrabold uppercase">{tData(b.branch, lang)}</td>
                                      <td className="px-2 py-2 text-right font-mono font-bold">{money(b.purchase, b.currency)}</td>
                                      <td className="px-2 py-2 text-right font-mono text-slate-500 dark:text-slate-400">{money(b.requiredAdvance, b.currency)}</td>
                                      <td className="px-2 py-2 text-right font-mono text-emerald-600 font-bold">{money(b.paidAdvance, b.currency)}</td>
                                      <td className={cn("px-2 py-2 text-right font-mono font-bold", b.remainingAdvance > 0 ? "text-amber-600" : "text-emerald-600")}>
                                        {money(b.remainingAdvance, b.currency)}
                                      </td>
                                      <td className={cn("px-2 py-2 text-right font-mono font-black", b.remainingDue > 0 ? "text-rose-600" : "text-slate-500")}>
                                        {money(b.remainingDue, b.currency)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Grand Totals */}
              <tr className="bg-blue-50/40 dark:bg-blue-950/20 font-black text-slate-900 dark:text-slate-100 border-t-2 border-slate-200 dark:border-slate-700 text-[11px]">
                <td colSpan={2} className={cn("px-2.5 py-3 uppercase tracking-wider text-[9.5px] text-slate-500 dark:text-slate-400", dir === "rtl" ? "text-left" : "text-right")}>{t("total_summary", lang)} ({summary.localCurrency})</td>
                <td className={cn("px-2.5 py-3 font-sans tabular-nums text-slate-900 dark:text-slate-100", dir === "rtl" ? "text-left" : "text-right")}>{grandTotals.finalTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>
        </div>
    );
  };

  const renderDetailItem = (icon: React.ReactNode, label: string, value: React.ReactNode, textClass = "text-slate-800 dark:text-slate-200") => (
    <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-850/20 pb-2 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-[10.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">
        {icon}
        {translateHeader(currentLanguage, label)}:
      </span>
      <div className={cn("font-extrabold text-[11.5px] truncate max-w-[120px] uppercase", textClass)}>{value}</div>
    </div>
  );

  const renderDetails = () => (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
        <div className="bg-blue-600 p-1 rounded-full text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">1. {translateHeader(currentLanguage, "BRANCH & USER DETAILS")}</h4>
      </div>
      <div className="p-4 flex flex-col gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
        {renderDetailItem(<Globe className="h-3.5 w-3.5 text-slate-400" />, "Country", (
          <div className="flex items-center gap-1.5 font-extrabold text-[11.5px]">
            {renderCountryBadge(summary.country)}
            <span>{summary.country}</span>
          </div>
        ))}
        {renderDetailItem(<Home className="h-3.5 w-3.5 text-slate-400" />, "Branch", summary.branchName)}
        {renderDetailItem(<Fingerprint className="h-3.5 w-3.5 text-slate-400" />, "User ID", summary.userId)}
        {renderDetailItem(<User className="h-3.5 w-3.5 text-slate-400" />, "Name", summary.userName)}
        {renderDetailItem(<Shield className="h-3.5 w-3.5 text-slate-400" />, "Role", summary.role)}
        {renderDetailItem(<CalendarDays className="h-3.5 w-3.5 text-slate-400" />, "Date/Time", `${dateStr} ${timeStr}`, "text-[10px] text-slate-700 dark:text-slate-350")}
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-2 text-[10.5px] text-slate-400 font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
            {translateHeader(lang, "Status")}:
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-455 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">{translateHeader(lang, "Active")}</span>
        </div>
      </div>
    </div>
  );

  const renderPurchaseSummary = (onlyBody = false) => {
    const body = (
      <div className="flex flex-col gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></div> {translateHeader(currentLanguage, "Total Transactions:")}</span>
          <span className="font-black text-slate-800 dark:text-slate-200">{summary.totalTransactions}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div> {translateHeader(currentLanguage, "Purchase Currencies:")}</span>
          <span className="font-black text-slate-800 dark:text-slate-200">{numCurrencies}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5" y="0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div> Total Purchase (All):</span>
          <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{summary.totalAllFC.totalPurchase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></div> Total Invoice / Advance (All):</span>
          <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{summary.totalAllFC.advancePaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center pt-2 mt-auto border-t border-dashed border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div> Total Not Transferred (All):</span>
          <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{summary.totalAllFC.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div> {translateHeader(currentLanguage, "% Not Transferred:")}</span>
          <span className="font-black text-rose-600 dark:text-rose-400">{summary.totalAllFC.totalPurchase > 0 ? ((summary.totalAllFC.remainingBalance / summary.totalAllFC.totalPurchase) * 100).toFixed(2) : "0.00"}%</span>
        </div>
      </div>
    );

    if (onlyBody) return body;

    return (
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
          <div className="bg-purple-600 p-1 rounded-full text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">2. PURCHASE SUMMARY (ALL CURRENCIES)</h4>
        </div>
        <div className="p-4 flex-1">
          {body}
        </div>
      </div>
    );
  };

  const renderOfficeCurrencySummary = (onlyBody = false) => {
    const body = (
      <div className="flex flex-col gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.55" y="0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div> Total Amount ({summary.localCurrency}):</span>
          <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{summary.totalPurchaseLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></div> Invoice / Advance ({summary.localCurrency}):</span>
          <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{summary.advancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center pt-2 mt-auto border-t border-dashed border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div> Not Transferred ({summary.localCurrency}):</span>
          <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{summary.remainingBalanceLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div> {translateHeader(currentLanguage, "% Not Transferred:")}</span>
          <span className="font-black text-rose-600 dark:text-rose-400">{notTransferredPercentLC.toFixed(2)}%</span>
        </div>
      </div>
    );

    if (onlyBody) return body;

    return (
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <div className="bg-emerald-600 p-1 rounded-full text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-455 bg-emerald-50 dark:bg-emerald-900/10">3. FINAL OFFICE CURRENCY SUMMARY ({summary.localCurrency})</h4>
        </div>
        <div className="p-4 flex-1">
          {body}
        </div>
      </div>
    );
  };

  const renderTransactionSummary = (onlyBody = false) => {
    const body = (
      <div className="flex flex-col gap-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
        <div className="flex justify-between items-center">
          <span>{t("info_total_transactions", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{summary.totalTransactions}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("info_purchase_currencies", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{numCurrencies}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("info_final_currency", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{summary.localCurrency}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("info_exchange_rate_type", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{translateHeader(lang, "Live")}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("info_last_updated", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>{t("info_report_type", lang)}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{reportType}</span>
        </div>
      </div>
    );

    if (onlyBody) return body;

    return (
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
          <div className="bg-orange-600 p-1 rounded-full text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">4. TRANSACTION SUMMARY</h4>
        </div>
        <div className="p-4 flex-1">
          {body}
        </div>
      </div>
    );
  };

  const renderAllStepsContent = () => {
    const avgPurchaseRate = summary.totalAllFC.totalPurchase > 0 
      ? (summary.totalPurchaseLC / summary.totalAllFC.totalPurchase).toFixed(4)
      : "1.0000";

    const avgAdvanceRate = summary.totalAllFC.advancePaid > 0 
      ? (summary.advancePaidLC / summary.totalAllFC.advancePaid).toFixed(4)
      : "1.0000";

    const dir = ["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr";
    return (
      <div dir={dir} className={cn("flex flex-col gap-3 text-[10px]", dir === "rtl" ? "text-right" : "text-left")}>
        {/* Block P1: Purchase Summary */}
        <div className="border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/30 p-2.5">
          <div className="flex items-center gap-1.5 font-black uppercase text-purple-700 dark:text-purple-400 mb-2 border-b border-slate-100 dark:border-slate-850/60 pb-1 flex-wrap">
            <span className="text-[7.5px] bg-purple-600 text-white font-extrabold px-1 rounded">P1</span>
            <span>{t("purchase_summary", lang)}</span>
          </div>
          <div className="space-y-1 text-slate-500 dark:text-slate-400 font-semibold">
            <div className="flex justify-between items-center">
              <span>{t("currencies", lang)}:</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-200">{numCurrencies} {lang === "en" ? "Currencies" : ""}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("total_purchase_fc", lang)}:</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-200 font-sans tabular-nums">{summary.totalAllFC.totalPurchase.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("total_purchase_lc", lang)} ({summary.localCurrency}):</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-200 font-sans tabular-nums">{summary.totalPurchaseLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("avg_rate", lang)}:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 font-sans tabular-nums">{avgPurchaseRate}</span>
            </div>
          </div>
        </div>

        {/* Block P2: Advance Summary */}
        <div className="border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/30 p-2.5">
          <div className="flex items-center gap-1.5 font-black uppercase text-blue-700 dark:text-blue-400 mb-2 border-b border-slate-100 dark:border-slate-850/60 pb-1 flex-wrap">
            <span className="text-[7.5px] bg-blue-600 text-white font-extrabold px-1 rounded">P2</span>
            <span>{t("advance_summary", lang)}</span>
          </div>
          <div className="space-y-1 text-slate-500 dark:text-slate-400 font-semibold">
            <div className="flex justify-between items-center">
              <span>{t("total_purchase_fc", lang).replace("Purchase", "Advance")}:</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-200 font-sans tabular-nums">{summary.totalAllFC.advancePaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("total_purchase_lc", lang).replace("Purchase", "Advance")} ({summary.localCurrency}):</span>
              <span className="font-extrabold text-slate-850 dark:text-slate-200 font-sans tabular-nums">{summary.advancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("avg_rate", lang)}:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200 font-sans tabular-nums">{avgAdvanceRate}</span>
            </div>
          </div>
        </div>

        {/* Block P3: Paid Advance */}
        <div className="border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/30 p-2.5">
          <div className="flex items-center gap-1.5 font-black uppercase text-emerald-700 dark:text-emerald-455 mb-2 border-b border-slate-100 dark:border-slate-850/60 pb-1 flex-wrap">
            <span className="text-[7.5px] bg-emerald-600 text-white font-extrabold px-1 rounded">P3</span>
            <span>{t("paid_advance", lang)}</span>
          </div>
          <div className="space-y-1 text-slate-500 dark:text-slate-400 font-semibold">
            <div className="flex justify-between items-center">
              <span>{t("paid_advance", lang)} (FC):</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-455 font-sans tabular-nums">{summary.totalAllFC.advancePaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("paid_advance", lang)} ({summary.localCurrency}):</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-455 font-sans tabular-nums">{summary.advancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("cleared_records", lang)}:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">{summary.totalTransactions} {lang === "en" ? "Records" : ""}</span>
            </div>
          </div>
        </div>

        {/* Block P4: Remaining Advance */}
        <div className="border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/30 p-2.5">
          <div className="flex items-center gap-1.5 font-black uppercase text-rose-700 dark:text-rose-400 mb-2 border-b border-slate-100 dark:border-slate-850/60 pb-1 flex-wrap">
            <span className="text-[7.5px] bg-rose-600 text-white font-extrabold px-1 rounded">P4</span>
            <span>{t("remaining_advance", lang)}</span>
          </div>
          <div className="space-y-1 text-slate-500 dark:text-slate-400 font-semibold">
            <div className="flex justify-between items-center">
              <span>{t("remaining_advance", lang)} (FC):</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 font-sans tabular-nums">{summary.totalAllFC.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("remaining_advance", lang)} ({summary.localCurrency}):</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 font-sans tabular-nums">{summary.remainingBalanceLC.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{t("remaining_ratio", lang)}:</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400">{notTransferredPercentLC.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUnifiedReport = () => (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
        <div className="bg-blue-600 p-1 rounded-full text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">{t("report_title", lang)}</h4>
      </div>
      <div className="p-3 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin">
        {renderAllStepsContent()}
      </div>
    </div>
  );

  // Group summary for display under table collapse row
  if (isGroupSummary) {
    return (
      <div className="flex flex-col mb-2 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {renderPurchaseSummary()}
          {renderOfficeCurrencySummary()}
          {renderTransactionSummary()}
        </div>
      </div>
    );
  }

  const renderHorizontalDetails = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/20 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800/50 mb-4 shadow-sm">
      <div className="flex justify-between items-center gap-2 border-b border-slate-100 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-450">
          <Globe className="h-3.5 w-3.5 text-slate-450" /> {t("country", lang)}:
        </span>
        <div className="flex items-center gap-1 font-extrabold text-[11px] text-slate-800 dark:text-slate-200">
          {renderCountryBadge(summary.country)}
          <span>{tData(summary.country, lang)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <Home className="h-3.5 w-3.5 text-slate-400" /> {t("branch", lang)}:
        </span>
        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[110px]" title={summary.branchName}>{tData(summary.branchName, lang)}</span>
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <Globe className="h-3.5 w-3.5 text-blue-500" /> {t("scope", lang)}:
        </span>
        {selectedCountryForSummary ? (
          <div className="flex items-center gap-1 font-extrabold text-[11px] text-blue-600 dark:text-blue-400">
            {renderCountryBadge(selectedCountryForSummary)}
            <span>{tData(selectedCountryForSummary, lang)}</span>
            {setSelectedCountryForSummary && (
              <button 
                type="button" 
                onClick={() => setSelectedCountryForSummary(null)} 
                className="text-[9px] font-black text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 underline ml-1 cursor-pointer"
              >
                (Reset)
              </button>
            )}
          </div>
        ) : (
          <span className="font-extrabold text-[11px] text-slate-400">{t("global_all", lang)}</span>
        )}
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <Fingerprint className="h-3.5 w-3.5 text-slate-400" /> {t("user_id", lang)}:
        </span>
        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200">{summary.userId}</span>
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <User className="h-3.5 w-3.5 text-slate-400" /> {t("name", lang)}:
        </span>
        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[110px]">{tData(summary.userName, lang)}</span>
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <Shield className="h-3.5 w-3.5 text-slate-400" /> {t("role", lang)}:
        </span>
        <span className="font-extrabold text-[11px] text-slate-800 dark:text-slate-200 uppercase">{t(summary.role, lang)}</span>
      </div>

      <div className="flex justify-between items-center gap-2 border-b border-slate-100/50 dark:border-slate-800/40 md:border-b-0 pb-1.5 md:pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {t("time", lang)}:
        </span>
        <span className="font-extrabold text-[10px] text-slate-700 dark:text-slate-350">{dateStr} {timeStr}</span>
      </div>

      <div className="flex justify-between items-center gap-2 pb-0">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-455">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /> {t("status", lang)}:
        </span>
        <span className="font-extrabold text-emerald-600 dark:text-emerald-455 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-[9px] uppercase font-black tracking-wider">{t("active", lang)}</span>
      </div>
    </div>
  );

  // Render 4 summary cards header for all users and roles
  const totalGlobalEntries = (rows || []).length;
  const transferredEntries = (rows || []).filter(row => {
    const ps = (row.ledger_posting_status || "").toLowerCase();
    const st = (row.payment_status || "").toLowerCase();
    return ps === "posted" || ps === "transferred" || st === "paid" || st === "completed";
  }).length;
  const remainingEntries = totalGlobalEntries - transferredEntries;
  
  const activeCountriesCount = summaryRows.length;
  let activeBranchesCount = 0;
  summaryRows.forEach(r => { activeBranchesCount += r.branches.length; });

  const formatMoney = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getFlag = (cName: string) => {
    if (!cName) return '';
    if (cName.toLowerCase().includes('pakistan')) return 'PK';
    if (cName.toLowerCase().includes('iran')) return 'IR';
    if (cName.toLowerCase().includes('arab emirates') || cName.toLowerCase().includes('uae')) return 'AE';
    if (cName.toLowerCase().includes('afghanistan')) return 'AF';
    if (cName.toLowerCase().includes('india')) return 'IN';
    if (cName.toLowerCase().includes('china')) return 'CN';
    return '';
  };
  const th = (label: string) => translateHeader(lang, label);

  const adminCountry = selectedCountryForSummary || summary.country || session?.countryName || "â";
  const adminBranch = (summary.branchName && summary.branchName !== "All Branches") ? summary.branchName : (session?.branchName || "â");
  const adminUserName = summary.userName || session?.name || session?.username || "â";
  const adminRole = session?.role || summary.role || "â";

  // Calculate Date Range from actual rows
  const dates = (rows || [])
    .map((r) => r.form_data?.form?.saleDate || r.form_data?.form?.purchaseDate || r.created_at)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const minDateStr = dates.length > 0
    ? dates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "â";
  const maxDateStr = dates.length > 0
    ? dates[dates.length - 1].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "â";

  // Currency breakdown for 6 columns in Row 2 Left Panel
  const currencyTotals: Record<string, number> = {
    USD: 0,
    EUR: 0,
    PKR: 0,
    GBP: 0,
    CNY: 0,
    OTHERS: 0
  };

  (rows || []).forEach((r) => {
    const cur = (rowCurrency(r) || "USD").toUpperCase();
    const amt = orderTotal(r);
    if (cur === "USD") currencyTotals.USD += amt;
    else if (cur === "EUR") currencyTotals.EUR += amt;
    else if (cur === "PKR") currencyTotals.PKR += amt;
    else if (cur === "GBP") currencyTotals.GBP += amt;
    else if (cur === "CNY") currencyTotals.CNY += amt;
    else currencyTotals.OTHERS += amt;
  });

  // Branch & Country Breakdown for Row 2 Right Panel
  const branchSummaries = useMemo(() => {
    const map: Record<string, { branchCode: string; countryCode: string; finalCurrency: string; totalEntries: number; finalAmount: number; finalAdvanceAmount: number }> = {};

    (rows || []).forEach((r) => {
      const bName = rowBranchName(r) || "â";
      const cName = rowCountryName(r) || "â";
      const bCode = (r.audit?.branchCode || r.form_data?.form?.branchCode || (bName || "â")).toUpperCase();
      const cCode = getCountryCode(cName) || cName.toUpperCase();
      const fCur = rowOfficeCurrency(r) || "AED";
      const calcs = resolvePurchaseCalculations(r);

      const key = `${bCode}::${cCode}::${fCur}`;
      if (!map[key]) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
        map[key] = {
          branchCode: bCode,
          countryCode: cCode,
          finalCurrency: fCur,
          totalEntries: 0,
          finalAmount: 0,
          finalAdvanceAmount: 0
        };
      }
      map[key].totalEntries += 1;
      map[key].finalAmount += calcs.totalPurchaseLC;
      map[key].finalAdvanceAmount += calcs.advanceAmountLC;
    });

    return Object.values(map);
  }, [rows]);

  const totalBranchEntries = branchSummaries.reduce((sum, b) => sum + b.totalEntries, 0);
  const totalBranchAmount = branchSummaries.reduce((sum, b) => sum + b.finalAmount, 0);
  const totalBranchAdvance = branchSummaries.reduce((sum, b) => sum + b.finalAdvanceAmount, 0);

  return (
    <div className="flex flex-col mb-4 space-y-3">
      {/* ââ ROW 1: 4 HEADER STATS CARDS ââ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        
        {/* Card 1: Branch & User Details */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Users className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("BRANCH & USER DETAILS")}
              </h4>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Country Code")}</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="text-sm">ð¦ðª</span> {tData(adminCountry, lang)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Branch Code")}</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono font-bold text-[11px]">
                  {tData(adminBranch, lang)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("User")}</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]" title={`${adminUserName} (${adminRole})`}>
                  {tData(adminUserName, lang)} <span className="text-slate-500 font-normal">({t(adminRole, lang)})</span>
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
              {th("Active")}
            </span>
          </div>
        </div>

        {/* Card 2: Global Financial Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                <DollarSign className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("GLOBAL FINANCIAL SUMMARY")} ({summary.localCurrency || "AED"})
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">{th("TOTAL ENTRIES")}</span>
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {totalGlobalEntries || 6}
                </div>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">{th("All Countries Entry")}</span>
              </div>

              <div>
                <span className="block text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400">{th("Date Range")}</span>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {minDateStr}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{th("To")}</div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  {maxDateStr}
                  <Calendar className="h-3 w-3 text-slate-400 inline" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span className="hover:underline cursor-pointer">{th("All Countries")}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="hover:underline cursor-pointer">{th("All Currencies")}</span>
          </div>
        </div>

        {/* Card 3: Bill Entries Summary */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                <FileText className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("BILL ENTRIES SUMMARY")}
              </h4>
            </div>

            <div className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Total Bill Entries")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{totalGlobalEntries || 6}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Transferred to Ledger")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{transferredEntries || 6}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Transferred to Building")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{transferredEntries || 6}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{th("Remaining Advance Balance")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{remainingEntries || 0}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">{th("System Status")}</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
              {th("All Completed")}
            </span>
          </div>
        </div>

        {/* Card 4: All Countries Report */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Globe className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("ALL COUNTRIES REPORT")}
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">{th("All Countries Summary")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{activeCountriesCount || summaryRows.length || 6}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowAllCountries(!showAllCountries)}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 uppercase tracking-wide cursor-pointer"
              >
                <span>{th("Show Report Details")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAllCountries(!showAllCountries)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>{th("View All")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ââ ROW 2: 2 WIDE CARDS (50% / 50%) ââ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left Card: Currency Wise Sales Total (Original Currency) - 6 cols */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-emerald-600/10 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Coins className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("Currency Wise Sales Total")} <span className="text-slate-500 font-normal text-[10px]">({th("Original Currency")})</span>
              </h4>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {["USD", "EUR", "PKR", "GBP", "CNY", "OTHERS"].map((curKey) => (
                <div key={curKey} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">{curKey === "OTHERS" ? th("Others") : curKey}</span>
                  <span className="block font-mono font-black text-xs text-slate-900 dark:text-white">
                    {(currencyTotals[curKey] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {th("Note: Sales amounts are shown in original currencies. Do not mix different currencies.")}
          </div>
        </div>

        {/* Right Card: Branch / Country Wise Summary (Final Currency) - 6 cols */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-md bg-amber-500/10 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center font-bold">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("Branch / Country Wise Summary")} <span className="text-slate-500 font-normal text-[10px]">({th("Final Currency")})</span>
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10.5px] border-collapse font-sans">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 text-[9px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                    <th className="py-1 px-1.5">{th("Branch Code")}</th>
                    <th className="py-1 px-1.5">{th("Country Code")}</th>
                    <th className="py-1 px-1.5">{th("Final Currency")}</th>
                    <th className="py-1 px-1.5 text-center">{th("Total Entries")}</th>
                    <th className="py-1 px-1.5 text-right">{th("Final Amount")}</th>
                    <th className="py-1 px-1.5 text-right">{th("Final Advance Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                  {branchSummaries.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                      <td className="py-1 px-1.5 font-bold font-mono">{b.branchCode}</td>
                      <td className="py-1 px-1.5 font-bold">{b.countryCode}</td>
                      <td className="py-1 px-1.5 font-mono">{b.finalCurrency}</td>
                      <td className="py-1 px-1.5 text-center font-mono">{b.totalEntries}</td>
                      <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {b.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-1.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {b.finalAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 dark:border-slate-800 font-black text-slate-900 dark:text-white">
                    <td className="py-1 px-1.5 uppercase font-bold" colSpan={3}>{th("Total")}</td>
                    <td className="py-1 px-1.5 text-center font-mono">{totalBranchEntries}</td>
                    <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {totalBranchAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {totalBranchAdvance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-2 pt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {th("Note: Final amounts are converted into branch final currency")} ({summary.localCurrency || "AED"}).
          </div>
        </div>
      </div>

      {/* Collapsible Country Dashboard Section Content if clicked */}
      {showAllCountries && (
        <div className="country-accordion-content block animate-in slide-in-from-top-2 fade-in duration-300 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryRows.map((r, idx) => (
              <div key={idx} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-black text-[11px] uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {getFlag(r.country)} {tData(r.country, lang)}
                  </span>
                  <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    {r.branches.length} {th("Branches")}
                  </span>
                </div>
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{th("Currency")}</span>
                    <span className="font-bold">{r.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{th("Total Sales")}</span>
                    <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{formatMoney(r.purchase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{th("Paid Advance")}</span>
                    <span className="font-bold font-mono text-emerald-600">{formatMoney(r.paidAdvance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 font-bold">
                    <span>{th("Remaining Balance")}</span>
                    <span className="font-mono text-slate-900 dark:text-white">{formatMoney(r.remainingDue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SALES_ORDER_TABLE_HEADERS: Record<string, Record<LanguageCode, string>> = {
  "PO Number": { en: "PO Number", ur: "Ø¢Ø±ÚØ± ÙÙØ¨Ø±", ar: "Ø±ÙÙ Ø·ÙØ¨ Ø§ÙØ´Ø±Ø§Ø¡", fa: "Ø´ÙØ§Ø±Ù Ø³ÙØ§Ø±Ø´", ps: "Ø¯ Ø§ÙØ± Ø´ÙÛØ±Ù" },
  "Bill / Date": { en: "Bill & Date", ur: "Ø¨Ù Ø§ÙØ± ØªØ§Ø±ÛØ®", ar: "Ø§ÙÙØ§ØªÙØ±Ø© ÙØ§ÙØªØ§Ø±ÙØ®", fa: "ØµÙØ±ØªØ­Ø³Ø§Ø¨ Ù ØªØ§Ø±ÛØ®", ps: "Ø¨Ù Ø§Ù ÙÛÙ¼Ù" },
  "Branch / Country": { en: "Branch & Country", ur: "Ø¨Ø±Ø§ÙÚ Ø§ÙØ± ÙÙÚ©", ar: "Ø§ÙÙØ±Ø¹ ÙØ§ÙØ¨ÙØ¯", fa: "Ø´Ø¹Ø¨Ù Ù Ú©Ø´ÙØ±", ps: "ÚØ§ÙÚ«Ù Ø§Ù ÙÛÙØ§Ø¯" },
  "Purchase Amount": { en: "Purchase Amount", ur: "Ú©Ù Ø®Ø±ÛØ¯Ø§Ø±Û", ar: "ÙÙÙØ© Ø§ÙÙØ´ØªØ±ÙØ§Øª", fa: "ÙØ¨ÙØº Ø®Ø±ÛØ¯", ps: "Ø¯ Ù¾ÛØ±ÙØ¯ÙÙ ÙÛÙØª" },
  "Invoice %": { en: "Invoice %", ur: "Ø§ÛÚÙØ§ÙØ³ ÙÛØµØ¯", ar: "ÙØ³Ø¨Ø© Ø§ÙØ¯ÙØ¹Ø© Ø§ÙÙÙØ¯ÙØ©", fa: "Ø¯Ø±ØµØ¯ Ù¾ÛØ´ Ù¾Ø±Ø¯Ø§Ø®Øª", ps: "Ø¯ Ù¾Ø±ÙØ®ØªÚ« Ø³ÙÙÙ" },
  "Invoice Amount": { en: "Invoice Amount", ur: "Ø§ÛÚÙØ§ÙØ³ Ø±ÙÙ", ar: "ÙØ¨ÙØº Ø§ÙØ¯ÙØ¹Ø© Ø§ÙÙÙØ¯ÙØ©", fa: "ÙØ¨ÙØº Ù¾ÛØ´ Ù¾Ø±Ø¯Ø§Ø®Øª", ps: "Ø¯ Ù¾Ø±ÙØ®ØªÚ« Ø±ÙÙ" },
  "Remaining Purchase": { en: "Remaining Purchase", ur: "Ø¨ÙØ§ÛØ§ Ø±ÙÙ", ar: "Ø§ÙÙØ¨ÙØº Ø§ÙÙØªØ¨ÙÙ", fa: "ÙØ¨ÙØº Ø¨Ø§ÙÛÙØ§ÙØ¯Ù", ps: "Ù¾Ø§ØªÛ Ø±ÙÙ" },
  "Exchange Rate": { en: "Exchange Rate", ur: "Ø´Ø±Ø­ ØªØ¨Ø§Ø¯ÙÛ", ar: "Ø³Ø¹Ø± Ø§ÙØµØ±Ù", fa: "ÙØ±Ø® Ø§Ø±Ø²", ps: "Ø¯ ØªØ¨Ø§Ø¯ÙÛ ÙØ±Ø®" },
  "Local Currency Amount": { en: "Local Currency Amount", ur: "ÙÙØ§ÙÛ Ú©Ø±ÙØ³Û Ø±ÙÙ", ar: "Ø§ÙÙØ¨ÙØº Ø¨Ø§ÙØ¹ÙÙØ© Ø§ÙÙØ­ÙÙØ©", fa: "ÙØ¨ÙØº Ø§Ø±Ø² ÙØ­ÙÛ", ps: "Ø¯ ÚØ§ÛÛ Ø§Ø³Ø¹Ø§Ø±Ù ÙÙØ¯Ø§Ø±" },
  "Local Currency Advance": { en: "Local Currency Advance", ur: "ÙÙØ§ÙÛ Ú©Ø±ÙØ³Û Ø§ÛÚÙØ§ÙØ³", ar: "Ø§ÙØ¯ÙØ¹Ø© Ø§ÙÙÙØ¯ÙØ© Ø¨Ø§ÙØ¹ÙÙØ© Ø§ÙÙØ­ÙÙØ©", fa: "Ù¾ÛØ´ Ù¾Ø±Ø¯Ø§Ø®Øª Ø§Ø±Ø² ÙØ­ÙÛ", ps: "Ø¯ ÚØ§ÛÛ Ø§Ø³Ø¹Ø§Ø±Ù Ù¾Ø±ÙØ®ØªÚ«" },
  "Remaining Local Currency": { en: "Remaining Local Currency", ur: "Ø¨ÙØ§ÛØ§ ÙÙØ§ÙÛ Ú©Ø±ÙØ³Û", ar: "Ø§ÙÙØªØ¨ÙÙ Ø¨Ø§ÙØ¹ÙÙØ© Ø§ÙÙØ­ÙÙØ©", fa: "Ø¨Ø§ÙÛÙØ§ÙØ¯Ù Ø§Ø±Ø² ÙØ­ÙÛ", ps: "Ù¾Ø§ØªÛ ÚØ§ÛÛ Ø§Ø³Ø¹Ø§Ø±" },
  "Payment Status": { en: "Payment Status", ur: "Ø§Ø¯Ø§Ø¦ÛÚ¯Û Ú©Û ØµÙØ±ØªØ­Ø§Ù", ar: "Ø­Ø§ÙØ© Ø§ÙØ¯ÙØ¹", fa: "ÙØ¶Ø¹ÛØª Ù¾Ø±Ø¯Ø§Ø®Øª", ps: "Ø¯ ØªØ§Ø¯ÛÛ Ø­Ø§ÙØª" },
  "Action": { en: "Action", ur: "Ø¹ÙÙ", ar: "Ø¥Ø¬Ø±Ø§Ø¡", fa: "Ø¹ÙÙ", ps: "Ø¹ÙÙ" }
};
function getSalesOrderTableHeader(h: string, currentLanguage: LanguageCode): string {
  return SALES_ORDER_TABLE_HEADERS[h]?.[currentLanguage] || h;
}

export function SalesOrderPaymentJournal({ mode = "advance" }: { mode?: PaymentMode }) {
  const router = useRouter();
  const activeMode: PaymentMode = mode === "charges" ? "credit" : mode;
  const logClientError = (msg: string) => {
    fetch("/api/erp/sales/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientLog: msg })
    }).catch(() => {});
  };
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const selectOrder = (id: string) => {
    setSelectedId(id);
    setTimeout(() => {
      const el = document.getElementById("ledger-cash-entry-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 250);
  };
  const [query, setQuery] = useState("");
  const [draftFilter, setDraftFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState<any>(null);
  const [reportNow, setReportNow] = useState<{ date: string; time: string } | null>(null);
  const [liveRates, setLiveRates] = useState<any[]>([]);

  // Super Admin Filtering for Source Ledger
  const [saCountryId, setSaCountryId] = useState<string>("");
  const [saBranchId, setSaBranchId] = useState<string>("");
  const [saCountries, setSaCountries] = useState<any[]>([]);
  const [saBranches, setSaBranches] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadSaFilters() {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/branch-management/countries"),
          fetch("/api/branch-management/city-branches?limit=1000")
        ]);
        if (cRes.ok && bRes.ok) {
          const cData = await cRes.json();
          const bData = await bRes.json();
          if (!cancelled) {
            setSaCountries(cData.countries || []);
            setSaBranches(bData.cityBranches || []);
          }
        }
      } catch (err) {
        console.error("Failed to load SA filters", err);
      }
    }
    loadSaFilters();
    return () => { cancelled = true; };
  }, []);

  // Redesign state hooks
  const [viewingRow, setViewingRow] = useState<PurchaseOrderRow | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [selectedCountryForSummary, setSelectedCountryForSummary] = useState<string | null>(null);
  
  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<{payment: any, row: any} | null>(null);

  useEffect(() => {
    const handleOpenEdit = (e: any) => {
      setEditingPayment(e.detail);
    };
    window.addEventListener("open-edit-payment", handleOpenEdit);
    return () => window.removeEventListener("open-edit-payment", handleOpenEdit);
  }, []);

  const handleOpenA4PDF = async (row: PurchaseOrderRow, autoPrint = false) => {
    const form = row.form_data?.form || {};
    const goods = row.form_data?.goodsEntries || [];
    const totals = row.form_data?.totals || {};

    let paymentHistory: any[] = [];
    try {
      const response = await fetch(`/api/erp/sales/orders/${row.id}/payments?lang=${currentLanguage}`, { credentials: "include" });
      const body = await response.json();
      if (body?.ok && body.data?.payments) {
        paymentHistory = body.data.payments.filter((p: any) => !p.narration?.toLowerCase().includes("initial booking transfer"));
      }
    } catch (err) {
      console.error("Failed to load nested payments for statement:", err);
    }

    const purchaseData: PurchaseReportData = {
      id: row.id,
      purchaseBookingOrderNumber: row.sales_order_no,
      purchaseDate: form.purchaseDate || row.created_at || "",
      bookingDate: form.bookingDate || form.purchaseDate || row.created_at || "",
      purchaseAccountName: form.purchaseAccountName || "â",
      purchaseAccountNumber: form.purchaseAccountNo || "",
      salesAccountName: form.salesAccountName || "â",
      salesAccountNumber: form.salesAccountNo || "",
      supplierName: form.salesAccountName || "N/A",
      buyerName: form.purchaseAccountName || "N/A",
      productName: goods.map((g: any) => g.goodsName).filter(Boolean).join(", ") || form.goodsName || "N/A",
      goodsDescription: form.orderReportRemarks || "",
      quantity: goods.length ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || 0), 0) : Number(form.qtyNo || 0),
      unit: goods[0]?.qtyName || form.qtyName || "BAGS",
      totalWeight: goods.length ? goods.reduce((sum: number, g: any) => sum + Number(g.netWeight || 0), 0) : Number(form.netWeight || 0),
      containerCount: Number(form.containersCount || form.containerCount || 1),
      purchaseRate: goods.length ? (goods.reduce((sum: number, g: any) => sum + Number(g.coursePrice || 0), 0) / goods.length) : Number(form.coursePrice || 0),
      totalPurchaseAmount: goods.length ? goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0) : Number(form.totalAmount || 0),
      currency: row.currency_code || "USD",
      status: row.payment_status || "Pending",
      paymentStatus: row.payment_status || "Pending",
      branchName: rowBranchName(row) || form.purchaseAccountBranch || "â",
      countryName: rowCountryName(row) || form.loadingCountry || "N/A",
      createdAt: row.created_at || "",
      form_data: row.form_data || {},
      paymentHistory,
      finalCurrency: rowOfficeCurrency(row),
      audit: {
        userName: row.audit?.userName || session?.name || session?.username || "—",
        userId: row.audit?.userId || session?.id || "USR-1001",
        branchCode: row.audit?.branchCode || form.branchCode || "QTA-01"
      }
    };

    openPurchaseA4ReportWindow({
      title: t("verification_report_title", currentLanguage),
      purchaseData,
      autoPrint,
      lang: "en"
    });
  };

  // Ledger Entry Panel state
  const [paymentSourceLedgerId, setPaymentSourceLedgerId] = useState("");
  const [roznamchaType, setRoznamchaType] = useState("Cash Book No.");
  const [roznamchaNumber, setRoznamchaNumber] = useState("000123");
  const [paymentType, setPaymentType] = useState<"" | "bank" | "business" | "invoice" | "cash" | "transfer">("");
  const [currency, setCurrency] = useState("USD");
  const [calcAmount, setCalcAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [calcOp, setCalcOp] = useState<"mul" | "div">("mul");
  const [finalPayment, setFinalPayment] = useState("");
  const [remarks, setRemarks] = useState("");
  const [typeDetails, setTypeDetails] = useState<Record<string, string>>({});
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  // Container state moved below 'selected' declaration to prevent ReferenceError

  // Local cache for Bank/Method quick add
  const [savedBanks, setSavedBanks] = useState<SavedBankItem[]>([]);
  const [savedMethods, setSavedMethods] = useState<string[]>([]);
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [addOptionType, setAddOptionType] = useState<"bank" | "method">("bank");
  const [activeTab, setActiveTab] = useState<"remaining" | "advance" | "history">("advance");
  const [isOrderDetailsExpanded, setIsOrderDetailsExpanded] = useState<boolean>(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [titleSlot, setTitleSlot] = useState<Element | null>(null);
  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);
  // Follows the single, app-wide active language (top toolbar selector) instead of its
  // own disconnected state â this page previously had its own separate, broken language
  // dropdown (corrupted-encoding option labels) that never reflected the real selection.
  const currentLanguage = useActiveLanguage() as LanguageCode;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(currentLanguage);

  useEffect(() => {
    const titleEl = document.getElementById("erp-page-title-slot");
    const actionsEl = document.getElementById("erp-page-actions-slot");
    if (titleEl) setTitleSlot(titleEl);
    if (actionsEl) setActionsSlot(actionsEl);

    if (titleEl && actionsEl) return;

    const timer = setInterval(() => {
      const t = document.getElementById("erp-page-title-slot");
      const a = document.getElementById("erp-page-actions-slot");
      if (t) setTitleSlot(t);
      if (a) setActionsSlot(a);
      if (t && a) clearInterval(timer);
    }, 50);

    return () => clearInterval(timer);
  }, []);

  const [addOptionValue, setAddOptionValue] = useState("");
  const [addOptionAddress, setAddOptionAddress] = useState("");

  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [selectedOrderPayments, setSelectedOrderPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [viewingRowPayments, setViewingRowPayments] = useState<any[]>([]);
  const [loadingViewingRowPayments, setLoadingViewingRowPayments] = useState(false);
  const [showModalHistory, setShowModalHistory] = useState(false);
  // Stable per-payment-attempt key so a genuine double submission (double-click, network retry)
  // replays against the same server-side idempotency lock instead of posting twice.
  const paymentIdempotencyKeyRef = React.useRef<string>("");

  useEffect(() => {
    paymentIdempotencyKeyRef.current = "";
    if (!selectedId) {
      setSelectedOrderPayments([]);
      setShowModalHistory(false);
      return;
    }
    let cancelled = false;
    async function fetchPayments() {
      setLoadingPayments(true);
      try {
        const response = await fetch(`/api/erp/sales/orders/${selectedId}/payments?lang=${currentLanguage}`, { credentials: "include" });
        const body = await response.json();
        if (body?.ok && body.data?.payments && !cancelled) {
          setSelectedOrderPayments(body.data.payments);
        }
      } catch (err) {
        console.error("Failed to load payments for selected order:", err);
      } finally {
        if (!cancelled) setLoadingPayments(false);
      }
    }
    void fetchPayments();
    return () => { cancelled = true; };
  }, [selectedId, currentLanguage]);
  useEffect(() => {
    if (!viewingRow?.id) {
      setViewingRowPayments([]);
      return;
    }
    const viewingRowId = viewingRow.id;
    let cancelled = false;
    async function fetchViewingPayments() {
      setLoadingViewingRowPayments(true);
      try {
        const response = await fetch(`/api/erp/sales/orders/${viewingRowId}/payments?lang=${currentLanguage}`, { credentials: "include" });
        const body = await response.json();
        if (body?.ok && body.data?.payments && !cancelled) {
          setViewingRowPayments(body.data.payments.filter((p: any) => !p.narration?.toLowerCase().includes("initial booking transfer")));
        }
      } catch (err) {
        console.error("Failed to load full bill payment history:", err);
      } finally {
        if (!cancelled) setLoadingViewingRowPayments(false);
      }
    }
    void fetchViewingPayments();
    return () => { cancelled = true; };
  }, [viewingRow?.id, currentLanguage]);


  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const response = await fetch("/api/erp/auth/session", { credentials: "include" });
        const body = await response.json();
        if (body?.ok && !cancelled) setSession(body.data);
      } catch (err) { console.error("Session load error:", err); }
    }
    fetchSession();
    return () => { cancelled = true; };
  }, []);

  const [ledgers, setLedgers] = useState<any[]>([]);
  const isSuperAdmin = useMemo(() => session ? (session.scopes?.isSuperAdmin || session.roles?.includes("super_admin")) : true, [session]);
  const selectedOrderForLedger = useMemo(
    () => selectedId ? orders.find((row) => row.id === selectedId) ?? null : null,
    [orders, selectedId]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchLedgers() {
      try {
        const { listLedgerReportLedgers } = await import("@/features/reports/ledger-report/ledger-report-api");
        const scopedCountryId = selectedOrderForLedger?.country_id ?? (session?.scopes?.countryIds?.[0] || session?.countryId || null);
        const scopedCountryBranchId = selectedOrderForLedger?.country_branch_id ?? null;
        const scopedCityBranchId = selectedOrderForLedger?.city_branch_id ?? (session?.scopes?.cityBranchIds?.[0] || session?.cityBranchId || null);
        
        const res = await listLedgerReportLedgers({
          reportScope: scopedCityBranchId ? "branch" : scopedCountryId ? "country" : "super_admin",
          countryId: scopedCountryId,
          countryBranchId: scopedCountryBranchId,
          cityBranchId: scopedCityBranchId,
          limit: 1000
        });
        if (!cancelled) {
          setLedgers(Array.isArray(res.ledgers) ? res.ledgers : []);
        }
      } catch (err) {
        console.error("Ledger load error:", err);
      }
    }
    fetchLedgers();
    return () => { cancelled = true; };
  }, [session, selectedOrderForLedger?.country_id, selectedOrderForLedger?.country_branch_id, selectedOrderForLedger?.city_branch_id]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRates() {
      try {
        const res = await fetch("/api/erp/currency/monitoring?limit=100");
        const body = await res.json();
        if (!cancelled && body?.countries) {
          setLiveRates(body.countries);
        }
      } catch (e) {
        console.error("Failed to load live currency rates", e);
      }
    }
    fetchRates();
    return () => { cancelled = true; };
  }, []);

  const getEffectiveRate = React.useCallback((row: any) => {
    const countryName = rowCountryName(row) || "";
    const countryId = row.country_id;
    const rateData = liveRates.find((c: any) => 
      c.countryId === countryId || 
      (c.countryName && countryName && c.countryName.toLowerCase() === countryName.toLowerCase())
    );
    if (rateData) {
       const live = rateData.latestSellRate || rateData.latestDebitRate || rateData.latestBuyRate || rateData.latestCreditRate;
       if (live && live > 0) return live;
    }
    const form = row.form_data?.form || {};
    return row.exchange_rate || form.exchangeRate || 1;
  }, [liveRates]);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/erp/sales/orders?limit=200", { cache: "no-store", credentials: "include" });
      const body = await response.json();
      if (!response.ok || body?.ok === false) throw new Error(body?.error?.message ?? body?.message ?? "Unable to load sales orders.");
      const payload = (body?.data ?? body) as OrdersPayload | PurchaseOrderRow[];
      // The API actually returns { data: { salesOrders: [...] } } (see app/api/erp/sales/orders
      // route.ts) â this previously read payload.orders, a key that has never existed on the
      // sales response, so `rows` silently resolved to [] on every load and every mode
      // (Advance/Remaining/Credit/History) always rendered "0 records" regardless of real data.
      const rows: PurchaseOrderRow[] = Array.isArray(payload)
        ? payload
        : (payload as any).salesOrders ?? (payload as any).orders ?? [];
      setOrders(rows);
      // Auto-select by URL param
      const urlOrderNo = getInitialPurchaseOrderNo();
      if (urlOrderNo) {
        const match = rows.find((r) => r.sales_order_no === urlOrderNo);
        if (match) setSelectedId(match.id);
      }
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Unable to load sales order payment records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const now = new Date();
    setReportNow({
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(),
      time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toUpperCase()
    });
  }, []);
  
  useEffect(() => {
    setPageIndex(0);
  }, [activeMode]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const draft = draftFilter.trim().toLowerCase();
    const urlOrderNo = getInitialPurchaseOrderNo();
    return orders.filter((row) => {
      if (urlOrderNo && row.sales_order_no === urlOrderNo) return true;
      const postingStatus = row.ledger_posting_status?.toLowerCase();
      const workflowTransferStatus = row.form_data?.workflow?.transferStatus?.toLowerCase();
      const hasTransferAudit = Boolean(row.form_data?.form?.transferAudit);
      const isPosted = row.status === "Posted"
        || row.status?.toLowerCase() === "posted"
        || postingStatus === "posted"
        || postingStatus === "transferred"
        || workflowTransferStatus === "transferred"
        || hasTransferAudit
        || row.form_data?.workflow?.journalStatus === "Posted"
        || row.form_data?.workflow?.journalStatus?.toLowerCase() === "posted"
        || (row as any).journalStatus?.toLowerCase() === "posted";
      const isEligibleForPayment = isPosted;
      if (!isEligibleForPayment) return false;
      if (draft && !(row.payment_status ?? "").toLowerCase().includes(draft)) return false;
      if (countryFilter && rowCountryName(row) !== countryFilter) return false;
      if (branchFilter && rowBranchName(row) !== branchFilter) return false;
      if (currencyFilter && rowCurrency(row) !== currencyFilter) return false;

      const form = row.form_data?.form || {};
      if (startDateFilter) {
        const rowDate = new Date(row.created_at || form.purchaseDate || form.bookingDate || "");
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (Number.isNaN(rowDate.getTime()) || rowDate < start) return false;
      }
      if (endDateFilter) {
        const rowDate = new Date(row.created_at || form.purchaseDate || form.bookingDate || "");
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (Number.isNaN(rowDate.getTime()) || rowDate > end) return false;
      }

      // Extract form values for clearance calculation.
      // sales_orders has no advance_paid/remaining_due/remaining_paid columns (those are
      // purchase_orders-only field names â this whole block was copy-pasted from the purchase
      // journal without adapting to the sales schema, so every eligibility check below always
      // read undefined/0 and treated every order as if nothing had ever been paid). The real,
      // always-populated columns are paid_amount (total across every payment kind) and
      // remaining_amount (kept in sync by recalc_sales_order_payment_totals on every posting).
      const finalAmount = orderTotal(row);
      const advancePercent = Number(form.advancePercent || 0);
      const requiredAdvance = (finalAmount * advancePercent) / 100;
      const totalPaid = Number((row as any).paid_amount || 0);
      const paidAdvance = Math.min(requiredAdvance, totalPaid);
      const remainingAdvance = requiredAdvance - paidAdvance;
      const remainingDue = Number((row as any).remaining_amount ?? (finalAmount - totalPaid));

      const isCreditPaid = (row.payment_status || "").toLowerCase().includes("posted") || 
                           (row.payment_status || "").toLowerCase().includes("paid");

      const isAdvanceCleared = advancePercent > 0 ? remainingAdvance <= 0.01 : paidAdvance > 0;
      const isRemainingCleared = remainingDue <= 0.01;

      if (activeMode === "advance") {
        // Show all pending POs even if advancePercent is 0, so users can make manual advance payments
        const isFullyPaid = (row.payment_status || "").toLowerCase() === "paid" || (row.payment_status || "").toLowerCase() === "completed";
        if (isFullyPaid) return false;
        
        if (advancePercent > 0 && remainingAdvance <= 0.01) return false; // Already cleared required advance

      } else if (activeMode === "advance_completed") {
        if (advancePercent === 0) return false;
        if (remainingAdvance > 0.01) return false; // Not yet cleared
        if (paidAdvance <= 0) return false; // Not paid anything
      } else if (activeMode === "remaining") {
        // Required advance must be fully cleared first before appearing in remaining payments
        if (advancePercent > 0 && remainingAdvance > 0.01) return false;
        if (remainingDue <= 0.01) return false; // Already cleared

        // NOTE: sales orders have no loading/container-transfer stage (that's a Country
        // Purchase concept â sales_loading_records doesn't exist in this schema), so unlike
        // the purchase side there is no "must be transferred to loading first" gate here. The
        // advance-cleared + remaining-due checks above are the correct, sufficient eligibility
        // rule for a domestic sales order's remaining payment.
      } else if (activeMode === "credit") {
        if (isCreditPaid) return false; // Already cleared
      } else if (activeMode === "history") {
        // Show in history if fully cleared
        const isFullyCleared = (advancePercent > 0 ? isAdvanceCleared : true) && isRemainingCleared;
        if (!isFullyCleared && !isCreditPaid) return false;
      }

      if (!needle) return true;
      const supplierName = form.salesAccountName || form.supplierName || "";
      const supplierCode = form.salesAccountNo || "";
      const customerName = form.customerName || form.buyerName || "";
      const goodsName = form.goodsName || form.productName || "";
      const containerNo = form.containerNo || form.containerNumber || "";
      return [
        row.sales_order_no,
        row.sales_contract_no,
        form.manualBillNo,
        form.manual_bill_no,
        form.manualBillNumber,
        form.billNo,
        form.invoiceNo,
        form.invoiceNumber,
        form.salesContractNo,
        row.payment_status,
        row.currency_code,
        row.currency,
        row.createdByName,
        form.userName,
        supplierName,
        supplierCode,
        customerName,
        goodsName,
        containerNo,
        rowCountryName(row),
        rowBranchName(row)
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [activeMode, branchFilter, countryFilter, currencyFilter, draftFilter, orders, query, startDateFilter, endDateFilter]);

  const selected = selectedId ? (filtered.find((row) => row.id === selectedId) ?? null) : null;

  // Container Selection local state (moved here to allow access to 'selected' initialization)
  const [selectedLoadingRecord, setSelectedLoadingRecord] = useState<any>(null);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [loadingLoadingRecords, setLoadingLoadingRecords] = useState(false);

  // Compute PO metrics at the component level to avoid ReferenceErrors in summary sidebar
  const orderDetails = useMemo(() => {
    if (!selected) {
      return {
        fromLoading: false,
        loadingPurchaseAmount: 0,
        loadingRequiredAdvance: 0,
        totalPaidSoFar: 0,
        outstandingBalance: 0,
        poCurrency: "USD",
        exRate: 1,
        isAdvComplete: false,
        isFullyPaid: false,
        loadingAdvancePaid: 0,
        loadingRemainingAdvance: 0,
        finalPurchaseAmount: 0,
        totalRemainingAmount: 0,
        paidPercent: 0,
        advancePaidPercent: 0
      };
    }

    const form = selected.form_data?.form || {};
    const goods = selected.form_data?.goodsEntries || [];
    const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const isUrlLoading = searchParams.get("fromLoading") === "true";
    const fromLoading = isUrlLoading || Boolean(selectedLoadingRecord);

    const cLoadedQty = selectedLoadingRecord
      ? Number(selectedLoadingRecord.report_payload?.loadedQuantity || selectedLoadingRecord.loadedQuantity || 0)
      : Number(searchParams.get("loadedQty") || 0);
    const cGrossWeight = selectedLoadingRecord
      ? Number(selectedLoadingRecord.report_payload?.grossWeight || 0)
      : Number(searchParams.get("grossWeight") || 0);
    const cNetWeight = selectedLoadingRecord
      ? Number(selectedLoadingRecord.report_payload?.netWeight || 0)
      : Number(searchParams.get("netWeight") || 0);
    const cPriceRate = selectedLoadingRecord
      ? Number(selectedLoadingRecord.report_payload?.priceRateC1 || 0)
      : Number(searchParams.get("priceRate") || 0);
    const cLoadingRecordId = selectedLoadingRecord
      ? selectedLoadingRecord.id
      : (searchParams.get("loadingRecordId") || "");

    const totalPrice = goods.length
      ? goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
      : Number(form.totalAmount || 0);
    const poOrderTotal = Number(selected.order_total || totalPrice || 0);
    const totalPOQuantity = Number(
      selected.form_data?.totals?.totalQuantity ||
      goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
      form.quantity ||
      1
    );
    const advancePercent = Number(form.advancePercent || 0);

    // Resolve price type: is it weight-based?
    const firstGood = goods[0] || {};
    const isPerKg = firstGood.priceType === "P/KGs" || String(firstGood.priceType || "").toLowerCase().includes("kg");

    // Purchase Amount for this loading only
    const loadingPurchaseAmount = fromLoading
      ? (isPerKg ? cNetWeight * cPriceRate : cLoadedQty * cPriceRate)
      : poOrderTotal;

    // Required Advance allocated to this loading
    const loadingRequiredAdvance = (loadingPurchaseAmount * advancePercent) / 100;

    // Advance already paid for this loading: pro-rated share of actual advance paid on the PO
    const poAdvancePaid = Number(selected.paid_amount || 0);
    const loadingAdvancePaid = fromLoading
      ? (totalPOQuantity > 0 ? (cLoadedQty / totalPOQuantity) * poAdvancePaid : poAdvancePaid)
      : poAdvancePaid;

    // Remaining Advance for this loading
    const loadingRemainingAdvance = Math.max(0, loadingRequiredAdvance - loadingAdvancePaid);

    // Final Purchase Amount
    const finalPurchaseAmount = loadingPurchaseAmount;

    // Total Remaining Amount (which is Final Purchase Amount - Advance deducted/allocated)
    const totalRemainingAmount = Math.max(0, finalPurchaseAmount - loadingAdvancePaid);

    // Total Remaining Paid (specifically for this loading)
    const remainingPaymentsForThisLoading = selectedOrderPayments.filter((p: any) => {
      const payKind = p.kind || "";
      if (payKind !== "remaining") return false;
      if (!fromLoading) return true; // if not from loading, sum all remaining payments
      const payRecordId = p.typeDetails?.loadingRecordId || p.typeDetails?.loading_record_id || "";
      return payRecordId === cLoadingRecordId;
    });
    const totalRemainingPaid = remainingPaymentsForThisLoading.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Outstanding Balance (Final Currency Balance remaining)
    const outstandingBalance = Math.max(0, finalPurchaseAmount - loadingAdvancePaid - totalRemainingPaid);

    const totalPaidSoFar = loadingAdvancePaid + totalRemainingPaid;
    const paidPercent = finalPurchaseAmount > 0 ? Math.min(100, (totalPaidSoFar / finalPurchaseAmount) * 100) : 0;
    const advancePaidPercent = loadingRequiredAdvance > 0 ? Math.min(100, (loadingAdvancePaid / loadingRequiredAdvance) * 100) : 0;

    const exRate = selected.exchange_rate || 1;
    const isAdvComplete = loadingRemainingAdvance <= 0.01;
    const isFullyPaid = outstandingBalance <= 0.01;

    return {
      fromLoading,
      loadingPurchaseAmount,
      loadingRequiredAdvance,
      totalPaidSoFar,
      outstandingBalance,
      exRate,
      isAdvComplete,
      isFullyPaid,
      loadingAdvancePaid,
      loadingRemainingAdvance,
      finalPurchaseAmount,
      totalRemainingAmount,
      paidPercent,
      advancePaidPercent
    };
  }, [selected, selectedLoadingRecord, selectedOrderPayments]);

  const {
    fromLoading,
    loadingPurchaseAmount,
    loadingRequiredAdvance,
    totalPaidSoFar,
    outstandingBalance,
    exRate,
    isAdvComplete,
    isFullyPaid,
    loadingAdvancePaid,
    loadingRemainingAdvance,
    finalPurchaseAmount,
    totalRemainingAmount,
    paidPercent,
    advancePaidPercent
  } = orderDetails;

  // Fetch loaded container records for Remaining Payment mode
  useEffect(() => {
    if (selected && activeMode === "remaining") {
      setLoadingLoadingRecords(true);
      fetch(`/api/erp/sales/loading-records?q=${selected.sales_order_no}`, { credentials: "include" })
        .then(res => res.json())
        .then(res => {
          if (res.ok && Array.isArray(res.data?.records)) {
            const loaded = res.data.records.filter((r: any) =>
              r.loading_status === "loaded" ||
              Number(r.report_payload?.loadedQuantity || r.loadedQuantity || 0) > 0
            );
            setLoadingRecords(loaded);
          }
        })
        .catch(err => console.error("Error loading container records:", err))
        .finally(() => setLoadingLoadingRecords(false));
    } else {
      setLoadingRecords([]);
      setSelectedLoadingRecord(null);
    }
  }, [selected, activeMode]);

  // Sync selected container if URL has fromLoading parameters
  useEffect(() => {
    if (selected && activeMode === "remaining") {
      const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const fromLoading = searchParams.get("fromLoading") === "true";
      if (fromLoading) {
        const cLoadingRecordId = searchParams.get("loadingRecordId") || "";
        const cLoadedQty = Number(searchParams.get("loadedQty") || 0);
        const cGrossWeight = Number(searchParams.get("grossWeight") || 0);
        const cNetWeight = Number(searchParams.get("netWeight") || 0);
        const cPriceRate = Number(searchParams.get("priceRate") || 0);
        
        setSelectedLoadingRecord({
          id: cLoadingRecordId,
          loading_record_no: searchParams.get("salesOrderNo") ? `Transferred Container (${searchParams.get("salesOrderNo")})` : "Transferred Container",
          report_payload: {
            loadedQuantity: cLoadedQty,
            grossWeight: cGrossWeight,
            netWeight: cNetWeight,
            priceRateC1: cPriceRate
          }
        });
      }
    }
  }, [selected, activeMode]);

  const handleSelectLoadingRecord = (lr: any) => {
    setSelectedLoadingRecord(lr);
    if (!selected) return;

    const poRow = selected || {};
    const finance = calcLoadingFinance(lr, poRow, poRow.form_data?.form || {});
    const loadedQty = lr.report_payload?.loadedQuantity || lr.loadedQuantity || 0;
    const poAdvanceAmt = Number(poRow.paid_amount || poRow.form_data?.form?.advanceAmount || 0);
    
    const goods = poRow.form_data?.goodsEntries || [];
    const totalPOQuantity = Number(
      poRow.form_data?.totals?.totalQuantity ||
      goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
      poRow.form_data?.form?.quantity ||
      1
    );

    const loadedAdvanceUSD = totalPOQuantity > 0 ? (loadedQty / totalPOQuantity) * poAdvanceAmt : poAdvanceAmt;
    const loadedRemainingUSD = Math.max(0, finance.amountUSD - loadedAdvanceUSD);
    
    const exRateVal = Number(exchangeRate || finance.exRate || 1);
    setCalcAmount(loadedRemainingUSD.toFixed(4));
    setFinalPayment((loadedRemainingUSD * exRateVal).toFixed(2));
  };

  const pageRows = useMemo(() => {
    return filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  }, [filtered, pageIndex, pageSize]);

  const countryGroups = useMemo(() => {
    const groups: Array<{ country: string; rows: PurchaseOrderRow[] }> = [];
    for (const row of pageRows) {
      const c = rowCountryName(row) || "Unknown Country";
      let group = groups.find(g => g.country === c);
      if (!group) {
        group = { country: c, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    }
    return groups;
  }, [pageRows]);

  function reset() {
    setQuery("");
    setDraftFilter("");
    setCountryFilter("");
    setBranchFilter("");
    setCurrencyFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPageIndex(0);
  }

  // Derived account info from form_data
  const selectedForm = (selected as any)?.form_data?.form || {};
  const debitAccountCode = selectedForm.purchaseAccountNo || "-";
  const debitAccountName = selectedForm.purchaseAccountName || "Purchase Account";
  const debitAccountBranch = selectedForm.purchaseAccountBranch || "-";
  const creditAccountCode = selectedForm.salesAccountNo || "-";
  const creditAccountName = selectedForm.salesAccountName || "Sales Account";
  const creditAccountBranch = selectedForm.salesAccountBranch || "-";

  const cashLedger = useMemo(() => {
    return ledgers.find((l) => ledgerCode(l) === "CASH-001") ||
           ledgers.find((l) => ledgerCode(l).toLowerCase().includes("cash") || ledgerName(l).toLowerCase().includes("cash")) ||
           ledgers.find((l) => ledgerCode(l).toLowerCase().includes("bank") || ledgerName(l).toLowerCase().includes("bank")) ||
           ledgers[0];
  }, [ledgers]);

  // Set default paymentSourceLedgerId and sync Category & Type once cashLedger is loaded
  useEffect(() => {
    if (cashLedger && !paymentSourceLedgerId) {
      setPaymentSourceLedgerId(ledgerId(cashLedger) || "");
      const name = ledgerName(cashLedger).toLowerCase();
      const code = ledgerCode(cashLedger).toLowerCase();
      if (name.includes("cash") || code.includes("cash")) {
        setPaymentType("cash");
        setRoznamchaType("Cash Book No.");
      } else {
        setPaymentType("bank");
        setRoznamchaType("Roznamcha Book No.");
      }
    }
  }, [cashLedger, paymentSourceLedgerId]);

  const selectedSourceLedger = useMemo(() => {
    return ledgers.find((l) => ledgerId(l) === paymentSourceLedgerId) || cashLedger || null;
  }, [ledgers, paymentSourceLedgerId, cashLedger]);

  const sourceBalanceText = useMemo(() => {
    if (!selectedSourceLedger) return "-";
    const bal = Number(selectedSourceLedger.current_balance ?? 0);
    return `${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ledgerCurrency(selectedSourceLedger) || "PKR"}`;
  }, [selectedSourceLedger]);

  const baseCurrency = useMemo(() => {
    if (selectedSourceLedger) {
      const ledgerCurrency = selectedSourceLedger.currency || "";
      if (ledgerCurrency) {
        return ledgerCurrency.toUpperCase();
      }
    }

    // Auto-detect from user name or roles
    const userName = (session?.user?.fullName || "").toUpperCase();
    if (userName.includes("EMIRATES") || userName.includes("DUBAI") || userName.includes("AE")) return "AED";
    if (userName.includes("AFGHANISTAN") || userName.includes("KABUL")) return "AFN";
    if (userName.includes("INDIA") || userName.includes("MUMBAI")) return "INR";
    if (userName.includes("IRAN")) return "IRR";
    if (userName.includes("US") || userName.includes("UNITED STATES")) return "USD";

    // If still nothing, check roles or session country defaults if available
    const roleStr = (session?.roles?.[0] || "").toUpperCase();
    if (roleStr.includes("EMIRATES") || roleStr.includes("DUBAI") || roleStr.includes("AE")) return "AED";

    // Only fallback to selected form if we really can't tell (e.g. super admin looking at a specific record)
    if (selectedForm) {
      const sec = selectedForm.secondaryCurrency || "";
      if (sec) return sec.replace(" - Rs", "").trim().toUpperCase();
      return (selectedForm.salesAccountCurrency || "PKR").toUpperCase();
    }

    return "PKR";
  }, [selectedSourceLedger, selectedForm, session]);

  const poCurrency = useMemo(() => {
    const form = selected?.form_data?.form || {};
    return String(
      form.currencyType ||
      form.currency ||
      selected?.currency_code ||
      selected?.form_data?.goodsEntries?.[0]?.purchaseCurrency ||
      currency ||
      "USD"
    ).toUpperCase();
  }, [selected, currency]);

  // Sync PO currency, exchange rate, and Super Admin filters when order changes
  useEffect(() => {
    if (selected) {
      const searchParams = new URLSearchParams(window.location.search);
      const urlAmount = searchParams.get("amount");
      const urlExchangeRate = searchParams.get("exchangeRate");
      const urlFinalAmount = searchParams.get("finalAmount");
      const urlAmountPKR = searchParams.get("amountPKR");
      const urlRemarks = searchParams.get("remarks");
      const urlCurrency = searchParams.get("currency");

      if (urlExchangeRate) {
        setExchangeRate(urlExchangeRate);
      } else {
        if (selected.currency_code === baseCurrency && currency === baseCurrency) {
          setExchangeRate("1");
        } else {
          const rate = String(getEffectiveRate(selected));
          setExchangeRate(rate);
        }
      }

      if (urlAmount) {
        setCalcAmount(urlAmount);
      } else {
        setCalcAmount("");
      }

      if (urlFinalAmount) {
        setFinalPayment(urlFinalAmount);
      } else if (urlAmountPKR) {
        setFinalPayment(urlAmountPKR);
      } else {
        setFinalPayment("");
      }

      if (urlRemarks) {
        setRemarks(urlRemarks);
      } else {
        setRemarks("");
      }

      if (urlCurrency) {
        setCurrency(urlCurrency.toUpperCase());
      } else {
        const poCur = selected.currency_code || "USD";
        // Auto-enforce local currency for payment
        setCurrency(baseCurrency || poCur.toUpperCase());
      }

      // Pre-populate Super Admin selectors with selected order scope
      if (isSuperAdmin) {
        setSaCountryId(selected.country_id || "");
        setSaBranchId(selected.city_branch_id || selected.country_branch_id || "");
      }
    }
  }, [selectedId, selected, baseCurrency, currency, getEffectiveRate, isSuperAdmin]);

  const cards = useMemo(() => kpis(filtered, baseCurrency, currentLanguage), [filtered, baseCurrency, currentLanguage]);
  const countryOptions = useMemo(() => Array.from(new Set(orders.map(rowCountryName))).filter(Boolean).sort(), [orders]);
  const branchOptions = useMemo(() => Array.from(new Set(orders.filter((row) => !countryFilter || rowCountryName(row) === countryFilter).map(rowBranchName))).filter(Boolean).sort(), [orders, countryFilter]);
  const currencyOptions = useMemo(() => Array.from(new Set(orders.filter((row) => !countryFilter || rowCountryName(row) === countryFilter).map(rowCurrency))).filter(Boolean).sort(), [orders, countryFilter]);

  const dashboardSummary = useMemo(() => {
    return getDashboardSummaryData(filtered, session, activeMode);
  }, [filtered, session, activeMode]);

  // Quick add saved options on mount
  useEffect(() => {
    setSavedBanks(readLocalBankList(SAVED_BANKS_KEY));
    setSavedMethods(readLocalList(SAVED_METHODS_KEY));
  }, []);

  function openAddOption(type: "bank" | "method") {
    setAddOptionType(type);
    setAddOptionValue("");
    setAddOptionAddress("");
    setAddOptionOpen(true);
  }

  function commitAddOption() {
    const val = addOptionValue.trim();
    if (!val) return;
    if (addOptionType === "bank") {
      const updated = [...savedBanks, { name: val, address: addOptionAddress.trim() }];
      setSavedBanks(updated);
      writeLocalBankList(SAVED_BANKS_KEY, updated);
      setTypeDetails((prev) => ({ ...prev, bankName: val }));
    } else {
      const updated = [...savedMethods, val];
      setSavedMethods(updated);
      writeLocalList(SAVED_METHODS_KEY, updated);
      setTypeDetails((prev) => ({ ...prev, method: val }));
    }
    setAddOptionOpen(false);
  }

  function deleteCustomMethod(method: string) {
    const updated = savedMethods.filter((m) => m !== method);
    setSavedMethods(updated);
    writeLocalList(SAVED_METHODS_KEY, updated);
    if (typeDetails.method === method) {
      setTypeDetails((p) => ({ ...p, method: "" }));
    }
  }

  function renameCustomMethod(oldVal: string, newVal: string) {
    const updated = savedMethods.map((m) => (m === oldVal ? newVal : m));
    setSavedMethods(updated);
    writeLocalList(SAVED_METHODS_KEY, updated);
    if (typeDetails.method === oldVal) {
      setTypeDetails((p) => ({ ...p, method: newVal }));
    }
  }

  // Load custom select options
  const ledgerOptions = useMemo(() => {
    // Determine the target country and branch to filter by
    const targetCountryId = selected?.country_id || session?.scopes?.countryIds?.[0] || session?.countryId || null;
    const targetCityBranchId = selected?.city_branch_id || session?.scopes?.cityBranchIds?.[0] || session?.cityBranchId || null;
    const targetCountryBranchId = selected?.country_branch_id || null;

    // Filter strictly by the active sales order's branch and country scope
    const filteredLedgers = ledgers.filter((l) => {
      const lCountryId = l.country_id || l.countryId;
      const lCityBranchId = l.city_branch_id || l.cityBranchId;
      const lCountryBranchId = l.country_branch_id || l.countryBranchId;

      // Filter by Country ID if specified
      if (targetCountryId && lCountryId && lCountryId !== targetCountryId) {
        return false;
      }
      // Filter by Branch ID if specified
      if (targetCityBranchId && lCityBranchId && lCityBranchId !== targetCityBranchId) {
        return false;
      }
      if (!targetCityBranchId && targetCountryBranchId && lCountryBranchId && lCountryBranchId !== targetCountryBranchId) {
        return false;
      }
      return true;
    });

    const list = filteredLedgers.length > 0 ? filteredLedgers : ledgers;
    return list.map(toLedgerOption);
  }, [ledgers, session, selected]);

  // Calculate dynamic currency values
  const isLocalCurrency = currency === baseCurrency;
  const isPOCurrencyLocal = useMemo(() => {
    const poCurr = (selected?.currency_code || "USD").toUpperCase();
    return poCurr === baseCurrency.toUpperCase();
  }, [selected?.currency_code, baseCurrency]);

  const showCalcPanel = useMemo(() => {
    return currency !== (selected?.currency_code || "USD") || currency !== baseCurrency;
  }, [currency, selected?.currency_code, baseCurrency]);

  const calcFinal = useMemo(() => {
    if (!showCalcPanel) return null;
    const fAmt = Number(calcAmount || 0);
    // If PO currency is local (PKR), no conversion rate is needed (rate is 1).
    // Otherwise we use the user-entered exchangeRate (e.g. 289).
    const exRate = isPOCurrencyLocal ? 1 : Number(exchangeRate || 1);
    if (calcOp === "mul") {
      return fAmt * exRate;
    } else {
      return exRate > 0 ? fAmt / exRate : 0;
    }
  }, [showCalcPanel, calcAmount, exchangeRate, calcOp, isPOCurrencyLocal]);

  // Derive target numeric payment amount
  const amount = useMemo(() => {
    if (showCalcPanel && calcFinal !== null) return calcFinal;
    return Number(finalPayment || 0);
  }, [showCalcPanel, calcFinal, finalPayment]);

  const payloadAmount = useMemo(() => {
    return showCalcPanel
      ? (isLocalCurrency ? Number(calcFinal || 0) : Number(calcAmount || 0))
      : Number(finalPayment || 0);
  }, [showCalcPanel, isLocalCurrency, calcFinal, calcAmount, finalPayment]);

  const canSave = useMemo(() => {
    return Boolean(paymentSourceLedgerId && roznamchaNumber && paymentType && amount > 0);
  }, [paymentSourceLedgerId, roznamchaNumber, paymentType, amount]);

  // Dynamic double entry preview values
  const doubleEntry = useMemo(() => {
    // For payments (advance, remaining, credit), the debit account is the supplier's party account (salesAccountNo / salesAccountName)
    // and the credit account is the user-selected payment source account (bank/cash).
    // If it's a booking entry, we debit the purchase account and credit the supplier's account.
    const isBooking = (activeMode as string) === "booking";

    const debitCode = isBooking 
      ? (selectedForm.purchaseAccountNo || "-") 
      : (selectedForm.salesAccountNo || "LIABILITY-001");
      
    const debitName = isBooking 
      ? (selectedForm.purchaseAccountName || "Purchase Account") 
      : (selectedForm.salesAccountName || "Supplier Liability Ledger");
      
    const debitBranch = isBooking 
      ? (selectedForm.purchaseAccountBranch || "-") 
      : (selectedForm.salesAccountBranch || "-");

    const creditCode = isBooking
      ? (selectedForm.salesAccountNo || "-")
      : (selectedSourceLedger ? ledgerCode(selectedSourceLedger) : "CASH-001");
      
    const creditName = isBooking
      ? (selectedForm.salesAccountName || "Supplier Liability Ledger")
      : (selectedSourceLedger ? ledgerName(selectedSourceLedger) : "Cash Book Dubai Branch");
      
    const creditBranch = isBooking
      ? (selectedForm.salesAccountBranch || "-")
      : (selectedSourceLedger ? (selectedSourceLedger.branchName || "-") : "-");

    return { debitCode, debitName, debitBranch, creditCode, creditName, creditBranch };
  }, [selectedSourceLedger, selectedForm, activeMode]);

  // Suggested values to make input easier
  const suggestedAdvance = useMemo(() => {
    if (!selected) return 0;
    const form = selected.form_data?.form || {};
    const totalPrice = selected.form_data?.goodsEntries?.length
      ? selected.form_data.goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
      : Number(form.totalAmount || 0);
    const advancePercent = Number(form.advancePercent || 0);
    const requiredAdvanceBC = (totalPrice * advancePercent) / 100;
    const paidAdvanceBC = Number(selected.paid_amount || 0);
    return Math.max(0, requiredAdvanceBC - paidAdvanceBC);
  }, [selected]);

  // Final Action POST handler
  async function handleProcessPayment() {
    if (!canSave || !selected) return;
    setProcessingPayment(true);
    setPaymentSuccess("");
    setPaymentError("");

    if (!paymentIdempotencyKeyRef.current) {
      paymentIdempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = paymentIdempotencyKeyRef.current;

    try {
      const finalRemarks = remarks.trim() || `Automated payment settlement for Sales Order No: ${selected.sales_order_no}. Roznamcha Category: ${paymentType.toUpperCase()}.`;
      const formData = new FormData();

      // Helper to check if a string is a valid UUID
      // Helper to check if a string is a valid UUID
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || "").trim());

      const form = selected.form_data?.form || {};

      // 1. Resolve debit ledger ID (Receiving Bank / Cash account)
      let debitLedgerId = "";
      if (isUuid(paymentSourceLedgerId)) {
        debitLedgerId = paymentSourceLedgerId;
      } else {
        const matchedDebit = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const c = ledgerCode(l).toLowerCase();
          const n = ledgerName(l).toLowerCase();
          return c === doubleEntry.creditCode?.toLowerCase() || n === doubleEntry.creditName?.toLowerCase() || n.includes("cash") || n.includes("bank");
        }) || ledgers.find((l) => isUuid(ledgerId(l) || ""));

        if (matchedDebit) {
          debitLedgerId = ledgerId(matchedDebit) || "";
        }
      }

      // 2. Resolve credit ledger ID (Customer / Receivable Account)
      let creditLedgerId = "";
      const candidateCreditIds = [
        (selected as any).customer_ledger_id,
        (selected as any).customerLedgerId,
        form.customerAccountLedgerId,
        form.customerAccountId,
        form.customerId,
        form.salesAccountLedgerId,
        form.salesAccountId,
        selectedForm.customerAccountLedgerId,
        selectedForm.salesAccountLedgerId
      ].filter(Boolean);

      for (const candidate of candidateCreditIds) {
        if (isUuid(String(candidate))) {
          creditLedgerId = String(candidate).trim();
          break;
        }
      }

      if (!creditLedgerId) {
        const customerCode = String(form.customerAccountNo || form.customerCode || form.salesAccountNo || doubleEntry.debitCode || "").trim().toLowerCase();
        const customerName = String(form.customerAccountName || form.customerName || form.salesAccountName || doubleEntry.debitName || "").trim().toLowerCase();

        const matchedLedger = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id) || id === debitLedgerId) return false;
          const c = ledgerCode(l).toLowerCase();
          const n = ledgerName(l).toLowerCase();
          if (customerCode && (c === customerCode || c.includes(customerCode))) return true;
          if (customerName && (n === customerName || n.includes(customerName))) return true;
          return false;
        });

        if (matchedLedger) {
          creditLedgerId = ledgerId(matchedLedger) || "";
        }
      }

      if (!creditLedgerId) {
        const targetCountry = selected.country_id;
        const matchedReceivable = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id) || id === debitLedgerId) return false;
          const lCountry = l.country_id || l.countryId;
          if (targetCountry && lCountry && lCountry !== targetCountry) return false;
          const n = ledgerName(l).toLowerCase();
          const type = String(l.account_type || l.nature || "").toLowerCase();
          return type.includes("asset") || type.includes("receivable") || n.includes("receivable") || n.includes("customer") || n.includes("client");
        });

        if (matchedReceivable) {
          creditLedgerId = ledgerId(matchedReceivable) || "";
        }
      }

      if (!creditLedgerId) {
        const valid = ledgers.find((l) => isUuid(ledgerId(l) || "") && ledgerId(l) !== debitLedgerId) || ledgers.find((l) => isUuid(ledgerId(l) || ""));
        if (valid) creditLedgerId = ledgerId(valid) || "";
      }

      // Do NOT guess a ledger here â picking an arbitrary ledger could silently post this
      // payment against the wrong account. If the customer/payment-source ledger genuinely
      // couldn't be resolved, fail loudly so the order's account link can be corrected.
      if (!isUuid(debitLedgerId) || !isUuid(creditLedgerId)) {
        throw new Error(
          !isUuid(creditLedgerId)
            ? "Could not determine the customer account's ledger for this order. Please reselect the customer/sales account on this order and try again."
            : "Could not determine the payment source (bank/cash) ledger. Please select a payment account and try again."
        );
      }
      
      const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const fromLoading = searchParams.get("fromLoading") === "true";
      const loadingRecordId = searchParams.get("loadingRecordId") || "";

      const payload = {
        purchaseOrderId: selected.id,
        salesOrderNo: selected.sales_order_no,
        kind: ["advance", "remaining", "credit", "booking"].includes(activeMode) ? activeMode : "advance",
        debitLedgerId,
        creditLedgerId,
        paymentType,
        roznamchaType,
        roznamchaNumber,
        currencyCode: currency,
        exchangeRate: Number(exchangeRate || 1),
        amount: payloadAmount,
        amountLocal: amount,
        narration: finalRemarks,
        entryDate: paymentDate,
        referenceNo: roznamchaNumber || undefined,
        typeDetails: {
          ...typeDetails,
          ...(fromLoading && loadingRecordId ? { loadingRecordId } : {})
        },
        doubleEntry,
        countryId: selected.country_id || null,
        countryBranchId: selected.country_branch_id || null,
        cityBranchId: selected.city_branch_id || selected.country_branch_id || null
      };

      formData.append("payload", JSON.stringify(payload));
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }
      const postUrl = `/api/erp/sales/orders/${selected.id}/payments${fromLoading ? "?fromLoading=true" : ""}`;

      const res = await fetch(postUrl, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { "X-Idempotency-Key": idempotencyKey }
      });
      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message ?? body?.message ?? "Execution failure on backend server.");
      }

      const allSerials = [body.data?.serialNumber, body.data?.countrySerialNumber, body.data?.branchSerialNumber].filter(Boolean).join(" | ");
      setPaymentSuccess(`Double-entry ledger voucher successfully balanced! Journal Serial Number: ${allSerials || "N/A"}.`);
      paymentIdempotencyKeyRef.current = "";
      setCalcAmount("");
      setFinalPayment("");
      setRemarks("");
      setTypeDetails({});
      setAttachmentFile(null);
      
      // Auto-reload data
      await loadOrders();
    } catch (err: any) {
      setPaymentError(err?.message || "Failed to process payment settlement. Please try again.");
    } finally {
      setProcessingPayment(false);
    }
  }

  const renderRow = (row: PurchaseOrderRow, index: number) => {
    const calcs = resolvePurchaseCalculations(row);
    const form = row.form_data?.form || {};
    const goods = row.form_data?.goodsEntries || [];
    const transport = (row.form_data?.transportDetails || row.form_data?.transport || {}) as any;

    const rowKey = (row as any).__rowKey || row.id;
    const isSelected = selected?.id === row.id;
    const isExpanded = Boolean(expandedIds[rowKey]);

    const billNo = row.sales_order_no ? `S#${row.sales_order_no}` : (form.billNo || form.contractNo || `S#${index + 1}`);
    const type = form.orderType || form.type || "B";
    const branchName = rowBranchName(row) || "â";
    const branchCode = (row.audit?.branchCode || form.branchCode || (branchName || "â")).toUpperCase();
    const countryName = rowCountryName(row) || "â";
    const countryCode = (getCountryCode(countryName) || countryName || "").toUpperCase();

    const rawDate = form.saleDate || form.purchaseDate || form.bookingDate || row.created_at;
    const dateStr = rawDate
      ? new Date(rawDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
      : "â";

    const partyName = form.customerName || form.salesAccountName || form.salesCompanyName || form.partyName || "â";
    const goodsName = goods.map((g: any) => g.goodsName || g.name).filter(Boolean).join(", ") || form.goodsName || "â";

    const totalQty = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || g.qty || 0), 0)
      : Number(form.quantity || 0);

    const grossWeight = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyKgs || g.grossWeight || g.grossWt || 0), 0)
      : Number(form.grossWeight || 0);

    const netWeight = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.netKgs || g.netWeight || g.netWt || 0), 0)
      : Number(form.netWeight || 0);

    const rawDueDate = form.advancePaymentDate || form.paymentDueDate || form.loadingDate;
    const dueDateStr = rawDueDate
      ? new Date(rawDueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
      : "—";

    const pCode = form.purchaseAccountNo || form.pCode || form.purchaseCode || "";
    const sCode = form.salesAccountNo || form.sCode || form.salesCode || "";
    const route = transport.shippingLine || transport.route || form.route || "";
    const loadingCountry = transport.loadingCountry || form.loadingCountry || "";
    const loadingPort = transport.loadingPort || form.loadingPort || "";
    const loadingDate = transport.loadingDate || form.loadingDate || "";
    const receivingCountry = transport.receivingCountry || form.receivingCountry || countryName;
    const receivingPort = transport.receivingPort || form.receivingPort || "";
    const receivingDate = transport.receivedDate || form.receivedDate || transport.arrivalDate || "";

    const rowBgClass = isSelected
      ? "bg-blue-50/90 dark:bg-blue-950/40"
      : index % 2 === 0
      ? "bg-white dark:bg-[#0c1427]"
      : "bg-slate-50/70 dark:bg-[#080e1d]";

    return (
      <React.Fragment key={rowKey}>
        <tr
          className={cn(
            "border-b border-slate-150 dark:border-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-blue-50/60 dark:hover:bg-blue-900/20 transition cursor-pointer",
            rowBgClass
          )}
          onClick={() => setExpandedIds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
        >
          {/* 1. BILL # */}
          <td className="py-3 px-2.5 whitespace-nowrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewingRow(row);
              }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline font-mono"
            >
              {billNo}
            </button>
          </td>

          {/* 2. TYPE */}
          <td className="py-3 px-2 text-center font-bold">{type}</td>

          {/* 3. BRANCH CODE */}
          <td className="py-3 px-2 font-mono font-bold whitespace-nowrap">{branchCode}</td>

          {/* 4. COUNTRY CODE */}
          <td className="py-3 px-2 font-bold whitespace-nowrap">{countryCode}</td>

          {/* 5. DATE */}
          <td className="py-3 px-2 whitespace-nowrap font-mono">{dateStr}</td>

          {/* 6. A/C / PARTY */}
          <td className="py-3 px-2.5 whitespace-nowrap">
            <span className="text-blue-600 dark:text-blue-400 font-bold">{partyName}</span>
          </td>

          {/* 7. GOODS NAME */}
          <td className="py-3 px-2.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
            {goodsName}
          </td>

          {/* 8. QTY */}
          <td className="py-3 px-2 text-right font-mono font-bold">{totalQty.toLocaleString()}</td>

          {/* 9. GROSS WEIGHT */}
          <td className="py-3 px-2 text-right font-mono font-bold">{grossWeight.toLocaleString()}</td>

          {/* 10. NET WEIGHT */}
          <td className="py-3 px-2 text-right font-mono font-bold">{netWeight.toLocaleString()}</td>

          {/* 11. TOTAL PURCHASE AMOUNT (ORIGINAL CURRENCY) */}
          <td className="py-3 px-2.5 text-right font-mono font-bold whitespace-nowrap">
            {calcs.totalPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-slate-500 font-normal text-[10px]">{calcs.purchCurr}</span>
          </td>

          {/* 12. ADVANCE % */}
          <td className="py-3 px-2 text-center font-mono font-bold">
            {calcs.advancePercent.toFixed(2)}%
          </td>

          {/* 13. PURCHASE ADVANCE AMOUNT (ORIGINAL CURRENCY) */}
          <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            {calcs.advanceAmountFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-slate-500 font-normal text-[10px]">{calcs.purchCurr}</span>
          </td>

          {/* 14. REMAINING PURCHASE AMOUNT (ORIGINAL CURRENCY) */}
          <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
            {calcs.remainingPurchaseFC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-slate-500 font-normal text-[10px]">{calcs.purchCurr}</span>
          </td>

          {/* 15. ADVANCE PAYMENT DUE DATE (DATE 1) */}
          <td className="py-3 px-2.5 whitespace-nowrap text-rose-600 dark:text-rose-400 font-bold font-mono">
            <span className="inline-flex items-center gap-1">
              {dueDateStr}
              <Calendar className="h-3 w-3 inline text-rose-500" />
            </span>
          </td>

          {/* 16. EXCHANGE RATE */}
          <td className="py-3 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {calcs.exRate.toFixed(4)}
          </td>

          {/* 17. FINAL CURRENCY (BRANCH) */}
          <td className="py-3 px-2 text-center font-mono font-bold">{calcs.finalCurr}</td>

          {/* 18. FINAL ADVANCE AMOUNT (BRANCH CURRENCY) */}
          <td className="py-3 px-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            {calcs.advanceAmountLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>

          {/* 19. P CODE */}
          <td className="py-3 px-2 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {pCode}
          </td>

          {/* 20. S CODE */}
          <td className="py-3 px-2 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {sCode}
          </td>

          {/* 21. ROUTE */}
          <td className="py-3 px-2 whitespace-nowrap font-medium">{route}</td>

          {/* 22. LOADING COUNTRY */}
          <td className="py-3 px-2 whitespace-nowrap font-medium">{loadingCountry}</td>

          {/* 23. LOADING PORT */}
          <td className="py-3 px-2 whitespace-nowrap font-medium">{loadingPort}</td>

          {/* 24. LOADING DATE */}
          <td className="py-3 px-2 whitespace-nowrap font-mono">{loadingDate}</td>

          {/* 25. RECEIVING COUNTRY */}
          <td className="py-3 px-2 whitespace-nowrap font-medium">{receivingCountry}</td>

          {/* 26. RECEIVING PORT */}
          <td className="py-3 px-2 whitespace-nowrap font-medium">{receivingPort}</td>

          {/* 27. RECEIVING DATE */}
          <td className="py-3 px-2 whitespace-nowrap font-mono">{receivingDate}</td>

          {/* 28. ACTION */}
          <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
            <ViewportActionMenu
              ariaLabel="Row actions"
              buttonClassName="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 shadow-sm"
              trigger={<MoreVertical className="h-3.5 w-3.5" />}
              menuClassName="font-semibold p-1 w-48 shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg"
            >
              {(close) => (
                <div className="py-1 text-xs">
                  {activeMode !== "advance_completed" && (
                    <button
                      className="flex w-full items-center px-3 py-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition font-bold"
                      onClick={() => {
                        selectOrder(row.id);
                        close();
                      }}
                    >
                      <WalletCards className="mr-2 h-4 w-4" />
                      <span>{translateHeader(currentLanguage, "Payment Entry")}</span>
                    </button>
                  )}
                  <button
                    className="flex w-full items-center px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                    onClick={() => {
                      setViewingRow(row);
                      close();
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4 text-blue-500" />
                    <span>{translateHeader(currentLanguage, "Open Full Bill")}</span>
                  </button>
                  <button
                    className="flex w-full items-center px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                    onClick={() => {
                      handleOpenA4PDF(row, true);
                      close();
                    }}
                  >
                    <Printer className="mr-2 h-4 w-4 text-slate-500" />
                    <span>{translateHeader(currentLanguage, "Print Statement")}</span>
                  </button>
                  <button
                    className="flex w-full items-center px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                    onClick={() => {
                      setExpandedIds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
                      close();
                    }}
                  >
                    {isExpanded ? <XCircle className="mr-2 h-4 w-4 text-slate-500" /> : <Plus className="mr-2 h-4 w-4 text-slate-500" />}
                    <span>{isExpanded ? "Hide History" : "View History"}</span>
                  </button>
                </div>
              )}
            </ViewportActionMenu>
          </td>
        </tr>

        {/* Expandable Payment History Row spanning all 28 cols */}
        {isExpanded && (
          <tr onClick={(e) => e.stopPropagation()} className="bg-slate-50/80 dark:bg-slate-900/50">
            <td colSpan={28} className="p-4 border-b border-slate-200 dark:border-slate-800">
              <NestedPaymentHistory
                row={row}
                ledgers={ledgers}
                baseCurrency={baseCurrency}
                activeMode={activeMode}
                selectOrder={(id: string) => {
                  selectOrder(id);
                }}
                expandedIds={expandedIds}
                setExpandedIds={setExpandedIds}
                logClientError={logClientError}
                onOpenFullBill={() => setViewingRow(row)}
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const recordsTextMap: Record<LanguageCode, string> = {
    en: "records",
    ur: "Ø±ÛÚ©Ø§Ø±ÚØ²",
    ar: "Ø³Ø¬ÙØ§Øª",
    fa: "Ø±Ú©ÙØ±Ø¯ÙØ§",
    ps: "Ø±ÛÚ©Ø§Ø±ÚÙÙÙ"
  };

  const refreshTextMap: Record<LanguageCode, string> = {
    en: "Refresh",
    ur: "ØªØ§Ø²Û Ú©Ø±ÛÚº",
    ar: "ØªØ­Ø¯ÙØ«",
    fa: "Ø¨Ø±ÙØ²Ø±Ø³Ø§ÙÛ",
    ps: "ØªØ§Ø²Ù Ú©ÙÙ"
  };

  // getTableHeader hoisted to module scope (getSalesOrderTableHeader) to avoid a
  // webpack chunk-splitting bug where the in-component const became undefined.

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={cn("flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950", isRtl ? "text-right" : "text-left")}>
      {/* Header / Title Portal */}
      {titleSlot && createPortal(
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {activeMode === "advance" ? t("page_title_sales", currentLanguage) :
           activeMode === "advance_completed" ? `${t("page_title_sales", currentLanguage)} (${t("Completed", currentLanguage)})` :
           activeMode === "remaining" ? t("remaining_advance", currentLanguage) :
           activeMode === "credit" ? t("col_remaining_balance", currentLanguage) : `${t("page_title_sales", currentLanguage)} (${t("Cleared", currentLanguage)})`}
        </span>,
        titleSlot
      )}
      {actionsSlot && createPortal(
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400", isRtl ? "right-2.5" : "left-2.5")} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPageIndex(0); }}
              placeholder={t("search_placeholder", currentLanguage)}
              className={cn(
                "h-7 w-48 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 transition",
                isRtl ? "pr-8 pl-2.5" : "pl-8 pr-2.5"
              )}
            />
          </div>

          {/* Filters Toggler */}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition",
              filtersOpen && "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
            )}
          >
            <Filter className="h-3 w-3" />
            {t("filters", currentLanguage)}
          </button>

          {/* Super Admin Location Selectors */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <SearchableSelect
                value={saCountryId}
                onChange={(val) => { setSaCountryId(val); setSaBranchId(""); }}
                options={[
                  { label: t("all_countries", currentLanguage), value: "" },
                  ...saCountries.map((c: any) => ({ label: tData(c.name, currentLanguage), value: c.id }))
                ]}
                placeholder={t("all_countries", currentLanguage)}
                className="w-36 text-[10px] font-semibold relative z-[45]"
              />
              <SearchableSelect
                value={saBranchId}
                onChange={(val) => setSaBranchId(val)}
                options={[
                  { label: t("all_branches", currentLanguage), value: "" },
                  ...saBranches.filter((b: any) => !saCountryId || b.country_id === saCountryId).map((b: any) => ({ label: tData(b.name, currentLanguage), value: b.id }))
                ]}
                placeholder={t("all_branches", currentLanguage)}
                disabled={!saCountryId}
                className="w-36 text-[10px] font-semibold relative z-[45]"
              />
            </div>
          )}

          {/* Active Filters Clear Button */}
          {(query || draftFilter || countryFilter || branchFilter || currencyFilter) && (
            <button
              type="button"
              onClick={reset}
              className="flex h-7 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-[10px] font-bold text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 transition"
            >
              <XCircle className="h-3 w-3" />
              {t("reset_all", currentLanguage)}
            </button>
          )}

          {/* Records count */}
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">{filtered.length} {recordsTextMap[currentLanguage]}</span>

          {/* Refresh Button */}
          <button id="refresh-btn" type="button" onClick={() => void loadOrders()} className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition">
            <RefreshCw className="h-3 w-3" />
            {refreshTextMap[currentLanguage]}
          </button>

          {/* Action Menu / Report Actions */}
          <ReportActions rows={filtered} mode={activeMode} />
        </div>,
        actionsSlot
      )}
      {/* Dashboard Header Details (Voucher Style) */}
      {dashboardSummary && (
        <div className="p-6 pb-0">
          {(() => {
            let targetSummary = dashboardSummary;
            if (isSuperAdmin && selectedCountryForSummary) {
              const countryRows = filtered.filter(row => rowCountryName(row) === selectedCountryForSummary);
              if (countryRows.length > 0) {
                const groupData = getDashboardSummaryData(countryRows, session, activeMode);
                if (groupData) {
                  targetSummary = groupData;
                }
              }
            }
            return (
              <DashboardSummaryHeader 
                summary={targetSummary} 
                mode={activeMode} 
                isSuperAdmin={isSuperAdmin}
                rows={filtered}
                expandedCountries={expandedCountries}
                setExpandedCountries={setExpandedCountries}
                selectedCountryForSummary={selectedCountryForSummary}
                setSelectedCountryForSummary={setSelectedCountryForSummary}
                lang={currentLanguage}
              />
            );
          })()}
        </div>
      )}
      {/* KPI Cards removed as requested by user - summary is already displayed in top header cards */}

      {/* Main Table Card */}
      <div className="m-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {/* Toolbar controls have been moved to erp-page-actions-slot header portal */}

        {filtersOpen && (
          <div className="grid grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-6">
            <MiniFilter label="Status" value={draftFilter} options={["pending", "posted", "partial"]} onChange={(v) => { setDraftFilter(v); setPageIndex(0); }} />
            <MiniFilter label="Country" value={countryFilter} options={countryOptions as string[]} onChange={(v) => { setCountryFilter(v); setPageIndex(0); setBranchFilter(""); }} />
            <MiniFilter label="Branch" value={branchFilter} options={branchOptions as string[]} onChange={(v) => { setBranchFilter(v); setPageIndex(0); }} />
            <MiniFilter label="Currency" value={currencyFilter} options={currencyOptions as string[]} onChange={(v) => { setCurrencyFilter(v); setPageIndex(0); }} />
            
            <div className="flex flex-col gap-1 min-w-[15rem]">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tGlobal(currentLanguage, "datepick.date_range", "Date Range")}</span>
              <ErpDatePicker
                mode="range"
                lang={currentLanguage}
                size="sm"
                value={{ from: startDateFilter || null, to: endDateFilter || null }}
                onApply={(v) => {
                  setStartDateFilter(v.from ?? "");
                  setEndDateFilter(v.to ?? "");
                  setPageIndex(0);
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Table Title Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#091020] flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {activeMode === "credit" ? "CREDIT" : activeMode === "remaining" ? "REMAINING" : "ADVANCE"} PAYMENT ENTRY DETAILS
          </h3>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Showing {pageRows.length} of {filtered.length} entries
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2100px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:border-slate-800 dark:bg-[#080d1a] text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {[
                  "BILL #",
                  "TYPE",
                  "BRANCH CODE",
                  "COUNTRY CODE",
                  "DATE",
                  "A/C / PARTY",
                  "GOODS NAME",
                  "QTY",
                  "GROSS WEIGHT",
                  "NET WEIGHT",
                  "TOTAL SALES AMOUNT (ORIGINAL CURRENCY)",
                  "ADVANCE %",
                  "SALES ADVANCE AMOUNT (ORIGINAL CURRENCY)",
                  "REMAINING SALES AMOUNT (ORIGINAL CURRENCY)",
                  "ADVANCE PAYMENT DUE DATE (DATE 1)",
                  "EXCHANGE RATE",
                  "FINAL CURRENCY (BRANCH)",
                  "FINAL ADVANCE AMOUNT (BRANCH CURRENCY)",
                  "P CODE",
                  "S CODE",
                  "ROUTE",
                  "LOADING COUNTRY",
                  "LOADING PORT",
                  "LOADING DATE",
                  "RECEIVING COUNTRY",
                  "RECEIVING PORT",
                  "RECEIVING DATE",
                  "ACTION"
                ].map((h, i) => (
                  <Th
                    key={h}
                    className={cn(
                      "px-2.5 py-3.5 whitespace-nowrap border-r border-slate-200/60 dark:border-slate-800/80 last:border-0",
                      i === 7 || i === 8 || i === 9 || i === 10 || i === 12 || i === 13 || i === 17 ? "text-right" :
                      i === 1 || i === 11 || i === 15 || i === 16 || i === 27 ? "text-center" : "text-left"
                    )}
                  >
                    {h}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => renderRow(row, index))}

              {!pageRows.length && !loading && (
                <tr>
                  <td
                    colSpan={28}
                    className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="h-10 w-10 opacity-30" />
                      <span>{t("no_payment_records_found", currentLanguage)}</span>
                      {activeMode === "remaining" ? (
                        <div className="max-w-md text-center">
                          <span className="text-[11px] text-amber-500 font-bold block">
                            {tGlobal(currentLanguage, "pay.remaining_workflow_warning", "Warning: Workflow Rule: Remaining Payment requires Transfer to Loading first.")}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {tGlobal(currentLanguage, "pay.remaining_workflow_steps", "Orders only appear here after: Booking â Advance Payment â Transfer to Loading â Loading Confirmation. Ensure the order has been transferred to loading before making a remaining payment.")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">{t("try_adjusting_filters", currentLanguage)}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={28} className="py-16 text-center text-slate-400 text-xs font-bold animate-pulse">
                    {t("loading_records", currentLanguage)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("showing", currentLanguage)} <strong className="font-semibold text-slate-700 dark:text-slate-300">{pageRows.length ? pageIndex * pageSize + 1 : 0} {t("range_to", currentLanguage)} {Math.min(filtered.length, (pageIndex + 1) * pageSize)}</strong> {t("of_records", currentLanguage)} <strong className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</strong> {t("records_word", currentLanguage)}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("rows_per_page", currentLanguage)}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((idx) => Math.max(0, idx - 1))}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-650 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
                pageIndex === 0 && "text-slate-400 opacity-50 cursor-not-allowed"
              )}
              aria-label={t("previous_page", currentLanguage)}
            >
              <ChevronRight className="h-3.5 w-3.5" style={{ transform: isRtl ? "none" : "rotate(180deg)" }} />
            </button>
            {Array.from({ length: Math.ceil(filtered.length / pageSize) }).slice(0, 5).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setPageIndex(idx)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition",
                  pageIndex === idx
                    ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/20 dark:text-blue-400"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                )}
              >
                {idx + 1}
              </button>
            ))}
            <button
              disabled={(pageIndex + 1) * pageSize >= filtered.length}
              onClick={() => setPageIndex((idx) => idx + 1)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-655 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
                (pageIndex + 1) * pageSize >= filtered.length && "text-slate-400 opacity-50 cursor-not-allowed"
              )}
              aria-label={t("next_page", currentLanguage)}
            >
              <ChevronRight className="h-3.5 w-3.5" style={{ transform: isRtl ? "rotate(180deg)" : "none" }} />
            </button>
          </div>
        </div>
      </div>


      {/* Ledger Cash Entry Panel (Modal) */}
      {selected && (
        <SimpleModal
          title={`Payment Entry - PO ${selected.sales_order_no}`}
          onClose={() => setSelectedId("")}
          className="h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[1760px] rounded-2xl shadow-2xl"
        >
          <div className="space-y-4 text-[12px]">
            {/* Info bar: Sales No / User / Date / Type / Country / Branch / Status */}
            <div className="-mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Sales No.")}</div>
                <div className="text-xs font-black text-slate-900 dark:text-slate-100">{selected.sales_order_no}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "User")}</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{selected.audit?.userName || "ERP USER"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Date")}</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{date(selected.created_at)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Type")}</div>
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {activeMode === "advance" ? "Advance" : activeMode === "credit" ? "Credit" : activeMode === "remaining" ? "Remaining" : "History"}
                </span>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Country")}</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{rowCountryName(selected) || "-"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Branch")}</div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{rowBranchName(selected) || "-"}</div>
              </div>
              <div className="ms-auto">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Status")}</div>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                  (selected.ledger_posting_status || "").toLowerCase() === "posted" || (selected.ledger_posting_status || "").toLowerCase() === "transferred"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                )}>
                  {selected.ledger_posting_status === "posted" || selected.ledger_posting_status === "transferred" ? "Transferred" : (selected.ledger_posting_status || "Pending")}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              {activeMode === "advance" ? "Sales Advance Payment Entry" : activeMode === "credit" ? "Sales Credit Payment Entry" : activeMode === "remaining" ? "Sales Remaining Payment Entry" : "Sales Payment Entry"}
            </div>
            {/* Already Transferred / Overpaid Warning Banner */}
            {(() => {
              const form = selected.form_data?.form || {};
              const totalPrice = (selected as any).form_data?.goodsEntries?.length
                ? (selected as any).form_data.goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
                : Number(form.totalAmount || 0);
              const advancePercent = Number(form.advancePercent || 0);
              const requiredAdvanceBC = (totalPrice * advancePercent) / 100;
              const paidAdvanceBC = Number(selected.paid_amount || 0);
              const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
              const remainingDue = Number(selected.remaining_amount || 0);
              const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
              const fromLoading = searchParams.get("fromLoading") === "true";
              if (activeMode === "advance" && advancePercent > 0 && remainingAdvanceBC <= 0.01) {
                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 animate-in fade-in duration-300">
                    <XCircle className="h-5 w-5 shrink-0" /> Already Transferred: The advance payment for PO {selected.sales_order_no} has already been fully paid.
                  </div>
                );
              }
              if (activeMode === "remaining" && remainingDue <= 0.01 && !fromLoading) {
                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 animate-in fade-in duration-300">
                    <XCircle className="h-5 w-5 shrink-0" /> Already Transferred: The remaining due for PO {selected.sales_order_no} has already been fully paid.
                  </div>
                );
              }
              return null;
            })()}

            {/* Professional Sales Order Details Header */}
            {(() => {
              const form = selected.form_data?.form || {};
              const goods = selected.form_data?.goodsEntries || [];
              const poCurrencyHeader = String(form.currencyType || form.currency || selected.currency_code || "USD").toUpperCase();
              const exRateHeader = Number(selected.exchange_rate || form.exchangeRate || 1);
              const purchaseTotalHeader = Number(selected.order_total || form.totalAmount || goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0));
              const advanceHeader = Number(selected.paid_amount || form.advanceAmount || ((purchaseTotalHeader * Number(form.advancePercent || 0)) / 100));
              const remainingHeader = Math.max(0, Number(selected.remaining_amount ?? (purchaseTotalHeader - advanceHeader)));
              const supplierHeader = form.salesAccountName || form.supplierName || form.salesCompanyName || "-";
              const companyHeader = form.purchaseCompanyName || form.salesCompanyName || form.companyName || "-";
              const branchHeader = rowBranchName(selected) || form.branchName || "-";
              const statusHeader = selected.payment_status || selected.status || "Pending";
              const goodsHeader = goods.map((g: any) => g.goodsName || g.productName || g.name).filter(Boolean).join(", ") || form.goodsName || "-";
              const grossWeightHeader = goods.reduce((sum: number, g: any) => sum + Number(g.grossWeight || g.gross_weight || 0), 0);
              const netWeightHeader = goods.reduce((sum: number, g: any) => sum + Number(g.netWeight || g.net_weight || 0), 0);

              const detailCells = [
                ["PO Number", selected.sales_order_no || "-"],
                ["Contract", selected.sales_contract_no || form.contractNo || "-"],
                ["Supplier", supplierHeader],
                ["Company", companyHeader],
                ["Branch", branchHeader],
                ["Currency", `${poCurrencyHeader} / ${baseCurrency}`],
                ["Exchange Rate", `1 ${poCurrencyHeader} = ${Number(exRateHeader || 1).toFixed(4)} ${baseCurrency}`],
                ["Status", statusHeader]
              ];

              const summaryCells = [
                ["Invoice Amount", money(purchaseTotalHeader, poCurrencyHeader), money(purchaseTotalHeader * exRateHeader, baseCurrency), "text-slate-900 dark:text-slate-100"],
                ["Advance / Paid", money(advanceHeader, poCurrencyHeader), money(advanceHeader * exRateHeader, baseCurrency), "text-emerald-700 dark:text-emerald-300"],
                ["Remaining Balance", money(remainingHeader, poCurrencyHeader), money(remainingHeader * exRateHeader, baseCurrency), "text-rose-700 dark:text-rose-300"],
                ["Final Balance", money(remainingHeader * exRateHeader, baseCurrency), `${poCurrencyHeader} converted to ${baseCurrency}`, "text-blue-700 dark:text-blue-300"]
              ];

              if (!isOrderDetailsExpanded) {
                return (
                  <section className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{translateHeader(currentLanguage, "Order Summary")}</div>
                          <div className="text-base font-black text-slate-900 dark:text-slate-50">{selected.sales_order_no}</div>
                        </div>
                        <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-900 hidden sm:block" />
                        <div className="text-xs">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">{translateHeader(currentLanguage, "Supplier")}</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">{supplierHeader}</span>
                        </div>
                        <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-900 hidden md:block" />
                        <div className="text-xs">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">{translateHeader(currentLanguage, "Invoice Total")}</span>
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100">{money(purchaseTotalHeader, poCurrencyHeader)}</span>
                        </div>
                        <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-900 hidden md:block" />
                        <div className="text-xs">
                          <span className="text-[9px] text-slate-400 uppercase font-bold block">{translateHeader(currentLanguage, "Remaining Balance")}</span>
                          <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(remainingHeader, poCurrencyHeader)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">{poCurrencyHeader} / {baseCurrency}</span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{statusHeader}</span>
                        <button
                          type="button"
                          onClick={() => setIsOrderDetailsExpanded(true)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                        >
                          <Plus className="h-4 w-4 stroke-[3]" />
                          <span>{translateHeader(currentLanguage, "Expand Details")}</span>
                        </button>
                      </div>
                    </div>
                  </section>
                );
              }

              return (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-300">{translateHeader(currentLanguage, "Sales Order Details")}</div>
                      <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">{selected.sales_order_no}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">{poCurrencyHeader} / {baseCurrency}</span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{statusHeader}</span>
                      <button
                        type="button"
                        onClick={() => setIsOrderDetailsExpanded(false)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all ml-2"
                      >
                        <Minus className="h-4 w-4 stroke-[3]" />
                        <span>{translateHeader(currentLanguage, "Collapse Details")}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 p-4 xl:grid-cols-4">
                    {summaryCells.map(([label, value, sub, tone]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                        <div className={`mt-1 font-mono text-[13px] font-black ${tone}`}>{value}</div>
                        <div className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 border-t border-slate-100 p-4 text-xs dark:border-slate-800 lg:grid-cols-4">
                    {detailCells.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                        <span className="block truncate font-extrabold text-slate-850 dark:text-slate-200" title={String(value)}>{value}</span>
                      </div>
                    ))}
                    <div className="lg:col-span-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Goods")}</span>
                      <span className="block truncate font-extrabold text-slate-850 dark:text-slate-200" title={goodsHeader}>{goodsHeader}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Weights")}</span>
                      <span className="block font-mono font-extrabold text-slate-850 dark:text-slate-200">G: {grossWeightHeader.toLocaleString()} KG / N: {netWeightHeader.toLocaleString()} KG</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Payment Status")}</span>
                      <span className="block font-extrabold text-slate-850 dark:text-slate-200">Total Paid {money(advanceHeader, poCurrencyHeader)}</span>
                    </div>
                  </div>
                </section>
              );
            })()}
            {/* Purchase & Container Loading Context Details Card */}
            {(() => {
              const form = selected.form_data?.form || {};
              const goods = selected.form_data?.goodsEntries || [];
              const goodsName = goods.map((g: any) => g.goodsName || g.name).filter(Boolean).join(", ") || form.goodsName || "-";

              const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
              const isUrlLoading = searchParams.get("fromLoading") === "true";
              const fromLoading = isUrlLoading || Boolean(selectedLoadingRecord);

              const cLoadedQty = selectedLoadingRecord
                ? String(selectedLoadingRecord.report_payload?.loadedQuantity || selectedLoadingRecord.loadedQuantity || 0)
                : (searchParams.get("loadedQty") || "0");
              const cGrossWeight = selectedLoadingRecord
                ? String(selectedLoadingRecord.report_payload?.grossWeight || 0)
                : (searchParams.get("grossWeight") || "0");
              const cNetWeight = selectedLoadingRecord
                ? String(selectedLoadingRecord.report_payload?.netWeight || 0)
                : (searchParams.get("netWeight") || "0");
              const cPriceRate = selectedLoadingRecord
                ? String(selectedLoadingRecord.report_payload?.priceRateC1 || 0)
                : (searchParams.get("priceRate") || "0");

              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 dark:bg-slate-900/50 dark:border-slate-800 shadow-sm space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
                      {translateHeader(currentLanguage, "Sales Order & Loading Specifications")}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Seller (Supplier)")}</span>
                        <span className="font-extrabold text-slate-855 dark:text-slate-200">
                          {form.salesAccountName || form.supplierName || "-"}
                        </span>
                        <span className="block text-[9px] font-mono text-slate-500 font-bold mt-0.5">
                          {form.salesAccountNumber || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Purchaser (Purchase A/C)")}</span>
                        <span className="font-extrabold text-slate-855 dark:text-slate-200">
                          {form.purchaseAccountName || "-"}
                        </span>
                        <span className="block text-[9px] font-mono text-slate-500 font-bold mt-0.5">
                          {form.purchaseAccountNumber || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Goods & Brand")}</span>
                        <span className="font-extrabold text-slate-855 dark:text-slate-200 block truncate max-w-[200px]" title={goodsName}>
                          {goodsName}
                        </span>
                        <span className="block text-[9px] font-semibold text-slate-500 mt-0.5">
                          Brand: {goods.map((g: any) => g.brand || "").filter(Boolean).join(", ") || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Quantity & Loading Status")}</span>
                        <span className="font-extrabold text-slate-855 dark:text-slate-200 block">
                          PO: {form.quantity || 0} {form.quantityUnit || "BAGS"}
                        </span>
                        <span className="block text-[9px] font-semibold text-slate-500 mt-0.5">
                          Loaded: <span className="font-bold text-blue-600 dark:text-blue-400">{selected.form_data?.workflow?.loadedQuantity || 0}</span> / {translateHeader(currentLanguage, "Balance:")} <span className="font-bold text-rose-600">{selected.form_data?.workflow?.remainingQuantity || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {fromLoading && (
                    <div className="border-t border-dashed border-slate-200 dark:border-slate-850 pt-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex justify-between items-center">
                        <span>{translateHeader(currentLanguage, "Transferred Container Specifications")}</span>
                        {/* Change Container option if direct select flow */}
                        {!isUrlLoading && selectedLoadingRecord && (
                          <button
                            type="button"
                            onClick={() => setSelectedLoadingRecord(null)}
                            className="text-[9px] font-bold text-rose-500 hover:text-rose-700 hover:underline transition uppercase tracking-wider"
                          >
                            {translateHeader(currentLanguage, "Change Container")}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-blue-50/20 border border-blue-100/50 p-3 rounded-lg dark:bg-blue-950/10 dark:border-blue-900/20">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Container Load Qty")}</span>
                          <span className="font-black text-slate-900 dark:text-slate-100">{cLoadedQty || "0"} {form.quantityUnit || "BAGS"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Gross Weight")}</span>
                          <span className="font-extrabold text-slate-855 dark:text-slate-200">{Number(cGrossWeight || 0).toLocaleString()} KGs</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Net Weight")}</span>
                          <span className="font-extrabold text-slate-855 dark:text-slate-200">{Number(cNetWeight || 0).toLocaleString()} KGs</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">{translateHeader(currentLanguage, "Purchase Price Rate")}</span>
                          <span className="font-mono font-bold text-slate-855 dark:text-slate-200">{Number(cPriceRate || 0).toFixed(4)} USD</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Comprehensive Payment Summary Dashboard */}
            {(() => {
              const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
              const isUrlLoading = searchParams.get("fromLoading") === "true";
              const fromLoading = isUrlLoading || Boolean(selectedLoadingRecord);

              const cLoadedQty = selectedLoadingRecord
                ? Number(selectedLoadingRecord.report_payload?.loadedQuantity || selectedLoadingRecord.loadedQuantity || 0)
                : Number(searchParams.get("loadedQty") || 0);
              const cGrossWeight = selectedLoadingRecord
                ? Number(selectedLoadingRecord.report_payload?.grossWeight || 0)
                : Number(searchParams.get("grossWeight") || 0);
              const cNetWeight = selectedLoadingRecord
                ? Number(selectedLoadingRecord.report_payload?.netWeight || 0)
                : Number(searchParams.get("netWeight") || 0);
              const cPriceRate = selectedLoadingRecord
                ? Number(selectedLoadingRecord.report_payload?.priceRateC1 || 0)
                : Number(searchParams.get("priceRate") || 0);
              const cLoadingRecordId = selectedLoadingRecord
                ? selectedLoadingRecord.id
                : (searchParams.get("loadingRecordId") || "");

              const form = (selected as any).form_data?.form || {};
              const goods = (selected as any).form_data?.goodsEntries || [];
              const totalPrice = goods.length
                ? goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
                : Number(form.totalAmount || 0);
              const poOrderTotal = Number(selected.order_total || totalPrice || 0);
              const totalPOQuantity = Number(
                selected.form_data?.totals?.totalQuantity ||
                goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
                form.quantity ||
                1
              );
              const advancePercent = Number(form.advancePercent || 0);

              // Resolve price type: is it weight-based?
              const firstGood = goods[0] || {};
              const isPerKg = firstGood.priceType === "P/KGs" || String(firstGood.priceType || "").toLowerCase().includes("kg");

              // Purchase Amount for this loading only
              const loadingPurchaseAmount = fromLoading
                ? (isPerKg ? cNetWeight * cPriceRate : cLoadedQty * cPriceRate)
                : poOrderTotal;

              // Total Purchase Amount metric: loadingPurchaseAmount
              // Required Advance allocated to this loading
              const loadingRequiredAdvance = (loadingPurchaseAmount * advancePercent) / 100;

              // Advance already paid for this loading: pro-rated share of actual advance paid on the PO
              const poAdvancePaid = Number(selected.paid_amount || 0);
              const loadingAdvancePaid = fromLoading
                ? (totalPOQuantity > 0 ? (cLoadedQty / totalPOQuantity) * poAdvancePaid : poAdvancePaid)
                : poAdvancePaid;

              // Remaining Advance for this loading
              const loadingRemainingAdvance = Math.max(0, loadingRequiredAdvance - loadingAdvancePaid);

              // Final Purchase Amount
              const finalPurchaseAmount = loadingPurchaseAmount;

              // Total Remaining Amount (which is Final Purchase Amount - Advance deducted/allocated)
              const totalRemainingAmount = Math.max(0, finalPurchaseAmount - loadingAdvancePaid);

              // Total Remaining Paid (specifically for this loading)
              const remainingPaymentsForThisLoading = selectedOrderPayments.filter((p: any) => {
                const payKind = p.kind || "";
                if (payKind !== "remaining") return false;
                if (!fromLoading) return true; // if not from loading, sum all remaining payments
                const payRecordId = p.typeDetails?.loadingRecordId || p.typeDetails?.loading_record_id || "";
                return payRecordId === cLoadingRecordId;
              });
              const totalRemainingPaid = remainingPaymentsForThisLoading.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

              // Outstanding Balance (Final Currency Balance remaining)
              const outstandingBalance = Math.max(0, finalPurchaseAmount - loadingAdvancePaid - totalRemainingPaid);

              const totalPaidSoFar = loadingAdvancePaid + totalRemainingPaid;
              const paidPercent = finalPurchaseAmount > 0 ? Math.min(100, (totalPaidSoFar / finalPurchaseAmount) * 100) : 0;
              const advancePaidPercent = loadingRequiredAdvance > 0 ? Math.min(100, (loadingAdvancePaid / loadingRequiredAdvance) * 100) : 0;

              const poCurrency = (selected as any).form_data?.form?.currencyType || (selected as any).form_data?.form?.currency || selected.currency_code || "USD";
              const exRate = selected.exchange_rate || 1;
              const isAdvComplete = loadingRemainingAdvance <= 0.01;
              const isFullyPaid = outstandingBalance <= 0.01;

              return (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                  {/* Header Bar */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-extrabold text-xs shadow-sm">PO</span>
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                          {fromLoading ? "Active Container Loading Selection" : "Active Bill Selection"}
                        </div>
                        <div className="font-extrabold text-base flex items-center gap-2">
                          {selected.sales_order_no}
                          {selected.sales_contract_no && (
                            <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded font-mono tracking-wide">
                              Contract: {selected.sales_contract_no}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      {isFullyPaid ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                          <CheckCircle className="h-3 w-3" /> Fully Paid
                        </span>
                      ) : isAdvComplete ? (
                        <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                          <CheckCircle className="h-3 w-3" /> {translateHeader(currentLanguage, "Advance Done")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                          {translateHeader(currentLanguage, "Advance Pending")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="px-5 pt-3 pb-1">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 mb-1.5">
                      <span>{fromLoading ? "Loading Payment Progress" : "Payment Progress"}</span>
                      <span className="font-mono">{paidPercent.toFixed(1)}% paid</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${paidPercent}%`,
                          background: isFullyPaid ? "#10b981" : "linear-gradient(90deg, #3b82f6, #6366f1)"
                        }}
                      />
                    </div>
                    {loadingRequiredAdvance > 0 && (
                      <div className="flex items-center justify-between text-[8px] font-semibold text-slate-400 mt-1">
                        <span>Advance Progress: {advancePaidPercent.toFixed(1)}%</span>
                        <span className="font-mono">{money(loadingAdvancePaid, poCurrency)} / {money(loadingRequiredAdvance, poCurrency)}</span>
                      </div>
                    )}
                  </div>

                  {/* TOP 4 SUMMARY CARDS GRID (matches Purchase Payment Entry modal) */}
                  <div className="px-5 pt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {/* Card 1: 1. PAYMENT SUMMARY */}
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">1</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{translateHeader(currentLanguage, "PAYMENT SUMMARY")}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 mt-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-xs w-full">
                          <div>
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Payment No.")}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-slate-900 dark:text-slate-100">{selected.sales_order_no}</span>
                              <span className="rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.2 text-[8px] font-black uppercase dark:bg-emerald-950 dark:text-emerald-300">{translateHeader(currentLanguage, "ACTIVE")}</span>
                            </div>
                          </div>
                          <div className="pt-0.5">
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Entry Date")}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{date(selected.created_at)}</span>
                          </div>
                          <div className="pt-0.5">
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Total Amount")}</span>
                            <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(loadingPurchaseAmount, poCurrency)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: 2. SALES / INVOICE SUMMARY */}
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">2</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{translateHeader(currentLanguage, "SALES / INVOICE SUMMARY")}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 mt-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-xs w-full">
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "SO / Bill No.")}</span>
                              <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-[11px] truncate block">{selected.sales_order_no}</span>
                            </div>
                            <div>
                              <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Customer")}</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-[11px] truncate block" title={form.customerAccountName || form.customerName || form.salesAccountName || "-"}>{form.customerAccountName || form.customerName || form.salesAccountName || "-"}</span>
                            </div>
                          </div>
                          <div className="pt-0.5">
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Endorsement % / Amount")}</span>
                            <span className="font-black text-slate-900 dark:text-slate-100">{advancePercent.toFixed(2)}% ({money(loadingRequiredAdvance, poCurrency)})</span>
                          </div>
                          {advancePercent > 0 && form.advancePaymentDate && (
                            <div className="pt-0.5">
                              <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Advance Payment Due Date")}</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">{String(form.advancePaymentDate)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 3: 3. ACCOUNTING SUMMARY (Highlighted Active Blue Border) */}
                    <div className="rounded-xl border-2 border-blue-500 bg-white p-2.5 shadow-md ring-2 ring-blue-500/20 dark:bg-slate-950 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/40">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-black text-white">3</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">{translateHeader(currentLanguage, "ACCOUNTING SUMMARY")}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 mt-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
                          <Scale className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-xs w-full">
                          <div>
                            <span className="text-[9.5px] font-semibold text-slate-400 block">Total Final Amount ({baseCurrency})</span>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">{money(loadingPurchaseAmount * exRate, baseCurrency)}</span>
                          </div>
                          <div className="pt-0.5">
                            <span className="text-[9.5px] font-semibold text-slate-400 block">Remaining Balance ({baseCurrency})</span>
                            <span className="font-mono font-black text-slate-900 dark:text-slate-100">{money(outstandingBalance * exRate, baseCurrency)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 pt-0.5 text-[10.5px]">
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Exchange Rate")}</span>
                              <span className="font-mono font-extrabold">{Number(exRate || 1).toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Payment Currency")}</span>
                              <span className="font-mono font-extrabold">{baseCurrency}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: 4. REPORT / BRANCH DETAILS */}
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-[10px] font-black text-white">4</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">{translateHeader(currentLanguage, "REPORT / BRANCH DETAILS")}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 mt-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                          <Building className="h-5 w-5" />
                        </div>
                        <div className="space-y-1 text-xs w-full">
                          <div>
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Branch")}</span>
                            <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[11px] truncate block">{rowBranchName(selected) || form.branchName || "-"}</span>
                          </div>
                          <div className="pt-0.5">
                            <span className="text-[9.5px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Country")}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{rowCountryName(selected) || "-"}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 pt-0.5 text-[10.5px]">
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Prepared By")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{selected.audit?.userName || "ERP USER"}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-slate-400 block">{translateHeader(currentLanguage, "Created")}</span>
                              <span className="text-[9.5px] font-mono text-slate-600 dark:text-slate-400">{date(selected.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exchange Rate & Recorded Payments Pill Footer */}
                  <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="text-[9px] font-semibold text-slate-500">
                      Exchange Rate: <span className="font-mono font-black text-slate-700 dark:text-slate-300">1 {poCurrency} = {Number(exRate).toFixed(2)} {baseCurrency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                        {remainingPaymentsForThisLoading.length} Payment{remainingPaymentsForThisLoading.length !== 1 ? 's' : ''} Recorded
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeMode === "remaining" && !selectedLoadingRecord ? (
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-6 dark:bg-amber-955/5 dark:border-amber-900/30 text-center space-y-4 max-w-3xl mx-auto my-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <Truck className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-amber-800 dark:text-amber-400">{t("select_loaded_container", currentLanguage)}</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {t("select_container_instruction", currentLanguage)}
                  </p>
                </div>
                {loadingLoadingRecords ? (
                  <div className="text-xs text-amber-700 italic flex items-center justify-center gap-1.5 py-8">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                    {t("loading_container_records", currentLanguage)}
                  </div>
                ) : loadingRecords.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-h-[350px] overflow-y-auto p-1">
                    {loadingRecords.map((lr) => {
                      const poRow = selected || {};
                      const finance = calcLoadingFinance(lr, poRow, poRow.form_data?.form || {});
                      
                      const loadedQty = lr.report_payload?.loadedQuantity || lr.loadedQuantity || 0;
                      const poAdvanceAmt = Number(poRow.paid_amount || poRow.form_data?.form?.advanceAmount || 0);
                      const goods = poRow.form_data?.goodsEntries || [];
                      const totalPOQuantity = Number(
                        poRow.form_data?.totals?.totalQuantity ||
                        goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
                        poRow.form_data?.form?.quantity ||
                        1
                      );
                      const loadedAdvanceUSD = totalPOQuantity > 0 ? (loadedQty / totalPOQuantity) * poAdvanceAmt : poAdvanceAmt;
                      const loadedRemainingUSD = Math.max(0, finance.amountUSD - loadedAdvanceUSD);
                      
                      return (
                        <button
                          key={lr.id}
                          type="button"
                          onClick={() => handleSelectLoadingRecord(lr)}
                          className="flex flex-col text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition text-xs space-y-2 dark:bg-slate-900 dark:border-slate-800 shadow-sm"
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              Container #{lr.loading_record_no || lr.report_payload?.containerNumber || "-"}
                            </span>
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                              {loadedQty.toLocaleString()} Bags
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 w-full">
                            <div>{translateHeader(currentLanguage, "Net Wt:")} <span className="font-semibold text-slate-700 dark:text-slate-300">{finance.netWeight.toLocaleString()} KGs</span></div>
                            <div>{translateHeader(currentLanguage, "Gross Wt:")} <span className="font-semibold text-slate-700 dark:text-slate-300">{finance.grossWeight.toLocaleString()} KGs</span></div>
                            <div className="col-span-2 border-t border-slate-100 dark:border-slate-800/85 pt-1.5 mt-1 flex justify-between items-center w-full">
                              <span>{t("remaining_bal_short", currentLanguage)}</span>
                              <span className="font-black text-xs text-emerald-600">{money(loadedRemainingUSD, lr.currency || "USD")}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-8 bg-slate-50 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    {translateHeader(currentLanguage, "No loaded containers found for this sales order.")}
                    <div className="text-[10px] text-slate-400 mt-1 font-normal">{translateHeader(currentLanguage, "Please make sure the containers are added and loaded in the Loading module first.")}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-12 space-y-4">
                {/* Payment Entry History */}
                {(() => {
                  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
                  const isUrlLoading = searchParams.get("fromLoading") === "true";
                  const fromLoading = isUrlLoading || Boolean(selectedLoadingRecord);

                  const cLoadedQty = selectedLoadingRecord
                    ? Number(selectedLoadingRecord.report_payload?.loadedQuantity || selectedLoadingRecord.loadedQuantity || 0)
                    : Number(searchParams.get("loadedQty") || 0);
                  const cGrossWeight = selectedLoadingRecord
                    ? Number(selectedLoadingRecord.report_payload?.grossWeight || 0)
                    : Number(searchParams.get("grossWeight") || 0);
                  const cNetWeight = selectedLoadingRecord
                    ? Number(selectedLoadingRecord.report_payload?.netWeight || 0)
                    : Number(searchParams.get("netWeight") || 0);
                  const cPriceRate = selectedLoadingRecord
                    ? Number(selectedLoadingRecord.report_payload?.priceRateC1 || 0)
                    : Number(searchParams.get("priceRate") || 0);
                  const cLoadingRecordId = selectedLoadingRecord
                    ? selectedLoadingRecord.id
                    : (searchParams.get("loadingRecordId") || "");

                  const form = (selected as any).form_data?.form || {};
                  const goods = (selected as any).form_data?.goodsEntries || [];
                  const totalPurchaseBC = Number(selected.order_total || 0) ||
                    (goods.length ? goods.reduce((s: number, g: any) => s + Number(g.totalAmount || 0), 0) : Number(form.totalAmount || 0));
                  const totalPOQuantity = Number(
                    selected.form_data?.totals?.totalQuantity ||
                    goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
                    form.quantity ||
                    1
                  );
                  const advancePercent = Number(form.advancePercent || 0);
                  const poCurrency = (selected as any).form_data?.form?.currencyType || (selected as any).form_data?.form?.currency || selected.currency_code || "USD";
                  const exRate = selected.exchange_rate || 1;

                  // Resolve pricing mode
                  const firstGood = goods[0] || {};
                  const isPerKg = firstGood.priceType === "P/KGs" || String(firstGood.priceType || "").toLowerCase().includes("kg");

                  // Determine active totals based on loading record vs PO total
                  const loadingPurchaseAmount = fromLoading
                    ? (isPerKg ? cNetWeight * cPriceRate : cLoadedQty * cPriceRate)
                    : totalPurchaseBC;

                  const loadingRequiredAdvance = (loadingPurchaseAmount * advancePercent) / 100;
                  const statementPurchaseForeign = fromLoading ? loadingPurchaseAmount : totalPurchaseBC;
                  const statementPurchaseLocal = statementPurchaseForeign * Number(exRate || 1);

                  // Build history array
                  let displayPayments: any[] = [];
                  
                  if (fromLoading && cLoadingRecordId) {
                    // 1. Synthetic pro-rated advance deduction row
                    const poAdvancePaid = Number(selected.paid_amount || 0);
                    const loadingAdvancePaid = totalPOQuantity > 0 ? (cLoadedQty / totalPOQuantity) * poAdvancePaid : poAdvancePaid;
                    
                    const poAdvancePayment = selectedOrderPayments.find((p: any) => p.kind === "advance");
                    const advanceSynthetic = {
                      id: "synthetic-advance-payment",
                      kind: "advance",
                      entry_date: poAdvancePayment?.entry_date || selected.created_at,
                      created_at: poAdvancePayment?.created_at || selected.created_at,
                      amount: loadingAdvancePaid,
                      currency_code: poCurrency,
                      exchange_rate: exRate,
                      payment_method: poAdvancePayment?.payment_method || "Advance deducted",
                      created_by_name: poAdvancePayment?.created_by_name || "System Allocation",
                      typeDetails: poAdvancePayment?.typeDetails || { method: "Advance deducted" },
                      narration: `Advance deduction allocated for ${cLoadedQty.toLocaleString()} units`,
                      reference_no: poAdvancePayment?.reference_no || "-"
                    };
                    
                    const loadingRemainingPayments = selectedOrderPayments.filter((p: any) => {
                      const payKind = p.kind || "";
                      if (payKind !== "remaining") return false;
                      const payRecordId = p.typeDetails?.loadingRecordId || p.typeDetails?.loading_record_id || "";
                      return payRecordId === cLoadingRecordId;
                    });
                    
                    displayPayments = [advanceSynthetic, ...loadingRemainingPayments];
                  } else {
                    // Exclude "booking" entries â the initial sales posting, not a payment
                    // against the balance. Matches the same fix on the purchase-side screen.
                    displayPayments = selectedOrderPayments.filter((p: any) => p.kind !== "booking");
                  }

                  if (displayPayments.length === 0) return null;

                  // Compute chronological running balances
                  const chronological = displayPayments.sort((a: any, b: any) =>
                    new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime()
                  );
                  let runningTotalUSD = 0;
                  let runningTotalAED = 0;
                  const historyWithBalance = chronological.map((p: any, idx: number) => {
                    const isPayLocal = p.currency_code?.toUpperCase() === baseCurrency.toUpperCase();
                    
                    // Amount in USD (Transaction Currency)
                    const amtUSD = isPayLocal
                      ? Number(p.amount || 0) / Number(p.exchange_rate || exRate || 1)
                      : Number(p.amount || 0);

                    // Amount in AED (Final Currency)
                    const amtAED = isPayLocal
                      ? Number(p.amount || 0)
                      : Number(p.amount || 0) * Number(p.exchange_rate || exRate || 1);

                    runningTotalUSD += amtUSD;
                    runningTotalAED += amtAED;

                    const showRemainUSD = Math.max(0, statementPurchaseForeign - runningTotalUSD);

                    const showRemainAED = Math.max(0, statementPurchaseLocal - runningTotalAED);

                    const remainingIndex = p.kind === "remaining"
                      ? chronological.slice(0, idx + 1).filter((x: any) => x.kind === "remaining").length
                      : 0;

                    const paymentTypeLabel = p.kind === "advance"
                      ? "Advance Payment"
                      : p.kind === "remaining"
                        ? `Remaining Payment - ${remainingIndex}`
                        : p.kind || "Payment";

                    return {
                      ...p,
                      paymentNo: idx + 1,
                      paymentTypeLabel,
                      amtUSD,
                      amtAED,
                      runningTotalUSD,
                      runningTotalAED,
                      showRemainUSD,
                      showRemainAED
                    };
                  });


                  const latestHistory = historyWithBalance[historyWithBalance.length - 1];
                  const totalReceivedPurchaseCurrency = Number(latestHistory?.runningTotalUSD || 0);
                  const totalReceivedLocalCurrency = Number(latestHistory?.runningTotalAED || 0);
                  const remainingPurchaseCurrency = Number(latestHistory?.showRemainUSD ?? statementPurchaseForeign);
                  const remainingLocalCurrency = Number(latestHistory?.showRemainAED ?? statementPurchaseLocal);
                  const goodsQuantity = goods.reduce((sum: number, item: any) => sum + Number(item.qtyNo || item.quantity || item.qty || 0), 0);
                  const goodsGrossWeight = goods.reduce((sum: number, item: any) => sum + Number(item.grossWeight || item.gross_weight || 0), 0);
                  const goodsNetWeight = goods.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.net_weight || 0), 0);
                  const goodsNames = goods.map((item: any) => item.goodsName || item.productName || item.name).filter(Boolean).join(", ") || firstGood.goodsName || firstGood.productName || "-";
                  const selectedPaymentSource = selectedSourceLedger;
                  const purchaseAccountPanel = {
                    title: t("purchase_account_dr", currentLanguage),
                    code: selectedForm.purchaseAccountNo || form.purchaseAccountNo || "-",
                    manual: selectedForm.purchaseManualRef || selectedForm.purchaseManualReference || form.purchaseManualRef || form.purchaseManualReference || "-",
                    name: selectedForm.purchaseAccountName || form.purchaseAccountName || "Purchase Account",
                    company: selectedForm.purchaseCompanyName || form.purchaseCompanyName || form.purchaseAccountCompany || "-",
                    branch: selectedForm.purchaseAccountBranch || form.purchaseAccountBranch || rowBranchName(selected) || "-",
                    currency: selectedForm.purchaseAccountCurrency || form.purchaseAccountCurrency || poCurrency
                  };
                  const salesAccountPanel = {
                    title: t("sales_supplier_account_cr", currentLanguage),
                    code: selectedForm.salesAccountNo || form.salesAccountNo || "-",
                    manual: selectedForm.salesManualRef || selectedForm.salesManualReference || form.salesManualRef || form.salesManualReference || "-",
                    name: selectedForm.salesAccountName || form.salesAccountName || "Sales Account",
                    company: selectedForm.salesCompanyName || form.salesCompanyName || form.salesAccountCompany || "-",
                    branch: selectedForm.salesAccountBranch || form.salesAccountBranch || rowBranchName(selected) || "-",
                    currency: selectedForm.salesAccountCurrency || form.salesAccountCurrency || poCurrency
                  };

                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-blue-500" />
                          <h3 className="text-[11px] font-black tracking-wider uppercase text-slate-800 dark:text-slate-200">
                            {fromLoading ? "2. Payment Entry History (Container Wise)" : "2. Payment Entry History (All Transactions)"}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                            {historyWithBalance.length} Entry/Entries
                          </span>
                          {historyWithBalance[historyWithBalance.length - 1]?.showRemainUSD <= 0.01 && (
                            <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">{translateHeader(currentLanguage, "Fully Paid")}</span>
                          )}
                        </div>
                      </div>

                      {/* Account, goods and currency audit summary */}
                      <div className="space-y-3 border-b border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                        <div className="grid gap-3 lg:grid-cols-4">
                          {[purchaseAccountPanel, salesAccountPanel].map((panel) => (
                            <div key={panel.title} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{panel.title}</span>
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{panel.currency}</span>
                              </div>
                              <div className="space-y-1 text-[10px]">
                                <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Account")}</span><span className="text-right font-black text-slate-800 dark:text-slate-100">{panel.name}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Code")}</span><span className="font-mono font-bold text-slate-700 dark:text-slate-200">{panel.code}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Manual")}</span><span className="font-mono font-bold text-slate-700 dark:text-slate-200">{panel.manual}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Company")}</span><span className="text-right font-semibold text-slate-700 dark:text-slate-200">{panel.company}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Branch")}</span><span className="text-right font-semibold text-slate-700 dark:text-slate-200">{panel.branch}</span></div>
                              </div>
                            </div>
                          ))}

                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">{translateHeader(currentLanguage, "Goods & Loading")}</div>
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Goods")}</span><span className="text-right font-black text-slate-800 dark:text-slate-100">{goodsNames}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Brand")}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{firstGood.brand || "-"}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Quantity")}</span><span className="font-mono font-bold">{(fromLoading ? cLoadedQty : goodsQuantity).toLocaleString()}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Gross WT")}</span><span className="font-mono font-bold">{(fromLoading ? cGrossWeight : goodsGrossWeight).toLocaleString()} KG</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Net WT")}</span><span className="font-mono font-bold">{(fromLoading ? cNetWeight : goodsNetWeight).toLocaleString()} KG</span></div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">{translateHeader(currentLanguage, "Payment Source / CR")}</div>
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Account")}</span><span className="text-right font-black text-slate-800 dark:text-slate-100">{selectedPaymentSource ? ledgerName(selectedPaymentSource) : "-"}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Code")}</span><span className="font-mono font-bold text-slate-700 dark:text-slate-200">{selectedPaymentSource ? ledgerCode(selectedPaymentSource) : "-"}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Currency")}</span><span className="font-mono font-bold text-slate-700 dark:text-slate-200">{selectedPaymentSource ? ledgerCurrency(selectedPaymentSource) : baseCurrency}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Balance")}</span><span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{sourceBalanceText}</span></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-400">{translateHeader(currentLanguage, "Posting")}</span><span className="font-semibold text-slate-700 dark:text-slate-200">{translateHeader(currentLanguage, "DR Party / CR Source")}</span></div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
                          {[
                            ["Purchase Total", money(statementPurchaseForeign, poCurrency), poCurrency, "text-slate-900 dark:text-slate-100"],
                            ["Required Advance", money(loadingRequiredAdvance, poCurrency), poCurrency, "text-orange-700 dark:text-orange-300"],
                            ["Received / Paid", money(totalReceivedPurchaseCurrency, poCurrency), poCurrency, "text-emerald-700 dark:text-emerald-300"],
                            ["Balance", money(remainingPurchaseCurrency, poCurrency), poCurrency, "text-rose-700 dark:text-rose-300"],
                            ["Final Local Total", money(statementPurchaseLocal, baseCurrency), baseCurrency, "text-slate-900 dark:text-slate-100"],
                            ["Local Paid", money(totalReceivedLocalCurrency, baseCurrency), baseCurrency, "text-emerald-700 dark:text-emerald-300"],
                            ["Local Balance", money(remainingLocalCurrency, baseCurrency), baseCurrency, "text-rose-700 dark:text-rose-300"]
                          ].map(([label, value, cur, tone]) => (
                            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] font-black text-slate-500 dark:bg-slate-900">{cur}</span>
                              </div>
                              <div className={"mt-1 font-mono text-[11px] font-black " + tone}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Running Ledger Table */}
                      <div className="max-h-[420px] overflow-auto">
                        <table className="w-full min-w-[1320px] text-left text-xs border-collapse">
                          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-[9px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <Th className="px-3 py-2 text-center w-10">#</Th>
                              <Th className="px-3 py-2">{translateHeader(currentLanguage, "General Serial / Date")}</Th>
                              <Th className="px-3 py-2">{translateHeader(currentLanguage, "Reference / User")}</Th>
                              <Th className="px-3 py-2">{translateHeader(currentLanguage, "Debit & Credit Ledger Accounts")}</Th>
                              <Th className="px-3 py-2 text-right">Advance Required ({poCurrency})</Th>
                              <Th className="px-3 py-2 text-right">Received ({poCurrency})</Th>
                              <Th className="px-3 py-2 text-right">Balance ({poCurrency})</Th>
                              <Th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Exchange Rate")}</Th>
                              <Th className="px-3 py-2 text-right">Advance Required ({baseCurrency})</Th>
                              <Th className="px-3 py-2 text-right">Received ({baseCurrency})</Th>
                              <Th className="px-3 py-2 text-right">Balance ({baseCurrency})</Th>
                              <Th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Total Received")}</Th>
                              <Th className="px-3 py-2 text-center w-12">{translateHeader(currentLanguage, "Actions")}</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyWithBalance.map((payment: any) => {
                              const drLedger = ledgers.find((l) => ledgerId(l) === payment.debit_ledger_id);
                              const crLedger = ledgers.find((l) => ledgerId(l) === payment.credit_ledger_id);
                              const re = payment.roznamcha_entries || {};
                              const method = payment.typeDetails?.method || payment.payment_method || payment.typeDetails?.bankName || payment.bank_name || "-";
                              const userName = payment.created_by_name || payment.audit?.userName || payment.typeDetails?.receiverSenderName || re.created_by_name || "Admin";
                              const journalSerial = re.super_admin_serial_number || payment.super_admin_serial_number || "Pending";
                              const countrySerial = re.country_transaction_serial_number || payment.country_transaction_serial_number || "-";
                              const branchSerial = re.branch_transaction_serial_number || payment.branch_transaction_serial_number || "-";
                              const debitSerialBase = String(re.debit_serial_number || payment.debit_serial_number || journalSerial || "Pending");
                              const creditSerialBase = String(re.credit_serial_number || payment.credit_serial_number || journalSerial || "Pending");
                              const debitSerial = debitSerialBase.endsWith("-DR") ? debitSerialBase : debitSerialBase + "-DR";
                              const creditSerial = creditSerialBase.endsWith("-CR") ? creditSerialBase : creditSerialBase + "-CR";
                              const drLabel = drLedger ? ledgerName(drLedger) : "-";
                              const crLabel = crLedger ? ledgerName(crLedger) : "-";
                              const isCompleted = payment.showRemainUSD <= 0.01;

                              return (
                                <tr
                                  key={payment.id}
                                  className={"border-b border-slate-100 dark:border-slate-800/60 text-xs transition " + (isCompleted ? "bg-emerald-50/20 dark:bg-emerald-950/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30")}
                                >
                                  <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300">{payment.paymentNo}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400 font-semibold">
                                    <div className="font-mono text-[10px] font-black text-slate-800 dark:text-slate-200">{journalSerial}</div>
                                    <div className="text-[9px]">Country: {countrySerial}</div>
                                    <div className="text-[9px]">Branch: {branchSerial}</div>
                                    <div className="text-[9px] mt-1">{date(payment.entry_date || payment.created_at)}</div>
                                  </td>
                                  <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">
                                    <div className="font-mono text-[9px] text-slate-500 dark:text-slate-400">Ref: {payment.reference_no || payment.roznamcha_number || payment.voucher_no || "-"}</div>
                                    <div className="flex items-center gap-1 mt-1"><User className="h-3 w-3 text-slate-400" />{userName}</div>
                                    <div className="text-[10px] mt-1">{payment.paymentTypeLabel}</div>
                                    <div className="text-[8px] font-normal text-slate-400">Via {method}</div>
                                  </td>
                                  <td className="px-3 py-2 text-[10px] text-slate-600 dark:text-slate-300 min-w-[210px]">
                                    <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/20 px-2 py-1">
                                      <div className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 font-mono text-[8px] font-black text-white shadow-sm">DR Serial: {debitSerial}</div>
                                      <div className="font-bold text-blue-700 dark:text-blue-400">DR: {drLabel}</div>
                                    </div>
                                    <div className="mt-1 rounded-lg border border-rose-100 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 px-2 py-1">
                                      <div className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 font-mono text-[8px] font-black text-white shadow-sm">CR Serial: {creditSerial}</div>
                                      <div className="font-bold text-rose-700 dark:text-rose-400">CR: {crLabel}</div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-800 dark:text-slate-200">{money(statementPurchaseForeign, poCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-400">{money(payment.amtUSD, poCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">{money(payment.showRemainUSD, poCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-700 dark:text-slate-300">{Number(payment.exchange_rate || exRate || 1).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-800 dark:text-slate-200">{money(statementPurchaseLocal, baseCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-400">{money(payment.amtAED, baseCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">{money(payment.showRemainAED, baseCurrency)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400">
                                    <div>{money(payment.runningTotalUSD, poCurrency)}</div>
                                    <div className="text-[9px] text-blue-500">{money(payment.runningTotalAED, baseCurrency)}</div>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <NestedRowActions payment={payment} row={selected} ledgers={ledgers} localCurrency={baseCurrency} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300">
                              <td colSpan={5} className="px-3 py-2 uppercase tracking-wide text-center">{translateHeader(currentLanguage, "Totals")}</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">{money(historyWithBalance.reduce((sum: number, p: any) => sum + p.amtUSD, 0), poCurrency)}</td>
                              <td className="px-3 py-2 text-right font-mono text-rose-600 dark:text-rose-400 font-black">{money(historyWithBalance[historyWithBalance.length - 1]?.showRemainUSD || 0, poCurrency)}</td>
                              <td />
                              <td />
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">{money(historyWithBalance.reduce((sum: number, p: any) => sum + p.amtAED, 0), baseCurrency)}</td>
                              <td className="px-3 py-2 text-right font-mono text-rose-600 dark:text-rose-400 font-black">{money(historyWithBalance[historyWithBalance.length - 1]?.showRemainAED || 0, baseCurrency)}</td>
                              <td className="px-3 py-2 text-right font-mono text-blue-700 dark:text-blue-400 font-black">{money(historyWithBalance[historyWithBalance.length - 1]?.runningTotalUSD || 0, poCurrency)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/20 lg:grid-cols-2">
                        <div className="rounded-xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/60 dark:bg-slate-950">
                          <div className="flex items-center justify-between border-b border-blue-100 px-3 py-2 dark:border-blue-900/60">
                            <div>
                              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">{translateHeader(currentLanguage, "Debit Entries")}</div>
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Purchase side ledger postings")}</div>
                            </div>
                            <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black text-white">{translateHeader(currentLanguage, "DR")}</span>
                          </div>
                          <div className="max-h-[220px] overflow-auto">
                            <table className="w-full min-w-[620px] text-[10px]">
                              <thead className="sticky top-0 bg-blue-50 text-left uppercase tracking-[0.08em] text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                                <tr>
                                  <Th className="px-3 py-2">{translateHeader(currentLanguage, "Serial / Date")}</Th>
                                  <Th className="px-3 py-2">{translateHeader(currentLanguage, "Debit Account")}</Th>
                                  <Th className="px-3 py-2 text-right">Amount ({poCurrency})</Th>
                                  <Th className="px-3 py-2 text-right">Amount ({baseCurrency})</Th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {historyWithBalance.map((payment: any) => {
                                  const drLedger = ledgers.find((l) => ledgerId(l) === payment.debit_ledger_id);
                                  const entry = payment.roznamcha_entries || {};
                                  const rawSerial = String(entry.debit_serial_number || payment.debit_serial_number || entry.super_admin_serial_number || payment.super_admin_serial_number || "Pending");
                                  const serial = rawSerial.endsWith("-DR") ? rawSerial : `${rawSerial}-DR`;
                                  return (
                                    <tr key={`debit-entry-${payment.id}`} className="hover:bg-blue-50/60 dark:hover:bg-blue-950/20">
                                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                                        <div className="font-black text-blue-700 dark:text-blue-300">{serial}</div>
                                        <div className="text-[9px]">{date(payment.payment_date || payment.created_at)}</div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-black text-slate-800 dark:text-slate-100">{ledgerName(drLedger)}</div>
                                        <div className="font-mono text-[9px] text-slate-500">{ledgerCode(drLedger) || payment.debit_ledger_id || "-"}</div>
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono font-black text-blue-700 dark:text-blue-300">{money(payment.amtUSD, poCurrency)}</td>
                                      <td className="px-3 py-2 text-right font-mono font-black text-blue-700 dark:text-blue-300">{money(payment.amtAED, baseCurrency)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-white shadow-sm dark:border-rose-900/60 dark:bg-slate-950">
                          <div className="flex items-center justify-between border-b border-rose-100 px-3 py-2 dark:border-rose-900/60">
                            <div>
                              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">{translateHeader(currentLanguage, "Credit Entries")}</div>
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Payment source ledger postings")}</div>
                            </div>
                            <span className="rounded-full bg-rose-600 px-2 py-1 text-[10px] font-black text-white">{translateHeader(currentLanguage, "CR")}</span>
                          </div>
                          <div className="max-h-[220px] overflow-auto">
                            <table className="w-full min-w-[620px] text-[10px]">
                              <thead className="sticky top-0 bg-rose-50 text-left uppercase tracking-[0.08em] text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                                <tr>
                                  <Th className="px-3 py-2">{translateHeader(currentLanguage, "Serial / Date")}</Th>
                                  <Th className="px-3 py-2">{translateHeader(currentLanguage, "Credit Account")}</Th>
                                  <Th className="px-3 py-2 text-right">Amount ({poCurrency})</Th>
                                  <Th className="px-3 py-2 text-right">Amount ({baseCurrency})</Th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {historyWithBalance.map((payment: any) => {
                                  const crLedger = ledgers.find((l) => ledgerId(l) === payment.credit_ledger_id);
                                  const entry = payment.roznamcha_entries || {};
                                  const rawSerial = String(entry.credit_serial_number || payment.credit_serial_number || entry.super_admin_serial_number || payment.super_admin_serial_number || "Pending");
                                  const serial = rawSerial.endsWith("-CR") ? rawSerial : `${rawSerial}-CR`;
                                  return (
                                    <tr key={`credit-entry-${payment.id}`} className="hover:bg-rose-50/60 dark:hover:bg-rose-950/20">
                                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                                        <div className="font-black text-rose-700 dark:text-rose-300">{serial}</div>
                                        <div className="text-[9px]">{date(payment.payment_date || payment.created_at)}</div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-black text-slate-800 dark:text-slate-100">{ledgerName(crLedger)}</div>
                                        <div className="font-mono text-[9px] text-slate-500">{ledgerCode(crLedger) || payment.credit_ledger_id || "-"}</div>
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono font-black text-rose-700 dark:text-rose-300">{money(payment.amtUSD, poCurrency)}</td>
                                      <td className="px-3 py-2 text-right font-mono font-black text-rose-700 dark:text-rose-300">{money(payment.amtAED, baseCurrency)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Payment Entry Form */}
              <div className="xl:col-span-7 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  2. PAYMENT ENTRIES
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldBlock label={t("payment_source_account", currentLanguage)} required>
                    <SearchSelect
                      label=""
                      value={paymentSourceLedgerId}
                      placeholder={t("search_payment_source_account", currentLanguage)}
                      options={ledgerOptions}
                      disabled={loading}
                      onValueChange={(val) => {
                        setPaymentSourceLedgerId(val);
                        // Sync account -> Category & Type
                        const led = ledgers.find((l) => ledgerId(l) === val);
                        if (led) {
                          const name = ledgerName(led).toLowerCase();
                          const code = ledgerCode(led).toLowerCase();
                          if (name.includes("cash") || code.includes("cash")) {
                            setPaymentType("cash");
                            setRoznamchaType("Cash Book No.");
                          } else {
                            setPaymentType("bank");
                            setRoznamchaType("Roznamcha Book No.");
                          }
                        }
                      }}
                    />
                    {selectedSourceLedger && (
                      <div className="mt-1 text-[10px] font-semibold text-slate-500 flex justify-between">
                        <span>{t("balance_colon", currentLanguage)}{sourceBalanceText}</span>
                        <span>{t("currency_colon", currentLanguage)}{selectedSourceLedger.currency || baseCurrency}</span>
                      </div>
                    )}
                  </FieldBlock>

                  <FieldBlock label={t("roznamcha_type_label", currentLanguage)} required>
                    <SearchableSelect
                      value={roznamchaType}
                      onChange={(val) => {
                        setRoznamchaType(val);
                        if (val === "Cash Book No.") {
                          setPaymentType("cash");
                          const cashLed = ledgers.find((l) => ledgerName(l).toLowerCase().includes("cash") || ledgerCode(l).toLowerCase().includes("cash"));
                          if (cashLed) setPaymentSourceLedgerId(ledgerId(cashLed) || "");
                        } else if (val === "Roznamcha Book No.") {
                          setPaymentType("bank");
                          const bankLed = ledgers.find((l) => ledgerName(l).toLowerCase().includes("bank") || ledgerCode(l).toLowerCase().includes("bank"));
                          if (bankLed) setPaymentSourceLedgerId(ledgerId(bankLed) || "");
                        }
                      }}
                      options={[
                        { label: tData("Cash Book No.", currentLanguage), value: "Cash Book No." },
                        { label: tData("Roznamcha Book No.", currentLanguage), value: "Roznamcha Book No." },
                        { label: t("receipt_no_full_label", currentLanguage), value: "Receipt No." }
                      ]}
                      placeholder={t("select_type", currentLanguage)}
                      className="relative z-[45] text-xs font-semibold text-slate-800 dark:text-slate-100"
                    />
                  </FieldBlock>

                  <FieldBlock label={t("roznamcha_number_label", currentLanguage)} required>
                    <Input
                      className="h-9 text-xs font-semibold w-full"
                      value={roznamchaNumber}
                      onChange={(e) => setRoznamchaNumber(e.target.value)}
                      placeholder="e.g. 000123"
                    />
                  </FieldBlock>

                  <FieldBlock label={t("payment_date_label", currentLanguage)} required>
                    <Input
                      className="h-9 text-xs font-semibold w-full"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </FieldBlock>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldBlock label={t("roznamcha_category_label", currentLanguage)} required>
                    <SearchableSelect
                      value={paymentType}
                      onChange={(val) => {
                        const value = val as any;
                        setPaymentType(value);
                        setTypeDetails({});
                        setAttachmentFile(null);
                        setFinalPayment("");

                        // Sync Category -> Type and Source Account
                        if (value === "cash") {
                          setRoznamchaType("Cash Book No.");
                          const cashLed = ledgers.find((l) => ledgerName(l).toLowerCase().includes("cash") || ledgerCode(l).toLowerCase().includes("cash"));
                          if (cashLed) setPaymentSourceLedgerId(ledgerId(cashLed) || "");
                        } else if (value === "bank") {
                          setRoznamchaType("Roznamcha Book No.");
                          const bankLed = ledgers.find((l) => ledgerName(l).toLowerCase().includes("bank") || ledgerCode(l).toLowerCase().includes("bank"));
                          if (bankLed) setPaymentSourceLedgerId(ledgerId(bankLed) || "");
                        }
                      }}
                      options={[
                        { label: t("select_category", currentLanguage), value: "" },
                        { label: t("cash_roznamcha", currentLanguage), value: "cash" },
                        { label: t("bank_roznamcha", currentLanguage), value: "bank" },
                        { label: t("business_roznamcha", currentLanguage), value: "business" },
                        { label: t("invoice_journal", currentLanguage), value: "invoice" },
                        { label: t("transfer_label", currentLanguage), value: "transfer" }
                      ]}
                      placeholder={t("select_category", currentLanguage)}
                      className="relative z-[45] text-xs font-semibold text-slate-800 dark:text-slate-100"
                    />
                  </FieldBlock>

                  <FieldBlock label={t("currency_label", currentLanguage)} required>
                    <SearchableSelect
                      value={currency}
                      onChange={(val) => setCurrency(val)}
                      options={[
                        { label: "USD", value: "USD" },
                        { label: "AED", value: "AED" },
                        { label: "PKR", value: "PKR" },
                        { label: "INR", value: "INR" },
                        { label: "AFN", value: "AFN" },
                        { label: "IRR", value: "IRR" }
                      ]}
                      placeholder={t("select_currency", currentLanguage)}
                      className="relative z-[45] text-xs font-semibold text-slate-800 dark:text-slate-100"
                    />
                  </FieldBlock>
                </div>

                {/* Dynamic Type Panel */}
                {paymentType && (
                  <div className="rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/20">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      {paymentType === "cash" && t("cash_details", currentLanguage)}
                      {paymentType === "bank" && t("bank_details", currentLanguage)}
                      {paymentType === "business" && t("business_details", currentLanguage)}
                      {paymentType === "invoice" && t("invoice_details", currentLanguage)}
                      {paymentType === "transfer" && t("transfer_details", currentLanguage)}
                    </div>
                    
                    {paymentType === "cash" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <FieldBlock label={t("receiver_sender_name", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.receiverSenderName || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, receiverSenderName: e.target.value }))} placeholder={t("receiver_or_sender_name_placeholder", currentLanguage)} />
                        </FieldBlock>
                        <FieldBlock label={t("mobile_number", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.mobileNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, mobileNumber: e.target.value }))} placeholder="03xxxxxxxxx" />
                        </FieldBlock>
                        <FieldBlock label={t("whatsapp_number", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.whatsappNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, whatsappNumber: e.target.value }))} placeholder="03xxxxxxxxx" />
                        </FieldBlock>
                        <FieldBlock label={t("id_card_copy_upload", currentLanguage)}>
                          <div className="flex items-center gap-2">
                            <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                              <Paperclip className="h-3 w-3" />
                              <span>{t("attach_label", currentLanguage)}</span>
                              <Input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setAttachmentFile(file);
                                  setTypeDetails((p) => ({ ...p, idCardCopyName: file?.name || "" }));
                                }}
                              />
                            </Label>
                            {typeDetails.idCardCopyName && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[200px]">{typeDetails.idCardCopyName}</span>}
                          </div>
                        </FieldBlock>
                      </div>
                    )}

                    {paymentType === "bank" && (
                      <div className="space-y-3">
                        <div className="space-y-1 relative z-[46]">
                          <BankPicker
                            label={t("bank_name", currentLanguage)}
                            value={typeDetails.bankId || ""}
                            onValueChange={async (bankId) => {
                              setTypeDetails((prev) => ({ ...prev, bankId }));
                              if (!bankId) return;
                              try {
                                const bank = await getBankById(bankId);
                                setTypeDetails((prev) => ({
                                  ...prev,
                                  bankName: bank?.bank_name || prev.bankName
                                }));
                              } catch {
                                // ignore
                              }
                            }}
                          />
                        </div>

                        <div className="space-y-1 relative z-[46]">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {t("payment_method", currentLanguage)}
                          </span>
                          <SearchableSelect
                            value={typeDetails.method || ""}
                            onChange={(val) => {
                              if (val === "__ADD_NEW__") {
                                openAddOption("method");
                              } else {
                                setTypeDetails((prev) => ({ ...prev, method: val }));
                              }
                            }}
                            options={[
                              { label: t("select_method", currentLanguage), value: "" },
                              ...["Cheque", "Mobile Transfer", "Online Transfer", "Bank Transfer"].map((method) => ({ label: method, value: method })),
                              ...savedMethods.map((method) => ({ label: method, value: method }))
                            ]}
                            placeholder={t("select_method", currentLanguage)}
                            addOptionLabel={t("new_method", currentLanguage)}
                            className="text-xs font-semibold text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          <FieldBlock label={t("reference_no", currentLanguage)}>
                            <Input
                              className="h-9 text-xs font-semibold w-full"
                              value={typeDetails.refNo || ""}
                              onChange={(e) => setTypeDetails((prev) => ({ ...prev, refNo: e.target.value }))}
                              placeholder={t("cheque_mobile_transaction_number", currentLanguage)}
                            />
                          </FieldBlock>
                          <FieldBlock label={t("payment_date_label", currentLanguage)} required>
                            <Input
                              className="h-9 text-xs font-semibold w-full"
                              type="date"
                              required
                              value={typeDetails.payDate || paymentDate}
                              onChange={(e) => setTypeDetails((prev) => ({ ...prev, payDate: e.target.value }))}
                            />
                          </FieldBlock>
                        </div>

                        <FieldBlock label={t("attachment_upload", currentLanguage)}>
                          <div className="flex items-center gap-2">
                            <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                              <Paperclip className="h-3 w-3" />
                              <span>{t("attach_label", currentLanguage)}</span>
                              <Input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] ?? null;
                                  setAttachmentFile(file);
                                  setTypeDetails((p) => ({ ...p, bankAttachmentName: file?.name || "" }));
                                }}
                              />
                            </Label>
                            {typeDetails.bankAttachmentName && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1.5 rounded border truncate max-w-[150px]">{typeDetails.bankAttachmentName}</span>}
                          </div>
                        </FieldBlock>
                      </div>
                    )}

                    {(paymentType === "business" || paymentType === "invoice") && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <FieldBlock label={t("invoice_number_label", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.invoiceNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, invoiceNumber: e.target.value }))} placeholder={translateHeader(currentLanguage, "Invoice number")} />
                        </FieldBlock>
                        <FieldBlock label={t("purchase_information", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.purchaseInfo || typeDetails.businessName || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, purchaseInfo: e.target.value, businessName: e.target.value }))} placeholder={translateHeader(currentLanguage, "Purchase information")} />
                        </FieldBlock>
                      </div>
                    )}

                    {paymentType === "transfer" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <FieldBlock label={t("from_label", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.from || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, from: e.target.value }))} placeholder={translateHeader(currentLanguage, "From account")} />
                        </FieldBlock>
                        <FieldBlock label={t("to_label", currentLanguage)}>
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.to || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, to: e.target.value }))} placeholder={translateHeader(currentLanguage, "To account")} />
                        </FieldBlock>
                        <FieldBlock label={t("reference_label", currentLanguage)} className="md:col-span-2">
                          <Input className="h-9 text-xs font-semibold" value={typeDetails.ref || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, ref: e.target.value }))} placeholder={translateHeader(currentLanguage, "Reference")} />
                        </FieldBlock>
                      </div>
                    )}
                  </div>
                )}

                {/* Currency Rate / Calculations */}
                {currency && showCalcPanel && (
                  <div className="rounded-lg border bg-slate-50/50 p-3 dark:bg-slate-900/20">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {t("transaction_conversion_details", currentLanguage)} ({selected?.currency_code || "USD"} â {baseCurrency})
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <FieldBlock label={`${t("purchase_currency_amount", currentLanguage)} (${selected?.currency_code || "USD"})`} required>
                        <Input className="h-9 text-xs font-semibold" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} type="number" step="0.0001" min="0" placeholder="e.g. 100" />
                      </FieldBlock>
                      <FieldBlock label={t("exchange_rate_label", currentLanguage)} required>
                        <Input className="h-9 text-xs font-semibold" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} type="number" step="0.0001" min="0" disabled={selected?.currency_code === baseCurrency && currency === baseCurrency} />
                      </FieldBlock>
                      <FieldBlock label={t("operation_label", currentLanguage)}>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold outline-none"
                          value={calcOp}
                          onChange={(e) => setCalcOp(e.target.value as any)}
                        >
                          <option value="mul">{t("multiply_op", currentLanguage)}</option>
                          <option value="div">{t("divide_op", currentLanguage)}</option>
                        </select>
                      </FieldBlock>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label={`${t("final_local_amount", currentLanguage)} (${baseCurrency})`} required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        {baseCurrency}
                      </span>
                      <Input
                        className="h-9 pl-12 text-right text-xs font-black font-mono"
                        value={showCalcPanel && calcFinal !== null ? calcFinal.toFixed(2) : finalPayment}
                        onChange={(e) => setFinalPayment(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={showCalcPanel && calcFinal !== null}
                      />
                    </div>
                    {suggestedAdvance > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const rate = Number(exchangeRate || 1);
                          setFinalPayment((suggestedAdvance * rate).toFixed(2));
                          setCalcAmount(suggestedAdvance.toFixed(2));
                        }}
                        className="text-[10px] text-primary font-semibold hover:underline mt-1 block"
                      >
                        {t("use_suggested", currentLanguage)}: {money(suggestedAdvance, currency)} / {money(suggestedAdvance * Number(exchangeRate || 1), baseCurrency)}
                      </button>
                    )}
                  </FieldBlock>

                  </div>

                  {/* 1. ACCOUNTING ENTRIES (DOUBLE ENTRY) */}
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 pt-1">
                    1. ACCOUNTING ENTRIES (DOUBLE ENTRY)
                  </div>
                  {/* DR ACCOUNTS & CR ACCOUNTS Live Preview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* DR ACCOUNT (Debit Destination) */}
                    <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm dark:border-blue-900/50 dark:bg-slate-950">
                      <div className="flex items-center justify-between pb-1.5 border-b border-blue-100 dark:border-blue-900/40">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">{translateHeader(currentLanguage, "DR")}</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                            {translateHeader(currentLanguage, "DR ACCOUNTS")}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                          {translateHeader(currentLanguage, "Settlement Target")}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1.5 text-xs">
                        <div>
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Account Name")}</div>
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">{doubleEntry.debitName}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Account No.")}</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{doubleEntry.debitCode}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Branch")}</div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">{doubleEntry.debitBranch}</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800 font-bold">
                          <span className="text-slate-500 text-[10px]">{translateHeader(currentLanguage, "Amount to DR:")}</span>
                          <span className="font-mono text-blue-700 dark:text-blue-400 font-black text-xs">{amount ? money(amount, baseCurrency) : "0.00 " + baseCurrency}</span>
                        </div>
                      </div>
                    </div>

                    {/* CR ACCOUNT'S (Credit Payment Source) */}
                    <div className="rounded-xl border border-rose-200 bg-white p-3 shadow-sm dark:border-rose-900/50 dark:bg-slate-950">
                      <div className="flex items-center justify-between pb-1.5 border-b border-rose-100 dark:border-rose-900/40">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">{translateHeader(currentLanguage, "CR")}</span>
                          <span className="text-[11px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                            {translateHeader(currentLanguage, "CR ACCOUNT'S")}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                          {translateHeader(currentLanguage, "Payment Source")}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1.5 text-xs">
                        <div>
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Selected Source Account")}</div>
                          <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">{doubleEntry.creditName}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Account No.")}</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{doubleEntry.creditCode}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Current Balance")}</div>
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{sourceBalanceText}</div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800 font-bold">
                          <span className="text-slate-500 text-[10px]">{translateHeader(currentLanguage, "Amount to CR:")}</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400 font-black text-xs">{amount ? money(amount, baseCurrency) : "0.00 " + baseCurrency}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Balanced Entry Status */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 text-xs flex items-center justify-between">
                    <div className="font-bold flex items-center gap-2">
                      <span className="font-black text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">{translateHeader(currentLanguage, "BALANCED")}</span>
                      <span className="text-[11px] truncate">DR: {doubleEntry.debitCode} ({doubleEntry.debitName}) â CR: {doubleEntry.creditCode} ({doubleEntry.creditName})</span>
                    </div>
                  </div>

                <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  3. NARRATION / REMARKS
                </div>
                <FieldBlock label={t("comments_label", currentLanguage)}>
                  <textarea
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={t("manual_notes_placeholder", currentLanguage)}
                  />
                </FieldBlock>

                {/* Bottom Audit Metadata (matches Purchase Payment Entry modal) */}
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 px-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span>{t("created_by_label", currentLanguage)} </span>
                    <strong className="text-slate-700 dark:text-slate-300 font-bold">{selected.audit?.userName || "ERP USER"}</strong>
                  </div>
                  <div>
                    <span>{t("created_on_label", currentLanguage)} </span>
                    <strong className="text-slate-700 dark:text-slate-300 font-bold">{date(selected.created_at)} {selected.created_at ? new Date(selected.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ""}</strong>
                  </div>
                </div>

                {/* Summary & Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-border">
                  <div className="text-xs space-y-0.5 text-muted-foreground">
                    <div>
                      <span className="font-bold text-foreground">{t("posting_colon", currentLanguage)}</span>
                      <><span className="font-bold text-indigo-600">{translateHeader(currentLanguage, "DR")}</span> {doubleEntry.debitName} ({doubleEntry.debitCode}) / <span className="font-bold text-violet-600">{translateHeader(currentLanguage, "CR")}</span> {doubleEntry.creditName} ({doubleEntry.creditCode})</>
                    </div>
                    <div><span className="font-bold text-foreground">{t("amount_colon", currentLanguage)}</span>{amount ? money(amount, baseCurrency) : "â"}</div>
                    {selected && (
                      <div className="mt-1">
                        {(() => {
                          const form = selected.form_data?.form || {};
                          const totalPrice = (selected as any).form_data?.goodsEntries?.length
                            ? (selected as any).form_data.goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
                            : Number(form.totalAmount || 0);
                          const advancePercent = Number(form.advancePercent || 0);
                          const requiredAdvanceBC = (totalPrice * advancePercent) / 100;
                          const paidAdvanceBC = Number(selected.paid_amount || 0);
                          const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
                          const remainingDue = Number(selected.remaining_amount || 0);

                          if (activeMode === "advance") {
                            const displayAdvance = remainingAdvanceBC > 0 ? remainingAdvanceBC : remainingDue;
                            return (
                              <div className="flex flex-col gap-1">
                                <div>
                                  <span className="font-bold text-foreground">
                                    {currentLanguage === "en"
                                      ? (remainingAdvanceBC > 0 ? "Remaining Advance to Pay: " : "Remaining Balance for Advance/Endorsement: ")
                                      : (remainingAdvanceBC > 0 ? "Ø¨Ø§ÙÛ Ø§ÛÚÙØ§ÙØ³ Ø§Ø¯Ø§Ø¦ÛÚ¯Û: " : "Ø¨Ø§ÙÛ Ø¨Ù Ø±ÙÙ (Ø§ÛÚÙØ§ÙØ³/Ø§ÙÚÙØ±Ø³ÙÙÙ¹): ")}
                                  </span>
                                  <span className="font-extrabold text-rose-600">
                                    {money(displayAdvance, selected.currency_code ?? "USD")} ({money(displayAdvance * (selected.exchange_rate || 1), baseCurrency)})
                                  </span>
                                </div>
                                <div className="text-[10px]">
                                  <span className="font-bold text-muted-foreground">{t("total_remaining_bill_colon", currentLanguage)}</span>
                                  <span className="font-bold text-slate-500">
                                    {money(remainingDue, selected.currency_code ?? "USD")} ({money(remainingDue * (selected.exchange_rate || 1), baseCurrency)})
                                  </span>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div>
                                <span className="font-bold text-foreground">{t("remaining_bill_balance_baqaya_colon", currentLanguage)}</span>
                                <span className="font-extrabold text-rose-600">
                                  {money(remainingDue, selected.currency_code ?? "USD")} ({money(remainingDue * (selected.exchange_rate || 1), baseCurrency)})
                                </span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>

                  {(() => {
                    // Every reason Save could be disabled, named plainly â a disabled button
                    // must never be silent about why.
                    const missing: string[] = [];
                    if (!paymentSourceLedgerId) missing.push(t("payment_source_account", currentLanguage));
                    if (!roznamchaNumber) missing.push(t("roznamcha_voucher_number", currentLanguage));
                    if (!paymentType) missing.push(t("payment_type_select_source_hint", currentLanguage));
                    if (!(amount > 0)) missing.push(t("payment_amount_gt_zero", currentLanguage));
                    return (
                      <>
                        <Button
                          type="button"
                          onClick={handleProcessPayment}
                          disabled={processingPayment || missing.length > 0}
                          className="h-10 px-6 font-bold text-xs uppercase shadow-md transition bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {processingPayment ? t("processing_label", currentLanguage) : (
                            activeMode === "advance" ? t("post_advance_payment", currentLanguage) : activeMode === "credit" ? t("post_credit_payment", currentLanguage) : t("post_remaining_payment", currentLanguage)
                          )}
                        </Button>
                        {!processingPayment && missing.length > 0 && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                            {t("save_disabled_prefix", currentLanguage)}
                            {missing.join(t("list_separator", currentLanguage))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Feedback messages */}
                {paymentSuccess && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-sm text-emerald-700 animate-in fade-in duration-300">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold mb-0.5">{t("payment_posted_successfully", currentLanguage)}</div>
                      <div className="text-xs">{paymentSuccess}</div>
                    </div>
                  </div>
                )}
                {paymentError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    â {paymentError}
                  </div>
                )}
              </div>

              {/* Double-entry Preview, Ledger Posting, and supporting notes */}
              <div className="xl:col-span-5 space-y-4">
                {/* Unified Professional Payment Summary Context Card */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
                  <div className="mb-3 flex items-center justify-between border-b border-blue-200/70 pb-2 dark:border-blue-900/60">
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      {t("professional_payment_summary", currentLanguage)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700 shadow-sm dark:bg-blue-950 dark:text-blue-200">
                      {selected.payment_status ? t(selected.payment_status, currentLanguage) : t("Pending", currentLanguage)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* 1. Original Purchase Amount */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("original_purchase_amount", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                        {money(loadingPurchaseAmount, poCurrency)}
                      </div>
                    </div>
                    {/* 2. Purchase Currency */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("purchase_currency", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                        {poCurrency}
                      </div>
                    </div>
                    {/* 3. Exchange Rate */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("exchange_rate_label", currentLanguage)}
                      </div>
                      <div className="font-mono text-[10px] font-black text-slate-900 dark:text-slate-100">
                        1 {poCurrency} = {Number(exchangeRate || 1).toFixed(4)} {baseCurrency}
                      </div>
                    </div>
                    {/* 4. Final Converted Amount */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("final_converted_amount", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                        {money(loadingPurchaseAmount * Number(exchangeRate || 1), baseCurrency)}
                      </div>
                    </div>
                    {/* 5. Total Advance Required */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("total_advance_required", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-blue-700 dark:text-blue-300">
                        {money(loadingRequiredAdvance, poCurrency)}
                      </div>
                    </div>
                    {/* 6. Total Paid */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("total_paid", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                        {money(totalPaidSoFar, poCurrency)}
                      </div>
                    </div>
                    {/* 7. Outstanding Amount */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("outstanding_amount", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
                        {money(outstandingBalance, poCurrency)}
                      </div>
                    </div>
                    {/* 8. Remaining Balance */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {t("remaining_balance_label", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-rose-700 dark:text-rose-300">
                        {money(outstandingBalance * Number(exchangeRate || 1), baseCurrency)}
                      </div>
                    </div>
                    {/* 9. Final Debit Amount */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50 ring-1 ring-inset ring-indigo-400/20">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-indigo-600">
                        {t("final_debit_amount", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-300">
                        {money(showCalcPanel && calcFinal !== null ? calcFinal : Number(finalPayment || 0), baseCurrency)}
                      </div>
                    </div>
                    {/* 10. Final Credit Amount */}
                    <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-950/50 ring-1 ring-inset ring-purple-400/20">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-purple-600">
                        {t("final_credit_amount", currentLanguage)}
                      </div>
                      <div className="font-mono text-xs font-black text-purple-700 dark:text-purple-300">
                        {money(showCalcPanel && calcFinal !== null ? calcFinal : Number(finalPayment || 0), baseCurrency)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mt-4 block">
                  {t("double_entry_posting_preview", currentLanguage)}
                </div>
                <div className="overflow-x-auto rounded-xl border border-border bg-white dark:bg-slate-950">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/60 border-b border-border text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                        <Th className="px-3 py-2.5 text-left w-16">{translateHeader(currentLanguage, "DR / CR")}</Th>
                        <Th className="px-3 py-2.5 text-left">{t("account_label", currentLanguage)}</Th>
                        <Th className="px-3 py-2.5 text-right">{t("amount_label", currentLanguage)} ({poCurrency})</Th>
                        <Th className="px-3 py-2.5 text-right">{t("amount_label", currentLanguage)} ({baseCurrency})</Th>
                        <Th className="px-2 py-2.5 text-center">â</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const previewUsd = showCalcPanel 
                          ? (currency === baseCurrency ? amount : Number(calcAmount || 0)) 
                          : (amount / Number(exchangeRate || 1));
                        const previewAed = amount;

                        return (
                          <>
                            <tr className="border-b border-border bg-indigo-500/5 ring-1 ring-inset ring-indigo-400/20">
                              <td className="px-3 py-3 font-black text-xs text-indigo-600">{translateHeader(currentLanguage, "DR")}</td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-foreground line-clamp-1">{doubleEntry.debitName}</div>
                                <div className="text-[9px] text-muted-foreground font-mono">
                                  {doubleEntry.debitCode} {doubleEntry.debitBranch && doubleEntry.debitBranch !== "-" && `| ${t("branch", currentLanguage)}: ${doubleEntry.debitBranch}`}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">
                                {previewUsd > 0 ? money(previewUsd, poCurrency) : "â"}
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">
                                {previewAed > 0 ? money(previewAed, baseCurrency) : "â"}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <input
                                  type="radio"
                                  checked
                                  readOnly
                                  className="h-3.5 w-3.5 accent-indigo-600"
                                />
                              </td>
                            </tr>
                            <tr className="bg-violet-500/5 ring-1 ring-inset ring-violet-400/20">
                              <td className="px-3 py-3 font-black text-xs text-violet-600">{translateHeader(currentLanguage, "CR")}</td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-foreground line-clamp-1">{doubleEntry.creditName}</div>
                                <div className="text-[9px] text-muted-foreground font-mono">
                                  {doubleEntry.creditCode} {doubleEntry.creditBranch && doubleEntry.creditBranch !== "-" && `| ${t("branch", currentLanguage)}: ${doubleEntry.creditBranch}`}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-violet-600 whitespace-nowrap">
                                {previewUsd > 0 ? money(previewUsd, poCurrency) : "â"}
                              </td>
                              <td className="px-3 py-3 text-right font-mono font-bold text-violet-600 whitespace-nowrap">
                                {previewAed > 0 ? money(previewAed, baseCurrency) : "â"}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <input
                                  type="radio"
                                  checked
                                  readOnly
                                  className="h-3.5 w-3.5 accent-violet-600"
                                />
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-[11px] text-muted-foreground dark:border-slate-800 dark:bg-slate-900/30 leading-relaxed space-y-2">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    {t("double_entry_posting_guide", currentLanguage)}
                  </div>
                  <p>
                    {t("every_transaction_balances", currentLanguage)}
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>{t("debit_records_updated", currentLanguage)}</li>
                    <li>{t("credit_records_deduct", currentLanguage)}</li>
                    <li>{t("exchange_conversion_calculates", currentLanguage).replace("{baseCurrency}", baseCurrency)}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </SimpleModal>
    )}


      {addOptionOpen ? (
        <SimpleModal
          title={addOptionType === "bank" ? "Add New Bank" : "Payment Method Manager"}
          onClose={() => setAddOptionOpen(false)}
          className="max-w-md"
        >
          {addOptionType === "bank" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-black">{translateHeader(currentLanguage, "Bank Name")}</Label>
                <Input
                  className="text-xs font-semibold"
                  value={addOptionValue}
                  onChange={(e) => setAddOptionValue(e.target.value)}
                  placeholder="e.g. HBL Karachi Branch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-black">{translateHeader(currentLanguage, "Bank Address")}</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none"
                  value={addOptionAddress}
                  onChange={(e) => setAddOptionAddress(e.target.value)}
                  placeholder={t("bank_branch_address_ph", currentLanguage)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  {translateHeader(currentLanguage, "Cancel")}
                </Button>
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs" onClick={commitAddOption}>
                  {translateHeader(currentLanguage, "Save Bank")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 pb-3 border-b">
                <Label className="text-xs font-black">{translateHeader(currentLanguage, "Add New Payment Method")}</Label>
                <div className="flex gap-2">
                  <Input
                    className="text-xs font-semibold"
                    value={addOptionValue}
                    onChange={(e) => setAddOptionValue(e.target.value)}
                    placeholder={translateHeader(currentLanguage, "e.g. EasyPaisa / JazzCash")}
                  />
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs" onClick={commitAddOption}>
                    {translateHeader(currentLanguage, "Add")}
                  </Button>
                </div>
              </div>

              {savedMethods.length > 0 ? (
                <div className="space-y-2">
                      <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                    {savedMethods.map((m) => (
                      <div key={m} className="flex items-center gap-2">
                        <Input
                          defaultValue={m}
                          className="h-8 text-xs font-semibold"
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== m) {
                              renameCustomMethod(m, val);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] font-bold"
                          onClick={() => deleteCustomMethod(m)}
                        >
                          {translateHeader(currentLanguage, "Delete")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 italic text-center py-2">
                  {translateHeader(currentLanguage, "No custom payment methods added yet.")}
                </p>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  {translateHeader(currentLanguage, "Close")}
                </Button>
              </div>
            </div>
          )}
        </SimpleModal>
      ) : null}

      {/* Detailed PO Modal */}
      {viewingRow && (
        <OpenFullBillModal
          isOpen={Boolean(viewingRow)}
          onClose={() => setViewingRow(null)}
          order={viewingRow}
          payments={viewingRowPayments}
          lang={currentLanguage}
          onOpenPaymentEntry={(ord) => {
            setViewingRow(null);
            selectOrder(ord.id);
          }}
        />
      )}

      {editingPayment && (
        <PaymentEditModal
          open={!!editingPayment}
          onOpenChange={(open) => !open && setEditingPayment(null)}
          payment={editingPayment.payment}
          row={editingPayment.row}
          session={session}
          ledgers={ledgers}
          baseCurrency={baseCurrency}
          onSuccess={() => {
            const el = document.getElementById("refresh-btn");
            if (el) el.click();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sublabel, icon, tone }: KpiCard) {
  const colorClasses = {
    blue: {
      text: "text-blue-800 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/30",
      iconText: "text-blue-800 dark:text-blue-400"
    },
    green: {
      text: "text-emerald-700 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
      iconText: "text-emerald-700 dark:text-emerald-400"
    },
    amber: {
      text: "text-amber-700 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/30",
      iconText: "text-amber-700 dark:text-amber-400"
    },
    red: {
      text: "text-red-700 dark:text-red-400",
      iconBg: "bg-red-50 dark:bg-red-950/30",
      iconText: "text-red-700 dark:text-red-400"
    },
    slate: {
      text: "text-slate-700 dark:text-slate-300",
      iconBg: "bg-slate-50 dark:bg-slate-800",
      iconText: "text-slate-600 dark:text-slate-400"
    }
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorClasses.iconBg, colorClasses.iconText)}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "h-5 w-5" }) : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{label}</p>
        <p className={cn("mt-0.5 text-lg font-extrabold tracking-tight", colorClasses.text)}>{value}</p>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{sublabel}</p>
      </div>
    </div>
  );
}

function MiniFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{translateHeader(currentLanguage, label)}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary">
        <option value="">{translateHeader(currentLanguage, "All")}</option>
        {options.map((option) => <option key={option} value={option.toLowerCase()}>{translateHeader(currentLanguage, option)}</option>)}
      </select>
    </label>
  );
}

function ReportActions({ rows, mode }: { rows: PurchaseOrderRow[]; mode: PaymentMode }) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  function handleReportAction(fn: () => void) {
    fn();
    const details = document.activeElement?.closest("details");
    if (details) (details as HTMLDetailsElement).open = false;
  }
  return (
    <details className="relative">
      <summary className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-input bg-background text-foreground transition hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label={translateHeader(currentLanguage, "Payment report actions")} title={translateHeader(currentLanguage, "Payment report actions")}>
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl">
        <MenuAction icon={<Eye />} label={t("plate_view", currentLanguage)} onClick={() => handleReportAction(() => undefined)} />
        <MenuAction icon={<DownloadActionIcon />} label={t("download", currentLanguage)} onClick={() => handleReportAction(() => exportRows(rows, mode))} />
        <MenuAction icon={<FileSpreadsheet />} label={t("export_excel", currentLanguage)} onClick={() => handleReportAction(() => exportRows(rows, mode))} />
        <MenuAction icon={<DownloadActionIcon />} label={t("export_pdf", currentLanguage)} onClick={() => handleReportAction(() => {
          import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
            openGenericErpReport({
              title: t("sales_order_payment_journal", currentLanguage),
              subtitle: `${translateHeader(currentLanguage, "Mode")}: ${mode.toUpperCase()} | ${translateHeader(currentLanguage, "Total")} ${rows.length} ${translateHeader(currentLanguage, "Records")}`,
              columns: [
                { key: "po_no", label: t("col_po_booking", currentLanguage) },
                { key: "branch", label: t("branch", currentLanguage) },
                { key: "supplier_customer", label: t("col_party_name", currentLanguage) },
                { key: "mode", label: t("col_mode", currentLanguage) },
                { key: "bank_name", label: t("col_bank_account", currentLanguage) },
                { key: "amount", label: t("col_amount", currentLanguage), format: "currency" },
                { key: "status", label: translateHeader(currentLanguage, "Status"), format: "status" }
              ],
              rows: rows as Record<string, unknown>[]
            });
          });
        })} />
        <MenuAction icon={<Printer />} label={t("print_btn", currentLanguage)} onClick={() => handleReportAction(() => {
          import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
            openGenericErpReport({
              title: t("sales_order_payment_journal", currentLanguage),
              subtitle: `${translateHeader(currentLanguage, "Mode")}: ${mode.toUpperCase()} | ${translateHeader(currentLanguage, "Total")} ${rows.length} ${translateHeader(currentLanguage, "Records")}`,
              columns: [
                { key: "po_no", label: t("col_po_booking", currentLanguage) },
                { key: "branch", label: t("branch", currentLanguage) },
                { key: "supplier_customer", label: t("col_party_name", currentLanguage) },
                { key: "mode", label: t("col_mode", currentLanguage) },
                { key: "bank_name", label: t("col_bank_account", currentLanguage) },
                { key: "amount", label: t("col_amount", currentLanguage), format: "currency" },
                { key: "status", label: translateHeader(currentLanguage, "Status"), format: "status" }
              ],
              rows: rows as Record<string, unknown>[]
            });
          });
        })} />
      </div>
    </details>
  );
}

function RowActions({ onSelect, rowId }: { onSelect: () => void; rowId: string }) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef<HTMLButtonElement>(null);

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 192 });
    }
    setOpen((o) => !o);
  }

  function handleItem(fn: () => void) {
    fn();
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick() { setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: 32, width: 32, borderRadius: 8,
          border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer",
          color: "#64748b", transition: "background 0.15s"
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
        aria-label={t("row_actions", currentLanguage)}
      >
        <MoreVertical style={{ width: 15, height: 15 }} />
      </button>

      {open && typeof document !== "undefined" && (
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            minWidth: 192,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.14)",
            padding: "4px",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[
            { icon: <Eye style={{ width: 14, height: 14 }} />, label: t("row_view_details", currentLanguage), color: "#2563eb", fn: () => handleItem(onSelect) },
            { icon: <WalletCards style={{ width: 14, height: 14 }} />, label: t("payment_history", currentLanguage), color: "#7c3aed", fn: () => handleItem(onSelect) },
            { icon: <Banknote style={{ width: 14, height: 14 }} />, label: t("journal_entry", currentLanguage), color: "#059669", fn: () => handleItem(onSelect) },
            { icon: <Printer style={{ width: 14, height: 14 }} />, label: t("print_btn", currentLanguage), color: "#475569", fn: () => handleItem(onSelect) },
            { icon: <DownloadActionIcon />, label: t("export_pdf", currentLanguage), color: "#dc2626", fn: () => handleItem(onSelect) },
          ].map(({ icon, label, color, fn }) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 12px",
                background: "none", border: "none", borderRadius: 8,
                cursor: "pointer", textAlign: "left",
                fontSize: 12, fontWeight: 600, color: "#1e293b",
                transition: "background 0.12s"
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              <span style={{ color, flexShrink: 0 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted">
      <span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5 last:border-b-0 dark:border-slate-800">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-semibold text-foreground text-right truncate max-w-[200px]", highlight && "text-primary font-black")}>{value}</span>
    </div>
  );
}

function getStatusBadge(status: string | null | undefined) {
  const badgeStyle = statusClass(status);
  return (
    <span className={cn("inline-flex rounded border px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap shadow-sm tracking-wider", badgeStyle)}>
      {status || "Pending"}
    </span>
  );
}















