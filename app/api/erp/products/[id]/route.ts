import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { productUpdateSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { productsService } from "@/lib/services/products-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "products", action: "read" });
    const result = await productsService.getById(id, session, request.nextUrl.searchParams.get("lang"));
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = productUpdateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "products",
      action: "update",
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    await productsService.update(
      id,
      {
        countryId: body.countryId,
        stateProvinceId: body.stateProvinceId,
        cityId: body.cityId,
        countryBranchId: body.countryBranchId,
        cityBranchId: body.cityBranchId,
        categoryId: body.categoryId,
        brandId: body.brandId,
        unitId: body.unitId,
        productCode: body.productCode,
        sku: body.sku,
        productName: body.productName,
        productDescription: body.productDescription,
        productSpecifications: body.productSpecifications,
        hsCode: body.hsCode,
        size: body.size,
        originCountryId: body.originCountryId,
        imageUrl: body.imageUrl,
        originalLanguage: body.originalLanguage,
        translations: body.translations
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "products.update.api",
      entityTable: "products",
      entityId: id,
      after: body
    });

    return apiOk({ productId: id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "products", action: "delete" });

    await productsService.softDelete(id);
    await auditApiAction(request, {
      action: "products.delete.api",
      entityTable: "products",
      entityId: id
    });

    return apiOk({ productId: id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
