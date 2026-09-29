import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { createEstablishment, listEstablishments } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  companyId: z.string().uuid(),
  establishmentId: z.string().trim(),
  employerRoutingCode: z.string().trim(),
  agentName: z.string().trim().max(120).nullish(),
  employerReference: z.string().trim().max(60).nullish(),
  cityBranchId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
});

export async function GET() {
  try {
    const { session } = await guardWps("read");
    return apiOk({ establishments: await listEstablishments(session) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardWps("write");
    return apiCreated(await createEstablishment(session, createSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}
