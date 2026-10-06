import { describe, expect, it } from "vitest";
import { MockAspAdapter } from "@/lib/services/asp/providers/mock-asp";
import { getAspAdapter, listAspProviders } from "@/lib/services/asp/registry";
import { mapToPintAe, type ErpEInvoiceInput } from "@/lib/services/einvoice/pint-ae-mapper";

const ctx = { provider: "mock", mode: "mock" as const, taxEntityTrn: "100000000000003" };

function payload(buyerTrn: string) {
  const inv: ErpEInvoiceInput = {
    invoiceNumber: "INV-1",
    documentType: "tax_invoice",
    issueDate: "2026-08-15",
    currency: "AED",
    seller: { name: "Seller", trn: "100000000000003" },
    buyer: { name: "Buyer", trn: buyerTrn },
    lines: [{ id: 1, description: "Item", quantity: 1, unitPrice: 100, lineNet: 100, vatCategory: "S", vatRate: 5, vatAmount: 5 }],
    totals: { netAmount: 100, vatAmount: 5, grossAmount: 105 },
  };
  return mapToPintAe(inv);
}

describe("Mock ASP adapter", () => {
  const asp = new MockAspAdapter();

  it("is resolvable from the registry and is the default", () => {
    expect(listAspProviders()).toContain("mock");
    expect(getAspAdapter("mock").name).toBe("mock");
    expect(getAspAdapter("nonexistent").name).toBe("mock");
    expect(getAspAdapter(null).name).toBe("mock");
  });

  it("validates a good payload and rejects a bad one", async () => {
    expect((await asp.validate(payload("100000000000456"), ctx)).valid).toBe(true);
    const bad = payload("100000000000456") as any;
    delete bad.id;
    expect((await asp.validate(bad, ctx)).valid).toBe(false);
  });

  it("accepts a normal submission", async () => {
    const r = await asp.submit(payload("100000000000456"), "tax_invoice", ctx);
    expect(r.accepted).toBe(true);
    expect(r.status).toBe("submitted");
    expect(r.aspReference).toMatch(/^MOCK-/);
  });

  it("rejects a buyer TRN ending REJECT", async () => {
    const r = await asp.submit(payload("999REJECT"), "tax_invoice", ctx);
    expect(r.accepted).toBe(false);
    expect(r.status).toBe("rejected");
  });

  it("throws (retry path) for a buyer TRN ending ERROR", async () => {
    await expect(asp.submit(payload("999ERROR"), "tax_invoice", ctx)).rejects.toThrow();
  });

  it("advances status on polling", async () => {
    const r = await asp.getStatus("MOCK-ABC123", ctx);
    expect(["processing", "delivered", "completed"]).toContain(r.status);
  });
});
