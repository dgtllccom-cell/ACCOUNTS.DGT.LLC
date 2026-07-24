import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { productCreateSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { productsService } from "@/lib/services/products-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const countryId = params.get("countryId");
    const stateProvinceId = params.get("stateProvinceId");
    const cityId = params.get("cityId");
    const countryBranchId = params.get("countryBranchId");
    const cityBranchId = params.get("cityBranchId");

    authorizeApiScope(session, {
      resource: "products",
      action: "read",
      countryId,
      countryBranchId,
      cityBranchId
    });

    const result = await productsService.search({
      session,
      query: params.get("q"),
      languageCode: params.get("lang"),
      countryId,
      stateProvinceId,
      cityId,
      countryBranchId,
      cityBranchId,
      limit: params.get("limit") ? Number(params.get("limit")) : 50
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = productCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "products",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const productId = await productsService.create(
      {
        countryId: body.countryId,
        stateProvinceId: body.stateProvinceId ?? null,
        cityId: body.cityId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null,
        categoryId: body.categoryId ?? null,
        brandId: body.brandId ?? null,
        unitId: body.unitId ?? null,
        productCode: body.productCode,
        sku: body.sku ?? null,
        productName: body.productName,
        productDescription: body.productDescription ?? null,
        productSpecifications: body.productSpecifications ?? {},
        hsCode: body.hsCode ?? null,
        size: body.size ?? null,
        originCountryId: body.originCountryId ?? null,
        imageUrl: body.imageUrl ?? null,
        originalLanguage: body.originalLanguage,
        translations: body.translations
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "products.create.api",
      entityTable: "products",
      entityId: productId,
      after: {
        countryId: body.countryId,
        stateProvinceId: body.stateProvinceId ?? null,
        cityId: body.cityId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null,
        productCode: body.productCode,
        productName: body.productName
      }
    });

    return apiCreated({ productId });
  } catch (error) {
    return handleApiError(error);
  }
}
