import { describe, expect, it } from "vitest";
import { defaultDocTypeFor, mapRecordToInvoice } from "@/components/invoices/invoice-document-view";
import { renderInvoiceHtml } from "@/lib/reports/invoice-templates/render-invoice-html";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";

// AE-001-0004 as saved (form + goods), values copied from the real bill for the View test
const formData = {"form": {"billNo": "DUBAI-0004", "origin": "China", "qtyName": "Box", "countryId": "582526d0-0375-41e9-8eba-ccbd2a5e3a0f", "branchCity": "Dubai", "branchCode": "ARE-AEDU-001", "branchName": "Dubai City Branch", "customerId": "ACC-000014", "supplierId": "ACC-000006", "loadingDate": "2026-11-26", "loadingPort": "Khorgos Land Border (CN-KZ)", "paymentDate": "2026-11-30", "paymentType": "Advance Payment", "cityBranchId": "d42d23ce-e5f5-4437-ab90-c079714869ac", "currencyType": "USD", "customerName": "JOY GUO (chin)", "exchangeRate": 3.675, "purchaseDate": "2026-11-12", "receivedDate": "2026-12-03", "receivedPort": "Sher Khan Bandar Border (Kunduz - TJ)", "shipmentType": "By Road", "shippingMode": "By Road", "supplierName": "Purchase and sales Dubai office", "branchCountry": "United Arab Emirates", "containerSize": "40 FT", "destCountryId": "582526d0-0375-41e9-8eba-ccbd2a5e3a0f", "loadingBorder": "Khorgos Land Border (CN-KZ)", "originCountry": "China", "receivingPort": "Sher Khan Bandar Border (Kunduz - TJ)", "advancePercent": 20, "containerCount": 1, "loadingCountry": "China", "paymentRemarks": "20% Advance Payment: 20% of the total amount shall be paid in advance. 80% Balance Payment: The remaining 80% shall be paid upon arrival of the goods at the agreed destination, after delivery and verification of the goods and relevant documents.", "salesAccountId": "20585152-2940-4a70-b525-41287f8d2664", "salesAccountNo": "ACC-000014", "salesCompanyId": "fbfab380-4de9-462f-808a-e74fa30856e4", "countryBranchId": "ac5597e5-4787-4e97-b868-e43b96b23c4f", "destinationPort": "Sher Khan Bandar Border (Kunduz - TJ)", "paymentCurrency": "AED", "purchaseOrderNo": "AE-001-0004", "receivedCountry": "Afghanistan", "receivingBorder": "Sher Khan Bandar Border (Kunduz - TJ)", "purchaseCurrency": "AED", "receivingCountry": "Afghanistan", "salesAccountName": "JOY GUO (chin)", "salesCompanyName": "DAMAAN GENERAL TRADING L.L.C", "purchaseAccountId": "162a0af5-0bd7-4212-b343-eb604fe5d607", "purchaseAccountNo": "ACC-000006", "purchaseCompanyId": "fbfab380-4de9-462f-808a-e74fa30856e4", "secondaryCurrency": "AED", "destinationCountry": "Afghanistan", "purchaseContractNo": "YPTX260017", "purchaseAccountName": "Purchase and sales Dubai office", "purchaseCompanyName": "DAMAAN GENERAL TRADING L.L.C"}, "goodsEntries": [{"op": "*", "size": "HSLVES90%", "brand": "DGT.LLC", "qtyNo": 4600, "hsCode": "0802-3200", "origin": "Afghanistan", "qtyKgs": 10.25, "qtyName": "Box", "emptyKgs": 0.25, "goodsName": "WALNUT KENRELS", "netWeight": 46000, "priceType": "P/KGs", "divideType": "D/KGs", "coursePrice": 5, "finalAmount": 845250, "grossWeight": 47150, "totalAmount": 230000, "currencyType": "USD", "divideWeight": 1, "exchangeRate": 3.675, "purchaseCurrency": "AED"}], "totals": {"totalNet": 46000, "totalQty": 4600, "grandFinal": 845250, "totalGross": 47150, "totalDeductions": 1150, "grandPrimaryFinal": 230000}, "workflow": {"transferStatus": "transferred", "ledgerStatus": "posted", "systemBillNumber": "AE-001-0004", "manualBillNumber": "DUBAI-0004"}};
const record = { id: "740f99e9-2bf6-408e-b8cb-82599748bbac", purchase_order_no: "AE-001-0004", purchase_contract_no: "YPTX260017", currency_code: "USD", exchange_rate: 3.675, created_at: "2026-11-18T18:50:27Z", form_data: formData };
const branding: DocumentBranding = {
  entityName: "DAMAAN GENERAL TRADING L.L.C", legalName: "DAMAAN GENERAL TRADING L.L.C", logoUrl: null, stampUrl: null,
  address: "al ras", phone: "+971544816664", email: "damaan@dgt.llc", website: null, registrationNumber: null,
  taxNumber: "104127559300003", countryName: "United Arab Emirates", branchName: "Dubai City Branch", baseCurrency: "AED", bank: null, raw: null,
};

describe("Purchase Booking View shows the complete invoice", () => {
  it("uses the purchase invoice for purchases and the sales invoice for sales", () => {
    expect(defaultDocTypeFor("purchase_order")).toBe("purchase_invoice");
    expect(defaultDocTypeFor("local_purchase")).toBe("purchase_invoice");
    expect(defaultDocTypeFor("sales_order")).toBe("sales_invoice");
  });

  it("maps AE-001-0004 into the Damaan invoice with its company, TRN, goods and totals", () => {
    const input = mapRecordToInvoice("purchase_order", record, { docType: "purchase_invoice", lang: "en", branding });
    expect(input.docType).toBe("purchase_invoice");
    expect(input.goods).toHaveLength(1);
    expect(input.goods[0].description).toBe("WALNUT KENRELS");
    expect(input.goods[0].hsCode).toBe("0802-3200");
    const html = renderInvoiceHtml(input, "tax_invoice");
    expect(html.toLowerCase()).toContain("bank details");
    for (const text of ["DAMAAN GENERAL TRADING L.L.C", "104127559300003", "WALNUT KENRELS", "0802-3200", "230,000.00"]) {
      expect(html, text).toContain(text);
    }
  });

  it("routes a Local Purchase bill to the Local Purchase mapper", () => {
    const input = mapRecordToInvoice("local_purchase", { id: "lp1", goods_name: "WALNUT KENRELS", numbers: 2100, quantity_name: "Box", purchase_rate: 17, final_cost: 425000, supplier_name: "Supplier" }, { docType: "purchase_invoice", lang: "en", branding });
    expect(input.tradeScope).toBe("local");
    expect(input.goods[0].description).toBe("WALNUT KENRELS");
  });
});
