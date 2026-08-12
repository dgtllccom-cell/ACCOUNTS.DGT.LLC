import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { customerCreateSchema } from "@/lib/api/erp-validation";
import { customersService } from "@/lib/services/customers-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "customers",
      action: "read",
      ...scope
    });

    const query = request.nextUrl.searchParams.get("q");
    let countryId = request.nextUrl.searchParams.get("countryId");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    // Enforce session scope: if user is not super admin and no countryId provided,
    // restrict to their assigned country(ies)
    if (!session.isSuperAdmin && !countryId && session.countryIds.length > 0) {
      countryId = session.countryIds[0];
    }

    const result = await customersService.search({
      query,
      countryId,
      limit: limit ? Number(limit) : 20
    });

    // Resolve customer_name / company_name into the requested language — without this, any
    // consumer of this endpoint (Person Master picker, generic customer search, etc.) always
    // showed whatever script each record happened to be typed in, mixed record-to-record
    // regardless of the selected UI language (the exact "mixed English/Urdu names in the same
    // dropdown" bug). See lib/services/customers-service.ts for the write side.
    let customers: any[] = (result as any).customers ?? [];
    // Always resolve (see [id]/route.ts comment — skipping for lang === "en" would leak
    // non-English source text into the English view whenever a record's original language
    // wasn't English).
    if (Array.isArray(customers) && customers.length > 0) {
      customers = await localizeRecordNames<any>(customers, "customers", "customer_name", lang);
      customers = await localizeRecordNames<any>(customers, "customers", "company_name", lang);
    }

    return apiOk({ ...(result as any), customers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = customerCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "customers",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const customerId = await customersService.create(
      {
        countryId: body.countryId,
        stateProvinceId: body.stateProvinceId ?? null,
        districtId: body.districtId ?? null,
        cityId: body.cityId ?? null,
        areaLocationId: body.areaLocationId ?? null,
        customerName: body.customerName,
        companyName: body.companyName ?? null,
        contactPerson: body.contactPerson ?? null,
        mobile: body.mobile ?? null,
        whatsapp: body.whatsapp ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
        originalLanguage: body.originalLanguage,
        contacts: body.contacts ?? [],
        registrations: body.registrations ?? []
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "customer.create.api",
      entityTable: "customers",
      entityId: customerId,
      after: {
        countryId: body.countryId,
        customerName: body.customerName,
        companyName: body.companyName ?? null,
        email: body.email ?? null,
        mobile: body.mobile ?? null
      }
    });

    return apiCreated({ customerId });
  } catch (error) {
    return handleApiError(error);
  }
}

