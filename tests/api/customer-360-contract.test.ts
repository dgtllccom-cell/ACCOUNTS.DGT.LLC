import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), profile: vi.fn(), activity: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentErpSession: mocks.session, ErpAuthError: class extends Error { status = 401; } }));
vi.mock("@/lib/api/response", () => ({ handleApiError: (error: any) => NextResponse.json({ ok: false, error: { message: error.message } }, { status: error.status || (error.name === "ZodError" ? 422 : 500) }) }));
vi.mock("@/lib/crm/customer-360-service", () => ({ getCustomer360Data: mocks.list, getCustomer360Profile: mocks.profile, logCustomer360Activity: mocks.activity }));
import { GET, POST } from "@/app/api/erp/crm/customer-360/route";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ roles: ["country_admin"], canViewFinancials: true }); });
describe("Customer 360 API contract", () => {
  it("returns the envelope expected by both register and profile clients", async () => {
    mocks.profile.mockResolvedValue({ customer: { id } });
    const response = await GET(new NextRequest(`http://localhost/api/erp/crm/customer-360?customerId=${id}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, success: true, data: { customer: { id } } });
  });
  it("returns 401 JSON before any service call for an anonymous request", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/erp/crm/customer-360"));
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects an invalid profile id before querying", async () => {
    const response = await GET(new NextRequest("http://localhost/api/erp/crm/customer-360?customerId=invalid"));
    expect(response.status).toBe(422);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("passes valid date and zero promise amount to the existing activity service", async () => {
    mocks.activity.mockResolvedValue({ success: true, noteId: id });
    const response = await POST(new NextRequest("http://localhost/api/erp/crm/customer-360", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: id, notes: "Call tomorrow", promiseDate: "2026-10-18", promiseAmount: 0 }) }));
    expect(response.status).toBe(200);
    expect(mocks.activity.mock.calls[0][0]).toMatchObject({ promiseDate: "2026-10-18", promiseAmount: 0, activityType: "Note" });
  });
});
