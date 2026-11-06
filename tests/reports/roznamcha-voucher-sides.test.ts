import { describe, expect, it } from "vitest";
import { buildRoznamchaVoucherHtml, type RoznamchaVoucherData } from "@/lib/reports/open-roznamcha-voucher-print-report";

/**
 * A Roznamcha cash entry is one-sided: a CR payment or a DR receipt. Its voucher lists only the leg it has, on
 * both copies. A purchase / sales / expense posting is stored with both legs and lists both.
 */
const base: RoznamchaVoucherData = {
  receiptNo: "V-20261012-4KWB",
  date: "2026-10-12",
  accountNo: "9101",
  accountName: "Import Duty Deposit",
  amount: 100,
  currency: "PKR",
  narration: "cash entry",
  type: "payment",
};

const legRowsOf = (html: string, side: "DR" | "CR") => (html.match(new RegExp(`<tr data-side="${side}">`, "g")) || []).length;

describe("Roznamcha voucher - one side or both, exactly as stored", () => {
  it("a one-sided CR cash entry lists the CR leg only, on both copies", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, crLines: [{ code: "UAE-DUB-AC-0002", name: "Cash", amount: 1200000, narration: null }] },
      lang: "en",
    });
    expect(legRowsOf(html, "CR")).toBe(2);
    expect(legRowsOf(html, "DR")).toBe(0);
  });

  it("a one-sided DR cash entry lists the DR leg only, on both copies", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, type: "receipt", drLines: [{ code: "9101", name: "Cash in Hand", amount: 100, narration: null }] },
      lang: "en",
    });
    expect(legRowsOf(html, "DR")).toBe(2);
    expect(legRowsOf(html, "CR")).toBe(0);
  });

  it("a two-leg posting lists both sides", () => {
    const html = buildRoznamchaVoucherHtml({
      data: {
        ...base,
        drLines: [{ code: "UAE-DUB-AC-0007", name: "Expense", amount: 138.08, narration: null }],
        crLines: [{ code: "UAE-DUB-AC-0008", name: "Bank", amount: 138.08, narration: null }],
      },
      lang: "en",
    });
    expect(legRowsOf(html, "DR")).toBe(2);
    expect(legRowsOf(html, "CR")).toBe(2);
  });

  it("legacy single DR / CR fields still list their side", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, drAccountCode: "DR-9", drAccountName: "Legacy Debit", crAccountCode: "CR-9", crAccountName: "Legacy Credit" },
      lang: "en",
    });
    expect(html).toContain("Legacy Debit");
    expect(html).toContain("Legacy Credit");
  });
});
