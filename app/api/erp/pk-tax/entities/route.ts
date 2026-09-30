import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
// Reused, unmodified: uaeTaxService's entity CRUD (listEntities/createEntity) is
// genuinely country-agnostic (scoped by country_id, no UAE-specific logic) — see
// pk-tax-api.ts's header comment. A new entities table/service would duplicate
// exactly this.
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  countryId: z.string().uuid(),
  companyId: z.string().uuid().nullish(),
  trn: z.string().trim().min(5).max(30), // NTN or STRN
  legalName: z.string().trim().min(2).max(200),
  registeredName: z.string().trim().max(200).nullish(),
  registrationDate: z.string().nullish(),
  filingFrequency: z.enum(["monthly", "quarterly"]).default("monthly"),
  firstPeriodStart: z.string().nullish(),
  baseCurrency: z.string().trim().length(3).default("PKR"),
  address: z.string().trim().max(500).nullish(),
  phone: z.string().trim().max(50).nullish(),
  email: z.string().trim().email().max(200).nullish().or(z.literal("")),
});

export async function GET() {
  try {
    const { scope } = await guardPkTax("read");
    const entities = await uaeTaxService.listEntities(scope);
    return apiOk({ entities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardPkTax("write");
    const body = createSchema.parse(await request.json());
    const { id } = await uaeTaxService.createEntity({
      ...body,
      email: body.email || null,
      createdBy: session.userId,
    });
    return apiCreated({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
