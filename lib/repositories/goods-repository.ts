import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type GoodsVariationRow = {
  id: string;
  goods_id: string;
  size: string;
  brand: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GoodsRow = {
  id: string;
  chs_code: string;
  goods_name: string;
  origin_country_id: string | null;
  original_language_code: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_origins: number;
  total_sizes: number;
  total_brands: number;
  variations: GoodsVariationRow[];
};

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class GoodsRepository {
  async search(input: { query?: string | null; limit?: number }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 250);

    let query = supabase
      .from("goods")
      .select(`
        id,
        chs_code,
        goods_name,
        origin_country_id,
        original_language_code,
        is_active,
        created_by,
        created_at,
        updated_at,
        variations:goods_variations(
          id,
          goods_id,
          size,
          brand,
          is_active,
          created_by,
          created_at,
          updated_at
        )
      `)
      .is("deleted_at", null);

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
      
      // Stage 1: Find variation matches
      const { data: varMatches } = await supabase
        .from("goods_variations")
        .select("goods_id")
        .or(`size.ilike.${like},brand.ilike.${like}`)
        .is("deleted_at", null);

      const matchedIds = Array.isArray(varMatches) 
        ? [...new Set(varMatches.map((v: any) => v.goods_id))]
        : [];

      if (matchedIds.length > 0) {
        const idList = matchedIds.map(id => `"${id}"`).join(",");
        query = query.or(`chs_code.ilike.${like},goods_name.ilike.${like},id.in.(${idList})`);
      } else {
        query = query.or(`chs_code.ilike.${like},goods_name.ilike.${like}`);
      }
    }

    // Sort by name
    query = query.order("goods_name", { ascending: true });

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);

    const goods = (data ?? []).map((row: any) => {
      // Filter out soft-deleted variations
      const variations = (row.variations ?? []).filter((v: any) => v.deleted_at === undefined || v.deleted_at === null);
      
      // Unique origin is just the master's origin
      const uniqueOrigins = new Set([row.origin_country_id].filter(Boolean));
      const uniqueSizes = new Set(variations.map((v: any) => v.size).filter(Boolean));
      const uniqueBrands = new Set(variations.map((v: any) => v.brand).filter(Boolean));

      return {
        ...row,
        variations,
        total_origins: uniqueOrigins.size,
        total_sizes: uniqueSizes.size,
        total_brands: uniqueBrands.size
      };
    }) as GoodsRow[];

    return { goods, limit };
  }

  async getById(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("goods")
      .select(`
        id,
        chs_code,
        goods_name,
        origin_country_id,
        original_language_code,
        is_active,
        created_by,
        created_at,
        updated_at,
        variations:goods_variations(
          id,
          goods_id,
          size,
          brand,
          is_active,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) throw new Error(error.message);

    const variations = (data.variations ?? []).filter((v: any) => v.deleted_at === undefined || v.deleted_at === null);
    const uniqueOrigins = new Set([data.origin_country_id].filter(Boolean));
    const uniqueSizes = new Set(variations.map((v: any) => v.size).filter(Boolean));
    const uniqueBrands = new Set(variations.map((v: any) => v.brand).filter(Boolean));

    return {
      ...data,
      variations,
      total_origins: uniqueOrigins.size,
      total_sizes: uniqueSizes.size,
      total_brands: uniqueBrands.size
    } as GoodsRow;
  }

  async checkChsCodeExists(chsCode: string, excludeId?: string) {
    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("goods")
      .select("id")
      .eq("chs_code", chsCode.trim())
      .is("deleted_at", null);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  }

  async create(input: {
    chsCode: string;
    goodsName: string;
    originCountryId?: string | null;
    originalLanguageCode?: string;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("goods")
      .insert({
        chs_code: input.chsCode.trim(),
        goods_name: input.goodsName.trim(),
        origin_country_id: input.originCountryId || null,
        original_language_code: input.originalLanguageCode || "en",
        is_active: true,
        created_by: input.createdBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async update(
    id: string,
    input: {
      chsCode?: string;
      goodsName?: string;
      originCountryId?: string | null;
      isActive?: boolean;
    }
  ) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (input.chsCode !== undefined) patch.chs_code = input.chsCode.trim();
    if (input.goodsName !== undefined) patch.goods_name = input.goodsName.trim();
    if (input.originCountryId !== undefined) patch.origin_country_id = input.originCountryId;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { error } = await supabase
      .from("goods")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const nowStr = new Date().toISOString();

    // Soft-delete the master record
    const { error } = await supabase
      .from("goods")
      .update({ deleted_at: nowStr, updated_at: nowStr })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);

    // Also soft-delete all child variations
    const { error: childError } = await supabase
      .from("goods_variations")
      .update({ deleted_at: nowStr, updated_at: nowStr })
      .eq("goods_id", id)
      .is("deleted_at", null);

    if (childError) throw new Error(childError.message);
  }

  // --- Variation CRUD ---

  async createVariation(input: {
    goodsId: string;
    size: string;
    brand: string;
    createdBy?: string | null;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const cleanSize = input.size.trim().toUpperCase();
    const cleanBrand = input.brand.trim().toUpperCase();
    
    // Check duplication
    let dupCheckQuery = supabase
      .from("goods_variations")
      .select("id")
      .eq("goods_id", input.goodsId)
      .ilike("size", cleanSize)
      .ilike("brand", cleanBrand)
      .is("deleted_at", null);

    const { data: existing, error: checkError } = await dupCheckQuery;

    if (checkError) throw new Error(checkError.message);
    if (Array.isArray(existing) && existing.length > 0) {
      throw new Error("A variation with this combination of Size and Brand already exists.");
    }

    const { data, error } = await supabase
      .from("goods_variations")
      .insert({
        goods_id: input.goodsId,
        size: cleanSize,
        brand: cleanBrand,
        is_active: true,
        created_by: input.createdBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async updateVariation(
    id: string,
    input: {
      goodsId?: string;
      size?: string;
      brand?: string;
      isActive?: boolean;
    }
  ) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    const cleanSize = input.size !== undefined ? input.size.trim().toUpperCase() : undefined;
    const cleanBrand = input.brand !== undefined ? input.brand.trim().toUpperCase() : undefined;

    if (cleanSize !== undefined) patch.size = cleanSize;
    if (cleanBrand !== undefined) patch.brand = cleanBrand;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    // Duplication check if changing key details
    if (input.goodsId && (input.size !== undefined || input.brand !== undefined)) {
      const { data: existingVar } = await supabase
        .from("goods_variations")
        .select("goods_id, size, brand")
        .eq("id", id)
        .single();
      
      const checkGoodsId = input.goodsId;
      const checkSize = cleanSize !== undefined ? cleanSize : existingVar?.size;
      const checkBrand = cleanBrand !== undefined ? cleanBrand : existingVar?.brand;

      let dupQuery = supabase
        .from("goods_variations")
        .select("id")
        .eq("goods_id", checkGoodsId)
        .eq("size", checkSize)
        .eq("brand", checkBrand)
        .neq("id", id)
        .is("deleted_at", null);

      const { data: dup, error: checkError } = await dupQuery;

      if (checkError) throw new Error(checkError.message);
      if (Array.isArray(dup) && dup.length > 0) {
        throw new Error("Another variation with this combination of Size and Brand already exists.");
      }
    }

    const { error } = await supabase
      .from("goods_variations")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
  }

  async softDeleteVariation(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const nowStr = new Date().toISOString();

    const { error } = await supabase
      .from("goods_variations")
      .update({ deleted_at: nowStr, updated_at: nowStr })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
  }
}

export const goodsRepository = new GoodsRepository();
