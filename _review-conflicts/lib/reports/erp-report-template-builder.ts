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
  const compTagline = companyInfo.tagline || "Import | Export | Trading | ERP Solutions";
  const compAddress = companyInfo.address || "Office No. 1, 1st Floor, Idat Plaza, Doctor Bano Road, Quetta, Pakistan";
  const compPhone = companyInfo.phone || "+92 333 7764008";
  const compEmail = companyInfo.email || "najib@dgt.llc";
  const compWebsite = companyInfo.website || "www.dgtllc.com";
  const printedBy = companyInfo.printedBy || "SUPER ADMIN";
  const printedDate = companyInfo.printedDate || new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const financialYear = companyInfo.financialYear || "2025 - 2026";
  const reportPeriod = companyInfo.reportPeriod || `Jul 01, 2026 To ${formatDate(new Date().toISOString())}`;

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
    
    body {
      background: #f1f5f9;
      color: #0f172a;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 8.5px;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Screen Toolbar */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 11px;
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
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-action:hover { background: #334155; }
    .btn-primary { background: #2563eb; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-success { background: #059669; border-color: #059669; }
    .btn-success:hover { background: #047857; }

    /* Report Sheet Container */
    .wrap {
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .sheet {
      width: ${orientation === "landscape" ? "285mm" : "198mm"};
      min-height: ${orientation === "landscape" ? "198mm" : "285mm"};
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      padding: 8mm;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
    }

    /* Letterhead Header */
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
    }

    .brand-col {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .brand-logo {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 900;
      font-size: 18px;
    }

    .brand-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand-name {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1;
    }

    .brand-tagline {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
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
    }

    .meta-col {
      text-align: right;
      font-size: 7.5px;
      color: #475569;
      line-height: 1.4;
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
    }

    table.data-table tr.bg-highlight-red {
      background: #fef2f2;
      color: #b91c1c;
      font-weight: 700;
    }

    table.data-table tr.bg-highlight-green {
      background: #f0fdf4;
      color: #15803d;
    }

    table.data-table tr.bg-highlight-amber {
      background: #fffbebf0;
      color: #b45309;
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
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
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

    @media print {
      body { background: #ffffff; }
      .no-print-toolbar { display: none !important; }
      .wrap { padding: 0; }
      .sheet {
        width: 100% !important;
        min-height: 100vh !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      @page { margin: 6mm; }
    }
  </style>
  <script>
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
    <div>
      <strong>📄 ${escapeHtml(title)}</strong> &mdash; Official ERP Print Sheet
    </div>
    <div class="toolbar-buttons">
      <button class="btn-action btn-primary" onclick="window.print()">🖨️ Print Report</button>
      <button class="btn-action btn-primary" onclick="window.print()">📄 Save as PDF</button>
      <button class="btn-action btn-success" onclick="downloadCsv()">📊 Export Excel</button>
      <button class="btn-action" onclick="sendEmail()">✉️ Email</button>
      <button class="btn-action" onclick="sendWhatsApp()">💬 WhatsApp</button>
      <button class="btn-action" onclick="window.close()">❌ Close</button>
    </div>
  </div>

  <div class="wrap">
    <div class="sheet">

      <!-- Letterhead Header -->
      <div class="letterhead">
        <div class="brand-col">
          <div class="brand-logo">⚓</div>
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
          Digital Dock ERP &mdash; Smart Business, Strong Future
        </div>
      </div>

    </div>
  </div>

</body>
</html>`;
}
