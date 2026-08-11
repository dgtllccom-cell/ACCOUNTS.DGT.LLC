import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { bankCreateSchema } from "@/lib/api/erp-validation";
import { banksService } from "@/lib/services/banks-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();

    const query = request.nextUrl.searchParams.get("q");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    const result = await banksService.search({
      query,
      countryId,
      limit: limit ? Number(limit) : 50
    });

    let banks: any[] = (result as any).banks ?? [];
    // Always resolve — see customers/[id]/route.ts for why skipping lang === "en" would leak
    // non-English source text into the English view.
    if (Array.isArray(banks) && banks.length > 0) {
      banks = await localizeRecordNames<any>(banks, "banks", "bank_name", lang);
      banks = await localizeRecordNames<any>(banks, "banks", "branch_name", lang);
      banks = await localizeRecordNames<any>(banks, "banks", "short_name", lang);
    }

    return apiOk({ ...(result as any), banks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = bankCreateSchema.parse(await request.json());

    const bankId = await banksService.create(
      {
        bankType: body.bankType,
        accountType: body.accountType,
        bankName: body.bankName,
        branchName: body.branchName,
        branchCode: body.branchCode,
        branchCodeType: body.branchCodeType,
        shortName: body.shortName,
        accountTitle: body.accountTitle,
        accountNumber: body.accountNumber,
        ibanNumber: body.ibanNumber ?? null,
        currency: body.currency,
        accountStatus: body.accountStatus,
        countryId: body.countryId ?? null,
        stateProvinceId: body.stateProvinceId ?? null,
        districtId: body.districtId ?? null,
        cityId: body.cityId ?? null,
        fullAddress: body.fullAddress ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        swiftBic: body.swiftBic ?? null,
        website: body.website ?? null,
        remarks: body.remarks ?? null,
        originalLanguage: body.originalLanguage
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "banks.create.api",
      entityTable: "banks",
      entityId: bankId,
      after: {
        bankName: body.bankName,
        accountTitle: body.accountTitle,
        accountNumber: body.accountNumber,
        branchName: body.branchName,
        currency: body.currency
      }
    });

    return apiCreated({ bankId });
  } catch (error) {
    return handleApiError(error);
  }
}
