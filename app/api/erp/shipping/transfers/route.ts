import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createShippingTransfer } from "@/lib/services/shipping-transfer-service";
import { uuidSchema, optionalUuidSchema } from "@/lib/api/erp-validation";

const createSchema = z.object({
  sourceTable: z.string().trim().min(2).max(80),
  sourceId: uuidSchema,
  sourceReferenceNo: z.string().trim().max(120).nullable().optional(),
  sourceLedgerId: optionalUuidSchema,
  clearingAgentId: optionalUuidSchema,
  originCountryId: optionalUuidSchema,
  originCountryBranchId: optionalUuidSchema,
  originCityBranchId: optionalUuidSchema,
  destCountryId: optionalUuidSchema,
  destCountryBranchId: optionalUuidSchema,
  destCityBranchId: optionalUuidSchema,
  amount: z.coerce.number().finite().min(0),
  currencyCode: z.string().trim().length(3),
  exchangeRate: z.coerce.number().finite().positive().default(1),
  category: z.string().trim().max(120).nullable().optional(),
  blReference: z.string().trim().max(120).nullable().optional(),
  supportingDocument: z.string().trim().max(400).nullable().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const status = request.nextUrl.searchParams.get("status");
    const rows = await withLocalPg(async (sql) => {
      // Scope: super admin sees all; a shipping-only login sees ONLY its clearing agent's transfers;
      // otherwise the user's country/branch scope (origin OR destination). Service-role bypasses RLS,
      // so this API filter is the authoritative gate.
      const superA = session.isSuperAdmin;
      const shippingScoped = session.isShippingScoped;
      const agentIds = session.clearingAgentIds.length ? session.clearingAgentIds : ["00000000-0000-0000-0000-000000000000"];
      const cIds = session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"];
      return sql`
        select * from public.shipping_expense_transfers
        where deleted_at is null
          and (${status ? sql`status = ${status}` : sql`true`})
          and (
            ${superA ? sql`true`
              : shippingScoped ? sql`clearing_agent_id = any(${agentIds}::uuid[])`
              : sql`(dest_country_id = any(${cIds}::uuid[]) or origin_country_id = any(${cIds}::uuid[]) or created_by = ${session.userId})`}
          )
        order by created_at desc
        limit 300`;
    });
    return apiOk({ transfers: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = createSchema.parse(await request.json());
    // The creator must be authorized on the ORIGIN scope (they own the source bill/expense).
    authorizeApiScope(session, {
      resource: "shipping_transfers",
      action: "create",
      countryId: body.originCountryId ?? null,
      countryBranchId: body.originCountryBranchId ?? null,
      cityBranchId: body.originCityBranchId ?? null
    });
    const result = await createShippingTransfer({
      session,
      sourceTable: body.sourceTable,
      sourceId: body.sourceId,
      sourceReferenceNo: body.sourceReferenceNo ?? null,
      sourceLedgerId: body.sourceLedgerId ?? null,
      clearingAgentId: body.clearingAgentId ?? null,
      origin: { countryId: body.originCountryId, countryBranchId: body.originCountryBranchId, cityBranchId: body.originCityBranchId },
      destination: { countryId: body.destCountryId, countryBranchId: body.destCountryBranchId, cityBranchId: body.destCityBranchId },
      amount: body.amount,
      currencyCode: body.currencyCode,
      exchangeRate: body.exchangeRate,
      category: body.category ?? null,
      blReference: body.blReference ?? null,
      supportingDocument: body.supportingDocument ?? null
    });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
