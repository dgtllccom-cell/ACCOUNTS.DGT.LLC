import { describe, expect, it } from "vitest";
import { buildRoznamchaVoucherHtml, type RoznamchaVoucherData } from "@/lib/reports/open-roznamcha-voucher-print-report";

/**
 * The Roznamcha print template is read-only: it only DISPLAYS the entry it is given.
 * These tests pin that behaviour - every DR / CR leg of the entry is printed exactly as the entry carries it,
 * optional cheque / bank / party-ID blocks appear only when their data exists, and free text is escaped.
 */

const base: RoznamchaVoucherData = {
  receiptNo: "BNK-00000370",
  date: "2026-10-31",
  accountNo: "1001",
  accountName: "Cash in Hand",
  amount: 1000,
  currency: "AED",
  narration: "Test narration",
  type: "payment",
};

const leg = (code: string, name: string, amount: number) => ({ code, name, amount, narration: null });

describe("Roznamcha print template - each entry prints its own DR / CR legs", () => {
  it("1 DR vs 10 CR: every CR leg and the single DR leg are printed", () => {
    const crLines = Array.from({ length: 10 }, (_, i) => leg(`CR-${i + 1}`, `Customer ${i + 1}`, 100 * (i + 1)));
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, amount: 5500, drLines: [leg("DR-1", "Bank Main", 5500)], crLines },
      lang: "en",
    });
    expect(html).toContain("DR-1");
    expect(html).toContain("Bank Main");
    for (let i = 1; i <= 10; i++) {
      expect(html).toContain(`CR-${i}`);
      expect(html).toContain(`Customer ${i}`);
    }
  });

  it("1 CR vs 3 DR: every DR leg is printed and the CR leg too", () => {
    const drLines = [leg("DR-A", "Expense A", 300), leg("DR-B", "Expense B", 200), leg("DR-C", "Expense C", 500)];
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, amount: 1000, drLines, crLines: [leg("CR-X", "Cash Account", 1000)] },
      lang: "en",
    });
    for (const code of ["DR-A", "DR-B", "DR-C", "CR-X"]) expect(html).toContain(code);
  });

  it("falls back to the single legacy DR / CR fields when no leg list is supplied", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, drAccountCode: "DR-9", drAccountName: "Legacy Debit", crAccountCode: "CR-9", crAccountName: "Legacy Credit" },
      lang: "en",
    });
    expect(html).toContain("Legacy Debit");
    expect(html).toContain("Legacy Credit");
  });
});

describe("Roznamcha print template - optional blocks appear only with real data", () => {
  it("prints no cheque / accounting / party-ID blocks for a plain cash entry", () => {
    const html = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(html).not.toContain('class="cheque-block"');
    expect(html).not.toContain('class="accounting-block"');
    expect(html).not.toContain('class="party-id-block"');
    expect(html).not.toContain("Cheque No.");
  });

  it("prints the cheque block with cheque number, date, bank and branch when present", () => {
    const html = buildRoznamchaVoucherHtml({
      data: {
        ...base,
        chequeNo: "000201",
        chequeDate: "2026-10-15",
        bankName: "Emirates NBD",
        bankBranchName: "Deira",
        chequeStatus: "received",
      },
      lang: "en",
    });
    expect(html).toContain('class="cheque-block"');
    expect(html).toContain("000201");
    expect(html).toContain("Emirates NBD");
    expect(html).toContain("Deira");
    expect(html).toContain("RECEIVED");
  });

  it("prints the party ID image and number only when they are supplied", () => {
    const withId = buildRoznamchaVoucherHtml({
      data: { ...base, partyIdLabel: "Emirates ID", partyIdNumber: "784-1990-1234567-8", partyIdImageUrl: "https://files.example.test/id.png" },
      lang: "en",
    });
    expect(withId).toContain('class="party-id-block"');
    expect(withId).toContain("784-1990-1234567-8");
    expect(withId).toContain('src="https://files.example.test/id.png"');

    // assert on the rendered element, not the class name (the stylesheet always declares .party-id-img)
    const withoutId = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(withoutId).not.toContain('alt="Party ID"');
  });
});

describe("Roznamcha print template - safety and layout", () => {
  it("escapes free-text fields so a narration cannot inject markup", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, narration: '<img src=x onerror="alert(1)">' },
      lang: "en",
    });
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img");
  });

  it("prints both the office copy and the customer copy on one A4 sheet", () => {
    const html = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(html).toContain("OFFICE COPY");
    expect(html).toContain("CUSTOMER COPY");
    expect(html).toContain("size: A4 portrait");
  });

  it("sets right-to-left direction for ur / ar / fa / ps", () => {
    expect(buildRoznamchaVoucherHtml({ data: base, lang: "ur" })).toContain('dir="rtl"');
    expect(buildRoznamchaVoucherHtml({ data: base, lang: "en" })).toContain('dir="ltr"');
  });
});
