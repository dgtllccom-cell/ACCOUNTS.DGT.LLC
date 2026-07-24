import { printStore } from "@/lib/store/print-store";

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

export type TradeDocType = "contract" | "proforma" | "commercial" | "packing";

export function openTradeDocumentWindow(type: TradeDocType, b: any) {
  if (typeof window === "undefined") return;

  const form = b.form_data?.form || {};
  const goods = b.form_data?.goodsEntries || [];

  // Metadata
  const bookingNo = b.purchaseBookingOrderNumber || form.purchaseOrderNo || form.purchaseContractNo || b.purchaseContractNo || "N/A";
  const date = b.purchaseDate || form.purchaseDate || b.bookingDate || new Date().toISOString().slice(0, 10);
  const currency = form.currencyType || b.currency || "USD";
  const paymentType = form.paymentType || b.paymentStatus || "Advance Payment";
  const shippingMode = form.shippingMode || "By Sea";
  const portLoading = form.loadingPort || form.loadingBorder || form.airportName || "N/A";
  const loadingCountry = form.loadingCountry || "N/A";
  const loadingDate = form.loadingDate ? formatDate(form.loadingDate) : "N/A";
  const portDischarge = form.receivedPort || form.receivedBorder || form.receivedPortName || "N/A";
  const receivedCountry = form.receivedCountry || "N/A";
  const receivedDate = form.receivedDate ? formatDate(form.receivedDate) : "N/A";
  const containerSize = form.containerSize || b.containerSize || "40 FT";
  const containerNumbers = form.containerNumbers || b.containerNumbers || "N/A";

  const deliveryTerms = form.paymentDaysAndMethodDetails || form.deliveryTerms || "FOB Karachi";
  const remarks = form.remarks || b.remarks || "";
  const notes = form.orderReportRemarks || form.purchaseReportRemarks || form.purchaseInvoiceRemarks || "";
  const branch = b.branchName || form.branchName || "Main Branch";
  const country = b.countryName || form.branchCountry || "Pakistan";

  // Parties Info
  const buyer = b.buyerName || form.customerName || "DAMAAN TRADING LLC";
  const buyerContact = form.customerContact || "+971-4-2399990";
  const buyerEmail = form.customerEmail || "imports@damaantrading.com";
  const buyerTaxId = form.customerTaxId || "TAX-DXB-99831";
  const buyerAddress = form.customerAddress || "Head Office Suite 402, Trade Tower, Dubai, UAE";

  const seller = b.supplierName || form.supplierName || "KABUL DRY FRUITS WHOLESALE LTD";
  const sellerContact = form.supplierMobile || form.supplierContact || form.purchaseContact || b.supplierMobile || "+93-700-123456";
  const sellerEmail = form.supplierEmail || "sales@kabuldryfruits.af";
  const sellerTaxId = form.supplierTaxId || "TAX-KBL-88741";
  const sellerAddress = form.supplierAddress || "Dry Fruits Wholesale Market Complex, Kabul, Afghanistan";

  // Ledger Accounts
  const purchaseAccountNo = b.purchaseAccountNumber || form.purchaseAccountNumber || "PA-1001";
  const purchaseAccountName = b.purchaseAccountName || form.purchaseAccountName || "Kabul Dry Fruits Purchase Account";
  const salesAccountNo = b.salesAccountNumber || form.salesAccountNumber || "SA-2001";
  const salesAccountName = b.salesAccountName || form.salesAccountName || "Damaan Sales Account";

  // Parse Goods entries
  let items = [];
  if (goods.length > 0) {
    items = goods.map((g: any) => ({
      productName: g.goodsName,
      brand: g.brand || "N/A",
      size: g.size || "N/A",
      code: g.hsCode || g.chsCode || "N/A",
      quantity: Number(g.qtyNo || 0),
      unit: g.qtyName || "BAGS",
      rate: Number(g.coursePrice || 0),
      amount: Number(g.finalAmount || g.totalAmount || 0),
      netWeight: Number(g.netWeight || 0),
      grossWeight: Number(g.grossWeight || 0),
      packing: `${g.qtyNo} ${g.qtyName} of ${g.qtyKgs} KGs`
    }));
  } else {
    items = [{
      productName: b.productName || "WALNUT KERNEL",
      brand: "Premium",
      size: "20/22",
      code: "0802.32",
      quantity: Number(b.quantity || 500),
      unit: b.unit || "BAGS",
      rate: Number(b.purchaseRate || 250),
      amount: Number(b.totalPurchaseAmount || 125000),
      netWeight: Number(b.totalWeight || 25000),
      grossWeight: Number(b.totalWeight || 25000) * 1.05,
      packing: `${b.quantity || 500} ${b.unit || "BAGS"}`
    }];
  }

  const grandTotalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalNetWeight = items.reduce((sum, item) => sum + item.netWeight, 0);
  const totalGrossWeight = items.reduce((sum, item) => sum + item.grossWeight, 0);

  // Document specific text/titles
  let docTitle = "";
  let docPrefix = "";
  let badgeColor = "";

  if (type === "contract") {
    docTitle = "PURCHASE CONTRACT";
    docPrefix = "PC-";
    badgeColor = "#1e3a8a"; // Navy
  } else if (type === "proforma") {
    docTitle = "PROFORMA INVOICE";
    docPrefix = "PI-";
    badgeColor = "#b45309"; // Amber
  } else if (type === "commercial") {
    docTitle = "COMMERCIAL INVOICE";
    docPrefix = "CI-";
    badgeColor = "#0d9488"; // Teal
  } else if (type === "packing") {
    docTitle = "PACKING LIST";
    docPrefix = "PL-";
    badgeColor = "#4f46e5"; // Indigo
  }

  const docNo = `${docPrefix}${bookingNo}`;

  // Common Header HTML
  const headerHtml = `
    <table class="header-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="logo-title">
            <div class="logo-icon" style="background: ${badgeColor};">🌐</div>
            <div>
              <div class="logo-text">${escapeHtml(buyer)}</div>
              <div class="logo-subtext">INTERNATIONAL DRY FRUIT & COMMODITIES DIVISION</div>
              <div class="logo-subtext">Branch: ${escapeHtml(branch)} • ${escapeHtml(country)}</div>
            </div>
          </div>
        </td>
        <td style="width: 45%; text-align: right; vertical-align: top;">
          <div class="doc-meta-box">
            <h1 class="doc-type-title" style="color: ${badgeColor};">${docTitle}</h1>
            <div class="meta-row"><span class="meta-lbl">Document No:</span> <strong class="font-mono" style="color: ${badgeColor};">${escapeHtml(docNo)}</strong></div>
            <div class="meta-row"><span class="meta-lbl">Date:</span> <strong>${formatDate(date)}</strong></div>
            <div class="meta-row"><span class="meta-lbl">Booking Ref:</span> <span class="font-mono">${escapeHtml(bookingNo)}</span></div>
          </div>
        </td>
      </tr>
    </table>
  `;

  // Step 1: Parties Info
  const stepPartiesHtml = `
    <div class="step-container">
      <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
        <span class="step-badge" style="background: ${badgeColor};">STEP 1</span>
        <span class="step-title" style="color: ${badgeColor};">TRADE PARTIES INFORMATION</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
        <div class="address-box">
          <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">BUYER / CUSTOMER</div>
          <strong style="color: #0f172a; display: block; margin-bottom: 4px; font-size: 9.5px;">${escapeHtml(buyer)}</strong>
          <div>Address: ${escapeHtml(buyerAddress)}</div>
          <div>Contact: ${escapeHtml(buyerContact)}</div>
          <div>Email: ${escapeHtml(buyerEmail)}</div>
          <div style="margin-top: 4px;"><span class="font-semibold text-slate-500">Tax Registration ID:</span> <span class="font-mono">${escapeHtml(buyerTaxId)}</span></div>
        </div>
        <div class="address-box">
          <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">SELLER / SUPPLIER</div>
          <strong style="color: #0f172a; display: block; margin-bottom: 4px; font-size: 9.5px;">${escapeHtml(seller)}</strong>
          <div>Address: ${escapeHtml(sellerAddress)}</div>
          <div>Contact: ${escapeHtml(sellerContact)}</div>
          <div>Email: ${escapeHtml(sellerEmail)}</div>
          <div style="margin-top: 4px;"><span class="font-semibold text-slate-500">Tax Registration ID:</span> <span class="font-mono">${escapeHtml(sellerTaxId)}</span></div>
        </div>
      </div>
    </div>
  `;

  // Step 2: Ledger Accounts & Payment Terms
  const stepAccountsHtml = `
    <div class="step-container">
      <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
        <span class="step-badge" style="background: ${badgeColor};">STEP 2</span>
        <span class="step-title" style="color: ${badgeColor};">LEDGER REGISTRY & FINANCIAL TERMS</span>
      </div>
      <div class="financials-grid" style="margin-top: 10px;">
        <div class="fin-card">
          <span class="fin-lbl">Purchase Account (Debit)</span>
          <div class="fin-val font-mono" style="color: ${badgeColor};">${escapeHtml(purchaseAccountNo)}</div>
          <span class="fin-sub">${escapeHtml(purchaseAccountName)}</span>
        </div>
        <div class="fin-card">
          <span class="fin-lbl">Sales Account (Credit)</span>
          <div class="fin-val font-mono" style="color: ${badgeColor};">${escapeHtml(salesAccountNo)}</div>
          <span class="fin-sub">${escapeHtml(salesAccountName)}</span>
        </div>
        <div class="fin-card">
          <span class="fin-lbl">Settlement Currency</span>
          <div class="fin-val">${escapeHtml(currency)}</div>
          <span class="fin-sub">Global Forex Terms</span>
        </div>
        <div class="fin-card">
          <span class="fin-lbl">Payment Mode</span>
          <div class="fin-val" style="font-size: 10.5px;">${escapeHtml(paymentType)}</div>
          <span class="fin-sub">Incoterms Agreement</span>
        </div>
      </div>
    </div>
  `;

  // Step 3: Specifications & Description of Goods Table
  let tableHtml = "";
  if (type === "packing") {
    tableHtml = `
      <div class="step-container">
        <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
          <span class="step-badge" style="background: ${badgeColor};">STEP 3</span>
          <span class="step-title" style="color: ${badgeColor};">CARGO QUANTITY & PACKING SPECIFICATIONS</span>
        </div>
        <table class="items-table" style="margin-top: 10px;">
          <thead>
            <tr style="background: #0f172a;">
              <th style="width: 5%; text-align: center;">S.No</th>
              <th style="width: 30%;">Goods Name</th>
              <th style="width: 15%;">Brand Name</th>
              <th style="width: 15%;">Size Spec.</th>
              <th style="width: 15%; text-align: right;">Packages (Bags/Ctn)</th>
              <th style="width: 10%; text-align: right;">Net Wt (KGs)</th>
              <th style="width: 10%; text-align: right;">Gross Wt (KGs)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>
                  <strong style="color: #0f172a; font-size: 9px;">${escapeHtml(item.productName)}</strong>
                  <span class="item-desc">HS Code: ${escapeHtml(item.code)}</span>
                </td>
                <td class="font-semibold">${escapeHtml(item.brand)}</td>
                <td class="font-semibold text-amber-700">${escapeHtml(item.size)}</td>
                <td style="text-align: right;" class="font-mono font-bold">${formatNumber(item.quantity)} ${escapeHtml(item.unit)}</td>
                <td style="text-align: right;" class="font-mono">${formatNumber(item.netWeight)} KG</td>
                <td style="text-align: right;" class="font-mono">${formatNumber(item.grossWeight)} KG</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="4" style="text-align: right; font-weight: 850;">TOTAL GRAND AGGREGATE</td>
              <td style="text-align: right;">${formatNumber(totalQuantity)} Units</td>
              <td style="text-align: right;">${formatNumber(totalNetWeight)} KG</td>
              <td style="text-align: right;">${formatNumber(totalGrossWeight)} KG</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else {
    tableHtml = `
      <div class="step-container">
        <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
          <span class="step-badge" style="background: ${badgeColor};">STEP 3</span>
          <span class="step-title" style="color: ${badgeColor};">DESCRIPTION & FINANCIAL VALUE OF GOODS</span>
        </div>
        <table class="items-table" style="margin-top: 10px;">
          <thead>
            <tr style="background: #0f172a;">
              <th style="width: 5%; text-align: center;">S.No</th>
              <th style="width: 25%;">Goods Name & HS Code</th>
              <th style="width: 12%;">Brand Name</th>
              <th style="width: 10%;">Size Spec.</th>
              <th style="width: 12%; text-align: right;">Quantity (Units)</th>
              <th style="width: 10%; text-align: right;">Net Wt (KG)</th>
              <th style="width: 10%; text-align: right;">Gross Wt (KG)</th>
              <th style="width: 8%; text-align: right;">Rate / unit</th>
              <th style="width: 8%; text-align: right;">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>
                  <strong style="color: #0f172a; font-size: 9px;">${escapeHtml(item.productName)}</strong>
                  <span class="item-desc">HS Code: ${escapeHtml(item.code)}</span>
                </td>
                <td class="font-semibold text-slate-800">${escapeHtml(item.brand)}</td>
                <td class="font-semibold text-amber-700">${escapeHtml(item.size)}</td>
                <td style="text-align: right;" class="font-mono font-bold">${formatNumber(item.quantity)} ${escapeHtml(item.unit)}</td>
                <td style="text-align: right;" class="font-mono">${formatNumber(item.netWeight)} KG</td>
                <td style="text-align: right;" class="font-mono">${formatNumber(item.grossWeight)} KG</td>
                <td style="text-align: right;" class="font-mono">${formatMoney(item.rate)}</td>
                <td style="text-align: right;" class="font-mono font-bold" style="color: ${badgeColor};">${formatMoney(item.amount)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="4" style="text-align: right; font-weight: 850;">TOTALS & GRAND VALUATION</td>
              <td style="text-align: right;">${formatNumber(totalQuantity)} Units</td>
              <td style="text-align: right;">${formatNumber(totalNetWeight)} KG</td>
              <td style="text-align: right;">${formatNumber(totalGrossWeight)} KG</td>
              <td></td>
              <td style="text-align: right; color: ${badgeColor}; font-weight: 900;" class="font-mono">${formatMoney(grandTotalAmount)} ${escapeHtml(currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  // Step 4: Logistics & Shipment Rules
  const stepLogisticsHtml = `
    <div class="step-container">
      <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
        <span class="step-badge" style="background: ${badgeColor};">STEP 4</span>
        <span class="step-title" style="color: ${badgeColor};">LOGISTICS, ROUTING & SHIPMENT SPECS</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
        <div class="address-box">
          <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">LOADING PORT DETAILS</div>
          <table class="details-table">
            <tr><td class="lbl">Loading Country:</td><td class="val font-semibold">${escapeHtml(loadingCountry)}</td></tr>
            <tr><td class="lbl">Port of Loading:</td><td class="val font-semibold">${escapeHtml(portLoading)}</td></tr>
            <tr><td class="lbl">Departure Date:</td><td class="val font-mono font-bold">${escapeHtml(loadingDate)}</td></tr>
            <tr><td class="lbl">Transport Mode:</td><td class="val font-semibold text-slate-700">${escapeHtml(shippingMode)}</td></tr>
          </table>
        </div>
        <div class="address-box">
          <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">DISCHARGE / RECEIVED PORT DETAILS</div>
          <table class="details-table">
            <tr><td class="lbl">Received Country:</td><td class="val font-semibold">${escapeHtml(receivedCountry)}</td></tr>
            <tr><td class="lbl">Port of Discharge:</td><td class="val font-semibold">${escapeHtml(portDischarge)}</td></tr>
            <tr><td class="lbl">Arrival Date:</td><td class="val font-mono font-bold">${escapeHtml(receivedDate)}</td></tr>
            <tr><td class="lbl">Delivery Terms:</td><td class="val font-semibold text-indigo-700">${escapeHtml(deliveryTerms)}</td></tr>
          </table>
        </div>
        ${(shippingMode === "By Sea" || containerNumbers !== "N/A") ? `
        <div class="address-box" style="grid-column: span 2;">
          <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">CONTAINER DETAILS</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 8px;">
            <div><span style="color: #64748b; font-weight: 500; display: block; margin-bottom: 2px;">Container Size</span><strong style="color: #1f2937;">${escapeHtml(containerSize)}</strong></div>
            <div><span style="color: #64748b; font-weight: 500; display: block; margin-bottom: 2px;">Container Name / Number(s)</span><strong class="font-mono" style="color: #1f2937;">${escapeHtml(containerNumbers)}</strong></div>
          </div>
        </div>
        ` : ""}
      </div>
    </div>
  `;

  // Step 5: Terms & Bank settlement details
  let stepTermsHtml = "";
  if (type === "contract" || type === "proforma" || type === "commercial") {
    const advancePercent = Number(form.advancePercent || 0);
    const advanceVal = (grandTotalAmount * advancePercent) / 100;
    const balanceVal = grandTotalAmount - advanceVal;

    stepTermsHtml = `
      <div class="step-container">
        <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
          <span class="step-badge" style="background: ${badgeColor};">STEP 5</span>
          <span class="step-title" style="color: ${badgeColor};">CONTRACT CONDITIONS & SETTLEMENT BANK ACCOUNTS</span>
        </div>
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 15px; margin-top: 10px;">
          <div class="address-box">
            <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">TERMS & GUARANTEES</div>
            <div style="font-size: 8px; line-height: 1.35; color: #475569;" class="space-y-1.5">
              <div><strong>1. QUALITY GUARANTEE:</strong> Goods must be clean, free from mold or foreign matter, matching standard merchantable quality grades and passed by international inspectors.</div>
              <div><strong>2. CLAIMS DEADLINE:</strong> Any quantity or packaging discrepancies must be registered in writing within 15 calendar days of cargo arrival at destination.</div>
              <div><strong>3. PAYMENT TERMS:</strong> ${advancePercent}% Advance (${formatMoney(advanceVal)} ${currency}) via telegraphic wire transfer, with remaining balance of ${100 - advancePercent}% (${formatMoney(balanceVal)} ${currency}) payable against receipt of shipping invoice copies.</div>
            </div>
          </div>
          <div class="address-box">
            <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">BENEFICIARY BANK ACCOUNT</div>
            <table class="details-table" style="font-size: 8px;">
              <tr><td class="lbl">Beneficiary:</td><td class="val text-slate-800">${escapeHtml(seller)}</td></tr>
              <tr><td class="lbl">Bank Name:</td><td class="val font-semibold text-slate-900">HBL International Bank Limited</td></tr>
              <tr><td class="lbl">Account No:</td><td class="val font-mono font-bold">1003-998124-001</td></tr>
              <tr><td class="lbl">IBAN Code:</td><td class="val font-mono text-[7px]">PK49HBLI00001003998124001</td></tr>
              <tr><td class="lbl">SWIFT/BIC:</td><td class="val font-mono font-bold">HBLIPKKA</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
  } else {
    stepTermsHtml = `
      <div class="step-container">
        <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor};">
          <span class="step-badge" style="background: ${badgeColor};">STEP 5</span>
          <span class="step-title" style="color: ${badgeColor};">CONTAINER DETAILS & SHIPPING MARKS</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
          <div class="address-box">
            <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">CARGO SPECIFICATIONS</div>
            <table class="details-table">
              <tr><td class="lbl">Transit Mode:</td><td class="val font-semibold">${escapeHtml(shippingMode)}</td></tr>
              <tr><td class="lbl">Container Size:</td><td class="val font-semibold">${escapeHtml(containerSize)}</td></tr>
              <tr><td class="lbl">Container Name/No:</td><td class="val font-mono font-bold">${escapeHtml(containerNumbers)}</td></tr>
            </table>
          </div>
          <div class="address-box">
            <div class="address-header" style="color: ${badgeColor}; border-bottom-color: ${badgeColor}30;">SHIPPING MARKS</div>
            <div style="font-size: 8px; line-height: 1.4; color: #475569;">
              <div><strong>SHIPPING MARKS:</strong> DGT/KBL/DXB/2026</div>
              <div><strong>FUMIGATION SPEC:</strong> Compliant with standard dry fruit imports phytosanitary requirements.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Remarks / Signatures (Step 6)
  const footerHtml = `
    <div style="margin-top: auto; padding-top: 20px;">
      ${remarks || notes ? `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 15px; font-size: 8px; color: #475569;">
          <strong>REMARKS / NOTES:</strong><br/>
          ${escapeHtml(remarks)} ${remarks && notes ? "•" : ""} ${escapeHtml(notes)}
        </div>
      ` : ""}
      
      <div class="step-header" style="background: ${badgeColor}15; border-left-color: ${badgeColor}; margin-bottom: 10px;">
        <span class="step-badge" style="background: ${badgeColor};">STEP 6</span>
        <span class="step-title" style="color: ${badgeColor};">DUAL SIGNATURE DECLARATION</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <tr>
          <td style="width: 45%; vertical-align: top; font-size: 8px; color: #64748b; line-height: 1.4;">
            <strong>DECLARATION:</strong><br/>
            We declare that this document contains the exact details of the transaction. All listed specifications are fully synchronized with the DGT purchase database registry.
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%; text-align: right; vertical-align: bottom;">
            <div style="display: inline-block; text-align: center; width: 180px;">
              <div style="border-bottom: 1px solid #94a3b8; font-family: 'Georgia', serif; font-style: italic; font-size: 10px; padding-bottom: 5px; color: #0f172a;">
                ${escapeHtml(b.audit?.userName || "Authorized Official")}
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #64748b; margin-top: 3px;">Authorized Signatory</div>
              <div style="font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(buyer)}</div>
            </div>
          </td>
        </tr>
      </table>
      
      <div style="display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 15px; font-weight: 700;">
        <div>🏢 ${escapeHtml(buyer)} • ${escapeHtml(docTitle)} Registry System</div>
        <div>System Stamp: PO-${escapeHtml(bookingNo)}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  `;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${docTitle} - ${docNo}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      @page { size: A4; margin: 10mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .wrap { padding: 25px; display: flex; justify-content: center; }
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 12mm;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        border-radius: 12px;
        box-sizing: border-box;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      .header-table td { border: none; padding: 0; }
      .logo-title { display: flex; align-items: center; gap: 10px; }
      .logo-icon { width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold; }
      .logo-text { font-size: 13px; font-weight: 950; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 7.5px; color: #64748b; font-weight: 600; line-height: 1.2; }
      
      .doc-type-title { font-size: 17px; font-weight: 950; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
      .doc-meta-box { text-align: right; }
      .meta-row { font-size: 8.5px; color: #1e293b; font-weight: 700; margin-bottom: 1.5px; }
      .meta-lbl { color: #64748b; font-weight: 500; }
      
      .step-container { margin-bottom: 12px; }
      .step-header { display: flex; align-items: center; gap: 8px; border-left: 3.5px solid #0f172a; padding: 4px 8px; border-radius: 0 4px 4px 0; }
      .step-badge { color: white; font-size: 7.5px; font-weight: 950; padding: 2px 5px; border-radius: 3px; letter-spacing: 0.5px; }
      .step-title { font-size: 9px; font-weight: 900; letter-spacing: 0.5px; }

      .address-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 8px; color: #475569; line-height: 1.35; background: #f8fafc; }
      .address-header { font-size: 8px; font-weight: 900; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px; letter-spacing: 0.5px; text-transform: uppercase; }
      
      .financials-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .fin-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; background: #fafafa; }
      .fin-lbl { font-size: 7.5px; font-weight: 850; color: #64748b; display: block; margin-bottom: 2px; text-transform: uppercase; }
      .fin-val { font-size: 9.5px; font-weight: 850; color: #0f172a; }
      .fin-sub { font-size: 7px; color: #94a3b8; display: block; margin-top: 1px; }

      .items-table { width: 100%; border-collapse: collapse; }
      .items-table th { color: white; font-size: 8px; font-weight: 850; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 8px; text-align: left; }
      .items-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; font-size: 8px; color: #334155; vertical-align: middle; }
      .items-table th:first-child, .items-table td:first-child { border-radius: 4px 0 0 4px; }
      .items-table th:last-child, .items-table td:last-child { border-radius: 0 4px 4px 0; }
      .item-desc { font-size: 7.5px; color: #64748b; font-weight: 500; display: block; margin-top: 1px; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      
      .total-row td { font-weight: 900; color: #0f172a; background: #f8fafc; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; font-size: 8px; }
      
      .details-table { width: 100%; border-collapse: collapse; }
      .details-table td { padding: 3px 4px; font-size: 8px; border-bottom: 1px solid #f1f5f9; }
      .details-table td.lbl { font-weight: 600; color: #64748b; width: 38%; }
      .details-table td.val { font-weight: 700; color: #1e293b; }

      @media print {
        body { background: #ffffff; }
        .wrap { padding: 0; }
        .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; min-height: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="page">
        ${headerHtml}
        ${stepPartiesHtml}
        ${stepAccountsHtml}
        ${tableHtml}
        ${stepLogisticsHtml}
        ${stepTermsHtml}
        ${footerHtml}
      </div>
    </div>
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 100);
      }, { once: true });
    </script>
  </body>
</html>`;

  printStore.openPrint(html, type.toUpperCase() + " DOCUMENT");
}
