import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { customerUpdateSchema } from "@/lib/api/erp-validation";
import { customersService } from "@/lib/services/customers-service";

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

