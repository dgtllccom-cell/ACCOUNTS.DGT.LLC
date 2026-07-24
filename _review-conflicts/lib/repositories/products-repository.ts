import type { ErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProductTranslationInput = {
  languageCode: string;
  productName: string;
  productDescription?: string | null;
  productCategory?: string | null;
  productBrand?: string | null;
  productSpecifications?: string | null;
};

export type ProductRow = {
  id: string;
  product_code: string;
  sku: string | null;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  product_name: string;
  product_description: string | null;
  product_specifications: Record<string, unknown>;
  hs_code: string | null;
  size: string | null;
  origin_country_id: string | null;
  image_url: string | null;
  original_language_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductListRow = ProductRow & {
  translated_name: string | null;
  translated_description: string | null;
  translated_category: string | null;
  translated_brand: string | null;
  translated_specifications: string | null;
  category_name: string | null;
  brand_name: string | null;
  unit_code: string | null;
  unit_name: string | null;
};

function cleanQuery(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function applySessionScope(query: any, session: ErpSession) {
  if (session.isSuperAdmin) return query;
  if (session.cityBranchIds.length) return query.in("city_branch_id", session.cityBranchIds);
  if (session.countryBranchIds.length) return query.in("country_branch_id", session.countryBranchIds);
  if (session.countryIds.length) return query.in("country_id", session.countryIds);
  return query.eq("id", "00000000-0000-0000-0000-000000000000");
}

export class ProductsRepository {
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
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 500);
    const lang = input.languageCode ?? input.session.preferredLanguage ?? "en";

    let query = supabase
      .from("products")
      .select(
        [
          "id, product_code, sku, country_id, state_province_id, city_id, country_branch_id, city_branch_id",
          "category_id, brand_id, unit_id, product_name, product_description, product_specifications",
          "hs_code, size, origin_country_id, image_url, original_language_code, is_active, created_at, updated_at",
          "product_categories(category_name)",
          "product_brands(brand_name)",
          "product_units(unit_code, unit_name)",
          "product_translations!left(language_code, product_name, product_description, product_category, product_brand, product_specifications)"
        ].join(", ")
      )
      .is("deleted_at", null)
      .eq("product_translations.language_code", lang)
      .order("product_name", { ascending: true });

    query = applySessionScope(query, input.session);
    if (input.countryId) query = query.eq("country_id", input.countryId);
    if (input.stateProvinceId) query = query.eq("state_province_id", input.stateProvinceId);
    if (input.cityId) query = query.eq("city_id", input.cityId);
    if (input.countryBranchId) query = query.eq("country_branch_id", input.countryBranchId);
    if (input.cityBranchId) query = query.eq("city_branch_id", input.cityBranchId);

    const q = cleanQuery(input.query);
    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `product_name.ilike.${like}`,
          `product_code.ilike.${like}`,
          `sku.ilike.${like}`,
          `hs_code.ilike.${like}`
        ].join(",")
      );
    }

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);

    const products = (data ?? []).map((row: any) => {
      const translation = Array.isArray(row.product_translations) ? row.product_translations[0] : row.product_translations;
      return {
        ...row,
        translated_name: translation?.product_name ?? null,
        translated_description: translation?.product_description ?? null,
        translated_category: translation?.product_category ?? null,
        translated_brand: translation?.product_brand ?? null,
        translated_specifications: translation?.product_specifications ?? null,
        category_name: row.product_categories?.category_name ?? null,
        brand_name: row.product_brands?.brand_name ?? null,
        unit_code: row.product_units?.unit_code ?? null,
        unit_name: row.product_units?.unit_name ?? null,
        product_categories: undefined,
        product_brands: undefined,
        product_units: undefined,
        product_translations: undefined
      };
    }) as ProductListRow[];

    return { products, limit, languageCode: lang };
  }

  async getById(id: string, session: ErpSession, languageCode?: string | null) {
    const result = await this.search({ session, languageCode, limit: 1 });
    const product = result.products.find((row) => row.id === id);
    if (product) return product;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null);
    query = applySessionScope(query, session);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Product not found or not accessible");
    return data as ProductRow;
  }

  async create(input: {
    productCode: string;
    sku?: string | null;
    countryId: string;
    stateProvinceId?: string | null;
    cityId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
    unitId?: string | null;
    productName: string;
    productDescription?: string | null;
    productSpecifications?: Record<string, unknown>;
    hsCode?: string | null;
    size?: string | null;
    originCountryId?: string | null;
    imageUrl?: string | null;
    originalLanguageCode: string;
    actorId?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("products")
      .insert({
        product_code: input.productCode,
        sku: input.sku ?? null,
        country_id: input.countryId,
        state_province_id: input.stateProvinceId ?? null,
        city_id: input.cityId ?? null,
        country_branch_id: input.countryBranchId ?? null,
        city_branch_id: input.cityBranchId ?? null,
        category_id: input.categoryId ?? null,
        brand_id: input.brandId ?? null,
        unit_id: input.unitId ?? null,
        product_name: input.productName,
        product_description: input.productDescription ?? null,
        product_specifications: input.productSpecifications ?? {},
        hs_code: input.hsCode ?? null,
        size: input.size ?? null,
        origin_country_id: input.originCountryId ?? null,
        image_url: input.imageUrl ?? null,
        original_language_code: input.originalLanguageCode,
        created_by: input.actorId ?? null
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async update(
    id: string,
    input: Partial<{
      productCode: string;
      sku: string | null;
      countryId: string;
      stateProvinceId: string | null;
      cityId: string | null;
      countryBranchId: string | null;
      cityBranchId: string | null;
      categoryId: string | null;
      brandId: string | null;
      unitId: string | null;
      productName: string;
      productDescription: string | null;
      productSpecifications: Record<string, unknown>;
      hsCode: string | null;
      size: string | null;
      originCountryId: string | null;
      imageUrl: string | null;
      originalLanguageCode: string;
      isActive: boolean;
    }>
  ) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.productCode !== undefined) patch.product_code = input.productCode;
    if (input.sku !== undefined) patch.sku = input.sku;
    if (input.countryId !== undefined) patch.country_id = input.countryId;
    if (input.stateProvinceId !== undefined) patch.state_province_id = input.stateProvinceId;
    if (input.cityId !== undefined) patch.city_id = input.cityId;
    if (input.countryBranchId !== undefined) patch.country_branch_id = input.countryBranchId;
    if (input.cityBranchId !== undefined) patch.city_branch_id = input.cityBranchId;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
    if (input.brandId !== undefined) patch.brand_id = input.brandId;
    if (input.unitId !== undefined) patch.unit_id = input.unitId;
    if (input.productName !== undefined) patch.product_name = input.productName;
    if (input.productDescription !== undefined) patch.product_description = input.productDescription;
    if (input.productSpecifications !== undefined) patch.product_specifications = input.productSpecifications;
    if (input.hsCode !== undefined) patch.hs_code = input.hsCode;
    if (input.size !== undefined) patch.size = input.size;
    if (input.originCountryId !== undefined) patch.origin_country_id = input.originCountryId;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
    if (input.originalLanguageCode !== undefined) patch.original_language_code = input.originalLanguageCode;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { error } = await supabase.from("products").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async upsertTranslations(productId: string, translations: ProductTranslationInput[], actorId?: string | null) {
    if (!translations.length) return;
    const supabase = createSupabaseAdminClient() as any;
    for (const translation of translations) {
      const row = {
        product_id: productId,
        language_code: translation.languageCode,
        product_name: translation.productName,
        product_description: translation.productDescription ?? null,
        product_category: translation.productCategory ?? null,
        product_brand: translation.productBrand ?? null,
        product_specifications: translation.productSpecifications ?? null,
        corrected_by: actorId ?? null,
        corrected_at: actorId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { data: updated, error: updateError } = await supabase
        .from("product_translations")
        .update(row)
        .eq("product_id", productId)
        .eq("language_code", translation.languageCode)
        .is("deleted_at", null)
        .select("id");
      if (updateError) throw new Error(updateError.message);
      if (Array.isArray(updated) && updated.length) continue;

      const { error: insertError } = await supabase.from("product_translations").insert(row);
      if (insertError) throw new Error(insertError.message);
    }
  }
}

export const productsRepository = new ProductsRepository();
