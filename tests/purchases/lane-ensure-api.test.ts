import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  schema: vi.fn(), localSale: vi.fn(), booking: vi.fn(), sql: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: vi.fn(async () => ({ userId: "actor" })) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeLogistics: vi.fn() }));
vi.mock("@/lib/api/supabase", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: vi.fn() }));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: (fn: (sql: unknown) => unknown) => fn(mocks.sql) }));
vi.mock("@/lib/api/response", () => ({ apiOk: (data: unknown) => data, handleApiError: (error: unknown) => ({ error }) }));
vi.mock("@/lib/services/purchase-lane-service", () => ({
  ensureLaneSchema: mocks.schema,
  ensureLaneFromLocalSale: mocks.localSale,
  ensureLaneFromSalesOrder: mocks.booking,
  ensureLaneFromLoadingRecord: vi.fn(), ensureLaneFromLocalPurchase: vi.fn(),
  laneStatesForLoadingRecords: vi.fn(), listLaneLoads: vi.fn(), transferLoads: vi.fn(),
}));

import { POST } from "@/app/api/erp/purchases/lane/route";
const request = () => ({ json: async () => ({ action: "ensure", salesOrderId: "12345678-1234-4234-8234-123456789012" }) }) as NextRequest;

describe("P/S sales transfer entry", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.schema.mockResolvedValue(undefined); mocks.localSale.mockResolvedValue(null); mocks.booking.mockResolvedValue(null); });
  it("uses the local sales lane without also creating a booking lane", async () => {
    const lane = { id: "local", created: true };
    mocks.localSale.mockResolvedValue(lane);
    expect(await POST(request())).toEqual({ lane });
    expect(mocks.schema).toHaveBeenCalledOnce();
    expect(mocks.booking).not.toHaveBeenCalled();
  });
  it("falls back to sales booking for a non-local bill", async () => {
    const lane = { id: "booking", created: true };
    mocks.booking.mockResolvedValue(lane);
    expect(await POST(request())).toEqual({ lane });
    expect(mocks.localSale).toHaveBeenCalledOnce();
    expect(mocks.booking).toHaveBeenCalledOnce();
  });
  it("stops before creating a lane if schema repair fails", async () => {
    const error = new Error("schema unavailable");
    mocks.schema.mockRejectedValue(error);
    expect(await POST(request())).toEqual({ error });
    expect(mocks.localSale).not.toHaveBeenCalled();
    expect(mocks.booking).not.toHaveBeenCalled();
  });
});
