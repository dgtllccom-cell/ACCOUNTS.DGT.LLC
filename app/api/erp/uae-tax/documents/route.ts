import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  officeDocumentId: z.string().uuid(),
  sourceModule: z.string().min(2),
  sourceId: z.string().uuid(),
  relationship: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("write");
    const body = schema.parse(await request.json());
    const result = await uaeTaxService.attachEvidence({ ...body, actor: session.userId });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
