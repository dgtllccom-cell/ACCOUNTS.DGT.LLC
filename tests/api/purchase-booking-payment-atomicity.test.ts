// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type StoredPayment = { id: string; orderId: string; amount: number; loadingId?: string; applied?: number; posted: boolean };
type StoredKey = { request_hash: string; status: string; response_body?: unknown };
type LedgerState = { due: number; form: any; orderStatus: string; payments: StoredPayment[]; keys: Record<string, StoredKey> };

const mock = vi.hoisted(() => ({
  committed: { due: 100, form: {}, orderStatus: "pending", payments: [], keys: {} } as LedgerState,
  fault: "" as "loading" | "verification" | "claim" | "commit-ack" | "serial" | "",
  postAttempts: 0,
  auditAttempts: 0,
  auditFails: false,
  fx: false,
  rollbackCount: 0,
}));
const order = "11111111-1111-4111-8111-111111111111";
const dr = "22222222-2222-4222-8222-222222222222";
const cr = "33333333-3333-4333-8333-333333333333";
const country = "44444444-4444-4444-8444-444444444444";
const actor = "55555555-5555-4555-8555-555555555555";
const payment = "66666666-6666-4666-8666-666666666666";
const journal = "77777777-7777-4777-8777-777777777777";
const loading = "88888888-8888-4888-8888-888888888888";
const claim = "99999999-9999-4999-8999-999999999999";

vi.mock("@/lib/auth/session", () => ({ ErpAuthError: class extends Error {}, requireErpSession: async () => ({ userId: actor }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: () => {} }));
vi.mock("@/lib/api/supabase", () => ({ writeAuditLog: async () => {
  mock.auditAttempts++;
  if (mock.auditFails) throw new Error("Optional audit exporter offline");
} }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => { throw new Error("Unexpected remote idempotency operation"); } }));
vi.mock("@/lib/db/local-postgres", () => ({
  withReadPg: async () => { throw new Error("Unexpected separate read connection"); },
  withLocalPg: async (fn: (sql: unknown) => unknown) => {
    const factory = (transaction?: { state: LedgerState; kind?: "advisory" | "booking"; key?: string }) => {
      const tag = (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = parts.join("?").replace(/\s+/g, " ").trim();
        const snapshot = transaction?.state || mock.committed;
        const requireBookingTxn = () => {
          if (!transaction || transaction.kind !== "booking") throw new Error("Purchase write escaped the booking transaction: " + query);
          return transaction;
        };
        if (query === "" || query === "for update") return query;
        if (query.includes("pg_try_advisory_xact_lock")) {
          transaction!.kind = "advisory";
          return [{ got: true }];
        }
        if (query.includes("from purchase_orders where")) {
          if (transaction && query.includes("as order_type")) {
            if (!query.includes("for update")) throw new Error("Locked order re-read is missing FOR UPDATE");
            transaction.kind = "booking";
          }
          return [{ id: order, purchase_order_no: "QA-PO", country_id: country, currency_code: mock.fx ? "USD" : "AED", exchange_rate: mock.fx ? 3.67 : 1,
            order_total: mock.fx ? 367 : 100, total_goods_original: 100, advance_paid: 0, remaining_paid: 100 - snapshot.due, remaining_due: snapshot.due,
            payment_status: snapshot.orderStatus, ledger_posting_status: "posted", order_type: "purchase_booking", form_data: structuredClone(snapshot.form) }];
        }
        if (query.startsWith("insert into public.idempotency_keys")) {
          const tx = requireBookingTxn();
          tx.key = String(values[0]);
          if (snapshot.keys[tx.key]) return [];
          snapshot.keys[tx.key] = { request_hash: String(values[7]), status: "PROCESSING" };
          return [{ id: claim }];
        }
        if (query.startsWith("select status, request_hash, response_body")) return [snapshot.keys[String(values[1])]];
        if (query.startsWith("select p.id from public.purchase_order_payments")) {
          expect(values).toEqual([payment, order, actor]);
          return snapshot.payments.filter(p => p.id === values[0] && p.orderId === values[1] && p.posted);
        }
        if (query.includes("from ledgers where id")) return [{ id: values[0], country_id: country, name: "QA Ledger", code: "QA" }];
        if (query.startsWith("select upper(currency_code)")) return [{ c: "AED" }];
        if (query.startsWith("select id::text as id, loaded_quantity")) {
          return [{ id: loading, loaded_quantity: 10, report_payload: { totalPurchase: 100 } }];
        }
        if (query.startsWith("select amount, currency_code, exchange_rate, base_currency_amount")) return snapshot.payments.map(p => ({
          amount: p.amount, currency_code: "AED", exchange_rate: 1, base_currency_amount: p.amount, loading_record_id: p.loadingId,
        }));
        if (query.startsWith("select post_purchase_booking_transfer")) {
          requireBookingTxn();
          expect(values[1]).toBe(order);
          mock.postAttempts++;
          snapshot.payments.push({ id: payment, orderId: order, amount: Number(values[4]), posted: true });
          snapshot.due -= mock.fx ? Number(values[4]) / 3.67 : Number(values[4]);
          if (mock.fx) expect(values.slice(4, 9)).toEqual([370, "AED", 3.7, dr, cr]);
          return [{ id: payment }];
        }
        if (query.startsWith("select allocate_4level_serials")) {
          requireBookingTxn();
          if (mock.fault === "serial") throw new Error("Optional allocator unavailable");
          return [];
        }
        if (query.startsWith("update purchase_order_payments set loading_record_id")) {
          requireBookingTxn();
          if (mock.fault === "loading") throw new Error("Loading link SQL failed after posting RPC");
          snapshot.payments.at(-1)!.loadingId = String(values[0]);
          return [{ id: payment }];
        }
        if (query.startsWith("update purchase_order_payments set applied_purchase_amount")) {
          requireBookingTxn(); snapshot.payments.at(-1)!.applied = Number(values[0]); return [{ id: payment }];
        }
        if (query.startsWith("select recalc_purchase_order_payment_totals")) {
          requireBookingTxn();
          if (mock.fx) snapshot.due = 100 - snapshot.payments.reduce((sum, p) => sum + (p.applied ?? p.amount / 3.67), 0);
          return [];
        }
        if (query.startsWith("select id, purchase_order_id, kind, amount")) {
          return [{ id: payment, currency_code: "AED", roznamcha_entry_id: journal, base_currency_amount: snapshot.payments.at(-1)?.amount, source_transaction_type: "payment" }];
        }
        if (query.startsWith("update roznamcha_entries")) { requireBookingTxn(); return []; }
        if (query.includes("from roznamcha_entries where id")) {
          return [{ id: journal, status: "posted", posted_at: "2026-11-26", country_id: country,
            super_admin_serial_number: "QA-A", country_transaction_serial_number: "QA-B", branch_transaction_serial_number: "QA-C" }];
        }
        if (query.includes("from roznamcha_lines")) {
          const amount = snapshot.payments.at(-1)?.amount ?? 0;
          return [{ ledger_id: dr, debit: amount, credit: 0, currency: "AED" }, { ledger_id: cr, debit: 0, currency: "AED", credit: mock.fault === "verification" ? amount - 1 : amount }];
        }
        if (query.startsWith("update purchase_orders set form_data")) {
          requireBookingTxn(); snapshot.form = values[0]; return [];
        }
        if (query.startsWith("update purchase_orders set payment_status")) {
          requireBookingTxn();
          snapshot.orderStatus = query.includes("'completed'") ? "completed" : "partial";
          snapshot.form = values[0];
          return [];
        }
        if (query.startsWith("update public.idempotency_keys set status = 'COMPLETED'")) {
          const tx = requireBookingTxn();
          if (mock.fault === "claim") return []; // triggers rollback of the whole payment
          if (!tx.key) throw new Error("No transaction-owned retry key");
          snapshot.keys[tx.key].status = "COMPLETED";
          snapshot.keys[tx.key].response_body = values[0];
          return [{ id: claim }];
        }
        throw new Error("Unexpected SQL: " + query);
      };
      return Object.assign(tag, {
        json: (value: unknown) => value,
        savepoint: async (work: (sql: unknown) => unknown) => work(tag),
      });
    };
    return fn(Object.assign(factory(), {
      begin: async (work: (sql: unknown) => unknown) => {
        const tx: { state: LedgerState; kind?: "advisory" | "booking"; key?: string } = { state: structuredClone(mock.committed) };
        let result;
        try {
          result = await work(factory(tx));
        } catch (error) {
          if (tx.kind === "booking") mock.rollbackCount++;
          throw error;
        }
        if (tx.kind === "booking") {
          mock.committed = tx.state;
          if (mock.fault === "commit-ack") {
            mock.fault = "";
            throw new Error("Simulated lost acknowledgement after the database committed");
          }
        }
        return result;
      },
    }));
  },
}));

import { POST } from "@/app/api/erp/purchases/orders/[id]/payments/route";

function pay({ key = "same-form-attempt", amount = 40, currency = "AED", applied, rate = 1 }:
  { key?: string | null; amount?: number; currency?: string; applied?: number; rate?: number } = {}) {
  const req = new NextRequest("http://localhost/api/erp/purchases/orders/" + order + "/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "X-Idempotency-Key": key } : {}) },
    body: JSON.stringify({ kind: "remaining", entryDate: "2026-11-26", amount, currencyCode: currency, exchangeRate: rate, purchaseAppliedAmount: applied,
      debitLedgerId: dr, creditLedgerId: cr, typeDetails: { loadingRecordId: loading }, referenceNo: "SYNTHETIC-ONLY" }),
  });
  return POST(req, { params: Promise.resolve({ id: order }) });
}

beforeEach(() => {
  mock.committed = { due: 100, orderStatus: "pending", payments: [], keys: {},
    form: { form: { paymentType: "Cash", totalQuantity: 10 }, goodsEntries: [{ goodsName: "QA goods", qtyNo: 10, totalAmount: 100 }] } };
  mock.fault = "";
  mock.postAttempts = 0;
  mock.auditAttempts = 0;
  mock.auditFails = false;
  mock.fx = false;
  mock.rollbackCount = 0;
});

describe("Purchase Booking payment atomic retries", () => {
  it.each(["loading", "verification", "claim"] as const)("rolls back a partial payment's ledger, loading and retry record on %s failure, then safely retries", async (fault) => {
    mock.fault = fault;
    expect((await pay()).status).toBeGreaterThanOrEqual(400);
    expect(mock.postAttempts).toBe(1);
    expect(mock.rollbackCount).toBe(1);
    expect(mock.committed).toMatchObject({ due: 100, orderStatus: "pending", payments: [], keys: {} });
    expect(mock.committed.form.lastPaymentTrace).toBeUndefined();
    mock.fault = "";
    const posted = await pay();
    expect(posted.status).toBe(201);
    expect(await posted.json()).toEqual({ ok: true, data: { paymentId: payment } });
    expect(mock.committed).toMatchObject({ due: 60, orderStatus: "partial", payments: [{ id: payment, amount: 40, loadingId: loading }] });
    expect(mock.committed.form.lastPaymentTrace).toMatchObject({ paymentId: payment, roznamchaEntryId: journal });
    const replay = await pay();
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(await replay.json()).toEqual({ ok: true, data: { paymentId: payment }, isReplayed: true });
    expect(mock.postAttempts).toBe(2); // one rolled back, one committed, replay never attempted posting
    expect(mock.auditAttempts).toBe(1);
  });

  it.each([["USD", 100], ["AED", 370]] as const)("applies exactly USD 100 from %s tender using the typed 3.70 rate", async (currency, amount) => {
    mock.fx = true;
    const bad = await pay({ amount: 369, applied: 100, rate: 3.7 });
    expect(bad.status).toBe(422);
    expect(mock.postAttempts).toBe(0);
    const args = { currency, amount, applied: 100, rate: 3.7 };
    expect((await pay(args)).status).toBe(201);
    expect(mock.committed.due).toBe(0);
    expect(mock.committed.payments).toEqual([{ id: payment, orderId: order, posted: true, amount: 370, applied: 100, loadingId: loading }]);
    expect(mock.committed.form.lastPaymentTrace).toMatchObject({ appliedPurchaseAmount: 100, appliedPurchaseCurrency: "USD" });
    expect((await pay(args)).headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(mock.postAttempts).toBe(1);
  });

  it("replays the one committed payment despite losing the response after the commit, and refuses mismatched payloads", async () => {
    mock.fault = "commit-ack";
    expect((await pay()).status).toBeGreaterThanOrEqual(400);
    expect(mock.committed.payments).toHaveLength(1);
    const replay = await pay();
    expect(replay.status).toBe(201);
    expect((await replay.json()).data.paymentId).toBe(payment);
    const mismatch = await pay({ amount: 41 });
    expect(mismatch.status).toBe(409);
    expect((await mismatch.json()).error.code).toBe("IDEMPOTENCY_MISMATCH");
    expect(mock.postAttempts).toBe(1);
    expect(mock.committed.due).toBe(60);
  });

  it("does not re-post an uncertain legacy key or a cached payment whose journal is no longer posted", async () => {
    expect((await pay()).status).toBe(201);
    mock.committed.keys["same-form-attempt"].status = "PROCESSING";
    const uncertain = await pay();
    expect(uncertain.status).toBe(409);
    expect((await uncertain.json()).error.code).toBe("IDEMPOTENCY_UNCERTAIN");
    mock.committed.keys["same-form-attempt"].status = "COMPLETED";
    mock.committed.payments[0].posted = false;
    expect((await pay()).status).toBe(409);
    expect(mock.postAttempts).toBe(1);
  });

  it("replays a fully settled order before testing remaining balance and normalizes a legacy response", async () => {
    expect((await pay({ amount: 100 })).status).toBe(201);
    expect(mock.committed).toMatchObject({ due: 0, orderStatus: "completed" });
    mock.committed.keys["same-form-attempt"].response_body = { paymentId: payment, isReplayed: true };
    const replay = await pay({ amount: 100 });
    expect(await replay.json()).toEqual({ ok: true, data: { paymentId: payment }, isReplayed: true });
    expect(mock.postAttempts).toBe(1);
  });

  it("requires a Booking retry key and does not roll back a committed payment for optional serial or audit failures", async () => {
    expect((await pay({ key: null })).status).toBe(400);
    expect(mock.postAttempts).toBe(0);
    mock.fault = "serial";
    mock.auditFails = true;
    expect((await pay()).status).toBe(201);
    expect(mock.committed.payments).toHaveLength(1);
    expect((await pay()).headers.get("X-Idempotent-Replayed")).toBe("true");
  });
});
