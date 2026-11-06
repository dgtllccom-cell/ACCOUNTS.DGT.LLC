import { describe, expect, it } from "vitest";
import { buildRoznamchaVoucherHtml, type RoznamchaVoucherData } from "@/lib/reports/open-roznamcha-voucher-print-report";

/**
 * A Roznamcha cash entry is one-sided: a CR payment or a DR receipt. Its voucher prints only the side it
 * has; the empty side is hidden, never drawn as a blank counter-leg. A purchase / sales / expense posting
 * is stored with both legs and prints both.
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

describe("Roznamcha voucher - one side or both, exactly as stored", () => {
  it("a one-sided CR cash entry hides the DR side", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, crLines: [{ code: "UAE-DUB-AC-0002", name: "Cash", amount: 1200000, narration: null }] },
      lang: "en",
    });
    expect(html).toContain('class="acct-col acct-dr acct-empty"');
    expect(html).not.toContain('class="acct-col acct-cr acct-empty"');
    expect(html).toContain('class="accounting-block"');
    expect(html).toContain('class="acct-grid acct-grid-one"');
  });

  it("a one-sided DR cash entry hides the CR side", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, type: "receipt", drLines: [{ code: "9101", name: "Cash in Hand", amount: 100, narration: null }] },
      lang: "en",
    });
    expect(html).toContain('class="acct-col acct-cr acct-empty"');
    expect(html).not.toContain('class="acct-col acct-dr acct-empty"');
    expect(html).toContain('class="acct-grid acct-grid-one"');
  });

  it("a two-leg posting prints both sides with no hidden column", () => {
    const html = buildRoznamchaVoucherHtml({
      data: {
        ...base,
        drLines: [{ code: "UAE-DUB-AC-0007", name: "Expense", amount: 138.08, narration: null }],
        crLines: [{ code: "UAE-DUB-AC-0008", name: "Bank", amount: 138.08, narration: null }],
      },
      lang: "en",
    });
    expect(html).toContain('class="acct-col acct-dr"');
    expect(html).toContain('class="acct-col acct-cr"');
    expect(html).not.toContain("acct-empty\"");
    expect(html).toContain('class="acct-grid"');
  });

  it("legacy single DR/CR fields still print their side", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, drAccountCode: "DR-9", drAccountName: "Legacy Debit", crAccountCode: "CR-9", crAccountName: "Legacy Credit" },
      lang: "en",
    });
    expect(html).toContain("Legacy Debit");
    expect(html).toContain("Legacy Credit");
    expect(html).not.toContain('class="acct-col acct-dr acct-empty"');
  });
});
