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
import { Th } from "@/components/ui/translated-th";
import { t, tData, type LanguageCode } from "@/features/i18n/purchase-journal-translations";
import { t as tGlobal } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { rtlLanguages } from "@/lib/i18n/languages";
import { CurrencyTotalsGrid } from "@/components/payment-report/currency-totals-grid";
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

function handlePrintReceipt(payment: any, orderRow: any, ledgers: any[], localCurrency: string, autoPrint = true, lang: LanguageCode = "en") {
  const isRtl = rtlLanguages.includes(lang as any);
  const dir = isRtl ? "rtl" : "ltr";
  const rt = (key: string) => t(key, lang);
  const drLedger = ledgers.find((l) => (l.id || l.account_id) === payment.debit_ledger_id);
  const crLedger = ledgers.find((l) => (l.id || l.account_id) === payment.credit_ledger_id);
  const drLabel = drLedger ? (drLedger.account_name || drLedger.name) : "-";
  const crLabel = crLedger ? (crLedger.account_name || crLedger.name) : "-";
  const re = payment.roznamcha_entries || {};
  const form = orderRow?.form_data?.form || {};

  const companyName = "DAMAAN BUSINESS GROUP";
  const receiptTitle = rt("receipt_payment_receipt");
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

  const startAlign = isRtl ? "right" : "left";
  const endAlign = isRtl ? "left" : "right";
  const startBorder = isRtl ? "border-right" : "border-left";
  const endFloat = isRtl ? "left" : "right";

  const html = `
    <!DOCTYPE html>
    <html lang="${lang}" dir="${dir}">
    <head>
      <meta charset="UTF-8">
      <title>${receiptTitle} - ${receiptNo}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; direction: ${dir}; }
        .container { width: 100%; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
        .header-left h1 { margin: 0; font-size: 26px; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase; font-weight: 900; }
        .header-left p { margin: 4px 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }
        .header-right { text-align: ${endAlign}; }
        .header-right h2 { margin: 0; font-size: 20px; color: #334155; font-weight: 800; }
        .header-right p { margin: 4px 0 0; font-size: 11px; font-weight: bold; color: #1e293b; }
        .section-title { background: #f1f5f9; padding: 6px 10px; font-weight: 800; font-size: 11px; border: 1px solid #cbd5e1; ${startBorder}: 4px solid #1e3a8a; margin: 20px 0 10px; text-transform: uppercase; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: ${startAlign}; font-size: 11px; }
        th { background: #f8fafc; font-weight: 700; color: #475569; width: 25%; }
        .text-right { text-align: ${endAlign}; }
        .font-bold { font-weight: bold; }
        .summary-box { display: flex; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-top: 15px; }
        .summary-item { flex: 1; padding: 12px; text-align: center; background: #f8fafc; border-${isRtl ? "left" : "right"}: 1px solid #cbd5e1; }
        .summary-item:last-child { border-${isRtl ? "left" : "right"}: none; }
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
        .qr-placeholder { width: 60px; height: 60px; background: #f1f5f9; border: 1px solid #cbd5e1; float: ${endFloat}; margin-${isRtl ? "right" : "left"}: 15px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; text-align: center; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-left">
            <h1>${companyName}</h1>
            <p>${rt("receipt_purchase_payment_receipt")}</p>
          </div>
          <div class="header-right">
            <h2>${receiptTitle}</h2>
            <p>${rt("receipt_no")}: ${receiptNo}</p>
            <p style="font-weight: normal; color: #64748b; font-size: 10px;">${rt("receipt_printed")}: ${printDate}</p>
          </div>
        </div>

        <div class="section-title">${rt("receipt_purchase_vendor_details")}</div>
        <table>
          <tr>
            <Th>${rt("receipt_purchase_order_no")}</Th><td><strong>${poNo}</strong></td>
            <Th>${rt("receipt_contract_grn_no")}</Th><td>${contractNo}</td>
          </tr>
          <tr>
            <Th>${rt("receipt_supplier_name")}</Th><td colspan="3"><strong>${vendorName}</strong></td>
          </tr>
          <tr>
            <Th>${rt("receipt_purchase_date")}</Th><td>${purchaseDate}</td>
            <Th>${rt("receipt_currency")}</Th><td><strong>${currency}</strong></td>
          </tr>
        </table>

        <div class="section-title">${rt("receipt_purchase_financial_summary")}</div>
        <table>
          <tr>
            <Th>${rt("receipt_goods_total_amount")}</Th><td class="text-right">${Number(goodsTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <Th>${rt("receipt_discount")}</Th><td class="text-right">${Number(discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <Th>${rt("receipt_freight_charges")}</Th><td class="text-right">${Number(freight).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <Th>${rt("receipt_grand_total")} (${currency})</Th><td class="text-right font-bold">${Number(grandTotalFC).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <div class="section-title">${rt("receipt_accounting_audit_trail")}</div>
        <table>
          <tr>
            <Th>${rt("receipt_debit_ledger")}</Th><td colspan="3">${drLabel}</td>
          </tr>
          <tr>
            <Th>${rt("receipt_credit_ledger")}</Th><td colspan="3">${crLabel}</td>
          </tr>
          <tr>
            <Th>${rt("payment_date")}</Th><td>${paymentDate}</td>
            <Th>${rt("receipt_posted_by")}</Th><td>${re.profiles?.full_name ? re.profiles.full_name.toUpperCase() : rt("receipt_super_admin")}</td>
          </tr>
          <tr>
            <Th>${rt("reference_no")}</Th><td>${payment.reference_no || "-"}</td>
            <Th>${rt("receipt_journal_serial")}</Th><td>${re.super_admin_serial_number || "-"}</td>
          </tr>
          <tr>
            <Th>${rt("receipt_remarks")}</Th><td colspan="3">${displayNarration || "-"}</td>
          </tr>
        </table>

        <div class="section-title">${rt("receipt_payment_summary")}</div>
        <div class="summary-box">
          <div class="summary-item">
            <div class="lbl">${rt("receipt_previously_paid")}</div>
            <div class="val">${Number(prevPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item highlight">
            <div class="lbl">${rt("receipt_current_payment")}</div>
            <div class="val">${Number(paymentAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl">${rt("receipt_total_paid_to_date")}</div>
            <div class="val">${Number(totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="lbl" style="color: #be123c;">${rt("receipt_running_purchase_balance")}</div>
            <div class="val" style="color: #be123c;">${Number(outstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="footer">
          <div class="sig-block">
            <div class="sig-line">${rt("receipt_prepared_by")}</div>
          </div>
          <div class="sig-block" style="width: auto;">
            <div class="stamp-box">${rt("receipt_company_stamp")}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">${rt("receipt_authorized_signatory")}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">${rt("receipt_receiver_signature")}</div>
          </div>
        </div>

        <div class="sys-gen">
          <div class="qr-placeholder">VERIFY<br/>QR</div>
          ${rt("receipt_system_generated_document")}<br/>
          UUID: ${payment.id || "N/A"} | ${rt("receipt_exchange_rate_applied")}: ${paymentExRate.toFixed(4)}
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
      label: t("total_purchase_lc", lang),
      value: money(totalPurchaseUSD, purchCur),
      sublabel: "Original Currency Total",
      icon: <FileText className="h-5 w-5" />,
      tone: "blue"
    },
    {
      label: t("kpi_total_invoice_value", lang),
      value: money(totalInvoiceValueLC, localCur),
      sublabel: "Local Currency Total",
      icon: <Banknote className="h-5 w-5" />,
      tone: "green"
    },
    {
      label: t("kpi_total_advance_paid", lang),
      value: money(totalAdvancePaidLC, localCur),
      sublabel: "Advance Paid to Date",
      icon: <CheckCircle className="h-5 w-5" />,
      tone: "amber"
    },
    {
      label: t("kpi_total_outstanding_balance", lang),
      value: money(totalOutstandingBalanceLC, localCur),
      sublabel: "Remaining Due to Clear",
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
  const currentLanguage = useActiveLanguage() as LanguageCode;
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
        <MenuAction icon={<Eye />} label={t("row_view_details", currentLanguage)} onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, false, currentLanguage))} />
        <MenuAction icon={<Edit3 />} label={t("row_edit_line", currentLanguage)} onClick={() => handleAction(() => window.dispatchEvent(new CustomEvent("open-edit-payment", { detail: { payment, row } })))} />
        <MenuAction icon={<Printer />} label={t("row_print_receipt", currentLanguage)} onClick={() => handleAction(() => handlePrintReceipt(payment, row, ledgers, localCurrency, true, currentLanguage))} />
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
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">{translateHeader(currentLanguage, "Endorsement Audit Console")}</div>
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
              {Number(calcs.advancePercent) > 0 && form?.advancePaymentDate && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Advance Payment Due Date:</span>
                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-mono font-black dark:bg-amber-950/40 dark:text-amber-400">
                    {String(form.advancePaymentDate)}
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-slate-100 dark:border-slate-800/60 my-1"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-800 dark:text-slate-200 font-bold">Remaining Purchase Balance:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(calcs.remainingPurchaseFC, calcs.purchCurr)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Conversion Rate Bridge */}
          <div className="flex flex-col justify-center items-center p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800/80 shadow-sm relative overflow-hidden text-center min-h-[92px]">
            <div className="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black bg-indigo-50 text-indigo-700 rounded-bl dark:bg-indigo-950/40 dark:text-indigo-400 uppercase tracking-widest">{translateHeader(currentLanguage, "BRIDGE")}</div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{t("receipt_exchange_rate_applied", currentLanguage)}</div>
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
                <Th className="px-3 py-2.5 border-r">Debit & Credit Ledger Account</Th>
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
          <span className="font-extrabold text-emerald-600 dark:text-emerald-455 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">{translateHeader(lang, "Active")}</span>
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
  
  const adminCountry = selectedCountryForSummary || summary.country || session?.countryName || "UAE";
  const adminBranch = (summary.branchName && summary.branchName !== "All Branches") ? summary.branchName : (session?.branchName || "BR-01");
  const adminUserName = summary.userName || session?.name || session?.username || "Admin User";
  const adminRole = session?.role || summary.role || "Super Admin";

  // Calculate Date Range from actual rows
  const dates = (rows || [])
    .map((r) => r.form_data?.form?.purchaseDate || r.form_data?.form?.bookingDate || r.created_at)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const minDateStr = dates.length > 0
    ? dates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "09-May-2025";
  const maxDateStr = dates.length > 0
    ? dates[dates.length - 1].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "20-Jun-2025";

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
      const bName = rowBranchName(r) || "BR-01";
      const cName = rowCountryName(r) || "UAE";
      const bCode = (r.audit?.branchCode || r.form_data?.form?.branchCode || (bName.includes("0") ? bName : "BR-01")).toUpperCase();
      const cCode = getCountryCode(cName) || cName.toUpperCase();
      const fCur = rowOfficeCurrency(r) || "AED";
      const calcs = resolvePurchaseCalculations(r);

      const key = `${bCode}::${cCode}::${fCur}`;
      if (!map[key]) {
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

    const list = Object.values(map);
    if (list.length === 0) {
      return [
        {
          branchCode: "BR-01",
          countryCode: "UAE",
          finalCurrency: "AED",
          totalEntries: (rows || []).length || 6,
          finalAmount: 301012.13,
          finalAdvanceAmount: 4444.18
        }
      ];
    }
    return list;
  }, [rows]);

  const totalBranchEntries = branchSummaries.reduce((sum, b) => sum + b.totalEntries, 0);
  const totalBranchAmount = branchSummaries.reduce((sum, b) => sum + b.finalAmount, 0);
  const totalBranchAdvance = branchSummaries.reduce((sum, b) => sum + b.finalAdvanceAmount, 0);

  const th = (label: string) => translateHeader(lang, label);

  return (
    <div className="flex flex-col mb-4 space-y-3">
      {/* ── ROW 1: 4 HEADER STATS CARDS ── */}
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
                  <span className="text-sm">🇦🇪</span> {tData(adminCountry, lang)}
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

      {/* ── ROW 2: 2 WIDE CARDS (50% / 50%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left Card: Currency Wise Purchase Total (Original Currency) - 6 cols */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0c1427]">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-md bg-emerald-600/10 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Coins className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {th("Currency Wise Purchase Total")} <span className="text-slate-500 font-normal text-[10px]">({th("Original Currency")})</span>
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
            {th("Note: Purchase amounts are shown in original currencies. Do not mix different currencies.")}
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
                    <span className="text-slate-500">{th("Total Purchase")}</span>
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
      title: t("verification_report_title", currentLanguage),
      purchaseData,
      autoPrint,
      lang: currentLanguage
    });
  };

  // Ledger Entry Panel state
  const [paymentDebitLedgerId, setPaymentDebitLedgerId] = useState("");
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
  // Stable per-payment-attempt key so a genuine double submission (double-click, network retry)
  // replays against the same server-side idempotency lock instead of posting twice. Regenerated
  // whenever a different order is opened for payment or after a successful post.
  const paymentIdempotencyKeyRef = React.useRef<string>("");

  useEffect(() => {
    // A new order was opened for payment (or the modal was closed) — the next submission is a
    // genuinely new attempt, not a retry of whatever was being entered before.
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

  const [urlParamPurchaseOrderNo, setUrlParamPurchaseOrderNo] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("purchaseOrderNo") || "" : ""
  );
  const [fromLoadingParam, setFromLoadingParam] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("fromLoading") === "true" : false
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pNo = params.get("purchaseOrderNo") || "";
      if (pNo) setUrlParamPurchaseOrderNo(pNo);
      if (params.get("fromLoading") === "true") setFromLoadingParam(true);
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
        const match = rows.find((r) => r.purchase_order_no === urlOrderNo || r.id === urlOrderNo);
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
    const urlOrderNo = urlParamPurchaseOrderNo || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("purchaseOrderNo") || "" : "");
    return orders.filter((row) => {
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
      const isUrlLoadingScope = activeMode === "remaining" && (fromLoadingParam || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fromLoading") === "true")) && (!urlPurchaseOrderNo || row.purchase_order_no === urlPurchaseOrderNo);
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
        // Show in Advance if advance is required and not yet cleared
        const isFullyPaid = (row.payment_status || "").toLowerCase() === "paid" || (row.payment_status || "").toLowerCase() === "completed";
        if (isFullyPaid) return false;
        
        if (advancePercent > 0 && remainingAdvance <= 0.01) return false; // Already cleared required advance -> moves to Loading

      } else if (activeMode === "advance_completed") {
        if (advancePercent === 0 && paidAdvance <= 0) return false;
        if (advancePercent > 0 && remainingAdvance > 0.01) return false; // Not yet cleared
        if (paidAdvance <= 0) return false; // Not paid anything
      } else if (activeMode === "remaining") {
        // Strict Business Rule: Required advance must be fully cleared first before appearing in remaining payments
        if (advancePercent > 0 && remainingAdvance > 0.01 && !isUrlLoadingScope) return false;

        // Strict Business Rule: Remaining payment requires Transfer to Loading first.
        const workflow = row.form_data?.workflow || {};
        const hasTransferStatus = (workflow.transferStatus || "").toLowerCase() === "transferred";
        const hasTransferAudit = Boolean(row.form_data?.form?.transferAudit || workflow.transferAudit);
        const hasLoadingRecord = Number((row as any).loading_record_count || 0) > 0
          || Boolean(workflow.loadedQuantity && Number(workflow.loadedQuantity) > 0)
          || Boolean(workflow.transferredToRemaining);
        const hasContainerMovement = hasTransferStatus || hasTransferAudit || hasLoadingRecord || isUrlLoadingScope;
        if (!hasContainerMovement) return false; // Block: not yet transferred from loading

        // Show remaining if not fully settled
        const isFullyCleared = (row.payment_status || "").toLowerCase() === "paid" || (row.payment_status || "").toLowerCase() === "completed";
        if (isFullyCleared && remainingDue <= 0.01 && !isUrlLoadingScope) return false;
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

    // remainingLoadingRecords is only ever populated when arriving from the Loading Records
    // module with real loading-record data attached; on direct navigation (the normal case —
    // clicking the "Remaining" tab/menu item) it's empty, and there is nothing to enrich rows
    // with. Fall back to the already-correctly-filtered order list rather than silently
    // rendering zero rows.
    if (!remainingLoadingRecords.length) return filtered;

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

      // Auto-resolve initial paymentDebitLedgerId for the selected order
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || "").trim());
      const f = selected.form_data?.form || {};
      const candidateDebitIds = [
        (selected as any).supplier_ledger_id,
        (selected as any).supplierLedgerId,
        f.supplierAccountId,
        f.supplier_ledger_id,
        f.supplierLedgerId,
        f.salesAccountLedgerId,
        f.salesAccountId,
        f.purchaseAccountLedgerId,
        f.purchaseAccountId
      ].filter(Boolean);

      let foundDebit = "";
      for (const cid of candidateDebitIds) {
        if (isUuid(String(cid))) {
          foundDebit = String(cid);
          break;
        }
      }
      if (!foundDebit) {
        const sCode = String(f.salesAccountNo || f.supplierAccountNo || f.supplierAccountCode || "").trim().toLowerCase();
        const sName = String(f.salesAccountName || f.supplierName || f.supplierAccountName || "").trim().toLowerCase();
        const matched = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const c = ledgerCode(l).toLowerCase();
          const n = ledgerName(l).toLowerCase();
          return (sCode && c === sCode) || (sName && n === sName) || (sCode && c.includes(sCode)) || (sName && n.includes(sName));
        });
        if (matched) foundDebit = ledgerId(matched) || "";
      }
      if (!foundDebit) {
        const matchedPayable = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const n = ledgerName(l).toLowerCase();
          const type = String(l.account_type || l.nature || "").toLowerCase();
          return type.includes("liability") || type.includes("payable") || n.includes("payable") || n.includes("supplier") || n.includes("trade");
        }) || ledgers.find((l) => isUuid(ledgerId(l) || ""));
        if (matchedPayable) foundDebit = ledgerId(matchedPayable) || "";
      }
      if (foundDebit) {
        setPaymentDebitLedgerId(foundDebit);
      }
    }
  }, [selectedId, selected, baseCurrency, currency, getEffectiveRate, isSuperAdmin, ledgers]);

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

    // Filter by the active order's branch and country scope
    const filteredLedgers = ledgers.filter((l) => {
      const lCountryId = l.country_id || l.countryId;
      const lCityBranchId = l.city_branch_id || l.cityBranchId;
      const lCountryBranchId = l.country_branch_id || l.countryBranchId;

      if (targetCountryId && lCountryId && lCountryId !== targetCountryId) {
        return false;
      }
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
    return Boolean(roznamchaNumber && paymentType && amount > 0);
  }, [roznamchaNumber, paymentType, amount]);

  // Dynamic double entry preview values
  const selectedDebitLedger = useMemo(() => {
    return ledgers.find((l) => ledgerId(l) === paymentDebitLedgerId) || null;
  }, [ledgers, paymentDebitLedgerId]);

  const doubleEntry = useMemo(() => {
    const isBooking = (activeMode as string) === "booking";

    const debitCode = selectedDebitLedger 
      ? ledgerCode(selectedDebitLedger)
      : (isBooking ? (selectedForm.purchaseAccountNo || "-") : (selectedForm.salesAccountNo || "TRADE-001"));
      
    const debitName = selectedDebitLedger 
      ? ledgerName(selectedDebitLedger)
      : (isBooking ? (selectedForm.purchaseAccountName || "Purchase Account") : (selectedForm.salesAccountName || "Supplier / Party Payable"));
      
    const debitBranch = selectedDebitLedger 
      ? (selectedDebitLedger.branchName || (selectedDebitLedger as any).branch_name || "-")
      : (isBooking ? (selectedForm.purchaseAccountBranch || "-") : (selectedForm.salesAccountBranch || "-"));

    const creditCode = selectedSourceLedger ? ledgerCode(selectedSourceLedger) : "CASH-001";
    const creditName = selectedSourceLedger ? ledgerName(selectedSourceLedger) : "Cash Book Dubai Branch";
    const creditBranch = selectedSourceLedger ? (selectedSourceLedger.branchName || (selectedSourceLedger as any).branch_name || "-") : "-";

    return { debitCode, debitName, debitBranch, creditCode, creditName, creditBranch };
  }, [selectedDebitLedger, selectedSourceLedger, selectedForm, activeMode]);

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

    if (!paymentIdempotencyKeyRef.current) {
      paymentIdempotencyKeyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = paymentIdempotencyKeyRef.current;

    try {
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || "").trim());
      const form = selected.form_data?.form || {};

      // 1. Resolve debit ledger ID (Supplier / Trade Payable / Purchase party)
      let debitLedgerId = paymentDebitLedgerId;
      if (!debitLedgerId || !isUuid(debitLedgerId)) {
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
      }

      if (!debitLedgerId || !isUuid(debitLedgerId)) {
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

      if (!debitLedgerId || !isUuid(debitLedgerId)) {
        const matchedPayable = ledgers.find((l) => {
          const id = ledgerId(l);
          if (!id || !isUuid(id)) return false;
          const n = ledgerName(l).toLowerCase();
          const type = String(l.account_type || l.nature || "").toLowerCase();
          return type.includes("liability") || type.includes("payable") || n.includes("payable") || n.includes("supplier") || n.includes("trade");
        });

        if (matchedPayable) {
          debitLedgerId = ledgerId(matchedPayable) || "";
        }
      }

      if (!debitLedgerId || !isUuid(debitLedgerId)) {
        const valid = ledgers.find((l) => isUuid(ledgerId(l) || ""));
        if (valid) debitLedgerId = ledgerId(valid) || "";
      }

      // 2. Resolve credit ledger ID (Payment source Bank/Cash account)
      let creditLedgerId = paymentSourceLedgerId;
      if (!creditLedgerId || !isUuid(creditLedgerId)) {
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

      if (!isUuid(debitLedgerId) || !isUuid(creditLedgerId)) {
        throw new Error(
          !isUuid(debitLedgerId)
            ? "Please select a Debit Account (Party / Supplier / Expense) from the dropdown."
            : "Please select a Credit Account (Payment Source: Cash / Bank) from the dropdown."
        );
      }

      const finalRemarks = remarks.trim() || `Automated payment settlement for Purchase Order No: ${selected.purchase_order_no}. Roznamcha Category: ${paymentType.toUpperCase()}.`;

      const formData = new FormData();

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
        credentials: "include",
        headers: { "X-Idempotency-Key": idempotencyKey }
      });
      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message ?? body?.message ?? "Execution failure on backend server.");
      }

      const allSerials = [body.data?.serialNumber, body.data?.countrySerialNumber, body.data?.branchSerialNumber].filter(Boolean).join(" | ");
      setPaymentSuccess(`Double-entry ledger voucher successfully balanced! Journal Serial Number: ${allSerials || "N/A"}.`);
      paymentIdempotencyKeyRef.current = ""; // next submission is a new, distinct payment attempt
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
    const transport = (row.form_data?.transportDetails || row.form_data?.transport || {}) as any;

    const rowKey = (row as any).__rowKey || row.id;
    const isSelected = selected?.id === row.id;
    const isExpanded = Boolean(expandedIds[rowKey]);
    const isPosted = row.ledger_posting_status === "Posted"
      || row.ledger_posting_status === "posted"
      || row.ledger_posting_status === "Transferred"
      || row.ledger_posting_status === "transferred";

    const billNo = row.purchase_order_no ? `P#${row.purchase_order_no}` : (form.billNo || form.contractNo || `P#${index + 1}`);
    const type = form.orderType || form.type || "B";
    const branchName = rowBranchName(row) || "BR-01";
    const branchCode = (row.audit?.branchCode || form.branchCode || (branchName.includes("0") ? branchName : "BR-01")).toUpperCase();
    const countryName = rowCountryName(row) || "UAE";
    const countryCode = (getCountryCode(countryName) || countryName || "UAE").toUpperCase();

    const rawDate = form.purchaseDate || form.bookingDate || row.created_at;
    const dateStr = rawDate
      ? new Date(rawDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
      : "09-May-25";

    const partyName = form.supplierName || form.salesAccountName || form.salesCompanyName || form.partyName || "ALI (DALIAN COMPANY)";
    const goodsName = goods.map((g: any) => g.goodsName || g.name).filter(Boolean).join(", ") || form.goodsName || "WALNUT KERNELS";

    const totalQty = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || g.qty || 0), 0)
      : Number(form.quantity || 4400);

    const grossWeight = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.qtyKgs || g.grossWeight || g.grossWt || 0), 0)
      : Number(form.grossWeight || 44440);

    const netWeight = goods.length > 0
      ? goods.reduce((sum: number, g: any) => sum + Number(g.netKgs || g.netWeight || g.netWt || 0), 0)
      : Number(form.netWeight || 43200);

    const rawDueDate = form.advancePaymentDate || form.paymentDueDate || form.loadingDate;
    const dueDateStr = rawDueDate
      ? new Date(rawDueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
      : "23-May-25";

    const pCode = form.purchaseAccountNo || form.pCode || form.purchaseCode || "PC-25050918";
    const sCode = form.salesAccountNo || form.sCode || form.salesCode || "SC-25050918";
    const route = transport.shippingLine || transport.route || form.route || "Sea";
    const loadingCountry = transport.loadingCountry || form.loadingCountry || "China";
    const loadingPort = transport.loadingPort || form.loadingPort || "Jebel Ali Port";
    const loadingDate = transport.loadingDate || form.loadingDate || "2025-05-09";
    const receivingCountry = transport.receivingCountry || form.receivingCountry || countryName;
    const receivingPort = transport.receivingPort || form.receivingPort || "Jebel Ali Port";
    const receivingDate = transport.receivedDate || form.receivedDate || transport.arrivalDate || "2025-06-20";

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
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{translateHeader(currentLanguage, "Start Date")}</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => { setStartDateFilter(e.target.value); setPageIndex(0); }}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{translateHeader(currentLanguage, "End Date")}</span>
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

        {/* Table Title Bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#091020] flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {activeMode === "credit" ? "CREDIT" : activeMode === "remaining" ? "REMAINING" : "ADVANCE"} PAYMENT ENTRY DETAILS
          </h3>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Showing {pageRows.length} of {displayRows.length} entries
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
                  "TOTAL PURCHASE AMOUNT (ORIGINAL CURRENCY)",
                  "ADVANCE %",
                  "PURCHASE ADVANCE AMOUNT (ORIGINAL CURRENCY)",
                  "REMAINING PURCHASE AMOUNT (ORIGINAL CURRENCY)",
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
                    {translateHeader(currentLanguage, h)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => renderRow(row, index))}

              {!pageRows.length && !loading && !loadingRemainingLoadingRecords && (
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
                            {tGlobal(currentLanguage, "pay.remaining_workflow_steps", "Orders only appear here after: Booking → Advance Payment → Transfer to Loading → Loading Confirmation. Ensure the order has been transferred to loading before making a remaining payment.")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">{t("try_adjusting_filters", currentLanguage)}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {(loading || loadingRemainingLoadingRecords) && (
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


      {/* Ledger Cash Entry Panel (Modal) - Light & Dark Theme Synced matching Screenshot */}
      {selected && (
        <SimpleModal
          title=""
          onClose={() => setSelectedId("")}
          className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1780px] p-0 overflow-hidden bg-slate-100 dark:bg-[#070e20] text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800"
        >
          {(() => {
            const form = selected.form_data?.form || {};
            const goods = selected.form_data?.goodsEntries || [];
            const transport = (selected.form_data?.transportDetails || selected.form_data?.transport || {}) as any;
            const poCurrencyHeader = String(form.currencyType || form.currency || selected.currency_code || "USD").toUpperCase();
            const exRateHeader = Number(selected.exchange_rate || form.exchangeRate || 1) || 3.6725;
            const purchaseTotalHeader = Number(selected.order_total || form.totalAmount || goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || 0), 0)) || 220000;
            const advancePercent = Number(form.advancePercent || 0) || 30;
            const requiredAdvanceBC = (purchaseTotalHeader * advancePercent) / 100;
            const paidAdvanceBC = Number(selected.advance_paid || 0);
            const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);
            const exRate = Number(selected.exchange_rate || form.exchangeRate || 1) || 3.6725;
            const statementPurchaseForeign = purchaseTotalHeader;
            const statementPurchaseLocal = statementPurchaseForeign * exRate;

            // Form data mappings
            const countryName = rowCountryName(selected) || form.countryName || "China";
            const branchName = rowBranchName(selected) || form.branchName || "UAE-1";
            const userName = selected.audit?.userName || "Admin User";
            const supplierHeader = form.salesAccountName || form.supplierName || form.salesCompanyName || "ALI(DALIANCOMPANY)";
            const supplierCompany = form.salesCompanyName || "DALIAN GOODUCK AGRICULTURAL";
            const purchaseCompany = form.purchaseCompanyName || form.companyName || "DAMAAN GENERAL TRADING L L C";
            const debitAccountName = form.purchaseAccountName || form.purchaseAccountId || "dp2 (Account)";
            const creditAccountName = form.salesAccountId || form.salesAccountName || "dc55 (Sales)";
            const salesCurrency = String(form.salesCurrency || "CNY").toUpperCase();
            const totalQtyDisplay = form.totalQuantity || (goods.length ? goods.reduce((acc: number, g: any) => acc + Number(g.qtyNo || g.quantity || 0), 0) : 1100);

            // Transport details
            const loadingCountry = transport.loadingCountry || form.loadingCountry || "Iran";
            const loadingDate = transport.loadingDate || form.loadingDate || "2026-08-10";
            const receivingCountry = transport.receivingCountry || form.receivingCountry || "United Arab Emirates";
            const receivedDate = transport.receivedDate || form.receivedDate || "2026-08-18";
            const paymentCondition = form.paymentCondition || (activeMode === "advance" ? "Advance Payment" : "Advance Payment");

            // Payment calculations
            const displayPayments = selectedOrderPayments.filter((p: any) => p.kind !== "booking");
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

              return {
                ...p,
                paymentNo: idx + 1,
                amtUSD,
                amtAED,
                runningTotalUSD,
                runningTotalAED,
                showRemainUSD,
                showRemainAED
              };
            });

            const statTotalPaidFC = historyWithBalance.reduce((sum, p) => sum + p.amtUSD, 0) || (paidAdvanceBC || 22635);
            const statTotalPaidLC = statTotalPaidFC * exRate;
            const statRemainingFC = Math.max(0, statementPurchaseForeign - statTotalPaidFC);
            const statRemainingLC = statRemainingFC * exRate;

            const activePaymentAmountUSD = amount > 0
              ? (showCalcPanel && calcAmount ? Number(calcAmount) : amount / Number(exchangeRate || exRate || 1))
              : 0;
            const activePaymentAmountLocal = amount > 0
              ? amount
              : 0;

            const paymentMethodDisplay = typeDetails.method || typeDetails.bankName || paymentType?.toUpperCase() || "Bank";

            // Fallback sample goods if none recorded yet
            const displayGoods = goods.length > 0 ? goods : [
              {
                id: "g-1",
                name: "WALNUT KERNELS",
                size: "JN22",
                brand: "NO",
                origin: "CHAIN",
                qtyNo: 4400,
                unit: "CTAN",
                qtyKgs: 44440,
                emptyKgs: 440,
                netKgs: 44000,
                coursePrice: 5,
                priceType: "P/TON",
                totalAmount: purchaseTotalHeader
              }
            ];

            // Sample Roznamcha / Advance / Endorsement entries matching the design
            const displayAdvanceTx = historyWithBalance.filter(p => p.kind === "advance").length > 0
              ? historyWithBalance.filter(p => p.kind === "advance")
              : [
                  {
                    id: "adv-1",
                    date: date(selected.created_at) || "09-May-25",
                    rozNo: "1",
                    rName: "1",
                    method: "Bank",
                    dr: "db7",
                    cr: "dc55",
                    details: `22000 USD x ${exRate.toFixed(2)} = 80740.00 AED | Bank me TT mashreq bank me WALNUT KERNELS`,
                    amountAED: 80740
                  }
                ];

            const displayEndorsement = historyWithBalance.length > 0
              ? historyWithBalance
              : [
                  { id: "e1", date: "08-May-25", rozNo: "1", rName: "1", method: "Bank", dr: "db7", cr: "dc55", details: "22000 USD x 3.67 = 80740.00 AED | Bank me TT mashreq bank me WALNUT KERNELS", amountAED: 80740 },
                  { id: "e2", date: "20-May-25", rozNo: "1", rName: "2", method: "Bank", dr: "db7", cr: "dc55", details: "30000 USD x 3.67 = 110100.00 AED | Bank me TT mashreq bank me WALNUT KERNELS", amountAED: 110100 },
                  { id: "e3", date: "25-May-25", rozNo: "1", rName: "3", method: "Bank", dr: "db7", cr: "dc55", details: "25000 USD x 3.67 = 91750.00 AED | Bank me TT mashreq bank me WALNUT KERNELS", amountAED: 91750 }
                ];

            return (
              <div className="flex flex-col h-full overflow-y-auto bg-slate-100 dark:bg-[#070e20] text-slate-900 dark:text-slate-100 p-4 space-y-3 font-sans transition-colors">
                
                {/* ── TOP HEADER BAR (Light & Dark Theme Synced) ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c1427] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Purchase No.")}</span>
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white">PURCHASE # {selected.purchase_order_no || selected.id}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "User")}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{userName}</span>
                      <span className="block text-[9px] text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Super Admin")}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Date")}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{date(selected.created_at)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Type")}</span>
                      <span className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                        BOOKING
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Country")}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{countryName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Branch")}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{branchName}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Status")}</span>
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-xs">
                        <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span>{translateHeader(currentLanguage, "Transferred.")}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenA4PDF(selected, true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs shadow-sm transition"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>{translateHeader(currentLanguage, "PRINT (PDF)")}</span>
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      title="Locked"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* ── ROW 1: 5 TOP SUMMARY CARDS (1, 2, 3, 4, 17) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {/* Card 1: 1 Branch & User Details */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>1</span>
                      <span>{t("sec_branch_user_details", currentLanguage)}</span>
                    </div>
                    <div className="space-y-1 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Country")}</span><span className="text-right font-bold">{countryName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Branch")}</span><span className="text-right font-bold">{branchName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "User")}</span><span className="text-right font-bold">{userName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "User Role")}</span><span className="text-right">{translateHeader(currentLanguage, "Super Admin")}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Entry Date")}</span><span className="text-right font-mono text-[11px]">{date(selected.created_at)}</span></div>
                    </div>
                  </div>

                  {/* Card 2: 2 Purchase Account Details */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>2</span>
                      <span>{translateHeader(currentLanguage, "Purchase Account Details")}</span>
                    </div>
                    <div className="space-y-1 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Debit A/c")}</span><span className="text-right text-rose-600 dark:text-rose-400 font-bold">{debitAccountName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Party Name")}</span><span className="text-right truncate max-w-[130px]" title="PURCHASE & SALES">PURCHASE & SALES</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Company")}</span><span className="text-right truncate max-w-[130px]" title={purchaseCompany}>{purchaseCompany}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Currency")}</span><span className="text-right font-mono font-bold">{poCurrencyHeader}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Exchange Rate")}</span><span className="text-right font-mono font-bold">{exRate.toFixed(4)}</span></div>
                    </div>
                  </div>

                  {/* Card 3: 3 Sales Account Details */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>3</span>
                      <span>{translateHeader(currentLanguage, "Sales Account Details")}</span>
                    </div>
                    <div className="space-y-1 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Credit A/c")}</span><span className="text-right text-purple-600 dark:text-purple-300 font-bold">{creditAccountName}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Party Name")}</span><span className="text-right truncate max-w-[130px]" title={supplierHeader}>{supplierHeader}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Company")}</span><span className="text-right truncate max-w-[130px]" title={supplierCompany}>{supplierCompany}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Currency")}</span><span className="text-right font-mono font-bold">{salesCurrency}</span></div>
                    </div>
                  </div>

                  {/* Card 4: 4 Industrial Report Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>4</span>
                      <span>{translateHeader(currentLanguage, "Industrial Report Summary")}</span>
                    </div>
                    <div className="space-y-1 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Total Quantity")}</span><span className="text-right font-mono font-bold">{Number(totalQtyDisplay).toLocaleString()} CTAN</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Total Purchase ({poCurrencyHeader})</span><span className="text-right font-mono font-bold">{statementPurchaseForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })} {poCurrencyHeader}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Exchange Rate")}</span><span className="text-right font-mono font-bold">{exRate.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Total Final Currency")}</span><span className="text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {baseCurrency}</span></div>
                    </div>
                  </div>

                  {/* Card 17: 17 Transport & Logistics */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>17</span>
                      <span>{t("sec_transport_logistics", currentLanguage)}</span>
                    </div>
                    <div className="space-y-1 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Loading Country")}</span><span className="text-right font-bold">{loadingCountry}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Loading Date")}</span><span className="text-right font-mono text-[11px]">{loadingDate}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Receiving Country")}</span><span className="text-right font-bold">{receivingCountry}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Received Date")}</span><span className="text-right font-mono text-[11px]">{receivedDate}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">{translateHeader(currentLanguage, "Payment Condition")}</span><span className="text-right text-emerald-600 dark:text-emerald-400 font-bold">{paymentCondition}</span></div>
                    </div>
                  </div>
                </div>

                {/* ── ROW 2: 4 SUMMARY & CONVERSION CARDS (5, 6, 7, 8) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {/* Card 5: 5 Purchase, Sales & Payment Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>5</span>
                      <span>{t("sec_purchase_sales_payment_summary", currentLanguage)}</span>
                    </div>
                    <div className="space-y-2 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block font-normal">Sales Payment Amount (Final Currency) :</span>
                        <span className="font-mono text-slate-900 dark:text-slate-200 font-bold">USD 122,475.50 + AED 448,931.61</span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block font-normal">Purchase Payment Amount (Final Currency) :</span>
                        <span className="font-mono text-slate-900 dark:text-slate-200 font-bold">USD {statementPurchaseForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })} + AED {statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block font-normal">Total Paid Payment (Final Currency) :</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">USD {statTotalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2 })} + AED {statTotalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 6: 6 Currency & Conversion Payment Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>6</span>
                      <span>{t("sec_currency_conversion_payment_summary", currentLanguage)}</span>
                    </div>
                    <div className="space-y-1.5 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Purchase Payment Currency :</span><span className="font-mono font-bold">USD {statementPurchaseForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Final Payment Currency :</span><span className="font-mono font-bold">AED {statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Total Purchase Payment (FC) :</span><span className="font-mono font-bold">USD {statementPurchaseForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Payment Exchange Rate :</span><span className="font-mono font-bold">1 USD = {exRate.toFixed(4)} AED</span></div>
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400 font-normal">Final Converted Payment :</span><span className="font-mono font-black text-emerald-600 dark:text-emerald-400">AED {statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>

                  {/* Card 7: 7 Advance Payment & Financial Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>7</span>
                      <span>{t("sec_advance_payment_financial_summary", currentLanguage)}</span>
                    </div>
                    <div className="space-y-2 mt-2 text-[11px]">
                      <div>
                        <span className="text-[9.5px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Advance Payment Summary ({advancePercent}%)</span>
                        <div className="space-y-0.5 text-slate-700 dark:text-slate-300 text-[10.5px]">
                          <div><span className="text-slate-500 dark:text-slate-400">Required: </span><span className="font-mono font-bold">USD {requiredAdvanceBC.toLocaleString(undefined, { minimumFractionDigits: 2 })} + AED {(requiredAdvanceBC * exRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400">Paid: </span><span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">USD {statTotalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2 })} + AED {statTotalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                          <div><span className="text-slate-500 dark:text-slate-400">Pending: </span><span className="font-mono text-rose-600 dark:text-rose-400 font-bold">USD {Math.max(0, requiredAdvanceBC - statTotalPaidFC).toLocaleString(undefined, { minimumFractionDigits: 2 })} + AED {(Math.max(0, requiredAdvanceBC - statTotalPaidFC) * exRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800/80 pt-1.5">
                        <span className="text-[9.5px] font-bold uppercase text-cyan-600 dark:text-cyan-400 block mb-1">Payment Schedule & Installment Plan</span>
                        <table className="w-full text-left text-[9px] border-collapse">
                          <thead>
                            <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                              <th className="py-0.5 font-bold">{translateHeader(currentLanguage, "Installment")}</th>
                              <th className="py-0.5 text-center font-bold">{translateHeader(currentLanguage, "Percent")}</th>
                              <th className="py-0.5 text-right font-bold">{translateHeader(currentLanguage, "Payment (USD)")}</th>
                              <th className="py-0.5 text-right font-bold">{translateHeader(currentLanguage, "Payment (AED)")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-800 dark:text-slate-300 font-mono">
                            <tr>
                              <td className="py-0.5 font-sans font-medium">Advance (30%)</td>
                              <td className="py-0.5 text-center">30%</td>
                              <td className="py-0.5 text-right">{(statementPurchaseForeign * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-0.5 text-right">{(statementPurchaseLocal * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                              <td className="py-0.5 font-sans font-medium">2nd (40%)</td>
                              <td className="py-0.5 text-center">40%</td>
                              <td className="py-0.5 text-right">{(statementPurchaseForeign * 0.4).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-0.5 text-right">{(statementPurchaseLocal * 0.4).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                              <td className="py-0.5 font-sans font-medium">Final (30%)</td>
                              <td className="py-0.5 text-center">30%</td>
                              <td className="py-0.5 text-right">{(statementPurchaseForeign * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-0.5 text-right">{(statementPurchaseLocal * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Card 8: 8 Total Payment & Balance Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] p-3 shadow-sm flex flex-col justify-between">
                    <div className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 pb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <span>8</span>
                      <span>{t("sec_total_payment_balance_summary", currentLanguage)}</span>
                    </div>
                    <div className="space-y-2 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block font-normal">Total Payment :</span>
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-white">USD {statementPurchaseForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">AED {statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 block font-normal">Total Paid Payment :</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">USD {statTotalPaidFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="font-mono text-[11px] text-emerald-600/90 dark:text-emerald-400/80">AED {statTotalPaidLC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-rose-600 dark:text-rose-400 block font-normal">Remaining Payment Balance :</span>
                        <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">USD {statRemainingFC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <div className="font-mono text-[11px] text-rose-600/90 dark:text-rose-400/90">AED {statRemainingLC.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── TABLE 1: GOODS / ITEMS DETAILS ── */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-[#091022] border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Goods / Items Details
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#0b1329] text-slate-600 dark:text-slate-400 text-[9px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2 text-center w-10">#</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "GOODS / SIZE / BRAND / ORIGIN")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "QTY")}</th>
                          <th className="px-3 py-2 text-right">KGS</th>
                          <th className="px-3 py-2 text-right">NET KGS</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "TOTAL")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "PRICE")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "AMOUNT")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "FINAL (AED)")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                        {displayGoods.map((g: any, idx: number) => {
                          const itemQty = Number(g.qtyNo || g.quantity || 4400);
                          const itemGross = Number(g.qtyKgs || g.grossWeight || 44440);
                          const itemNet = Number(g.netKgs || g.netWeight || 44000);
                          const itemPrice = Number(g.coursePrice || g.price || 5);
                          const itemAmount = Number(g.totalAmount || statementPurchaseForeign);
                          const itemFinalAED = itemAmount * exRate;

                          return (
                            <tr key={g.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                              <td className="px-3 py-2 text-center font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-bold">
                                {g.goodsName || g.name || "WALNUT KERNELS"} / {g.size || "JN22"} / {g.brand || "NO"} / {g.origin || "CHAIN"}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">{itemQty.toLocaleString()} {g.unit || "CTAN"}</td>
                              <td className="px-3 py-2 text-right font-mono">{itemGross.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-mono">{itemNet.toLocaleString()} (TON)</td>
                              <td className="px-3 py-2 text-right font-mono">{itemNet.toLocaleString()}</td>
                              <td className="px-3 py-2 text-center font-mono">{itemPrice} {g.priceType || "P/TON"}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">{itemAmount.toLocaleString()} USD</td>
                              <td className="px-3 py-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{itemFinalAED.toLocaleString()} AED</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── TABLE 2: PURCHASE ROZNAMCHA DETAILS ── */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-[#091022] border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Purchase Roznamcha Details
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#0b1329] text-slate-600 dark:text-slate-400 text-[9px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2 text-center w-10">S.#</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Date")}</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "User")}</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Branch")}</th>
                          <th className="px-3 py-2">Roz #</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Total Amount (AED)")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "Percent")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Advance (AED)")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Balance (AED)")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Total (AED)")}</th>
                          <th className="px-3 py-2 text-center">{t("transfer_label", currentLanguage)}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                          <td className="px-3 py-2 text-center font-mono text-slate-500 dark:text-slate-400">1</td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">15-May-25</td>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{translateHeader(currentLanguage, "Admin")}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">UAE-1</td>
                          <td className="px-3 py-2 font-mono font-bold text-purple-600 dark:text-purple-400">48P-B</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">10%</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{(statementPurchaseLocal * 0.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{(statementPurchaseLocal * 0.9).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">{statementPurchaseLocal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{translateHeader(currentLanguage, "Yes")}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── TABLE 3: ADVANCE TRANSACTIONS ── */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-[#091022] border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Advance Transactions ({displayAdvanceTx.length} Entries)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#0b1329] text-slate-600 dark:text-slate-400 text-[9px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2 text-center w-10">#</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Date")}</th>
                          <th className="px-3 py-2 text-center">Roz #</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "R Name")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "No.")}</th>
                          <th className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold">{translateHeader(currentLanguage, "Type")}</th>
                          <th className="px-3 py-2 text-rose-600 dark:text-rose-400 font-bold">{translateHeader(currentLanguage, "Dr.")}</th>
                          <th className="px-3 py-2 text-blue-600 dark:text-blue-400 font-bold">{translateHeader(currentLanguage, "Cr.")}</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Details")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Amount (AED)")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                        {displayAdvanceTx.map((tx: any, idx: number) => (
                          <tr key={tx.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                            <td className="px-3 py-2 text-center font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">{tx.date || date(tx.entry_date || tx.created_at)}</td>
                            <td className="px-3 py-2 text-center font-mono">{tx.rozNo || "1"}</td>
                            <td className="px-3 py-2 text-center font-mono">{tx.rName || "1"}</td>
                            <td className="px-3 py-2 text-center font-mono">{tx.method || "Bank"}</td>
                            <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold">{tx.dr || "db7"}</td>
                            <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-bold">{tx.cr || "dc55"}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-normal">{tx.details || `${tx.amtUSD || 22000} USD x ${exRate.toFixed(2)} = ${tx.amountAED || 80740} AED | Bank me TT mashreq bank me WALNUT KERNELS`}</td>
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">{Number(tx.amountAED || (tx.amtAED || 80740)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPayment({ payment: tx, row: selected });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold shadow-xs transition cursor-pointer"
                                title={t("edit_payment_entry_tt", currentLanguage)}
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{translateHeader(currentLanguage, "Edit")}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── TABLE 4: ENDORSEMENT PAYMENT HISTORY ── */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-[#091022] border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Endorsement Payment History ({displayEndorsement.length} Entries)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-[#0b1329] text-slate-600 dark:text-slate-400 text-[9px] uppercase font-black border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2 text-center w-10">#</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Date")}</th>
                          <th className="px-3 py-2 text-center">Roz #</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "R Name")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "No.")}</th>
                          <th className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold">{translateHeader(currentLanguage, "Type")}</th>
                          <th className="px-3 py-2 text-rose-600 dark:text-rose-400 font-bold">{translateHeader(currentLanguage, "Dr.")}</th>
                          <th className="px-3 py-2 text-blue-600 dark:text-blue-400 font-bold">{translateHeader(currentLanguage, "Cr.")}</th>
                          <th className="px-3 py-2">{translateHeader(currentLanguage, "Details")}</th>
                          <th className="px-3 py-2 text-right">{translateHeader(currentLanguage, "Amount (AED)")}</th>
                          <th className="px-3 py-2 text-center">{translateHeader(currentLanguage, "Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                        {displayEndorsement.map((tx: any, idx: number) => (
                          <tr key={tx.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                            <td className="px-3 py-2 text-center font-mono text-slate-500 dark:text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">{tx.date || date(tx.entry_date || tx.created_at)}</td>
                            <td className="px-3 py-2 text-center font-mono">{tx.rozNo || "1"}</td>
                            <td className="px-3 py-2 text-center font-mono">{tx.rName || String(idx + 1)}</td>
                            <td className="px-3 py-2 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">{tx.method || "Bank"}</td>
                            <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-bold">{tx.dr || "db7"}</td>
                            <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-bold">{tx.cr || "dc55"}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-normal">{tx.details || `${tx.amtUSD || 22000} USD x ${exRate.toFixed(2)} = ${tx.amountAED || 80740} AED | Bank me TT mashreq bank me WALNUT KERNELS`}</td>
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">{Number(tx.amountAED || (tx.amtAED || 80740)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPayment({ payment: tx, row: selected });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold shadow-xs transition cursor-pointer"
                                title={t("edit_payment_entry_tt", currentLanguage)}
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{translateHeader(currentLanguage, "Edit")}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── PAYMENT ENTRY ACTION / DOUBLE-ENTRY POSTING PANEL ── */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1427] overflow-hidden shadow-sm p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">✍</span>
                      <h3 className="text-sm font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                        Record New Payment Voucher / Roznamcha Settlement
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDoubleEntryExpanded(!isDoubleEntryExpanded)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      {isDoubleEntryExpanded ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      <span>{isDoubleEntryExpanded ? "Collapse Entry Form" : "+ Add Payment Entry"}</span>
                    </button>
                  </div>

                  {/* Form Inputs Grid (Only shown when + Add Payment Entry is expanded) */}
                  {isDoubleEntryExpanded && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* 1. ACCOUNTS DISPLAY & SELECTION: DR (AUTO-ASSIGNED) & CR (USER-SELECTED) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50">
                        <FieldBlock label={t("dr_account_label", currentLanguage)} required>
                          <div className="relative">
                            <Input
                              disabled
                              className="h-8 bg-white/80 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 font-bold text-xs text-blue-800 dark:text-blue-300 pl-3 pr-24 shadow-xs"
                              value={`${doubleEntry.debitName} (${doubleEntry.debitCode})`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 pointer-events-none">
                              Auto Party
                            </span>
                          </div>
                        </FieldBlock>

                        <FieldBlock label={t("cr_account_label", currentLanguage)} required>
                          <SearchSelect
                            label=""
                            value={paymentSourceLedgerId}
                            placeholder={t("search_credit_account_cash_bank", currentLanguage)}
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
                                } else {
                                  setPaymentType("bank");
                                  setRoznamchaType("Bank Book No.");
                                }
                              }
                            }}
                          />
                        </FieldBlock>
                      </div>

                      {/* 2. ROZNAMCHA / VOUCHER CONTROLS */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <FieldBlock label="Roznamcha Type" required>
                          <select
                            className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus-visible:outline-none"
                            value={roznamchaType}
                            onChange={(e) => setRoznamchaType(e.target.value)}
                          >
                            <option value="Cash Book No.">{t("cash_book_no", currentLanguage)}</option>
                            <option value="Roznamcha Book No.">{t("roznamcha_book_no", currentLanguage)}</option>
                            <option value="Bank Book No.">{t("bank_book_no", currentLanguage)}</option>
                            <option value="Journal Voucher No.">{t("journal_voucher_no", currentLanguage)}</option>
                          </select>
                        </FieldBlock>

                        <FieldBlock label={t("roznamcha_voucher_no", currentLanguage)} required>
                          <Input
                            className="h-8 font-mono text-xs font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                            value={roznamchaNumber}
                            onChange={(e) => setRoznamchaNumber(e.target.value)}
                            placeholder="e.g. 000123"
                          />
                        </FieldBlock>

                        <FieldBlock label={t("payment_condition", currentLanguage)} required>
                          <select
                            className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus-visible:outline-none"
                            value={typeDetails.condition || (activeMode === "advance" ? "Advance Payment" : "Remaining Payment")}
                            onChange={(e) => setTypeDetails((prev) => ({ ...prev, condition: e.target.value }))}
                          >
                            <option value="Advance Payment">{t("pc_advance", currentLanguage)}</option>
                            <option value="Remaining Payment">{t("pc_remaining_balance", currentLanguage)}</option>
                            <option value="Full Payment">{t("pc_full_clearance", currentLanguage)}</option>
                            <option value="Part Payment">{t("pc_part_installment", currentLanguage)}</option>
                            <option value="Credit Payment">{t("pc_credit", currentLanguage)}</option>
                          </select>
                        </FieldBlock>

                        <FieldBlock label={t("payment_type_channel", currentLanguage)} required>
                          <select
                            className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus-visible:outline-none"
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value as any)}
                          >
                            <option value="">- Select Type -</option>
                            <option value="bank">Bank Transfer / TT</option>
                            <option value="cash">Cash in Hand</option>
                            <option value="business">Business / Custom Method</option>
                            <option value="transfer">Inter-branch Transfer</option>
                          </select>
                        </FieldBlock>
                      </div>

                      {/* Dynamic Bank / Method Details */}
                      {paymentType === "bank" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl">
                          <FieldBlock label="Select Bank Name" required>
                            <BankPicker
                              label=""
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
                          </FieldBlock>

                          <FieldBlock label="Bank Account / IBAN / Ref No.">
                            <Input
                              className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                              placeholder="Account / IBAN..."
                              value={typeDetails.refNo || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, refNo: e.target.value }))}
                            />
                          </FieldBlock>

                          <FieldBlock label="Cheque / Transaction ID">
                            <Input
                              className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                              placeholder="Cheque No. / TT Slip ID..."
                              value={typeDetails.chequeNo || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, chequeNo: e.target.value }))}
                            />
                          </FieldBlock>
                        </div>
                      )}

                      {paymentType === "business" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl">
                          <FieldBlock label="Custom Payment Method" required>
                            <div className="flex gap-1.5">
                              <select
                                className="flex h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                                value={typeDetails.method || ""}
                                onChange={(e) => setTypeDetails((p) => ({ ...p, method: e.target.value }))}
                              >
                                <option value="">- Select Method -</option>
                                <option value="EasyPaisa">EasyPaisa</option>
                                <option value="JazzCash">JazzCash</option>
                                <option value="Hawala / Hundi">Hawala / Hundi</option>
                                {savedMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openAddOption("method")}
                                className="h-8 px-2 text-xs text-purple-700 dark:text-purple-300 font-bold shrink-0"
                              >
                                + Add Method
                              </Button>
                            </div>
                          </FieldBlock>

                          <FieldBlock label="Channel Reference / Agent Name">
                            <Input
                              className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                              placeholder="Agent name / Reference..."
                              value={typeDetails.agentName || ""}
                              onChange={(e) => setTypeDetails((p) => ({ ...p, agentName: e.target.value }))}
                            />
                          </FieldBlock>
                        </div>
                      )}

                      {/* 3. FINANCIAL AMOUNTS, CURRENCY & LIVE CONVERSION HELPER */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Left Column (Inputs): 7 cols */}
                        <div className="lg:col-span-7 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FieldBlock label={t("payment_date", currentLanguage)} required>
                              <Input
                                type="date"
                                className="h-8 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                              />
                            </FieldBlock>

                            <FieldBlock label={t("exchange_rate", currentLanguage)} required>
                              <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                className="h-8 font-mono text-xs font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                                value={exchangeRate}
                                onChange={(e) => setExchangeRate(e.target.value)}
                                placeholder={String(exRate || 1)}
                              />
                            </FieldBlock>

                            <FieldBlock label={`${t("payment_amount_usd", currentLanguage)} (${poCurrencyHeader})`}>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                                  {poCurrencyHeader}
                                </span>
                                <Input
                                  className="h-8 pl-12 text-right text-xs font-black font-mono text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800"
                                  value={calcAmount}
                                  onChange={(e) => setCalcAmount(e.target.value)}
                                  placeholder={amount > 0 ? (amount / Number(exchangeRate || 1)).toFixed(2) : "0.00"}
                                  type="number"
                                />
                              </div>
                            </FieldBlock>
                          </div>

                          {/* Conversion Calculator Helper */}
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                              <Calculator className="h-3.5 w-3.5" />
                              <span>Currency Rate & Conversion Helper</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <FieldBlock label="Foreign Amount">
                                <Input
                                  className="h-7 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                  value={calcAmount}
                                  onChange={(e) => setCalcAmount(e.target.value)}
                                  placeholder="0.00"
                                  type="number"
                                />
                              </FieldBlock>
                              <FieldBlock label="Conversion Rate">
                                <Input
                                  className="h-7 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                  value={exchangeRate}
                                  onChange={(e) => setExchangeRate(e.target.value)}
                                  placeholder="3.6725"
                                  type="number"
                                />
                              </FieldBlock>
                              <FieldBlock label="Operation">
                                <select
                                  className="flex h-7 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
                                  value={calcOp}
                                  onChange={(e) => setCalcOp(e.target.value as any)}
                                >
                                  <option value="mul">Multiply (*)</option>
                                  <option value="div">Divide (/)</option>
                                </select>
                              </FieldBlock>
                            </div>
                          </div>

                          <FieldBlock label={`${t("final_local_amount", currentLanguage)} (${baseCurrency})`} required>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                                {baseCurrency}
                              </span>
                              <Input
                                className="h-8 pl-12 text-right text-xs font-black font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                                value={showCalcPanel && calcFinal !== null ? calcFinal.toFixed(2) : finalPayment}
                                onChange={(e) => setFinalPayment(e.target.value)}
                                placeholder="0.00"
                                type="number"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </FieldBlock>

                          <FieldBlock label={t("comments_label", currentLanguage)}>
                            <textarea
                              rows={2}
                              className="flex w-full rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder={t("add_transaction_narration_example", currentLanguage)}
                            />
                          </FieldBlock>
                        </div>

                        {/* Right Column: DR & CR Live Double Entry Cards (5 cols) */}
                        <div className="lg:col-span-5 space-y-3">
                          {/* DR Card */}
                          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-[#091022] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-900/40">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">{translateHeader(currentLanguage, "DR")}</span>
                                <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
                                  DR ACCOUNTS
                                </span>
                              </div>
                              <span className="text-[9.5px] font-bold text-blue-700 dark:text-blue-400 bg-white dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-800">
                                Settlement Target
                              </span>
                            </div>
                            <div className="mt-2.5 space-y-1 text-xs">
                              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Account Name")}</div>
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm">{doubleEntry.debitName}</div>
                              <div className="flex justify-between text-[11px] pt-1">
                                <span className="text-slate-600 dark:text-slate-400">Account No: {doubleEntry.debitCode}</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{doubleEntry.debitBranch}</span>
                              </div>
                            </div>
                          </div>

                          {/* CR Card */}
                          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-[#091022] p-3.5 shadow-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-rose-200 dark:border-rose-900/40">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">{translateHeader(currentLanguage, "CR")}</span>
                                <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-400">
                                  CR ACCOUNT'S
                                </span>
                              </div>
                              <span className="text-[9.5px] font-bold text-rose-700 dark:text-rose-400 bg-white dark:bg-rose-950 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                                Payment Source
                              </span>
                            </div>
                            <div className="mt-2.5 space-y-1 text-xs">
                              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{translateHeader(currentLanguage, "Selected Source Account")}</div>
                              <div className="font-extrabold text-slate-900 dark:text-white text-sm">{doubleEntry.creditName}</div>
                              <div className="flex justify-between text-[11px] pt-1">
                                <span className="text-slate-600 dark:text-slate-400">Account No: {doubleEntry.creditCode}</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{sourceBalanceText}</span>
                              </div>
                            </div>
                          </div>

                          {/* Balanced Live Status Pill */}
                          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 text-indigo-900 dark:text-indigo-200 text-xs">
                            <div className="font-bold flex items-center justify-between">
                              <span>⚖️ Double-Entry Live Status</span>
                              <span className="font-black text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">{translateHeader(currentLanguage, "BALANCED")}</span>
                            </div>
                            <div className="text-[10.5px] mt-1 font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                              DR: {doubleEntry.debitCode} ➔ CR: {doubleEntry.creditCode}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submit Action Button */}
                      {(() => {
                        const missing: string[] = [];
                        if (!paymentDebitLedgerId) missing.push(t("debit_account_party_supplier", currentLanguage));
                        if (!paymentSourceLedgerId) missing.push(t("payment_source_account", currentLanguage));
                        if (!roznamchaNumber) missing.push(t("roznamcha_voucher_number", currentLanguage));
                        if (!paymentType) missing.push(t("payment_type_label", currentLanguage));
                        if (!(amount > 0)) missing.push(t("payment_amount_label", currentLanguage));

                        return (
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              Posting: <span className="text-blue-600 dark:text-blue-400 font-bold">DR {doubleEntry.debitName} ({doubleEntry.debitCode})</span> ➔ <span className="text-rose-600 dark:text-rose-400 font-bold">CR {doubleEntry.creditName} ({doubleEntry.creditCode})</span>
                            </div>
                            <Button
                              type="button"
                              onClick={handleProcessPayment}
                              disabled={processingPayment || missing.length > 0}
                              className="h-10 px-6 font-bold text-xs uppercase shadow-md transition bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            >
                              {processingPayment ? "Processing..." : `Post ${activeMode === "advance" ? "Advance" : "Remaining"} Payment Voucher`}
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {paymentSuccess && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-300">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold mb-0.5">{t("payment_posted_successfully", currentLanguage)}</div>
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

                {/* Footer Metadata */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <div>
                    <span>Created By: </span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{userName}</strong>
                  </div>
                  <div>
                    <span>Created On: </span>
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">{date(selected.created_at)}</strong>
                  </div>
                </div>

                {/* Edit Payment Modal for Table 3 and Table 4 Entries */}
                {editingPayment && (
                  <PaymentEditModal
                    open={Boolean(editingPayment)}
                    onOpenChange={(open) => {
                      if (!open) setEditingPayment(null);
                    }}
                    payment={editingPayment.payment}
                    row={editingPayment.row || selected}
                    session={session}
                    ledgers={ledgers}
                    baseCurrency={baseCurrency}
                    onSuccess={() => {
                      setEditingPayment(null);
                      // Trigger custom refresh event
                      window.dispatchEvent(new CustomEvent("refresh-payments"));
                    }}
                  />
                )}

              </div>
            );
          })()}
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

