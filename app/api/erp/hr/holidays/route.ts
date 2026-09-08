import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  holidayDate: z.string(),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  holidayType: z.enum(["public", "religious", "national", "company", "weekly_off"]).optional(),
  isRecurring: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrAttendanceLeaveService.listHolidays(scope, {
      year: sp.get("year") ? Number(sp.get("year")) : undefined,
      countryId: sp.get("countryId") || undefined,
    });
    let localized = rows as any[];
    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      localized = await localizeRecordFields<any>(localized, "hr_holidays", ["name"], lang);
    }
    return apiOk({ rows: localized });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = schema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertHoliday(body, null, session.userId, scope);
    return apiCreated({ holiday: res });
  } catch (error) {
    return handleApiError(error);
  }
}
