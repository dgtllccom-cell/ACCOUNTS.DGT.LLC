// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/erp/purchases/orders/[id]/payments/[paymentId]/route";

const m = vi.hoisted(() => ({
  payment: {} as Record<string, unknown>,
  authorize: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  createAdmin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => ({ userId: "author" }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: m.authorize }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: m.createAdmin }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async (lang: string | null) => lang || "en" }));
vi.mock("@/lib/api/supabase", () => ({
  createApiSupabaseClient: async () => ({ from: m.from, rpc: m.rpc }),
  requireSupabaseData: async (p: unknown) => p,
  writeAuditLog: vi.fn(),
}));

const id = "c3b70ed7-d426-4f2a-b790-9ef3c45b0e11";
const paymentId = "2b07d68e-ffe6-439b-ab6e-53900d2d52e3";
const body = { kind: "advance", entryDate: "2026-11-25", amount: 380, currencyCode: "AED", exchangeRate: 1,
  debitLedgerId: "32562b20-2eed-4d5b-8ebf-fabb12225a21", creditLedgerId: "869cf475-34c1-4a1f-8ca2-6d51d06e7384" };
const run = async (language = "en") => await PUT(new NextRequest(`http://test/api/erp/purchases/orders/${id}/payments/${paymentId}?lang=${language}`, {
  method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), { params: Promise.resolve({ id, paymentId }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.payment = { applied_purchase_amount: "100.0000", roznamcha_entry_id: id };
  m.from.mockImplementation((table: string) => {
    const request = { select: () => request, eq: () => request, is: () => request,
      single: () => m.payment, maybeSingle: () => ({ country_id: id, country_branch_id: id, city_branch_id: id }), update: m.update };
    if (table !== "purchase_order_payments" && table !== "purchase_orders") throw new Error("Unexpected table");
    return request;
  });
});

it("refuses a fixed-currency payment edit before it can reverse, delete or repost, with localized copy", async () => {
  const response = await run("ur");
  expect(response.status).toBe(409);
  expect((await response.json()).error).toMatchObject({ code: "PURCHASE_EXACT_PAYMENT_EDIT_LOCKED", message: expect.stringContaining("اکاؤنٹس") });
  expect(m.authorize).toHaveBeenCalledTimes(1);
  expect(m.createAdmin).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.rpc).not.toHaveBeenCalled();
});
