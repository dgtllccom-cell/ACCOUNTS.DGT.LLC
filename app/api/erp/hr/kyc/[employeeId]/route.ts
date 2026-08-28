import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramSchema = z.object({ employeeId: z.string().uuid() });

const docSchema = z.object({
  requirementCode: z.string().trim().min(1).max(60),
  documentType: z.string().trim().max(80).optional(),
  documentNumber: z.string().trim().max(120).nullish(),
  issuingAuthority: z.string().trim().max(160).nullish(),
  issueDate: z.string().nullish(),
  expiryDate: z.string().nullish(),
  fileUrl: z.string().trim().max(1000).nullish(),
  officeDocumentId: z.string().uuid().nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ employeeId: string }> }) {
  try {
    const { scope } = await guardHr("read");
    const { employeeId } = paramSchema.parse(await ctx.params);
    const data = await hrKycService.employeeChecklist(employeeId, scope);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ employeeId: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { employeeId } = paramSchema.parse(await ctx.params);
    const body = docSchema.parse(await request.json());
    const res = await hrKycService.upsertDocument({ employeeId, ...body }, session.userId, scope);
    return apiCreated({ document: res });
  } catch (error) {
    return handleApiError(error);
  }
}
