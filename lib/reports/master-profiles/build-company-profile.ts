/**
 * Company Master Profile — professional A4 profile for a company / operating
 * entity: identity, registration/license/tax, owners & directors, addresses,
 * countries/branches, business activities, bank relationships, related accounts
 * and contracts.
 *
 * Input: the company record (companiesService.getById shape) plus optional
 * linked collections from `/api/erp/companies/[id]/profile`.
 */

import type { MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import {
  makeT, pushRow, section, relatedTable, compact, money, fmtDate, fmtDateTime,
  metaCells, brandingConfig, type Lang,
} from "./shared";

type KV = { type?: string | null; label?: string | null; value?: string | null; number?: string | null; name?: string | null };

export type CompanyProfileRecord = {
  id: string;
  name: string;
  code?: string | null;
  legal_name?: string | null;
  base_currency?: string | null;
  business_type?: string | null;
  owner_name?: string | null;
  manager_name?: string | null;
  incorporation_date?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  country_name?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  state_name?: string | null;
  district_name?: string | null;
  city_name?: string | null;
  area_name?: string | null;
  zip_code?: string | null;
  address?: string | null;
  main_branch_name?: string | null;
  city_branch_name?: string | null;
  contacts?: KV[] | null;
  registrations?: KV[] | null;
  owners?: Array<{ name?: string; role?: string; nationalId?: string; share?: string }> | null;
  banks?: Array<{ bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string; swift?: string; currency?: string }> | null;
  relatedAccounts?: Array<{ name?: string; code?: string; currency?: string; balance?: number; status?: string }> | null;
  relatedContracts?: Array<{ reference?: string; counterparty?: string; date?: string; amount?: number; currency?: string; status?: string }> | null;
  activities?: string[] | null;
};

function ownersFromRecord(r: CompanyProfileRecord): Array<{ name?: string; role?: string; nationalId?: string; share?: string }> {
  if (r.owners && r.owners.length) return r.owners;
  const out: Array<{ name?: string; role?: string }> = [];
  if (r.owner_name) out.push({ name: r.owner_name, role: "Owner" });
  if (r.manager_name) out.push({ name: r.manager_name, role: "Manager / Director" });
  return out;
}

export function buildCompanyProfileConfig(
  r: CompanyProfileRecord,
  branding: DocumentBranding,
  lang: Lang,
): MasterProfileConfig {
  const tt = makeT(lang);
  const currency = r.base_currency || branding.baseCurrency || "";
  const regs = (r.registrations || []).filter((x) => x && (x.number || x.value));
  const contacts = (r.contacts || []).filter((x) => x && x.value);
  const owners = ownersFromRecord(r);

  const addressLine = compact([r.address, r.area_name, r.city_name, r.district_name, r.state_name, r.zip_code, r.country_name])
    .join(", ");

  const sections = compact([
    section(tt("pdoc.sec_identity", "Identity"), (rows) => {
      pushRow(rows, tt("pdoc.company_name", "Company Name"), r.name);
      pushRow(rows, tt("pdoc.legal_name", "Legal Name"), r.legal_name);
      pushRow(rows, tt("pdoc.company_code", "Company Code"), r.code);
      pushRow(rows, tt("pdoc.nature_of_business", "Nature of Business"), r.business_type);
      pushRow(rows, tt("pdoc.incorporation_date", "Incorporation Date"), fmtDate(r.incorporation_date));
      pushRow(rows, tt("pdoc.base_currency", "Base Currency"), currency);
      pushRow(rows, tt("pdoc.status", "Status"), r.is_active === false ? tt("pdoc.inactive", "Inactive") : tt("pdoc.active", "Active"));
    }),
    section(tt("pdoc.sec_registration", "Registration / License / Tax"), (rows) => {
      for (const reg of regs) {
        const label = (reg.type || reg.label || tt("pdoc.registration", "Registration")) as string;
        pushRow(rows, label, reg.number || reg.value);
      }
    }),
    section(tt("pdoc.sec_location", "Location & Branch"), (rows) => {
      pushRow(rows, tt("pdoc.address", "Address"), addressLine || r.address);
      pushRow(rows, tt("pdoc.country", "Country"), r.country_name || branding.countryName);
      pushRow(rows, tt("pdoc.main_branch", "Main Branch"), r.main_branch_name || branding.branchName);
      pushRow(rows, tt("pdoc.city_branch", "City Branch"), r.city_branch_name);
    }),
    section(tt("pdoc.sec_contact", "Contact Information"), (rows) => {
      for (const c of contacts) {
        const label = (c.type || c.label || tt("pdoc.contact", "Contact")) as string;
        pushRow(rows, label, c.value);
      }
    }),
    r.activities && r.activities.length
      ? section(tt("pdoc.sec_activities", "Business Activities"), (rows) => {
          pushRow(rows, tt("pdoc.activities", "Activities"), r.activities!.join("  •  "));
        }, { fullWidth: true })
      : null,
    section(tt("pdoc.sec_audit", "System / Audit"), (rows) => {
      pushRow(rows, tt("pdoc.created_on", "Created On"), fmtDateTime(r.created_at));
      pushRow(rows, tt("pdoc.reference_no", "Reference No."), r.code || (r.id ? r.id.slice(0, 8).toUpperCase() : ""));
    }),
  ]);

  const relatedTables = compact([
    relatedTable(
      tt("pdoc.rt_owners", "Owners / Directors"),
      [tt("pdoc.name", "Name"), tt("pdoc.role", "Role"), tt("pdoc.national_id", "National ID"), tt("pdoc.share", "Share")],
      owners.map((o) => [o.name, o.role, o.nationalId, o.share]),
    ),
    relatedTable(
      tt("pdoc.rt_banks", "Bank Relationships"),
      [tt("pdoc.bank", "Bank"), tt("pdoc.account_title", "Account Title"), tt("pdoc.account_number", "Account No."), tt("pdoc.iban", "IBAN"), tt("pdoc.swift", "SWIFT"), tt("pdoc.currency", "Currency")],
      (r.banks || []).map((b) => [b.bankName, b.accountTitle, b.accountNumber, b.iban, b.swift, b.currency]),
    ),
    relatedTable(
      tt("pdoc.rt_accounts", "Related Accounts"),
      [tt("pdoc.name", "Name"), tt("pdoc.code", "Code"), tt("pdoc.currency", "Currency"), tt("pdoc.balance", "Balance"), tt("pdoc.status", "Status")],
      (r.relatedAccounts || []).map((a) => [a.name, a.code, a.currency, a.balance != null ? money(a.balance, a.currency) : "", a.status]),
    ),
    relatedTable(
      tt("pdoc.rt_contracts", "Related Contracts"),
      [tt("pdoc.reference", "Reference"), tt("pdoc.counterparty", "Counterparty"), tt("pdoc.date", "Date"), tt("pdoc.amount", "Amount"), tt("pdoc.status", "Status")],
      (r.relatedContracts || []).map((c) => [c.reference, c.counterparty, fmtDate(c.date), c.amount != null ? money(c.amount, c.currency) : "", c.status]),
    ),
  ]);

  return {
    lang,
    title: tt("pdoc.company_report_title", "Company Master Profile"),
    subtitle: tt("pdoc.company_report_subtitle", "Company Registry & Relationship Summary"),
    overviewLabel: tt("pdoc.company_overview", "Company Profile Overview"),
    reportTypeLabel: tt("pdoc.company_report_title", "Company Master Profile"),
    name: r.name,
    status: r.is_active === false ? tt("pdoc.inactive", "Inactive") : tt("pdoc.active", "Active"),
    reportIdPrefix: "COMP",
    reportIdValue: r.code || (r.id ? r.id.slice(0, 8).toUpperCase() : ""),
    meta: metaCells([
      [tt("pdoc.legal_name", "Legal Name"), r.legal_name || r.name],
      [tt("pdoc.nature_of_business", "Nature of Business"), r.business_type],
      [tt("pdoc.country", "Country"), r.country_name || branding.countryName],
      [tt("pdoc.base_currency", "Base Currency"), currency],
    ]),
    sections,
    relatedTables,
    createdBy: r.owner_name || undefined,
    // The company IS its own brand when a logo is on file for it; otherwise fall
    // back to the resolved country/branch branding.
    ...brandingConfig(branding),
    brandEntityName: branding.entityName || r.legal_name || r.name,
  };
}
