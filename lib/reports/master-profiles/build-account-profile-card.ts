/**
 * Customer Account Profile — the sample layout (DGT header, account holder card, Account Information,
 * Branch & Company Details, Customer Details, Bank Accounts, Business Activities, Remarks, signatures, footer).
 *
 * Rendered by the SAME master-profile engine as every other profile (lib/reports/open-master-profile-report-window.ts,
 * `profileCard` layout) and shown in the Account View with the same HTML, so the screen and the print cannot drift.
 *
 * Data rule: every value is a REAL field of the account (accounts general report row + account master + linked customer /
 * company / bank). A field the ERP does not hold renders as "-" — nothing is invented, no sample value is ever used.
 */

import type { MasterProfileConfig, ProfileCardConfig, ProfileCardField, ProfileCardBank } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import { makeT, fmtDate, brandingConfig, type Lang } from "./shared";

export type AccountProfileCardRecord = {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** accounts.account_number (global ERP number, e.g. ACC-000812) */
  globalAccountNumber?: string | null;
  /** derived from the linked party: Customer / Company / Bank / Personal */
  accountType?: string | null;
  /** account category code (P/S, B/C, EX …) — the ERP's account rule */
  accountCategory?: string | null;
  status?: string | null;
  currency?: string | null;
  createdAt?: string | null;
  countryName?: string | null;
  mainBranchName?: string | null;
  mainBranchCode?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  cityBranchName?: string | null;
  companyName?: string | null;
  companyCode?: string | null;
  createdByName?: string | null;
  /** the linked person / customer master (owner of the account) */
  customerId?: string | null;
  customerNumber?: string | null;
  customerName?: string | null;
  customerFatherName?: string | null;
  customerPhotoUrl?: string | null;
  customerMobile?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  /** linked bank accounts (enterprise_accounts.linked_banks resolved against the banks master) */
  banks?: Array<{
    name?: string | null;
    accountNumber?: string | null;
    ibanNumber?: string | null;
    branchName?: string | null;
    currency?: string | null;
    status?: string | null;
  }>;
  /** account notes / remarks, one per line (only real notes) */
  remarks?: string[];
  /** business activities of the linked party, one per item (only real entries) */
  activities?: string[];
};

const ACTIVE_STATUSES = new Set(["active", "approved", "open"]);

export function buildAccountProfileCardConfig(
  r: AccountProfileCardRecord,
  branding: DocumentBranding,
  lang: Lang,
): MasterProfileConfig {
  const tt = makeT(lang);
  const dash = (value: string | null | undefined): string | null => (value && String(value).trim() ? String(value).trim() : null);
  const field = (label: string, value: string | null | undefined): ProfileCardField => ({ label, value: dash(value) });
  const statusText = dash(r.status);
  const active = statusText ? ACTIVE_STATUSES.has(statusText.toLowerCase()) : false;

  const profileCard: ProfileCardConfig = {
    title: tt("acctprof.title", "Customer Account Profile"),
    brand: tt("acctprof.brand", "DAMAAN ERP SYSTEM"),
    tagline: tt("acctprof.tagline", "IMPORT • EXPORT • TRADING • CUSTOMS CLEARING"),
    trust: tt("acctprof.trust", "Trust • Quality • Growth"),
    footerReport: tt("acctprof.footer_report", "Customer Account Profile Report"),
    companyLines: [branding.address, branding.phone, branding.email, branding.website],
    logoUrl: branding.logoUrl || null,
    // the company's own name only — the branding resolver falls back to the COUNTRY name when no company name is configured,
    // which must never be printed as the company (shows "-" until the entity's branding is set)
    brandEntityName: branding.legalName || (branding.entityName && branding.entityName !== branding.countryName ? branding.entityName : null),
    photoUrl: dash(r.customerPhotoUrl),
    holderName: dash(r.customerName) || dash(r.accountName) || "-",
    holderIdLabel: tt("acctprof.holder_id", "Customer ID"),
    holderId: dash(r.customerNumber),
    account: [
      field(tt("acctprof.f_account_no", "Account No."), r.accountCode),
      field(tt("acctprof.f_account_rule", "Account Rule"), r.accountCategory),
      field(tt("acctprof.f_country_rule", "Country Account Rule"), null),
      field(tt("acctprof.f_account_type", "Account Type"), r.accountType),
      field(tt("acctprof.f_currency", "Currency"), r.currency),
      field(tt("acctprof.f_country", "Country"), r.countryName),
      field(tt("acctprof.f_main_branch", "Main Branch"), r.mainBranchName),
      field(tt("acctprof.f_main_branch_code", "Main Branch Code"), r.mainBranchCode),
      field(tt("acctprof.f_city_branch", "City Branch"), r.cityBranchName),
      field(tt("acctprof.f_city_branch_code", "City Branch Code"), r.branchCode),
    ],
    branch: [
      field(tt("acctprof.f_company", "Company Name"), r.companyName),
      field(tt("acctprof.f_company_code", "Company Code"), r.companyCode),
      field(tt("acctprof.f_branch", "Branch Name"), r.mainBranchName || r.branchName),
      field(tt("acctprof.f_branch_code", "Branch Code"), r.mainBranchCode),
      field(tt("acctprof.f_city_branch_name", "City Branch Name"), r.cityBranchName),
      field(tt("acctprof.f_city_branch_code", "City Branch Code"), r.branchCode),
      field(tt("acctprof.f_created_by", "Created By"), r.createdByName),
      field(tt("acctprof.f_created_date", "Created Date"), r.createdAt ? fmtDate(r.createdAt) : null),
    ],
    branchStatus: {
      label: tt("acctprof.f_status", "Status"),
      value: statusText ? (active ? tt("acctprof.status_active", "Active") : statusText) : null,
      active,
    },
    personal: [
      field(tt("acctprof.f_full_name", "Full Name"), r.customerName),
      field(tt("acctprof.f_father", "Father's Name"), r.customerFatherName),
      field(tt("acctprof.f_nationality", "Nationality"), null),
      field(tt("acctprof.f_dob", "Date of Birth"), null),
      field(tt("acctprof.f_passport", "Passport No."), null),
      field(tt("acctprof.f_visa", "Visa Status"), null),
      field(tt("acctprof.f_emirates_id", "Emirates ID"), null),
    ],
    contact: [
      field(tt("acctprof.f_phone", "Phone"), r.customerMobile),
      field(tt("acctprof.f_email", "Email"), r.customerEmail),
      field(tt("acctprof.f_website", "Website"), null),
      field(tt("acctprof.f_address", "Office Address"), r.customerAddress),
    ],
    business: [
      field(tt("acctprof.f_business_type", "Business Type"), null),
      field(tt("acctprof.f_business_activity", "Business Activity"), (r.activities || []).join(", ")),
      field(tt("acctprof.f_trade_license", "Trade License No."), null),
      field(tt("acctprof.f_license_issue", "License Issue Date"), null),
      field(tt("acctprof.f_license_expiry", "License Expiry"), null),
    ],
    banks: {
      columns: [
        tt("acctprof.b_no", "No."),
        tt("acctprof.b_name", "Bank Name"),
        tt("acctprof.b_iban", "Account No. (IBAN)"),
        tt("acctprof.f_currency", "Currency"),
        tt("acctprof.b_branch", "Branch"),
        tt("acctprof.f_account_type", "Account Type"),
        tt("acctprof.f_status", "Status"),
      ],
      rows: (r.banks || []).map((b, i): ProfileCardBank => {
        const bs = dash(b.status);
        return {
          no: String(i + 1),
          name: dash(b.name),
          iban: dash(b.ibanNumber) || dash(b.accountNumber),
          currency: dash(b.currency),
          branch: dash(b.branchName),
          accountType: null,
          status: bs ? (ACTIVE_STATUSES.has(bs.toLowerCase()) ? tt("acctprof.status_active", "Active") : bs) : null,
          active: bs ? ACTIVE_STATUSES.has(bs.toLowerCase()) : false,
        };
      }),
    },
    activitiesTitle: tt("acctprof.sec_activities", "Business Activities"),
    activities: (r.activities || []).filter((s) => s && s.trim()),
    remarksTitle: tt("acctprof.sec_remarks", "Remarks / Notes"),
    remarks: (r.remarks || []).filter((s) => s && s.trim()),
    sectionTitles: {
      account: tt("acctprof.sec_account", "Account Information"),
      branch: tt("acctprof.sec_branch", "Branch & Company Details"),
      customer: tt("acctprof.sec_customer", "Customer Details"),
      personal: tt("acctprof.sub_personal", "Personal Customer"),
      contact: tt("acctprof.sub_contact", "Contact Information"),
      business: tt("acctprof.sub_business", "Business Information"),
      banks: tt("acctprof.sec_banks", "Bank Accounts"),
    },
    signatures: [
      tt("acctprof.prepared", "Prepared By"),
      tt("acctprof.verified", "Verified By"),
      tt("acctprof.approved", "Approved By"),
    ],
    signatureHint: tt("acctprof.signature", "(Signature)"),
  };

  return {
    lang,
    title: profileCard.title,
    subtitle: profileCard.footerReport,
    reportTypeLabel: profileCard.footerReport,
    name: r.accountName,
    status: r.status || undefined,
    reportIdPrefix: "ACCT",
    reportIdValue: r.accountCode || (r.accountId ? r.accountId.slice(0, 8).toUpperCase() : ""),
    meta: [],
    sections: [],
    profileCard,
    ...brandingConfig(branding),
  };
}
