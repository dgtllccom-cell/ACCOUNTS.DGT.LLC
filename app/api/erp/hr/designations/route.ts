import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";
import { guardHr } from "@/lib/services/hr-api";
import { hrMastersService } from "@/lib/services/hr-masters-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  code: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1).max(160),
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

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrMastersService.listDesignations(scope, {
      search: sp.get("search")?.trim() || undefined,
      departmentId: sp.get("departmentId") || undefined,
      activeOnly: sp.get("activeOnly") === "1",
    });
    let localized = rows as any[];
    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      localized = await localizeRecordFields<any>(localized, "hr_designations", ["title"], lang);
    }
    return apiOk({ rows: localized });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = createSchema.parse(await request.json());
    const res = await hrMastersService.createDesignation(body, session.userId, scope);
    return apiCreated({ designation: res });
  } catch (error) {
    return handleApiError(error);
  }
}
