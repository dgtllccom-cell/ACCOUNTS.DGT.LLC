import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { customerCreateSchema } from "@/lib/api/erp-validation";
import { customersService } from "@/lib/services/customers-service";

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
    const countryId = request.nextUrl.searchParams.get("countryId");
    const limit = request.nextUrl.searchParams.get("limit");

    const result = await customersService.search({
      query,
      countryId,
      limit: limit ? Number(limit) : 20
    });

    return apiOk(result);
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

