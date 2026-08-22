"use client";
 
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { printStore } from "@/lib/store/print-store";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Landmark,
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  Save,
  Paperclip,
  Plus,
  Minus,
  FileText,
  CheckCircle,
  XCircle,
  WalletCards,
  Edit3,
  Truck,
  Ship,
  Info,
  User,
  Shield,
  Home,
  Globe,
  Fingerprint
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
import { Th } from "@/components/ui/translated-th";
import { t, tData, type LanguageCode } from "@/features/i18n/purchase-journal-translations";
import { t as tGlobal } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
function isUuid(value: any): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

type PaymentMode = "advance" | "advance_completed" | "remaining" | "credit" | "charges" | "history";

type PurchaseOrderRow = {
  id: string;
  purchase_order_no: string;
  purchase_contract_no: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  currency_code: string | null;
  payment_currency?: string | null;
  currency?: string | null;
  exchange_rate: number | null;
  order_total: number | null;
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

function handlePrintReceipt(payment: any, orderRow: any, ledgers: any[], localCurrency: string, autoPrint = true) {
  const drLedger = ledgers.find((l) => (l.id || l.account_id) === payment.debit_ledger_id);
  const crLedger = ledgers.find((l) => (l.id || l.account_id) === payment.credit_ledger_id);
  const drLabel = drLedger ? (drLedger.account_name || drLedger.name) : "-";
  const crLabel = crLedger ? (crLedger.account_name || crLedger.name) : "-";
  const re = payment.roznamcha_entries || {};
  const form = orderRow?.form_data?.form || {};
  
  const companyName = "DAMAAN BUSINESS GROUP";
  const receiptTitle = "PAYMENT RECEIPT";
  const receiptNo = payment.reference_no || re.super_admin_serial_number || "N/A";
  const printDate = new Date().toLocaleString();
  const paymentDate = new Date(payment.entry_date || payment.created_at).toLocaleDateString();
  const purchaseDate = form.orderDate ? new Date(form.orderDate).toLocaleDateString() : "N/A";
  const poNo = orderRow?.purchase_order_no || "N/A";
  const contractNo = orderRow?.purchase_contract_no || "N/A";
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

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${receiptTitle} - ${receiptNo}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; }
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-left">
            <h1>${companyName}</h1>
            <p>Purchase Payment Receipt</p>
          </div>
          <div class="header-right">
            <h2>RECEIPT</h2>
            <p>No: ${receiptNo}</p>
            <p style="font-weight: normal; color: #64748b; font-size: 10px;">Printed: ${printDate}</p>
          </div>
        </div>

        <div class="section-title">Purchase & Vendor Details</div>
        <table>
          <tr>
            <Th>Purchase Order No</Th><td><strong>${poNo}</strong></td>
            <Th>Contract / GRN No</Th><td>${contractNo}</td>
          </tr>
          <tr>
            <Th>Supplier Name</Th><td colspan="3"><strong>${vendorName}</strong></td>
          </tr>
          <tr>
            <Th>Purchase Date</Th><td>${purchaseDate}</td>
            <Th>Currency</Th><td><strong>${currency}</strong></td>
          </tr>
        </table>

        <div class="section-title">Purchase Financial Summary</div>
        <table>
          <tr>
            <Th>Goods Total Amount</Th><td class="text-right">${Number(goodsTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <Th>Discount</Th><td class="text-right">${Number(discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <Th>Freight Charges</Th><td class="text-right">${Number(freight).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <Th>Grand Total (${currency})</Th><td class="text-right font-bold">${Number(grandTotalFC).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <div class="section-title">Accounting & Audit Trail</div>
        <table>
          <tr>
            <Th>Debit Ledger (Dr)</Th><td colspan="3">${drLabel}</td>
          </tr>
          <tr>
            <Th>Credit Ledger (Cr)</Th><td colspan="3">${crLabel}</td>
          </tr>
          <tr>
            <Th>Payment Date</Th><td>${paymentDate}</td>
            <Th>Posted By</Th><td>${re.profiles?.full_name ? re.profiles.full_name.toUpperCase() : "SUPER ADMIN"}</td>
          </tr>
          <tr>
            <Th>Reference No</Th><td>${payment.reference_no || "-"}</td>
            <Th>Journal Serial</Th><td>${re.super_admin_serial_number || "-"}</td>
          </tr>
          <tr>
            <Th>Remarks</Th><td colspan="3">${displayNarration || "-"}</td>
          </tr>
        </table>

        <div class="section-title">Payment Summary</div>
        <div class="summary-box">
          <div class="summary-item">
            <div class="lbl">Previously Paid</div>
            <div class="val">${Number(prevPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item highlight">
            <div class="lbl">Current Payment</div>
            <div class="val">${Number(paymentAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl">Total Paid to Date</div>
            <div class="val">${Number(totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl" style="color: #be123c;">Running Purchase Balance</div>
            <div class="val" style="color: #be123c;">${Number(outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="footer">
          <div class="sig-block">
            <div class="sig-line">Prepared By</div>
          </div>
          <div class="sig-block" style="width: auto;">
            <div class="stamp-box">COMPANY<br/>STAMP</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Authorized Signatory</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Receiver Signature</div>
          </div>
        </div>
        
        <div class="sys-gen">
          <div class="qr-placeholder">VERIFY<br/>QR</div>
          *** THIS IS A SYSTEM GENERATED DOCUMENT ***<br/>
          UUID: ${payment.id || "N/A"} | Exchange Rate Applied: ${paymentExRate.toFixed(4)}
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
  return row?.form_data?.form || {};
}

function rowCountryName(row: PurchaseOrderRow) {
  if (!row) return "Unknown Country";
  const form = rowForm(row);
  const rawCountry = String(row.countryName || (row as any).country_name || form.branchCountry || form.countryName || form.loadingCountry || form.destinationCountry || form.originCountry || "Unknown Country").trim();
  const c = rawCountry.toUpperCase();
  if (c.includes("PAKISTAN") || c === "QUETTA" || c === "CHAMAN" || c === "KARACHI" || c === "ISLAMABAD" || c === "PESHAWAR" || c === "MULTAN" || c === "LAHORE") {
    return "Pakistan";
  }
  if (c.includes("UAE") || c.includes("EMIRATES") || c === "DUBAI" || c === "ABU DHABI" || c === "SHARJAH") {
    return "United Arab Emirates";
  }
  return rawCountry || "Unknown Country";
}

function rowBranchName(row: PurchaseOrderRow) {
  if (!row) return "Unassigned Branch";
  const form = rowForm(row);
  return String((row as any).branchName || (row as any).branch_name || form.branchName || form.purchaseAccountBranch || form.salesAccountBranch || "Unassigned Branch");
}

function rowCurrency(row: PurchaseOrderRow) {
  if (!row) return "USD";
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
  const country = (rowCountryName(row) || "").toLowerCase();
  return COUNTRY_CURRENCY[country] || "USD";
}

function rowOfficeCurrency(row: PurchaseOrderRow): string {
  if (!row) return "USD";
  const country = (rowCountryName(row) || "").toUpperCase();
  if (country.includes("PAKISTAN")) return "PKR";
  if (country.includes("EMIRATES") || country.includes("UAE") || country.includes("DUBAI")) return "AED";
  if (country.includes("CHINA")) return "CNY";
  if (country.includes("INDIA")) return "INR";
  if (country.includes("AFGHANISTAN")) return "AFN";
  return "USD";
}

const USD_EXCHANGE: Record<string, number> = {
  "USD": 1.0,
  "AED": 1 / 3.6725,
  "PKR": 1 / 278.5,
  "AFN": 1 / 70.5,
  "INR": 1 / 83.5,
  "IRR": 1 / 42000
};

function getUsdExchangeRate(cur: string, row: any, liveRates: any[] = []) {
  if (cur === "USD") return 1.0;
  const match = liveRates.find((r) => r.currency_code === cur);
  if (match && Number(match.exchange_rate || 0) > 0) return Number(match.exchange_rate);
  const staticRate = USD_EXCHANGE[cur];
  if (staticRate !== undefined) return staticRate;
  
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
  return pct > 0 ? (orderTotal(row) * pct) / 100 : Number(row.advance_paid || 0);
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
    const rawAdv = Number(row.advance_paid || form.advanceAmount || 0);
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
    userName: session?.name || session?.username || session?.user?.fullName || "SUPER ADMIN",
    userId: session?.userId || session?.user?.id || "SA001",
    role: session?.role || "Super Admin",
    
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

    const advancePaidRaw = parseNumber(row.advance_paid || 0);
    const advancePaidFC = (conversionRate > 1 && advancePaidRaw > invoiceAmountFC * 1.05) ? advancePaidRaw / conversionRate : advancePaidRaw;
    const advancePaidLC = advancePaidFC * conversionRate;

    const explicitRemainingRaw = parseNumber(row.remaining_due || 0);
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
  const loadedQty = Number(payload.loadedQuantity || payload.loadQty || loadingRecord?.loadedQuantity || loadingRecord?.loaded_quantity || 0);
  const netWeight = Number(payload.netWeight || payload.netWt || loadingRecord?.net_weight || 0);
  const grossWeight = Number(payload.grossWeight || payload.grossWt || loadingRecord?.gross_weight || 0);
  const priceRate = Number(payload.priceRateC1 || payload.priceRate || payload.purchaseRate || loadingRecord?.purchase_rate || firstGood.priceRate || firstGood.rate || 0);
  const isPerKg = String(firstGood.priceType || payload.priceType || "").toLowerCase().includes("kg");
  const totalQuantity = Number(
    poRow?.form_data?.totals?.totalQuantity ||
    goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || item.qty || 0), 0) ||
    form.quantity ||
    0
  );
  const contractPurchase = Number(
    firstGood.totalAmount ||
    form.totalAmount ||
    poRow?.order_total ||
    0
  );
  const explicitPurchase = Number(payload.totalPurchase || payload.purchaseAmount || loadingRecord?.purchase_amount || 0);
  const calculatedPurchase = isPerKg && netWeight > 0 && priceRate > 0
    ? netWeight * priceRate
    : loadedQty > 0 && priceRate > 0
      ? loadedQty * priceRate
      : totalQuantity > 0 && loadedQty > 0 && contractPurchase > 0
        ? (loadedQty / totalQuantity) * contractPurchase
        : 0;
  const totalPurchase = explicitPurchase > 0 ? explicitPurchase : calculatedPurchase;
  const exchangeRate = Number(
    payload.exchangeRate ||
    loadingRecord?.exchange_rate ||
    poRow?.exchange_rate ||
    form.exchangeRate ||
    1
  ) || 1;
  return {
    amountUSD: totalPurchase,
    amountPKR: totalPurchase * exchangeRate,
    currency: payload.currency || loadingRecord?.currency || form.currencyType || form.currency || poRow?.currency_code || "USD",
    exRate: exchangeRate,
    loadedQty,
    totalQuantity,
    netWeight,
    grossWeight
  };
}

function normalizeAdvanceToPurchaseCurrency(rawAdvance: number, purchaseAmount: number, exchangeRate: number) {
  if (!Number.isFinite(rawAdvance) || rawAdvance <= 0) return 0;
  const rate = Number(exchangeRate || 1) || 1;
  const purchase = Number(purchaseAmount || 0);
  return rate > 1 && purchase > 0 && rawAdvance > purchase * 1.05 ? rawAdvance / rate : rawAdvance;
}

function allocateAdvanceForLoadedBill(rawAdvance: number, loadingFinance: ReturnType<typeof calcLoadingFinance> | null, purchaseAmount: number, exchangeRate: number) {
  const normalized = normalizeAdvanceToPurchaseCurrency(rawAdvance, purchaseAmount, exchangeRate);
  if (!loadingFinance) return normalized;
  const ratio = loadingFinance.totalQuantity > 0 && loadingFinance.loadedQty > 0
    ? loadingFinance.loadedQty / loadingFinance.totalQuantity
    : 1;
  return Math.min(loadingFinance.amountUSD, normalized * ratio);
}
function kpis(rows: PurchaseOrderRow[], baseCurrency: string): KpiCard[] {
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
    const paidAdvanceLC = Number(row.advance_paid || 0) * conversionRate;
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
      label: "Total Purchase",
      value: money(totalPurchaseUSD, purchCur),
      sublabel: "Original Currency Total",
      icon: <FileText className="h-5 w-5" />,
      tone: "blue"
    },
    {
      label: "Total Invoice Value",
      value: money(totalInvoiceValueLC, localCur),
      sublabel: "Local Currency Total",
      icon: <Banknote className="h-5 w-5" />,
      tone: "green"
    },
    {
      label: "Total Advance Paid",
      value: money(totalAdvancePaidLC, localCur),
      sublabel: "Advance Paid to Date",
      icon: <CheckCircle className="h-5 w-5" />,
      tone: "amber"
    },
    {
      label: "Total Outstanding Balance",
      value: money(totalOutstandingBalanceLC, localCur),
      sublabel: "Remaining Due to Clear",
      icon: <XCircle className="h-5 w-5" />,
      tone: "red"
    },
    {
      label: "Average Exchange Rate",
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
        row.purchase_order_no,
        row.purchase_contract_no ?? "-",
        date(row.created_at),
        row.currency_code ?? "-",
        money(row.order_total),
        money(row.advance_paid),
        money(row.remaining_due),
        money(row.credit_amount),
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
  if (typeof window === "undefined" || !window.location) return "";
  try {
    return new URLSearchParams(window.location.search).get("purchaseOrderNo") ?? "";
  } catch {
    return "";
  }
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
  function handleAction(fn: () => void) {
    fn();
    const details = document.activeElement?.closest("details");
    if (details) (details as HTMLDetailsElement).open = false;
  }
  return (
    <details className="relative">
      <summary className="flex h-7 w-8 cursor-pointer list-none items-center justify-center rounded border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 [&::-webkit-details-marker]:hidden mx-auto" aria-label="Payment actions" title="Actions">
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl">
        <MenuAction icon={<Eye />} label="View Details" onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, false))} />
        <MenuAction icon={<Edit3 />} label="Edit Line" onClick={() => handleAction(() => window.dispatchEvent(new CustomEvent("open-edit-payment", { detail: { payment, row } })))} />
        <MenuAction icon={<Printer />} label="Print Receipt" onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, true))} />
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
  onOpenFullBill,
  loadingRemainingLoadingRecords = false
}: { 
  row: any, 
  ledgers: any[], 
  baseCurrency: string, 
  activeMode: string,
  selectOrder: (id: string) => void,
  expandedIds: Record<string, boolean>,
  setExpandedIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  logClientError: (msg: string) => void,
  onOpenFullBill?: () => void,
  loadingRemainingLoadingRecords?: boolean
}) {
  const currentLanguage = useActiveLanguage() as LanguageCode;
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPayments() {
      setLoading(true);
      try {
        const response = await fetch(`/api/erp/purchases/orders/${row.id}/payments?lang=${currentLanguage}`, { credentials: "include" });
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
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">Endorsement Audit Console</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <h3 className="text-2xl font-black tracking-tight">{row.purchase_order_no || "Purchase Order"}</h3>
              <span className="mb-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-100">{historyWithBalance.length} Posted Entries</span>
              <span className="mb-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-100">{purchaseCurrency} to {calcs.finalCurr}</span>
            </div>
            <p className="mt-2 max-w-4xl text-xs font-semibold leading-5 text-slate-300">Complete endorsement payment audit: purchase order, supplier, goods, debit ledger, credit ledger, exchange rate, local currency amount, running balance, and journal reference in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenFullBill && (
              <button
                type="button"
                onClick={onOpenFullBill}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-sm transition hover:bg-blue-50"
              >
                <Eye className="h-4 w-4" />
                Open Full Bill
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-px bg-slate-800 p-px md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purchase Required</div>
            <div className="mt-1 font-mono text-lg font-black text-slate-950 dark:text-white">{money(statementAdvanceRequiredForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {money(statementAdvanceRequiredLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Received / Paid</div>
            <div className="mt-1 font-mono text-lg font-black text-emerald-600">{money(statementReceivedForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {money(statementReceivedLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining Balance</div>
            <div className="mt-1 font-mono text-lg font-black text-rose-600">{statementBalanceForeign <= 0.01 ? "Cleared" : money(statementBalanceForeign, purchaseCurrency)}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-500">Local: {statementBalanceLocal <= 0.01 ? "Cleared" : money(statementBalanceLocal, calcs.finalCurr)}</div>
          </div>
          <div className="bg-white p-4 dark:bg-slate-950">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ledger Route</div>
            <div className="mt-1 truncate text-sm font-black text-blue-700 dark:text-blue-300" title={form.purchaseAccountName || "Debit Account"}>DR: {form.purchaseAccountName || "Debit Account"}</div>
            <div className="mt-1 truncate text-sm font-black text-rose-700 dark:text-rose-300" title={form.salesAccountName || "Credit Account"}>CR: {form.salesAccountName || "Credit Account"}</div>
          </div>
        </div>
      </div>
      {/* Visual Calculation Flow sequence */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/80 shadow-inner">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          Purchase Order Financial Conversion Flow
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
          {/* Column 1: Original Currency Breakdown */}
          <div className="flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg p-3 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2.5">
              Original Currency Flow ({calcs.purchCurr})
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Total Purchase Amount:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200">{money(calcs.totalPurchaseFC, calcs.purchCurr)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Invoice / Advance %:</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-mono font-black dark:bg-blue-950/40 dark:text-blue-400">{calcs.advancePercent}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Invoice / Advance Amount:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{money(calcs.advanceAmountFC, calcs.purchCurr)}</span>
              </div>
              <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 my-1"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-800 dark:text-slate-200 font-bold">Remaining Purchase Balance:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(calcs.remainingPurchaseFC, calcs.purchCurr)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Conversion Rate Bridge */}
          <div className="flex flex-col justify-center items-center p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800/80 shadow-sm relative overflow-hidden text-center min-h-[92px]">
            <div className="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black bg-indigo-50 text-indigo-700 rounded-bl dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-widest">BRIDGE</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Exchange Rate Applied</div>
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
        {(loading || loadingRemainingLoadingRecords) && (
          <span className="text-[10px] font-semibold text-slate-400 animate-pulse">{t("loading_history", currentLanguage)}</span>
        )}
      </div>
      {payments.length > 0 ? (
        <>
          <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Advance / Endorse Required</div>
              <div className="mt-0.5 font-mono text-sm font-black text-slate-900 dark:text-slate-100">{money(statementAdvanceRequiredForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {money(statementAdvanceRequiredLocal, calcs.finalCurr)}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Total Received / Paid</div>
              <div className="mt-0.5 font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">{money(statementReceivedForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {money(statementReceivedLocal, calcs.finalCurr)}</div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 dark:border-rose-900 dark:bg-rose-950/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Final Advance Balance</div>
              <div className="mt-0.5 font-mono text-sm font-black text-rose-700 dark:text-rose-300">{statementBalanceForeign <= 0.01 ? "Cleared" : money(statementBalanceForeign, purchaseCurrency)}</div>
              <div className="text-[10px] font-bold text-slate-500">Office currency: {statementBalanceLocal <= 0.01 ? "Cleared" : money(statementBalanceLocal, calcs.finalCurr)}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 border-b font-bold text-slate-600 uppercase text-[10px] tracking-wider">
                <Th className="px-3 py-2.5 border-r">General Serial / Date</Th>
                <Th className="px-3 py-2.5 border-r">Reference / User</Th>
                <Th className="px-3 py-2.5 border-r">Debit & Credit Ledger Account</Th>
                <Th className="px-3 py-2.5 text-right border-r">Advance Required ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Received ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Balance ({purchaseCurrency})</Th>
                <Th className="px-3 py-2.5 text-center border-r">Exchange Rate</Th>
                <Th className="px-3 py-2.5 text-right border-r">Advance Required ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Received ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-right border-r">Balance ({calcs.finalCurr})</Th>
                <Th className="px-3 py-2.5 text-center w-28">Actions</Th>
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
                      <div><span className="text-muted-foreground font-semibold">General:</span> <span className="font-bold">{journalSerial}</span></div>
                      <div><span className="text-muted-foreground font-semibold">Country:</span> <span className="font-bold">{countrySerial}</span></div>
                      <div><span className="text-muted-foreground font-semibold">Branch:</span> <span className="font-bold">{branchSerial}</span></div>
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
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Final Digital Balance Statement</div>
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
          {loading ? "Loading payments..." : "No payments posted for this purchase order yet."}
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
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [expandedSummaryCountries, setExpandedSummaryCountries] = useState<Record<string, boolean>>({});
  const [showAllCountries, setShowAllCountries] = useState(true);

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
    if (USD_EXCHANGE[cur] !== undefined) return USD_EXCHANGE[cur];
    if (base === "AED") return rowRate / 3.6725;
    if (base === "PKR") return rowRate / 278.5;
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
      const paidAdvance = Number(row.advance_paid || 0) * conversionRate;
      const remainingAdvance = Math.max(0, requiredAdvance - paidAdvance);
      const remainingDue = Number(row.remaining_due || 0) * conversionRate;
      const remPaid = Number(row.remaining_paid || 0) * conversionRate;

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
          No summary data available
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
                                    <Th className="px-2 py-1.5 text-right">Total Purchase</Th>
                                    <Th className="px-2 py-1.5 text-right">Required Adv</Th>
                                    <Th className="px-2 py-1.5 text-right">Paid Adv</Th>
                                    <Th className="px-2 py-1.5 text-right">Remaining Adv</Th>
                                    <Th className="px-2 py-1.5 text-right">Remaining Due (Baqaya)</Th>
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
        {label}:
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
        <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">1. BRANCH & USER DETAILS</h4>
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
            Status:
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-455 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">Active</span>
        </div>
      </div>
    </div>
  );

  const renderPurchaseSummary = (onlyBody = false) => {
    const body = (
      <div className="flex flex-col gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></div> Total Transactions:</span>
          <span className="font-black text-slate-800 dark:text-slate-200">{summary.totalTransactions}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div> Purchase Currencies:</span>
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
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div> % Not Transferred:</span>
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
          <span className="flex items-center gap-2"><div className="w-4 flex justify-center text-rose-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div> % Not Transferred:</span>
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
          <span>Total Transactions:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{summary.totalTransactions}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Purchase Currencies:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{numCurrencies}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Final Currency:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{summary.localCurrency}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Exchange Rate Type:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">Live</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Last Updated:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Report Type:</span>
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
  
  const adminCountry = selectedCountryForSummary || summary.country || session?.countryName || "United Arab Emirates";
  const adminBranch = (summary.branchName && summary.branchName !== "All Branches") ? summary.branchName : (session?.branchName || "HEAD OFFICE");
  const adminUserId = session?.id || session?.username || summary.userId;
  const th = (label: string) => translateHeader(lang, label);

    return (
      <div className="flex flex-col mb-6 space-y-4">
        {/* 4 Panels Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Panel 1: Branch & User Details */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="bg-blue-600 p-1 rounded-full text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">1. {th("BRANCH & USER DETAILS")}</h4>
            </div>
            <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
              <div className="flex justify-between items-center">
                <span>{th("Country")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">{getFlag(adminCountry)} {tData(adminCountry, lang)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("Branch Name")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{tData(adminBranch, lang)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("User ID")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{adminUserId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("User Name")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{tData(summary.userName, lang)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("Role")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{t(summary.role, lang)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("Date & Time")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
              </div>
              <div className="flex justify-between items-center mt-auto">
                <span>{th("Status")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{th("Active")}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: Global Financial Summary */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
              <div className="bg-emerald-600 p-1 rounded-full text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">2. {th("GLOBAL FINANCIAL SUMMARY (USD)")}</h4>
            </div>
            <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
              <div className="flex justify-between items-center">
                <span>{th("Total Global Entries")}</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{totalGlobalEntries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("Total Purchase (USD)")}</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(summary.totalPurchaseLC)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-600 dark:text-rose-500">{th("Total Advance/Paid (USD)")}</span>
                <span className="font-black text-rose-700 dark:text-rose-400 font-mono">{formatMoney(summary.advancePaidLC)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 uppercase font-bold">{th("Balance (USD)")}</span>
                <span className="font-black text-slate-900 dark:text-slate-100 font-mono text-sm">{formatMoney(summary.remainingBalanceLC)}</span>
              </div>
            </div>
          </div>

          {/* Panel 3: Bill Entries Summary */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
              <div className="bg-purple-600 p-1 rounded-full text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 truncate">3. {th("BILL ENTRIES SUMMARY")}</h4>
            </div>
            <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
              <div className="flex justify-between items-center">
                <span>{th("Total Bill Entries")}</span>
                <span className="font-black text-purple-700 dark:text-purple-400 font-mono">{totalGlobalEntries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{th("Transferred to Loading")}</span>
                <span className="font-black text-emerald-600 dark:text-emerald-500 font-mono">{transferredEntries}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-rose-600 dark:text-rose-500">{th("Remaining Advance Balance")}</span>
                <span className="font-black text-rose-700 dark:text-rose-400 font-mono">{remainingEntries}</span>
              </div>
              <div className="flex justify-between items-center mt-auto pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                <span>{th("System Status")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-500">{th("Online & Synced")}</span>
              </div>
            </div>
          </div>

          {/* Panel 4: All Countries Report Details (Interactive) */}
          <div 
            className={cn(
              "group flex flex-col rounded-xl border-2 bg-white shadow-sm dark:bg-slate-900 overflow-hidden cursor-pointer transition-colors",
              showAllCountries 
                ? "border-orange-400 dark:border-orange-600 shadow-md" 
                : "border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700"
            )}
            onClick={() => setShowAllCountries(!showAllCountries)}
          >
            <div className="flex flex-col h-full outline-none">
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors",
                showAllCountries 
                  ? "bg-orange-100/80 dark:bg-orange-900/40" 
                  : "bg-orange-50/50 dark:bg-orange-900/10 group-hover:bg-orange-100/50 dark:group-hover:bg-orange-900/30"
              )}>
                <div className={cn("bg-orange-600 p-1 rounded-full text-white transition-transform duration-300", showAllCountries ? "rotate-90" : "rotate-0")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400 flex-1">4. {th("ALL COUNTRIES REPORT")}</h4>
                <span className="text-[9px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-500 font-bold">{showAllCountries ? th("Hide Details") : th("Show Details")}</span>
              </div>
              <div className="p-3 flex flex-col gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 h-full overflow-y-auto max-h-[160px] scrollbar-thin">
                {summaryRows.map((r, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                     <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate max-w-[120px]">
                       {getFlag(r.country)} {tData(r.country, lang)}
                     </span>
                     <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm text-[9px] whitespace-nowrap">{r.branches.length} {th("Branches")}</span>
                   </div>
                ))}
                
                <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                  {!showAllCountries && <span className="text-orange-600 dark:text-orange-500 font-bold uppercase text-[10px]">{th("Show Report Details ?")}</span>}
                  {showAllCountries && <span className="text-orange-600 dark:text-orange-500 font-bold uppercase text-[10px]">{th("Hide Report Details ?")}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Country Dashboard Section Content */}
        {showAllCountries && (
          <div className="country-accordion-content block animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {summaryRows.map((r, idx) => (
                <div key={idx} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-black text-[11px] uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {getFlag(r.country)} {tData(r.country, lang)}
                    </span>
                    <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {r.branches.length} {th("Branches")}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{th("Currency")}</span>
                        <span className="font-black text-slate-800 dark:text-slate-200 text-xs">{r.currency}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{th("Total Purchase")}</span>
                        <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-[11px]">{formatMoney(r.purchase)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{th("Paid Advance")}</span>
                        <span className="font-black text-emerald-600 font-mono text-[11px]">{formatMoney(r.sale)}</span>
                      </div>
                      <div className="mt-1 flex justify-between items-center border-t border-slate-200 pt-2 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{th("Remaining Balance")}</span>
                        <span className="font-black text-slate-800 dark:text-slate-200 font-mono text-sm">{formatMoney(r.finalTotal)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between items-center">
                        <span>{th("Branch Breakdown")}</span>
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] dark:bg-slate-800">{th("All")}</span>
                      </h5>
                      {r.branches.map((b, bIdx) => (
                        <div key={bIdx} className="flex flex-col gap-1.5 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-[10px] uppercase text-slate-700 dark:text-slate-300 truncate pr-2" title={b.branch}>{tData(b.branch, lang)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[9px]">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">{th("Total Purch.")}</span>
                              <span className="font-bold text-rose-500 font-mono">{formatMoney(b.purchase)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">{th("Req. Adv")}</span>
                              <span className="font-bold text-slate-500 font-mono">{formatMoney(b.requiredAdvance)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">{th("Paid Adv")}</span>
                              <span className="font-bold text-emerald-500 font-mono">{formatMoney(b.paidAdvance)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">{th("Remaining Balance")}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatMoney(b.remainingAdvance)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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

// Module-scope so the binding stays in the same chunk as its usages regardless
// of webpack code-splitting (previously an in-component const that could be
// dropped/undefined in a shared server chunk -> "getTableHeader is not defined").
const PURCHASE_ORDER_TABLE_HEADERS: Record<string, Record<LanguageCode, string>> = {
  "PO No.": { en: "PO Number", ur: "آرڈر نمبر", ar: "رقم طلب الشراء", fa: "شماره سفارش", ps: "د امر شمیره" },
  "Bill / Date": { en: "Bill & Date", ur: "بل اور تاریخ", ar: "الفاتورة والتاريخ", fa: "صورتحساب و تاریخ", ps: "بل او نیټه" },
  "Branch / Country": { en: "Branch & Country", ur: "برانچ اور ملک", ar: "الفرع والبلد", fa: "شعبه و کشور", ps: "څانګه او هیواد" },
  "Exchange Rate": { en: "Exchange Rate", ur: "شرح تبادلہ", ar: "سعر الصرف", fa: "نرخ ارز", ps: "د تبادلې نرخ" },
  "Local Currency Amount": { en: "Local Currency Amount", ur: "مقامی کرنسی رقم", ar: "المبلغ بالعملة المحلية", fa: "مبلغ ارز محلی", ps: "د ځایی اسعارو مقدار" },
  "Local Currency Advance": { en: "Local Currency Advance", ur: "مقامی کرنسی ایڈوانس", ar: "الدفعة المقدمة بالعملة المحلية", fa: "پیش پرداخت ارز محلی", ps: "د ځایی اسعارو پرمختګ" },
  "Remaining Local Currency": { en: "Remaining Local Currency", ur: "بقایا مقامی کرنسی", ar: "المتبقي بالعملة المحلية", fa: "باقیمانده ارز محلی", ps: "پاتې ځایی اسعار" },
  "Payment Status": { en: "Payment Status", ur: "ادائیگی کی صورتحال", ar: "حالة الدفع", fa: "وضعیت پرداخت", ps: "د تادیې حالت" },
  "Action": { en: "Action", ur: "عمل", ar: "إجراء", fa: "عمل", ps: "عمل" }
};
function getPurchaseOrderTableHeader(h: string, currentLanguage: LanguageCode): string {
  return PURCHASE_ORDER_TABLE_HEADERS[h]?.[currentLanguage] || h;
}

export function PurchaseOrderPaymentJournal({ mode = "advance" }: { mode?: PaymentMode }) {
  const router = useRouter();
  const activeMode: PaymentMode = mode === "charges" ? "credit" : mode;
  const logClientError = (msg: string) => {
    fetch("/api/erp/purchases/orders", {
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
  const reset = () => {
    setQuery("");
    setDraftFilter("");
    setCountryFilter("");
    setBranchFilter("");
    setCurrencyFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPageIndex(0);
  };
  const recordsTextMap: Record<LanguageCode, string> = {
    en: "records",
    ur: "ریکارڈز",
    ar: "سجلات",
    fa: "رکوردها",
    ps: "ریکارډونه"
  };
  const refreshTextMap: Record<LanguageCode, string> = {
    en: "Refresh",
    ur: "تازہ کریں",
    ar: "تحديث",
    fa: "بروزرسانی",
    ps: "تازه کول"
  };
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
      const response = await fetch(`/api/erp/purchases/orders/${row.id}/payments?lang=${currentLanguage}`, { credentials: "include" });
      const body = await response.json();
      if (body?.ok && body.data?.payments) {
        paymentHistory = body.data.payments.filter((p: any) => !p.narration?.toLowerCase().includes("initial booking transfer"));
      }
    } catch (err) {
      console.error("Failed to load nested payments for statement:", err);
    }

    const purchaseData: PurchaseReportData = {
      id: row.id,
      purchaseBookingOrderNumber: row.purchase_order_no,
      purchaseDate: form.purchaseDate || row.created_at || "",
      bookingDate: form.bookingDate || form.purchaseDate || row.created_at || "",
      purchaseAccountName: form.purchaseAccountName || "Dubai Purchase Account",
      purchaseAccountNumber: form.purchaseAccountNo || "AE-AC-0001",
      salesAccountName: form.salesAccountName || "Damaan Sales Account",
      salesAccountNumber: form.salesAccountNo || "SA-2001",
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
      branchName: rowBranchName(row) || form.purchaseAccountBranch || "Kabul Main Branch",
      countryName: rowCountryName(row) || form.loadingCountry || "N/A",
      createdAt: row.created_at || "",
      form_data: row.form_data || {},
      paymentHistory,
      finalCurrency: rowOfficeCurrency(row),
      audit: {
        userName: row.audit?.userName || session?.name || session?.username || "SUPER ADMIN",
        userId: row.audit?.userId || session?.id || "USR-1001",
        branchCode: row.audit?.branchCode || form.branchCode || "QTA-01"
      }
    };

    openPurchaseA4ReportWindow({
      title: "Purchase Master Verification Report",
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
  const [isDoubleEntryExpanded, setIsDoubleEntryExpanded] = useState<boolean>(false);
  // Container state moved below 'selected' declaration to prevent ReferenceError

  // Local cache for Bank/Method quick add
  const [savedBanks, setSavedBanks] = useState<SavedBankItem[]>([]);
  const [savedMethods, setSavedMethods] = useState<string[]>([]);
  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [addOptionType, setAddOptionType] = useState<"bank" | "method">("bank");
  const [activeTab, setActiveTab] = useState<"remaining" | "advance" | "history">("advance");
  const [isPoDetailsExpanded, setIsPoDetailsExpanded] = useState<boolean>(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [titleSlot, setTitleSlot] = useState<Element | null>(null);
  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);
  // Follows the single, app-wide active language (top toolbar selector) instead of its
  // own disconnected state — this page previously had its own separate, broken language
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
  const [remainingLoadingRecords, setRemainingLoadingRecords] = useState<any[]>([]);
  const [loadingRemainingLoadingRecords, setLoadingRemainingLoadingRecords] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setSelectedOrderPayments([]);
      setShowModalHistory(false);
      return;
    }
    let cancelled = false;
    async function fetchPayments() {
      setLoadingPayments(true);
      try {
        const response = await fetch(`/api/erp/purchases/orders/${selectedId}/payments?lang=${currentLanguage}`, { credentials: "include" });
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
        const response = await fetch(`/api/erp/purchases/orders/${viewingRowId}/payments?lang=${currentLanguage}`, { credentials: "include" });
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

  const [urlParamPurchaseOrderNo, setUrlParamPurchaseOrderNo] = useState("");
  const [fromLoadingParam, setFromLoadingParam] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pNo = params.get("purchaseOrderNo") || "";
      setUrlParamPurchaseOrderNo(pNo);
      setFromLoadingParam(params.get("fromLoading") === "true");
    }
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/erp/purchases/orders?limit=200", { cache: "no-store", credentials: "include" });
      const body = await response.json();
      if (!response.ok || body?.ok === false) throw new Error(body?.error?.message ?? body?.message ?? "Unable to load purchase orders.");
      const payload = (body?.data ?? body) as OrdersPayload | PurchaseOrderRow[];
      const rows = Array.isArray(payload) ? payload : payload.orders ?? [];
      setOrders(rows);
      // Auto-select by URL param
      const urlOrderNo = urlParamPurchaseOrderNo || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("purchaseOrderNo") || "" : "");
      if (urlOrderNo) {
        const match = rows.find((r) => r.purchase_order_no === urlOrderNo);
        if (match) setSelectedId(match.id);
      }
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Unable to load purchase order payment records.");
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
    const urlOrderNo = urlParamPurchaseOrderNo;
    return orders.filter((row) => {
      if (urlOrderNo && row.purchase_order_no === urlOrderNo) return true;
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

      const urlPurchaseOrderNo = urlOrderNo;
      const isUrlLoadingScope = activeMode === "remaining" && fromLoadingParam && (!urlPurchaseOrderNo || row.purchase_order_no === urlPurchaseOrderNo);
      if (activeMode === "remaining" && urlPurchaseOrderNo && row.purchase_order_no !== urlPurchaseOrderNo) return false;

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

      // Extract form values for clearance calculation
      const finalAmount = orderTotal(row);
      const advancePercent = Number(form.advancePercent || 0);
      const requiredAdvance = (finalAmount * advancePercent) / 100;
      const paidAdvance = Number(row.advance_paid || 0);
      const remainingAdvance = requiredAdvance - paidAdvance;
      let remainingDue = Number(row.remaining_due || 0);
      if (remainingDue === 0) {
        // Fallback calculation if db field is not populated
        const remPaid = Number(row.remaining_paid || 0);
        remainingDue = finalAmount - paidAdvance - remPaid;
      }
      
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
        if (advancePercent > 0 && remainingAdvance > 0.01 && !isUrlLoadingScope) return false;
        if (remainingDue <= 0.01 && !isUrlLoadingScope) return false; // Already cleared

        // STRICT BUSINESS RULE: Remaining payment requires Transfer to Loading first.
        // An order must have been transferred (dispatched) before remaining payment is allowed.
        const workflow = row.form_data?.workflow || {};
        const hasTransferStatus = (workflow.transferStatus || "").toLowerCase() === "transferred";
        const hasTransferAudit  = Boolean(row.form_data?.form?.transferAudit || workflow.transferAudit);
        const hasLoadingRecord  = Number((row as any).loading_record_count || 0) > 0
          || Boolean(workflow.loadedQuantity && Number(workflow.loadedQuantity) > 0);
        const hasContainerMovement = hasTransferStatus || hasTransferAudit || hasLoadingRecord;
        if (!hasContainerMovement) return false; // Block: not yet transferred to loading
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
        row.purchase_order_no,
        row.purchase_contract_no,
        form.manualBillNo,
        form.manual_bill_no,
        form.manualBillNumber,
        form.billNo,
        form.invoiceNo,
        form.invoiceNumber,
        form.purchaseContractNo,
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

  const selected = selectedId ? (orders.find((row) => row.id === selectedId) ?? filtered.find((row) => row.id === selectedId) ?? null) : null;

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
    const explicitLoadingPurchaseAmount = Number(
      searchParams.get("purchaseAmount") ||
      searchParams.get("loadedPurchaseAmount") ||
      selectedLoadingRecord?.report_payload?.totalPurchase ||
      selectedLoadingRecord?.report_payload?.purchaseAmount ||
      0
    );
    const loadingPurchaseAmount = fromLoading
      ? (explicitLoadingPurchaseAmount > 0 ? explicitLoadingPurchaseAmount : (isPerKg ? cNetWeight * cPriceRate : cLoadedQty * cPriceRate))
      : poOrderTotal;

    const exRate = Number(selected.exchange_rate || form.exchangeRate || 1) || 1;

    // Required Advance allocated to this loading
    const loadingRequiredAdvance = (loadingPurchaseAmount * advancePercent) / 100;

    // Advance already paid for this loading: normalize local stored advance, then allocate only this loaded bill share.
    const rawPOAdvancePaid = Number(selected.advance_paid || form.advanceAmount || 0);
    const poAdvancePaid = normalizeAdvanceToPurchaseCurrency(rawPOAdvancePaid, poOrderTotal, exRate);
    const loadingAdvancePaid = fromLoading
      ? Math.min(loadingPurchaseAmount, totalPOQuantity > 0 ? (cLoadedQty / totalPOQuantity) * poAdvancePaid : poAdvancePaid)
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
      fetch(`/api/erp/purchases/loading-records?q=${selected.purchase_order_no}`, { credentials: "include" })
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
          loading_record_no: searchParams.get("purchaseOrderNo") ? `Transferred Container (${searchParams.get("purchaseOrderNo")})` : "Transferred Container",
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
    const poAdvanceAmt = Number(poRow.advance_paid || poRow.form_data?.form?.advanceAmount || 0);
    
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

  const displayRows = useMemo(() => {
    if (activeMode !== "remaining") return filtered;

    const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const urlLoadingScope = urlParams.get("fromLoading") === "true";
    if (!remainingLoadingRecords.length && urlLoadingScope) return filtered;

    const needle = query.trim().toLowerCase();
    const start = startDateFilter ? new Date(startDateFilter) : null;
    const end = endDateFilter ? new Date(endDateFilter) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return remainingLoadingRecords
      .map((loadingRecord: any) => {
        const linkedPo = orders.find((row) => {
          return row.id === loadingRecord.purchase_order_id
            || row.purchase_order_no === loadingRecord.purchase_order_no;
        });
        const nestedPo = loadingRecord.purchase_orders || {};
        const nestedFormData = nestedPo.form_data || {};
        const row = (linkedPo || {
          id: loadingRecord.purchase_order_id || loadingRecord.id,
          purchase_order_no: loadingRecord.purchase_order_no || loadingRecord.loading_record_no || "-",
          purchase_contract_no: nestedFormData?.form?.contractNo || "-",
          form_data: nestedFormData,
          country_id: loadingRecord.country_id || null,
          country_branch_id: loadingRecord.country_branch_id || null,
          city_branch_id: loadingRecord.city_branch_id || null,
          status: "Posted",
          ledger_posting_status: "Posted",
          payment_status: "Pending",
          advance_paid: nestedPo.advance_paid || 0,
          remaining_due: nestedPo.remaining_due || 0,
          order_total: nestedPo.order_total || 0,
          created_at: loadingRecord.loaded_at || loadingRecord.created_at || new Date().toISOString()
        }) as PurchaseOrderRow;

        const form = { ...(row.form_data?.form || {}) };
        if (!form.countryName && loadingRecord.countries?.name) form.countryName = loadingRecord.countries.name;
        if (!form.branchCountry && loadingRecord.countries?.name) form.branchCountry = loadingRecord.countries.name;
        if (!form.branchName && loadingRecord.city_branches?.name) form.branchName = loadingRecord.city_branches.name;
        if (!form.branchName && loadingRecord.country_branches?.name) form.branchName = loadingRecord.country_branches.name;
        if (!form.purchaseCurrency && loadingRecord.purchase_currency) form.purchaseCurrency = loadingRecord.purchase_currency;
        if (!form.currencyType && loadingRecord.purchase_currency) form.currencyType = loadingRecord.purchase_currency;
        if (!form.exchangeRate && loadingRecord.exchange_rate) form.exchangeRate = loadingRecord.exchange_rate;

        return {
          ...row,
          form_data: {
            ...(row.form_data || {}),
            form
          },
          country_id: loadingRecord.country_id || row.country_id,
          country_branch_id: loadingRecord.country_branch_id || row.country_branch_id,
          city_branch_id: loadingRecord.city_branch_id || row.city_branch_id,
          created_at: loadingRecord.loaded_at || loadingRecord.created_at || row.created_at,
          __rowKey: `${row.id}::loading::${loadingRecord.id}`,
          __loadingRecord: loadingRecord,
          __isLoadingBill: true
        } as PurchaseOrderRow & { __rowKey: string; __loadingRecord: any; __isLoadingBill: boolean };
      })
      .filter((row: any) => {
        if (countryFilter && rowCountryName(row) !== countryFilter) return false;
        if (branchFilter && rowBranchName(row) !== branchFilter) return false;
        if (currencyFilter && rowCurrency(row) !== currencyFilter) return false;

        const record = row.__loadingRecord || {};
        const rowDate = new Date(record.loaded_at || record.created_at || row.created_at || "");
        if (start && (Number.isNaN(rowDate.getTime()) || rowDate < start)) return false;
        if (end && (Number.isNaN(rowDate.getTime()) || rowDate > end)) return false;

        if (!needle) return true;
        const form = row.form_data?.form || {};
        return [
          row.purchase_order_no,
          row.purchase_contract_no,
          record.loading_record_no,
          record.container_number,
          record.loading_location,
          record.receiving_location,
          form.goodsName,
          form.purchaseAccountName,
          form.salesAccountName,
          rowCountryName(row),
          rowBranchName(row)
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      });
  }, [activeMode, branchFilter, countryFilter, currencyFilter, endDateFilter, filtered, orders, query, remainingLoadingRecords, startDateFilter]);

  const pageRows = useMemo(() => {
    return displayRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  }, [displayRows, pageIndex, pageSize]);

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
      } else if (name.includes("bank") || code.includes("bank")) {
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
    if (selected) {
      return rowOfficeCurrency(selected);
    }

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
  }, [selected, selectedSourceLedger, selectedForm, session]);

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

  const cards = useMemo(() => kpis(filtered, baseCurrency), [filtered, baseCurrency]);
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

    // Filter strictly by the active order's branch and country scope
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

    return filteredLedgers.map(toLedgerOption);
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
    const paidAdvanceBC = Number(selected.advance_paid || 0);
    return Math.max(0, requiredAdvanceBC - paidAdvanceBC);
  }, [selected]);

  // Final Action POST handler
  async function handleProcessPayment() {
    if (!canSave || !selected) return;
    setProcessingPayment(true);
    setPaymentSuccess("");
    setPaymentError("");

    try {
      const finalRemarks = remarks.trim() || `Automated payment settlement for Purchase Order No: ${selected.purchase_order_no}. Roznamcha Category: ${paymentType.toUpperCase()}.`;
      const formData = new FormData();

      // Helper to check if a string is a valid UUID
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || "").trim());

      const form = selected.form_data?.form || {};

      // 1. Resolve debit ledger ID (Supplier / Trade Payable / Purchase party)
      let debitLedgerId = "";
      const candidateDebitIds = [
        (selected as any).supplier_ledger_id,
        (selected as any).supplierLedgerId,
        form.supplierAccountId,
        form.supplier_ledger_id,
        form.supplierLedgerId,
        form.salesAccountLedgerId,
        form.salesAccountId,
        form.purchaseAccountLedgerId,
        form.purchaseAccountId,
        form.supplierId,
        selectedForm.salesAccountLedgerId,
        selectedForm.supplierAccountId,
        selectedForm.purchaseAccountLedgerId
      ].filter(Boolean);

      for (const candidate of candidateDebitIds) {
        if (isUuid(String(candidate))) {
          debitLedgerId = String(candidate).trim();
          break;
        }
      }

      // 2. If not a direct UUID, find by matching supplier ledger code or name in ledgers
      if (!debitLedgerId) {
        const supplierCode = String(form.salesAccountNo || form.supplierAccountNo || form.supplierAccountCode || doubleEntry.debitCode || "").trim().toLowerCase();
        const supplierName = String(form.salesAccountName || form.supplierName || form.supplierAccountName || doubleEntry.debitName || "").trim().toLowerCase();
        
        const matchedLedger = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const c = ledgerCode(l).toLowerCase();
          const n = ledgerName(l).toLowerCase();
          if (supplierCode && (c === supplierCode || c.includes(supplierCode))) return true;
          if (supplierName && (n === supplierName || n.includes(supplierName))) return true;
          return false;
        });

        if (matchedLedger) {
          debitLedgerId = ledgerId(matchedLedger) || "";
        }
      }

      // 3. Fallback: match by nature / account type in order's country scope
      if (!debitLedgerId) {
        const targetCountry = selected.country_id;
        const matchedPayable = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const lCountry = l.country_id || l.countryId;
          if (targetCountry && lCountry && lCountry !== targetCountry) return false;
          const n = ledgerName(l).toLowerCase();
          const type = String(l.account_type || l.nature || "").toLowerCase();
          return type.includes("liability") || type.includes("payable") || n.includes("payable") || n.includes("supplier") || n.includes("trade");
        });

        if (matchedPayable) {
          debitLedgerId = ledgerId(matchedPayable) || "";
        }
      }

      // 4. Ultimate fallback: any valid UUID ledger in order's scope
      if (!debitLedgerId) {
        const valid = ledgers.find((l) => isUuid(ledgerId(l) || ""));
        if (valid) debitLedgerId = ledgerId(valid) || "";
      }

      // 5. Resolve credit ledger ID (Payment source Bank/Cash account)
      let creditLedgerId = "";
      if (isUuid(paymentSourceLedgerId)) {
        creditLedgerId = paymentSourceLedgerId;
      } else {
        const matchedCredit = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id) || id === debitLedgerId) return false;
          const c = ledgerCode(l).toLowerCase();
          const n = ledgerName(l).toLowerCase();
          return c === doubleEntry.creditCode?.toLowerCase() || n === doubleEntry.creditName?.toLowerCase() || n.includes("cash") || n.includes("bank");
        }) || ledgers.find((l) => isUuid(ledgerId(l) || "") && ledgerId(l) !== debitLedgerId) || ledgers.find((l) => isUuid(ledgerId(l) || ""));

        if (matchedCredit) {
          creditLedgerId = ledgerId(matchedCredit) || "";
        }
      }

      // Do NOT guess a ledger here — picking an arbitrary ledger could silently post this
      // payment against the wrong account. If the supplier/payment-source ledger genuinely
      // couldn't be resolved, fail loudly so the order's account link can be corrected.
      if (!isUuid(debitLedgerId) || !isUuid(creditLedgerId)) {
        throw new Error(
          !isUuid(debitLedgerId)
            ? "Could not determine the purchase account's ledger for this order. Please reselect the purchase/supplier account on this order and try again."
            : "Could not determine the payment source (bank/cash) ledger. Please select a payment account and try again."
        );
      }

      const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const selectedLoadingRecordId = selectedLoadingRecord?.id ? String(selectedLoadingRecord.id) : "";
      const fromLoading = searchParams.get("fromLoading") === "true" || Boolean(selectedLoadingRecordId);
      const loadingRecordId = selectedLoadingRecordId || searchParams.get("loadingRecordId") || "";

      const payload = {
        purchaseOrderId: selected.id,
        purchaseOrderNo: selected.purchase_order_no,
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
      const postUrl = `/api/erp/purchases/orders/${selected.id}/payments${fromLoading ? "?fromLoading=true" : ""}`;

      const res = await fetch(postUrl, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message ?? body?.message ?? "Execution failure on backend server.");
      }

      const allSerials = [body.data?.serialNumber, body.data?.countrySerialNumber, body.data?.branchSerialNumber].filter(Boolean).join(" | ");
      setPaymentSuccess(`Double-entry ledger voucher successfully balanced! Journal Serial Number: ${allSerials || "N/A"}.`);
      setCalcAmount("");
      setFinalPayment("");
      setRemarks("");
      setTypeDetails({});
      setAttachmentFile(null);
      
      // Auto-redirect back to Purchase Loading Records if from loading or in advance/endorsement mode
      if (fromLoading || (typeof window !== "undefined" && window.location.search.includes("fromLoading=true"))) {
        setTimeout(() => {
          router.push("/dashboard/purchase/purchase-loading-records");
        }, 1200);
      } else if (activeMode === "advance" && selected?.purchase_order_no) {
        setTimeout(() => {
          router.push("/dashboard/purchase/purchase-loading-records");
        }, 1200);
      } else {
        await loadOrders();
      }
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
    
    const statusText = row.payment_status || "Pending";
    const rowKey = row.id;
    const isSelected = selected?.id === row.id;
    const isExpanded = Boolean(expandedIds[row.id]);
    const rowBg = isSelected ? "#eff6ff" : index % 2 === 0 ? "#ffffff" : "#f8fafc";
    const isPosted = row.ledger_posting_status === "Posted"
      || row.ledger_posting_status === "posted"
      || row.ledger_posting_status === "Transferred"
      || row.ledger_posting_status === "transferred";
    
    // Per-row derived display values
    const billNo = form.billNo || form.invoiceNo || row.purchase_contract_no || "—";
    const dateStr = form.purchaseDate ? new Date(form.purchaseDate).toLocaleDateString("en-GB") : row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "—";
    const branchName = rowBranchName(row) || "—";
    const countryName = rowCountryName(row) || "—";

    const getRowColor = () => isPosted ? "text-slate-900 dark:text-slate-100" : "text-red-650 dark:text-red-400 font-medium";

    return (
      <React.Fragment key={rowKey}>
        <tr
          onClick={() => setExpandedIds((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
          style={{ background: rowBg, borderBottom: "1px solid #e2e8f0", cursor: "pointer", outline: isSelected ? "2px solid #3b82f6" : undefined, outlineOffset: -1 }}
          onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "#f0f9ff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = rowBg; }}
        >
          {/* 1. PO Number */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800", getRowColor())}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setViewingRow(row);
              }}
              title="Open full bill details"
              className="rounded-md px-1.5 py-1 font-mono text-[11px] font-black text-blue-600 underline-offset-4 transition hover:bg-blue-50 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
            >
              {row.purchase_order_no}
            </button>
          </td>
          {/* 2. Bill & Date */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800", getRowColor())}>
            <div className="flex flex-col">
              <span className="font-mono font-black text-[11px] text-slate-850 dark:text-slate-200">{billNo}</span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold">{dateStr}</span>
            </div>
          </td>
          {/* 3. Branch & Country */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800", getRowColor())}>
            <div className="flex flex-col">
              <span className="font-black text-[11px] text-slate-850 dark:text-slate-200 uppercase tracking-wide">{tData(branchName, currentLanguage)}</span>
              <span className="text-[10px] text-slate-500 mt-1 font-semibold">{tData(countryName, currentLanguage)}</span>
            </div>
          </td>
          {/* 4. Purchase Amount (FC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px]", getRowColor())}>
            {money(calcs.totalPurchaseFC, calcs.purchCurr)}
          </td>
          {/* 5. Invoice % */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-center font-mono font-bold text-[11px]", getRowColor())}>
            {calcs.advancePercent}%
          </td>
          {/* 6. Invoice Amount (FC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px] text-emerald-600 dark:text-emerald-400", getRowColor())}>
            {money(calcs.advanceAmountFC, calcs.purchCurr)}
          </td>
          {/* 7. Remaining Purchase (FC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px] text-rose-600 dark:text-rose-400", getRowColor())}>
            {money(calcs.remainingPurchaseFC, calcs.purchCurr)}
          </td>
          {/* 8. Exchange Rate */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-center font-mono font-bold text-[11px] text-indigo-650 dark:text-indigo-400", getRowColor())}>
            {calcs.exRate.toFixed(4)}
          </td>
          {/* 9. Local Currency Amount (LC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px]", getRowColor())}>
            {money(calcs.totalPurchaseLC, calcs.finalCurr)}
          </td>
          {/* 10. Local Currency Advance (LC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px] text-emerald-600 dark:text-emerald-400", getRowColor())}>
            {money(calcs.advanceAmountLC, calcs.finalCurr)}
          </td>
          {/* 11. Remaining Local Currency (LC) */}
          <td className={cn("px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-right font-mono font-black text-[11px] text-rose-600 dark:text-rose-400", getRowColor())}>
            {money(calcs.remainingPurchaseLC, calcs.finalCurr)}
          </td>
          {/* 12. Payment Status */}
          <td className="px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800 text-center">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs",
              statusText.toLowerCase() === "paid" || statusText.toLowerCase() === "completed" || statusText.toLowerCase() === "transferred"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                : statusText.toLowerCase() === "partial" || statusText.toLowerCase() === "partially_paid"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200"
            )}>
              {statusText}
            </span>
          </td>
          {/* 13. Action */}
          <td className="px-3 py-4 align-middle border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
              <UnifiedActionMenu
                onView={() => setViewingRow(row)}
                onPrint={() => handleOpenA4PDF(row, true)}
                onExportPdf={() => handleOpenA4PDF(row, false)}
                customItems={[
                  ...(activeMode !== "advance_completed"
                    ? [
                        {
                          label: "Payment Entry",
                          icon: <WalletCards className="h-4 w-4 text-emerald-500" />,
                          onClick: () => {
                            try {
                              logClientError(`Click Payment Entry. row.id: ${row.id}`);
                              selectOrder(row.id);
                            } catch (e: any) {
                              logClientError(`Error in Payment Entry click: ${e.stack || e.message || String(e)}`);
                            }
                          }
                        }
                      ]
                    : []),
                  ...(activeMode === "advance" && isPosted
                    ? [
                        {
                          label: "Transfer to Loading",
                          icon: <Truck className="h-4 w-4 text-blue-500" />,
                          onClick: () => router.push(`/dashboard/purchase/loading-form`)
                        }
                      ]
                    : []),
                  {
                    label: isExpanded ? "Hide Payment History" : "Show Payment History",
                    icon: isExpanded ? <XCircle className="h-4 w-4 text-slate-500" /> : <Plus className="h-4 w-4 text-slate-500" />,
                    onClick: () => setExpandedIds((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                  },
                  ...(activeMode === "advance_completed"
                    ? [
                        {
                          label: "Revert & Edit Advance",
                          icon: <RefreshCw className="h-4 w-4 text-indigo-500" />,
                          onClick: () => router.push(`/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=${encodeURIComponent(row.purchase_order_no)}`)
                        }
                      ]
                    : [])
                ]}
              />
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr onClick={(e) => e.stopPropagation()} style={{ background: "#f8fafc" }}>
            <td colSpan={13} className="p-4 border-b border-slate-100 dark:border-slate-800">
              <NestedPaymentHistory 
                row={row} 
                ledgers={ledgers} 
                baseCurrency={baseCurrency} 
                activeMode={activeMode} 
                selectOrder={selectOrder}
                expandedIds={expandedIds}
                setExpandedIds={setExpandedIds}
                logClientError={logClientError}
                onOpenFullBill={() => setViewingRow(row)}
                loadingRemainingLoadingRecords={loadingRemainingLoadingRecords}
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // getTableHeader hoisted to module scope (getPurchaseOrderTableHeader) to avoid
  // a webpack chunk-splitting bug where the in-component const became undefined.

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={cn("flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950", isRtl ? "text-right" : "text-left")}>
      {/* Header / Title Portal */}
      {titleSlot && createPortal(
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {activeMode === "advance" ? t("page_title", currentLanguage) :
           activeMode === "advance_completed" ? `${t("page_title", currentLanguage)} (${t("Completed", currentLanguage)})` :
           activeMode === "remaining" ? t("remaining_advance", currentLanguage) :
           activeMode === "credit" ? t("col_remaining_balance", currentLanguage) : `${t("page_title", currentLanguage)} (${t("Cleared", currentLanguage)})`}
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
          {(query || draftFilter || countryFilter || branchFilter || currencyFilter || startDateFilter || endDateFilter) && (
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
            
            <div className="flex flex-col gap-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Start Date</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => { setStartDateFilter(e.target.value); setPageIndex(0); }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">End Date</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => { setEndDateFilter(e.target.value); setPageIndex(0); }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
                {[
                  "PO Number", "Bill / Date", "Branch / Country", "Purchase Amount", "Invoice %", 
                  "Invoice Amount", "Remaining Purchase", "Exchange Rate", "Local Currency Amount", 
                  "Local Currency Advance", "Remaining Local Currency", "Payment Status", "Action"
                ].map((h) => (
                  <Th key={h} className={cn("px-3 py-4 text-[10px] font-black uppercase tracking-widest text-slate-605 dark:text-slate-350 whitespace-nowrap", isRtl ? "text-right" : "text-left")}>{getPurchaseOrderTableHeader(h, currentLanguage)}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isSuperAdmin ? (
                countryGroups.map((group) => {
                  const isExpandedCountry = expandedCountries[group.country] !== false;
                  
                  // Calculate country sums in Local Currency
                  let sumPurchaseLocal = 0;
                  let sumReqAdvanceLocal = 0;
                  let sumPaidLocal = 0;
                  let sumFinalLocal = 0;
                  let sumRemAdvanceLocal = 0;
                  
                  group.rows.forEach(row => {
                    const calcs = resolvePurchaseCalculations(row);
                    sumPurchaseLocal += calcs.totalPurchaseLC;
                    sumReqAdvanceLocal += calcs.advanceAmountLC;
                    sumPaidLocal += Number(row.advance_paid || 0) * calcs.exRate;
                    sumFinalLocal += calcs.remainingPurchaseLC;
                    sumRemAdvanceLocal += calcs.remainingPurchaseLC;
                  });

                  return (
                    <React.Fragment key={group.country}>
                      <tr
                        onClick={() => {
                          const nextExpanded = !isExpandedCountry;
                          setExpandedCountries(prev => ({
                            ...prev,
                            [group.country]: nextExpanded
                          }));
                          if (nextExpanded) {
                            setSelectedCountryForSummary(group.country);
                          } else if (selectedCountryForSummary === group.country) {
                            setSelectedCountryForSummary(null);
                          }
                        }}
                        className="bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 cursor-pointer border-y border-slate-200 dark:border-slate-800 transition"
                      >
                        <td className="px-3 py-3 font-extrabold text-slate-900 dark:text-slate-100 text-[10px] tracking-wide text-center">
                          {`PURCH: ${group.rows.length}`}
                        </td>
                        <td className="px-3 py-3 font-black text-slate-955 dark:text-white text-[11px] uppercase tracking-wider text-left">
                          {group.country}
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200 text-[10px] text-center">
                          {`BRANCH (${new Set(group.rows.map((r) => rowBranchName(r)).filter(Boolean)).size || 1})`}
                        </td>
                        <td className="px-3 py-3 font-mono font-black text-slate-700 dark:text-slate-300 text-[10px] text-center">
                          {group.rows.length > 0 ? rowOfficeCurrency(group.rows[0]) : "USD"}
                        </td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 font-bold text-rose-600 font-mono text-[11px] text-right">{sumPurchaseLocal > 0 ? sumPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                        <td className="px-3 py-3 font-bold text-emerald-600 font-mono text-[11px] text-right">{sumPaidLocal > 0 ? sumPaidLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                        <td className="px-3 py-3 font-bold text-slate-850 dark:text-slate-200 font-mono text-[11px] text-right">{sumRemAdvanceLocal > 0 ? sumRemAdvanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded bg-white dark:bg-slate-850 border border-slate-250 dark:border-slate-700 hover:bg-slate-50 transition shadow-sm"
                            >
                              {isExpandedCountry ? (
                                <Minus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                              ) : (
                                <Plus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpandedCountry && (
                        <tr>
                          <td colSpan={13} className="p-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="w-full overflow-x-auto p-4 border-l-[3px] border-l-blue-500 shadow-inner">
                              <table className="w-max min-w-full text-xs text-left border-collapse bg-white dark:bg-slate-950 rounded shadow-sm border border-slate-200 dark:border-slate-800">
                                <thead>
                                  <tr className="bg-slate-100 dark:bg-slate-800/80 border-b-2 border-slate-200 dark:border-slate-700">
                                    {[
                                      "SR.", "SUPER S/N", "CTY S/N", "BR. S/N", "BRANCH", "USER NAME",
                                      "GOODS NAME", "TOTAL QTY", "WT (KG)", "NET WT (KG)",
                                      "TOTAL PURCHASE", "REQ. ADVANCE", "PAID ADVANCE", "REM. ADVANCE", "FINAL BALANCE", "ACTIONS"
                                    ].map((h, i) => (
                                      <Th key={i} className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 last:border-0 align-middle text-center">{h}</Th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((row) => {
                                    const rowKey = String((row as any).__rowKey || row.id);
                                    const rowSpecificLoadingRecord = (row as any).__loadingRecord || null;
                                    const index = pageRows.findIndex((item) => String((item as any).__rowKey || item.id) === rowKey);
                                    const form = row.form_data?.form || {};
                                    const goods = row.form_data?.goodsEntries || [];
                                    const totalPrice = orderTotal(row);
                                    
                                    const bookCur = rowCurrency(row);
                                    const rowLocalCurrency = rowOfficeCurrency(row);
                                    const conversionRate = getConversionRate(row, bookCur, rowLocalCurrency, liveRates);
                                    
                                    const urlParamsForRow = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
                                    const rowUrlPurchaseOrderNo = urlParamsForRow.get("purchaseOrderNo") || "";
                                    const rowUrlLoadingScope = activeMode === "remaining"
                                      && urlParamsForRow.get("fromLoading") === "true"
                                      && (!rowUrlPurchaseOrderNo || rowUrlPurchaseOrderNo === row.purchase_order_no);
                                    const rowLoadingRecord = rowUrlLoadingScope
                                      ? {
                                          id: urlParamsForRow.get("loadingRecordId") || "",
                                          report_payload: {
                                            loadedQuantity: Number(urlParamsForRow.get("loadedQty") || 0),
                                            grossWeight: Number(urlParamsForRow.get("grossWeight") || 0),
                                            netWeight: Number(urlParamsForRow.get("netWeight") || 0),
                                            priceRateC1: Number(urlParamsForRow.get("priceRate") || 0),
                                            totalPurchase: Number(urlParamsForRow.get("purchaseAmount") || urlParamsForRow.get("loadedPurchaseAmount") || 0),
                                            exchangeRate: Number(urlParamsForRow.get("exchangeRate") || row.exchange_rate || form.exchangeRate || 1),
                                            currency: urlParamsForRow.get("currency") || rowCurrency(row)
                                          }
                                        }
                                      : (rowSpecificLoadingRecord || (activeMode === "remaining" && selected?.id === row.id && selectedLoadingRecord ? selectedLoadingRecord : null));
                                    const rowLoadingFinance = rowLoadingRecord ? calcLoadingFinance(rowLoadingRecord, row, form) : null;

                                    const totalAmountBC = rowLoadingFinance ? rowLoadingFinance.amountUSD : totalPrice;
                                    const totalAmountLocal = rowLoadingFinance ? rowLoadingFinance.amountPKR : totalAmountBC * conversionRate;
                                    const advancePercent = Number(form.advancePercent || 0);
                                    const requiredAdvanceBC = (totalAmountBC * advancePercent) / 100;
                                    const rawAdvanceBC = Number(row.advance_paid || form.advanceAmount || 0);
                                    const paidAdvanceBC = allocateAdvanceForLoadedBill(rawAdvanceBC, rowLoadingFinance, totalPrice, conversionRate);
                                    const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
                                    
                                    const requiredAdvance = requiredAdvanceBC * conversionRate;
                                    const paidAdvance = paidAdvanceBC * conversionRate;
                                    const remainingAdvance = Math.max(0, requiredAdvance - paidAdvance);
                                    const rowRemainingPaidBC = rowLoadingFinance && selected?.id === row.id
                                      ? selectedOrderPayments
                                          .filter((payment: any) => {
                                            if ((payment.kind || "") !== "remaining") return false;
                                            const paymentLoadingId = payment.typeDetails?.loadingRecordId || payment.typeDetails?.loading_record_id || "";
                                            return !rowLoadingRecord?.id || paymentLoadingId === rowLoadingRecord.id;
                                          })
                                          .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
                                      : 0;
                                    
                                    const remainingDueBC = rowLoadingFinance ? Math.max(0, totalAmountBC - paidAdvanceBC - rowRemainingPaidBC) : Number(row.remaining_due || 0);
                                    let paidAmountBC = 0;
                                    let paidAmountLocal = 0;
                                    let balanceAmountBC = 0;
                                    let balanceAmountLocal = 0;
                                    if (activeMode === "advance") {
                                      paidAmountBC = paidAdvanceBC;
                                      paidAmountLocal = paidAdvance;
                                      balanceAmountBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
                                      balanceAmountLocal = remainingAdvance;
                                    } else if (activeMode === "remaining") {
                                      const remPaidBC = rowLoadingFinance ? rowRemainingPaidBC : Number(row.remaining_paid || 0);
                                      paidAmountBC = remPaidBC;
                                      paidAmountLocal = remPaidBC * conversionRate;
                                      balanceAmountBC = remainingDueBC;
                                      balanceAmountLocal = remainingDueBC * conversionRate;
                                    } else {
                                      const credPaidBC = Number(row.credit_amount || 0);
                                      paidAmountBC = credPaidBC;
                                      paidAmountLocal = credPaidBC * conversionRate;
                                      balanceAmountBC = Math.max(0, totalAmountBC - paidAmountBC);
                                      balanceAmountLocal = balanceAmountBC * conversionRate;
                                    }
                                    
                                    const statusText = row.payment_status || "Pending";
                                    const isSelected = selected?.id === row.id && (!rowSpecificLoadingRecord?.id || selectedLoadingRecord?.id === rowSpecificLoadingRecord.id);
                                    const isExpanded = Boolean(expandedIds[rowKey]);
                                    const isPosted = row.ledger_posting_status === "Posted"
                                      || row.ledger_posting_status === "posted"
                                      || row.ledger_posting_status === "Transferred"
                                      || row.ledger_posting_status === "transferred";
                                    const isPaymentCompleted = (activeMode === "remaining" || activeMode === "credit")
                                      ? balanceAmountBC <= 0.01
                                      : isPosted;
                                    const getRowColor = () => isPosted ? "text-black dark:text-white" : "text-red-600 dark:text-red-400";
                                    
                                    // Derived details
                                    const goodsName = goods.map((g: any) => g.goodsName || g.name).filter(Boolean).join(", ") || form.goodsName || "-";
                                    const totalQty = rowLoadingFinance?.loadedQty || (goods.length ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || 0), 0) : Number(row.quantity || 0));
                                    const grossWeight = rowLoadingFinance?.grossWeight || (goods.length ? goods.reduce((s: number, g: any) => s + Number(g.grossWeight || 0), 0) : Number(form.grossWeight || 0));
                                    const netWeight = rowLoadingFinance?.netWeight || (goods.length ? goods.reduce((s: number, g: any) => s + Number(g.netWeight || g.grossWeight || 0), 0) : Number(form.netWeight || 0));
                                    const branchName = rowBranchName(row) || "-";
                                    const countryName = rowCountryName(row) || "-";
                                    const userName = row.audit?.userName || "-";
                                    
                                    // Serials
                                    const superSerialNo = index + 1 + pageIndex * pageSize;
                                    const countryRows = displayRows.filter((r) => rowCountryName(r) === countryName);
                                    const countrySerialNo = countryRows.findIndex((r) => String((r as any).__rowKey || r.id) === rowKey) + 1;
                                    const branchRows = displayRows.filter((r) => rowBranchName(r) === branchName);
                                    const branchSerialNo = branchRows.findIndex((r) => String((r as any).__rowKey || r.id) === rowKey) + 1;

                                    return (
                                      <React.Fragment key={rowKey}>
                                        <tr
                                          className={cn("border-b border-slate-100 dark:border-slate-800/60 text-center hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors", isSelected && "bg-blue-50/80 dark:bg-blue-900/30")}
                                        >
                                          {/* Serials */}
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono text-[9px] align-middle", getRowColor())}>{index + 1}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono text-[9px] align-middle", getRowColor())}>{superSerialNo}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono text-[9px] align-middle", getRowColor())}>{countrySerialNo}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono text-[9px] align-middle", getRowColor())}>{branchSerialNo}</td>
                                          {/* Details */}
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-bold uppercase tracking-wide align-middle text-left", getRowColor())}>{branchName}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-bold uppercase align-middle text-left", getRowColor())}>{userName}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-bold align-middle text-left", getRowColor())}>
                                             <GoodsPopoverCell goods={goods} fallbackName={goodsName} textColorClass={getRowColor()} />
                                           </td>
                                          {/* Cargo */}
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono font-black align-middle text-right", getRowColor())}>{totalQty.toLocaleString()}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono align-middle text-right", getRowColor())}>{grossWeight.toLocaleString()}</td>
                                          <td className={cn("px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 font-mono align-middle text-right", getRowColor())}>{netWeight.toLocaleString()}</td>
                                          {/* Financials */}
                                          <td className="px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 align-middle text-right">
                                            <div className="flex flex-col gap-0.5 font-mono">
                                              <span className="font-black text-[11px] text-rose-600 dark:text-rose-400">{money(totalAmountBC, bookCur)}</span>
                                              <span className="text-[9px] text-slate-500 font-bold">{money(totalAmountLocal, rowLocalCurrency)}</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 align-middle text-right">
                                            <div className="flex flex-col gap-0.5 font-mono">
                                              <span className="font-black text-[11px] text-amber-600 dark:text-amber-400">{money(requiredAdvanceBC, bookCur)}</span>
                                              <span className="text-[9px] text-slate-500 font-bold">{money(requiredAdvance, rowLocalCurrency)}</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 align-middle text-right">
                                            <div className="flex flex-col gap-0.5 font-mono">
                                              <span className="font-black text-[11px] text-emerald-600 dark:text-emerald-400">{money(paidAdvanceBC, bookCur)}</span>
                                              <span className="text-[9px] text-slate-500 font-bold">{money(paidAdvance, rowLocalCurrency)}</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 align-middle text-right">
                                            <div className="flex flex-col gap-0.5 font-mono">
                                              <span className="font-black text-[11px] text-slate-800 dark:text-slate-200">{money(remainingAdvanceBC, bookCur)}</span>
                                              <span className="text-[9px] text-slate-500 font-bold">{money(remainingAdvance, rowLocalCurrency)}</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-3 border-r border-slate-100 dark:border-slate-800/50 align-middle text-right">
                                            <div className="flex flex-col gap-0.5 font-mono">
                                              <span className="font-black text-[11px] text-indigo-600 dark:text-indigo-400">{money(balanceAmountBC, bookCur)}</span>
                                              <span className="text-[9px] text-slate-500 font-bold">{money(balanceAmountLocal, rowLocalCurrency)}</span>
                                            </div>
                                          </td>
                                          {/* Actions */}
                                          <td className="px-2 py-3 align-middle text-center">
                                            <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                              {activeMode !== "advance_completed" && (
                                                <>
                                                  {isPaymentCompleted ? (
                                                    <span className="inline-flex rounded border border-emerald-300 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap shadow-sm tracking-wider">
                                                      {translateHeader(currentLanguage, "Transferred")}
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex rounded border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap shadow-sm tracking-wider animate-pulse">
                                                      {translateHeader(currentLanguage, "Pending")}
                                                    </span>
                                                  )}
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    setViewingRow(row);
                                                  }}
                                                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[10px] font-black uppercase tracking-wide text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                  title="Open full bill audit report"
                                                >
                                                  <Eye className="h-3.5 w-3.5" />
                                                  {translateHeader(currentLanguage, "Open Full Bill")}
                                                </button>
                                                </>
                                              )}
                          <div className={cn("relative inline-block text-left", activeMode !== "advance_completed" && "mt-1")} onClick={(e) => e.stopPropagation()}>
                            <ViewportActionMenu
                              ariaLabel="Row actions"
                              buttonClassName={cn(
                                "inline-flex items-center justify-center rounded border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-400 focus:outline-none shadow-sm bg-white dark:bg-slate-900",
                                activeMode === "advance_completed" ? "h-8 px-3 text-xs font-semibold" : "h-7 w-7"
                              )}
                              trigger={activeMode === "advance_completed" ? (
                                <>{translateHeader(currentLanguage, "Actions")} <ChevronDown className="ml-1 h-3.5 w-3.5" /></>
                              ) : (
                                <MoreVertical className="h-3.5 w-3.5" />
                              )}
                              menuClassName="font-semibold p-0 w-48 shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                            >
                              {(close) => (
                                <>
                                  {activeMode === "advance_completed" && (
                                    <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 items-start pointer-events-none">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{translateHeader(currentLanguage, "Current Status")}</span>
                                      {isPosted ? (
                                        <span className="inline-flex rounded border border-emerald-300 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap shadow-sm tracking-wider">
                                          {translateHeader(currentLanguage, "Transferred")}
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase whitespace-nowrap shadow-sm tracking-wider animate-pulse">
                                          {translateHeader(currentLanguage, "Pending Transfer")}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="py-1">
                                    {activeMode !== "advance_completed" && (
                                      <button className="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-350 dark:hover:bg-slate-800 transition font-bold" onClick={() => {
                                        try {
                                          logClientError(`Click Payment Entry. row.id: ${row.id}`);
                                          if (rowSpecificLoadingRecord) setSelectedLoadingRecord(rowSpecificLoadingRecord);
                                          selectOrder(row.id);
                                          close();
                                        } catch (e: any) {
                                          logClientError(`Error in Payment Entry click: ${e.stack || e.message || String(e)}`);
                                        }
                                      }}>
                                        <WalletCards className="mr-2.5 h-4 w-4 text-slate-500" /> {translateHeader(currentLanguage, "Payment Entry")}
                                      </button>
                                    )}
                                    {activeMode === "advance" && isPosted && (
                                      <button className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition" onClick={() => { 
                                        close();
                                        router.push(`/dashboard/purchase/loading-form`);
                                      }}>
                                        <Truck className="mr-2.5 h-4 w-4 text-blue-600 dark:text-blue-400" /> {translateHeader(currentLanguage, "Transfer to Loading")}
                                      </button>
                                    )}
                                    <button className="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => { setViewingRow(row); close(); }}>
                                      <Eye className="mr-2.5 h-4 w-4 text-blue-600" /> {translateHeader(currentLanguage, "Open Full Bill")}
                                    </button>
                                    <button className="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => { handleOpenA4PDF(row, true); close(); }}>
                                      <Printer className="mr-2.5 h-4 w-4 text-slate-500" /> {translateHeader(currentLanguage, "Print Statement")}
                                    </button>
                                    <button className="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => { handleOpenA4PDF(row, false); close(); }}>
                                      <FileText className="mr-2.5 h-4 w-4 text-slate-500" /> {translateHeader(currentLanguage, "View Statement")}
                                    </button>
                                    <button className="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => {
                                      try {
                                        logClientError(`Click Show Payment History. row.id: ${row.id}`);
                                        setExpandedIds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
                                        close();
                                      } catch (e: any) {
                                        logClientError(`Error in Show Payment History click: ${e.stack || e.message || String(e)}`);
                                      }
                                    }}>
                                      {isExpanded ? <XCircle className="mr-2.5 h-4 w-4 text-slate-500" /> : <Plus className="mr-2.5 h-4 w-4 text-slate-500" />} {isExpanded ? (translateHeader(currentLanguage, "Hide Details") + " - " + translateHeader(currentLanguage, "Payment History")) : (translateHeader(currentLanguage, "Show Details") + " - " + translateHeader(currentLanguage, "Payment History"))}
                                    </button>
                                    {activeMode === "advance_completed" && (
                                      <>
                                        <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                                        <button className="flex w-full items-center px-4 py-2.5 text-xs text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 transition" onClick={() => { 
                                          close();
                                          router.push(`/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=${encodeURIComponent(row.purchase_order_no)}`);
                                        }}>
                                          <RefreshCw className="mr-2.5 h-4 w-4 text-indigo-500" /> {translateHeader(currentLanguage, "Revert & Edit Advance") || "Revert & Edit Advance"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </ViewportActionMenu>
                          </div>
                        </div>
                      </td>
                    </tr>
                                        {isExpanded && (
                                          <tr onClick={(e) => e.stopPropagation()} className="bg-slate-50/50 dark:bg-slate-900/30">
                                            <td colSpan={17} className="p-3 border-b border-slate-200 dark:border-slate-800">
                                              <NestedPaymentHistory 
                row={row} 
                ledgers={ledgers} 
                baseCurrency={baseCurrency} 
                activeMode={activeMode} 
                selectOrder={(id: string) => { if (rowSpecificLoadingRecord) setSelectedLoadingRecord(rowSpecificLoadingRecord); selectOrder(id); }}
                expandedIds={expandedIds}
                setExpandedIds={setExpandedIds}
                logClientError={logClientError}
                onOpenFullBill={() => setViewingRow(row)}
                loadingRemainingLoadingRecords={loadingRemainingLoadingRecords}
              />
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
            </React.Fragment>
          );
        })
      ) : (
        pageRows.map((row, index) => renderRow(row, index))
      )}
              {!pageRows.length && !loading && !loadingRemainingLoadingRecords && (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <FileSpreadsheet style={{ width: 40, height: 40, opacity: 0.3 }} />
                      <span>{t("no_payment_records_found", currentLanguage)}</span>
                      {activeMode === "remaining" ? (
                        <div style={{ maxWidth: 420, textAlign: "center" }}>
                          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, display: "block" }}>
                            {tGlobal(currentLanguage, "pay.remaining_workflow_warning", "Warning: Workflow Rule: Remaining Payment requires Transfer to Loading first.")}
                          </span>
                          <span style={{ fontSize: 10, color: "#cbd5e1", display: "block", marginTop: 4 }}>
                            {tGlobal(currentLanguage, "pay.remaining_workflow_steps", "Orders only appear here after: Booking → Advance Payment → Transfer to Loading → Loading Confirmation. Ensure the order has been transferred to loading before making a remaining payment.")}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>{t("try_adjusting_filters", currentLanguage)}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {(loading || loadingRemainingLoadingRecords) && (
                <tr>
                  <td colSpan={11} style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
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
              {t("showing", currentLanguage)} <strong className="font-semibold text-slate-700 dark:text-slate-300">{pageRows.length ? pageIndex * pageSize + 1 : 0} {t("range_to", currentLanguage)} {Math.min(displayRows.length, (pageIndex + 1) * pageSize)}</strong> {t("of_records", currentLanguage)} <strong className="font-semibold text-slate-700 dark:text-slate-300">{displayRows.length}</strong> {t("records_word", currentLanguage)}
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
            {Array.from({ length: Math.ceil(displayRows.length / pageSize) }).slice(0, 5).map((_, idx) => (
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
              disabled={(pageIndex + 1) * pageSize >= displayRows.length}
              onClick={() => setPageIndex((idx) => idx + 1)}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-655 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
                (pageIndex + 1) * pageSize >= displayRows.length && "text-slate-400 opacity-50 cursor-not-allowed"
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
          title={`Payment Entry - PO ${selected.purchase_order_no}`}
          onClose={() => setSelectedId("")}
          className="h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[1760px] rounded-2xl shadow-2xl"
        >
          <div className="space-y-4 text-[12px]">
            {/* Already Transferred / Overpaid Warning Banner */}
            {(() => {
              const form = selected.form_data?.form || {};
              const totalPrice = (selected as any).form_data?.goodsEntries?.length
                ? (selected as any).form_data.goodsEntries.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)
                : Number(form.totalAmount || 0);
              const advancePercent = Number(form.advancePercent || 0);
              const requiredAdvanceBC = (totalPrice * advancePercent) / 100;
              const paidAdvanceBC = Number(selected.advance_paid || 0);
              const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
              const remainingDue = Number(selected.remaining_due || 0);
              const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
              const fromLoading = searchParams.get("fromLoading") === "true";
              if (activeMode === "advance" && remainingAdvanceBC <= 0.01) {
                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 animate-in fade-in duration-300">
                    <XCircle className="h-5 w-5 shrink-0" /> Already Transferred: The advance payment for PO {selected.purchase_order_no} has already been fully paid.
                  </div>
                );
              }
              if (activeMode === "remaining" && remainingDue <= 0.01 && !fromLoading) {
                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 animate-in fade-in duration-300">
                    <XCircle className="h-5 w-5 shrink-0" /> Already Transferred: The remaining due for PO {selected.purchase_order_no} has already been fully paid.
                  </div>
                );
              }
              return null;
            })()}

            {/* Professional Purchase Order Details Header */}
            {(() => {
              const form = selected.form_data?.form || {};
              const goods = selected.form_data?.goodsEntries || [];
              const poCurrencyHeader = String(form.currencyType || form.currency || selected.currency_code || "USD").toUpperCase();
              const exRateHeader = Number(selected.exchange_rate || form.exchangeRate || 1);
              const purchaseTotalHeader = Number(selected.order_total || form.totalAmount || goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0));
              const advanceHeader = Number(selected.advance_paid || form.advanceAmount || ((purchaseTotalHeader * Number(form.advancePercent || 0)) / 100));
              const remainingHeader = Math.max(0, Number(selected.remaining_due ?? (purchaseTotalHeader - advanceHeader)));
              const supplierHeader = form.salesAccountName || form.supplierName || form.salesCompanyName || "-";
              const companyHeader = form.purchaseCompanyName || form.salesCompanyName || form.companyName || "-";
              const branchHeader = rowBranchName(selected) || form.branchName || "-";
              const statusHeader = selected.payment_status || selected.status || "Posted";
              const goodsHeader = goods.map((g: any) => g.goodsName || g.productName || g.name).filter(Boolean).join(", ") || form.goodsName || "-";
              const grossWeightHeader = goods.reduce((sum: number, g: any) => sum + Number(g.grossWeight || g.gross_weight || 0), 0);
              const netWeightHeader = goods.reduce((sum: number, g: any) => sum + Number(g.netWeight || g.net_weight || 0), 0);

              const advancePercent = Number(form.advancePercent || 0);
              const requiredAdvanceBC = (purchaseTotalHeader * advancePercent) / 100;
              const paidAdvanceBC = Number(selected.advance_paid || 0);
              const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);

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

              const firstGood = goods[0] || {};
              const isPerKg = firstGood.priceType === "P/KGs" || String(firstGood.priceType || "").toLowerCase().includes("kg");

              const explicitLoadingPurchaseAmount = Number(
                searchParams.get("purchaseAmount") ||
                searchParams.get("loadedPurchaseAmount") ||
                selectedLoadingRecord?.report_payload?.totalPurchase ||
                selectedLoadingRecord?.report_payload?.purchaseAmount ||
                0
              );
              const loadingPurchaseAmount = fromLoading
                ? (explicitLoadingPurchaseAmount > 0 ? explicitLoadingPurchaseAmount : (isPerKg ? cNetWeight * cPriceRate : cLoadedQty * cPriceRate))
                : purchaseTotalHeader;

              const exRate = Number(selected.exchange_rate || form.exchangeRate || 1) || 1;
              const poAdvancePaidForStatement = normalizeAdvanceToPurchaseCurrency(paidAdvanceBC, purchaseTotalHeader, exRate);
              const statementPurchaseForeign = fromLoading ? loadingPurchaseAmount : purchaseTotalHeader;
              const statementPurchaseLocal = statementPurchaseForeign * exRate;

              // Build payment history list
              let displayPayments: any[] = [];
              if (fromLoading && cLoadingRecordId) {
                const totalPOQuantity = Number(
                  selected.form_data?.totals?.totalQuantity ||
                  goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
                  form.quantity ||
                  1
                );
                const loadingAdvancePaid = Math.min(loadingPurchaseAmount, totalPOQuantity > 0 ? (cLoadedQty / totalPOQuantity) * poAdvancePaidForStatement : poAdvancePaidForStatement);
                const poAdvancePayment = selectedOrderPayments.find((p: any) => p.kind === "advance");
                const advanceSynthetic = {
                  id: "synthetic-advance-payment",
                  kind: "advance",
                  entry_date: poAdvancePayment?.entry_date || selected.created_at,
                  created_at: poAdvancePayment?.created_at || selected.created_at,
                  amount: loadingAdvancePaid,
                  currency_code: poCurrencyHeader,
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
                displayPayments = [...selectedOrderPayments];
              }

              const chronological = displayPayments.sort((a: any, b: any) =>
                new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime()
              );
              let runningTotalUSD = 0;
              let runningTotalAED = 0;
              const historyWithBalance = chronological.map((p: any, idx: number) => {
                const isPayLocal = p.currency_code?.toUpperCase() === baseCurrency.toUpperCase();
                const amtUSD = isPayLocal
                  ? Number(p.amount || 0) / Number(p.exchange_rate || exRate || 1)
                  : Number(p.amount || 0);
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
              const statPreviousDueFC = statementPurchaseForeign;
              const statPreviousDueLC = statementPurchaseLocal;
              const statCurrentPayFC = Number(latestHistory?.amtUSD || (amount > 0 ? (showCalcPanel && calcAmount ? Number(calcAmount) : amount / exRate) : statementPurchaseForeign));
              const statCurrentPayLC = Number(latestHistory?.amtAED || (amount > 0 ? amount : statementPurchaseLocal));
              const statRemainingFC = Number(latestHistory?.showRemainUSD ?? Math.max(0, statPreviousDueFC - statCurrentPayFC));
              const statRemainingLC = Number(latestHistory?.showRemainAED ?? Math.max(0, statPreviousDueLC - statCurrentPayLC));
              const statTotalPaidFC = historyWithBalance.reduce((sum, p) => sum + p.amtUSD, 0) || statCurrentPayFC;
              const statTotalPaidLC = historyWithBalance.reduce((sum, p) => sum + p.amtAED, 0) || statCurrentPayLC;
              const statTotalPaidPct = statPreviousDueFC > 0 ? Math.min(100, (statTotalPaidFC / statPreviousDueFC) * 100).toFixed(2) : "100.00";
              const statCurrentPayPct = statPreviousDueFC > 0 ? Math.min(100, (statCurrentPayFC / statPreviousDueFC) * 100).toFixed(2) : "100.00";

              const activePaymentAmountUSD = amount > 0
                ? (showCalcPanel && calcAmount ? Number(calcAmount) : amount / Number(exchangeRate || exRate || 1))
                : (latestHistory?.amtUSD || statementPurchaseForeign);
              const activePaymentAmountLocal = amount > 0
                ? amount
                : (latestHistory?.amtAED || statementPurchaseLocal);

              const paymentMethodDisplay = typeDetails.method || typeDetails.bankName || paymentType?.toUpperCase() || "Bank";

              return (
                <div className="space-y-4">
                  {/* TOP HEADER SUMMARY BAR (Matches Screenshot 1 Header) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">PAYMENT ENTRY NO.</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">{selected.purchase_order_no}</span>
                          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">ENTRY DATE</div>
                        <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 mt-0.5">{date(selected.created_at)}</div>
                      </div>
                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">TOTAL AMOUNT</div>
                        <div className="font-mono text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">{money(statementPurchaseForeign, poCurrencyHeader)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingRow(selected)}
                        className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                      >
                        VIEW PO
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenA4PDF(selected, true)}
                        className="h-8 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                      >
                        PRINT ENTRY
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsPoDetailsExpanded(!isPoDetailsExpanded)}
                        className="h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm flex items-center gap-1.5"
                      >
                        {isPoDetailsExpanded ? <Minus className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 stroke-[3]" />}
                        {isPoDetailsExpanded ? "COLLAPSE DETAILS" : "EXPAND DETAILS"}
                      </Button>
                    </div>
                  </div>

                  {/* Collapsible PO Full Specifications Details */}
                  {isPoDetailsExpanded && (
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 p-4 transition-all space-y-4">
                      <div className="grid gap-3 xl:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Invoice Amount</div>
                          <div className="mt-1 font-mono text-[13px] font-black text-slate-900 dark:text-slate-100">{money(purchaseTotalHeader, poCurrencyHeader)}</div>
                          <div className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{money(purchaseTotalHeader * exRateHeader, baseCurrency)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Required Advance</div>
                          <div className="mt-1 font-mono text-[13px] font-black text-indigo-700 dark:text-indigo-300">{money(requiredAdvanceBC, poCurrencyHeader)}</div>
                          <div className="mt-1 font-mono text-[10px] font-semibold text-slate-500">Percent: {advancePercent}%</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Advance Paid</div>
                          <div className="mt-1 font-mono text-[13px] font-black text-emerald-700 dark:text-emerald-300">{money(advanceHeader, poCurrencyHeader)}</div>
                          <div className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{money(advanceHeader * exRateHeader, baseCurrency)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Remaining Balance</div>
                          <div className="mt-1 font-mono text-[13px] font-black text-rose-700 dark:text-rose-300">{money(remainingHeader, poCurrencyHeader)}</div>
                          <div className="mt-1 font-mono text-[10px] font-semibold text-slate-500">{money(remainingHeader * exRateHeader, baseCurrency)}</div>
                        </div>
                      </div>

                      <div className="grid gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800 lg:grid-cols-4">
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">PO Number</span><span className="font-extrabold">{selected.purchase_order_no}</span></div>
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">Contract</span><span className="font-extrabold">{selected.purchase_contract_no || form.contractNo || "-"}</span></div>
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">Branch</span><span className="font-extrabold">{branchHeader}</span></div>
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">Currency & Rate</span><span className="font-mono font-extrabold">1 {poCurrencyHeader} = {Number(exRateHeader).toFixed(4)} {baseCurrency}</span></div>
                        <div className="lg:col-span-2"><span className="block text-[9px] font-black uppercase text-slate-400">Goods</span><span className="font-extrabold truncate block">{goodsHeader}</span></div>
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">Gross Weight</span><span className="font-mono font-extrabold">{grossWeightHeader.toLocaleString()} KG</span></div>
                        <div><span className="block text-[9px] font-black uppercase text-slate-400">Net Weight</span><span className="font-mono font-extrabold">{netWeightHeader.toLocaleString()} KG</span></div>
                      </div>
                    </section>
                  )}

                  {/* PAYMENT RECEIVER / VENDOR & PAYMENT METHOD CARD (Matches Screenshot 1) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
                      PAYMENT RECEIVER / VENDOR & PAYMENT METHOD
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Name</span>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">{supplierHeader}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Payment Method (A/C, etc.)</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{paymentMethodDisplay}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">Remarks / In Brief</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block" title={remarks || "Payment for Purchase"}>{remarks || "Payment for Purchase"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">PO / BILL NO.</span>
                        <div className="font-mono font-black text-slate-900 dark:text-slate-100">{selected.purchase_order_no}</div>
                        <div className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">Against Bill / Invoice</div>
                      </div>
                    </div>
                  </div>

                  {/* BLUE SECTION HEADER BANNER (Matches Screenshot 1) */}
                  <div className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white shadow-sm flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-extrabold text-xs shadow-sm">
                        <Landmark className="h-4 w-4 text-white" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black">{selected.purchase_order_no}</span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">Payment Entry</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-blue-100 mt-0.5">
                          <span>Payment Purpose: <strong className="text-white font-bold">{activeMode === "advance" ? "Purchase Advance" : "Purchase Payment"}</strong></span>
                          <span>•</span>
                          <span>Total Amount: <strong className="text-white font-mono font-bold">{money(statementPurchaseForeign, poCurrencyHeader)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500 text-white px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm">
                        {statusHeader}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition"
                      >
                        Charges (0)
                      </button>
                    </div>
                  </div>

                  {/* 1. PAYMENT ENTRY HISTORY (ALL TRANSACTIONS) Section (Matches Screenshot 1) */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                      <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        1. PAYMENT ENTRY HISTORY (ALL TRANSACTIONS)
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/dashboard/reports/ledger-report?accountCode=${encodeURIComponent(doubleEntry.debitCode)}`, "_blank")}
                          className="h-7 px-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border-blue-200"
                        >
                          Ledger Report
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPoDetailsExpanded(!isPoDetailsExpanded)}
                          className="h-7 px-2.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                        >
                          Summary
                        </Button>
                      </div>
                    </div>

                    {/* 4 Stats Summary Boxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-slate-50/40 border-b border-slate-100 dark:border-slate-800 dark:bg-slate-900/20">
                      {/* Box 1: PREVIOUS BALANCE / DUE (DR) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          <span>PREVIOUS BALANCE / DUE</span>
                          <span className="rounded bg-blue-100 text-blue-700 px-1 py-0.2 text-[8px] font-black dark:bg-blue-950 dark:text-blue-300">DR</span>
                        </div>
                        <div className="space-y-0.5 text-[10px] font-semibold">
                          <div className="flex justify-between"><span className="text-slate-400">Local:</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{money(statPreviousDueLC, baseCurrency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Equivalent ({poCurrencyHeader}):</span><span className="font-mono font-bold text-slate-700 dark:text-slate-300">{money(statPreviousDueFC, poCurrencyHeader)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Unpaid:</span><span className="font-mono font-bold text-rose-600 dark:text-rose-400">{money(statPreviousDueFC, poCurrencyHeader)}</span></div>
                          <div className="text-[8px] text-slate-400 text-right pt-0.5">As of: {date(selected.created_at)}</div>
                        </div>
                      </div>

                      {/* Box 2: TOTAL PAYMENT (CURRENT ENTRY) (CR) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          <span>TOTAL PAYMENT (CURRENT ENTRY)</span>
                          <span className="rounded bg-emerald-100 text-emerald-700 px-1 py-0.2 text-[8px] font-black dark:bg-emerald-950 dark:text-emerald-300">CR</span>
                        </div>
                        <div className="space-y-0.5 text-[10px] font-semibold">
                          <div className="flex justify-between"><span className="text-slate-400">Local:</span><span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(statCurrentPayLC, baseCurrency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Equivalent ({poCurrencyHeader}):</span><span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(statCurrentPayFC, poCurrencyHeader)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Unpaid:</span><span className="font-mono font-bold text-slate-700 dark:text-slate-300">{money(statCurrentPayFC, poCurrencyHeader)}</span></div>
                          <div className="text-[8px] text-slate-400 text-right pt-0.5">As of: {date(paymentDate || selected.created_at)}</div>
                        </div>
                      </div>

                      {/* Box 3: OVERALL BALANCE (DR) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          <span>OVERALL BALANCE</span>
                          <span className="rounded bg-blue-100 text-blue-700 px-1 py-0.2 text-[8px] font-black dark:bg-blue-950 dark:text-blue-300">DR</span>
                        </div>
                        <div className="space-y-0.5 text-[10px] font-semibold">
                          <div className="flex justify-between"><span className="text-slate-400">Local:</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{money(statRemainingLC, baseCurrency)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Equivalent ({poCurrencyHeader}):</span><span className="font-mono font-bold text-slate-700 dark:text-slate-300">{money(statRemainingFC, poCurrencyHeader)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Unpaid:</span><span className="font-mono font-bold text-rose-600 dark:text-rose-400">{money(statRemainingFC, poCurrencyHeader)}</span></div>
                          <div className="text-[8px] text-slate-400 text-right pt-0.5">As of: {date(paymentDate || selected.created_at)}</div>
                        </div>
                      </div>

                      {/* Box 4: PAYMENT HISTORY COUNT */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          <span>PAYMENT HISTORY COUNT</span>
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">{historyWithBalance.length}</span>
                        </div>
                        <div className="space-y-0.5 text-[10px] font-semibold">
                          <div className="flex justify-between"><span className="text-slate-400">Total Payments:</span><span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(statTotalPaidFC, poCurrencyHeader)} ({statTotalPaidPct}%)</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">This Payment:</span><span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(statCurrentPayFC, poCurrencyHeader)} ({statCurrentPayPct}%)</span></div>
                          <div className="text-[8px] text-slate-400 text-right pt-0.5">As of: {date(paymentDate || selected.created_at)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="max-h-[360px] overflow-auto">
                      <table className="w-full min-w-[1200px] text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-[9px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <Th className="px-3 py-2 text-center w-10">#</Th>
                            <Th className="px-3 py-2">PAYMENT DATE</Th>
                            <Th className="px-3 py-2">PAYMENT NO.</Th>
                            <Th className="px-3 py-2">PAYMENT METHOD</Th>
                            <Th className="px-3 py-2">PAID BY / FROM</Th>
                            <Th className="px-3 py-2 text-right">EXCHANGE RATE</Th>
                            <Th className="px-3 py-2 text-right">LOCAL AMOUNT</Th>
                            <Th className="px-3 py-2 text-right">EQUIVALENT ({poCurrencyHeader})</Th>
                            <Th className="px-3 py-2 text-right">DISCOUNT</Th>
                            <Th className="px-3 py-2 text-right">PAYMENT AMOUNT ({poCurrencyHeader})</Th>
                            <Th className="px-3 py-2 text-center">STATUS</Th>
                            <Th className="px-3 py-2 text-center w-14">ACTION</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {historyWithBalance.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-4 py-6 text-center text-xs text-slate-400 italic">
                                No previous payment records found. Record a new payment entry below.
                              </td>
                            </tr>
                          ) : (
                            historyWithBalance.map((payment: any) => {
                              const drLedger = ledgers.find((l) => ledgerId(l) === payment.debit_ledger_id);
                              const crLedger = ledgers.find((l) => ledgerId(l) === payment.credit_ledger_id);
                              const re = payment.roznamcha_entries || {};
                              const method = payment.typeDetails?.method || payment.payment_method || payment.typeDetails?.bankName || payment.bank_name || "Bank Transfer";
                              const sourceName = crLedger ? ledgerName(crLedger) : payment.typeDetails?.bankName || "Bank Account";
                              const sourceCode = crLedger ? ledgerCode(crLedger) : (payment.typeDetails?.refNo ? `A/C: ${payment.typeDetails.refNo}` : "-");

                              return (
                                <tr key={payment.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 text-xs transition">
                                  <td className="px-3 py-2.5 text-center font-bold text-slate-600 dark:text-slate-400">{payment.paymentNo}</td>
                                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-semibold">
                                    {date(payment.entry_date || payment.created_at)}
                                  </td>
                                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {re.super_admin_serial_number || payment.super_admin_serial_number || payment.reference_no || `AE-${String(payment.paymentNo).padStart(3, '0')}-0001`}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                                      {method}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{sourceName}</div>
                                    <div className="font-mono text-[9px] text-slate-400">{sourceCode}</div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {Number(payment.exchange_rate || exRate || 1).toFixed(4)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {money(payment.amtAED, baseCurrency)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {money(payment.amtUSD, poCurrencyHeader)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-500">
                                    0.00 {poCurrencyHeader}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                                    {money(payment.amtUSD, poCurrencyHeader)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[9px] font-black uppercase dark:bg-emerald-950 dark:text-emerald-300">
                                      Posted
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <NestedRowActions payment={payment} row={selected} ledgers={ledgers} localCurrency={baseCurrency} />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200">
                            <td colSpan={6} className="px-3 py-2 uppercase tracking-wide text-center">TOTALS</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">
                              {money(historyWithBalance.reduce((sum, p) => sum + p.amtAED, 0) || statCurrentPayLC, baseCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-black">
                              {money(historyWithBalance.reduce((sum, p) => sum + p.amtUSD, 0) || statCurrentPayFC, poCurrencyHeader)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">
                              0.00 {poCurrencyHeader}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-blue-700 dark:text-blue-400 font-black">
                              {money(historyWithBalance.reduce((sum, p) => sum + p.amtUSD, 0) || statCurrentPayFC, poCurrencyHeader)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* 2. ACCOUNTING ENTRIES (DOUBLE ENTRY) Section (Matches Screenshot 1) */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          2. ACCOUNTING ENTRIES (DOUBLE ENTRY)
                        </h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                          BALANCED
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsDoubleEntryExpanded(!isDoubleEntryExpanded)}
                          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Entry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDoubleEntryExpanded(!isDoubleEntryExpanded)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
                          title={isDoubleEntryExpanded ? "Collapse Entry Form" : "Expand Entry Form"}
                        >
                          {isDoubleEntryExpanded ? <Minus className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>
                      </div>
                    </div>

                    {/* Double Entry Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[9px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <Th className="px-3 py-2 text-center w-10">#</Th>
                            <Th className="px-3 py-2 w-16">DR / CR</Th>
                            <Th className="px-3 py-2">ACCOUNT NAME</Th>
                            <Th className="px-3 py-2 font-mono">ACCOUNT NO.</Th>
                            <Th className="px-3 py-2">DETAILS</Th>
                            <Th className="px-3 py-2 text-right">EXCHANGE RATE</Th>
                            <Th className="px-3 py-2 text-right">LOCAL AMOUNT</Th>
                            <Th className="px-3 py-2 text-right">EQUIVALENT ({poCurrencyHeader})</Th>
                            <Th className="px-3 py-2 text-center">FINAL CURRENCY</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {/* Row 1: DR (Supplier / Trade Payable) */}
                          <tr className="bg-blue-50/20 hover:bg-blue-50/50 dark:bg-blue-950/10 transition">
                            <td className="px-3 py-2 text-center font-bold text-slate-600">1</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">DR</span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{doubleEntry.debitName}</div>
                              <div className="text-[9px] text-slate-400 font-semibold">Trade Payable</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {doubleEntry.debitCode}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              Payment for Purchase - {selected.purchase_order_no}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              {Number(exchangeRate || exRate || 1).toFixed(4)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {money(activePaymentAmountLocal, baseCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {money(activePaymentAmountUSD, poCurrencyHeader)}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-600">
                              {baseCurrency}
                            </td>
                          </tr>

                          {/* Row 2: CR (Bank / Payment Source) */}
                          <tr className="bg-rose-50/20 hover:bg-rose-50/50 dark:bg-rose-950/10 transition">
                            <td className="px-3 py-2 text-center font-bold text-slate-600">2</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">CR</span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{doubleEntry.creditName}</div>
                              <div className="text-[9px] text-slate-400 font-semibold">{doubleEntry.creditName ? "Bank/Cash Account" : "Payment Source"}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {doubleEntry.creditCode}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              Bank Payment - {selected.purchase_order_no}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              {Number(exchangeRate || exRate || 1).toFixed(4)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {money(activePaymentAmountLocal, baseCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {money(activePaymentAmountUSD, poCurrencyHeader)}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-600">
                              {baseCurrency}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200">
                            <td colSpan={6} className="px-3 py-2 uppercase tracking-wide text-center">TOTAL</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-black">{money(activePaymentAmountLocal, baseCurrency)}</td>
                            <td className="px-3 py-2 text-right font-mono font-black">{money(activePaymentAmountUSD, poCurrencyHeader)}</td>
                            <td className="px-3 py-2 text-center font-mono">{baseCurrency}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* EXPANDABLE PAYMENT ENTRY FORM (Expands when clicked + / [+] button) */}
                    {isDoubleEntryExpanded && (
                      <div className="border-t-2 border-dashed border-blue-200 bg-slate-50/80 p-3.5 dark:border-blue-900/50 dark:bg-slate-900/50 space-y-3 animate-in fade-in duration-200 rounded-b-xl text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                            <span>Post New Payment Voucher / Roznamcha Settlement</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => setIsDoubleEntryExpanded(false)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ml-auto cursor-pointer"
                          >
                            ✕ Close Form
                          </button>
                        </div>

                        {/* 2-Column Split: Form on Left (7 cols), DR/CR Account Cards on Right (5 cols) */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                          {/* Left Column (Inputs): 7 cols */}
                          <div className="lg:col-span-7 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <FieldBlock label={t("payment_source_account", currentLanguage)} required>
                                <SearchSelect
                                  label=""
                                  value={paymentSourceLedgerId}
                                  placeholder={currentLanguage === "en" ? "Search Payment Source Account..." : "ادائیگی کا سورس اکاؤنٹ تلاش کریں..."}
                                  options={ledgerOptions}
                                  disabled={loading}
                                  onValueChange={(val) => {
                                    setPaymentSourceLedgerId(val);
                                    const led = ledgers.find((l) => ledgerId(l) === val);
                                    if (led) {
                                      const name = ledgerName(led).toLowerCase();
                                      const code = ledgerCode(led).toLowerCase();
                                      if (name.includes("cash") || code.includes("cash")) {
                                        setPaymentType("cash");
                                        setRoznamchaType("Cash Book No.");
                                      } else if (name.includes("bank") || code.includes("bank")) {
                                        setPaymentType("bank");
                                        setRoznamchaType("Roznamcha Book No.");
                                      }
                                    }
                                  }}
                                />
                                {selectedSourceLedger && (
                                  <div className="mt-0.5 text-[9.5px] font-semibold text-slate-500 flex justify-between">
                                    <span>{currentLanguage === "en" ? "Bal: " : "بیلنس: "}{sourceBalanceText}</span>
                                    <span>{currentLanguage === "en" ? "Cur: " : "کرنسی: "}{selectedSourceLedger.currency || baseCurrency}</span>
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
                                    { label: currentLanguage === "en" ? "Cash Book No." : "کیش بک نمبر", value: "Cash Book No." },
                                    { label: currentLanguage === "en" ? "Roznamcha Book No." : "روزنامچہ بک نمبر", value: "Roznamcha Book No." },
                                    { label: currentLanguage === "en" ? "Receipt No." : "رسید نمبر", value: "Receipt No." }
                                  ]}
                                  placeholder={currentLanguage === "en" ? "Select Type" : "قسم منتخب کریں"}
                                  className="relative z-[45] text-xs font-semibold text-slate-800 dark:text-slate-100 h-8"
                                />
                              </FieldBlock>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <FieldBlock label={t("roznamcha_number_label", currentLanguage)} required>
                                <Input
                                  className="h-8 text-xs font-semibold w-full"
                                  value={roznamchaNumber}
                                  onChange={(e) => setRoznamchaNumber(e.target.value)}
                                  placeholder="e.g. 000123"
                                />
                              </FieldBlock>

                              <FieldBlock label={t("payment_date_label", currentLanguage)} required>
                                <Input
                                  className="h-8 text-xs font-semibold w-full"
                                  type="date"
                                  value={paymentDate}
                                  onChange={(e) => setPaymentDate(e.target.value)}
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
                                  placeholder={currentLanguage === "en" ? "Select Currency" : "کرنسی منتخب کریں"}
                                  className="relative z-[45] text-xs font-semibold text-slate-800 dark:text-slate-100 h-8"
                                />
                              </FieldBlock>
                            </div>

                            {/* Dynamic Type Panel (Bank / Cash) */}
                            {paymentType && (
                              <div className="rounded-lg border bg-slate-50/60 p-2.5 dark:bg-slate-900/30">
                                <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                  {paymentType === "cash" && (currentLanguage === "en" ? "Cash Details" : "کیش کی تفصیلات")}
                                  {paymentType === "bank" && (currentLanguage === "en" ? "Bank Details" : "بینک کی تفصیلات")}
                                  {paymentType === "business" && (currentLanguage === "en" ? "Business Details" : "بزنس کی تفصیلات")}
                                  {paymentType === "invoice" && (currentLanguage === "en" ? "Invoice Details" : "انکوائس کی تفصیلات")}
                                  {paymentType === "transfer" && (currentLanguage === "en" ? "Transfer Details" : "منتقلی کی تفصیلات")}
                                </div>
                                
                                {paymentType === "bank" && (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      <div className="space-y-1 relative z-[46]">
                                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                          {currentLanguage === "en" ? "Bank Name" : "بینک کا نام"}
                                        </span>
                                        <SearchableSelect
                                          value={typeDetails.bankName || ""}
                                          onChange={(val) => {
                                            if (val === "__ADD_NEW__") {
                                              openAddOption("bank");
                                            } else {
                                              setTypeDetails((prev) => ({ ...prev, bankName: val }));
                                            }
                                          }}
                                          options={[
                                            { label: currentLanguage === "en" ? "Select Bank" : "بینک منتخب کریں", value: "" },
                                            ...(selected ? getCountryBankList(rowCountryName(selected)) : getCountryBankList(session?.countryName || "")).map((bank) => ({ label: bank, value: bank })),
                                            ...savedBanks.map((bank) => ({ label: bank.name, value: bank.name }))
                                          ]}
                                          placeholder={currentLanguage === "en" ? "Select Bank" : "بینک منتخب کریں"}
                                          addOptionLabel={currentLanguage === "en" ? "New Bank" : "نیا بینک"}
                                          className="text-xs font-semibold text-slate-800 dark:text-slate-100 h-8"
                                        />
                                      </div>

                                      <div className="space-y-1 relative z-[46]">
                                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                          {currentLanguage === "en" ? "Payment Method" : "ادائیگی کا طریقہ"}
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
                                            { label: currentLanguage === "en" ? "Select Method" : "طریقہ منتخب کریں", value: "" },
                                            ...["Cheque", "Mobile Transfer", "Online Transfer", "Bank Transfer"].map((method) => ({ label: method, value: method })),
                                            ...savedMethods.map((method) => ({ label: method, value: method }))
                                          ]}
                                          placeholder={currentLanguage === "en" ? "Select Method" : "طریقہ منتخب کریں"}
                                          addOptionLabel={currentLanguage === "en" ? "New Method" : "نیا طریقہ"}
                                          className="text-xs font-semibold text-slate-800 dark:text-slate-100 h-8"
                                        />
                                      </div>

                                      <FieldBlock label={currentLanguage === "en" ? "Reference No." : "حوالہ نمبر"}>
                                        <Input
                                          className="h-8 text-xs font-semibold w-full"
                                          value={typeDetails.refNo || ""}
                                          onChange={(e) => setTypeDetails((prev) => ({ ...prev, refNo: e.target.value }))}
                                          placeholder={currentLanguage === "en" ? "Cheque/Tx No" : "چیک یا ٹرانزیکشن نمبر"}
                                        />
                                      </FieldBlock>
                                      
                                      <FieldBlock label={currentLanguage === "en" ? "Attachment Upload" : "فائل منسلک اپ لوڈ"}>
                                        <div className="flex items-center gap-2">
                                          <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-md bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                                            <Paperclip className="h-3 w-3" />
                                            <span>{currentLanguage === "en" ? "Attach" : "منسلک کریں"}</span>
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
                                          {typeDetails.bankAttachmentName && <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border truncate max-w-[120px]">{typeDetails.bankAttachmentName}</span>}
                                        </div>
                                      </FieldBlock>
                                    </div>
                                  </div>
                                )}

                                {paymentType === "cash" && (
                                  <div className="grid gap-2.5 sm:grid-cols-2">
                                    <FieldBlock label={t("receiver_sender_name", currentLanguage)}>
                                      <Input className="h-8 text-xs font-semibold" value={typeDetails.receiverSenderName || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, receiverSenderName: e.target.value }))} placeholder={currentLanguage === "en" ? "Receiver/Sender" : "وصول کنندہ / بھیجنے والا"} />
                                    </FieldBlock>
                                    <FieldBlock label={t("mobile_number", currentLanguage)}>
                                      <Input className="h-8 text-xs font-semibold" value={typeDetails.mobileNumber || ""} onChange={(e) => setTypeDetails((p) => ({ ...p, mobileNumber: e.target.value }))} placeholder="03xxxxxxxxx" />
                                    </FieldBlock>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Currency Rate / Calculations */}
                            {currency && showCalcPanel && (
                              <div className="rounded-lg border bg-slate-50/60 p-2.5 dark:bg-slate-900/30">
                                <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  {t("transaction_conversion_details", currentLanguage)} ({selected?.currency_code || "USD"} ➔ {baseCurrency})
                                </div>
                                <div className="grid gap-2.5 sm:grid-cols-3">
                                  <FieldBlock label={`${t("purchase_currency_amount", currentLanguage)} (${selected?.currency_code || "USD"})`} required>
                                    <Input className="h-8 text-xs font-semibold" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} type="number" step="0.0001" min="0" placeholder="e.g. 100" />
                                  </FieldBlock>
                                  <FieldBlock label={t("exchange_rate_label", currentLanguage)} required>
                                    <Input className="h-8 text-xs font-semibold" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} type="number" step="0.0001" min="0" disabled={selected?.currency_code === baseCurrency && currency === baseCurrency} />
                                  </FieldBlock>
                                  <FieldBlock label={t("operation_label", currentLanguage)}>
                                    <select
                                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold outline-none"
                                      value={calcOp}
                                      onChange={(e) => setCalcOp(e.target.value as any)}
                                    >
                                      <option value="mul">{currentLanguage === "en" ? "Multiply (*)" : "ضرب کریں (*)"}</option>
                                      <option value="div">{currentLanguage === "en" ? "Divide (/)" : "تقسیم کریں (/)"}</option>
                                    </select>
                                  </FieldBlock>
                                </div>
                              </div>
                            )}

                            <FieldBlock label={`${t("final_local_amount", currentLanguage)} (${baseCurrency})`} required>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                                  {baseCurrency}
                                </span>
                                <Input
                                  className="h-8 pl-12 text-right text-xs font-black font-mono"
                                  value={showCalcPanel && calcFinal !== null ? calcFinal.toFixed(2) : finalPayment}
                                  onChange={(e) => setFinalPayment(e.target.value)}
                                  placeholder="0.00"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  disabled={showCalcPanel && calcFinal !== null}
                                />
                              </div>
                            </FieldBlock>

                            <FieldBlock label={t("comments_label", currentLanguage)}>
                              <textarea
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder={currentLanguage === "en" ? "Manually add descriptions, comments, or transaction notes..." : "تفصیلات، کمنٹس، یا ٹرانزیکشن نوٹس شامل کریں..."}
                              />
                            </FieldBlock>
                          </div>

                          {/* Right Column: DR ACCOUNTS & CR ACCOUNTS Live Panels (5 cols) */}
                          <div className="lg:col-span-5 space-y-3">
                            {/* Card 1: DR ACCOUNTS (Debit Destination) */}
                            <div className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-sm dark:border-blue-900/50 dark:bg-slate-950">
                              <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/40">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">DR</span>
                                  <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                                    DR ACCOUNTS
                                  </span>
                                </div>
                                <span className="text-[9.5px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                  Settlement Target
                                </span>
                              </div>

                              <div className="mt-2.5 space-y-2 text-xs">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Name</div>
                                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{doubleEntry.debitName}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Account No.</div>
                                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{doubleEntry.debitCode}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Branch</div>
                                    <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">{doubleEntry.debitBranch}</div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 font-bold">
                                  <span className="text-slate-500 text-[10.5px]">Amount to DR:</span>
                                  <span className="font-mono text-blue-700 dark:text-blue-400 font-black text-sm">{amount ? money(amount, baseCurrency) : "0.00 " + baseCurrency}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 2: CR ACCOUNT'S (Credit Payment Source) */}
                            <div className="rounded-xl border border-rose-200 bg-white p-3.5 shadow-sm dark:border-rose-900/50 dark:bg-slate-950">
                              <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-rose-900/40">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">CR</span>
                                  <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                                    CR ACCOUNT'S
                                  </span>
                                </div>
                                <span className="text-[9.5px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                                  Payment Source
                                </span>
                              </div>

                              <div className="mt-2.5 space-y-2 text-xs">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Source Account</div>
                                  <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{doubleEntry.creditName}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Account No.</div>
                                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{doubleEntry.creditCode}</div>
                                  </div>
                                  <div>
                                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Current Balance</div>
                                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{sourceBalanceText}</div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 font-bold">
                                  <span className="text-slate-500 text-[10.5px]">Amount to CR:</span>
                                  <span className="font-mono text-rose-600 dark:text-rose-400 font-black text-sm">{amount ? money(amount, baseCurrency) : "0.00 " + baseCurrency}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 3: Balanced Entry Status Pill */}
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 text-xs">
                              <div className="font-bold flex items-center justify-between">
                                <span>⚖️ Double-Entry Live Status</span>
                                <span className="font-black text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">BALANCED</span>
                              </div>
                              <div className="text-[10.5px] mt-1 font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                                DR: {doubleEntry.debitCode} ➔ CR: {doubleEntry.creditCode}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Submit Action Button */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="text-xs space-y-0.5 text-slate-500">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{currentLanguage === "en" ? "Posting: " : "پوسٹنگ: "}</span>
                              <span className="font-bold text-indigo-600">DR</span> {doubleEntry.debitName} ({doubleEntry.debitCode}) / <span className="font-bold text-rose-600">CR</span> {doubleEntry.creditName} ({doubleEntry.creditCode})
                            </div>
                            <div><span className="font-bold text-slate-800 dark:text-slate-200">{currentLanguage === "en" ? "Amount: " : "رقم: "}</span>{amount ? money(amount, baseCurrency) : "—"}</div>
                          </div>

                          <Button
                            type="button"
                            onClick={handleProcessPayment}
                            disabled={processingPayment || !amount || !canSave}
                            className="h-10 px-6 font-bold text-xs uppercase shadow-md transition bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                          >
                            {processingPayment ? (currentLanguage === "en" ? "Processing..." : "پروسیسنگ ہو رہی ہے...") : (
                              currentLanguage === "en" ? `Post ${activeMode === "advance" ? "Advance" : activeMode === "credit" ? "Credit" : "Remaining"} Payment` : `${activeMode === "advance" ? "ایڈوانس" : activeMode === "credit" ? "کریڈٹ" : "باقی"} ادائیگی پوسٹ کریں`
                            )}
                          </Button>
                        </div>

                        {/* Feedback messages */}
                        {paymentSuccess && (
                          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-sm text-emerald-700 animate-in fade-in duration-300">
                            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold mb-0.5">{currentLanguage === "en" ? "Payment Posted Successfully" : "ادائیگی کامیابی سے پوسٹ ہو گئی"}</div>
                              <div className="text-xs">{paymentSuccess}</div>
                            </div>
                          </div>
                        )}
                        {paymentError && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                            ❌ {paymentError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. NARRATION / REMARKS Section (Matches Screenshot 1) */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 p-3.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1.5">
                      3. NARRATION / REMARKS
                    </div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {remarks.trim() || `Payment for Purchase Order No. ${selected.purchase_order_no} against ${supplierHeader}.`}
                    </div>
                  </div>
                </div>
              );
            })()}
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
                <Label className="text-xs font-black">Bank Name</Label>
                <Input
                  className="text-xs font-semibold"
                  value={addOptionValue}
                  onChange={(e) => setAddOptionValue(e.target.value)}
                  placeholder="e.g. HBL Karachi Branch"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-black">Bank Address</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none"
                  value={addOptionAddress}
                  onChange={(e) => setAddOptionAddress(e.target.value)}
                  placeholder="Enter bank physical branch address..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs" onClick={commitAddOption}>
                  Save Bank
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 pb-3 border-b">
                <Label className="text-xs font-black">Add New Payment Method</Label>
                <div className="flex gap-2">
                  <Input
                    className="text-xs font-semibold"
                    value={addOptionValue}
                    onChange={(e) => setAddOptionValue(e.target.value)}
                    placeholder="e.g. EasyPaisa / JazzCash"
                  />
                  <Button type="button" className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs" onClick={commitAddOption}>
                    Add
                  </Button>
                </div>
              </div>

              {savedMethods.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs font-black">Custom Methods List (Click text to rename, or Blur to save)</Label>
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
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-slate-400 italic text-center py-2">
                  No custom payment methods added yet.
                </p>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAddOptionOpen(false)}>
                  Close
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
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colorClasses.iconBg, colorClasses.iconText)}>
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
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option.toLowerCase()}>{option}</option>)}
      </select>
    </label>
  );
}

function ReportActions({ rows, mode }: { rows: PurchaseOrderRow[]; mode: PaymentMode }) {
  function handleReportAction(fn: () => void) {
    fn();
    const details = document.activeElement?.closest("details");
    if (details) (details as HTMLDetailsElement).open = false;
  }
  return (
    <details className="relative">
      <summary className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-input bg-background text-foreground transition hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label="Payment report actions" title="Payment report actions">
        <MoreVertical className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-xl">
        <MenuAction icon={<Eye />} label="Plate View" onClick={() => handleReportAction(() => undefined)} />
        <MenuAction icon={<DownloadActionIcon />} label="Download" onClick={() => handleReportAction(() => exportRows(rows, mode))} />
        <MenuAction icon={<FileSpreadsheet />} label="Export Excel" onClick={() => handleReportAction(() => exportRows(rows, mode))} />
        <MenuAction icon={<DownloadActionIcon />} label="Export PDF" onClick={() => handleReportAction(() => {
          import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
            openGenericErpReport({
              title: "Purchase Order Payment Journal",
              subtitle: `Mode: ${mode.toUpperCase()} | Total ${rows.length} Records`,
              columns: [
                { key: "po_no", label: "PO Booking #" },
                { key: "branch", label: "Branch" },
                { key: "supplier_customer", label: "Party Name" },
                { key: "mode", label: "Mode" },
                { key: "bank_name", label: "Bank Account" },
                { key: "amount", label: "Amount", format: "currency" },
                { key: "status", label: "Status", format: "status" }
              ],
              rows: rows as Record<string, unknown>[]
            });
          });
        })} />
        <MenuAction icon={<Printer />} label="Print" onClick={() => handleReportAction(() => {
          import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
            openGenericErpReport({
              title: "Purchase Order Payment Journal",
              subtitle: `Mode: ${mode.toUpperCase()} | Total ${rows.length} Records`,
              columns: [
                { key: "po_no", label: "PO Booking #" },
                { key: "branch", label: "Branch" },
                { key: "supplier_customer", label: "Party Name" },
                { key: "mode", label: "Mode" },
                { key: "bank_name", label: "Bank Account" },
                { key: "amount", label: "Amount", format: "currency" },
                { key: "status", label: "Status", format: "status" }
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
        aria-label="Row actions"
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
            { icon: <Eye style={{ width: 14, height: 14 }} />, label: "View Details", color: "#2563eb", fn: () => handleItem(onSelect) },
            { icon: <WalletCards style={{ width: 14, height: 14 }} />, label: "Payment History", color: "#7c3aed", fn: () => handleItem(onSelect) },
            { icon: <Banknote style={{ width: 14, height: 14 }} />, label: "Journal Entry", color: "#059669", fn: () => handleItem(onSelect) },
            { icon: <Printer style={{ width: 14, height: 14 }} />, label: "Print", color: "#475569", fn: () => handleItem(() => window.print()) },
            { icon: <DownloadActionIcon />, label: "Export PDF", color: "#dc2626", fn: () => handleItem(() => window.print()) },
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

