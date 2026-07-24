import { getLanguageDirection, getHtmlLanguage, type SupportedLanguage } from "@/lib/i18n/languages";

export type ReportMeta = {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyLogoUrl?: string;
  companyInfo?: string[];
  country?: string;
  branch?: string;
  userName?: string;
  reportNumber?: string;
  billNumber?: string;
  manualBillNumber?: string;
  generatedAt?: string;
  qrText?: string;
};

export type ReportSection = {
  title: string;
  rows: Array<{ label: string; value: string | number | null | undefined }>;
};

export type ReportTable = {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

export type ProfessionalReportHtmlInput = {
  language: SupportedLanguage;
  meta: ReportMeta;
  sections?: ReportSection[];
  table?: ReportTable;
  footerText?: string;
  signatureLabels?: string[];
};

export type LedgerStatementHtmlInput = ProfessionalReportHtmlInput & {
  account: {
    accountName: string;
    accountNumber: string;
    manualReference?: string | null;
    customerNumber?: string | null;
    currency?: string | null;
    statementPeriod?: string | null;
    openingBalance?: number;
    closingBalance?: number;
  };
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return escapeHtml(value);
}

function buildStyles(direction: "ltr" | "rtl") {
  return `
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #f8fafc;
      font-family: ${direction === "rtl" ? "'Noto Naskh Arabic', 'Cairo', 'Vazirmatn', serif" : "Inter, Arial, sans-serif"};
      direction: ${direction};
    }
    .report-page { max-width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 18mm; box-shadow: 0 18px 50px rgba(15,23,42,.12); }
    .header { display: grid; grid-template-columns: 1.1fr 1.4fr 1fr; gap: 16px; border-bottom: 3px solid #0f172a; padding-bottom: 14px; align-items: center; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 46px; height: 46px; border-radius: 12px; background: #0f172a; color: #fff; display: grid; place-items: center; font-weight: 900; letter-spacing: .08em; }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .company { font-size: 18px; font-weight: 900; color: #0f172a; }
    .muted { color: #64748b; font-size: 11px; line-height: 1.6; }
    .title { text-align: center; }
    .title h1 { margin: 0; font-size: 21px; letter-spacing: .08em; text-transform: uppercase; }
    .title p { margin: 6px 0 0; color: #64748b; font-size: 12px; }
    .meta { font-size: 10px; line-height: 1.8; text-align: ${direction === "rtl" ? "left" : "right"}; }
    .meta strong { color: #0f172a; }
    .ribbon { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .ribbon div { border: 1px solid #dbe3ef; background: #f8fafc; border-radius: 8px; padding: 9px; }
    .ribbon span { display:block; color:#64748b; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }
    .ribbon strong { display:block; margin-top:3px; font-size:12px; color:#0f172a; }
    .sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 14px 0; }
    .section { border: 1px solid #dbe3ef; border-radius: 9px; overflow: hidden; break-inside: avoid; }
    .section h2 { margin: 0; padding: 9px 11px; background: #0f172a; color: #fff; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
    .row { display: grid; grid-template-columns: 42% 58%; border-top: 1px solid #e5eaf3; font-size: 10.5px; }
    .row:first-of-type { border-top: 0; }
    .row label { color: #64748b; padding: 7px 10px; background: #fbfdff; text-transform: uppercase; font-size: 9px; letter-spacing: .06em; }
    .row span { padding: 7px 10px; font-weight: 650; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10px; }
    thead th { background: #0f172a; color: #fff; padding: 8px 7px; text-align: ${direction === "rtl" ? "right" : "left"}; letter-spacing: .05em; text-transform: uppercase; }
    tbody td { border: 1px solid #e5eaf3; padding: 7px; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 36px; }
    .signature div { border-top: 1px solid #334155; padding-top: 8px; text-align: center; font-size: 10px; color: #334155; }
    .footer { margin-top: 24px; border-top: 1px solid #dbe3ef; padding-top: 10px; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { body { background: #fff; } .report-page { box-shadow: none; margin: 0; max-width: none; min-height: auto; padding: 0; } }
  `;
}

export function buildProfessionalReportHtml(input: ProfessionalReportHtmlInput) {
  const direction = getLanguageDirection(input.language);
  const lang = getHtmlLanguage(input.language);
  const meta = input.meta;
  const generatedAt = meta.generatedAt ?? new Date().toLocaleString("en-GB");
  const logo = meta.companyLogoUrl ? `<img src="${escapeHtml(meta.companyLogoUrl)}" alt="Logo" />` : "D";
  const signatures = input.signatureLabels ?? ["Prepared By", "Checked By", "Approved By"];

  return `<!doctype html>
<html lang="${escapeHtml(lang)}" dir="${direction}">
<head><meta charset="utf-8" /><title>${escapeHtml(meta.title)}</title><style>${buildStyles(direction)}</style></head>
<body>
  <main class="report-page">
    <header class="header">
      <div class="brand"><div class="logo">${logo}</div><div><div class="company">${escapeHtml(meta.companyName ?? "DAMAAN BUSINESS GROUP ERP")}</div>${(meta.companyInfo ?? ["Enterprise ERP / FMS", "Multi-country branch management"]).map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join("")}</div></div>
      <div class="title"><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.subtitle ?? "Professional ERP Report")}</p></div>
      <div class="meta">
        <div><strong>Report No:</strong> ${renderValue(meta.reportNumber)}</div>
        <div><strong>Date / Time:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong>User:</strong> ${renderValue(meta.userName)}</div>
        <div><strong>Branch:</strong> ${renderValue(meta.branch)}</div>
      </div>
    </header>

    <section class="ribbon">
      <div><span>Country</span><strong>${renderValue(meta.country)}</strong></div>
      <div><span>Bill No</span><strong>${renderValue(meta.billNumber)}</strong></div>
      <div><span>Manual Bill No</span><strong>${renderValue(meta.manualBillNumber)}</strong></div>
      <div><span>QR / Ref</span><strong>${renderValue(meta.qrText)}</strong></div>
    </section>

    ${(input.sections?.length ? `<section class="sections">${input.sections.map((section) => `<article class="section"><h2>${escapeHtml(section.title)}</h2>${section.rows.map((row) => `<div class="row"><label>${escapeHtml(row.label)}</label><span>${renderValue(row.value)}</span></div>`).join("")}</article>`).join("")}</section>` : "")}

    ${(input.table ? `<table><thead><tr>${input.table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${input.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${renderValue(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "")}

    <section class="signature">${signatures.map((label) => `<div>${escapeHtml(label)}</div>`).join("")}</section>
    <footer class="footer"><span>${escapeHtml(input.footerText ?? "Generated by DAMAAN ERP")}</span><span>Page 1</span></footer>
  </main>
</body></html>`;
}

export function buildLedgerStatementHtml(input: LedgerStatementHtmlInput) {
  const accountSection: ReportSection = {
    title: "Account Statement Profile",
    rows: [
      { label: "Account Name", value: input.account.accountName },
      { label: "Account Number", value: input.account.accountNumber },
      { label: "Manual Reference", value: input.account.manualReference },
      { label: "Customer Number", value: input.account.customerNumber },
      { label: "Currency", value: input.account.currency },
      { label: "Statement Period", value: input.account.statementPeriod },
      { label: "Opening Balance", value: input.account.openingBalance ?? 0 },
      { label: "Closing Balance", value: input.account.closingBalance ?? 0 }
    ]
  };

  return buildProfessionalReportHtml({
    ...input,
    meta: {
      ...input.meta,
      title: input.meta.title || "Ledger Statement"
    },
    sections: [accountSection, ...(input.sections ?? [])],
    signatureLabels: input.signatureLabels ?? ["Accountant", "Branch Manager", "Customer Signature"]
  });
}

export function openProfessionalReportWindow(html: string, autoPrint = true) {
  if (typeof window === "undefined") return;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=900");
  if (!popup) return;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  if (autoPrint) {
    popup.onload = () => popup.print();
  }
}
