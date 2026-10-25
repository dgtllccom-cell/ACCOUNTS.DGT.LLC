// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), admin: vi.fn(), smtp: vi.fn(), resolve: vi.fn(), access: vi.fn()
}));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/email/smtp-client", () => ({ testSmtpConnection: mocks.smtp }));
vi.mock("@/lib/email/resolve-mailbox-account", () => ({ resolveMailboxAccount: mocks.resolve }));
vi.mock("@/lib/permissions/middleware", () => ({ canAccessCityBranch: mocks.access }));
vi.mock("@/lib/crypto", () => ({ decrypt: (value: string) => value }));
vi.mock("@/lib/api/response", () => ({
  apiOk: (data: unknown) => NextResponse.json({ ok: true, data }),
  handleApiError: () => NextResponse.json({ success: false }, { status: 500 })
}));
import { POST } from "@/app/api/erp/messages/test-connection/route";

const settings = {
  smtpHost: "smtp.example.com", smtpPort: 465, smtpSecure: true,
  smtpUser: "branch@example.com", smtpPass: "test-only-password"
};
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/erp/messages/test-connection", {
  method: "POST", body: JSON.stringify(body)
}));

describe("SMTP connection test request contract (no database or network)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ cityBranchIds: ["branch-id"] });
    mocks.smtp.mockResolvedValue(true);
    mocks.access.mockReturnValue(true);
    mocks.admin.mockReturnValue({ from: vi.fn(() => { throw new Error("Unexpected database access"); }) });
  });

  it("tests the unsaved branch form settings rather than country defaults", async () => {
    expect((await post({ countryId: "country-id", settings })).status).toBe(200);
    expect(mocks.smtp).toHaveBeenCalledWith({
      host: settings.smtpHost, port: 465, secure: true,
      auth: { user: settings.smtpUser, pass: settings.smtpPass }
    });
  });

  it("preserves direct host/user/pass callers and secure=false", async () => {
    const config = { host: settings.smtpHost, port: 587, secure: false, user: settings.smtpUser, pass: settings.smtpPass };
    expect((await post(config)).status).toBe(200);
    expect(mocks.smtp).toHaveBeenCalledWith({ host: config.host, port: 587, secure: false, auth: { user: config.user, pass: config.pass } });
  });

  it("rejects incomplete form settings without falling back to another mailbox", async () => {
    expect((await post({ countryId: "country-id", settings: { ...settings, smtpPass: "" } })).status).toBe(400);
    expect(mocks.smtp).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("reuses only the saved password for the exact branch and mailbox", async () => {
    const query = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "mailbox-id" } }),
      select: vi.fn(), eq: vi.fn(), is: vi.fn()
    };
    for (const method of [query.select, query.eq, query.is]) method.mockReturnValue(query);
    mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    mocks.resolve.mockResolvedValue({ smtpPass: "saved-test-password" });
    expect((await post({ cityBranchId: "branch-id", settings: { ...settings, smtpPass: "" } })).status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("city_branch_id", "branch-id");
    expect(query.eq).toHaveBeenCalledWith("email_address", settings.smtpUser);
    expect(mocks.resolve).toHaveBeenCalledWith("mailbox-id");
    expect(mocks.smtp.mock.calls[0][0].auth.pass).toBe("saved-test-password");
  });

  it("does not read a saved credential outside the user's branch access", async () => {
    mocks.access.mockReturnValue(false);
    expect((await post({ cityBranchId: "other-branch", settings: { ...settings, smtpPass: "" } })).status).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.smtp).not.toHaveBeenCalled();
  });

  it("requires authentication before testing a connection", async () => {
    mocks.session.mockRejectedValue(new Error("Unauthenticated"));
    expect((await post({ settings })).status).toBe(500);
    expect(mocks.smtp).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
