import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrLifecycleService } from "@/lib/services/hr-lifecycle-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") ?? "position";
    if (type === "transfer") {
      const rows = await hrLifecycleService.listTransfers(scope, {
        status: sp.get("status") || undefined,
        transferType: sp.get("transferType") || undefined,
      });
      return apiOk({ rows });
    }
    if (type === "separation") {
      const rows = await hrLifecycleService.listSeparations(scope, {
        status: sp.get("status") || undefined,
        separationType: sp.get("separationType") || undefined,
        settlementStatus: sp.get("settlementStatus") || undefined,
      });
      return apiOk({ rows });
    }
    const rows = await hrLifecycleService.listPositionEvents(scope, {
      status: sp.get("status") || undefined,
      eventType: sp.get("eventType") || undefined,
      fromDate: sp.get("fromDate") || undefined,
      toDate: sp.get("toDate") || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

const positionSchema = z.object({
  kind: z.literal("position"),
  employeeId: z.string().uuid(),
  eventType: z.enum(["promotion", "demotion", "salary_revision", "confirmation", "probation_extension", "role_change"]),
  effectiveDate: z.string(),
  newDesignation: z.string().trim().max(160).nullish(),
  newDesignationId: z.string().uuid().nullish(),
  newDepartment: z.string().trim().max(160).nullish(),
  newBasicSalary: z.number().nonnegative().nullish(),
  newMonthlySalary: z.number().nonnegative().nullish(),
  salaryCurrency: z.string().trim().max(8).nullish(),
  reason: z.string().trim().max(2000).nullish(),
  referenceNo: z.string().trim().max(80).nullish(),
});

const transferSchema = z.object({
  kind: z.literal("transfer"),
  employeeId: z.string().uuid(),
  transferType: z.enum(["country", "main_branch", "city_branch", "department", "manager"]),
  effectiveDate: z.string(),
  newCountryId: z.string().uuid().nullish(),
  newCountryBranchId: z.string().uuid().nullish(),
  newCityBranchId: z.string().uuid().nullish(),
  newDepartment: z.string().trim().max(160).nullish(),
  newManagerId: z.string().uuid().nullish(),
  reason: z.string().trim().max(2000).nullish(),
  referenceNo: z.string().trim().max(80).nullish(),
});

const separationSchema = z.object({
  kind: z.literal("separation"),
  employeeId: z.string().uuid(),
  separationType: z.enum(["resignation", "termination", "end_of_contract", "retirement", "absconding", "death", "redundancy"]),
  noticeDate: z.string().nullish(),
  lastWorkingDate: z.string(),
  reason: z.string().trim().max(2000).nullish(),
  rehireEligible: z.boolean().optional(),
  exitNotes: z.string().trim().max(2000).nullish(),
  referenceNo: z.string().trim().max(80).nullish(),
});

const bodySchema = z.discriminatedUnion("kind", [positionSchema, transferSchema, separationSchema]);

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = bodySchema.parse(await request.json());
    if (body.kind === "position") {
      const res = await hrLifecycleService.createPositionEvent(body, session.userId, scope);
      return apiCreated({ event: res });
    }
    if (body.kind === "transfer") {
      const res = await hrLifecycleService.createTransfer(body, session.userId, scope);
      return apiCreated({ transfer: res });
    }
    const res = await hrLifecycleService.createSeparation(body, session.userId, scope);
    return apiCreated({ separation: res });
  } catch (error) {
    return handleApiError(error);
  }
}
