import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  countryId: z.string().uuid(),
  companyId: z.string().uuid().nullish(),
  trn: z.string().trim().min(5).max(30),
  legalName: z.string().trim().min(2).max(200),
  registeredName: z.string().trim().max(200).nullish(),
  registrationDate: z.string().nullish(),
  filingFrequency: z.enum(["monthly", "quarterly"]),
  firstPeriodStart: z.string().nullish(),
  baseCurrency: z.string().trim().length(3).default("AED"),
  address: z.string().trim().max(500).nullish(),
  phone: z.string().trim().max(50).nullish(),
  email: z.string().trim().email().max(200).nullish().or(z.literal("")),
});

export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    const entities = await uaeTaxService.listEntities(uaeTaxScopeFromSession(session));
    return apiOk({ entities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax_settings", action: "write" });

    const body = createSchema.parse(await request.json());
    const { id } = await uaeTaxService.createEntity({
      ...body,
      email: body.email || null,
      createdBy: session.userId,
    });
    // Provision the 5 VAT control ledgers immediately so the entity is
    // reconciliation-ready (idempotent).
    await uaeTaxService.bootstrapLedgers(id, session.userId).catch(() => undefined);
    return apiCreated({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
