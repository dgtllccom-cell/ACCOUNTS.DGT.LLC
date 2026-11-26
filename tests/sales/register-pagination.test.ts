import { describe, expect, it, vi } from "vitest";
import { loadScopedRegister, parseRegisterPage, registerPageParams, splitRegisterPage } from "@/lib/sales/register-pagination";

const at = "2026-11-25T06:00:00.123456Z";
const record = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  register_cursor_timestamp: at,
});

describe("scoped Sales register pages", () => {
  it("preserves legacy contract; opts in with a UUID and full-precision date cursor", () => {
    expect(parseRegisterPage(new URLSearchParams())).toEqual({ enabled: false, cursor: null });
    const cursor = { at, id: record(3).id };
    expect(parseRegisterPage(registerPageParams(cursor))).toEqual({ enabled: true, cursor });
    expect(() => parseRegisterPage(new URLSearchParams({ registerPage: "1", cursorAt: at }))).toThrow();
    expect(splitRegisterPage([record(4), record(3), record(2)], 2, true)).toEqual({ rows: [record(4), record(3)], nextCursor: cursor });
    expect(splitRegisterPage([record(4), record(3)], 2, true).nextCursor).toBeNull();
  });

  it("does not drop results found beyond the first page across 200 countries", async () => {
    const all = Array.from({ length: 400 }, (_, i) => ({ ...record(400 - i), country: `Country ${i % 200}` }));
    const read = vi.fn(async (cursor: { at: string; id: string } | null) => {
      const start = cursor ? all.findIndex(row => row.id === cursor.id) + 1 : 0;
      return splitRegisterPage(all.slice(start, start + 81), 80, true);
    });
    expect(await loadScopedRegister(read)).toEqual({ rows: all, complete: true });
    expect(read).toHaveBeenCalledTimes(5);
    expect((await loadScopedRegister(read, { maxRows: 120 }))).toEqual({ rows: all.slice(0, 120), complete: false });
  });

  it("rejects repeated cursors rather than looping or falsely reporting complete", async () => {
    const cursor = { at, id: record(1).id };
    await expect(loadScopedRegister(async () => ({ rows: [record(1)], nextCursor: cursor }))).rejects.toThrow(/non-advancing/);
  });
});
