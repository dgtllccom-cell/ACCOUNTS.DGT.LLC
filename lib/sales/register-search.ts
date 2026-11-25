export type RegisterSearchRow = Record<string, string | readonly string[]>;

export function registerSearchOptions(rows: readonly RegisterSearchRow[], key: string) {
  const values = new Set(rows.flatMap(row => Array.isArray(row[key]) ? row[key] as readonly string[] : [String(row[key] ?? "")]));
  return Array.from(values).filter(value => value && value !== "-" && value !== "—").sort((a, b) => a.localeCompare(b))
    .map(value => ({ value, label: value }));
}

export function matchesRegisterSearch(row: RegisterSearchRow, filters: Record<string, string>) {
  return Object.entries(filters).every(([key, input]) => {
    if (!input) return true;
    if (key.endsWith("From") || key.endsWith("To")) {
      const from = key.endsWith("From");
      const field = key.slice(0, from ? -4 : -2);
      const date = String(row[field] ?? "").slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && (from ? date >= input : date <= input);
    }
    if (key === "bookingNo") return String(row[key] ?? "").toLowerCase().includes(input.toLowerCase());
    const value = row[key];
    return Array.isArray(value) ? value.includes(input) : value === input;
  });
}
