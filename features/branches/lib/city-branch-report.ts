/**
 * One report model for the City Branch page. The live summary, the drawer, the CSV / mail
 * export and the A4 print all read rows built here, so they show the same values.
 */
import type { MasterProfileConfig, MProfileSection, MProfileTable } from "@/lib/reports/open-master-profile-report-window";
import type { BranchReportData } from "@/lib/reports/open-a4-report-window";
import type { CompanyView, OwnerView } from "./city-branch-owner-company";
import { documentTypeLabel, formatFileSize, type CityBranchLinkedDocument, type CityBranchLinkedUser } from "./city-branch-detail";

export type CityBranchTranslate = (key: string, fallback: string) => string;

export type CityBranchReportRow = { label: string; value: string };

export type CityBranchReportInput = {
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
  state: string;
  district: string;
  city: string;
  area: string;
  zip: string;
  fullAddress: string;
  mainBranchName: string;
  mainBranchCode: string;
  mainBranchCurrency: string;
  contacts: Array<{ type: string; value: string }>;
  permissionTemplate: string;
  permissionGrants: string[];
  company: CompanyView | null;
  owner: OwnerView | null;
  users: CityBranchLinkedUser[];
  documents: CityBranchLinkedDocument[];
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

export function domainLabel(domain: string, tt: CityBranchTranslate): string {
  if (domain === "shipping") return tt("cbs.domain_shipping", "Shipping Line & Clearing Agent");
  if (domain === "business") return tt("cbs.domain_business", "Business & Trading");
  return "";
}

/** Readable fallback for a DB role code, e.g. "city_branch_admin" -> "City Branch Admin". */
function humanizeRole(role: string): string {
  return role
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function roleLabel(role: string, tt: CityBranchTranslate): string {
  if (!role) return "";
  return tt(`cbs.role_code_${role}`, humanizeRole(role));
}

export function accessProfileLabel(profile: string, tt: CityBranchTranslate): string {
  if (profile === "operations") return tt("cbs.access_profile_operations", "Operations");
  if (profile === "shipping_line") return tt("cbs.access_profile_shipping_line", "Shipping Line");
  return tt("cbs.access_profile_standard", "Standard");
}

export function companyRows(company: CompanyView | null, tt: CityBranchTranslate): CityBranchReportRow[] {
  if (!company) return [];
  return [
    { label: tt("acct.company_name", "Company Name"), value: company.name },
    { label: tt("cbs.pr_legal_name", "Legal Name"), value: company.legalName },
    { label: tt("cbs.pr_trade_name", "Trade Name"), value: company.tradeName },
    { label: tt("cbs.pr_company_code", "Company Code"), value: company.companyCode },
    { label: tt("cbs.pr_base_currency", "Base Currency"), value: company.baseCurrency },
    { label: tt("cbs.pr_business_type", "Business Type"), value: company.businessType },
    { label: tt("cbs.pr_registration_no", "Registration No."), value: company.registrationNumber },
    { label: tt("cbs.pr_tax_no", "Tax / NTN No."), value: company.taxNumber },
    { label: tt("cbs.pr_company_status", "Company Status"), value: company.companyStatus },
    { label: tt("cbs.pr_company_owner", "Company Owner (on record)"), value: company.ownerName },
    { label: tt("acct.country", "Country"), value: company.country },
    { label: tt("acct.city", "City"), value: company.city },
    { label: tt("acct.address", "Address"), value: company.address },
    ...company.contacts.map((c) => ({ label: c.type, value: c.value }))
  ];
}

export function ownerRows(owner: OwnerView | null, tt: CityBranchTranslate): CityBranchReportRow[] {
  if (!owner) return [];
  return [
    { label: tt("branch.owner_name", "Owner / Manager"), value: owner.name },
    { label: tt("cbs.pr_owner_code", "Owner Code"), value: owner.code },
    { label: tt("acct.company_name", "Company Name"), value: owner.companyName },
    { label: tt("cbs.pr_contact_person", "Contact Person"), value: owner.contactPerson },
    { label: tt("cbs.pr_mobile", "Mobile"), value: owner.mobile },
    { label: tt("branch.whatsapp", "WhatsApp"), value: owner.whatsapp },
    { label: tt("acct.email", "Email"), value: owner.email },
    { label: tt("acct.country", "Country"), value: owner.country },
    { label: tt("cbs.state_province_word", "State / Province"), value: owner.state },
    { label: tt("cbs.district_word", "District"), value: owner.district },
    { label: tt("acct.city", "City"), value: owner.city },
    { label: tt("acct.address", "Address"), value: owner.address }
  ];
}

export function contactRows(contacts: Array<{ type: string; value: string }>): CityBranchReportRow[] {
  return contacts.filter((c) => v(c.type) || v(c.value)).map((c) => ({ label: v(c.type), value: v(c.value) }));
}

function contactValue(contacts: Array<{ type: string; value: string }>, match: (type: string) => boolean): string {
  const row = contacts.find((c) => match((c.type || "").toLowerCase()) && v(c.value));
  return row ? v(row.value) : "";
}

/** Phone / mobile contact value (first matching contact). */
export function phoneOf(contacts: Array<{ type: string; value: string }>): string {
  return contactValue(contacts, (t) => t.includes("phone") || t.includes("mobile"));
}
export function emailOf(contacts: Array<{ type: string; value: string }>): string {
  return contactValue(contacts, (t) => t.includes("email"));
}
export function whatsappOf(contacts: Array<{ type: string; value: string }>): string {
  return contactValue(contacts, (t) => t.includes("whatsapp"));
}

/** Every section of the report, in print order. Used by the print and the live summary. */
export function buildCityBranchReportSections(
  input: CityBranchReportInput,
  tt: CityBranchTranslate
): { sections: MProfileSection[]; relatedTables: MProfileTable[] } {
  const serial = input.savedId ? input.savedId.slice(0, 4).toUpperCase() : "";
  const sections: MProfileSection[] = [
    {
      title: tt("branch.sec_branch_info", "Branch Information"),
      rows: [
        { label: tt("branch.branch_name", "Branch Name"), value: input.name },
        { label: tt("branch.branch_code", "Branch Code"), value: input.code },
        { label: tt("branch.branch_type", "Branch Type"), value: tt("cbs.pr_city_branch", "City Branch") },
        { label: tt("cbs.pr_section", "Operational Section"), value: domainLabel(input.operationalDomain, tt) },
        { label: tt("branch.serial", "Serial No."), value: serial },
        { label: tt("acct.currency", "Currency"), value: input.currency },
        { label: tt("acct.status", "Status"), value: input.status }
      ]
    },
    {
      title: tt("branch.sec_location", "Location & Address"),
      rows: [
        { label: tt("acct.country", "Country"), value: input.country },
        { label: tt("cbs.country_code", "Country Code"), value: input.countryIso2 },
        { label: tt("cbs.state_province_word", "State / Province"), value: input.state },
        { label: tt("cbs.district_word", "District"), value: input.district },
        { label: tt("acct.city", "City"), value: input.city },
        { label: tt("cbs.pr_area", "Area"), value: input.area },
        { label: tt("cbs.pr_zip", "ZIP / Postal Code"), value: input.zip },
        { label: tt("acct.address", "Address"), value: input.fullAddress }
      ]
    },
    {
      title: tt("branch.sec_hierarchy", "Branch Hierarchy"),
      rows: [
        { label: tt("cbs.pr_main_branch", "Parent (Main) Branch"), value: input.mainBranchName },
        { label: tt("cbs.pr_main_code", "Main Branch Code"), value: input.mainBranchCode },
        { label: tt("cbs.pr_main_currency", "Main Branch Currency"), value: input.mainBranchCurrency }
      ]
    },
    {
      title: tt("cbs.pr_sec_company", "Company Details"),
      rows: companyRows(input.company, tt)
    },
    {
      title: tt("cbs.pr_sec_owner", "Owner Details"),
      rows: ownerRows(input.owner, tt)
    },
    {
      title: tt("branch.sec_contact", "Contact Information"),
      rows: contactRows(input.contacts)
    },
    {
      title: tt("cbs.pr_sec_permissions", "Roles & Permissions"),
      rows: [
        { label: tt("cbs.pr_template", "Permission Template"), value: input.permissionTemplate },
        { label: tt("cbs.pr_grants_count", "Granted Permissions"), value: input.permissionGrants.length ? String(input.permissionGrants.length) : "" },
        { label: tt("cbs.pr_users_count", "Assigned Users"), value: input.users.length ? String(input.users.length) : tt("cbs.pr_none", "None assigned") }
      ],
      fullWidth: true
    },
    {
      title: tt("acct.sec_audit_info", "System / Audit Information"),
      rows: [
        { label: tt("acct.created_by", "Created By"), value: input.createdByName },
        { label: tt("acct.created_on", "Created On"), value: formatDate(input.createdAt) },
        { label: tt("acct.updated_on", "Last Updated On"), value: formatDateTime(input.updatedAt) }
      ]
    }
  ];

  const relatedTables: MProfileTable[] = [];
  if (input.users.length) {
    relatedTables.push({
      title: tt("cbs.pr_sec_users", "Assigned Users"),
      columns: [
        tt("cbs.pr_user_name", "User Name"),
        tt("cbs.pr_user_code", "User Code"),
        tt("cbs.pr_user_role", "Role"),
        tt("cbs.pr_user_domain", "Operational Section"),
        tt("cbs.pr_user_profile", "Access Profile"),
        tt("cbs.pr_user_status", "Status")
      ],
      rows: input.users.map((u) => [
        u.userName,
        u.userCode,
        roleLabel(u.role, tt),
        domainLabel(u.operationalDomain === "both" ? "" : u.operationalDomain, tt) || tt("cbs.domain_both", "Both"),
        accessProfileLabel(u.accessProfile, tt),
        u.isActive ? tt("cbs.pr_active", "Active") : tt("cbs.pr_inactive", "Inactive")
      ])
    });
  }
  if (input.documents.length) {
    relatedTables.push({
      title: tt("cbs.pr_sec_documents", "Linked Documents"),
      columns: [
        tt("cbs.pr_doc_name", "Document"),
        tt("cbs.pr_doc_type", "Type"),
        tt("cbs.pr_doc_size", "Size"),
        tt("cbs.pr_doc_uploaded", "Uploaded On")
      ],
      rows: input.documents.map((d) => [
        d.name,
        documentTypeLabel(d.mimeType, d.name),
        formatFileSize(d.sizeBytes),
        formatDate(d.createdAt)
      ])
    });
  }
  return { sections, relatedTables };
}

/** Full A4 print configuration. Feeds openMasterProfileReportWindow and buildMasterProfileReportHtml. */
export function buildCityBranchReportConfig(
  input: CityBranchReportInput,
  options: { lang: string; autoPrint: boolean; tt: CityBranchTranslate }
): MasterProfileConfig {
  const { tt } = options;
  const { sections, relatedTables } = buildCityBranchReportSections(input, tt);
  return {
    lang: options.lang,
    autoPrint: options.autoPrint,
    title: tt("branch.report_title", "City Branch Profile Report"),
    subtitle: tt("branch.report_subtitle", "Branch Profile Summary"),
    overviewLabel: tt("branch.overview", "Branch Profile Overview"),
    name: input.name,
    status: input.status,
    createdBy: input.createdByName,
    reportIdPrefix: "BRANCH",
    reportIdValue: input.code,
    footerAccountName: input.company?.legalName || input.company?.name || undefined,
    meta: [
      { label: tt("branch.branch_code", "Branch Code"), value: input.code },
      { label: tt("branch.branch_type", "Branch Type"), value: tt("cbs.pr_city_branch", "City Branch") },
      { label: tt("acct.country", "Country"), value: input.country },
      { label: tt("acct.currency", "Currency"), value: input.currency }
    ],
    sections,
    relatedTables
  };
}

/** Data for the saved-branch drawer panel (BranchLiveReportPanel). Only real values; no sample text. */
export function buildCityBranchDrawerData(input: CityBranchReportInput, tt: CityBranchTranslate): BranchReportData {
  const phone = phoneOf(input.contacts);
  const email = emailOf(input.contacts) || input.owner?.email || "";
  const whatsapp = whatsappOf(input.contacts);
  return {
    serialNumber: input.savedId ? input.savedId.slice(0, 4).toUpperCase() : undefined,
    branchStatus: input.status || undefined,
    branchCode: input.code || undefined,
    branchType: tt("cbs.pr_city_branch", "City Branch"),
    country: input.country || undefined,
    currency: input.currency || undefined,
    parentBranch: input.mainBranchName
      ? { name: input.mainBranchName, code: input.mainBranchCode, type: "MAIN", status: "", currency: input.mainBranchCurrency || undefined }
      : undefined,
    branchName: input.name || undefined,
    createdDate: input.createdAt ? formatDate(input.createdAt) : undefined,
    updatedDate: input.updatedAt ? formatDate(input.updatedAt) : undefined,
    createdBy: input.createdByName || undefined,
    city: input.city || undefined,
    cityCode: undefined,
    stateProvince: input.state || undefined,
    areaRegion: input.area || undefined,
    zipCode: input.zip || undefined,
    fullAddress: input.fullAddress || undefined,
    ownerName: input.owner?.name || undefined,
    ownerCode: input.owner?.code || undefined,
    ownerPhone: input.owner?.mobile || phone || undefined,
    ownerWhatsApp: input.owner?.whatsapp || whatsapp || undefined,
    ownerEmail: input.owner?.email || email || undefined,
    companyName: input.company?.name || undefined,
    companyCode: input.company?.companyCode || undefined,
    companyRegNo: input.company?.registrationNumber || undefined,
    companyTaxRegNo: input.company?.taxNumber || undefined,
    companyStatus: input.company?.companyStatus || undefined,
    companyPhone: phone || undefined,
    companyEmail: email || undefined,
    companyOfficeAddress: input.fullAddress || undefined,
    allowedPermissions: input.permissionGrants,
    remarks: undefined
  };
}
