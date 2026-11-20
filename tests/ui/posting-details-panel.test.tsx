import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
(globalThis as any).React = React;
import { PostingDetailsPanel } from "@/features/purchases/components/posting-details-panel";
import { buildPostingSummary } from "@/lib/purchases/posting-summary";

afterEach(cleanup);
const dr = { id: "L-DR", code: "ACC-000006", name: "Purchase and sales Dubai office" };
const cr = { id: "L-CR", code: "ACC-000010", name: "Haji abdullah chaman" };

describe("Posting Details panel", () => {
  it("posted: shows Dr / Cr accounts, amounts, serial and the user", () => {
    const posting = buildPostingSummary({
      lines: [{ ledger_id: "L-DR", debit: 262305.6995 }, { ledger_id: "L-CR", credit: 262305.6995 }],
      debitAccount: dr, creditAccount: cr, originalAmount: 20250000, currency: "PKR", baseCurrency: "AED", rate: 77.2, op: "/",
      roznamchaSerialNo: "RZ-0042", postedBy: { id: "u1", name: "Super Admin" }, postedAt: "2026-11-20T20:00:00.000Z",
    });
    render(<PostingDetailsPanel posting={posting} onClose={() => {}} />);
    const text = screen.getByTestId("posting-details-panel").textContent || "";
    expect(text).toContain("Posted to Business Roznamcha");
    expect(text).toContain("ACC-000006");
    expect(text).toContain("Haji abdullah chaman");
    expect(text).toContain("262,305.70 AED");
    expect(text).toContain("20,250,000.00 PKR ÷ 77.2");
    expect(text).toContain("RZ-0042");
    expect(text).toContain("Super Admin");
  });

  it("stopped: shows the reason and the planned Dr / Cr as not posted", () => {
    const posting = buildPostingSummary({ status: "not_posted", debitAccount: dr, creditAccount: cr, plannedBaseAmount: 262305.6995,
      originalAmount: 20250000, currency: "PKR", baseCurrency: "AED", rate: 77.2, op: "/", reason: "Transfer stopped — nothing was posted." });
    render(<PostingDetailsPanel posting={posting} onClose={() => {}} />);
    expect(screen.getByTestId("posting-details-reason").textContent).toContain("nothing was posted");
    expect(screen.getAllByText("Not posted").length).toBe(2);
  });
});
