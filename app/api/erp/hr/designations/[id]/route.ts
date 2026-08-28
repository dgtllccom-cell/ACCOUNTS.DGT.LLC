import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrMastersService } from "@/lib/services/hr-masters-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });

const patchSchema = z.object({
  code: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  departmentId: z.string().uuid().nullish(),
  countryId: z.string().uuid().nullish(),
  payGrade: z.string().trim().max(40).nullish(),
  minBasicSalary: z.number().nonnegative().nullish(),
  maxBasicSalary: z.number().nonnegative().nullish(),
  salaryCurrency: z.string().trim().max(8).nullish(),
  rankOrder: z.number().int().nullish(),
  description: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrMastersService.updateDesignation(id, body, session.userId, scope);
    return apiOk({ designation: res });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const res = await hrMastersService.deleteDesignation(id, session.userId, scope);
    return apiOk({ deleted: res });
  } catch (error) {
    return handleApiError(error);
  }
}
