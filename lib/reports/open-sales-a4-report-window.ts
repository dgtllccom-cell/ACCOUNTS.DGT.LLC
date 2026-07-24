import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type SalesReportData = {
  id: string;
  salesBookingOrderNumber: string;
  salesDate: string;
  bookingDate: string;
  salesAccountName: string;
  salesAccountNumber: string;
  purchaseAccountName: string;
  purchaseAccountNumber: string;
  supplierName: string;
  customerName: string;
  productName: string;
  goodsDescription: string;
  quantity: number;
  unit: string;
  totalWeight: number;
  containerCount: number;
  salesRate: number;
  totalSalesAmount: number;
  currency: string;
  finalCurrency?: string;
  status: string;
  currentStep?: string;
  nextStep?: string;
  paymentStatus: string;
  containerStatus?: string;
  deliveryStatus?: string;
  branchName: string;
  countryName: string;
  createdAt: string;
  totalGrossWeight?: number;
  totalNetWeight?: number;
  salesAmount?: number;
  finalAmount?: number;
  form_data?: any;
  audit: {
    userName: string;
    userId: string;
    branchCode: string;
  };
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function openSalesA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
  salesData: SalesReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const now = new Date();
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const b = input.salesData;
  const form = b.form_data?.form || {};
  const goods = b.form_data?.goodsEntries || [];

  let items: any[] = [];
  if (goods.length > 0) {
    items = goods.map((g: any, index: number) => {
      const qtyNo = Number(g.qtyNo || 0);
      const qtyKgs = Number(g.qtyKgs || 0);
      const grossWt = qtyNo * qtyKgs;
      const rate = Number(g.coursePrice || 0);
      const totalAmount = qtyNo * rate;
      return {
        index: index + 1,
        goodsName: g.goodsName || "-",
        size: g.size || "-",
        brand: g.brand || "-",
        origin: g.origin || "-",
        hsCode: g.hsCode || "-",
        qtyNo,
        qtyName: g.qtyName || "BAGS",
        grossWeight: g.grossWeight || grossWt,
        netWeight: g.netWeight || grossWt,
        rate,
        totalAmount
      };
    });
  } else {
    items = [{
      index: 1,
      goodsName: b.productName || b.goodsDescription || "-",
      size: form.size || "-",
      brand: form.brand || "-",
      origin: b.countryName || "-",
      hsCode: form.hsCode || "-",
      qtyNo: b.quantity || 0,
      qtyName: b.unit || "BAGS",
      grossWeight: b.totalWeight || 0,
      netWeight: b.totalWeight || 0,
      rate: b.salesRate || 0,
      totalAmount: b.totalSalesAmount || 0
    }];
  }

  const reportsTitle = escapeHtml(input.title);
  const reportsSubtitle = escapeHtml(input.subtitle || "DGT Sales Console Registry");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8">
      <title>${reportsTitle} — ${escapeHtml(b.salesBookingOrderNumber)}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 10.5px;
          line-height: 1.45;
          color: #1e293b;
          margin: 0;
          padding: 0;
          background: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }
        .header-title {
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
        }
        .header-subtitle {
          font-size: 10px;
          color: #64748b;
          margin-top: 2px;
        }
        .meta-grid {
          display: grid;
          grid-template-cols: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .meta-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .meta-title {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .meta-row:last-child {
          margin-bottom: 0;
        }
        .meta-label {
          color: #64748b;
          font-weight: 500;
        }
        .meta-value {
          font-weight: 700;
          color: #0f172a;
        }
        table.items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          margin-bottom: 20px;
        }
        table.items-table th {
          background: #0f172a;
          color: #fff;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 8.5px;
          padding: 6px 8px;
          border: 1px solid #0f172a;
          text-align: left;
        }
        table.items-table td {
          padding: 7px 8px;
          border: 1px solid #e2e8f0;
        }
        table.items-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .text-right {
          text-align: right !important;
        }
        .totals-card {
          display: flex;
          justify-content: flex-end;
          margin-top: 15px;
        }
        .totals-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          width: 250px;
          padding: 8px 12px;
          background: #f1f5f9;
        }
        .grand-total {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          border-top: 2px solid #cbd5e1;
          margin-top: 6px;
          padding-top: 6px;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="header-title">${reportsTitle}</div>
          <div class="header-subtitle">${reportsSubtitle}</div>
        </div>
        <div class="text-right">
          <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${escapeHtml(b.salesBookingOrderNumber)}</div>
          <div style="font-size: 9px; color: #64748b; font-weight: 600;">DATE: ${formatDate(b.salesDate)}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-title">Customer Account (DR)</div>
          <div class="meta-row"><span class="meta-label">Buyer Name:</span><span class="meta-value">${escapeHtml(b.customerName)}</span></div>
          <div class="meta-row"><span class="meta-label">Account No:</span><span class="meta-value">${escapeHtml(b.purchaseAccountNumber || form.customerAccountNo || "-")}</span></div>
          <div class="meta-row"><span class="meta-label">Ledger Acc:</span><span class="meta-value">${escapeHtml(b.purchaseAccountName || form.customerAccountName || "-")}</span></div>
        </div>
        <div class="meta-card">
          <div class="meta-title">Sales Account (CR)</div>
          <div class="meta-row"><span class="meta-label">Account No:</span><span class="meta-value">${escapeHtml(b.salesAccountNumber || form.salesAccountNo || "-")}</span></div>
          <div class="meta-row"><span class="meta-label">Ledger Acc:</span><span class="meta-value">${escapeHtml(b.salesAccountName || form.salesAccountName || "-")}</span></div>
          <div class="meta-row"><span class="meta-label">Company:</span><span class="meta-value">${escapeHtml(form.salesCompanyName || "-")}</span></div>
        </div>
        <div class="meta-card">
          <div class="meta-title">Logistics & Scope</div>
          <div class="meta-row"><span class="meta-label">Country:</span><span class="meta-value">${escapeHtml(b.countryName || form.branchCountry || "-")}</span></div>
          <div class="meta-row"><span class="meta-label">Branch Scope:</span><span class="meta-value">${escapeHtml(b.branchName || form.branchName || "-")}</span></div>
          <div class="meta-row"><span class="meta-label">Contract / SO:</span><span class="meta-value">${escapeHtml(b.sales_contract_no || form.salesContractNo || "-")}</span></div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 35%;">Goods Description</th>
            <th style="width: 10%;">Origin</th>
            <th style="width: 10%;">Brand</th>
            <th style="width: 10%;" class="text-right">Qty</th>
            <th style="width: 15%;" class="text-right">Rate</th>
            <th style="width: 15%;" class="text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `
            <tr>
              <td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">No items entered.</td>
            </tr>
          ` : items.map(item => `
            <tr>
              <td>${item.index}</td>
              <td><strong>${escapeHtml(item.goodsName)}</strong> (${escapeHtml(item.size)})</td>
              <td>${escapeHtml(item.origin)}</td>
              <td>${escapeHtml(item.brand)}</td>
              <td class="text-right">${formatNumber(item.qtyNo)} ${escapeHtml(item.qtyName)}</td>
              <td class="text-right">${formatMoney(item.rate)} ${escapeHtml(b.currency)}</td>
              <td class="text-right" style="font-weight: 700;">${formatMoney(item.totalAmount)} ${escapeHtml(b.currency)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="totals-card">
        <div class="totals-box">
          <div class="meta-row"><span class="meta-label">Total Qty:</span><span class="meta-value">${formatNumber(b.quantity)} ${escapeHtml(b.unit)}</span></div>
          <div class="meta-row"><span class="meta-label">Exchange Rate:</span><span class="meta-value">${formatNumber(b.exchange_rate)}</span></div>
          <div class="grand-total meta-row">
            <span>Sales Total:</span>
            <span>${formatMoney(b.totalSalesAmount)} ${escapeHtml(b.currency)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <div>Registered User: ${escapeHtml(b.audit.userName)} (Code: ${escapeHtml(b.audit.branchCode)})</div>
        <div>Generated via Damaan ERP: ${formatDate(now.toISOString())} • ${stampTime}</div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=800,height=1000");
  if (!printWindow) {
    alert("Popup blocked! Please allow popups for printing reports.");
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  if (input.autoPrint) {
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}
