import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { customerUpdateSchema } from "@/lib/api/erp-validation";
import { customersService } from "@/lib/services/customers-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    // Note: customer scope is enforced by countryId in API calls that link customers later.
    authorizeApiScope(session, {
      resource: "customers",
      action: "read",
      countryId: request.nextUrl.searchParams.get("countryId")
    });

    const data = await customersService.getById(id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    // Always resolve — even when lang === "en" — because the base column holds whatever
    // script the record was originally typed in. If that was Urdu/Arabic/etc, skipping
    // resolution for English would leak the raw source-language text into the English view
    // (the exact bug reported: "English selected but Urdu name shows").
    if (data?.customer) {
      const [resolved] = await localizeRecordNames([data.customer as any], "customers", "customer_name", lang);
      const [resolved2] = await localizeRecordNames([resolved], "customers", "company_name", lang);
      (data as any).customer = resolved2;
    }
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const body = customerUpdateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "customers",
      action: "update",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    await customersService.update(
      id,
      {
        stateProvinceId: body.stateProvinceId ?? null,
        districtId: body.districtId ?? null,
        cityId: body.cityId ?? null,
        areaLocationId: body.areaLocationId ?? null,
        customerName: body.customerName,
        // Only touch person-identity fields when the caller actually sent them, so unrelated
        // customer edits never wipe an existing first/last/gender/photo.
        ...(body.firstName !== undefined ? { firstName: body.firstName ?? null } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName ?? null } : {}),
        ...(body.fatherName !== undefined ? { fatherName: body.fatherName ?? null } : {}),
        ...(body.gender !== undefined ? { gender: body.gender ?? null } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl ?? null } : {}),
        companyName: body.companyName ?? null,
        contactPerson: body.contactPerson ?? null,
        mobile: body.mobile ?? null,
        whatsapp: body.whatsapp ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
        originalLanguage: body.originalLanguage
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "customer.update.api",
      entityTable: "customers",
      entityId: id,
      after: body
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    authorizeApiScope(session, {
      resource: "customers",
      action: "delete",
      countryId: request.nextUrl.searchParams.get("countryId")
    });

    await customersService.softDelete(id);

    await auditApiAction(request, {
      action: "customer.delete.api",
      entityTable: "customers",
      entityId: id
    });

    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

