import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("approved Purchase layout is limited to the five approved routes (Page 1 and other routes keep their original layout)", () => {
  it("the register view defaults to the ORIGINAL layout", () => {
    expect(read("features/purchases/components/purchase-booking-journal-report-view.tsx")).toMatch(/layout = "legacy"/);
    expect(read("features/journal/components/purchase-payment-journal-remaining-view.tsx")).toMatch(/layout = "legacy"/);
  });
  it("New Purchase Booking Order (wizard) embeds the register WITHOUT the approved layout", () => {
    const wizard = read("features/purchases/components/purchase-order-wizard.jsx");
    expect(wizard).toContain("<PurchaseBookingJournalReportView");
    expect(wizard).not.toMatch(/layout=["{]/);
    expect(read("features/purchases/components/purchase-booking-order-page-wrapper.tsx")).not.toMatch(/layout="approved"/);
  });
  it("only the Booking Details and Purchase Payments routes switch the approved layout on", () => {
    expect(read("app/dashboard/purchase/purchase-booking-journal-report/page.tsx")).toContain('layout="approved"');
    expect(read("app/dashboard/purchase/purchase-payments/page.tsx")).toContain("approvedLayout");
    for (const p of [
      "app/dashboard/journal/purchase-order-payment/remaining/page.tsx",
      "app/dashboard/purchase/new-purchase-booking-order/page.tsx",
      "app/dashboard/purchase/purchase-transit-lane/page.tsx",
    ]) expect(read(p)).not.toMatch(/approvedLayout|layout="approved"/);
  });
  it("New Purchase Booking Order and Purchase Transit & Lane source files were not touched by the approved-UI work", () => {
    for (const p of [
      "features/purchases/components/new-purchase-booking-entry.tsx",
      "features/purchases/components/purchase-order-wizard.jsx",
    ]) expect(read(p)).not.toMatch(/purchase-ui|PurchaseApprovedHeader|dgt-pa/);
  });
});
