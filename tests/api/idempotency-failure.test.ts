import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) }) }));
vi.mock("@/lib/api/response", () => ({ apiError: (code: string, message: string, status: number) => NextResponse.json({ code, message }, { status }) }));
import { acquireIdempotencyLock, withIdempotency } from "@/lib/api/idempotency";
const options = () => ({ req: new NextRequest("http://localhost/api/payment", { headers: { "idempotency-key": "payment-1" } }), scopeModule: "DAILY_PAYMENT", userId: "u", payload: { amount: 100 } });
beforeEach(() => { vi.clearAllMocks(); });
describe("idempotency store failure never authorizes posting", () => {
  it("refuses to acquire on a failed RPC and failed fallback store", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    mocks.insert.mockResolvedValue({ error: { code: "08006", message: "Connection unavailable" } });
    expect(await acquireIdempotencyLock(options())).toMatchObject({ acquired: false, isReplayed: false });
  });
  it("does not call the financial handler on a thrown transport failure", async () => {
    mocks.rpc.mockRejectedValue(new Error("Transport disconnected"));
    const post = vi.fn(async () => NextResponse.json({ posted: true }));
    expect((await withIdempotency(options(), post)).status).toBe(409);
    expect(post).not.toHaveBeenCalled();
  });
  it("preserves successful lock acquisition and completed replay", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ acquired: true }], error: null });
    expect((await acquireIdempotencyLock(options())).acquired).toBe(true);
    mocks.rpc.mockResolvedValueOnce({ data: [{ acquired: false, is_replayed: true, response_code: 201, response_body: { paymentId: "existing" } }], error: null });
    expect(await acquireIdempotencyLock(options())).toMatchObject({ acquired: false, isReplayed: true, responseCode: 201, responseBody: { paymentId: "existing" } });
  });
});
