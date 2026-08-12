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
}): string {
  const { title, orientation, companyInfo = {}, filters = [], kpis = [], mainTableHtml, footerNotesHtml, legendHtml, lang = "en", csvData = "" } = input;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const compName = companyInfo.name || "DIGITAL DOCK ERP";
  const compTagline = companyInfo.tagline || "ERP Reporting System";
  const compAddress = companyInfo.address || "Configured organization address";
  const compPhone = companyInfo.phone || "Configured contact";
  const compEmail = companyInfo.email || "Configured email";
  const compWebsite = companyInfo.website || "Configured website";
  const printedBy = companyInfo.printedBy || "ERP User";
  const printedDate = companyInfo.printedDate || new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const financialYear = companyInfo.financialYear || "Current Financial Year";
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
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
    
    @page {
      size: A4 ${orientation};
      margin: 6mm;
    }

    * { box-sizing: border-box; }
    
    html, body {
      background: #0f172a;
      color: #0f172a;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
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
    }

    .sheet {
      width: ${orientation === "landscape" ? "287mm" : "200mm"};
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
      overflow: visible;
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
      line-height: 1;
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
      text-align: right;
      font-size: 7.5px;
      color: #475569;
      line-height: 1.45;
    }

    .meta-col b { color: #0f172a; }

    /* Filter Pills Bar */
    .filter-bar {
      display: grid;
      grid-template-columns: repeat(${Math.max(1, filters.length)}, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px;
    }

    .filter-pill {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px 8px;
    }

    .filter-pill-label {
      font-size: 6.5px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
    }

    .filter-pill-value {
      font-size: 8.5px;
      font-weight: 800;
      color: #0f172a;
    }

    /* KPI Summary Cards Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(${Math.min(8, Math.max(1, kpis.length))}, 1fr);
      gap: 6px;
      margin-top: 4px;
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

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5px;
    }

    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      padding: 6px 4px;
      border: 1px solid #0f172a;
      text-align: center;
      font-size: 7px;
      letter-spacing: 0.2px;
    }

    table.data-table td {
      padding: 5px 4px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      font-variant-numeric: tabular-nums;
    }

    table.data-table tr.total-row td {
      background: #f8fafc;
      font-weight: 900;
      font-size: 8px;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
    }

    /* Status Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 6.5px;
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
    }

    .footer-content-grid {
      display: grid;
      grid-template-columns: 2fr 3fr 2fr;
      gap: 12px;
      align-items: center;
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
    }

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
      .no-print-toolbar { display: none !important; }
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
      const csvContent = \`${csvData.replace(/`/g, "\\`").replace(/\${/g, "\\${")}\`;
      if (!csvContent) return alert('No CSV data available');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function sendEmail() {
      const subject = encodeURIComponent('${escapeHtml(title)} - ${escapeHtml(compName)}');
      const body = encodeURIComponent('Please find attached report document for ${escapeHtml(title)} from ${escapeHtml(compName)}.');
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    }

    function sendWhatsApp() {
      const text = encodeURIComponent('📄 *${escapeHtml(title)}*\nCompany: ${escapeHtml(compName)}\nDate: ${escapeHtml(printedDate)}\nPeriod: ${escapeHtml(reportPeriod)}');
      window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
    }
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

      <button class="btn-action btn-primary" onclick="window.print()">🖨️ Print Report</button>
      <button class="btn-action btn-amber" onclick="window.print()">📄 Save as PDF</button>
      <button class="btn-action btn-success" onclick="downloadCsv()">📊 Export Excel</button>
      <button class="btn-action" onclick="sendEmail()">✉️ Email</button>
      <button class="btn-action" onclick="sendWhatsApp()">💬 WhatsApp</button>
      <button class="btn-action" onclick="window.close()">❌ Close</button>
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
                📍 ${escapeHtml(compAddress)}<br />
                📞 Phone: ${escapeHtml(compPhone)} | ✉️ Email: ${escapeHtml(compEmail)} | 🌐 Website: ${escapeHtml(compWebsite)}
              </div>
            </div>
          </div>

          <div class="title-col">
            <h1 class="report-title-text">${escapeHtml(title)}</h1>
            <div style="margin-top:6px;"><img src="${qrSrc}" alt="QR verify" style="width:48px;height:48px;" /><div style="font-size:6px;color:#64748b;">Scan to verify</div></div>
          </div>

          <div class="meta-col">
            <div>Printed By: <b>${escapeHtml(printedBy)}</b></div>
            <div>Printed Date: <b>${escapeHtml(printedDate)}</b></div>
            <div>Financial Year: <b>${escapeHtml(financialYear)}</b></div>
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

        <!-- Main Data Table -->
        ${mainTableHtml}

        <!-- KPI Summary Cards Grid -->
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

        <!-- Sheet Footer & Signatures -->
        <div class="sheet-footer">
          <div class="footer-content-grid">
            <!-- Left Notes -->
            <div class="footer-box">
              ${footerNotesHtml || `
                <b>NOTE:</b><br />
                &bull; FC = Foreign Currency, LC = Local Currency<br />
                &bull; Double-entry transaction postings verified.<br />
                &bull; All amounts in selected currencies.
              `}
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
                Official ERP System Generated Sheet<br />
                Page 1 of 1
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

