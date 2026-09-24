import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { assertShippingUserExplicitPermission } from "@/lib/permissions/shipping-explicit-gate";
import { createManualCrmItem } from "@/lib/crm/smart-crm-service";

const schema = z.object({
  partyName: z.string().trim().min(1).max(200),
  dueDate: z.string().date(),
  itemType: z.string().trim().min(1).max(50).default("Shipping Payment"),
  amount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().length(3).default("PKR"),
  referenceNo: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  countryId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable()
});

/** CRM Create — a manual follow-up/collection item inside the caller's own country/branch. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertShippingUserExplicitPermission(session, "crm", "create");
    if (!session.isSuperAdmin && !hasRolePermission(session, "crm", "create") && (session.roles?.includes("agent_user") || session.isShippingScoped)) {
      return NextResponse.json({ error: "Missing permission: crm:create" }, { status: 403 });
    }
    const body = schema.parse(await request.json());
    const created = await createManualCrmItem(session, body);
    return NextResponse.json({ success: true, item: created }, { status: 201 });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    const status = error?.status || (error?.name === "ZodError" ? 422 : 500);
    return NextResponse.json({ error: error.message || "Failed to create CRM item." }, { status });
  }
}
