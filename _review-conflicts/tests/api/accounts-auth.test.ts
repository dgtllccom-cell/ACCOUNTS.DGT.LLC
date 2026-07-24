import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/erp/accounting/accounts/route";
import { PATCH, DELETE } from "@/app/api/erp/accounting/accounts/[id]/route";

// Mock session and supabase client helpers
const mockSession = {
  userId: "00000000-0000-0000-0000-000000000000",
  email: "test@damaan.com",
  fullName: "Test User",
  roles: ["super_admin"],
  permissions: ["*:*"]
};

vi.mock("@/lib/auth/session", () => ({
  requireErpSession: vi.fn(async () => mockSession)
}));

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase)
};

vi.mock("@/lib/api/supabase", () => ({
  createApiSupabaseClient: vi.fn(async () => mockSupabase)
}));

vi.mock("@/lib/api/scope-middleware", () => ({
  authorizeApiScope: vi.fn()
}));

describe("Account Operations Authentication and Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.userId = "11111111-1111-4111-aa11-111111111111"; // Reset to valid uuid
  });

  describe("POST /api/erp/accounting/accounts (Create Account)", () => {
    const defaultCreatePayload = {
      scope: "super_admin",
      code: "AUTO",
      name: "Cash in Hand",
      kind: "asset",
      currency: "USD",
      openingBalance: 0,
      isControlAccount: false
    };

    it("rejects temporary/mock users who are not in the profiles table", async () => {
      // Set to temporary/mock user ID
      mockSession.userId = "00000000-0000-4000-8000-000000000001";
      
      // profiles query returns no profile
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts", {
        method: "POST",
        body: JSON.stringify(defaultCreatePayload)
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const json = await response.json();
      expect(json.error).toContain("Account creation requires a valid user reference");
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it("accepts valid authenticated users existing in the profiles table", async () => {
      mockSession.userId = "a2b3c4d5-1111-4111-8111-111111111111";
      
      // mock metadata queries for auto account code prefix
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: { id: "a2b3c4d5-1111-4111-8111-111111111111" }, error: null }) // profiles query
        .mockResolvedValueOnce({ data: { id: "ledger-id-mock" }, error: null }); // ledgers parent search if any
      
      mockSupabase.limit.mockResolvedValueOnce([]); // nextEnterpriseAccountCode existing query
      
      // exact count head query for serial numbers
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "new-account-id" }, error: null }); // insert enterprise_accounts
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "new-ledger-id" }, error: null }); // insert ledgers

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts", {
        method: "POST",
        body: JSON.stringify(defaultCreatePayload)
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      
      const json = await response.json();
      expect(json.accountId).toBeDefined();
      expect(json.ledgerId).toBeDefined();
    });
  });

  describe("PATCH /api/erp/accounting/accounts/[id] (Update Account)", () => {
    const defaultUpdatePayload = {
      name: "Updated Cash Account",
      status: "active"
    };

    it("rejects temporary/mock users trying to update accounts", async () => {
      mockSession.userId = "00000000-0000-4000-8000-000000000001";
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts/some-id", {
        method: "PATCH",
        body: JSON.stringify(defaultUpdatePayload)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "some-id" }) });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain("Account update requires a valid user reference");
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it("accepts valid updates from users verified in the profiles table", async () => {
      mockSession.userId = "a2b3c4d5-1111-4111-8111-111111111111";
      
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: { id: "a2b3c4d5-1111-4111-8111-111111111111" }, error: null }) // profiles query
        .mockResolvedValueOnce({ // loadAccount load
          data: {
            id: "some-id",
            scope: "super_admin",
            name: "Original Name",
            kind: "asset",
            currency: "USD",
            opening_balance: 0,
            current_balance: 0,
            status: "active",
            is_control_account: false
          },
          error: null
        });

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "some-id", name: "Updated Cash Account" },
        error: null
      });

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts/some-id", {
        method: "PATCH",
        body: JSON.stringify(defaultUpdatePayload)
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "some-id" }) });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.account.name).toBe("Updated Cash Account");
    });
  });

  describe("DELETE /api/erp/accounting/accounts/[id] (Delete Account)", () => {
    it("rejects temporary/mock users trying to delete accounts", async () => {
      mockSession.userId = "00000000-0000-4000-8000-000000000001";
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts/some-id", {
        method: "DELETE"
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "some-id" }) });
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain("Account deletion requires a valid user reference");
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it("allows deletion by a valid user profile", async () => {
      mockSession.userId = "a2b3c4d5-1111-4111-8111-111111111111";

      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: { id: "a2b3c4d5-1111-4111-8111-111111111111" }, error: null }) // profiles query
        .mockResolvedValueOnce({ // loadAccount load
          data: {
            id: "some-id",
            scope: "super_admin",
            name: "Delete Me",
            kind: "asset",
            currency: "USD",
            opening_balance: 0,
            current_balance: 0,
            status: "active",
            is_control_account: false
          },
          error: null
        });

      mockSupabase.update.mockReturnValue(mockSupabase); // first update (account)
      mockSupabase.update.mockReturnValue(mockSupabase); // second update (ledger)

      const request = new NextRequest("http://localhost/api/erp/accounting/accounts/some-id", {
        method: "DELETE"
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: "some-id" }) });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.deleted).toBe(true);
    });
  });
});
