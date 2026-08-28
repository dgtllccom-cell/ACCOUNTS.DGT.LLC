import { t } from "@/lib/i18n/ui";
import {
  buildMasterProfileReportHtml,
  openMasterProfileReportWindow,
  type MasterProfileConfig,
} from "@/lib/reports/open-master-profile-report-window";
import { buildPermissionPrintSummary } from "@/lib/reports/permission-print-summary";

/**
 * ONE builder for every Branch print/PDF (Country Main Branch, City Branch,
 * Super-Admin Branch). Maps a flat branch-data object to the canonical
 * master-profile A4 engine with the mandated 2-page section order:
 *
 *   Page 1 — Country / Location · Main Branch Details · Branch Code & Type ·
 *            Owner Details · Contact Information
 *   Page 2 — Company Details · Branch Summary · Roles & Permissions Summary ·
 *            Remarks / Notes · Approval / Authorized By
 *
 * Callers just pass their record; they never build print HTML.
 */

export type BranchProfileData = {
  branchName?: string | null;
  branchCode?: string | null;
  branchType?: string | null;      // "MAIN" | "CITY" | free text
  branchStatus?: string | null;
  serialNumber?: string | null;
  currency?: string | null;

  country?: string | null;
  countryCode?: string | null;
  stateProvince?: string | null;
  district?: string | null;
  city?: string | null;
  areaRegion?: string | null;
  zipCode?: string | null;
  fullAddress?: string | null;

  parentBranch?: { name?: string | null; code?: string | null } | null;
  establishedOn?: string | null;
  taxRegNo?: string | null;
  ntnGstNo?: string | null;

  ownerName?: string | null;
  ownerCode?: string | null;
  designation?: string | null;
  nationality?: string | null;
  ownershipType?: string | null;
  ownershipPercent?: string | null;
  ownerPhone?: string | null;
  ownerWhatsApp?: string | null;
  ownerEmail?: string | null;
  ownerLandline?: string | null;
  ownerWebsite?: string | null;

  companyName?: string | null;
  companyCode?: string | null;
  companyType?: string | null;
  companyRegNo?: string | null;
  companyIncDate?: string | null;
  companyStatus?: string | null;
  companyOfficeAddress?: string | null;

  createdBy?: string | null;
  createdDate?: string | null;
  updatedBy?: string | null;
  updatedDate?: string | null;

  allowedPermissions?: string[] | null;
  permissionTemplate?: string | null;
  remarks?: string | null;
};

export function openBranchProfileReport(opts: {
  kind: "country" | "city" | "super";
  lang?: string;
  autoPrint?: boolean;
  data: BranchProfileData;
}) {
  openMasterProfileReportWindow(branchProfileConfig(opts));
}

/** Pure config builder — no DOM. Used by the opener and by snapshot tooling. */
export function buildBranchProfileReportHtml(opts: {
  kind: "country" | "city" | "super";
  lang?: string;
  data: BranchProfileData;
}): string {
  return buildMasterProfileReportHtml(branchProfileConfig(opts));
}

function branchProfileConfig(opts: {
  kind: "country" | "city" | "super";
  lang?: string;
  autoPrint?: boolean;
  data: BranchProfileData;
}): MasterProfileConfig {
  const lang = (opts.lang || "en") as never;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const d = opts.data;

  const isCity = opts.kind === "city";
  const title =
    opts.kind === "city"
      ? tt("branch.report_title_city", "City Branch Report")
      : opts.kind === "super"
        ? tt("branch.report_title_super", "Super Admin Branch Report")
        : tt("branch.report_title_country", "Country Branch Report");

  const perm = buildPermissionPrintSummary(d.allowedPermissions, d.permissionTemplate);

  return {
    lang: opts.lang,
    autoPrint: opts.autoPrint,
    title,
    subtitle: isCity
      ? tt("branch.report_subtitle_city", "City Branch Profile")
      : tt("branch.report_subtitle", "Country Main Branch Profile"),
    overviewLabel: tt("branch.overview", "Branch Profile Overview"),
    name: d.branchName || undefined,
    status: d.branchStatus || undefined,
    createdBy: d.createdBy || undefined,
    reportIdPrefix: isCity ? "CITYBR" : "CBRANCH",
    reportIdValue: d.branchCode || undefined,
    footerAccountName: d.companyName && d.companyName !== "-" ? d.companyName : undefined,
    meta: [
      { label: tt("branch.branch_code", "Branch Code"), value: d.branchCode },
      { label: tt("branch.branch_type", "Branch Type"), value: d.branchType },
      { label: tt("acct.country", "Country"), value: d.country },
      { label: tt("acct.currency", "Currency"), value: d.currency },
    ],
    sections: [
      // -------- PAGE 1 --------
      { title: tt("cnbs.rpt_location", "Country / Location Information"), fullWidth: true, rows: [
        { label: tt("cnbs.country", "Country"), value: d.country },
        { label: tt("cnbs.country_code", "Country Code"), value: d.countryCode },
        { label: tt("cnbs.state", "State / Province"), value: d.stateProvince },
        { label: tt("cnbs.district", "District"), value: d.district },
        { label: tt("acct.city", "City"), value: d.city },
        { label: tt("cnbs.area", "Area / Region"), value: d.areaRegion },
        { label: tt("cnbs.zip", "ZIP / Postal Code"), value: d.zipCode },
        { label: tt("cnbs.address", "Address"), value: d.fullAddress },
      ]},
      { title: tt("cnbs.rpt_main_branch", "Main Branch Details"), rows: [
        { label: tt("branch.branch_name", "Branch Name"), value: d.branchName },
        { label: tt("branch.serial", "Serial No."), value: d.serialNumber },
        { label: tt("acct.currency", "Currency"), value: d.currency },
        { label: tt("acct.status", "Status"), value: d.branchStatus },
        { label: tt("cnbs.parent_branch", "Parent (HQ)"), value: d.parentBranch ? `${d.parentBranch.name || "-"} (${d.parentBranch.code || "-"})` : undefined },
      ]},
      { title: tt("cnbs.rpt_code_type", "Branch Code and Type"), rows: [
        { label: tt("branch.branch_code", "Branch Code"), value: d.branchCode },
        { label: tt("branch.branch_type", "Branch Type"), value: d.branchType },
        { label: tt("cnbs.established_on", "Established On"), value: d.establishedOn },
        { label: tt("cnbs.tax_reg_no", "Tax Reg. No."), value: d.taxRegNo },
        { label: tt("cnbs.ntn_gst_no", "NTN / GST No."), value: d.ntnGstNo },
      ]},
      { title: tt("cnbs.rpt_owner", "Owner Details"), rows: [
        { label: tt("cnbs.owner_name", "Owner Name"), value: d.ownerName },
        { label: tt("cnbs.owner_code", "Owner Code"), value: d.ownerCode },
        { label: tt("cnbs.designation", "Designation"), value: d.designation },
        { label: tt("cnbs.nationality", "Nationality"), value: d.nationality },
        { label: tt("cnbs.ownership_type", "Ownership Type"), value: d.ownershipType },
        { label: tt("cnbs.ownership_percent", "Ownership %"), value: d.ownershipPercent },
      ]},
      { title: tt("cnbs.rpt_contact", "Contact Information"), rows: [
        { label: tt("acct.phone", "Phone"), value: d.ownerPhone },
        { label: tt("cnbs.whatsapp", "WhatsApp"), value: d.ownerWhatsApp },
        { label: tt("acct.email", "Email"), value: d.ownerEmail },
        { label: tt("cnbs.landline", "Landline"), value: d.ownerLandline },
        { label: tt("cnbs.website", "Website"), value: d.ownerWebsite },
      ]},
      // -------- PAGE 2 (natural block-level break; a whole section moves down,
      //          never splits — see open-master-profile-report-window print CSS) --------
      { title: tt("cnbs.rpt_company", "Company Details"), rows: [
        { label: tt("acct.company_name", "Company Name"), value: d.companyName },
        { label: tt("cnbs.company_code", "Company Code"), value: d.companyCode },
        { label: tt("cnbs.company_type", "Company Type"), value: d.companyType },
        { label: tt("cnbs.company_reg_no", "Company Reg. No."), value: d.companyRegNo },
        { label: tt("cnbs.company_inc_date", "Incorporation Date"), value: d.companyIncDate },
        { label: tt("acct.status", "Status"), value: d.companyStatus },
        { label: tt("cnbs.company_office_address", "Registered Office"), value: d.companyOfficeAddress },
      ]},
      { title: tt("cnbs.rpt_summary", "Branch Summary"), rows: [
        { label: tt("cnbs.branch", "Branch"), value: d.branchType },
        { label: tt("cnbs.country", "Country"), value: d.country },
        { label: tt("acct.currency", "Currency"), value: d.currency },
        { label: tt("acct.created_on", "Created On"), value: d.createdDate },
        { label: tt("acct.updated_on", "Last Updated On"), value: d.updatedDate },
        { label: tt("cnbs.permission_count", "Permissions Granted"), value: `${perm.grantedCount} / ${perm.totalCount}` },
      ]},
    ],
    permissions: {
      title: tt("cnbs.rpt_permissions", "Roles & Permissions Summary"),
      summary: perm,
      templateLabel: tt("cnbs.role_template", "Role Template"),
      grantedLabel: tt("cnbs.granted", "granted"),
    },
    remarksTitle: tt("acct.remarks", "Remarks / Notes"),
    remarksBody: d.remarks || tt("acct.remarks_body", "This is the official master profile document generated by the ERP."),
    approval: {
      statusLabel: tt("acct.approval", "Verified / Authorized By"),
      statusValue: tt("acct.verified", "Verified"),
      approvedByValue: d.createdBy || "Super Admin",
      authorityValue: tt("cnbs.super_admin", "Super Admin"),
      companyValue: d.companyName || undefined,
    },
  };
}
