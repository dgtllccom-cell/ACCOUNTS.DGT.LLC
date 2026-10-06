import { openUniversalPrintReport } from "./universal-print-engine";
import type { ERPCompanyInfo } from "./erp-report-template-builder";

export type CustomerLedgerRow = {
  srNo: number;
  date: string;
  branchEntryNo: string;
  userName: string;
  branchName: string;
  roznamachaNameAndNo: string;
  remarks: string;
  credit?: number;
  debit?: number;
  balance: number;
  dcType: "Dr" | "Cr";
  origCurrency?: string;
  origAmount?: number;
  exchangeRate?: number;
};

export type CustomerLedgerReportData = {
  customerName: string;
  customerCode: string;
  taxNo?: string;
  phone?: string;
  address?: string;

  openingBalance: number;
  openingDcType: "Dr" | "Cr";
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  closingDcType: "Dr" | "Cr";

  country: string;
  branch: string;
  currency: string;
  exchangeRateType?: string;

  salesAccount?: string;
  customerAccount?: string;
  roznamachaName?: string;
  roznamachaNo?: string;

  rows: CustomerLedgerRow[];
};

export function openCustomerLedgerPrintReport(input: {
  report: CustomerLedgerReportData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { report: r, companyInfo, lang = "en" } = input;
  const baseCurr = r.currency || "AED";

  openUniversalPrintReport({
    moduleType: "ledger",
    title: "Customer Account Ledger Statement",
    subtitle: `${r.customerName} (${r.customerCode})`,
    documentNo: r.customerCode,
    lang,
    orientation: "landscape",
    companyInfo,
    scope: {
      company: companyInfo?.name || undefined,
      country: r.country,
      branch: r.branch,
      currency: baseCurr,
      userName: companyInfo?.printedBy || "",
    },
    ledgerSummary: {
      accountName: r.customerName,
      accountCode: r.customerCode,
      countryBranch: `${r.country} • ${r.branch}`,
      currency: baseCurr,
      openingBalance: r.openingBalance,
      openingDcType: r.openingDcType,
      totalDebit: r.totalDebit,
      totalCredit: r.totalCredit,
      closingBalance: r.closingBalance,
      closingDcType: r.closingDcType,
    },
    partyDetails: {
      type: "customer",
      name: r.customerName,
      code: r.customerCode,
      address: r.address,
      trn: r.taxNo,
      phone: r.phone,
    },
    columns: [
      { key: "srNo", label: "S.No", width: "4%", align: "center" },
      { key: "date", label: "Date", format: "date", width: "8%" },
      { key: "branchEntryNo", label: "Voucher / Serial #", width: "10%" },
      { key: "roznamachaNameAndNo", label: "Source / Roznamcha", width: "12%" },
      { key: "userName", label: "User / Branch", width: "10%" },
      { key: "remarks", label: "Description / Narration", width: "24%" },
      { key: "currencyExRate", label: "Currency / Ex. Rate", width: "10%" },
      { key: "debit", label: "Debit (DR)", align: "right", format: "currency", width: "11%" },
      { key: "credit", label: "Credit (CR)", align: "right", format: "currency", width: "11%" },
      { key: "balance", label: "Balance", align: "right", format: "currency", width: "10%" },
    ],
    rows: r.rows.map((row) => ({
      srNo: row.srNo,
      date: row.date,
      branchEntryNo: row.branchEntryNo || "-",
      roznamachaNameAndNo: row.roznamachaNameAndNo || "-",
      userName: `${row.userName || ""} (${row.branchName || ""})`.trim() || "-",
      remarks: row.remarks || "-",
      origCurrency: row.origCurrency,
      origAmount: row.origAmount,
      exchangeRate: row.exchangeRate,
      currencyExRate: row.origCurrency && row.origCurrency !== baseCurr ? `${row.origCurrency} ${row.origAmount || 0} (@ ${row.exchangeRate || 1})` : baseCurr,
      debit: row.debit || 0,
      credit: row.credit || 0,
      balance: row.balance,
      dcType: row.dcType,
    })),
    totals: {
      debit: r.totalDebit,
      credit: r.totalCredit,
      balance: r.closingBalance,
    },
    showSignatures: true,
    autoPrint: false,
  });
}
