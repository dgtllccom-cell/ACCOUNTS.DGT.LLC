import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  originalEInvoiceId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  totalExclVat: z.number(),
  totalVat: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const { session } = await guardUaeTax("file");
    const body = schema.parse(await request.json());
    const result = await uaeTaxService.createCreditNote({ ...body, actor: session.userId });
    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
