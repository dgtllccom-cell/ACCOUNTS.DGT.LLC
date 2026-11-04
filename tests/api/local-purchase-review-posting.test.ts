// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  purchase: {} as any, queries: [] as string[], postedLines: [] as any[], deny: false,
  acceptanceWrites: 0, release: vi.fn(), commit: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ ErpAuthError: class extends Error {}, getCurrentErpSession: async () => null, requireErpSession: async () => ({ userId: "user-1", countryIds: [], cityBranchIds: [] }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: () => { if (state.deny) throw new Error("Forbidden"); } }));
vi.mock("@/lib/api/idempotency", () => ({
  acquireIdempotencyLock: async () => ({ acquired: true, isReplayed: false, idempotencyKey: "action", tenantHash: "tenant" }),
  commitIdempotencySuccess: state.commit, releaseIdempotencyLock: state.release,
  buildReplayedResponse: vi.fn(),
}));
vi.mock("@/lib/services/goods-transfer-service", () => ({ ensureLotsForPurchase: vi.fn() }));
vi.mock("@/lib/i18n/record-translation-sync", () => ({ syncRecordTranslations: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  rpc: async () => ({ data: "serial-1", error: null }),
  from: () => {
    let update: any;
    const q: any = {
      select: () => q, eq: () => q, is: () => q,
      update: (value: any) => { update = value; state.acceptanceWrites++; return q; },
      single: async () => {
        if (update) state.purchase = { ...state.purchase, ...update };
        return { data: state.purchase, error: null };
      },
    };
    return q;
  },
}) }));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: async (fn: any) => {
  const tx: any = async (strings: TemplateStringsArray, ...values: any[]) => {
    const query = strings.join("?"); state.queries.push(query);
    if (query.includes("select *") && query.includes("from local_purchases")) return [{ ...state.purchase }];
    if (query.includes("from ledgers") && query.includes("where code")) {
      const dr = values[0] === "DR-1";
      return [{ id: dr ? "ledger-dr" : "ledger-cr", enterprise_account_id: dr ? "account-dr" : "account-cr", country_id: null }];
    }
    if (query.includes("post_roznamcha_entry(")) { state.postedLines = values.find(Array.isArray) || []; return [{ id: "roz-1" }]; }
    if (query.includes("update local_purchases")) {
      state.purchase = { ...state.purchase, status: "posted", roznamcha_entry_id: "roz-1" };
      return [state.purchase];
    }
    return [];
  };
  tx.begin = (fn: any) => fn(tx); tx.savepoint = (fn: any) => fn(tx); tx.json = (value: any) => value;
  return fn(tx);
} }));

import { POST as accept } from "@/app/api/erp/purchases/local-purchase/accept/route";
import { POST as post } from "@/app/api/erp/purchases/local-purchase/transfer/route";
const id = "11111111-1111-4111-8111-111111111111";
const request = (reviewed?: boolean) => new NextRequest("http://localhost/api/erp/purchases/local-purchase/transfer", {
  method: "POST", body: JSON.stringify({ purchaseId: id, ...(reviewed === undefined ? {} : { reviewed }) }),
});
beforeEach(() => {
  state.purchase = { id, status: "draft", goods_name: "Walnuts", final_cost: 100, local_currency: "AED", purchase_account_no: "DR-1", sales_account_no: "CR-1" };
  state.queries = []; state.postedLines = []; state.deny = false; state.acceptanceWrites = 0;
  vi.clearAllMocks();
});

describe("Local Purchase two-stage transfer", () => {
  it("first transfer queues the original bill without posting financial entries", async () => {
    const response = await accept(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.purchase).toMatchObject({ id, status: "accepted" });
    expect(state.purchase.roznamcha_entry_id).toBeUndefined();
    expect(state.queries).toEqual([]);
  });
  it("retries the first transfer without changing serials or making another bill", async () => {
    await accept(request());
    const writes = state.acceptanceWrites;
    const serial = state.purchase.journal_serial_no;
    expect((await accept(request())).status).toBe(200);
    expect(state.acceptanceWrites).toBe(writes);
    expect(state.purchase.journal_serial_no).toBe(serial);
  });
  it("checks scope before replaying an accepted bill", async () => {
    state.purchase.status = "accepted"; state.deny = true;
    expect((await accept(request())).status).not.toBe(200);
    expect(state.acceptanceWrites).toBe(0);
  });
  it("rejects stale direct-post requests without verification", async () => {
    state.purchase.status = "accepted";
    expect((await post(request())).status).toBe(422);
    expect(state.queries).toEqual([]);
  });
  it("rejects a draft even when the request claims verification", async () => {
    const response = await post(request(true));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("REVIEW_REQUIRED");
    expect(state.postedLines).toEqual([]);
  });
  it("posts the reviewed queued bill with the selected DR/CR once", async () => {
    await accept(request());
    expect((await post(request(true))).status).toBe(200);
    expect(state.postedLines).toMatchObject([
      { ledgerId: "ledger-dr", debit: 100, credit: 0 },
      { ledgerId: "ledger-cr", debit: 0, credit: 100 },
    ]);
    const posts = state.queries.filter(query => query.includes("post_roznamcha_entry(")).length;
    const repeat = await post(request(true));
    expect(repeat.status).toBe(409);
    expect((await repeat.json()).error.code).toBe("ALREADY_POSTED");
    expect(state.queries.filter(query => query.includes("post_roznamcha_entry("))).toHaveLength(posts);
  });
  it("rejects financial posting outside the user's scope", async () => {
    state.purchase.status = "accepted"; state.deny = true;
    expect((await post(request(true))).status).not.toBe(200);
    expect(state.postedLines).toEqual([]);
  });
});
