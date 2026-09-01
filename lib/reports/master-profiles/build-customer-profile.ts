/**
 * Customer Master Profile — professional A4 profile for a customer / person
 * master: identity, KYC, contacts, country/branch, business relationship,
 * linked accounts and contracts.
 *
 * Input: the customer record merged with its parsed metadata (see
 * features/customers/components/customer-profile.tsx).
 */

import type { MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import {
  makeT, pushRow, section, relatedTable, compact, money, fmtDate, fmtDateTime,
  metaCells, brandingConfig, type Lang,
} from "./shared";

export type CustomerProfileRecord = {
  id: string;
  customer_name: string;
  customer_number?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  father_name?: string | null;
  customer_type?: string | null;
  national_id?: string | null;
  trn?: string | null;
  kyc_date?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by_name?: string | null;
  notes?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  state_province_name?: string | null;
  district_name?: string | null;
  city_name?: string | null;
  country_name?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  branch_name?: string | null;
  companyRegNo?: string | null;
  companyTaxNo?: string | null;
  businessRelationship?: string | null;
  contacts?: Array<{ type?: string; value?: string }> | null;
  documents?: Array<{ type?: string; number?: string; issue?: string; expiry?: string }> | null;
  relatedAccounts?: Array<{ name?: string; code?: string; currency?: string; balance?: number; status?: string }> | null;
  relatedContracts?: Array<{ reference?: string; date?: string; amount?: number; currency?: string; status?: string }> | null;
};

export function buildCustomerProfileConfig(
  r: CustomerProfileRecord,
  branding: DocumentBranding,
  lang: Lang,
): MasterProfileConfig {
  const tt = makeT(lang);
  const contacts = (r.contacts || []).filter((c) => c && c.value);

  const sections = compact([
    section(tt("pdoc.sec_identity", "Identity"), (rows) => {
      pushRow(rows, tt("pdoc.customer_name", "Customer Name"), r.customer_name);
      pushRow(rows, tt("pdoc.customer_code", "Customer Code"), r.customer_number);
      pushRow(rows, tt("pdoc.company_name", "Company Name"), r.company_name);
      pushRow(rows, tt("pdoc.contact_person", "Contact Person"), r.contact_person);
      pushRow(rows, tt("pdoc.father_name", "Father / Guardian Name"), r.father_name);
      pushRow(rows, tt("pdoc.customer_type", "Customer Type"), r.customer_type);
      pushRow(rows, tt("pdoc.status", "Status"), r.is_active === false ? tt("pdoc.inactive", "Inactive") : tt("pdoc.active", "Active"));
    }),
    section(tt("pdoc.sec_kyc", "KYC / Verification"), (rows) => {
      pushRow(rows, tt("pdoc.national_id", "National ID / Passport"), r.national_id);
      pushRow(rows, tt("pdoc.trn", "Tax Registration No. (TRN)"), r.trn || r.companyTaxNo);
      pushRow(rows, tt("pdoc.reg_no", "Registration No."), r.companyRegNo);
      pushRow(rows, tt("pdoc.kyc_date", "KYC Date"), fmtDate(r.kyc_date));
    }),
    section(tt("pdoc.sec_contact", "Contact Information"), (rows) => {
      pushRow(rows, tt("pdoc.phone", "Phone"), r.mobile);
      pushRow(rows, tt("pdoc.whatsapp", "WhatsApp"), r.whatsapp);
      pushRow(rows, tt("pdoc.email", "Email"), r.email);
      for (const c of contacts) pushRow(rows, (c.type || tt("pdoc.contact", "Contact")) as string, c.value);
    }),
    section(tt("pdoc.sec_location", "Location & Branch"), (rows) => {
      pushRow(rows, tt("pdoc.address", "Address"), r.address);
      pushRow(rows, tt("pdoc.country", "Country"), r.country_name || branding.countryName);
      pushRow(rows, tt("pdoc.state_province", "State / Province"), r.state_province_name);
      pushRow(rows, tt("pdoc.district", "District"), r.district_name);
      pushRow(rows, tt("pdoc.city", "City"), r.city_name);
      pushRow(rows, tt("pdoc.branch", "Branch"), r.branch_name || branding.branchName);
    }),
    section(tt("pdoc.sec_relationship", "Business Relationship"), (rows) => {
      pushRow(rows, tt("pdoc.relationship", "Relationship"), r.businessRelationship);
    }),
    section(tt("pdoc.sec_remarks", "Remarks / Notes"), (rows) => {
      pushRow(rows, tt("pdoc.remarks", "Remarks"), r.notes);
    }),
    section(tt("pdoc.sec_audit", "System / Audit"), (rows) => {
      pushRow(rows, tt("pdoc.created_on", "Created On"), fmtDateTime(r.created_at));
      pushRow(rows, tt("pdoc.updated_on", "Last Updated"), fmtDateTime(r.updated_at));
      pushRow(rows, tt("pdoc.created_by", "Created By"), r.created_by_name);
      pushRow(rows, tt("pdoc.reference_no", "Reference No."), r.customer_number);
    }),
  ]);

  const relatedTables = compact([
    relatedTable(
      tt("pdoc.rt_documents", "KYC Documents"),
      [tt("pdoc.type", "Type"), tt("pdoc.number", "Number"), tt("pdoc.issue_date", "Issue Date"), tt("pdoc.expiry_date", "Expiry Date")],
      (r.documents || []).map((d) => [d.type, d.number, fmtDate(d.issue), fmtDate(d.expiry)]),
    ),
    relatedTable(
      tt("pdoc.rt_accounts", "Related Accounts"),
      [tt("pdoc.name", "Name"), tt("pdoc.code", "Code"), tt("pdoc.currency", "Currency"), tt("pdoc.balance", "Balance"), tt("pdoc.status", "Status")],
      (r.relatedAccounts || []).map((a) => [a.name, a.code, a.currency, a.balance != null ? money(a.balance, a.currency) : "", a.status]),
    ),
    relatedTable(
      tt("pdoc.rt_contracts", "Related Contracts"),
      [tt("pdoc.reference", "Reference"), tt("pdoc.date", "Date"), tt("pdoc.amount", "Amount"), tt("pdoc.status", "Status")],
      (r.relatedContracts || []).map((c) => [c.reference, fmtDate(c.date), c.amount != null ? money(c.amount, c.currency) : "", c.status]),
    ),
  ]);

  return {
    lang,
    title: tt("pdoc.customer_report_title", "Customer Master Profile"),
    subtitle: tt("pdoc.customer_report_subtitle", "Customer Profile & KYC Summary"),
    overviewLabel: tt("pdoc.customer_overview", "Customer Profile Overview"),
    reportTypeLabel: tt("pdoc.customer_report_title", "Customer Master Profile"),
    name: r.customer_name,
    status: r.is_active === false ? tt("pdoc.inactive", "Inactive") : tt("pdoc.active", "Active"),
    reportIdPrefix: "CUST",
    reportIdValue: r.customer_number || (r.id ? r.id.slice(0, 8).toUpperCase() : ""),
    meta: metaCells([
      [tt("pdoc.customer_code", "Customer Code"), r.customer_number],
      [tt("pdoc.company_name", "Company Name"), r.company_name],
      [tt("pdoc.country", "Country"), r.country_name || branding.countryName],
      [tt("pdoc.city", "City"), r.city_name],
    ]),
    sections,
    relatedTables,
    createdBy: r.contact_person || undefined,
    ...brandingConfig(branding),
  };
}
