import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrOnboardingService } from "@/lib/services/hr-onboarding-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const seedSchema = z.object({
  employeeId: z.string().uuid(),
  phase: z.enum(["onboarding", "offboarding"]),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(sp.get("lang"));
    if (sp.get("view") === "summary") {
      const rows = await hrOnboardingService.summary(scope, sp.get("phase") || undefined);
      return apiOk({ rows });
    }
    let rows: any[] = await hrOnboardingService.list(scope, {
      phase: sp.get("phase") || undefined,
      employeeId: sp.get("employeeId") || undefined,
      status: sp.get("status") || undefined,
    });
    try {
      rows = await localizeRecordFields<any>(rows, "hr_employee_checklist", ["task_name"], lang);
    } catch {
      // keep original task names
    }
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = seedSchema.parse(await request.json());
    const res = await hrOnboardingService.seed(body.employeeId, body.phase, session.userId, scope);
    return apiCreated(res);
  } catch (error) {
    return handleApiError(error);
  }
}
