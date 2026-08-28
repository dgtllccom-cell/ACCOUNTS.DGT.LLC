export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { businessShippingHandoverService, type HandoverScope } from "@/lib/services/business-shipping-handover-service";

function scopeOf(session: any): HandoverScope {
  const global = session.isSuperAdmin || (session.roles ?? []).includes("super_admin_reports");
  return {
    isSuperAdmin: !!session.isSuperAdmin,
    isShippingScoped: !!session.isShippingScoped,
    countryIds: global ? null : (session.countryIds ?? []),
    countryBranchIds: global ? null : (session.countryBranchIds ?? []),
    cityBranchIds: global ? null : (session.cityBranchIds ?? []),
    clearingAgentIds: session.clearingAgentIds ?? [],
  };
}

const createSchema = z.object({
  actionType: z.enum(["create_shipping_request", "send_to_shipping_line", "assign_clearing_agent", "approve_shipping_handover"]),
  businessSourceModule: z.enum(["purchase_orders", "sales_orders"]),
  businessSourceId: z.string().uuid(),
  clearingAgentId: z.string().uuid().nullable().optional(),
  shippingLineId: z.string().uuid().nullable().optional(),
  shippingCustomerId: z.string().uuid().nullable().optional(),
  blReference: z.string().trim().max(120).nullable().optional(),
  containerNumbers: z.array(z.string().trim().max(20)).max(200).optional(),
  sourceIntakeJobId: z.string().uuid().nullable().optional(),
  extraShared: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = scopeOf(session);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    if (scope.isShippingScoped || searchParams.get("as") === "agent") {
      authorizeApiScope(session, { resource: "shipping_records", action: "read" });
      const rows = await businessShippingHandoverService.listForAgent(scope, { status });
      return apiOk({ rows, view: "agent" });
    }
    authorizeApiScope(session, { resource: "purchases", action: "read" });
    const rows = await businessShippingHandoverService.listForBusiness(scope, {
      businessSourceId: searchParams.get("businessSourceId") || undefined,
      status,
    });
    return apiOk({ rows, view: "business" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "write" });
    const body = createSchema.parse(await request.json());
    const res = await businessShippingHandoverService.create(body, scopeOf(session), session.userId, session.fullName ?? null);
    return apiCreated(res);
  } catch (error) {
    return handleApiError(error);
  }
}
