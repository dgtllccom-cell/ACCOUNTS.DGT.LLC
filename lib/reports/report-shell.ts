import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

/**
 * Shared A4 report shell for the whole ERP print system. ONE design, reused by every print engine
 * (master profile, voucher, journal). Owns the ACCOUNTS.DGT.LLC branding, A4 page CSS, RTL fonts,
 * long-value wrapping, print rules (repeat table header across pages, avoid card break), and the
 * date/created-by/report-type meta + signature/footer chrome. Engines only supply the body HTML.
 */

export function escapeReportHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const A4_SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
  @page { size: A4; margin: 12mm; }
  html, body { height: 100%; margin: 0; padding: 0; }
  body { background: #f1f5f9; color: #1e293b; font-family: 'Inter','Noto Naskh Arabic',Arial,sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu','Noto Naskh Arabic','Inter',serif; }
  html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic','Inter',sans-serif; }
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
  .overview-meta-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 14px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
  .overview-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
  .overview-meta-val { font-size: 11px; font-weight: 800; color: #e2e8f0; margin-top: 2px; word-break: break-word; }
  .overview-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 12px; }
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
  /* Journal / ledger data table */
  .data-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .data-table thead { display: table-header-group; }
  .data-table th { background: #0f172a; color: #fff; font-size: 8.5px; font-weight: 800; text-transform: uppercase; padding: 6px 6px; border: 1px solid #1e293b; }
  .data-table td { font-size: 9px; padding: 5px 6px; border: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .data-table tfoot td { font-weight: 900; background: #eef2ff; border-top: 2px solid #1e3a8a; font-size: 9px; }
  .num { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chip { font-size: 8.5px; font-weight: 700; background: #eef2ff; color: #1e3a8a; border: 1px solid #c7d2fe; border-radius: 999px; padding: 3px 9px; }
  .chip b { color: #334155; font-weight: 800; }
  .footer-signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 14px; border-top: 1px solid #e2e8f0; gap: 16px; }
  .notes-box { width: 50%; font-size: 8px; color: #64748b; line-height: 1.4; }
  .sig-wrap { display: flex; gap: 16px; }
  .sig-box { min-width: 120px; text-align: center; font-size: 9px; }
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
    .data-table tr { break-inside: avoid; }
  }
`;

/** Renders the full A4 document: branding header (with right-side date/created-by/report-type
 *  meta), the engine-supplied body, a signature/footer block, and opens it in the print store. */
export function renderA4Document(opts: {
  lang: SupportedLanguage;
  autoPrint?: boolean;
  title: string;
  subtitle: string;
  reportType?: string;
  createdBy?: string;
  bodyHtml: string;
  reportId: string;
  signatures?: string[]; // translated signature-role captions
}) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(opts.lang);
  const tt = (key: string, fallback: string) => t(opts.lang, key as never, fallback);
  const e = escapeReportHtml;
  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const createdBy = opts.createdBy && String(opts.createdBy).trim() ? e(opts.createdBy) : tt("acct.no_data", "-");

  const sigCaptions = opts.signatures && opts.signatures.length
    ? opts.signatures
    : [tt("acct.authorized_signature", "Authorized Signature")];
  const sigBoxes = sigCaptions
    .map((cap) => `<div class="sig-box"><div class="sig-line"></div><div style="font-size:8px;font-weight:700;color:#64748b;">${e(cap)}</div></div>`)
    .join("");

  const html = `<!doctype html>
<html lang="${opts.lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${e(opts.title)}</title>
  <style>${A4_SHARED_CSS}</style></head>
  <body><div class="wrap"><div class="page">
    <table class="header-table"><tr>
      <td style="width:35%;"><div class="logo-title"><div class="logo-icon">🏢</div><div><div class="logo-text">ACCOUNTS.DGT.LLC</div><div class="logo-subtext">Enterprise ERP / FMS</div></div></div></td>
      <td style="width:30%;text-align:center;"><h1 class="report-title">${e(opts.title)}</h1><div class="subtitle-pill">${e(opts.subtitle)}</div></td>
      <td style="width:35%;text-align:${isRtl ? "left" : "right"};"><div class="meta-box">
        <div><span class="meta-label">${tt("acct.as_on", "Date / As On")} :</span> ${e(stampDate)}</div>
        <div><span class="meta-label">${tt("acct.time", "Time")} :</span> ${e(stampTime)}</div>
        <div><span class="meta-label">${tt("acct.created_by", "Created By")} :</span> ${createdBy}</div>
        <div><span class="meta-label">${tt("acct.report_type", "Report Type")} :</span> ${e(opts.reportType || opts.subtitle)}</div>
      </div></td>
    </tr></table>
    ${opts.bodyHtml}
    <div class="footer-signatures">
      <div class="notes-box"><strong style="color:#0f172a;font-size:9px;display:block;margin-bottom:2px;">${tt("acct.remarks", "Remarks / Notes")}</strong><span>${tt("acct.remarks_body", "This is an official document generated by the ERP.")}</span></div>
      <div class="sig-wrap">${sigBoxes}</div>
    </div>
    <div class="page-footer"><div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS</div><div>Report ID: ${e(opts.reportId)}-${e(stampDate.replace(/[ ,]/g, ""))}</div><div>1 / 1</div></div>
  </div></div>
  <script>window.__ERP_A4_AUTOPRINT__ = ${opts.autoPrint ? "true" : "false"};window.addEventListener('load',()=>{if(window.__ERP_A4_AUTOPRINT__){setTimeout(()=>window.print(),120);}},{once:true});</script>
  </body></html>`;

  printStore.openPrint(html, opts.title);
}
