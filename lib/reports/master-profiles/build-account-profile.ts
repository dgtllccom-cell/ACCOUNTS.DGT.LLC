/**
 * Account Master Profile — professional A4 profile for an ERP account
 * (enterprise account / ledger-linked account).
 *
 * Input: one row of the accounts general report
 * (`/api/erp/accounting/reports/accounts/general`) — already scope-filtered
 * server-side. No new API needed.
 */

import type { MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import {
  makeT, pushRow, section, relatedTable, compact, money, fmtDate, fmtDateTime,
  metaCells, kpiCards, brandingConfig, type Lang,
} from "./shared";

export type AccountProfileRecord = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountCategory?: string;
  subType?: string;
  status?: string;
  currency?: string;
  createdAt?: string;
  manualReferenceNumber?: string | null;
  customerNumber?: string | null;
  countrySerialNumber?: string;
  branchSerialNumber?: string;
  countryName?: string;
  countryId?: string | null;
  mainBranchName?: string;
  cityBranchName?: string;
  branchName?: string;
  branchCode?: string;
  cityName?: string;
  companyName?: string;
  companyCode?: string;
  companyOwner?: string;
  customerName?: string | null;
  bankName?: string;
  openingBalance?: number;
  debitTotal?: number;
  creditTotal?: number;
  currentBalance?: number;
  linkedLedgerCount?: number;
  journalActivityCount?: number;
  latestJournalNo?: string | null;
  latestActivityAt?: string | null;
  ledgerName?: string | null;
  ledgerStatus?: string;
  ledgerCurrency?: string;
  relatedLedgers?: Array<{ name?: string; code?: string; currency?: string; balance?: number; status?: string }>;
  relatedContracts?: Array<{ reference?: string; party?: string; date?: string; amount?: number; currency?: string; status?: string }>;
};

export function buildAccountProfileConfig(
  r: AccountProfileRecord,
  branding: DocumentBranding,
  lang: Lang,
): MasterProfileConfig {
  const tt = makeT(lang);
  const currency = r.currency || r.ledgerCurrency || branding.baseCurrency || "";

  const sections = compact([
    section(tt("pdoc.sec_identity", "Identity"), (rows) => {
      pushRow(rows, tt("pdoc.account_name", "Account Name"), r.accountName);
      pushRow(rows, tt("pdoc.account_code", "Account Code"), r.accountCode);
      pushRow(rows, tt("pdoc.account_category", "Account Category"), r.accountCategory);
      pushRow(rows, tt("pdoc.account_subtype", "Account Type / Sub-Type"), r.subType);
      pushRow(rows, tt("pdoc.manual_ref", "Manual Reference No."), r.manualReferenceNumber);
      pushRow(rows, tt("pdoc.status", "Status"), r.status);
    }),
    section(tt("pdoc.sec_owner", "Linked Party / Business"), (rows) => {
      pushRow(rows, tt("pdoc.customer_party", "Customer / Party"), r.customerName);
      pushRow(rows, tt("pdoc.customer_no", "Customer No."), r.customerNumber);
      pushRow(rows, tt("pdoc.company", "Company"), r.companyName);
      pushRow(rows, tt("pdoc.company_code", "Company Code"), r.companyCode);
      pushRow(rows, tt("pdoc.company_owner", "Company Owner"), r.companyOwner);
      pushRow(rows, tt("pdoc.bank", "Bank"), r.bankName);
    }),
    section(tt("pdoc.sec_location", "Location & Branch"), (rows) => {
      pushRow(rows, tt("pdoc.country", "Country"), r.countryName);
      pushRow(rows, tt("pdoc.country_serial", "Country Serial"), r.countrySerialNumber);
      pushRow(rows, tt("pdoc.main_branch", "Main Branch"), r.mainBranchName || r.branchName);
      pushRow(rows, tt("pdoc.city_branch", "City Branch"), r.cityBranchName);
      pushRow(rows, tt("pdoc.branch_code", "Branch Code"), r.branchCode);
      pushRow(rows, tt("pdoc.branch_serial", "Branch Serial"), r.branchSerialNumber);
      pushRow(rows, tt("pdoc.city", "City"), r.cityName);
    }),
    section(tt("pdoc.sec_financial", "Currency & Balances"), (rows) => {
      pushRow(rows, tt("pdoc.currency", "Currency"), currency);
      pushRow(rows, tt("pdoc.opening_balance", "Opening Balance"), r.openingBalance != null ? money(r.openingBalance, currency) : "");
      pushRow(rows, tt("pdoc.total_debit", "Total Debit"), r.debitTotal != null ? money(r.debitTotal, currency) : "");
      pushRow(rows, tt("pdoc.total_credit", "Total Credit"), r.creditTotal != null ? money(r.creditTotal, currency) : "");
      pushRow(rows, tt("pdoc.current_balance", "Current Balance"), r.currentBalance != null ? money(r.currentBalance, currency) : "");
      pushRow(rows, tt("pdoc.linked_ledgers", "Linked Ledgers"), r.linkedLedgerCount);
    }),
    section(tt("pdoc.sec_ledger", "Primary Ledger"), (rows) => {
      pushRow(rows, tt("pdoc.ledger_name", "Ledger Name"), r.ledgerName);
      pushRow(rows, tt("pdoc.ledger_status", "Ledger Status"), r.ledgerStatus);
      pushRow(rows, tt("pdoc.ledger_currency", "Ledger Currency"), r.ledgerCurrency);
      pushRow(rows, tt("pdoc.latest_journal", "Latest Journal No."), r.latestJournalNo);
      pushRow(rows, tt("pdoc.latest_activity", "Latest Activity"), fmtDateTime(r.latestActivityAt));
      pushRow(rows, tt("pdoc.activity_count", "Journal Activity Count"), r.journalActivityCount);
    }),
    section(tt("pdoc.sec_audit", "System / Audit"), (rows) => {
      pushRow(rows, tt("pdoc.created_on", "Created On"), fmtDateTime(r.createdAt));
      pushRow(rows, tt("pdoc.reference_no", "Reference No."), r.accountCode);
    }),
  ]);

  const relatedTables = compact([
    relatedTable(
      tt("pdoc.rt_ledgers", "Related Ledgers / Accounts"),
      [tt("pdoc.name", "Name"), tt("pdoc.code", "Code"), tt("pdoc.currency", "Currency"), tt("pdoc.balance", "Balance"), tt("pdoc.status", "Status")],
      (r.relatedLedgers || []).map((l) => [l.name, l.code, l.currency, l.balance != null ? money(l.balance, l.currency) : "", l.status]),
    ),
    relatedTable(
      tt("pdoc.rt_contracts", "Related Contracts"),
      [tt("pdoc.reference", "Reference"), tt("pdoc.party", "Party"), tt("pdoc.date", "Date"), tt("pdoc.amount", "Amount"), tt("pdoc.status", "Status")],
      (r.relatedContracts || []).map((c) => [c.reference, c.party, fmtDate(c.date), c.amount != null ? money(c.amount, c.currency) : "", c.status]),
    ),
  ]);

  const kpis = kpiCards([
    { label: tt("pdoc.opening_balance", "Opening Balance"), value: money(r.openingBalance ?? 0, currency), tone: "open" },
    { label: tt("pdoc.total_debit", "Total Debit"), value: money(r.debitTotal ?? 0, currency), tone: "debit" },
    { label: tt("pdoc.total_credit", "Total Credit"), value: money(r.creditTotal ?? 0, currency), tone: "credit" },
    { label: tt("pdoc.current_balance", "Current Balance"), value: money(r.currentBalance ?? 0, currency), tone: "current" },
  ]);

  return {
    lang,
    title: tt("pdoc.account_report_title", "Account Master Profile"),
    subtitle: tt("pdoc.account_report_subtitle", "Account Profile & Registry Summary"),
    overviewLabel: tt("pdoc.account_overview", "Account Profile Overview"),
    reportTypeLabel: tt("pdoc.account_report_title", "Account Master Profile"),
    name: r.accountName,
    status: r.status,
    reportIdPrefix: "ACCT",
    reportIdValue: r.accountCode || (r.accountId ? r.accountId.slice(0, 8).toUpperCase() : ""),
    meta: metaCells([
      [tt("pdoc.account_code", "Account Code"), r.accountCode],
      [tt("pdoc.company", "Company"), r.companyName],
      [tt("pdoc.country", "Country"), r.countryName],
      [tt("pdoc.city_branch", "City Branch"), r.cityBranchName || r.branchName],
    ]),
    kpis,
    sections,
    relatedTables,
    createdBy: r.companyOwner || r.customerName || undefined,
    ...brandingConfig(branding),
  };
}
