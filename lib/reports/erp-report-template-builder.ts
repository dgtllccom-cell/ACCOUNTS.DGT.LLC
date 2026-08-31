export type ERPCompanyInfo = {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  country?: string;
  branch?: string;
  /** tax / registration number from the entity's branding record (never fabricated) */
  taxNo?: string;
  printedBy?: string;
  printedDate?: string;
  financialYear?: string;
  reportPeriod?: string;
  currency?: string;
  exchangeRate?: string;
};

export type ERPFilterPill = {
  label: string;
  value: string;
};

export type ERPKpiCard = {
  label: string;
  value: string;
  color?: "blue" | "green" | "red" | "amber" | "slate";
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatMoney(value: unknown, currency?: string): string {
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatNumber(value: unknown, unit?: string): string {
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateReportHtml(input: {
  title: string;
  subtitle?: string;
  documentNo?: string;
  orientation: "landscape" | "portrait";
  companyInfo?: ERPCompanyInfo;
  filters?: ERPFilterPill[];
  kpis?: ERPKpiCard[];
  mainTableHtml: string;
  footerNotesHtml?: string;
  legendHtml?: string;
  lang?: string;
  csvData?: string;
  /** "accounting" adds the FC/LC + double-entry footer note and the Financial Year
   *  line. Non-accounting reports (registers, HR, tasks, CRM, shipping) default to
   *  "generic" and get neither. */
  reportKind?: "accounting" | "generic";
}): string {
  const { title, orientation, companyInfo = {}, filters = [], kpis = [], mainTableHtml, footerNotesHtml, legendHtml, lang = "en", csvData = "", reportKind = "generic" } = input;
  const isAccounting = reportKind === "accounting";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Treat configuration placeholder strings ("Configured contact", "Configured email",
  // "N/A", "None", "-", "TBD", "TODO") that occasionally get typed into the company
  // record as unset, so they never surface in a customer-facing report.
  const realOrEmpty = (v: unknown): string => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (/^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$|todo$|placeholder\b|not\s+set$|not\s+configured$)/i.test(s)) return "";
    return s;
  };

  const compName = realOrEmpty(companyInfo.name) || "DIGITAL DOCK ERP";
  const compTagline = realOrEmpty(companyInfo.tagline) || "ERP Reporting System";
  // Contact fields come ONLY from the entity's branding record — never fabricated.
  const compAddress = realOrEmpty(companyInfo.address);
  const compPhone = realOrEmpty(companyInfo.phone);
  const compEmail = realOrEmpty(companyInfo.email);
  const compWebsite = realOrEmpty(companyInfo.website);
  const printedBy = realOrEmpty(companyInfo.printedBy)
    || (typeof window !== "undefined" ? realOrEmpty((window as unknown as { __ERP_USER_NAME__?: string }).__ERP_USER_NAME__) : "");
  const printedDate = companyInfo.printedDate || new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const financialYear = realOrEmpty(companyInfo.financialYear);
  const reportPeriod = companyInfo.reportPeriod || formatDate(new Date().toISOString());
  const compLogo = companyInfo.logoUrl || "";
  // QR verification payload: company + report + date, so a printed sheet is verifiable.
  const qrPayload = `ERP|${compName}|${title}|${printedDate}|${reportPeriod}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrPayload)}`;

  return `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - ${escapeHtml(compName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
    
    @page {
      size: A4 ${orientation};
      margin: 6mm;
    }

    * { box-sizing: border-box; }
    
    html, body {
      background: #0f172a;
      color: #0f172a;
      font-family: 'Noto Naskh Arabic', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 8.5px;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Screen Toolbar */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #090d16;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      font-size: 12px;
      border-b: 1px solid #1e293b;
    }

    .toolbar-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
    }

    .toolbar-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-action {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #334155;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease-in-out;
    }
    .btn-action:hover { background: #334155; transform: translateY(-1px); }
    .btn-primary { background: #0284c7; border-color: #0284c7; }
    .btn-primary:hover { background: #0369a1; }
    .btn-success { background: #059669; border-color: #059669; }
    .btn-success:hover { background: #047857; }
    .btn-amber { background: #d97706; border-color: #d97706; }
    .btn-amber:hover { background: #b45309; }
    .btn-slate { background: #475569; border-color: #475569; }
    .btn-slate:hover { background: #334155; }

    .zoom-controls {
      display: inline-flex;
      align-items: center;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 2px 6px;
      gap: 4px;
      margin-right: 8px;
    }

    .zoom-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-weight: 900;
      font-size: 12px;
      padding: 2px 6px;
      cursor: pointer;
      border-radius: 4px;
    }
    .zoom-btn:hover { background: #334155; color: #ffffff; }
    .zoom-val { font-size: 10.5px; font-weight: 800; color: #38bdf8; min-width: 40px; text-align: center; }

    /* Report Sheet Container */
    .wrap {
      padding: 24px 16px 40px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      background: #0f172a;
      min-height: calc(100vh - 55px);
    }

    .sheet-scalable-viewport {
      transition: transform 0.2s ease, width 0.2s ease;
      transform-origin: top center;
      max-width: 100%;
    }

    .sheet {
      width: ${orientation === "landscape" ? "287mm" : "200mm"};
      max-width: 100%;
      min-height: ${orientation === "landscape" ? "200mm" : "287mm"};
      height: auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
      border-radius: 4px;
      padding: 8mm 10mm;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* Letterhead Header */
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 8px;
    }

    .brand-col {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 900;
      font-size: 20px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
    }

    .brand-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand-name {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1.1;
    }

    .brand-tagline {
      font-size: 8.5px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .brand-contact {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.3;
    }

    .title-col {
      text-align: center;
    }

    .report-title-text {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0;
      padding: 4px 12px;
      border-bottom: 2px solid #0284c7;
      display: inline-block;
    }

    .meta-col {
      text-align: ${isRtl ? "left" : "right"};
      font-size: 7.5px;
      color: #475569;
      line-height: 1.45;
    }

    .meta-col b { color: #0f172a; }

    /* Applied scope / filter summary — a clean caption strip, NOT form inputs */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-inline-start: 3px solid #3b82f6;
      border-radius: 4px;
      padding: 5px 10px;
      width: 100%;
    }

    .filter-pill {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      white-space: nowrap;
    }

    .filter-pill-label {
      font-size: 7px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .filter-pill-label::after { content: ":"; }

    .filter-pill-value {
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }

    /* KPI Summary Cards Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
      gap: 6px;
      margin-top: 4px;
      width: 100%;
      max-width: 100%;
    }

    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      text-align: center;
      background: #ffffff;
    }

    .kpi-card.blue { border-color: #93c5fd; background: #eff6ff; }
    .kpi-card.green { border-color: #a7f3d0; background: #ecfdf5; }
    .kpi-card.red { border-color: #fca5a5; background: #fef2f2; }
    .kpi-card.amber { border-color: #fde68a; background: #fffbeb; }

    .kpi-label {
      font-size: 6.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
    }

    .kpi-value {
      font-size: 10px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    /* Tables & Responsive Wrapper */
    .report-table-wrapper {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
    }

    table.data-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      font-size: 7px;
      table-layout: auto;
    }

    /* Density Controls */
    .report-table-wrapper.density-compact table.data-table { font-size: 6.5px; }
    .report-table-wrapper.density-compact table.data-table th { padding: 4px 3px; font-size: 6.2px; }
    .report-table-wrapper.density-compact table.data-table td { padding: 3.5px 3px; }

    .report-table-wrapper.density-dense table.data-table { font-size: 5.5px; }
    .report-table-wrapper.density-dense table.data-table th { padding: 3px 2px; font-size: 5.2px; }
    .report-table-wrapper.density-dense table.data-table td { padding: 2px 2px; }

    .report-table-wrapper.density-normal table.data-table { font-size: 7.5px; }
    .report-table-wrapper.density-normal table.data-table th { padding: 6px 4px; font-size: 7px; }
    .report-table-wrapper.density-normal table.data-table td { padding: 5px 4px; }

    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      padding: 5px 3px;
      border: 1px solid #0f172a;
      text-align: center;
      font-size: 6.5px;
      letter-spacing: 0.2px;
      word-break: break-word;
    }

    table.data-table td {
      padding: 4px 3px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }

    table.data-table tr.total-row td {
      background: #f8fafc;
      font-weight: 900;
      font-size: 7.5px;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
    }

    /* Status Badges */
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 6px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .badge-green { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde047; }
    .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
    .badge-red { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .badge-slate { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

    /* Footer Section */
    .sheet-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 10px;
      border-top: 1.5px solid #cbd5e1;
      width: 100%;
    }

    .footer-content-grid {
      display: grid;
      grid-template-columns: 2fr 3fr 2fr;
      gap: 12px;
      align-items: center;
      width: 100%;
    }

    .footer-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      background: #f8fafc;
      font-size: 7px;
      line-height: 1.4;
    }

    .signatures-row {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      text-align: center;
    }

    .sign-field {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .sign-line {
      width: 100px;
      border-bottom: 1.5px solid #0f172a;
    }

    .sign-title {
      font-size: 7.5px;
      font-weight: 800;
      color: #0f172a;
    }

    .bottom-bar {
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 4px;
      font-size: 7px;
      font-weight: 700;
      border-radius: 4px;
      letter-spacing: 0.5px;
      width: 100%;
    }

    /* Modal for Column Customization */
    .custom-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .custom-modal-content {
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 12px;
      width: 90%;
      max-width: 680px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      overflow: hidden;
    }

    .custom-modal-header {
      padding: 14px 18px;
      background: #1e293b;
      border-b: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 800;
      font-size: 13px;
    }

    .custom-modal-body {
      padding: 16px 18px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .modal-actions-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: #1e293b;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
    }

    .btn-xs {
      background: #334155;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-xs:hover { background: #475569; }
    .btn-amber-xs { background: #d97706; border-color: #d97706; }
    .btn-amber-xs:hover { background: #b45309; }

    .density-select {
      background: #0f172a;
      color: #38bdf8;
      border: 1px solid #334155;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      outline: none;
    }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }

    .col-checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1e293b;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #334155;
      font-size: 11px;
      cursor: pointer;
      user-select: none;
    }
    .col-checkbox-item:hover { border-color: #38bdf8; }

    /* Multi-page & Print Page break handling */
    tr, .kpi-grid, .sheet-footer, .letterhead, .filter-bar {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
      }
      .no-print-toolbar, .custom-modal-overlay { display: none !important; }
      .wrap {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        display: block !important;
        width: 100% !important;
      }
      .sheet-scalable-viewport {
        transform: none !important;
        width: 100% !important;
      }
      .sheet {
        width: 100% !important;
        max-width: none !important;
        min-height: 0 !important;
        height: auto !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        overflow: visible !important;
      }
      .report-table-wrapper {
        overflow-x: visible !important;
      }
      @page {
        size: A4 ${orientation};
        margin: 6mm;
      }
    }
  </style>
  <script>
    let currentZoom = 1.0;

    function setZoom(val) {
      currentZoom = Math.min(2.0, Math.max(0.5, val));
      const viewport = document.getElementById('sheetViewport');
      const valLabel = document.getElementById('zoomVal');
      if (viewport) {
        viewport.style.transform = 'scale(' + currentZoom + ')';
      }
      if (valLabel) {
        valLabel.textContent = Math.round(currentZoom * 100) + '%';
      }
    }

    function zoomIn() { setZoom(currentZoom + 0.1); }
    function zoomOut() { setZoom(currentZoom - 0.1); }
    function resetZoom() { setZoom(1.0); }

    function downloadCsv() {
      const csvRaw = \`${csvData
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\${/g, "\\${")
        .replace(/<\/(script)/gi, "<\\/$1")}\`;
      if (!csvRaw) return alert('No CSV data available');
      // Prepend UTF-8 BOM byte order mark (\uFEFF) so Excel opens multilingual text (Urdu, Arabic, Pashto, Farsi) correctly!
      const blob = new Blob(["\\uFEFF" + csvRaw], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function sendEmail() {
      const subject = encodeURIComponent('${escapeHtml(title)} - ${escapeHtml(compName)}');
      const body = encodeURIComponent('Please find attached official A4 ERP report for ${escapeHtml(title)} from ${escapeHtml(compName)}.\\nDate: ${escapeHtml(printedDate)}\\nPeriod: ${escapeHtml(reportPeriod)}');
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    }

    function sendWhatsApp() {
      const text = encodeURIComponent('📄 *${escapeHtml(title)}*\\nCompany: ${escapeHtml(compName)}\\nDate: ${escapeHtml(printedDate)}\\nPeriod: ${escapeHtml(reportPeriod)}\\nURL: ${escapeHtml(compWebsite)}');
      window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
    }

    function toggleColumnModal() {
      const modal = document.getElementById('columnModal');
      if (modal) {
        modal.style.display = (modal.style.display === 'none' || !modal.style.display) ? 'flex' : 'none';
      }
    }

    function initColumnCustomization() {
      const table = document.querySelector('table.data-table');
      if (!table) return;
      const headers = Array.from(table.querySelectorAll('thead th'));
      const grid = document.getElementById('columnCheckboxesGrid');
      if (!grid) return;
      grid.innerHTML = '';
      headers.forEach((th, idx) => {
        const text = th.innerText.trim() || ('Col ' + (idx + 1));
        const label = document.createElement('label');
        label.className = 'col-checkbox-item';
        label.innerHTML = '<input type="checkbox" checked data-col-idx="' + idx + '" onchange="toggleColumn(' + idx + ', this.checked)"> <span>' + text + '</span>';
        grid.appendChild(label);
      });
    }

    function toggleColumn(colIdx, show) {
      const table = document.querySelector('table.data-table');
      if (!table) return;
      const rows = Array.from(table.querySelectorAll('tr'));
      rows.forEach(tr => {
        const cells = Array.from(tr.children);
        if (cells[colIdx]) {
          cells[colIdx].style.display = show ? '' : 'none';
        }
      });
    }

    function selectAllColumns(show) {
      const checkboxes = document.querySelectorAll('#columnCheckboxesGrid input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = show;
        const idx = parseInt(cb.getAttribute('data-col-idx'), 10);
        toggleColumn(idx, show);
      });
    }

    function resetDefaultColumns() {
      selectAllColumns(true);
      changeFontDensity('compact');
      const select = document.getElementById('fontDensitySelect');
      if (select) select.value = 'compact';
      const toolbarSelect = document.getElementById('toolbarFontDensitySelect');
      if (toolbarSelect) toolbarSelect.value = 'compact';
    }

    function changeFontDensity(mode) {
      const wrapper = document.querySelector('.report-table-wrapper');
      if (!wrapper) return;
      wrapper.classList.remove('density-normal', 'density-compact', 'density-dense');
      wrapper.classList.add('density-' + mode);
      const modalSelect = document.getElementById('fontDensitySelect');
      if (modalSelect) modalSelect.value = mode;
      const toolbarSelect = document.getElementById('toolbarFontDensitySelect');
      if (toolbarSelect) toolbarSelect.value = mode;
    }

    window.addEventListener('DOMContentLoaded', () => {
      initColumnCustomization();
    });
  </script>
</head>
<body>

  <!-- Sticky Screen Action Toolbar -->
  <div class="no-print-toolbar">
    <div class="toolbar-title">
      <span>📄 ${escapeHtml(title)}</span>
      <span style="opacity:0.6; font-size:10px;">| Official A4 PDF Sheet</span>
    </div>
    <div class="toolbar-buttons">
      <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomOut()" title="Zoom Out">&minus;</button>
        <span class="zoom-val" id="zoomVal">100%</span>
        <button class="zoom-btn" onclick="zoomIn()" title="Zoom In">&plus;</button>
        <button class="zoom-btn" onclick="resetZoom()" title="Reset Zoom" style="font-size:10px;">100%</button>
      </div>

      <div class="zoom-controls" style="margin-right:8px;">
        <span style="font-size:10.5px; font-weight:700; color:#94a3b8; margin-right:4px;">Density:</span>
        <select id="toolbarFontDensitySelect" onchange="changeFontDensity(this.value)" class="density-select">
          <option value="normal">Standard (7.5px)</option>
          <option value="compact" selected>Compact (6.5px)</option>
          <option value="dense">Dense (5.5px)</option>
        </select>
      </div>

      <button class="btn-action btn-slate" onclick="toggleColumnModal()">⚙️ Customize Columns</button>
      <button class="btn-action btn-primary" onclick="window.print()">🖨️ Print Report</button>
      <button class="btn-action btn-amber" onclick="window.print()">📄 Save as PDF</button>
      <button class="btn-action btn-success" onclick="downloadCsv()">📊 Export Excel</button>
      <button class="btn-action" onclick="sendEmail()">✉️ Email</button>
      <button class="btn-action" onclick="sendWhatsApp()">💬 WhatsApp</button>
      <button class="btn-action" onclick="window.close()">❌ Close</button>
    </div>
  </div>

  <!-- Interactive Column Customization Modal -->
  <div id="columnModal" class="custom-modal-overlay" style="display:none;">
    <div class="custom-modal-content">
      <div class="custom-modal-header">
        <span>⚙️ Customize Printable Columns & Font Density</span>
        <button onclick="toggleColumnModal()" class="btn-xs" style="background:transparent;border:none;font-size:16px;">&times;</button>
      </div>
      <div class="custom-modal-body">
        <div class="modal-actions-bar">
          <button class="btn-xs" onclick="selectAllColumns(true)">Select All</button>
          <button class="btn-xs" onclick="selectAllColumns(false)">Deselect All</button>
          <button class="btn-xs btn-amber-xs" onclick="resetDefaultColumns()">Reset Default</button>
          <span style="margin-left:auto; font-weight:700;">Font Density:</span>
          <select id="fontDensitySelect" onchange="changeFontDensity(this.value)" class="density-select">
            <option value="normal">Standard (7.5px)</option>
            <option value="compact" selected>Compact Auto-Fit (6.5px)</option>
            <option value="dense">Dense Fit (5.5px)</option>
          </select>
        </div>
        <div id="columnCheckboxesGrid" class="checkbox-grid"></div>
      </div>
    </div>
  </div>

  <div class="wrap">
    <div class="sheet-scalable-viewport" id="sheetViewport">
      <div class="sheet">

        <!-- Letterhead Header -->
        <div class="letterhead">
          <div class="brand-col">
            ${compLogo ? `<img class="brand-logo" src="${escapeHtml(compLogo)}" alt="logo" style="object-fit:contain;background:#fff;" />` : `<div class="brand-logo">⚓</div>`}
            <div class="brand-details">
              <div class="brand-name">${escapeHtml(compName)}</div>
              <div class="brand-tagline">${escapeHtml(compTagline)}</div>
              <div class="brand-contact">
                ${compAddress ? `📍 ${escapeHtml(compAddress)}<br />` : ""}
                ${[
                  compPhone ? `📞 ${escapeHtml(compPhone)}` : "",
                  compEmail ? `✉️ ${escapeHtml(compEmail)}` : "",
                  compWebsite ? `🌐 ${escapeHtml(compWebsite)}` : "",
                ].filter(Boolean).join(" | ")}
              </div>
            </div>
          </div>

          <div class="title-col">
            <h1 class="report-title-text">${escapeHtml(title)}</h1>
            <div style="margin-top:6px;"><img src="${qrSrc}" alt="QR verify" style="width:48px;height:48px;" /><div style="font-size:6px;color:#64748b;">Scan to verify</div></div>
          </div>

          <div class="meta-col">
            ${printedBy ? `<div>Printed By: <b>${escapeHtml(printedBy)}</b></div>` : ""}
            <div>Printed Date: <b>${escapeHtml(printedDate)}</b></div>
            ${isAccounting && financialYear ? `<div>Financial Year: <b>${escapeHtml(financialYear)}</b></div>` : ""}
            <div>Report Period: <b>${escapeHtml(reportPeriod)}</b></div>
          </div>
        </div>

        <!-- Filter Bar -->
        ${filters.length > 0 ? `
        <div class="filter-bar">
          ${filters.map(f => `
            <div class="filter-pill">
              <div class="filter-pill-label">${escapeHtml(f.label)}</div>
              <div class="filter-pill-value">${escapeHtml(f.value)}</div>
            </div>
          `).join("")}
        </div>
        ` : ""}

        <!-- KPI Summary Cards Grid (above the table so the reader sees the headline first) -->
        ${kpis.length > 0 ? `
        <div class="kpi-grid">
          ${kpis.map(k => `
            <div class="kpi-card ${k.color || ""}">
              <div class="kpi-label">${escapeHtml(k.label)}</div>
              <div class="kpi-value">${escapeHtml(k.value)}</div>
            </div>
          `).join("")}
        </div>
        ` : ""}

        <!-- Main Data Table Wrapper -->
        <div class="report-table-wrapper density-compact">
          ${mainTableHtml}
        </div>

        <!-- Sheet Footer & Signatures -->
        <div class="sheet-footer">
          <div class="footer-content-grid">
            <!-- Left Notes -->
            <div class="footer-box">
              ${footerNotesHtml || (isAccounting ? `
                <b>NOTE:</b><br />
                &bull; FC = Foreign Currency, LC = Local Currency<br />
                &bull; Double-entry transaction postings verified.<br />
                &bull; All amounts in selected currencies.
              ` : "")}
            </div>

            <!-- Signatures -->
            <div class="signatures-row">
              <div class="sign-field">
                <div class="sign-line"></div>
                <div class="sign-title">Prepared By</div>
              </div>
              <div class="sign-field">
                <div class="sign-line"></div>
                <div class="sign-title">Checked By</div>
              </div>
              <div class="sign-field">
                <div class="sign-line"></div>
                <div class="sign-title">Approved By</div>
              </div>
            </div>

            <!-- Right Legend -->
            <div class="footer-box text-right">
              ${legendHtml || `
                <b>REPORT STATUS:</b><br />
                Official ERP System Generated Sheet
              `}
            </div>
          </div>

          <div class="bottom-bar">
            ${escapeHtml(compName)} &mdash; Official ERP System Generated Document
          </div>
        </div>

      </div>
    </div>
  </div>

</body>
</html>`;
}
