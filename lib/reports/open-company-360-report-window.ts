import { printStore } from "@/lib/store/print-store";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { localizeTerm } from "@/lib/i18n/transliteration";

/**
 * Company 360 print / PDF — built ONLY from real Company Master data. A missing value prints
 * "—"; nothing is invented (no default licence number, serial, address, bank or authority).
 * Labels follow the viewer's ERP language (5 languages, RTL for UR/AR/FA/PS).
 */
export type Company360ReportData = {
  company: {
    id?: string;
    accountNo?: string;
    name: string;
    legalName?: string | null;
    nameUrdu?: string | null;
    tradeName?: string | null;
    companyType?: string | null;
    companyTypeLabel?: string | null;
    status?: string | null;
    statusLabel?: string | null;
    businessType?: string | null;
    legalStructureLabel?: string | null;
    natureOfBusiness?: string | null;
    registrationType?: string | null;
    licenseNumber?: string | null;
    taxNumber?: string | null;
    incorporationDate?: string | null;
    licenseExpiryDate?: string | null;
    baseCurrency?: string;
    countryName?: string | null;
    stateName?: string | null;
    cityName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    branchRules?: string | null;
    isBranchOperative?: boolean;
    mainBranchName?: string | null;
    cityBranchName?: string | null;
    superAdminSerial?: string | null;
    countrySerial?: string | null;
    branchSerial?: string | null;
    entrySerial?: string | null;
    companyCode?: string | null;
  };
  owner?: {
    id?: string;
    name: string;
    fatherName?: string | null;
    customerCode?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    email?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  manager?: {
    id?: string;
    name: string;
    fatherName?: string | null;
    customerCode?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    email?: string | null;
    country?: string | null;
    city?: string | null;
  } | null;
  sisterCompanies?: Array<{
    id?: string;
    name: string;
    businessType?: string | null;
    countryName?: string | null;
    cityName?: string | null;
    status?: string | null;
    licenseNumber?: string | null;
  }>;
  banks?: Array<{
    bankName: string;
    accountTitle?: string | null;
    accountNumber?: string | null;
    currency?: string | null;
    branchCode?: string | null;
  }>;
  /** Internal company: branches operating under this legal entity. */
  linkedBranches?: Array<{ name: string; code?: string | null; levelLabel?: string | null }>;
  /** Counts of linked authoritative records (read-only references). */
  linkedCounts?: Array<{ label: string; count: number }>;
  /** Compliance findings already translated by the caller. */
  compliance?: string[];
  lang?: string;
};

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const v = (x: string | number | null | undefined) => (x === null || x === undefined || String(x).trim() === "" ? "—" : esc(x));

export function openCompany360Report(data: Company360ReportData) {
  if (typeof window === "undefined") return;
  const lang = (data.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const c = data.company;
  const name = localizeTerm(c.legalName || c.name || "", lang) || c.name;
  const printedAt = new Date().toLocaleString(lang === "en" ? "en-GB" : `${lang}-u-nu-latn`, { dateStyle: "medium", timeStyle: "short" });

  const row = (label: string, value: string) => `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
  const table = (headers: string[], rows: string[][], empty: string) =>
    `<table class="grid"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
      rows.length ? rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">${esc(empty)}</td></tr>`
    }</tbody></table>`;

  const none = tt("c360.none", "None recorded");
  const sections: string[] = [];

  sections.push(`<section><h2>${esc(tt("c360.sec_legal", "Legal Identity & Registration"))}</h2><table class="kv">
    ${row(tt("c360.legal_name", "Legal Name"), v(c.legalName || c.name))}
    ${row(tt("c360.trade_name", "Trade / Business Name"), v(c.tradeName))}
    ${row(tt("c360.company_type", "Company Type"), v(c.companyTypeLabel))}
    ${row(tt("c360.legal_structure", "Legal Structure"), v(c.legalStructureLabel || c.businessType))}
    ${row(tt("c360.nature", "Nature of Business"), v(c.natureOfBusiness))}
    ${row(tt("c360.registration_type", "Registration Type"), v(c.registrationType))}
    ${row(tt("c360.registration_number", "Registration / License No."), v(c.licenseNumber))}
    ${row(tt("c360.tax_number", "TRN / Tax Number"), v(c.taxNumber))}
    ${row(tt("c360.incorporation_date", "Registration Date"), v(c.incorporationDate))}
    ${row(tt("c360.license_expiry", "License Expiry"), v(c.licenseExpiryDate))}
    ${row(tt("c360.status", "Status"), v(c.statusLabel))}
    ${row(tt("c360.base_currency", "Base Currency"), v(c.baseCurrency))}
    ${row(tt("c360.company_code", "Company Code"), v(c.companyCode || c.entrySerial))}
  </table></section>`);

  if (data.owner) {
    const o = data.owner;
    sections.push(`<section><h2>${esc(tt("c360.sec_owner", "Customer / Owner"))}</h2><table class="kv">
      ${row(tt("c360.owner_name", "Owner"), v(localizeTerm(o.name, lang) || o.name))}
      ${row(tt("c360.owner_code", "Customer Code"), v(o.customerCode))}
      ${row(tt("c360.phone", "Phone"), v(o.phone))}
      ${row(tt("c360.email", "Email"), v(o.email))}
    </table></section>`);
  }

  sections.push(`<section><h2>${esc(tt("c360.sec_address", "Country & Registered Address"))}</h2><table class="kv">
    ${row(tt("c360.country", "Country"), v(c.countryName))}
    ${row(tt("c360.state", "State / Province"), v(c.stateName))}
    ${row(tt("c360.city", "City"), v(c.cityName))}
    ${row(tt("c360.address", "Address"), v(c.address))}
  </table></section>`);

  if (data.linkedBranches) {
    sections.push(`<section><h2>${esc(tt("c360.sec_branches", "Branches Operating Under This Company"))}</h2>${table(
      [tt("c360.branch", "Branch"), tt("c360.level", "Level"), tt("c360.code", "Code")],
      data.linkedBranches.map((b) => [esc(localizeTerm(b.name, lang) || b.name), v(b.levelLabel), v(b.code)]),
      none
    )}</section>`);
  }

  sections.push(`<section><h2>${esc(tt("c360.sec_sisters", "Sister Companies (same owner)"))}</h2>${table(
    [tt("c360.company", "Company"), tt("c360.registration_number", "Registration / License No."), tt("c360.country", "Country"), tt("c360.status", "Status")],
    (data.sisterCompanies ?? []).map((s) => [esc(localizeTerm(s.name, lang) || s.name), v(s.licenseNumber), v(s.countryName), v(s.status)]),
    none
  )}</section>`);

  sections.push(`<section><h2>${esc(tt("c360.sec_banks", "Bank Master Entries (reference only)"))}</h2>${table(
    [tt("c360.bank", "Bank"), tt("c360.account_title", "Account Title"), tt("c360.account_number", "Account No."), tt("c360.currency", "Currency")],
    (data.banks ?? []).map((b) => [v(b.bankName), v(b.accountTitle), v(b.accountNumber), v(b.currency)]),
    none
  )}<p class="note">${esc(tt("c360.bank_note", "Banks are registered in Bank Master and accounts are opened in New Account. This profile does not hold balances or postings."))}</p></section>`);

  if (data.linkedCounts?.length) {
    sections.push(`<section><h2>${esc(tt("c360.sec_linked", "Linked Records"))}</h2>${table(
      [tt("c360.record_type", "Record"), tt("c360.count", "Count")],
      data.linkedCounts.map((x) => [esc(x.label), esc(x.count)]),
      none
    )}</section>`);
  }
  if (data.compliance) {
    sections.push(`<section><h2>${esc(tt("c360.sec_compliance", "Compliance & Reminders"))}</h2>${
      data.compliance.length ? `<ul>${data.compliance.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="empty">${esc(tt("c360.no_findings", "No open compliance findings."))}</p>`
    }</section>`);
  }

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${esc(tt("c360.print_title", "Company 360 Profile"))} — ${esc(name)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 11mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Inter", "Segoe UI", Arial, sans-serif; color: #112b3d; font-size: 11px; }
  html[lang="ur"] body { font-family: "Noto Nastaliq Urdu", "Noto Naskh Arabic", serif; }
  html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: "Noto Naskh Arabic", "Segoe UI", sans-serif; }
  header { border-bottom: 3px solid #0d8c85; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-end; }
  h1 { margin: 0; font-size: 18px; }
  .sub { color: #4b6475; font-size: 10.5px; margin-top: 2px; }
  .meta { text-align: end; font-size: 10px; color: #4b6475; }
  .code { font-family: Consolas, monospace; font-weight: 700; color: #112b3d; }
  section { margin: 0 0 10px; break-inside: avoid; }
  h2 { font-size: 12px; margin: 0 0 4px; padding: 4px 8px; background: #112b3d; color: #fff; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; }
  table.kv th { width: 34%; text-align: start; font-weight: 600; color: #4b6475; padding: 3px 8px; border-bottom: 1px solid #e3eaee; }
  table.kv td { padding: 3px 8px; border-bottom: 1px solid #e3eaee; }
  table.grid th { background: #e8f3f2; text-align: start; padding: 4px 6px; border: 1px solid #cfdfe0; }
  table.grid td { padding: 3px 6px; border: 1px solid #e3eaee; }
  table.grid thead { display: table-header-group; }
  .empty { color: #8599a6; text-align: center; }
  .note { color: #4b6475; font-size: 9.5px; margin: 4px 2px 0; }
  ul { margin: 2px 0; padding-inline-start: 18px; }
  footer { margin-top: 14px; border-top: 1px solid #cfdfe0; padding-top: 5px; font-size: 9px; color: #4b6475; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${esc(name)}</h1>
      <div class="sub">${esc(tt("c360.print_title", "Company 360 Profile"))}${c.companyTypeLabel ? " · " + esc(c.companyTypeLabel) : ""}${c.statusLabel ? " · " + esc(c.statusLabel) : ""}</div>
    </div>
    <div class="meta">
      <div class="code">${v(c.companyCode || c.entrySerial)}</div>
      <div>${esc(tt("c360.printed_at", "Printed"))}: ${esc(printedAt)}</div>
    </div>
  </header>
  ${sections.join("\n")}
  <footer>
    <span>${esc(tt("c360.footer_note", "Company Master record — legal data only. Not an accounting statement."))}</span>
    <span class="code">${v(c.id ? c.id.slice(0, 8) : null)}</span>
  </footer>
</body>
</html>`;
  printStore.openPrint(html, `${tt("c360.print_title", "Company 360 Profile")} - ${name}`);
}
