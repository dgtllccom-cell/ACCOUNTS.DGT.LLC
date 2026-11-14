import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { ERP_ACTION_KEYS, type ErpActionKey } from "@/lib/permissions/rbac-matrix-builder";
import {
  EXPENSE_BILL_SECTION_KEY,
  authorityTierLabel,
  rightsActionLabel,
  rightsCategoryName,
  rightsFormName,
  rightsModuleName,
  rightsSectionName,
  type RightsFormRow,
  type UserRightsList,
} from "@/lib/permissions/user-rights-list";
import { DEVICE_KINDS, type DeviceKind } from "@/lib/mobile/device-access";

/**
 * The complete A4 "user rights" document: identity, authority and scope, device access, login, EVERY granted form with its actions,
 * the expense bill types, every other granted token, and the restricted modules. Nothing is truncated. All labels come from the central
 * five-language dictionary (udr.* keys); technical identifiers (user code, e-mail, permission tokens) are printed as they are.
 */

export type RegisteredDeviceLine = {
  app?: string | null;
  platform?: string | null;
  model?: string | null;
  status: string;
  requestedAt?: string | null;
};

export type UserRightsReportInput = {
  lang: SupportedLanguage | string;
  identity: {
    userCode: string;
    fullName: string;
    username?: string | null;
    employeeCode?: string | null;
    designation?: string | null;
    department?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    kycStatus?: string | null;
    idNumber?: string | null;
    idExpiry?: string | null;
    status?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  scope: {
    domain?: "business" | "shipping" | "both" | string | null;
    accessProfile?: "operations" | "shipping_line" | string | null;
    countryName?: string | null;
    mainBranchName?: string | null;
    mainBranchCode?: string | null;
    cityBranchName?: string | null;
    cityBranchCode?: string | null;
    localCurrency?: string | null;
    shippingLineName?: string | null;
    clearingAgentName?: string | null;
    warehouseNames?: string[];
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    mobileProfile?: string | null;
    financialAccess?: "role_default" | "deny" | "allow" | string | null;
  };
  /** null = not restricted (every device kind) */
  deviceAccess: readonly DeviceKind[] | null;
  registeredDevices?: RegisteredDeviceLine[];
  roleLabel: string;
  rights: UserRightsList;
  loginUrl?: string | null;
  generatedAt?: Date;
};

const DEVICE_STATUS_KEYS: Record<string, string> = {
  pending: "udr.dst.pending",
  approved: "udr.dst.approved",
  active: "udr.dst.active",
  rejected: "udr.dst.rejected",
  revoked: "udr.dst.revoked",
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${String(date.getDate()).padStart(2, "0")}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

const RTL_LANGUAGES = ["ur", "ar", "fa", "ps"];

export function buildUserRightsReportHtml(input: UserRightsReportInput): string {
  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = RTL_LANGUAGES.includes(lang);
  const dir = isRtl ? "rtl" : "ltr";
  const L = (key: string, fallback: string) => t(lang, `udr.r.${key}`, fallback);
  const na = L("not_provided", "Not provided");
  const rights = input.rights;
  const generated = input.generatedAt ?? new Date();
  const stamp = `${formatDate(generated.toISOString())} ${String(generated.getHours()).padStart(2, "0")}:${String(generated.getMinutes()).padStart(2, "0")}`;

  const cell = (value: string | number | null | undefined) => {
    const v = value === null || value === undefined || value === "" ? na : String(value);
    return escapeHtml(v);
  };
  const kv = (label: string, value: string) => `<div class="kv"><span class="k">${escapeHtml(label)}</span><span class="v">${value}</span></div>`;

  const domainLabel = input.scope.domain === "shipping"
    ? L("dom_shipping", "Shipping line & clearing")
    : input.scope.domain === "both"
      ? L("dom_both", "Global (both domains)")
      : L("dom_business", "Business");
  const accessLabel = input.scope.accessProfile === "operations"
    ? L("ap_operations", "Operations")
    : input.scope.accessProfile === "shipping_line"
      ? L("ap_shipping_line", "Shipping line")
      : L("ap_standard", "Standard role");
  const mobileLabel = input.scope.mobileProfile === "mobile_cash_ledger"
    ? L("mp_cash", "Brother User (cash & ledger)")
    : input.scope.mobileProfile === "mobile_field"
      ? L("mp_field", "Munshi / field user")
      : L("mp_standard", "Standard ERP");
  const financialLabel = input.scope.financialAccess === "deny"
    ? L("fin_deny", "Denied")
    : input.scope.financialAccess === "allow"
      ? L("fin_allow", "Allowed")
      : L("fin_role_default", "As role");
  const deviceLabels = (input.deviceAccess ?? DEVICE_KINDS).map((kind) => (kind === "mobile" ? L("dev_mobile", "Mobile") : L("dev_computer", "Computer")));
  const deviceChips = input.deviceAccess === null
    ? `<span class="chip chip-on">${escapeHtml(L("dev_any", "Any device (not restricted)"))}</span>`
    : deviceLabels.map((label) => `<span class="chip chip-on">${escapeHtml(label)}</span>`).join("");

  const scopeCountry = input.scope.countryName ? input.scope.countryName : L("all_scope", "Global (all countries and branches)");
  const validFrom = formatDate(input.scope.effectiveFrom);
  const validTo = formatDate(input.scope.effectiveTo);
  const validity = validFrom || validTo ? `${validFrom || "—"} → ${validTo || "—"}` : L("no_limit", "No date limit");

  const identityGrid = [
    kv(L("f_full_name", "Full name"), cell(input.identity.fullName)),
    kv(L("f_user_code", "User ID / code"), `<span class="mono">${cell(input.identity.userCode)}</span>`),
    kv(L("f_username", "Username / login ID"), `<span class="mono">${cell(input.identity.username ?? input.identity.userCode)}</span>`),
    kv(L("f_employee_code", "Employee code"), `<span class="mono">${cell(input.identity.employeeCode)}</span>`),
    kv(L("f_designation", "Designation"), cell(input.identity.designation)),
    kv(L("f_department", "Department"), cell(input.identity.department)),
    kv(L("f_phone", "Phone / WhatsApp"), cell(input.identity.phone)),
    kv(L("f_kyc", "KYC status"), cell(input.identity.kycStatus)),
    kv(L("f_id_number", "National ID / passport"), cell(input.identity.idNumber)),
    kv(L("f_id_expiry", "Document expiry"), cell(formatDate(input.identity.idExpiry))),
    kv(L("f_address", "Residential address"), cell(input.identity.address)),
    kv(L("f_status", "Account status"), cell(input.identity.status)),
  ].join("");

  const scopeGrid = [
    kv(L("f_role", "Role"), cell(input.roleLabel)),
    kv(L("f_authority", "Authority tier"), escapeHtml(authorityTierLabel(lang, rights.authorityTier))),
    kv(L("f_domain", "Operational section"), escapeHtml(domainLabel)),
    kv(L("f_access_profile", "Access profile"), escapeHtml(accessLabel)),
    kv(L("f_country", "Country scope"), escapeHtml(scopeCountry)),
    kv(L("f_main_branch", "Main branch"), cell(input.scope.mainBranchName ? `${input.scope.mainBranchName}${input.scope.mainBranchCode ? ` (${input.scope.mainBranchCode})` : ""}` : null)),
    kv(L("f_city_branch", "City branch"), cell(input.scope.cityBranchName ? `${input.scope.cityBranchName}${input.scope.cityBranchCode ? ` (${input.scope.cityBranchCode})` : ""}` : null)),
    kv(L("f_currency", "Local currency"), cell(input.scope.localCurrency)),
    kv(L("f_shipping_line", "Shipping line"), cell(input.scope.shippingLineName)),
    kv(L("f_clearing_agent", "Clearing agent"), cell(input.scope.clearingAgentName)),
    kv(L("f_warehouses", "Warehouses"), cell(input.scope.warehouseNames && input.scope.warehouseNames.length ? input.scope.warehouseNames.join(", ") : L("all_warehouses", "All warehouses in scope"))),
    kv(L("f_valid", "Valid period"), escapeHtml(validity)),
    kv(L("f_mobile_profile", "Mobile profile"), escapeHtml(mobileLabel)),
    kv(L("f_financial", "Financial amounts"), escapeHtml(financialLabel)),
  ].join("");

  const registered = input.registeredDevices ?? [];
  const deviceTable = registered.length
    ? `<table class="plain">
        <thead><tr>
          <th>${escapeHtml(L("f_device_app", "App"))}</th>
          <th>${escapeHtml(L("f_device_platform", "Platform"))}</th>
          <th>${escapeHtml(L("f_device_model", "Model"))}</th>
          <th>${escapeHtml(L("f_device_status", "Status"))}</th>
          <th>${escapeHtml(L("f_device_requested", "Requested"))}</th>
        </tr></thead>
        <tbody>${registered.map((d) => `<tr>
          <td>${cell(d.app ? String(d.app).toUpperCase() : null)}</td>
          <td>${cell(d.platform)}</td>
          <td>${cell(d.model)}</td>
          <td>${escapeHtml(DEVICE_STATUS_KEYS[d.status] ? t(lang, DEVICE_STATUS_KEYS[d.status], d.status) : d.status)}</td>
          <td>${escapeHtml(formatDate(d.requestedAt))}</td>
        </tr>`).join("")}</tbody>
      </table>`
    : `<p class="muted">${escapeHtml(L("no_device", "No mobile device registered for this login yet."))}</p>`;

  const actionHead = ERP_ACTION_KEYS.map((action: ErpActionKey) => `<th class="act">${escapeHtml(rightsActionLabel(lang, action))}</th>`).join("");
  const actionCells = (granted: readonly ErpActionKey[]) =>
    ERP_ACTION_KEYS.map((action) => (granted.includes(action) ? `<td class="act on">✓</td>` : `<td class="act">–</td>`)).join("");

  const formRow = (form: RightsFormRow) => `<tr>
      <td class="form">${escapeHtml(rightsFormName(lang, form.key, form.name))}</td>
      ${actionCells(form.granted)}
    </tr>`;

  const matrixBody = rights.modules.map((mod) => {
    const sections = mod.sections.filter((sec) => sec.key !== EXPENSE_BILL_SECTION_KEY);
    if (!sections.length) return "";
    const head = `<tr class="mod"><td colspan="${ERP_ACTION_KEYS.length + 1}">${escapeHtml(rightsModuleName(lang, mod.key, mod.name))}
      <span class="cat">${escapeHtml(rightsCategoryName(lang, mod.category))}</span></td></tr>`;
    const body = sections.map((sec) => `<tr class="sec"><td colspan="${ERP_ACTION_KEYS.length + 1}">${escapeHtml(rightsSectionName(lang, sec.key, sec.name))}</td></tr>
      ${sec.forms.map(formRow).join("")}`).join("");
    return head + body;
  }).join("");

  const expenseRows = rights.expenseBillTypes.map((form) => `<tr>
      <td class="form">${escapeHtml(rightsFormName(lang, form.key, form.name))}</td>
      ${actionCells(form.granted)}
    </tr>`).join("");

  const otherRows = rights.otherRights.length
    ? `<table class="plain other">
        <thead><tr><th style="width:30%">${escapeHtml(L("th_resource", "Resource"))}</th><th>${escapeHtml(L("th_granted_actions", "Granted"))}</th></tr></thead>
        <tbody>${rights.otherRights.map((g) => `<tr><td class="mono">${escapeHtml(g.resource)}</td><td class="mono wrap">${escapeHtml(g.actions.join("  ·  "))}</td></tr>`).join("")}</tbody>
      </table>`
    : `<p class="muted">${escapeHtml(L("no_other", "No other rights beyond the form matrix."))}</p>`;

  const restricted = rights.restrictedModules.length
    ? `<div class="restricted">${rights.restrictedModules.map((m) => `<span class="chip chip-off">${escapeHtml(rightsModuleName(lang, m.key, m.name))}</span>`).join("")}</div>`
    : `<p class="muted">${escapeHtml(L("none_restricted", "None. Every module has at least one granted form."))}</p>`;

  const totalForms = rights.counts.forms;
  const summary = [
    [L("c_modules", "Modules"), rights.counts.modules],
    [L("c_forms", "Forms"), totalForms],
    [L("c_actions", "Actions"), rights.counts.actions],
    [L("c_other", "Other rights"), rights.counts.otherTokens],
  ].map(([label, value]) => `<div class="stat"><div class="sv">${value}</div><div class="sl">${escapeHtml(String(label))}</div></div>`).join("");

  const title = L("title", "User rights & access report");
  const subtitle = L("subtitle", "Complete record of every right granted to this user");
  const fullNote = rights.fullAuthority
    ? `<div class="notice">${escapeHtml(L("full_authority", "Full authority: every form and action in the ERP is granted to this user."))}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.identity.fullName)} — ${escapeHtml(input.identity.userCode)} — ${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 11mm 10mm 14mm 10mm;
    @bottom-${isRtl ? "left" : "right"} { content: ${JSON.stringify(L("page", "Page"))} " " counter(page) " / " counter(pages); font-size: 7.5pt; color: #64748b; }
    @bottom-${isRtl ? "right" : "left"} { content: ${JSON.stringify(L("confidential", "Confidential — system restricted"))}; font-size: 7.5pt; color: #b91c1c; }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Segoe UI", Tahoma, "Noto Naskh Arabic", "Noto Nastaliq Urdu", Arial, sans-serif; font-size: 8.5pt; line-height: 1.45; color: #0f172a; }
  .band { background: linear-gradient(135deg, #0f172a, #1e3a5f); color: #fff; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .band .org { font-size: 7pt; letter-spacing: .4px; color: #cbd5e1; text-transform: uppercase; }
  .band .title { font-size: 13pt; font-weight: 800; margin-top: 2px; }
  .band .sub { font-size: 7.5pt; color: #cbd5e1; margin-top: 2px; }
  .band .code { text-align: end; font-family: Consolas, "Courier New", monospace; font-size: 9pt; font-weight: 700; color: #7dd3fc; }
  .band .code small { display: block; font-size: 6.8pt; font-weight: 400; color: #cbd5e1; margin-top: 2px; }
  h2 { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: #1e293b; background: #f1f5f9; border-inline-start: 4px solid #2563eb; padding: 4px 8px; margin: 10px 0 6px; break-after: avoid; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .kv { display: flex; gap: 8px; padding: 2.5px 0; border-bottom: 1px dashed #e2e8f0; break-inside: avoid; }
  .kv .k { flex: 0 0 40%; color: #64748b; font-weight: 600; }
  .kv .v { flex: 1 1 auto; font-weight: 700; word-break: break-word; }
  .mono { font-family: Consolas, "Courier New", monospace; }
  .chip { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 7.5pt; font-weight: 700; margin: 0 3px 3px 0; border: 1px solid; }
  .chip-on { background: #dcfce7; color: #166534; border-color: #86efac; }
  .chip-off { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 6px 0 8px; break-inside: avoid; }
  .stat { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; background: #f8fafc; }
  .stat .sv { font-size: 13pt; font-weight: 800; color: #1d4ed8; }
  .stat .sl { font-size: 7pt; color: #475569; text-transform: uppercase; font-weight: 700; }
  .notice { border: 1px solid #86efac; background: #f0fdf4; color: #166534; font-weight: 700; padding: 5px 8px; border-radius: 4px; margin: 4px 0 6px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 2px 0 6px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: start; vertical-align: middle; word-break: break-word; overflow-wrap: anywhere; }
  th { background: #e2e8f0; font-size: 7pt; text-transform: uppercase; font-weight: 800; color: #1e293b; }
  td.form { font-weight: 600; width: 34%; }
  th.act, td.act { text-align: center; width: 8.25%; font-size: 7.5pt; }
  td.act.on { color: #047857; font-weight: 900; background: #ecfdf5; font-size: 9pt; }
  tr.mod td { background: #1e3a5f; color: #fff; font-weight: 800; font-size: 8pt; break-after: avoid; page-break-after: avoid; }
  tr.mod .cat { font-weight: 400; font-size: 7pt; color: #bfdbfe; margin-inline-start: 6px; }
  tr.sec td { background: #eff6ff; color: #1e3a8a; font-weight: 800; font-size: 7.5pt; break-after: avoid; page-break-after: avoid; }
  table.plain th { background: #f8fafc; }
  table.other td.wrap { white-space: normal; }
  .muted { color: #64748b; font-size: 7.5pt; margin: 3px 0; }
  .temp { margin-top: 8px; }
  .vault { margin-top: 8px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; border-radius: 4px; padding: 4px 8px; font-size: 7.5pt; break-inside: avoid; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 14px; break-inside: avoid; }
  .sign div { border: 1px dashed #94a3b8; border-radius: 4px; padding: 6px; min-height: 52px; font-size: 7pt; color: #475569; font-weight: 700; text-transform: uppercase; }
  .sign .line { border-bottom: 1px solid #64748b; margin-top: 18px; }
  .restricted { margin: 2px 0 4px; }
  section { break-inside: auto; }
  .avoid { break-inside: avoid; }
</style>
</head>
<body>

<div class="band">
  <div>
    <div class="org">${escapeHtml(L("org", "ACCOUNTS.DGT.LLC ENTERPRISE RESOURCE PLANNING"))}</div>
    <div class="title">${escapeHtml(title)}</div>
    <div class="sub">${escapeHtml(subtitle)}</div>
  </div>
  <div class="code">${escapeHtml(input.identity.userCode)}<small>${escapeHtml(L("generated", "Generated"))}: ${escapeHtml(stamp)}</small></div>
</div>

<h2>1. ${escapeHtml(L("sec_identity", "Identity & contact"))}</h2>
<div class="grid">${identityGrid}</div>

<h2>2. ${escapeHtml(L("sec_scope", "Authority, scope & operational section"))}</h2>
<div class="grid">${scopeGrid}</div>

<h2>3. ${escapeHtml(L("sec_devices", "Device access"))}</h2>
<div class="avoid">
  <div style="margin-bottom:4px"><span class="k" style="color:#64748b;font-weight:600">${escapeHtml(L("f_devices_allowed", "Allowed devices"))}:</span> ${deviceChips}</div>
  ${deviceTable}
</div>

<h2>4. ${escapeHtml(L("sec_login", "Login & security"))}</h2>
<div class="grid">
  ${kv(L("f_email", "Login e-mail"), `<span class="mono">${cell(input.identity.email)}</span>`)}
  ${kv(L("f_login_url", "Sign-in page"), `<span class="mono">${cell(input.loginUrl ?? "/auth/login")}</span>`)}
  ${kv(L("f_vault", "Credential vault reference"), `<span class="mono">VAULT-DGT-${escapeHtml(input.identity.userCode)}</span>`)}
  ${kv(L("f_password_storage", "Password storage"), escapeHtml(L("password_hashed", "Hashed in the secure authentication store (never printed)")))}
  ${kv(L("f_created", "Created"), cell(formatDate(input.identity.createdAt)))}
  ${kv(L("f_updated", "Last updated"), cell(formatDate(input.identity.updatedAt)))}
</div>

<h2>5. ${escapeHtml(L("sec_rights", "Granted module rights (every form)"))}</h2>
<div class="stats">${summary}</div>
${fullNote}
${rights.modules.length || rights.expenseBillTypes.length
    ? `<table>
  <colgroup><col style="width:34%">${ERP_ACTION_KEYS.map(() => `<col style="width:8.25%">`).join("")}</colgroup>
  <thead><tr><th>${escapeHtml(L("th_form", "Form / module"))}</th>${actionHead}</tr></thead>
  <tbody>${matrixBody || `<tr><td colspan="${ERP_ACTION_KEYS.length + 1}" class="muted">${escapeHtml(L("no_forms", "No form is granted."))}</td></tr>`}</tbody>
</table>`
    : `<p class="muted">${escapeHtml(L("no_forms", "No form is granted."))}</p>`}

<h2>6. ${escapeHtml(L("sec_expense", "Expense bill types"))}</h2>
<table>
  <colgroup><col style="width:34%">${ERP_ACTION_KEYS.map(() => `<col style="width:8.25%">`).join("")}</colgroup>
  <thead><tr><th>${escapeHtml(L("th_bill", "Expense bill type"))}</th>${actionHead}</tr></thead>
  <tbody>${expenseRows}</tbody>
</table>

<h2>7. ${escapeHtml(L("sec_other", "Other granted rights"))}</h2>
${otherRows}

<h2>8. ${escapeHtml(L("sec_restricted", "Restricted modules (no access)"))}</h2>
${restricted}

<div class="vault">${escapeHtml(L("vault_notice", "Passwords are kept in the secure credential vault and are never printed or stored in clear text."))}</div>

<h2>9. ${escapeHtml(L("sec_signoff", "Sign-off"))}</h2>
<div class="sign">
  <div>${escapeHtml(L("sign_employee", "Employee acknowledgment"))}<div class="line"></div></div>
  <div>${escapeHtml(L("sign_manager", "Branch / country approval"))}<div class="line"></div></div>
  <div>${escapeHtml(L("sign_admin", "System administrator authorization"))}<div class="line"></div></div>
</div>

</body>
</html>`;
}

/** Opens the document in a new window and prints it (the caller decides when; the window is created on the user's click). */
export function openUserRightsReportWindow(input: UserRightsReportInput, options: { autoPrint?: boolean } = {}): boolean {
  const html = buildUserRightsReportHtml(input);
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    window.alert(t(input.lang, "udr.r.popup_blocked", "Please allow pop-ups to open the printable A4 report."));
    return false;
  }
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  if (options.autoPrint) {
    reportWindow.onload = () => {
      setTimeout(() => reportWindow.print(), 400);
    };
  }
  return true;
}
