import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { isLocalSalesFormData } from "@/lib/sales/local-sales-source";
import { deductLegacyLocalSaleLot } from "@/lib/sales/local-sales-transfer";
import { resolveReviewedSalesPaymentRoute, resolveSalesBookingPaymentRoute } from "@/lib/services/sales-booking-routing";

const id = "2768a3eb-46b2-421a-b480-23b3303b70f7";
const stock = { lotId: id, lotNo: "LP-2768a3eb", qty: 4, now: "2026-11-25T12:00:00.000Z", countryId: id, countryBranchId: id, cityBranchId: id };
function mockStock(candidates: object[], updated: object[]) {
  const read = vi.fn().mockResolvedValue(candidates);
  const write = vi.fn().mockResolvedValue(updated);
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.join("?");
    return text.includes("select lp.id") ? read(text, values) : text.includes("update public.local_purchases") ? write(text, values) : { text, values };
  };
  return { sql: sql as unknown as Sql, read, write };
}

describe("Local Sales posting boundaries", () => {
  it("uses explicit Local Purchase and managed-lot sources rather than default saleMode", () => {
    expect(isLocalSalesFormData({ form: { saleSource: "local" } })).toBe(true);
    expect(isLocalSalesFormData({ saleSource: "local", form: {} })).toBe(true);
    expect(isLocalSalesFormData({ form: { saleSource: "lot", saleMode: "local" } })).toBe(true);
    expect(isLocalSalesFormData({ form: { saleSource: "lot", saleMode: "export" } })).toBe(false);
    expect(isLocalSalesFormData({ form: { saleSource: "stock", saleMode: "local" } })).toBe(false);
    expect(isLocalSalesFormData({ form: { saleMode: "local" } })).toBe(false);
    expect(isLocalSalesFormData({ saleSource: "local", form: { saleSource: "stock" } })).toBe(false);
  });

  it("keeps credit and cash separate, and labels Account Transfer in reviewed flow only", () => {
    expect(resolveReviewedSalesPaymentRoute("Credit")).toMatchObject({ paymentKind: "credit", path: "/dashboard/journal/sales-order-payment/charges" });
    expect(resolveReviewedSalesPaymentRoute("Cash")).toMatchObject({ paymentKind: "cash", path: "/dashboard/journal/sales-order-payment/advance" });
    expect(resolveReviewedSalesPaymentRoute("Account Transfer")).toMatchObject({ paymentKind: "transfer", paymentLabel: "Account Transfer" });
    expect(resolveReviewedSalesPaymentRoute("Invoice")).toMatchObject({ paymentKind: "invoice" });
    expect(resolveSalesBookingPaymentRoute("Account Transfer")).toMatchObject({ paymentKind: "advance" });
  });

  it("deducts exactly the posted local quantity from one locked, scoped lot", async () => {
    const { sql, read, write } = mockStock([{ id }], [{ id }]);
    await expect(deductLegacyLocalSaleLot(sql, stock)).resolves.toBe(id);
    expect(read.mock.calls[0][0]).toMatch(/order by lp.id limit 2 for update/);
    expect(read.mock.calls[0][1]).toContainEqual(expect.objectContaining({ text: expect.stringContaining("lp.city_branch_id =") }));
    expect(write.mock.calls[0][0]).toMatch(/set numbers = numbers - \?[\s\S]+ and numbers >= \?/);
    expect(write.mock.calls[0][1]).toEqual([4, 4, stock.now, id, 4]);
  });

  it("refuses missing, cross-scope, ambiguous or insufficient stock instead of silently posting", async () => {
    for (const candidates of [[], [{ id }, { id: "other" }]]) {
      const { sql, write } = mockStock(candidates, []);
      await expect(deductLegacyLocalSaleLot(sql, { ...stock, lotId: null })).rejects.toMatchObject({ code: "LOCAL_SALES_STOCK_UNAVAILABLE" });
      expect(write).not.toHaveBeenCalled();
    }
    const { sql, write } = mockStock([{ id }], []);
    await expect(deductLegacyLocalSaleLot(sql, stock)).rejects.toMatchObject({ code: "LOCAL_SALES_STOCK_UNAVAILABLE" });
    expect(write).toHaveBeenCalledOnce();
  });
});
