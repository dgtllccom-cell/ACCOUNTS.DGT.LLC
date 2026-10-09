export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { cancelInterCountryTrade, receiveInterCountryTrade } from "@/lib/services/goods-transfer-service";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "A reason is required.") }),
]);

/**
 * Receive (destination country, authorized) or cancel (source country, before receipt) an Inter-Country Trade.
 * The destination user never creates the purchase: it already exists, linked by the trade reference.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    z.string().uuid().parse(id);
    const body = bodySchema.parse(await request.json());

    const result = await withLocalPg(async (sql) => {
      const [t] = await sql`select * from public.inter_country_trades where id = ${id}::uuid`;
      if (!t) throw new ApiClientError("Trade not found.", { status: 404, code: "TRADE_NOT_FOUND" });
      if (body.action === "receive") {
        authorizeApiScope(session, {
          resource: "purchases", action: "update",
          countryId: t.dest_country_id, countryBranchId: t.dest_country_branch_id, cityBranchId: t.dest_city_branch_id ?? null,
        });
      } else {
        authorizeApiScope(session, {
          resource: "purchases", action: "update",
          countryId: t.source_country_id, countryBranchId: t.source_country_branch_id, cityBranchId: t.source_city_branch_id ?? null,
        });
      }
      return sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: session.userId, role: "authenticated" })}, true)`;
        return body.action === "receive"
          ? receiveInterCountryTrade(tx, id, { userId: session.userId })
          : cancelInterCountryTrade(tx, id, { reason: body.reason, userId: session.userId });
      });
    });
    if (!(result as any)?.replayed) {
      await writeAuditLog({ action: `inter_country_trade_${body.action}`, entityTable: "inter_country_trades", entityId: id, before: null, after: { action: body.action, ...(body as object) }, ipAddress: request.headers.get("x-forwarded-for") ?? null });
    }
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
