import { describe, expect, it } from "vitest";
import { billAccounts, purchaseSupplierName } from "@/lib/purchases/bill-accounts";

// as saved in Production (AE-001-0005 and a Local Purchase), read only
const pb = { form_data: { form: { purchaseAccountNo: "ACC-000006", purchaseAccountName: "Purchase and sales Dubai office",
  salesAccountNo: "ACC-000010", salesAccountName: "Haji abdullah chaman", supplierName: "Purchase and sales Dubai office" } } };
const lp = { purchase_account_no: "AE-AEDU-PS-001", sales_account_no: "AE-AEDU-BC-003", supplier_name: null };

describe("bill accounts", () => {
  it("Purchase Booking: Purchase (Dr) and Supplier (Cr) are separate", () => {
    const a = billAccounts("purchase_order", pb);
    expect(a.debit).toEqual({ code: "ACC-000006", name: "Purchase and sales Dubai office" });
    expect(a.credit).toEqual({ code: "ACC-000010", name: "Haji abdullah chaman" });
  });

  it("the invoice supplier is the Cr party, never our own purchase office", () => {
    const a = billAccounts("purchase_order", pb);
    expect(purchaseSupplierName(a, pb.form_data.form.supplierName)).toBe("Haji abdullah chaman");
    expect(purchaseSupplierName(a, "Real Supplier LLC")).toBe("Real Supplier LLC");
  });

  it("Local Purchase: codes from the columns (names are looked up by the View)", () => {
    const a = billAccounts("local_purchase", lp);
    expect(a.debit.code).toBe("AE-AEDU-PS-001");
    expect(a.credit.code).toBe("AE-AEDU-BC-003");
    expect(a.credit.name).toBe("");
  });

  it("string-encoded form_data is read", () => {
    const a = billAccounts("purchase_order", { form_data: JSON.stringify(pb.form_data) });
    expect(a.credit.name).toBe("Haji abdullah chaman");
  });
});
