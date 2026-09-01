import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { withLocalPg } from "@/lib/db/local-postgres";
import { searchRecordIdsByTranslation } from "@/lib/i18n/localize-records";

export type GoodsVariationRow = {
  id: string;
  goods_id: string;
  size: string;
  brand: string;
  variety?: string | null;
  extra_details?: string | null;
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
  category?: string | null;
  variety?: string | null;
  extra_details?: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  min_stock_level?: number | null;
  reorder_level?: number | null;
  barcode?: string | null;
  barcode_type?: string | null;
  total_origins: number;
  total_sizes: number;
  total_brands: number;
  total_varieties: number;
  variations: GoodsVariationRow[];
};

const GOODS_COLUMNS = ["id", "chs_code", "goods_name", "origin_country_id", "original_language_code", "category", "variety", "extra_details", "is_active", "created_by", "created_at", "updated_at", "min_stock_level", "reorder_level", "barcode", "barcode_type"];
const VARIATION_COLUMNS = ["id", "goods_id", "size", "brand", "variety", "extra_details", "is_active", "created_by", "created_at", "updated_at"];

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function withStats(row: any, variations: any[], params: any[] = []) {
  const uniqueOrigins = new Set([row.origin_country_id].filter(Boolean));

  const brandsFromVars = variations.map((v: any) => v.brand).filter(Boolean);
  const brandsFromParams = params.filter((p: any) => p.goods_id === row.id && p.param_type === "brand").map((p: any) => p.param_value);
  const masterBrands = Array.from(new Set([...brandsFromVars, ...brandsFromParams]));

  const sizesFromVars = variations.map((v: any) => v.size).filter(Boolean);
  const sizesFromParams = params.filter((p: any) => p.goods_id === row.id && p.param_type === "size").map((p: any) => p.param_value);
  const masterSizes = Array.from(new Set([...sizesFromVars, ...sizesFromParams]));

  const varietiesFromVars = [row.variety, ...variations.map((v: any) => v.variety)].filter(Boolean);
  const varietiesFromParams = params.filter((p: any) => p.goods_id === row.id && p.param_type === "variety").map((p: any) => p.param_value);
  const masterVarieties = Array.from(new Set([...varietiesFromVars, ...varietiesFromParams]));

  const extraDetailsFromVars = [row.extra_details, ...variations.map((v: any) => v.extra_details)].filter(Boolean);
  const extraDetailsFromParams = params.filter((p: any) => p.goods_id === row.id && p.param_type === "extra_details").map((p: any) => p.param_value);
  const masterExtraDetails = Array.from(new Set([...extraDetailsFromVars, ...extraDetailsFromParams]));

  return {
    ...row,
    variations,
    master_brands: masterBrands,
    master_sizes: masterSizes,
    master_varieties: masterVarieties,
    master_extra_details: masterExtraDetails,
    total_origins: uniqueOrigins.size,
    total_sizes: masterSizes.length,
    total_brands: masterBrands.length,
    total_varieties: masterVarieties.length
  };
}

export class GoodsRepository {
  // `goods`/`goods_variations` have scoped RLS and this app's Supabase client is not
  // guaranteed to carry a real service-role key that bypasses RLS on its own (confirmed
  // live: create failed with "new row violates row-level security policy for table
  // \"goods\""). Reads/writes go through a direct Postgres connection (DATABASE_URL, via
  // withLocalPg — same proven bypass as banks-repository.ts/customers-repository.ts) when
  // available, falling back to the Supabase client otherwise.
  async search(input: { query?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 250);
    const q = cleanQuery(input.query ?? "");
    const like = q ? `%${q}%` : null;

    // Multilingual search: a user searching in Urdu/Arabic/Farsi/Pashto types the term in
    // that language, but goods_name is stored in whatever language it was entered in — a
    // plain ILIKE on the raw column misses it. Widen with any goods whose translated name
    // matches in ANY language, via the central resolver (lib/i18n/localize-records.ts).
    const translatedMatchIds = q ? await searchRecordIdsByTranslation("goods", ["goods_name"], q) : [];

    const viaPg = await withLocalPg(async (sql) => {
      const goodsRows = await sql`
        SELECT ${sql(GOODS_COLUMNS)} FROM public.goods
        WHERE deleted_at IS NULL
          AND (${like ? sql`(chs_code ILIKE ${like} OR goods_name ILIKE ${like} OR id IN (SELECT goods_id FROM public.goods_variations WHERE deleted_at IS NULL AND (size ILIKE ${like} OR brand ILIKE ${like})) OR id = ANY(${translatedMatchIds}::uuid[]))` : sql`true`})
        ORDER BY goods_name ASC
        LIMIT ${limit}
      `;
      const ids = goodsRows.map((r: any) => r.id);
      const variationRows = ids.length
        ? await sql`SELECT ${sql(VARIATION_COLUMNS)} FROM public.goods_variations WHERE goods_id = ANY(${ids}::uuid[]) AND deleted_at IS NULL`
        : [];
      const paramRows = ids.length
        ? await sql`SELECT id, goods_id, param_type, param_value FROM public.goods_master_parameters WHERE deleted_at IS NULL AND is_active = true AND (goods_id = ANY(${ids}::uuid[]) OR goods_id IS NULL)`
        : [];
      const goods = goodsRows.map((row: any) => withStats(row, variationRows.filter((v: any) => v.goods_id === row.id), paramRows));
      return { goods: goods as GoodsRow[], limit };
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("goods")
      .select(`${GOODS_COLUMNS.join(", ")}, variations:goods_variations(${VARIATION_COLUMNS.join(", ")})`)
      .is("deleted_at", null);

    if (q) {
      const likeSql = `%${q}%`;
      const { data: varMatches } = await supabase
        .from("goods_variations")
        .select("goods_id")
        .or(`size.ilike.${likeSql},brand.ilike.${likeSql}`)
        .is("deleted_at", null);
      const matchedIds = new Set(Array.isArray(varMatches) ? varMatches.map((v: any) => v.goods_id) : []);
      for (const id of translatedMatchIds) matchedIds.add(id);
      if (matchedIds.size > 0) {
        const idList = [...matchedIds].map((id) => `"${id}"`).join(",");
        query = query.or(`chs_code.ilike.${likeSql},goods_name.ilike.${likeSql},id.in.(${idList})`);
      } else {
        query = query.or(`chs_code.ilike.${likeSql},goods_name.ilike.${likeSql}`);
      }
    }

    query = query.order("goods_name", { ascending: true });
    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);

    const goods = (data ?? []).map((row: any) => withStats(row, (row.variations ?? []).filter((v: any) => v.deleted_at === undefined || v.deleted_at === null))) as GoodsRow[];
    return { goods, limit };
  }

  async getById(id: string) {
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`SELECT ${sql(GOODS_COLUMNS)} FROM public.goods WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1`;
      if (!rows[0]) return null;
      const variationRows = await sql`SELECT ${sql(VARIATION_COLUMNS)} FROM public.goods_variations WHERE goods_id = ${id}::uuid AND deleted_at IS NULL`;
      return withStats(rows[0], variationRows) as GoodsRow;
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("goods")
      .select(`${GOODS_COLUMNS.join(", ")}, variations:goods_variations(${VARIATION_COLUMNS.join(", ")})`)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);

    const variations = (data.variations ?? []).filter((v: any) => v.deleted_at === undefined || v.deleted_at === null);
    return withStats(data, variations) as GoodsRow;
  }

  async checkChsCodeExists(chsCode: string, excludeId?: string) {
    const clean = chsCode.trim();
    const viaPg = await withLocalPg(async (sql) => {
      const rows = excludeId
        ? await sql`SELECT id FROM public.goods WHERE chs_code = ${clean} AND deleted_at IS NULL AND id != ${excludeId}::uuid`
        : await sql`SELECT id FROM public.goods WHERE chs_code = ${clean} AND deleted_at IS NULL`;
      return rows.length > 0;
    });
    if (viaPg !== null) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase.from("goods").select("id").eq("chs_code", clean).is("deleted_at", null);
    if (excludeId) query = query.neq("id", excludeId);
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
    minStockLevel?: number | null;
    reorderLevel?: number | null;
    barcode?: string | null;
    barcodeType?: string | null;
  }) {
    const insertRow: Record<string, unknown> = {
      chs_code: input.chsCode.trim(),
      goods_name: input.goodsName.trim(),
      origin_country_id: input.originCountryId || null,
      original_language_code: input.originalLanguageCode || "en",
      is_active: true,
      created_by: input.createdBy || null
    };
    if (input.minStockLevel !== undefined) insertRow.min_stock_level = input.minStockLevel;
    if (input.reorderLevel !== undefined) insertRow.reorder_level = input.reorderLevel;
    if (input.barcode !== undefined) insertRow.barcode = input.barcode?.trim() ? input.barcode.trim() : null;
    if (input.barcodeType) insertRow.barcode_type = input.barcodeType;

    let goodsId: string;
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`INSERT INTO public.goods ${sql(insertRow)} RETURNING id`;
      return (rows[0] as any).id as string;
    });

    if (viaPg) {
      goodsId = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase.from("goods").insert(insertRow).select("id").single();
      if (error) throw new Error(error.message);
      goodsId = data.id as string;
    }

    // Translation write is the caller's (goods-service.ts) responsibility — it already calls
    // translateMasterRecord with the real original language + actor after this returns. Do
    // not duplicate that call here (a prior session found and fixed exactly this kind of
    // duplicate/racing write for customers — see customers-repository.ts).
    try {
      const s = await allocateFormSerials("goods", { countryId: input.originCountryId ?? null });
      const serialPatch = { super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial };
      const viaPgSerial = await withLocalPg(async (sql) => {
        await sql`UPDATE public.goods SET ${sql(serialPatch)} WHERE id = ${goodsId}::uuid`;
        return true;
      });
      if (!viaPgSerial) {
        const supabase = createSupabaseAdminClient() as any;
        await supabase.from("goods").update(serialPatch).eq("id", goodsId);
      }
    } catch { /* non-fatal */ }

    return goodsId;
  }

  async update(
    id: string,
    input: {
      chsCode?: string;
      goodsName?: string;
      originCountryId?: string | null;
      isActive?: boolean;
      originalLanguageCode?: string;
      updatedBy?: string | null;
      minStockLevel?: number | null;
      reorderLevel?: number | null;
      barcode?: string | null;
      barcodeType?: string | null;
    }
  ) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.chsCode !== undefined) patch.chs_code = input.chsCode.trim();
    if (input.goodsName !== undefined) patch.goods_name = input.goodsName.trim();
    if (input.originCountryId !== undefined) patch.origin_country_id = input.originCountryId;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.minStockLevel !== undefined) patch.min_stock_level = input.minStockLevel;
    if (input.reorderLevel !== undefined) patch.reorder_level = input.reorderLevel;
    if (input.barcode !== undefined) patch.barcode = input.barcode?.trim() ? input.barcode.trim() : null;
    if (input.barcodeType !== undefined && input.barcodeType) patch.barcode_type = input.barcodeType;

    // Mirror the re-order / barcode config onto the products shadow row (if it already
    // exists) so product_low_stock_v — which keys on `products` — sees the threshold
    // even before the next stock receive.
    const shadowKeys = ["min_stock_level", "reorder_level", "barcode", "barcode_type"].filter((k) => k in patch);
    if (shadowKeys.length) {
      const shadowPatch: Record<string, unknown> = {};
      for (const k of shadowKeys) shadowPatch[k] = (patch as any)[k];
      await withLocalPg(async (sql) => {
        await sql`UPDATE public.products SET ${sql(shadowPatch)} WHERE id = ${id}::uuid`;
        return true;
      });
    }

    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });

    if (!viaPg) {
      const supabase = createSupabaseAdminClient() as any;
      const { error } = await supabase.from("goods").update(patch).eq("id", id).is("deleted_at", null);
      if (error) throw new Error(error.message);
    }
    // Translation write stays goods-service.ts's responsibility — see create() above.
  }

  async softDelete(id: string) {
    const nowStr = new Date().toISOString();
    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods SET deleted_at = ${nowStr}, updated_at = ${nowStr} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      await sql`UPDATE public.goods_variations SET deleted_at = ${nowStr}, updated_at = ${nowStr} WHERE goods_id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase.from("goods").update({ deleted_at: nowStr, updated_at: nowStr }).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
    const { error: childError } = await supabase.from("goods_variations").update({ deleted_at: nowStr, updated_at: nowStr }).eq("goods_id", id).is("deleted_at", null);
    if (childError) throw new Error(childError.message);
  }

  // --- Variation CRUD ---

  async createVariation(input: { goodsId: string; size: string; brand: string; variety?: string | null; extraDetails?: string | null; createdBy?: string | null }) {
    const cleanSize = input.size.trim().toUpperCase();
    const cleanBrand = input.brand.trim().toUpperCase();
    const cleanVariety = input.variety?.trim() || null;
    const cleanExtraDetails = input.extraDetails?.trim() || null;

    const viaPg = await withLocalPg(async (sql) => {
      const existing = await sql`
        SELECT id FROM public.goods_variations
        WHERE goods_id = ${input.goodsId}::uuid
          AND upper(size) = ${cleanSize}
          AND upper(brand) = ${cleanBrand}
          AND (${cleanVariety}::text IS NULL OR upper(variety) = upper(${cleanVariety}))
          AND deleted_at IS NULL
      `;
      if (existing.length > 0) {
        throw new Error("A variation with this combination of Size, Brand, and Variety already exists.");
      }
      const rows = await sql`
        INSERT INTO public.goods_variations (goods_id, size, brand, variety, extra_details, is_active, created_by)
        VALUES (${input.goodsId}::uuid, ${cleanSize}, ${cleanBrand}, ${cleanVariety}, ${cleanExtraDetails}, true, ${input.createdBy || null})
        RETURNING id
      `;
      return (rows[0] as any).id as string;
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    const { data: existing, error: checkError } = await supabase
      .from("goods_variations")
      .select("id")
      .eq("goods_id", input.goodsId)
      .ilike("size", cleanSize)
      .ilike("brand", cleanBrand)
      .is("deleted_at", null);
    if (checkError) throw new Error(checkError.message);
    if (Array.isArray(existing) && existing.length > 0) {
      throw new Error("A variation with this combination of Size and Brand already exists.");
    }

    const { data, error } = await supabase
      .from("goods_variations")
      .insert({ goods_id: input.goodsId, size: cleanSize, brand: cleanBrand, variety: cleanVariety, extra_details: cleanExtraDetails, is_active: true, created_by: input.createdBy || null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async updateVariation(id: string, input: { goodsId?: string; size?: string; brand?: string; variety?: string | null; extraDetails?: string | null; isActive?: boolean }) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const cleanSize = input.size !== undefined ? input.size.trim().toUpperCase() : undefined;
    const cleanBrand = input.brand !== undefined ? input.brand.trim().toUpperCase() : undefined;
    const cleanVariety = input.variety !== undefined ? input.variety?.trim() || null : undefined;
    const cleanExtraDetails = input.extraDetails !== undefined ? input.extraDetails?.trim() || null : undefined;

    if (cleanSize !== undefined) patch.size = cleanSize;
    if (cleanBrand !== undefined) patch.brand = cleanBrand;
    if (cleanVariety !== undefined) patch.variety = cleanVariety;
    if (cleanExtraDetails !== undefined) patch.extra_details = cleanExtraDetails;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods_variations SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase.from("goods_variations").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDeleteVariation(id: string) {
    const nowStr = new Date().toISOString();
    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.goods_variations SET deleted_at = ${nowStr}, updated_at = ${nowStr} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase.from("goods_variations").update({ deleted_at: nowStr, updated_at: nowStr }).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const goodsRepository = new GoodsRepository();
