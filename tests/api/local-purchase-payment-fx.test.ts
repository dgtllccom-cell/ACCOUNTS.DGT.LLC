// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  calls: [] as { query: string; values: unknown[] }[],
  due: 100,
  rate: 3.67,
  countryCurrency: "AED",
}));
const order = "11111111-1111-4111-8111-111111111111";
const dr = "22222222-2222-4222-8222-222222222222";
const cr = "33333333-3333-4333-8333-333333333333";
const country = "44444444-4444-4444-8444-444444444444";
const posted = "55555555-5555-4555-8555-555555555555";

vi.mock("@/lib/auth/session", () => ({ ErpAuthError: class extends Error {}, requireErpSession: async () => ({ userId: posted }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: () => {} }));
vi.mock("@/lib/api/supabase", () => ({ writeAuditLog: async () => {} }));
vi.mock("@/lib/api/idempotency", () => ({ acquireIdempotencyLock: async () => ({ acquired: true }) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/services/form-serials", () => ({ allocateFormSerials: async () => { throw new Error("not needed"); } }));
vi.mock("@/lib/db/local-postgres", () => ({
  withReadPg: async () => { throw new Error("Unexpected shared connection"); },
  withLocalPg: async (fn: (sql: unknown) => unknown) => {
    const tag = (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join("?").replace(/\s+/g, " ").trim();
      mock.calls.push({ query, values });
      if (query.includes("pg_try_advisory_xact_lock")) return [{ got: true }];
      if (query.includes("from purchase_orders where")) return [];
      if (query.includes("from local_purchases where")) return [{
        id: order, purchase_order_no: "TEST-LP", country_id: country, currency_code: "USD",
        exchange_rate: mock.rate, order_total: 100, total_goods_original: 100, remaining_due: mock.due,
        advance_paid: 0, payment_mode: "Cash", order_type: "local_purchase",
      }];
      if (query.includes("sum(p.amount)")) return [{ paid: 0 }];
      if (query.includes("from ledgers where id")) return [{ id: values[0], country_id: country, name: "TEST" }];
      if (query.includes("select upper(currency_code)")) return [{ c: mock.countryCurrency }];
      if (query.startsWith("select post_roznamcha_entry(") || query.startsWith("insert into purchase_order_payments")) return [{ id: posted }];
      if (query.startsWith("update roznamcha_entries") || query.startsWith("update local_purchases")) return [];
      throw new Error("Unexpected query: " + query);
    };
    return fn(Object.assign(tag, { json: (value: unknown) => value, begin: async (callback: (sql: unknown) => unknown) => callback(tag) }));
  },
}));

import { POST } from "@/app/api/erp/purchases/orders/[id]/payments/route";

async function pay(amount: number, currencyCode: string, exchangeRate: number) {
  const req = new NextRequest("http://localhost/api/erp/purchases/orders/" + order + "/payments", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "remaining", entryDate: "2026-11-26", amount, currencyCode, exchangeRate,
      debitLedgerId: dr, creditLedgerId: cr, referenceNo: "SYNTHETIC" }),
  });
  return POST(req, { params: Promise.resolve({ id: order }) });
}

beforeEach(() => { mock.calls = []; mock.due = 100; mock.rate = 3.67; mock.countryCurrency = "AED"; });

describe("Local Purchase currency posting", () => {
  it.each([3.67, 3.70])("posts already-converted AED once at the booked or entered rate %s", async rate => {
    const tender = Math.round(100 * rate * 100) / 100;
    expect((await pay(tender, "AED", rate)).status).toBe(201);
    const journal = mock.calls.find(c => c.query.startsWith("select post_roznamcha_entry("))!;
    expect(journal.values.at(-1)).toEqual([
      expect.objectContaining({ ledgerId: dr, debit: tender, credit: 0, currency: "AED", exchangeRate: 1 }),
      expect.objectContaining({ ledgerId: cr, debit: 0, credit: tender, currency: "AED", exchangeRate: 1 }),
    ]);
    const payment = mock.calls.find(c => c.query.startsWith("insert into purchase_order_payments"))!;
    expect(payment.values[5]).toBe(1);
    expect(payment.values.at(-2)).toBe(tender);
    const balance = mock.calls.find(c => c.query.startsWith("update local_purchases"))!;
    expect(balance.values[1]).toBe(100);
    expect(balance.values[3]).toBe(100);
  });
  it("refuses an excess cent before making any payment or journal write", async () => {
    mock.due = 10;
    expect((await pay(10.01, "USD", 3.67)).status).not.toBe(201);
    expect(mock.calls.some(c => /^(insert|update|select post_roznamcha_entry)/.test(c.query))).toBe(false);
  });
  it("posts an exact one-cent remainder", async () => {
    mock.due = 0.01;
    expect((await pay(0.01, "USD", 3.67)).status).toBe(201);
    expect(mock.calls.find(c => c.query.startsWith("update local_purchases"))?.values[3]).toBe(0.01);
  });
  it("keeps the submitted accounting rate for tender that is not already base currency", async () => {
    expect((await pay(100, "USD", 3.67)).status).toBe(201);
    const payment = mock.calls.find(c => c.query.startsWith("insert into purchase_order_payments"))!;
    expect(payment.values[5]).toBe(3.67);
    expect(payment.values.at(-2)).toBe(367);
  });
});
