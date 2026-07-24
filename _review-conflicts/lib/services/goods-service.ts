import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { goodsRepository } from "@/lib/repositories/goods-repository";
import { multilingualService } from "@/lib/services/multilingual-service";

export type GoodsMasterInput = {
  chsCode: string;
  goodsName: string;
  originCountryId?: string | null;
  originalLanguage: SupportedLanguage;
  initialVariation?: {
    size: string;
    brand: string;
  } | null;
};

export type GoodsVariationInput = {
  goodsId: string;
  size: string;
  brand: string;
};

export class GoodsService {
  async search(input: { query?: string | null; limit?: number }) {
    return await goodsRepository.search(input);
  }

  async getById(id: string) {
    const goods = await goodsRepository.getById(id);
    return { goods };
  }

  async create(input: GoodsMasterInput, actorId?: string | null) {
    const exists = await goodsRepository.checkChsCodeExists(input.chsCode);
    if (exists) {
      throw new Error(`CHS Code "${input.chsCode}" is already in use.`);
    }

    const goodsId = await goodsRepository.create({
      chsCode: input.chsCode,
      goodsName: input.goodsName,
      originCountryId: input.originCountryId,
      originalLanguageCode: input.originalLanguage,
      createdBy: actorId
    });

    await this.upsertMasterTranslations(goodsId, input.goodsName, input.originalLanguage, actorId ?? null);

    if (input.initialVariation) {
      await this.createVariation(
        {
          goodsId,
          size: input.initialVariation.size,
          brand: input.initialVariation.brand
        },
        actorId
      );
    }

    return goodsId;
  }

  async update(
    id: string,
    input: {
      chsCode?: string;
      goodsName?: string;
      originCountryId?: string | null;
      isActive?: boolean;
      originalLanguage?: SupportedLanguage;
    },
    actorId?: string | null
  ) {
    if (input.chsCode) {
      const exists = await goodsRepository.checkChsCodeExists(input.chsCode, id);
      if (exists) {
        throw new Error(`CHS Code "${input.chsCode}" is already in use.`);
      }
    }

    await goodsRepository.update(id, {
      chsCode: input.chsCode,
      goodsName: input.goodsName,
      originCountryId: input.originCountryId,
      isActive: input.isActive
    });

    if (input.goodsName) {
      await this.upsertMasterTranslations(
        id,
        input.goodsName,
        input.originalLanguage || "en",
        actorId ?? null
      );
    }
  }

  async softDelete(id: string) {
    await goodsRepository.softDelete(id);
  }

  // --- Variation Service Actions ---

  async createVariation(input: GoodsVariationInput, actorId?: string | null) {
    const variationId = await goodsRepository.createVariation({
      goodsId: input.goodsId,
      size: input.size,
      brand: input.brand,
      createdBy: actorId
    });

    // Translate size and brand if needed
    await this.upsertVariationTranslations(variationId, input.size, input.brand, actorId ?? null);
    return variationId;
  }

  async updateVariation(
    id: string,
    input: {
      goodsId: string;
      size?: string;
      brand?: string;
      isActive?: boolean;
    },
    actorId?: string | null
  ) {
    await goodsRepository.updateVariation(id, input);

    if (input.size || input.brand) {
      await this.upsertVariationTranslations(id, input.size || "", input.brand || "", actorId ?? null);
    }
  }

  async softDeleteVariation(id: string) {
    await goodsRepository.softDeleteVariation(id);
  }

  // --- Helper Methods ---

  private async upsertMasterTranslations(goodsId: string, goodsName: string, lang: SupportedLanguage, actorId: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    
    if (!goodsName || !goodsName.trim()) return;

    const shell = multilingualService.createAutomaticTranslationShell(goodsName, lang);
    const payload = multilingualService.createRecordTranslationPayload({
      recordTable: "goods",
      recordId: goodsId,
      fieldName: "goods_name",
      text: shell
    });

    const row = {
      record_table: payload.recordTable,
      record_id: payload.recordId,
      field_name: payload.fieldName,
      original_text: payload.originalText,
      original_language_code: payload.originalLanguageCode,
      english_text: payload.englishText,
      arabic_text: payload.arabicText,
      urdu_text: payload.urduText,
      persian_text: payload.persianText,
      pashto_text: payload.pashtoText,
      source: "manual",
      corrected_by: actorId,
      corrected_at: actorId ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data: updated, error: updateError } = await supabase
      .from("record_translations")
      .update({
        original_text: row.original_text,
        original_language_code: row.original_language_code,
        english_text: row.english_text,
        arabic_text: row.arabic_text,
        urdu_text: row.urdu_text,
        persian_text: row.persian_text,
        pashto_text: row.pashto_text,
        source: row.source,
        corrected_by: row.corrected_by,
        corrected_at: row.corrected_at,
        updated_at: row.updated_at
      })
      .eq("record_table", row.record_table)
      .eq("record_id", row.record_id)
      .eq("field_name", row.field_name)
      .is("deleted_at", null)
      .select("id");

    if (updateError) throw new Error(updateError.message);
    if (Array.isArray(updated) && updated.length) return;

    const { error: insertError } = await supabase.from("record_translations").insert(row);
    if (insertError) throw new Error(insertError.message);
  }

  private async upsertVariationTranslations(variationId: string, size: string, brand: string, actorId: string | null) {
    const supabase = createSupabaseAdminClient() as any;

    const translatable = [
      ["size", size],
      ["brand", brand]
    ].filter(([, val]) => Boolean(val && val.trim()));

    for (const [fieldName, val] of translatable) {
      const shell = multilingualService.createAutomaticTranslationShell(val, "en");
      const payload = multilingualService.createRecordTranslationPayload({
        recordTable: "goods_variations",
        recordId: variationId,
        fieldName,
        text: shell
      });

      const row = {
        record_table: payload.recordTable,
        record_id: payload.recordId,
        field_name: payload.fieldName,
        original_text: payload.originalText,
        original_language_code: payload.originalLanguageCode,
        english_text: payload.englishText,
        arabic_text: payload.arabicText,
        urdu_text: payload.urduText,
        persian_text: payload.persianText,
        pashto_text: payload.pashtoText,
        source: "manual",
        corrected_by: actorId,
        corrected_at: actorId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      const { data: updated, error: updateError } = await supabase
        .from("record_translations")
        .update({
          original_text: row.original_text,
          original_language_code: row.original_language_code,
          english_text: row.english_text,
          arabic_text: row.arabic_text,
          urdu_text: row.urdu_text,
          persian_text: row.persian_text,
          pashto_text: row.pashto_text,
          source: row.source,
          corrected_by: row.corrected_by,
          corrected_at: row.corrected_at,
          updated_at: row.updated_at
        })
        .eq("record_table", row.record_table)
        .eq("record_id", row.record_id)
        .eq("field_name", row.field_name)
        .is("deleted_at", null)
        .select("id");

      if (updateError) throw new Error(updateError.message);
      if (Array.isArray(updated) && updated.length) continue;

      const { error: insertError } = await supabase.from("record_translations").insert(row);
      if (insertError) throw new Error(insertError.message);
    }
  }
}

export const goodsService = new GoodsService();
