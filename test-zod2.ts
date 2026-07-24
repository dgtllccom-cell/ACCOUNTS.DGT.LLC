import { z } from "zod";
import { purchaseOrderUpdateSchema } from "./lib/api/erp-validation";

const payload = {
  "formData": {},
  "orderTotal": 62375,
  "currencyCode": "USD",
  "exchangeRate": 1,
  "purchaseContractNo": "PO-1234",
  "paymentStatus": "partial",
  "ledgerPostingStatus": "Posted"
};

const res = purchaseOrderUpdateSchema.safeParse(payload);
if (!res.success) {
  console.log("UPDATE SCHEMA ERROR:", JSON.stringify(res.error.format(), null, 2));
} else {
  console.log("UPDATE SCHEMA SUCCESS");
}
