export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { addExpense, advanceExpense } from "@/lib/services/purchase-lane-service";

const idSchema = z.object({ id: z.string().uuid() });
const createSchema = z.object({
  expenseType: z.enum(["transport", "port", "customs", "clearing", "detention", "handling", "other"]),
  amount: z.coerce.number().min(0),
  currency: z.string().trim().length(3),
  description: z.string().trim().max(500).nullish(),
  payeeType: z.enum(["external_agent", "internal_branch", "internal_agent", "other"]),
  payeeAgentId: z.string().uuid().nullish(),
  payeeName: z.string().trim().max(200).nullish(),
  payeeCountryBranchId: z.string().uuid().nullish(),
  payeeCityBranchId: z.string().uuid().nullish(),
});

/** POST adds a DRAFT lane expense (linked Purchase -> Loading -> BL -> Container -> Lane -> payee). It posts nothing. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "update" });
    const { id } = idSchema.parse(await ctx.params);
    const body = createSchema.parse(await request.json());
    const row = await addExpense(session, id, body as never);
    await writeAuditLog({ action: "create", entityTable: "purchase_lane_expenses", entityId: (row as any).id, before: null, after: row, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    return apiCreated({ expense: row });
  } catch (error) {
    return handleApiError(error);
  }
}

const advanceSchema = z.object({ expenseId: z.string().uuid(), action: z.enum(["review", "confirm", "cancel"]) });

/** PATCH review -> confirm. Only a confirmed agent expense creates an UNPOSTED line in the Bill Expenses register. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeLogistics(session, { action: "update" });
    idSchema.parse(await ctx.params);
    const body = advanceSchema.parse(await request.json());
    const result = await advanceExpense(session, body.expenseId, body.action);
    await writeAuditLog({ action: "update", entityTable: "purchase_lane_expenses", entityId: body.expenseId, before: null, after: result, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    return apiOk({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
