import { describe, expect, it } from "vitest";
import { buildPaymentVoucherCopies } from "@/lib/reports/payment-voucher-copies";
import { postedPaymentVoucherSides } from "@/lib/reports/payment-voucher-data";

const dr = { ledger_id: "dr", ledger_name: "Cash <Desk>", ledger_code: "C001", debit: "125.5000", credit: "0", currency: "AED" };
const cr = { ledger_id: "cr", ledger_name: "Customer North", ledger_code: "R001", debit: "0", credit: "125.5", currency: "AED" };
const details = { number: "VCH-101", date: "2026-11-25", bill: "SB-101", party: "Customer", source: "Sales Booking" };

describe("detachable copies for one posted payment", () => {
  it("identifies DR and CR from actual posted sides, regardless of row order", () => {
    expect(postedPaymentVoucherSides([cr, dr])).toEqual({
      debit: { name: "Cash <Desk>", code: "C001", amount: 125.5, currency: "AED" },
      credit: { name: "Customer North", code: "R001", amount: 125.5, currency: "AED" },
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
    expect(split[1]).toContain('data-side="CR"');
    expect(split[1]).toContain("Customer North");
    expect(split[1]).not.toContain("Cash &lt;Desk&gt;");
    for (const copy of split) {
      expect(copy).toContain("VCH-101");
      expect(copy).toContain("AED 125.50");
      expect(copy).toContain("SB-101");
    }
  });

  it("keeps top/bottom ordering in Urdu", () => {
    const html = buildPaymentVoucherCopies({ ...details, ...postedPaymentVoucherSides([cr, dr])! }, "ur");
    expect(html).toContain('<html lang="ur" dir="rtl"');
    expect(html.indexOf('data-side="DR" aria-label')).toBeLessThan(html.indexOf('data-side="CR" aria-label'));
    expect(html).not.toContain("Cut here");
  });
});
