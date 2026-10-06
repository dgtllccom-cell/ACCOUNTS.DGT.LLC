import { z } from "zod";
import { purchaseOrderUpdateSchema } from "./lib/api/erp-validation";

const payload = {
  exchangeRate: null
};

const res = purchaseOrderUpdateSchema.safeParse(payload);
if (!res.success) {
  console.log("UPDATE SCHEMA ERROR:", JSON.stringify(res.error.format(), null, 2));
} else {
  console.log("UPDATE SCHEMA SUCCESS");
}
