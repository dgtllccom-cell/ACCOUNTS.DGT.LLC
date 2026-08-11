import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { bankUpdateSchema } from "@/lib/api/erp-validation";
import { banksService } from "@/lib/services/banks-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    let bank: any = await banksService.getById((await params).id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    // Always resolve — see customers/[id]/route.ts for why skipping lang === "en" would leak
    // non-English source text into the English view.
    if (bank) {
      const [r1] = await localizeRecordNames([bank], "banks", "bank_name", lang);
      const [r2] = await localizeRecordNames([r1], "banks", "branch_name", lang);
      const [r3] = await localizeRecordNames([r2], "banks", "short_name", lang);
      bank = r3;
    }
    return apiOk({ bank });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const body = bankUpdateSchema.parse(await request.json());

    await banksService.update((await params).id, body, session.userId);

    await auditApiAction(request, {
      action: "banks.update.api",
      entityTable: "banks",
      entityId: (await params).id,
      after: body
    });

    return apiOk({ bankId: (await params).id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    await banksService.softDelete((await params).id);

    await auditApiAction(request, {
      action: "banks.delete.api",
      entityTable: "banks",
      entityId: (await params).id
    });

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
