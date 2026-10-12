/**
 * Cash Journal — PURE view helpers (no I/O, no accounting decisions).
 *
 * The design pass added a Filters dialog, an "Amount & Payment" card and paging. All three only look at rows the server-scoped
 * API (/api/erp/roznamcha) already returned. They never post, never convert at a rate of their own (the USD figure of a line is
 * exactly what the table's "USD Credit / USD Debit" columns show) and never fetch. They live here so unit tests can prove that.
 */

export type JournalFilters = { type: "" | "credit" | "debit"; currency: string; branch: string; reference: string };
export const EMPTY_JOURNAL_FILTERS: JournalFilters = { type: "", currency: "", branch: "", reference: "" };

type AnyRow = any;

/** Branch code shown in the table's "Branch Code" column (no invented fallback). */
export function branchCodeOfEntry(row: AnyRow): string {
  return String(row?.city_branches?.code || row?.country_branches?.code || row?.countries?.iso2 || "");
}

/** Top-bar search + Filters dialog. With an empty query and empty filters the SAME array is returned (identical behaviour to before). */
export function filterJournalEntries(entries: AnyRow[], query: string, filters: JournalFilters): AnyRow[] {
  const q = query.trim().toLowerCase();
  const ref = filters.reference.trim().toLowerCase();
  const hasFilter = Boolean(filters.type || filters.currency || filters.branch || ref);
  if (!q && !hasFilter) return entries;
  return entries.filter((row) => {
    if (hasFilter) {
      const lines: AnyRow[] = row.roznamcha_lines || [];
      if (filters.type === "credit" && !lines.some((l) => Number(l.credit || 0) > 0)) return false;
      if (filters.type === "debit" && !lines.some((l) => Number(l.debit || 0) > 0)) return false;
      if (filters.currency && !lines.some((l) => String(l.currency || "").toUpperCase() === filters.currency)) return false;
      if (filters.branch && branchCodeOfEntry(row) !== filters.branch) return false;
      if (ref) {
        const refHay = [
          row.voucher_no, row.journal_no, row.reference_no, row.source_reference_no,
          row.super_admin_serial_number, row.country_transaction_serial_number, row.branch_transaction_serial_number,
          ...lines.flatMap((l) => [l.account_number, l.entry_serial_number, l.manual_reference_number]),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!refHay.includes(ref)) return false;
      }
    }
    if (!q) return true;
    const haystack = [
      row.voucher_no, row.journal_no, row.super_admin_serial_number, row.country_transaction_serial_number,
      row.branch_transaction_serial_number, row.narration, row.created_by, row.profiles?.full_name,
      ...(row.roznamcha_lines || []).flatMap((line: AnyRow) => [line.account_number, line.ledgers?.name, line.entry_serial_number]),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/** Options for the Filters dialog: only values present in the loaded (already scoped) rows. */
export function journalFilterOptions(entries: AnyRow[]) {
  const currencies = new Set<string>();
  const branches = new Set<string>();
  entries.forEach((row) => {
    (row.roznamcha_lines || []).forEach((l: AnyRow) => { if (l.currency) currencies.add(String(l.currency).toUpperCase()); });
    const b = branchCodeOfEntry(row);
    if (b) branches.add(b);
  });
  return { currencies: [...currencies].sort(), branches: [...branches].sort() };
}

/** USD value of one posted line — the very expression the table uses for its "USD Credit / USD Debit" cells. null = no recorded rate. */
export function lineUsdValue(row: AnyRow, line: AnyRow, amount: number): number | null {
  const rate = line.exchange_rate ?? line.usd_rate ?? row.exchange_rate ?? null;
  const usd = line.usd_amount ?? (rate ? amount / Number(rate) : null);
  return usd ? Number(usd) : rate ? amount / Number(rate) : null;
}

/** "Amount & Payment" card: sums of the table's own USD columns. Lines without a recorded rate are counted, never converted. */
export function summarizeJournalUsd(entries: AnyRow[]) {
  let credit = 0, debit = 0, creditCount = 0, debitCount = 0, missingRate = 0;
  entries.forEach((row) => {
    (row.roznamcha_lines || []).forEach((line: AnyRow) => {
      const d = Number(line.debit || 0);
      const c = Number(line.credit || 0);
      if (c > 0) { creditCount += 1; const u = lineUsdValue(row, line, c); if (u === null) missingRate += 1; else credit += u; }
      if (d > 0) { debitCount += 1; const u = lineUsdValue(row, line, d); if (u === null) missingRate += 1; else debit += u; }
    });
  });
  return { credit, debit, creditCount, debitCount, missingRate };
}

/** The table prints one row per posted line, so paging runs over entries that carry lines (no blank pages). */
export function entriesWithLines(entries: AnyRow[]): AnyRow[] {
  return entries.filter((row) => (row.roznamcha_lines || []).length > 0);
}

export function pageSlice<T>(items: T[], page: number, pageSize: number): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const safe = Math.min(Math.max(1, page), pages);
  return { rows: items.slice((safe - 1) * pageSize, safe * pageSize), page: safe, pages };
}
