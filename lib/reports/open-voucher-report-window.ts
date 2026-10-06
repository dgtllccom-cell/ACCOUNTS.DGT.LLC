import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { renderA4Document, escapeReportHtml } from "@/lib/reports/report-shell";

/**
 * Reusable single-entry VOUCHER print engine (a Roznamcha entry, a payment/receipt, a purchase/sales
 * bill, a transfer, a cash/bank entry). One engine, thin per-module config. Renders the entry name +
 * status + key meta (serial/date/branch/user/currency/ref) in the dark banner, a DR/CR line table with
 * totals, plus detail section cards (narration, audit, linked business document). Central i18n; real
 * data only.
 */

export type VoucherLine = {
  account: string;
  description?: string | null;
  debit?: string | null;
  credit?: string | null;
  currency?: string | null;
};
export type VoucherMeta = { label: string; value: string | null | undefined };
export type VoucherSection = { title: string; rows: Array<{ label: string; value: string | null | undefined }> };

export type VoucherReportConfig = {
  lang?: string;
  autoPrint?: boolean;
  title: string;
  subtitle: string;
  overviewLabel: string;
  entryName: string;        // narration / voucher title (record data)
  status?: string;
  meta: VoucherMeta[];      // up to 4 banner cells
  lines: VoucherLine[];     // DR/CR lines
  totalDebit?: string;
  totalCredit?: string;
  sections?: VoucherSection[]; // details / audit / linked doc
  createdBy?: string;
  reportIdPrefix?: string;
  reportIdValue?: string;
  signatures?: string[];
};

export function openVoucherReportWindow(config: VoucherReportConfig) {
  if (typeof window === "undefined") return;
  const lang = (config.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const e = escapeReportHtml;
  const DASH = tt("acct.no_data", "-");
  const cell = (v: string | null | undefined) => (v === null || v === undefined || String(v).trim() === "" ? DASH : e(v));

  const metaCells = (config.meta || []).slice(0, 4)
    .map((m) => `<div><span class="overview-meta-label">${e(m.label)}</span><div class="overview-meta-val">${cell(m.value)}</div></div>`)
    .join("");

  const lineRows = (config.lines || []).length
    ? config.lines.map((l) => `<tr>
        <td>${cell(l.account)}</td>
        <td>${cell(l.description)}</td>
        <td class="num">${l.debit && String(l.debit).trim() ? e(l.debit) : "-"}</td>
        <td class="num">${l.credit && String(l.credit).trim() ? e(l.credit) : "-"}</td>
        <td style="text-align:center;">${cell(l.currency)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">${tt("report.builder_no_records", "No records found")}</td></tr>`;

  const lineTable = `<table class="data-table">
    <thead><tr>
      <th style="text-align:start">${tt("rozrep.account_name", "Account Name")}</th>
      <th style="text-align:start">${tt("acct.remarks", "Details")}</th>
      <th style="text-align:end">${tt("rozrep.debit", "Debit")}</th>
      <th style="text-align:end">${tt("rozrep.credit", "Credit")}</th>
      <th style="text-align:center">${tt("rozrep.currency", "Currency")}</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
    <tfoot><tr>
      <td colspan="2" style="text-align:end">${tt("bankroz.totals", "Totals")}</td>
      <td class="num">${cell(config.totalDebit)}</td>
      <td class="num">${cell(config.totalCredit)}</td>
      <td></td>
    </tr></tfoot>
  </table>`;

  const sectionCards = (config.sections || []).map((sec, i) => {
    const rows = sec.rows.map((r) => `<tr><td class="label">${e(r.label)}</td><td class="value">${cell(r.value)}</td></tr>`).join("");
    return `<div class="section-card"><div class="section-header"><span class="section-badge">${i + 1}</span> ${e(sec.title)}</div><table class="info-table">${rows}</table></div>`;
  });
  let sectionGrid = "";
  for (let i = 0; i < sectionCards.length; i += 2) sectionGrid += `<div class="grid-2">${sectionCards[i] || ""}${sectionCards[i + 1] || ""}</div>`;

  const bodyHtml = `
    <div class="overview-banner">
      <div class="overview-top">
        <div><div class="overview-title">${e(config.overviewLabel)}</div><div class="overview-name">${cell(config.entryName)}</div></div>
        ${config.status ? `<span class="overview-status">${cell(config.status)}</span>` : ""}
      </div>
      <div class="overview-meta-grid">${metaCells}</div>
    </div>
    ${lineTable}
    <div style="height:12px;"></div>
    ${sectionGrid}
  `;

  renderA4Document({
    lang,
    autoPrint: config.autoPrint,
    title: config.title,
    subtitle: config.subtitle,
    reportType: config.subtitle,
    createdBy: config.createdBy,
    bodyHtml,
    reportId: `${config.reportIdPrefix || "VCH"}-${(config.reportIdValue || "").replace(/[^a-zA-Z0-9-]/g, "") || "ENTRY"}`,
    signatures: config.signatures || [
      tt("acct.created_by", "Prepared By"),
      tt("acct.authorized_signature", "Authorized Signature"),
    ],
  });
}
