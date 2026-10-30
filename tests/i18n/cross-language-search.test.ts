import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cross-language name search (Priority 1 multilingual work).
 *
 * `translationMatchSet` / `ledgerRowNameMatcher` widen an in-memory search with the record ids whose
 * stored translation (any of the five languages, or the original entry) matches the typed term.
 * The database is faked at the shared pool: it answers by record table, so the test pins the
 * behaviour that matters — which ids are produced and how a row is matched — not SQL text.
 */

const queries: Array<{ table: string; fields: string[]; like: string; limit: number }> = [];
let byTable: Record<string, string[]> = {};
let failNext = false;

vi.mock("@/lib/db/local-postgres", () => ({
  getSharedPg: () => ({
    unsafe: async (_sql: string, params: any[]) => {
      if (failNext) {
        failNext = false;
        throw new Error("db down");
      }
      queries.push({ table: params[0], fields: params[1], like: params[2], limit: params[3] });
      return (byTable[params[0]] ?? []).map((record_id) => ({ record_id }));
    },
  }),
}));

import { ledgerRowNameMatcher, translationMatchSet } from "@/lib/i18n/localize-records";

beforeEach(() => {
  queries.length = 0;
  byTable = {};
  failNext = false;
  process.env.DATABASE_URL = "postgres://test";
});

describe("translationMatchSet", () => {
  it("returns null for an empty term so callers can skip the extra work", async () => {
    expect(await translationMatchSet("enterprise_accounts", ["name"], "   ")).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it("matches the record ids stored for a name typed in Urdu", async () => {
    byTable = { enterprise_accounts: ["acc-1", "acc-2"] };
    const set = await translationMatchSet("enterprise_accounts", ["name"], " احمد ");
    expect(set).toEqual(new Set(["acc-1", "acc-2"]));
    expect(queries[0]).toMatchObject({ table: "enterprise_accounts", fields: ["name"], like: "%احمد%" });
  });

  it("unions several tables into one set", async () => {
    byTable = { customers: ["c1"], companies: ["co1", "c1"] };
    const set = await translationMatchSet(["customers", "companies"], ["name"], "gul");
    expect(set).toEqual(new Set(["c1", "co1"]));
  });

  it("never throws — a lookup failure just means no extra matches", async () => {
    failNext = true;
    const set = await translationMatchSet("enterprise_accounts", ["name"], "gul");
    expect(set).toEqual(new Set());
  });
});

describe("ledgerRowNameMatcher", () => {
  it("is null when there is no term", async () => {
    expect(await ledgerRowNameMatcher("")).toBeNull();
  });

  it("matches a row through its ledger, its account or its company", async () => {
    byTable = { ledgers: ["L1"], enterprise_accounts: ["A1"], companies: ["K1"] };
    const match = await ledgerRowNameMatcher("ahmad");
    expect(match).not.toBeNull();
    expect(match!({ ledgerId: "L1", accountId: "x", companyId: "y" })).toBe(true);
    expect(match!({ ledgerId: "x", accountId: "A1", companyId: "y" })).toBe(true);
    expect(match!({ ledgerId: "x", accountId: "y", companyId: "K1" })).toBe(true);
  });

  it("does not match unrelated rows or rows with missing ids", async () => {
    byTable = { ledgers: ["L1"], enterprise_accounts: ["A1"], companies: ["K1"] };
    const match = await ledgerRowNameMatcher("ahmad");
    expect(match!({ ledgerId: "L2", accountId: "A2", companyId: "K2" })).toBe(false);
    expect(match!({ ledgerId: null, accountId: null, companyId: null })).toBe(false);
    expect(match!({})).toBe(false);
  });
});
