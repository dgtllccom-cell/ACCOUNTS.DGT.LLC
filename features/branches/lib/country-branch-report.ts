/**
 * One data model for the Country Main Branch page: the live preview panel, the saved-branch drawer,
 * the A4 print/PDF and the CSV / mail export all read values built here, so they agree.
 * Only saved or entered values are used. A missing value stays empty (shown as "-") and is never
 * replaced with sample text such as a headquarters name, an owner code or a default nationality.
 */
import type { BranchProfileData } from "@/lib/reports/build-branch-profile-report";
import type { BranchReportData } from "@/lib/reports/open-a4-report-window";
import type { CompanyView, OwnerView } from "@/features/branches/lib/city-branch-owner-company";
import { companyRows, ownerRows, type CityBranchTranslate } from "@/features/branches/lib/city-branch-report";

export type CountryBranchReportInput = {
  /** Saved record id; empty while the branch has never been saved. */
  savedId: string;
  name: string;
  code: string;
  status: string;
  currency: string;
  operationalDomain: "business" | "shipping" | "";
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  country: string;
  countryIso2: string;
  stateProvince: string;
  district: string;
  city: string;
  fullAddress: string;
  /** Branch contacts entered on the form (not the company's). */
  contacts: Array<{ type: string; value: string }>;
  branchEmail: string;
  ownerName: string;
  company: CompanyView | null;
  owner: OwnerView | null;
  permissionTemplate: string;
  permissionGrants: string[];
};

function v(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** First company contact whose type matches. Values come only from the saved company record. */
function companyContact(company: CompanyView | null, match: (type: string) => boolean): string {
  if (!company) return "";
  const row = company.contacts.find((c) => match(c.type.toLowerCase()) && v(c.value));
  return row ? v(row.value) : "";
}

export function countryCompanyPhone(company: CompanyView | null): string {
  return companyContact(company, (t) => t.includes("phone") || t.includes("cell") || t.includes("mobile"));
}

export function countryCompanyEmail(company: CompanyView | null): string {
  return companyContact(company, (t) => t.includes("email") || t.includes("mail"));
}

/** Branch contact of a given kind from the form contacts (first non-empty match). */
export function countryBranchContact(contacts: Array<{ type: string; value: string }>, match: (type: string) => boolean): string {
  const row = contacts.find((c) => match((c.type || "").toLowerCase()) && v(c.value));
  return row ? v(row.value) : "";
}

export function buildCountryBranchDrawerData(input: CountryBranchReportInput, tt: CityBranchTranslate): BranchReportData {
  const company = input.company;
  const owner = input.owner;
  return {
    serialNumber: input.savedId ? input.savedId.slice(0, 4).toUpperCase() : undefined,
    branchStatus: input.status || undefined,
    branchCode: input.code || undefined,
    branchType: tt("branch.report_country_main_branch", "Country Main Branch"),
    country: input.country || undefined,
    currency: input.currency || undefined,
    branchName: input.name || undefined,
    createdDate: input.createdAt ? formatDate(input.createdAt) : undefined,
    updatedDate: input.updatedAt ? formatDateTime(input.updatedAt) : undefined,
    createdBy: input.createdByName || undefined,
    city: input.city || undefined,
    stateProvince: input.stateProvince || undefined,
    fullAddress: input.fullAddress || undefined,
    ownerName: owner?.name || input.ownerName || undefined,
    ownerCode: owner?.code || undefined,
    ownerPhone: owner?.mobile || undefined,
    ownerWhatsApp: owner?.whatsapp || undefined,
    ownerEmail: owner?.email || undefined,
    companyName: company?.name || undefined,
    companyCode: company?.companyCode || undefined,
    companyRegNo: company?.registrationNumber || undefined,
    companyTaxRegNo: company?.taxNumber || undefined,
    companyStatus: company?.companyStatus || undefined,
    companyPhone: countryCompanyPhone(company) || undefined,
    companyEmail: countryCompanyEmail(company) || undefined,
    companyOfficeAddress: company?.address || undefined,
    allowedPermissions: input.permissionGrants
  };
}

export function buildCountryBranchProfileData(input: CountryBranchReportInput, tt: CityBranchTranslate): BranchProfileData {
  const company = input.company;
  const owner = input.owner;
  return {
    branchName: input.name || null,
    branchCode: input.code || null,
    branchType: tt("branch.report_country_main_branch", "Country Main Branch"),
    branchStatus: input.status || null,
    serialNumber: input.savedId ? input.savedId.slice(0, 4).toUpperCase() : null,
    currency: input.currency || null,
    country: input.country || null,
    countryCode: input.countryIso2 || null,
    stateProvince: input.stateProvince || null,
    district: input.district || null,
    city: input.city || null,
    fullAddress: input.fullAddress || null,
    taxRegNo: company?.taxNumber || null,
    ntnGstNo: company?.taxNumber || null,
    ownerName: owner?.name || input.ownerName || null,
    ownerCode: owner?.code || null,
    ownerPhone: owner?.mobile || null,
    ownerWhatsApp: owner?.whatsapp || null,
    ownerEmail: owner?.email || null,
    companyName: company?.name || null,
    companyCode: company?.companyCode || null,
    companyType: company?.companyType || null,
    companyRegNo: company?.registrationNumber || null,
    companyStatus: company?.companyStatus || null,
    companyOfficeAddress: company?.address || null,
    createdBy: input.createdByName || null,
    createdDate: input.createdAt ? formatDate(input.createdAt) : null,
    updatedDate: input.updatedAt ? formatDateTime(input.updatedAt) : null,
    allowedPermissions: input.permissionGrants,
    permissionTemplate: input.permissionTemplate || null
  };
}

/** Label / value rows for the CSV and the mail body. Company and owner rows reuse the City builders. */
export function buildCountryBranchRows(input: CountryBranchReportInput, tt: CityBranchTranslate): Array<{ label: string; value: string }> {
  const branchRows = [
    { label: tt("branch.branch_name", "Branch Name"), value: input.name },
    { label: tt("branch.branch_code", "Branch Code"), value: input.code },
    { label: tt("branch.branch_type", "Branch Type"), value: tt("branch.report_country_main_branch", "Country Main Branch") },
    { label: tt("acct.status", "Status"), value: input.status },
    { label: tt("acct.currency", "Currency"), value: input.currency },
    { label: tt("acct.country", "Country"), value: input.country },
    { label: tt("cbs.state_province_word", "State / Province"), value: input.stateProvince },
    { label: tt("cbs.district_word", "District"), value: input.district },
    { label: tt("acct.city", "City"), value: input.city },
    { label: tt("acct.address", "Address"), value: input.fullAddress },
    { label: tt("acct.email", "Email"), value: input.branchEmail },
    ...input.contacts
      .filter((c) => v(c.type) || v(c.value))
      .map((c) => ({ label: v(c.type), value: v(c.value) })),
    { label: tt("cbs.pr_grants_count", "Granted Permissions"), value: input.permissionGrants.length ? String(input.permissionGrants.length) : "" },
    { label: tt("acct.created_by", "Created By"), value: input.createdByName },
    { label: tt("acct.created_on", "Created On"), value: input.createdAt ? formatDate(input.createdAt) : "" }
  ];
  return [...branchRows, ...companyRows(input.company, tt), ...ownerRows(input.owner, tt)].filter((row) => v(row.label));
}
