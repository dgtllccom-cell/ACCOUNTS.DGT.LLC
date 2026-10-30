import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), sender: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentErpSession: mocks.session, ErpAuthError: class extends Error { status = 401; } }));
vi.mock("@/lib/api/response", () => ({ apiOk: (data: any) => NextResponse.json({ ok: true, data }), ApiClientError: class extends Error { status: number; constructor(m: string, opts: any) { super(m); this.status = opts.status; } }, handleApiError: (e: any) => NextResponse.json({ ok: false }, { status: e.status || 500 }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { POST } from "@/app/api/erp/whatsapp/test-send/route";
const actor = { userId: "u", roles: ["city_branch_admin"], permissions: ["whatsapp:create"], countryIds: ["PK"], countryBranchIds: [], cityBranchIds: ["Q"], isSuperAdmin: false, mobileProfile: "standard", operationalDomains: ["business"] };
const request = () => new NextRequest("http://localhost/api/erp/whatsapp/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderNumber: "+971500000000", recipientNumber: "+971511111111", messageText: "Fixture only - must not send" }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue(actor);
  const query: any = { select: () => query, eq: () => query, is: () => query, maybeSingle: mocks.sender };
  mocks.admin.mockReturnValue({ from: () => query }); vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
describe("WhatsApp test-send never borrows unauthorized sender credentials", () => {
  it("rejects anonymous users without accessing credentials or sending", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("requires the WhatsApp send permission before accessing credentials", async () => {
    mocks.session.mockResolvedValue({ ...actor, permissions: [] });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a sender assigned to another branch without sending", async () => {
    mocks.sender.mockResolvedValue({ data: { country_id: "PK", city_branch_id: "C", access_token: "not-used" } });
    expect((await POST(request())).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects an unknown sender rather than using a global default", async () => {
    mocks.sender.mockResolvedValue({ data: null });
    expect((await POST(request())).status).toBe(404); expect(fetch).not.toHaveBeenCalled();
  });
});
