import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CustomerProfile360Full } from "@/features/crm/components/customer-profile-360-full";
import { t } from "@/lib/i18n/ui";
const state = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => state.lang }));
const fixture = {
  customer: { companyName: "Fixture Trading", customerName: "Fixture Customer", customerCode: "C-1", isActive: true },
  financialSummary: { salesOrdersCount: 1, purchaseOrdersCount: 0, balancesByCurrency: [
    { currency: "AED", totalReceivable: 367.5, totalPayable: 0, netPosition: 367.5 },
    { currency: "USD", totalReceivable: 100, totalPayable: 20, netPosition: 80 },
  ] },
  salesOrders: [], purchaseOrders: [], cheques: [], shippingAndClearing: [], timeline: [],
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Customer 360 renders the real API envelope in five languages", () => {
  it.each(["en", "ur", "ar", "fa", "ps"])("renders separate currency balances with %s labels", async (lang) => {
    state.lang = lang;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, success: true, data: fixture }) })));
    const view = render(<CustomerProfile360Full customerId="00000000-0000-4000-8000-000000000001" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Fixture Trading")).toBeTruthy());
    expect(screen.getByText(t(lang as any, "crm360.totalReceivable", "Total Receivable"))).toBeTruthy();
    expect(view.container.textContent).toContain("AED 367.5");
    expect(view.container.textContent).toContain("USD 100");
    expect(view.container.textContent).not.toContain("467.5");
    expect(view.container.firstElementChild?.className).toContain(lang === "en" ? "ltr" : "rtl");
  });
});
