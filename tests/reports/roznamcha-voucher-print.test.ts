import { describe, expect, it } from "vitest";
import { buildRoznamchaVoucherHtml, type RoznamchaVoucherData } from "@/lib/reports/open-roznamcha-voucher-print-report";

/**
 * The Roznamcha voucher is read-only: it DISPLAYS the entry it is given, copy for the company and the customer,
 * on one A4 landscape sheet. Every DR / CR leg of the entry is printed exactly as stored; optional values are
 * shown only when the entry carries them ("—" otherwise); free text is escaped.
 */

const base: RoznamchaVoucherData = {
  receiptNo: "CP-000569",
  date: "2026-10-15",
  accountNo: "9101",
  accountName: "Import Duty Deposit",
  paidBy: "Al Noor Trading FZE",
  amount: 1000,
  currency: "AED",
  narration: "Purchase Invoice – PI-3087",
  type: "payment",
};

const leg = (code: string, name: string, amount: number) => ({ code, name, amount, narration: null });

describe("Roznamcha voucher - each entry prints its own DR / CR legs", () => {
  it("1 DR vs 10 CR: every CR leg and the single DR leg are printed", () => {
    const crLines = Array.from({ length: 10 }, (_, i) => leg(`CR-${i + 1}`, `Customer ${i + 1}`, 100 * (i + 1)));
    const html = buildRoznamchaVoucherHtml({ data: { ...base, amount: 5500, drLines: [leg("DR-1", "Bank Main", 5500)], crLines }, lang: "en" });
    expect(html).toContain("DR-1");
    expect(html).toContain("Bank Main");
    for (let i = 1; i <= 10; i++) {
      expect(html).toContain(`CR-${i}`);
      expect(html).toContain(`Customer ${i}`);
    }
  });

  it("1 CR vs 3 DR: every DR leg is printed and the CR leg too", () => {
    const drLines = [leg("DR-A", "Expense A", 300), leg("DR-B", "Expense B", 200), leg("DR-C", "Expense C", 500)];
    const html = buildRoznamchaVoucherHtml({ data: { ...base, amount: 1000, drLines, crLines: [leg("CR-X", "Cash Account", 1000)] }, lang: "en" });
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

describe("Roznamcha voucher - optional values appear only when the entry carries them", () => {
  it("a plain cash entry shows dashes, not invented cheque, bank or ID values", () => {
    const html = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(html).not.toContain('class="id-photo"');
    expect(html).not.toContain("000201");
    // the party's contact and trade licence are not on this entry, so they print as a dash
    expect(html).toContain("Contact / WhatsApp");
    expect(html).toContain("<td>—</td>");
  });

  it("prints the cheque number, bank and branch when the entry carries them", () => {
    const html = buildRoznamchaVoucherHtml({
      data: { ...base, chequeNo: "000201", chequeDate: "2026-10-15", bankName: "Emirates NBD", bankBranchName: "Deira", paymentMethodName: "Cheque" },
      lang: "en",
    });
    expect(html).toContain("000201");
    expect(html).toContain("Emirates NBD");
    expect(html).toContain("Deira");
  });

  it("prints the party ID number, and the photo only when one is supplied", () => {
    const withId = buildRoznamchaVoucherHtml({
      data: { ...base, partyIdLabel: "Emirates ID", partyIdNumber: "784-1990-1234567-8", partyIdImageUrl: "https://files.example.test/id.png" },
      lang: "en",
    });
    expect(withId).toContain("784-1990-1234567-8");
    expect(withId).toContain('src="https://files.example.test/id.png"');
    expect(withId).toContain('class="id-photo"');

    const withoutId = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(withoutId).not.toContain('class="id-photo"');
  });

  it("ticks the payment method only from the entry's own method", () => {
    const tickCount = (html: string) => html.split('class="box">✓').length - 1;
    expect(tickCount(buildRoznamchaVoucherHtml({ data: { ...base, paymentMethodName: "Cash" }, lang: "en" }))).toBe(2);
    expect(tickCount(buildRoznamchaVoucherHtml({ data: { ...base, paymentMethodName: "Cheque" }, lang: "en" }))).toBe(2);
    expect(tickCount(buildRoznamchaVoucherHtml({ data: base, lang: "en" }))).toBe(0);
  });
});

describe("Roznamcha voucher - layout and safety", () => {
  it("escapes free-text fields so a narration cannot inject markup", () => {
    const html = buildRoznamchaVoucherHtml({ data: { ...base, narration: '<img src=x onerror="alert(1)">' }, lang: "en" });
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img");
  });

  it("prints the company copy and the customer copy side by side on one A4 landscape sheet", () => {
    const html = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(html).toContain("Company Copy");
    expect(html).toContain("Customer Copy");
    expect(html).toContain("size: A4 landscape");
    expect((html.match(/<section class="copy">/g) || []).length).toBe(2);
  });

  it("sets right-to-left direction for ur / ar / fa / ps and left-to-right for en", () => {
    expect(buildRoznamchaVoucherHtml({ data: base, lang: "ur" })).toContain('dir="rtl"');
    expect(buildRoznamchaVoucherHtml({ data: base, lang: "en" })).toContain('dir="ltr"');
  });

  it("prints the amount in words and the remarks", () => {
    const html = buildRoznamchaVoucherHtml({ data: base, lang: "en" });
    expect(html).toContain("Purchase Invoice – PI-3087");
    expect(html).toContain("One Thousand");
  });
});
