import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrMastersService } from "@/lib/services/hr-masters-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(160),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  headEmployeeId: z.string().uuid().nullish(),
  parentDepartmentId: z.string().uuid().nullish(),
  monthlyBudget: z.number().nonnegative().nullish(),
  budgetCurrency: z.string().trim().max(8).nullish(),
  description: z.string().trim().max(2000).nullish(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrMastersService.listDepartments(scope, {
      search: sp.get("search")?.trim() || undefined,
      activeOnly: sp.get("activeOnly") === "1",
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = createSchema.parse(await request.json());
    const res = await hrMastersService.createDepartment(body, session.userId ?? null, scope);
    return apiCreated({ department: res });
  } catch (error) {
    return handleApiError(error);
  }
}
