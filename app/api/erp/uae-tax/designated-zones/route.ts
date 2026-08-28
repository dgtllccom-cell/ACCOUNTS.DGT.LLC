import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  id: z.string().uuid().optional(),
  zoneName: z.string().trim().min(2).max(120),
  emirate: z.string().trim().max(60).nullish(),
  zoneType: z.enum(["free_zone", "designated_zone", "mainland_special"]),
  isDesignated: z.boolean(),
  status: z.enum(["active", "inactive", "superseded"]).optional(),
  sourceReference: z.string().trim().max(300).nullish(),
});

export async function GET() {
  try {
    await guardUaeTax("read");
    const zones = await uaeTaxService.listDesignatedZones();
    return apiOk({ zones });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("settings");
    const body = schema.parse(await request.json());
    const result = await uaeTaxService.upsertDesignatedZone({ ...body, actor: session.userId });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
