import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";
import type { PermissionPrintSummary } from "@/lib/reports/permission-print-summary";

/**
 * Canonical, reusable A4 "master profile" print/PDF engine for the whole ERP.
 *
 * Every master-entry module (Account, City Branch, Country Branch, Ledger, Customer, Company,
 * Bank, Employee, User, …) builds a small config of ALREADY-TRANSLATED labels + REAL record values
 * and calls this one function. The professional layout, branding, navy section headers, numbered
 * section cards, compact permission summary, approval area, signature/footer, RTL behaviour,
 * A4 print CSS (running header + "Page X of Y" footer), long-value wrapping and the shared chrome
 * labels all live here — so a new master gets the exact same print standard without copying HTML.
 * Do NOT fork this design per module.
 *
 * Pagination rules (spec):
 *   - @page A4 portrait, 11mm margin, running header + "Page X of Y" footer.
 *   - Nothing (section card, table row, label/value row, permission group, approval box,
 *     signature block) is ever sliced horizontally across a page — break-inside: avoid everywhere.
 *   - A section that can't fit the remaining space moves whole to the next page.
 *   - `pageBreakBefore` on a section forces it to start a new page (used to pin the
 *     "Page 2" block).
 */

export type MProfileRow = { label: string; value: string | null | undefined };
export type MProfileSection = {
  title: string;
  rows: MProfileRow[];
  /** span both columns of the 2-up grid (e.g. Remarks, Permissions). */
  fullWidth?: boolean;
  /** force this section to start on a new printed page. */
  pageBreakBefore?: boolean;
};
export type MProfileKpi = { label: string; value: string; tone?: "open" | "current" | "debit" | "credit" | "neutral" };
export type MProfileMeta = { label: string; value: string | null | undefined };

export type MProfileApproval = {
  /** translated label for the "verified / authorized" state, value is data */
  statusLabel?: string;
  statusValue?: string;
  approvedByLabel?: string;
  approvedByValue?: string;
  authorityLabel?: string;
  authorityValue?: string;
  companyLabel?: string;
  companyValue?: string;
};

export type MasterProfileConfig = {
  lang?: string;
  autoPrint?: boolean;
  title: string;            // translated report title, e.g. t(lang,"branch.report_title")
  subtitle?: string;        // translated subtitle
  overviewLabel?: string;   // translated "… Profile Overview"
  reportTypeLabel?: string; // translated report-type value (defaults to subtitle)
  name?: string;            // main record name (record data)
  status?: string;          // record status (record data)
  meta: MProfileMeta[];      // up to 4 header banner cells (label translated, value = data)
  kpis?: MProfileKpi[];     // 0 or 4 KPI cards (label translated, value formatted data)
  sections: MProfileSection[]; // numbered section cards
  createdBy?: string;       // record audit data
  reportIdPrefix?: string;  // e.g. "BRANCH" / "LEDGER" for the footer report id
  reportIdValue?: string;   // e.g. code
  footerAccountName?: string; // company / account name shown in the running footer

  /** Compact Roles & Permissions summary (spec §4). Rendered full-width. */
  permissions?: {
    title: string;                 // translated section title
    summary: PermissionPrintSummary;
    templateLabel?: string;        // translated "Template"
    grantedLabel?: string;         // translated "granted"
  };
  /** Professional approval area (spec §10). Rendered compact, never half a page. */
  approval?: MProfileApproval;
  /** translated remarks/notes body (spec Page 2). */
  remarksTitle?: string;
  remarksBody?: string;
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openMasterProfileReportWindow(config: MasterProfileConfig) {
  if (typeof window === "undefined") return;

  const lang = (config.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const DASH = tt("acct.no_data", "-");
  const v = (value: string | null | undefined) => {
    const s = value === null || value === undefined ? "" : String(value);
    return s.trim() ? escapeHtml(s) : DASH;
  };

  const title = escapeHtml(config.title);
  const subtitle = escapeHtml(config.subtitle || config.title);
  const reportType = escapeHtml(config.reportTypeLabel || config.subtitle || config.title);
  const footerAccount = escapeHtml(config.footerAccountName || "ACCOUNTS.DGT.LLC");

  const metaCells = (config.meta || []).slice(0, 4)
    .map((m) => `<div><span class="overview-meta-label">${escapeHtml(m.label)}</span><div class="overview-meta-val">${v(m.value)}</div></div>`)
    .join("");

  const toneClass: Record<string, string> = { open: "kpi-open", current: "kpi-current", debit: "kpi-debit", credit: "kpi-credit", neutral: "kpi-current" };
  const kpiCells = (config.kpis || [])
    .map((k) => `<div class="kpi"><span class="kpi-label">${escapeHtml(k.label)}</span><div class="kpi-val ${toneClass[k.tone || "neutral"]}">${escapeHtml(k.value)}</div></div>`)
    .join("");
  const kpiBlock = kpiCells ? `<div class="overview-kpis">${kpiCells}</div>` : "";

  // ---- numbered section cards (2-up unless fullWidth) ----------------------
  const renderCard = (sec: MProfileSection, i: number) => {
    const rows = sec.rows
      .map((r) => `<tr><td class="label">${escapeHtml(r.label)}</td><td class="value">${v(r.value)}</td></tr>`)
      .join("");
    return `<div class="section-card${sec.fullWidth ? " section-card--full" : ""}${sec.pageBreakBefore ? " section-card--break" : ""}">
      <div class="section-header"><span class="section-badge">${i + 1}</span> ${escapeHtml(sec.title)}</div>
      <table class="info-table">${rows}</table>
    </div>`;
  };

  // Build a flow of rows: consecutive non-fullWidth cards pair up into .grid-2,
  // fullWidth cards stand alone.
  let sectionFlow = "";
  let idx = 0;
  const secs = config.sections || [];
  for (let i = 0; i < secs.length; i++) {
    const sec = secs[i];
    if (sec.fullWidth) {
      sectionFlow += renderCard(sec, idx++);
      continue;
    }
    const next = secs[i + 1];
    if (next && !next.fullWidth && !next.pageBreakBefore) {
      sectionFlow += `<div class="grid-2">${renderCard(sec, idx++)}${renderCard(next, idx++)}</div>`;
      i++;
    } else {
      sectionFlow += `<div class="grid-2">${renderCard(sec, idx++)}</div>`;
    }
  }

  // ---- compact permissions summary ---------------------------------------
  let permissionsBlock = "";
  if (config.permissions) {
    const { summary, templateLabel, grantedLabel } = config.permissions;
    const groups = summary.groups
      .map(
        (g) => `<div class="perm-group">
          <div class="perm-group-title">${escapeHtml(g.title)}</div>
          <ul class="perm-list">
            ${g.items
              .map(
                (it) =>
                  `<li class="${it.enabled ? "on" : "off"}"><span class="perm-mark">${it.enabled ? "✓" : "×"}</span>${escapeHtml(it.label)}</li>`,
              )
              .join("")}
          </ul>
        </div>`,
      )
      .join("");
    permissionsBlock = `<div class="section-card section-card--full">
      <div class="section-header"><span class="section-badge">${idx + 1}</span> ${escapeHtml(config.permissions.title)}
        <span class="perm-count">${escapeHtml(templateLabel || "Template")}: ${escapeHtml(summary.template)} · ${summary.grantedCount}/${summary.totalCount} ${escapeHtml(grantedLabel || "granted")}</span>
      </div>
      <div class="perm-grid">${groups}</div>
    </div>`;
    idx++;
  }

  // ---- remarks + approval ------------------------------------------------
  const remarksTitle = escapeHtml(config.remarksTitle || tt("acct.remarks", "Remarks / Notes"));
  const remarksBody = escapeHtml(
    config.remarksBody || tt("acct.remarks_body", "This is the official master profile document generated by the ERP."),
  );

  const a = config.approval;
  const approvalBlock = a
    ? `<div class="approval-box">
        <div class="approval-title">${escapeHtml(a.statusLabel || tt("acct.approval", "Verified / Authorized By"))}</div>
        <table class="approval-table">
          <tr><td>${escapeHtml(a.statusLabel || tt("acct.status", "Status"))}</td><td>${v(a.statusValue || tt("acct.verified", "Verified"))}</td></tr>
          <tr><td>${escapeHtml(a.approvedByLabel || tt("acct.approved_by", "Approved / Authorized By"))}</td><td>${v(a.approvedByValue)}</td></tr>
          <tr><td>${escapeHtml(a.authorityLabel || tt("acct.approved_authority", "Approved Authority"))}</td><td>${v(a.authorityValue)}</td></tr>
          <tr><td>${escapeHtml(a.companyLabel || tt("acct.company", "Company"))}</td><td>${v(a.companyValue)}</td></tr>
        </table>
      </div>`
    : `<div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-name">${tt("acct.authorized_signature", "Authorized Signature")}</div>
        <div class="sig-role">${tt("acct.administration", "FMS Administration")}</div>
      </div>`;

  const footerBlock = `<div class="footer-signatures">
      <div class="notes-box">
        <strong>${remarksTitle}</strong>
        <span>${remarksBody}</span>
      </div>
      ${approvalBlock}
    </div>`;

  const reportId = `${escapeHtml(config.reportIdPrefix || "REC")}-${v(config.reportIdValue)}-${escapeHtml(stampDate.replace(/[ ,]/g, ""))}`;

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');

      @page {
        size: A4 portrait;
        margin: 11mm 11mm 14mm 11mm;
        @top-left   { content: "${escapeHtml(tt("acct.brand_short", "Digital Dock ERP"))} — ${title}"; font-size: 7pt; color: #64748b; font-weight: 700; }
        @top-right  { content: "${escapeHtml(stampDate)} ${escapeHtml(stampTime)}"; font-size: 7pt; color: #94a3b8; }
        @bottom-left   { content: "${escapeHtml(tt("acct.brand_short", "Digital Dock ERP"))} | ${footerAccount}"; font-size: 7pt; color: #94a3b8; font-weight: 700; }
        @bottom-center { content: "${escapeHtml(reportId)}"; font-size: 6.5pt; color: #cbd5e1; }
        @bottom-right  { content: "${escapeHtml(tt("acct.page", "Page"))} " counter(page) " ${escapeHtml(tt("acct.of", "of"))} " counter(pages); font-size: 7pt; color: #64748b; font-weight: 700; }
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
      html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }

      .wrap { padding: 24px; display: flex; justify-content: center; }
      .page { width: 210mm; padding: 11mm; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.08); border-radius: 10px; box-sizing: border-box; }

      /* ---- on-screen (preview) header/footer, hidden in print (the @page boxes take over) ---- */
      .screen-head, .screen-foot { color: #64748b; font-size: 8px; font-weight: 700; display: flex; justify-content: space-between; padding: 0 2px 6px; }
      .screen-foot { padding: 6px 2px 0; border-top: 1px solid #f1f5f9; margin-top: 8px; }

      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      .header-table td { border: none; padding: 0; vertical-align: middle; }
      .logo-title { display: flex; align-items: center; gap: 9px; }
      .logo-icon { width: 32px; height: 32px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; }
      .logo-text { font-size: 13px; font-weight: 900; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 7.5px; color: #64748b; font-weight: 600; }
      .report-title { font-size: 15px; font-weight: 900; color: #1e3a8a; margin: 0 0 3px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.4px; }
      .subtitle-pill { font-size: 7.5px; font-weight: 800; border: 1px solid #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 2px 9px; display: inline-block; }
      .meta-box { font-size: 8px; color: #334155; font-weight: 700; line-height: 1.45; }
      .meta-label { color: #64748b; font-weight: 500; }

      .overview-banner { background: #0f172a; color: #fff; border-radius: 7px; padding: 12px 16px; margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
      .overview-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .overview-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
      .overview-name { font-size: 17px; font-weight: 900; color: #fff; margin-top: 2px; word-break: break-word; }
      .overview-status { font-size: 8px; font-weight: 800; border: 1px solid rgba(16,185,129,0.35); background: rgba(16,185,129,0.15); color: #34d399; border-radius: 4px; padding: 3px 8px; text-transform: uppercase; white-space: nowrap; }
      .overview-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 11px; border-top: 1px solid #334155; padding-top: 10px; }
      .overview-meta-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .overview-meta-val { font-size: 10px; font-weight: 800; color: #e2e8f0; margin-top: 2px; word-break: break-word; }
      .overview-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 10px; }
      .kpi { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 7px 9px; }
      .kpi-label { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .kpi-val { font-size: 13px; font-weight: 900; margin-top: 2px; word-break: break-word; }
      .kpi-open { color: #93c5fd; } .kpi-current { color: #fff; } .kpi-debit { color: #fca5a5; } .kpi-credit { color: #6ee7b7; }

      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; break-inside: avoid; page-break-inside: avoid; }
      .grid-2:has(.section-card--full) { display: block; }

      .section-card { background: #fff; border: 1px solid #dbe2ea; border-radius: 7px; margin-bottom: 10px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .section-card--full { grid-column: 1 / -1; }
      .section-card--break { break-before: page; page-break-before: always; }
      .section-header { background: #1e3a8a; color: #fff; padding: 5px 10px; font-size: 9px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
      .section-badge { background: #fff; color: #1e3a8a; width: 14px; height: 14px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 7.5px; font-weight: 900; flex: 0 0 auto; }
      .perm-count { margin-inline-start: auto; font-size: 7px; font-weight: 700; color: #cbd5e1; text-transform: none; letter-spacing: 0; }

      .info-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .info-table tr { break-inside: avoid; page-break-inside: avoid; }
      .info-table td { padding: 4px 8px; font-size: 9px; border-bottom: 1px solid #f1f5f9; vertical-align: top; line-height: 1.35; }
      .info-table tr:last-child td { border-bottom: none; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 44%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: end; word-break: break-word; overflow-wrap: anywhere; }
      html[dir="rtl"] .info-table td.value { text-align: start; }

      .perm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; padding: 8px 10px; }
      .perm-group { break-inside: avoid; page-break-inside: avoid; margin-bottom: 4px; }
      .perm-group-title { font-size: 7.5px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px; }
      .perm-list { list-style: none; margin: 0; padding: 0; }
      .perm-list li { font-size: 8px; line-height: 1.5; color: #334155; display: flex; align-items: flex-start; gap: 4px; break-inside: avoid; }
      .perm-list li.off { color: #94a3b8; }
      .perm-mark { font-weight: 900; width: 8px; flex: 0 0 auto; text-align: center; }
      .perm-list li.on .perm-mark { color: #059669; }
      .perm-list li.off .perm-mark { color: #cbd5e1; }

      .footer-signatures { display: flex; justify-content: space-between; align-items: stretch; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; gap: 16px; break-inside: avoid; page-break-inside: avoid; }
      .notes-box { width: 52%; font-size: 8px; color: #64748b; line-height: 1.4; }
      .notes-box strong { color: #0f172a; font-size: 8.5px; display: block; margin-bottom: 2px; }
      .approval-box { width: 44%; border: 1px solid #dbe2ea; border-radius: 6px; overflow: hidden; break-inside: avoid; }
      .approval-title { background: #1e3a8a; color: #fff; font-size: 8px; font-weight: 800; text-transform: uppercase; padding: 4px 8px; letter-spacing: 0.3px; }
      .approval-table { width: 100%; border-collapse: collapse; }
      .approval-table td { padding: 3px 8px; font-size: 8px; border-bottom: 1px solid #f1f5f9; }
      .approval-table td:first-child { color: #64748b; font-weight: 600; width: 48%; }
      .approval-table td:last-child { font-weight: 700; color: #1e293b; text-align: end; }
      .approval-table tr:last-child td { border-bottom: none; }
      .sig-box { width: 32%; text-align: center; font-size: 8px; align-self: flex-end; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 4px; height: 20px; }
      .sig-name { font-size: 8px; font-weight: 700; color: #64748b; }
      .sig-role { font-size: 7px; color: #94a3b8; font-weight: 500; }

      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }

      @media screen { .screen-only { display: block; } }
      @media print {
        body { background: #fff; }
        .wrap { padding: 0; }
        .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; }
        .screen-head, .screen-foot { display: none; }
        .section-card, .grid-2, .overview-banner, .footer-signatures, .perm-group, .approval-box, .info-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }
        .section-card--break { break-before: page !important; page-break-before: always !important; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="page">
        <div class="screen-head"><span>${escapeHtml(tt("acct.brand_short", "Digital Dock ERP"))} — ${title}</span><span>${escapeHtml(stampDate)} ${escapeHtml(stampTime)}</span></div>

        <table class="header-table">
          <tr>
            <td style="width: 34%;">
              <div class="logo-title">
                <div class="logo-icon">🏢</div>
                <div>
                  <div class="logo-text">${footerAccount}</div>
                  <div class="logo-subtext">${escapeHtml(tt("acct.brand_short", "Digital Dock ERP"))} / FMS</div>
                </div>
              </div>
            </td>
            <td style="width: 32%; text-align: center;">
              <h1 class="report-title">${title}</h1>
              <div class="subtitle-pill">${subtitle}</div>
            </td>
            <td style="width: 34%; text-align: ${isRtl ? "left" : "right"};">
              <div class="meta-box">
                <div><span class="meta-label">${tt("acct.as_on", "Date / As On")} :</span> ${escapeHtml(stampDate)}</div>
                <div><span class="meta-label">${tt("acct.time", "Time")} :</span> ${escapeHtml(stampTime)}</div>
                <div><span class="meta-label">${tt("acct.created_by", "Created By")} :</span> ${v(config.createdBy)}</div>
                <div><span class="meta-label">${tt("acct.report_type", "Report Type")} :</span> ${reportType}</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="overview-banner">
          <div class="overview-top">
            <div>
              <div class="overview-title">${escapeHtml(config.overviewLabel || title)}</div>
              <div class="overview-name">${v(config.name || subtitle || "-")}</div>
            </div>
            ${config.status ? `<span class="overview-status">${v(config.status)}</span>` : ""}
          </div>
          <div class="overview-meta-grid">${metaCells}</div>
          ${kpiBlock}
        </div>

        ${sectionFlow}
        ${permissionsBlock}
        ${footerBlock}

        <div class="screen-foot"><span>${escapeHtml(tt("acct.brand_short", "Digital Dock ERP"))} | ${footerAccount}</span><span>${escapeHtml(reportId)}</span></div>
      </div>
    </div>
    <script>
      window.__ERP_A4_AUTOPRINT__ = ${config.autoPrint ? "true" : "false"};
      window.addEventListener('load', () => { if (window.__ERP_A4_AUTOPRINT__) { setTimeout(() => window.print(), 150); } }, { once: true });
    </script>
  </body>
</html>`;

  printStore.openPrint(html, config.title);
}
