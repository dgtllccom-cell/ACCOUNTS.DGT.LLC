import { z } from "zod";
import { purchaseOrderUpdateSchema, purchaseOrderCreateSchema } from "./lib/api/erp-validation";

const payload = {
  "countryId": null,
  "countryBranchId": null,
  "cityBranchId": null,
  "supplierCompanyId": null,
  "purchaseContractNo": "PO-2026-1234",
  "currencyCode": "USD",
  "exchangeRate": 1,
  "orderTotal": 62375,
  "totalGoodsOriginal": 62375,
  "totalGoodsLocal": 62375,
  "totalGoodsUsd": 62375,
  "items": [
    {
      "goodsName": "CASHEW NUTS (W320)",
      "hsCode": "0801.32",
      "size": "",
      "brand": "DAMAAN",
      "origin": "India",
      "quantity": 100,
      "unitName": "BAGS",
      "unitWeight": 50,
      "grossWeight": 5000,
      "netWeight": 4990,
      "rateOriginal": 12.5,
      "rateLocal": 12.5,
      "rateUsd": 12.5,
      "totalOriginal": 62375,
      "totalLocal": 62375,
      "totalUsd": 62375
    }
  ],
  "paymentStatus": "partial",
  "ledgerPostingStatus": "Posted",
  "formData": {
    "form": {},
    "totals": {},
    "goodsEntries": []
  }
};

const res = purchaseOrderUpdateSchema.safeParse(payload);
if (!res.success) {
  console.log("UPDATE SCHEMA ERROR:", JSON.stringify(res.error.format(), null, 2));
} else {
  console.log("UPDATE SCHEMA SUCCESS");
}

const res2 = purchaseOrderCreateSchema.safeParse(payload);
if (!res2.success) {
  console.log("CREATE SCHEMA ERROR:", JSON.stringify(res2.error.format(), null, 2));
} else {
  console.log("CREATE SCHEMA SUCCESS");
}
