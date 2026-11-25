import { describe, expect, it } from "vitest";
import { buildPaymentVoucherCopies } from "@/lib/reports/payment-voucher-copies";
import { postedPaymentVoucherSides } from "@/lib/reports/payment-voucher-data";

const dr = { ledger_id: "dr", ledger_name: "Cash <Desk>", ledger_code: "C001", account_number: "ACC-DR-101", debit: "125.5000", credit: "0", currency: "AED" };
const cr = { ledger_id: "cr", ledger_name: "Customer North", ledger_code: "R001", account_number: "ACC-CR-201", debit: "0", credit: "125.5", currency: "AED" };
const details = { number: "VCH-101", date: "2026-11-25", bill: "SB-101", party: "Customer", source: "Sales Booking", documentKind: "sales" as const, goodsNames: ["Walnuts", "<Almonds>", "Walnuts"] };

describe("detachable copies for one posted payment", () => {
  it("identifies DR and CR from actual posted sides, regardless of row order", () => {
    expect(postedPaymentVoucherSides([cr, dr])).toEqual({
      debit: { name: "Cash <Desk>", code: "C001", accountNumber: "ACC-DR-101", amount: 125.5, currency: "AED" },
      credit: { name: "Customer North", code: "R001", accountNumber: "ACC-CR-201", amount: 125.5, currency: "AED" },
    });
  });

  it.each([[dr], [cr, dr, { ...cr, ledger_id: "a-third-ledger" }], [cr, { ...dr, debit: "100" }], [cr, { ...dr, currency: "USD" }], [cr, { ...dr, ledger_id: cr.ledger_id }], [cr, { ...dr, ledger_name: "" }]].map(lines => ({ lines })))("never invents a valid pair: $lines", ({ lines }) => {
    expect(postedPaymentVoucherSides(lines)).toBeUndefined();
  });

  it("prints DR above the cut and CR below it, each with the same voucher and its own account", () => {
    const html = buildPaymentVoucherCopies({ ...details, ...postedPaymentVoucherSides([cr, dr])! }, "en");
    const split = html.split('<div class="payment-cut">');
    expect(split[0]).toContain('data-side="DR"');
    expect(split[0]).toContain("Cash &lt;Desk&gt;");
    expect(split[0]).not.toContain("Customer North");
    expect(split[0]).toContain("ACC-DR-101");
    expect(split[0]).not.toContain("ACC-CR-201");
    expect(split[1]).toContain('data-side="CR"');
    expect(split[1]).toContain("Customer North");
    expect(split[1]).not.toContain("Cash &lt;Desk&gt;");
    expect(split[1]).toContain("ACC-CR-201");
    expect(split[1]).not.toContain("ACC-DR-101");
    for (const copy of split) {
      expect(copy).toContain("VCH-101");
      expect(copy).toContain("AED 125.50");
      expect(copy).toContain("SB-101");
      expect(copy).toContain("Sales No.");
      expect(copy).toContain("Goods Name");
      expect(copy).toContain("&lt;Almonds&gt;");
      expect(copy.match(/<bdi>Walnuts<\/bdi>/g)).toHaveLength(1);
    }
  });
  it("labels Purchase No. and doesn't relabel a ledger code as a missing account number", () => {
    const html = buildPaymentVoucherCopies({ ...details, documentKind: "purchase", ...postedPaymentVoucherSides([cr, { ...dr, account_number: "" }])! }, "en");
    expect(html).toContain("Purchase No.");
    expect(html).not.toContain("Sales No.");
    expect(html).toContain("Account Number</dt><dd><bdi>—");
    expect(html).toContain("Account Code</dt><dd><bdi>C001");
  });

  it("keeps top/bottom ordering in Urdu", () => {
    const html = buildPaymentVoucherCopies({ ...details, ...postedPaymentVoucherSides([cr, dr])! }, "ur");
    expect(html).toContain('<html lang="ur" dir="rtl"');
    expect(html.indexOf('data-side="DR" aria-label')).toBeLessThan(html.indexOf('data-side="CR" aria-label'));
    expect(html).not.toContain("Cut here");
  });

  it.each(["en", "ur"] as const)("links both %s slips to unabridged long details without changing exact identifiers", (lang) => {
    const goods = Array.from({ length: 35 }, (_, index) => `LOT-${index + 1} Premium apricot and walnut kernels`);
    const longReference = "Original settlement paperwork reference ".repeat(3) + "REFERENCE-END";
    const html = buildPaymentVoucherCopies({
      ...details, ...postedPaymentVoucherSides([cr, dr])!, goodsNames: goods,
      reference: longReference,
    }, lang);
    const [sheet, appendix] = html.split('<article class="pdf-block payment-voucher-appendix" data-splittable>');
    expect(sheet).toContain('data-scroll-print-preview="true"');
    expect(sheet).not.toContain('name="erp-page-count" content="1"');
    expect(sheet).toContain('data-side="DR"');
    expect(sheet).toContain('data-side="CR"');
    expect(sheet).not.toContain("REFERENCE-END");
    expect(sheet).not.toContain("LOT-35");
    expect(appendix).toContain("VCH-101");
    expect(appendix).toContain("SB-101");
    expect(appendix).toContain(longReference);
    for (const name of goods) expect(appendix).toContain(name);
  });
});
