import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { openMasterProfileReportWindow, type MProfileRow } from "@/lib/reports/open-master-profile-report-window";

// Account profile report. Thin adapter over the canonical master-profile engine
// (lib/reports/open-master-profile-report-window.ts): it maps the real account record to the shared
// A4 layout. All labels come from the central dictionary; no design lives here.

export type AccountReportData = {
  accountName: string;
  accountCode: string;
  accountTitle: string;
  subType: string;
  category: string;
  accountGroup?: string;
  manualReferenceNumber?: string;
  currency: string;
  status?: string;
  openingBalance?: number;
  currentBalance?: number;
  totalDebit?: number;
  totalCredit?: number;
  customerDetail?: any;
  companyDetail?: any;
  bankDetail?: any;
  selectedCountryName?: string;
  selectedCountryCode?: string;
  selectedBranchName?: string;
  selectedBranchCode?: string;
  createdBy?: string;
  updatedBy?: string;
};

export function openAccountA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
  accountData: AccountReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;
  const lang = (input.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const b = input.accountData;

  const now = new Date();
  const stamp = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;

  function compactCode(id: string, prefix: string) {
    if (!id) return "";
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `${prefix}-${clean.slice(0, 4)}`;
  }
  const reg = (needle: string) => b.companyDetail?.registrations?.find((r: any) => String(r.type || "").toLowerCase().includes(needle))?.value;
  const contact = (needle: string) => b.companyDetail?.contacts?.find((c: any) => String(c.type || "").toLowerCase().includes(needle))?.value;
  const r = (label: string, value: MProfileRow["value"]): MProfileRow => ({ label, value });

  const accountGroup = b.accountGroup || b.category || b.subType || "";
  const currentBalance = b.currentBalance ?? ((b.openingBalance ?? 0) + (b.totalDebit ?? 0) - (b.totalCredit ?? 0));
  const money = (n: number | undefined) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const custObj = b.customerDetail?.customer;
  const taxReg = reg("tax");
  const ntnGst = reg("ntn") || reg("gst");

  openMasterProfileReportWindow({
    lang: input.lang,
    autoPrint: input.autoPrint,
    title: input.title || tt("acct.report_title", "Account Profile Report"),
    subtitle: input.subtitle || tt("acct.report_subtitle", "Account Profile Summary"),
    overviewLabel: tt("acct.overview", "Account Profile Overview"),
    name: b.accountName,
    status: b.status,
    createdBy: b.createdBy,
    reportIdPrefix: "ACC",
    reportIdValue: b.accountCode,
    meta: [
      { label: tt("acct.account_code", "Account Code"), value: b.accountCode },
      { label: tt("acct.account_group", "Account Group"), value: accountGroup },
      { label: tt("acct.currency", "Currency"), value: b.currency },
      { label: tt("acct.as_on", "Date / As On"), value: stamp.split(" ").slice(0, 3).join(" ") }
    ],
    kpis: [
      { label: tt("acct.opening_balance", "Opening Balance"), value: money(b.openingBalance), tone: "open" },
      { label: tt("acct.current_balance", "Current Balance"), value: money(currentBalance), tone: "current" },
      { label: tt("acct.total_debit", "Total Debit"), value: money(b.totalDebit), tone: "debit" },
      { label: tt("acct.total_credit", "Total Credit"), value: money(b.totalCredit), tone: "credit" }
    ],
    sections: [
      { title: tt("acct.sec_account_info", "Account Information"), rows: [
        r(tt("acct.account_name", "Account Name"), b.accountName),
        r(tt("acct.account_code", "Account Code"), b.accountCode),
        r(tt("acct.account_group", "Account Group"), accountGroup),
        r(tt("acct.account_type", "Account Type"), b.subType || b.category),
        r(tt("acct.currency", "Currency"), b.currency),
        r(tt("acct.status", "Status"), b.status),
        r(tt("acct.as_on", "Date / As On"), stamp)
      ]},
      { title: tt("acct.sec_customer_info", "Customer Information"), rows: [
        r(tt("acct.customer_name", "Customer Name"), custObj?.customer_name),
        r(tt("acct.company_name", "Company Name"), custObj?.company_name),
        r(tt("acct.customer_code", "Customer Code"), custObj?.id ? compactCode(custObj.id, `CUS-${b.selectedCountryCode || "AE"}`) : ""),
        r(tt("acct.phone", "Phone"), custObj?.mobile),
        r(tt("acct.email", "Email"), custObj?.email),
        r(tt("acct.address", "Address"), custObj?.address),
        r(tt("acct.city", "City"), b.selectedBranchName?.split(" - ")[0]),
        r(tt("acct.country", "Country"), b.selectedCountryName)
      ]},
      { title: tt("acct.sec_company_details", "Company Details"), rows: [
        r(tt("acct.company_name", "Company Name"), b.companyDetail?.companyName || b.companyDetail?.name),
        r(tt("acct.company_code", "Company Code"), b.companyDetail?.id ? compactCode(b.companyDetail.id, "COMP") : ""),
        r(tt("acct.business_type", "Business Type"), b.companyDetail?.businessName || b.companyDetail?.legal_name),
        r(tt("acct.registration_no", "Registration No."), reg("registration") || reg("license") || reg("trade")),
        r(tt("acct.address", "Address"), b.companyDetail?.address),
        r(tt("acct.country", "Country"), b.companyDetail?.country),
        r(tt("acct.phone", "Phone"), contact("phone") || contact("mobile") || contact("number")),
        r(tt("acct.email", "Email"), contact("email"))
      ]},
      { title: tt("acct.sec_bank_details", "Bank Details"), rows: [
        r(tt("acct.bank_name", "Bank Name"), b.bankDetail?.bank_name || b.bankDetail?.name),
        r(tt("acct.branch_name", "Branch Name"), b.bankDetail?.branch_name),
        r(tt("acct.account_title", "Account Title"), b.bankDetail?.account_title || b.accountName),
        r(tt("acct.bank_account_no", "Bank Account Number"), b.bankDetail?.account_number),
        r(tt("acct.iban", "IBAN"), b.bankDetail?.iban_number),
        r(tt("acct.swift", "Swift Code"), b.bankDetail?.swift_bic),
        r(tt("acct.currency", "Currency"), b.bankDetail?.currency || b.currency)
      ]},
      { title: tt("acct.sec_tax_info", "Tax Information"), rows: [
        r(tt("acct.tax_status", "Tax Status"), (taxReg || ntnGst) ? tt("acct.registered", "Registered") : tt("acct.not_registered", "Not Registered")),
        r(tt("acct.tax_registration_no", "Tax Registration No."), taxReg),
        r(tt("acct.ntn", "NTN"), reg("ntn")),
        r(tt("acct.gst_vat", "GST / VAT No."), reg("gst") || reg("vat")),
        r(tt("acct.currency", "Currency"), b.currency)
      ]},
      { title: tt("acct.sec_audit_info", "System / Audit Information"), rows: [
        r(tt("acct.created_by", "Created By"), b.createdBy),
        r(tt("acct.created_on", "Created On"), stamp),
        r(tt("acct.updated_by", "Last Updated By"), b.updatedBy || b.createdBy),
        r(tt("acct.updated_on", "Last Updated On"), stamp),
        r(tt("acct.reference_no", "Reference No."), b.manualReferenceNumber),
        r(tt("acct.branch", "Branch"), b.selectedBranchName)
      ]}
    ]
  });
}
