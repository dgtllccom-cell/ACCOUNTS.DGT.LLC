import { describe, expect, it } from "vitest";
import {
  allowedPaymentKindsForCondition,
  classifyLocalPurchaseCondition,
  localPurchasePaymentHref,
  localPurchasePaymentRoute,
  requiredAdvanceForBill,
  totalPayableForBill,
  verifiedPaidOnBill,
  LOCAL_PURCHASE_PAYMENT_ROUTES,
} from "@/lib/purchases/local-purchase-payment-routing";
import { checkLocalPurchaseLoadingEligibility, classifyLocalPurchasePaymentMode, isCreditApprovedForLoading } from "@/lib/purchases/local-purchase-loading-rules";
import { resolveLocalPurchaseDestination } from "@/lib/purchases/local-purchase-destination";

describe("Local Purchase payment condition classification", () => {
  it("reads the saved condition strings the booking form writes", () => {
    expect(classifyLocalPurchaseCondition("Advance (20% Paid: 2026-11-01, Bal Due: 2026-12-01)")).toBe("advance");
    expect(classifyLocalPurchaseCondition("Credit (Due: 2026-12-19)")).toBe("credit");
    expect(classifyLocalPurchaseCondition("Cash (Cash Payment on 2026-11-21)")).toBe("cash");
    expect(classifyLocalPurchaseCondition("Bank Transfer (Bank Transfer on 2026-11-21)")).toBe("bank");
    expect(classifyLocalPurchaseCondition("Hawala / Transfer (Hawala on 2026-11-21)")).toBe("hawala");
  });

  it("reads the legacy labels the edit form can save", () => {
    expect(classifyLocalPurchaseCondition("Invoice Payment")).toBe("invoice");
    expect(classifyLocalPurchaseCondition("Final Payment")).toBe("final");
    expect(classifyLocalPurchaseCondition("Remaining")).toBe("final");
  });

  it("lets the base label decide before the parenthesised detail", () => {
    // A cash bill whose detail mentions a bank must stay cash.
    expect(classifyLocalPurchaseCondition("Cash (Bank on 2026-11-21)")).toBe("cash");
  });

  it("fails closed on blank or unknown text", () => {
    expect(classifyLocalPurchaseCondition("")).toBe("unknown");
    expect(classifyLocalPurchaseCondition(null)).toBe("unknown");
    expect(classifyLocalPurchaseCondition("something-else")).toBe("unknown");
  });
});

describe("Local Purchase payment routing table", () => {
  it("never groups Advance with Invoice", () => {
    const advance = localPurchasePaymentRoute("Advance (20% Paid: 2026-11-01)");
    const invoice = localPurchasePaymentRoute("Invoice Payment");
    expect(advance.category).toBe("advance");
    expect(invoice.category).toBe("invoice");
    expect(advance.workflow).toBe("advance_payment");
    expect(invoice.workflow).toBe("invoice_payment");
    expect(advance.optionFallback).toBe("Advance Payment");
    expect(invoice.optionFallback).toBe("Invoice Payment");
    expect(advance.path).not.toBe(invoice.path);
  });

  it("opens the workflow for each condition", () => {
    expect(localPurchasePaymentRoute("Advance (20%)")).toMatchObject({ path: "/dashboard/journal/purchase-order-payment/advance", paymentKind: "advance" });
    // /credit redirects to Remaining (next.config.ts), so Credit must open /charges.
    expect(localPurchasePaymentRoute("Credit (Due: 2026-12-19)")).toMatchObject({ path: "/dashboard/journal/purchase-order-payment/charges", paymentKind: "credit" });
    expect(localPurchasePaymentRoute("Invoice Payment")).toMatchObject({ path: "/dashboard/journal/purchase-order-payment/remaining", paymentKind: "remaining", paymentType: "invoice" });
    expect(localPurchasePaymentRoute("Final Payment")).toMatchObject({ path: "/dashboard/journal/purchase-order-payment/remaining", paymentKind: "remaining", paymentType: null });
    expect(localPurchasePaymentRoute("Cash (x)")).toMatchObject({ workflow: "cash_roznamcha", paymentType: "cash" });
    expect(localPurchasePaymentRoute("Bank Transfer (x)")).toMatchObject({ workflow: "bank_roznamcha", paymentType: "bank" });
  });

  it("uses the Cash workflow for an unreadable condition, the booking form default", () => {
    expect(localPurchasePaymentRoute("").category).toBe("cash");
    expect(localPurchasePaymentRoute("weird").category).toBe("cash");
  });

  it("builds a journal link that carries the bill number and the source preset", () => {
    const href = localPurchasePaymentHref(LOCAL_PURCHASE_PAYMENT_ROUTES.bank, "LP-JRN-00000001");
    expect(href).toBe("/dashboard/journal/purchase-order-payment/remaining?purchaseOrderNo=LP-JRN-00000001&paymentType=bank");
    expect(localPurchasePaymentHref(LOCAL_PURCHASE_PAYMENT_ROUTES.credit, "LP JRN/1")).toBe(
      "/dashboard/journal/purchase-order-payment/charges?purchaseOrderNo=LP+JRN%2F1",
    );
  });
});

describe("Payment API refuses an incorrect workflow", () => {
  it("accepts only the kinds each saved condition routes to", () => {
    expect(allowedPaymentKindsForCondition("Credit (Due: 2026-12-19)")).toEqual(["credit"]);
    expect(allowedPaymentKindsForCondition("Advance (20% Paid: 2026-11-01)")).toEqual(["advance", "remaining"]);
    expect(allowedPaymentKindsForCondition("Invoice Payment")).toEqual(["remaining"]);
    expect(allowedPaymentKindsForCondition("Final Payment")).toEqual(["remaining"]);
    expect(allowedPaymentKindsForCondition("Cash (Cash on 2026-11-21)")).toEqual(["remaining"]);
    expect(allowedPaymentKindsForCondition("Bank Transfer (x)")).toEqual(["remaining"]);
  });

  it("refuses an advance payment on a credit bill and a credit payment on an advance bill", () => {
    expect(allowedPaymentKindsForCondition("Credit (Due: 2026-12-19)").includes("advance")).toBe(false);
    expect(allowedPaymentKindsForCondition("Advance (20%)").includes("credit")).toBe(false);
  });
});

describe("Paid and balance come from ledger-verified posted payments only", () => {
  it("counts verified advance and other payments and nothing else", () => {
    expect(verifiedPaidOnBill({ posted_advance_amount: 71400, posted_other_amount: 0 })).toEqual({ advance: 71400, other: 0, paid: 71400 });
    expect(verifiedPaidOnBill({ posted_advance_amount: "1000.5", posted_other_amount: "250" })).toEqual({ advance: 1000.5, other: 250, paid: 1250.5 });
  });

  it("treats a missing or negative value as zero, so the booking transfer is never paid money", () => {
    expect(verifiedPaidOnBill({ roznamcha_entry_id: "abc", status: "posted" } as any)).toEqual({ advance: 0, other: 0, paid: 0 });
    expect(verifiedPaidOnBill({ posted_advance_amount: -5, posted_other_amount: null })).toEqual({ advance: 0, other: 0, paid: 0 });
    expect(verifiedPaidOnBill(null)).toEqual({ advance: 0, other: 0, paid: 0 });
  });

  it("computes the required advance from the booked percentage, not from advance_amount that payments change", () => {
    const booked = { final_cost: 357000, purchase_cost: 357000, advance_percentage: 20, advance_amount: 71400 };
    expect(requiredAdvanceForBill(booked)).toBe(71400);
    // After a full advance payment the route adds the payment onto advance_amount; the requirement must not double.
    expect(requiredAdvanceForBill({ ...booked, advance_amount: 142800 })).toBe(71400);
    expect(requiredAdvanceForBill({ final_cost: 1000, advance_percentage: 0, advance_amount: 0 })).toBe(0);
    expect(totalPayableForBill({ final_cost: 357000 })).toBe(357000);
  });
});

describe("Loading gate by payment condition", () => {
  const posted = { purchaseStatus: "posted" };

  it("lets a Credit bill load without any advance (LP-JRN-00000001 shape)", () => {
    const mode = "Credit (Due: 2026-12-17)";
    expect(classifyLocalPurchasePaymentMode(mode)).toBe("credit");
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode, requiredAdvance: 0, postedAdvance: 0, creditApproved: true })).toMatchObject({ allowed: true, reason: "READY" });
  });

  it("keeps an Advance bill blocked until the booked advance is fully paid", () => {
    const booked = { final_cost: 357000, advance_percentage: 20, advance_amount: 71400 };
    const mode = "Advance (20% Paid: 2026-11-01, Bal Due: 2026-12-01)";
    const required = requiredAdvanceForBill(booked);
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode, requiredAdvance: required, postedAdvance: 0 })).toMatchObject({ allowed: false, reason: "ADVANCE_PENDING" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode, requiredAdvance: required, postedAdvance: 30000 })).toMatchObject({ allowed: false, reason: "ADVANCE_PENDING", advanceOutstanding: 41400 });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode, requiredAdvance: required, postedAdvance: 71400 })).toMatchObject({ allowed: true, reason: "READY" });
  });

  it("does not block a fully paid Advance bill whose advance_amount was increased by the payments", () => {
    // Before the fix, advance_amount grew with each advance payment, so the requirement stayed above the verified amount forever.
    const paidInFull = { final_cost: 357000, advance_percentage: 20, advance_amount: 142800 };
    const decision = checkLocalPurchaseLoadingEligibility({
      ...posted,
      mode: "Advance (20% Paid)",
      requiredAdvance: requiredAdvanceForBill(paidInFull),
      postedAdvance: 71400,
    });
    expect(decision).toMatchObject({ allowed: true, reason: "READY" });
  });

  it("requires a ledger-verified payment for Cash, Bank and Hawala, and the booking transfer never counts", () => {
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Cash (Cash on 2026-11-21)", requiredAdvance: 0, postedAdvance: 0 })).toMatchObject({ allowed: false, reason: "CASH_PENDING" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Bank Transfer (x)", requiredAdvance: 0, postedAdvance: 0, cashPaymentPosted: true })).toMatchObject({ allowed: true, reason: "READY" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Hawala / Transfer (x)", requiredAdvance: 0, postedAdvance: 0 })).toMatchObject({ allowed: false, reason: "CASH_PENDING" });
  });

  it("holds an Invoice bill until it is paid in full, and loads a Final bill straight away", () => {
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Invoice Payment", requiredAdvance: 0, postedAdvance: 0, totalPayable: 1000, verifiedPaidTotal: 400 })).toMatchObject({ allowed: false, reason: "INVOICE_PENDING" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Invoice Payment", requiredAdvance: 0, postedAdvance: 0, totalPayable: 1000, verifiedPaidTotal: 1000 })).toMatchObject({ allowed: true, reason: "READY" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Invoice Payment", requiredAdvance: 0, postedAdvance: 0 })).toMatchObject({ allowed: false, reason: "INVOICE_PENDING" });
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "Final Payment", requiredAdvance: 0, postedAdvance: 0 })).toMatchObject({ allowed: true, reason: "READY" });
  });

  it("fails closed for unknown conditions and never loads an unposted bill", () => {
    expect(checkLocalPurchaseLoadingEligibility({ ...posted, mode: "something-else", requiredAdvance: 0, postedAdvance: 0 })).toMatchObject({ allowed: false, reason: "UNKNOWN_MODE" });
    expect(checkLocalPurchaseLoadingEligibility({ purchaseStatus: "accepted", mode: "Credit", requiredAdvance: 0, postedAdvance: 0, creditApproved: true })).toMatchObject({ allowed: false, reason: "NOT_POSTED" });
  });
});

describe("Credit approval for loading", () => {
  it("is approved only by a posted Transfer & Post booking", () => {
    expect(isCreditApprovedForLoading({ purchaseStatus: "posted", bookingPosted: true, alreadyLoading: false })).toBe(true);
    expect(isCreditApprovedForLoading({ purchaseStatus: "posted", bookingPosted: false, alreadyLoading: false })).toBe(false);
    expect(isCreditApprovedForLoading({ purchaseStatus: "accepted", bookingPosted: true, alreadyLoading: false })).toBe(false);
  });

  it("never fails a bill that is already loading retroactively", () => {
    expect(isCreditApprovedForLoading({ purchaseStatus: "posted", bookingPosted: false, alreadyLoading: true })).toBe(true);
  });

  it("does not affect the advance rule: an Advance bill still needs the paid advance", () => {
    expect(checkLocalPurchaseLoadingEligibility({
      purchaseStatus: "posted",
      mode: "Advance (20%)",
      requiredAdvance: 2000,
      postedAdvance: 0,
      creditApproved: true,
    })).toMatchObject({ allowed: false, reason: "ADVANCE_PENDING" });
  });
});

describe("LP-JRN-00000001 destination: a warehouse-stage bill is never listed under Loading", () => {
  it("resolves to the warehouse queue even when a loading stage status exists, so the loading queue cannot show it", () => {
    const bill = { status: "posted", shipping_mode: "Transfer Layout", warehouse_transfer_status: "completed", warehouse_name: null, warehouse_id: null, loading_status: null };
    expect(resolveLocalPurchaseDestination(bill)).toBe("warehouse_transfer");
    expect(resolveLocalPurchaseDestination({ ...bill, shipping_mode: "Loading" })).toBe("loading");
  });
});
