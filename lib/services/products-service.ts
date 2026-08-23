import type { ErpSession } from "@/lib/auth/session";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { productsRepository, type ProductTranslationInput } from "@/lib/repositories/products-repository";

type ProductInput = {
  countryId: string;
  stateProvinceId?: string | null;
  cityId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  productCode: string;
  sku?: string | null;
  productName: string;
  productDescription?: string | null;
  productSpecifications?: Record<string, unknown>;
  hsCode?: string | null;
  size?: string | null;
  originCountryId?: string | null;
  imageUrl?: string | null;
  originalLanguage: SupportedLanguage;
  translations?: ProductTranslationInput[];
};

export class ProductsService {
  async search(input: {
    session: ErpSession;
    query?: string | null;
    languageCode?: string | null;
    countryId?: string | null;
    stateProvinceId?: string | null;
    cityId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    limit?: number;
  }) {
    return await productsRepository.search(input);
  }

  async getById(id: string, session: ErpSession, languageCode?: string | null) {
    const product = await productsRepository.getById(id, session, languageCode);
    return { product };
  }

  async create(input: ProductInput, actorId?: string | null) {
    const productId = await productsRepository.create({
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId ?? null,
      cityId: input.cityId ?? null,
      countryBranchId: input.countryBranchId ?? null,
      cityBranchId: input.cityBranchId ?? null,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      unitId: input.unitId ?? null,
      productCode: input.productCode,
      sku: input.sku ?? null,
      productName: input.productName,
      productDescription: input.productDescription ?? null,
      productSpecifications: input.productSpecifications ?? {},
      hsCode: input.hsCode ?? null,
      size: input.size ?? null,
      originCountryId: input.originCountryId ?? null,
      imageUrl: input.imageUrl ?? null,
      originalLanguageCode: input.originalLanguage,
      actorId,
      manualTranslations: input.translations
    });

    return productId;
  }

  async update(id: string, input: Partial<ProductInput>, actorId?: string | null) {
    await productsRepository.update(id, {
      countryId: input.countryId,
      stateProvinceId: input.stateProvinceId,
      cityId: input.cityId,
      countryBranchId: input.countryBranchId,
      cityBranchId: input.cityBranchId,
      categoryId: input.categoryId,
      brandId: input.brandId,
      unitId: input.unitId,
      productCode: input.productCode,
      sku: input.sku,
      productName: input.productName,
      productDescription: input.productDescription,
      productSpecifications: input.productSpecifications,
      hsCode: input.hsCode,
      size: input.size,
      originCountryId: input.originCountryId,
      imageUrl: input.imageUrl,
      originalLanguageCode: input.originalLanguage,
      manualTranslations: input.translations,
      actorId: actorId ?? null
    });
  }

  async softDelete(id: string) {
    await productsRepository.softDelete(id);
  }
}

export const productsService = new ProductsService();
