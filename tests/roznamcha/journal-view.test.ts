import { describe, expect, it } from "vitest";
import {
  EMPTY_JOURNAL_FILTERS, entriesWithLines, filterJournalEntries, journalFilterOptions, lineUsdValue, pageSlice, summarizeJournalUsd,
} from "@/features/roznamcha/lib/journal-view";

const line = (over: Record<string, unknown>) => ({ debit: "0", credit: "0", currency: "AED", ...over });
const entry = (id: string, lines: any[], over: Record<string, unknown> = {}) => ({ id, voucher_no: `V-${id}`, roznamcha_lines: lines, city_branches: { code: "DEI-001" }, ...over });

// the table's own USD cell expression (cash-entry-form.tsx "USD Credit" / "USD Debit"), copied verbatim for the comparison
function tableUsd(row: any, l: any, amountVal: number) {
  const lineExchangeRate = l.exchange_rate ?? l.usd_rate ?? row.exchange_rate ?? null;
  const lineUsdAmount = l.usd_amount ?? (lineExchangeRate ? amountVal / Number(lineExchangeRate) : null);
  return lineUsdAmount ? Number(lineUsdAmount) : lineExchangeRate ? amountVal / Number(lineExchangeRate) : null;
}

describe("Cash Journal design helpers — view only", () => {
  const rows = [
    entry("1", [line({ debit: "150", usd_amount: "150" }), line({ credit: "150", usd_amount: "150" })]),
    entry("2", [line({ debit: "367.25", currency: "AED", exchange_rate: "3.6725" }), line({ credit: "367.25", currency: "AED", exchange_rate: "3.6725" })], { city_branches: { code: "AE-2" } }),
    entry("3", [line({ debit: "500", currency: "PKR" }), line({ credit: "500", currency: "PKR" })]), // no rate recorded
    entry("4", []), // posted header without lines: never renders a table row
  ];

  it("empty search + empty filters returns the same array (behaviour identical to before the design)", () => {
    expect(filterJournalEntries(rows, "", EMPTY_JOURNAL_FILTERS)).toBe(rows);
    expect(filterJournalEntries(rows, "   ", EMPTY_JOURNAL_FILTERS)).toBe(rows);
  });

  it("type / currency / branch / reference filters only narrow the loaded rows", () => {
    expect(filterJournalEntries(rows, "", { ...EMPTY_JOURNAL_FILTERS, type: "credit" }).map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(filterJournalEntries(rows, "", { ...EMPTY_JOURNAL_FILTERS, currency: "PKR" }).map((r) => r.id)).toEqual(["3"]);
    expect(filterJournalEntries(rows, "", { ...EMPTY_JOURNAL_FILTERS, branch: "AE-2" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterJournalEntries(rows, "", { ...EMPTY_JOURNAL_FILTERS, reference: "v-3" }).map((r) => r.id)).toEqual(["3"]);
    expect(filterJournalEntries(rows, "v-1", EMPTY_JOURNAL_FILTERS).map((r) => r.id)).toEqual(["1"]);
    // combined criteria are ANDed
    expect(filterJournalEntries(rows, "", { type: "debit", currency: "AED", branch: "DEI-001", reference: "" }).map((r) => r.id)).toEqual(["1"]);
  });

  it("filter options come only from the loaded rows", () => {
    expect(journalFilterOptions(rows)).toEqual({ currencies: ["AED", "PKR"], branches: ["AE-2", "DEI-001"] });
    expect(journalFilterOptions([])).toEqual({ currencies: [], branches: [] });
  });

  it("per-line USD value is exactly the value the table prints", () => {
    for (const r of rows) for (const l of r.roznamcha_lines) {
      for (const amt of [Number(l.debit), Number(l.credit)]) if (amt > 0) expect(lineUsdValue(r, l, amt)).toBe(tableUsd(r, l, amt));
    }
  });

  it("Amount & Payment = sum of the table's USD columns; lines without a rate are counted, never converted", () => {
    const s = summarizeJournalUsd(rows);
    let credit = 0, debit = 0, missing = 0;
    for (const r of rows) for (const l of r.roznamcha_lines) {
      const c = Number(l.credit), d = Number(l.debit);
      if (c > 0) { const u = tableUsd(r, l, c); if (u === null) missing++; else credit += u; }
      if (d > 0) { const u = tableUsd(r, l, d); if (u === null) missing++; else debit += u; }
    }
    expect(s.credit).toBeCloseTo(credit, 8);
    expect(s.debit).toBeCloseTo(debit, 8);
    expect(s.missingRate).toBe(missing);
    expect(s.missingRate).toBe(2); // the two PKR lines have no recorded rate
    expect(s.credit).toBeCloseTo(150 + 100, 6); // 150 USD + 367.25 / 3.6725
    expect(s.creditCount).toBe(3);
    expect(s.debitCount).toBe(3);
  });

  it("paging runs over entries that carry lines and never produces blank pages", () => {
    const many = Array.from({ length: 53 }, (_, i) => entry(String(i), i % 2 ? [line({ debit: "1" })] : []));
    const withLines = entriesWithLines(many);
    expect(withLines.length).toBe(26);
    const p1 = pageSlice(withLines, 1, 10);
    expect(p1.rows.length).toBe(10);
    expect(p1.pages).toBe(3);
    expect(pageSlice(withLines, 3, 10).rows.length).toBe(6);
    expect(pageSlice(withLines, 99, 10).page).toBe(3); // clamped
    expect(pageSlice([], 5, 25)).toEqual({ rows: [], page: 1, pages: 1 });
  });
});
