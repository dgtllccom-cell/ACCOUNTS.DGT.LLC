// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { ErpSession } from "@/lib/auth/session";

const state = vi.hoisted(() => ({
  session: {} as Partial<ErpSession>,
  rows: [] as Record<string, unknown>[],
  calls: [] as { query: string; values: unknown[] }[],
}));

vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/api/response", () => ({
  apiOk: (data: unknown, options: ResponseInit) => NextResponse.json({ ok: true, data }, options),
  apiError: (code: string, message: string, status: number) => NextResponse.json({ ok: false, error: { code, message } }, { status }),
  handleApiError: (error: Error) => NextResponse.json({ ok: false, error: { message: error.message } }, { status: 403 }),
}));
vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: async (fn: (tag: (parts: TemplateStringsArray, ...values: unknown[]) => unknown) => unknown) =>
    fn((parts, ...values) => {
      state.calls.push({ query: parts.join("?"), values });
      return state.rows;
    }),
}));
import { GET } from "@/app/api/erp/purchases/orders/[id]/payments/[paymentId]/route";

const order = "11111111-1111-4111-8111-111111111111";
const payment = "22222222-2222-4222-8222-222222222222";
const country = "33333333-3333-4333-8333-333333333333";
const branch = "44444444-4444-4444-8444-444444444444";
const city = "55555555-5555-4555-8555-555555555555";
const otherCity = "66666666-6666-4666-8666-666666666666";
const dr = { ledger_id: "ledger-payable", ledger_name: "Vendor Payable", ledger_code: "PAY-01", debit: "250.1250", credit: "0", currency: "PKR" };
const cr = { ledger_id: "ledger-bank", ledger_name: "Bank", ledger_code: "BANK-01", debit: "0", credit: "250.1250", currency: "PKR" };

async function get() {
  const req = new NextRequest("http://localhost/api/erp/purchases/orders/" + order + "/payments/" + payment);
  const response = await GET(req, { params: Promise.resolve({ id: order, paymentId: payment }) });
  return { response, body: await response.json() };
}

beforeEach(() => {
  state.session = { userId: "test", roles: ["city_branch_admin"], permissions: ["purchases:read"], countryIds: [country],
    countryBranchIds: [branch], cityBranchIds: [city], isSuperAdmin: false, isGlobalScope: false, operationalDomains: ["business"],
    assignments: [], canViewFinancials: true };
  state.rows = [{ source: "purchase_booking", bill: "PO-765", country_id: country, country_branch_id: branch, city_branch_id: city,
    party: "Saved Supplier", voucher_no: "REAL-VOUCHER", journal_serial: "GLOBAL-RZ-123", date: "2026-11-24", reference: "BANK-REF-42", lines: [cr, dr] }];
  state.calls = [];
});

describe("read-only posted purchase receipt", () => {
  it("selects the exact payment/bill relationship and reads the original journal, not payment display values", async () => {
    const { response, body } = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.data).toMatchObject({ source: "purchase_booking", bill: "PO-765", number: "REAL-VOUCHER", party: "Saved Supplier",
      reference: "BANK-REF-42", debit: { name: "Vendor Payable", amount: 250.125, currency: "PKR" },
      credit: { name: "Bank", amount: 250.125, currency: "PKR" } });
    expect(state.calls[0].values).toEqual([payment, order, order]);
    for (const x of ["p.id = ?::uuid", "(po.id = ?::uuid or lp.id = ?::uuid)", "j.id = p.roznamcha_entry_id", "j.status = 'posted'",
      "j.posted_at is not null", "p.status = 'posted'", "p.kind <> 'booking'", "p.deleted_at is null",
      "and p.local_purchase_id is null", "and p.purchase_order_id is null", "where l.roznamcha_entry_id = j.id"]) {
      expect(state.calls[0].query).toContain(x);
    }
    expect(state.calls[0].query).not.toMatch(/\b(insert|update|delete)\s/i);
  });

  it("prints the stored Local Purchase journal bill, not a different manual or typed contract reference", async () => {
    Object.assign(state.rows[0], { source: "local_purchase", bill: null, journal_serial_no: "LP-JRN-0057", manual_bill_no: "LP-MANUAL-98" });
    expect((await get()).body.data).toMatchObject({ bill: "LP-JRN-0057", source: "local_purchase" });
    state.rows[0].journal_serial_no = null;
    expect((await get()).body.data.bill).toBe("LP-MANUAL-98");
    state.rows[0].manual_bill_no = null;
    expect((await get()).response.status).toBe(409);
  });

  it("rejects a missing or reversed journal, and an unbalanced recorded pair", async () => {
    state.rows[0].lines = [dr, { ...cr, credit: "250.1249" }];
    expect((await get()).response.status).toBe(409);
    state.rows = [];
    expect((await get()).response.status).toBe(404);
  });

  it("denies someone outside the exact city or without finance permission", async () => {
    state.rows[0].city_branch_id = otherCity;
    expect((await get()).response.status).toBe(403);
    state.rows[0].city_branch_id = city;
    state.session.canViewFinancials = false;
    expect((await get()).response.status).toBe(403);
    expect(state.calls).toHaveLength(1);
  });
});
