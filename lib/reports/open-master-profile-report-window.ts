import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

/**
 * Canonical, reusable A4 "master profile" print/PDF engine for the whole ERP.
 *
 * Every master-entry module (Account, City Branch, Country Branch, Ledger, Customer, Company,
 * Bank, Employee, User, …) builds a small config of ALREADY-TRANSLATED labels + REAL record values
 * and calls this one function. The professional layout, branding, dark overview banner, numbered
 * section cards, signature/footer, RTL behaviour, A4 print CSS, long-value wrapping and the shared
 * chrome labels (date/time/created-by/remarks/signature) all live here — so a new master gets the
 * exact same print standard without copying HTML. Do NOT fork this design per module.
 *
 * Labels must come from the central dictionary (lib/i18n/ui.ts) via the caller's t(lang, ...). This
 * engine only adds the generic chrome labels (also from the central dictionary).
 */

export type MProfileRow = { label: string; value: string | null | undefined };
export type MProfileSection = { title: string; rows: MProfileRow[] };
export type MProfileKpi = { label: string; value: string; tone?: "open" | "current" | "debit" | "credit" | "neutral" };
export type MProfileMeta = { label: string; value: string | null | undefined };

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
  sections: MProfileSection[]; // numbered 2-column section cards
  createdBy?: string;       // record audit data
  reportIdPrefix?: string;  // e.g. "BRANCH" / "LEDGER" for the footer report id
  reportIdValue?: string;   // e.g. code
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

  const metaCells = (config.meta || []).slice(0, 4)
    .map((m) => `<div><span class="overview-meta-label">${escapeHtml(m.label)}</span><div class="overview-meta-val">${v(m.value)}</div></div>`)
    .join("");

  const toneClass: Record<string, string> = { open: "kpi-open", current: "kpi-current", debit: "kpi-debit", credit: "kpi-credit", neutral: "kpi-current" };
  const kpiCells = (config.kpis || [])
    .map((k) => `<div class="kpi"><span class="kpi-label">${escapeHtml(k.label)}</span><div class="kpi-val ${toneClass[k.tone || "neutral"]}">${escapeHtml(k.value)}</div></div>`)
    .join("");
  const kpiBlock = kpiCells ? `<div class="overview-kpis">${kpiCells}</div>` : "";

  const sectionCards = (config.sections || [])
    .map((sec, i) => {
      const rows = sec.rows.map((r) => `<tr><td class="label">${escapeHtml(r.label)}</td><td class="value">${v(r.value)}</td></tr>`).join("");
      return `<div class="section-card">
        <div class="section-header"><span class="section-badge">${i + 1}</span> ${escapeHtml(sec.title)}</div>
        <table class="info-table">${rows}</table>
      </div>`;
    });
  // Lay the numbered cards out two-per-row.
  let sectionGrid = "";
  for (let i = 0; i < sectionCards.length; i += 2) {
    sectionGrid += `<div class="grid-2">${sectionCards[i] || ""}${sectionCards[i + 1] || ""}</div>`;
  }

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
      @page { size: A4; margin: 12mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
      html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
      .wrap { padding: 25px; display: flex; justify-content: center; }
      .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.08); border-radius: 12px; box-sizing: border-box; display: flex; flex-direction: column; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .header-table td { border: none; padding: 0; vertical-align: middle; }
      .logo-title { display: flex; align-items: center; gap: 10px; }
      .logo-icon { width: 36px; height: 36px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
      .logo-text { font-size: 14px; font-weight: 900; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 8px; color: #64748b; font-weight: 600; line-height: 1.2; }
      .report-title { font-size: 16px; font-weight: 900; color: #1e3a8a; margin: 0 0 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.4px; }
      .subtitle-pill { font-size: 8px; font-weight: 800; border: 1px solid #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 2px 10px; display: inline-block; }
      .meta-box { font-size: 9px; color: #334155; font-weight: 700; line-height: 1.5; }
      .meta-label { color: #64748b; font-weight: 500; }
      .overview-banner { background: #0f172a; color: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 18px; }
      .overview-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .overview-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
      .overview-name { font-size: 20px; font-weight: 900; color: #fff; margin-top: 2px; word-break: break-word; }
      .overview-status { font-size: 8.5px; font-weight: 800; border: 1px solid rgba(16,185,129,0.35); background: rgba(16,185,129,0.15); color: #34d399; border-radius: 4px; padding: 3px 9px; text-transform: uppercase; white-space: nowrap; }
      .overview-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
      .overview-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .overview-meta-val { font-size: 11px; font-weight: 800; color: #e2e8f0; margin-top: 2px; word-break: break-word; }
      .overview-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
      .kpi { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; }
      .kpi-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .kpi-val { font-size: 14px; font-weight: 900; margin-top: 2px; word-break: break-word; }
      .kpi-open { color: #93c5fd; } .kpi-current { color: #fff; } .kpi-debit { color: #fca5a5; } .kpi-credit { color: #6ee7b7; }
      .section-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
      .section-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 9.5px; font-weight: 800; color: #1e293b; letter-spacing: 0.4px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
      .section-badge { background: #1e3a8a; color: #fff; width: 15px; height: 15px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; flex: 0 0 auto; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .info-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .info-table td { padding: 5px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: end; word-break: break-word; overflow-wrap: anywhere; }
      .footer-signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 14px; border-top: 1px solid #e2e8f0; gap: 16px; }
      .notes-box { width: 55%; font-size: 8px; color: #64748b; line-height: 1.4; }
      .sig-box { width: 30%; text-align: center; font-size: 9px; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 4px; height: 22px; }
      .page-footer { display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 10px; font-weight: 700; gap: 8px; }
      html[dir="rtl"] body { direction: rtl; }
      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }
      html[dir="rtl"] .info-table td.value { text-align: start; }
      @media print {
        body { background: #fff; }
        .wrap { padding: 0; }
        .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; min-height: 100%; }
        .section-card { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="page">
        <table class="header-table">
          <tr>
            <td style="width: 35%;">
              <div class="logo-title">
                <div class="logo-icon">🏢</div>
                <div>
                  <div class="logo-text">ACCOUNTS.DGT.LLC</div>
                  <div class="logo-subtext">Enterprise ERP / FMS</div>
                </div>
              </div>
            </td>
            <td style="width: 30%; text-align: center;">
              <h1 class="report-title">${title}</h1>
              <div class="subtitle-pill">${subtitle}</div>
            </td>
            <td style="width: 35%; text-align: ${isRtl ? "left" : "right"};">
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

        ${sectionGrid}

        <div class="footer-signatures">
          <div class="notes-box">
            <strong style="color:#0f172a; font-size:9px; display:block; margin-bottom:2px;">${tt("acct.remarks", "Remarks / Notes")}</strong>
            <span>${tt("acct.remarks_body", "This is the official master profile document generated by the ERP.")}</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="font-size:8px; font-weight:700; color:#64748b;">${tt("acct.authorized_signature", "Authorized Signature")}</div>
            <div style="font-size:7px; color:#94a3b8; font-weight:500;">${tt("acct.administration", "FMS Administration")}</div>
          </div>
        </div>

        <div class="page-footer">
          <div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS</div>
          <div>Report ID: ${escapeHtml(config.reportIdPrefix || "REC")}-${v(config.reportIdValue)}-${escapeHtml(stampDate.replace(/[ ,]/g, ""))}</div>
          <div>1 / 1</div>
        </div>
      </div>
    </div>
    <script>
      window.__ERP_A4_AUTOPRINT__ = ${config.autoPrint ? "true" : "false"};
      window.addEventListener('load', () => { if (window.__ERP_A4_AUTOPRINT__) { setTimeout(() => window.print(), 120); } }, { once: true });
    </script>
  </body>
</html>`;

  printStore.openPrint(html, config.title);
}
