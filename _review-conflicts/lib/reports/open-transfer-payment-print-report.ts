import { generateReportHtml, escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";

export type TransferPaymentRecord = {
  id: string;
  voucherNo: string;
  billNo: string;
  transferDate: string;
  supplierName: string;
  supplierAccountNo?: string;
  branchName: string;
  countryName: string;
  goodsName: string;
  paymentMode: string;
  bankOrCashAccount: string;
  amountFc?: number;
  currencyFc?: string;
  exchangeRate?: number;
  amountLc: number;
  currencyLc?: string;
  amountInWords?: string;
  purchaseAccountNo: string;
  salesAccountNo?: string;
  narration?: string;
  userFullName?: string;
};

export function openTransferPaymentPrintReport(input: {
  record: TransferPaymentRecord;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { record: r, companyInfo = {}, lang = "en" } = input;
  const currencyLc = r.currencyLc || "AED";
  const currencyFc = r.currencyFc || "USD";

  const mainTableHtml = `
    <!-- Voucher Information Box -->
    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; margin-bottom: 12px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 8.5px;">
        <div><strong>Voucher No:</strong> <span style="font-family: monospace; font-weight: 900; color: #1e3a8a;">${escapeHtml(r.voucherNo || r.billNo)}</span></div>
        <div><strong>Transfer Date:</strong> <span>${formatDate(r.transferDate)}</span></div>
        <div><strong>Payment Mode:</strong> <span style="font-weight: 800; color: #059669;">${escapeHtml(r.paymentMode || "Bank Transfer")}</span></div>

        <div><strong>Supplier / Party:</strong> <span>${escapeHtml(r.supplierName)}</span></div>
        <div><strong>Supplier Account:</strong> <span style="font-family: monospace;">${escapeHtml(r.supplierAccountNo || r.purchaseAccountNo)}</span></div>
        <div><strong>Branch / Location:</strong> <span>${escapeHtml(r.branchName)}, ${escapeHtml(r.countryName)}</span></div>

        <div><strong>Goods Description:</strong> <span>${escapeHtml(r.goodsName)}</span></div>
        <div><strong>Bank / Cash Account:</strong> <span>${escapeHtml(r.bankOrCashAccount)}</span></div>
        <div><strong>Created By:</strong> <span>${escapeHtml(r.userFullName || companyInfo.printedBy || "SUPER ADMIN")}</span></div>
      </div>
    </div>

    <!-- Amount Banner Box -->
    <div style="border: 2px solid #059669; border-radius: 6px; padding: 12px; background: #ecfdf5; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 7.5px; font-weight: 800; color: #047857; text-transform: uppercase;">TRANSFER PAYMENT AMOUNT IN WORDS</div>
        <div style="font-size: 11px; font-weight: 900; color: #065f46; margin-top: 2px; font-style: italic;">
          "${escapeHtml(r.amountInWords || `${r.amountLc.toLocaleString()} ${currencyLc} ONLY`)}"
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 7.5px; font-weight: 800; color: #047857; text-transform: uppercase;">TOTAL PAID (LC)</div>
        <div style="font-size: 16px; font-weight: 900; color: #047857; font-family: monospace;">
          ${formatMoney(r.amountLc, currencyLc)}
        </div>
        ${r.amountFc ? `<div style="font-size: 8.5px; color: #475569;">(${formatMoney(r.amountFc, currencyFc)} @ ${r.exchangeRate || 1})</div>` : ""}
      </div>
    </div>

    <!-- General Ledger Double-Entry Posting Table -->
    <div style="margin-bottom: 12px;">
      <h3 style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 4px;">
        ⚙️ GENERAL LEDGER DOUBLE-ENTRY POSTING VOUCHER
      </h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Entry Type</th>
            <th>Account Code</th>
            <th>Account Description / Title</th>
            <th>Debit (DR)</th>
            <th>Credit (CR)</th>
            <th>Currency</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 900; color: #2563eb; text-align: center;">DEBIT (DR)</td>
            <td style="font-family: monospace; font-weight: 800; text-align: center;">${escapeHtml(r.purchaseAccountNo)}</td>
            <td>
              <strong>${escapeHtml(r.supplierName)} (Purchase Account)</strong>
              <span style="display: block; font-size: 6.5px; color: #64748b;">${escapeHtml(r.branchName)} Branch Ledger</span>
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #2563eb;">
              ${formatMoney(r.amountLc, currencyLc)}
            </td>
            <td style="text-align: center; color: #94a3b8;">-</td>
            <td style="text-align: center; font-weight: 800;">${currencyLc}</td>
          </tr>
          <tr>
            <td style="font-weight: 900; color: #059669; text-align: center;">CREDIT (CR)</td>
            <td style="font-family: monospace; font-weight: 800; text-align: center;">${escapeHtml(r.salesAccountNo || "1010-CASH")}</td>
            <td>
              <strong>${escapeHtml(r.bankOrCashAccount)} (Bank / Cash Account)</strong>
              <span style="display: block; font-size: 6.5px; color: #64748b;">Financial Settlement Account</span>
            </td>
            <td style="text-align: center; color: #94a3b8;">-</td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #059669;">
              ${formatMoney(r.amountLc, currencyLc)}
            </td>
            <td style="text-align: center; font-weight: 800;">${currencyLc}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Narration Box -->
    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff; margin-bottom: 12px;">
      <strong style="font-size: 8px; color: #475569; text-transform: uppercase;">NARRATION / TRANSFER REMARKS:</strong>
      <p style="font-size: 8.5px; margin: 4px 0 0 0; color: #0f172a;">
        ${escapeHtml(r.narration || `Transfer payment settled for Purchase Booking ${r.billNo} under ${r.branchName} branch.`)}
      </p>
    </div>
  `;

  const kpis = [
    { label: "VOUCHER REFERENCE", value: r.voucherNo || r.billNo, color: "blue" as const },
    { label: "PAYMENT MODE", value: r.paymentMode || "Bank Transfer", color: "green" as const },
    { label: "AMOUNT PAID (LC)", value: `${formatMoney(r.amountLc, currencyLc)}`, color: "green" as const },
    { label: "AMOUNT PAID (FC)", value: r.amountFc ? `${formatMoney(r.amountFc, currencyFc)}` : "N/A", color: "blue" as const }
  ];

  const html = generateReportHtml({
    title: "PURCHASE TRANSFER PAYMENT VOUCHER",
    orientation: "portrait",
    companyInfo,
    kpis,
    mainTableHtml,
    footerNotesHtml: `
      <b>PAYMENT VERIFICATION:</b><br />
      &bull; Payment voucher processed and posted to General Ledger.<br />
      &bull; Bank settlement reference recorded.<br />
      &bull; Document requires authorized finance signatures.
    `,
    lang
  });

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
