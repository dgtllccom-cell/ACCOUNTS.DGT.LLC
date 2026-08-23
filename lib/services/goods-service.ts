import type { SupportedLanguage } from "@/lib/i18n/languages";
import { goodsRepository } from "@/lib/repositories/goods-repository";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

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
  originalLanguage?: SupportedLanguage;
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

    const current = await goodsRepository.getById(goodsId);
    await writeRecordChangeHistory({
      recordTable: "goods",
      recordId: goodsId,
      action: "create",
      actorId: actorId ?? null,
      countryId: current?.origin_country_id ?? input.originCountryId ?? null,
      beforeData: null,
      afterData: current ?? null
    });

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

    const before = await goodsRepository.getById(id);
    await goodsRepository.update(id, {
      chsCode: input.chsCode,
      goodsName: input.goodsName,
      originCountryId: input.originCountryId,
      isActive: input.isActive
    });
    const after = await goodsRepository.getById(id);

    await writeRecordChangeHistory({
      recordTable: "goods",
      recordId: id,
      action: "update",
      actorId: actorId ?? null,
      countryId: after?.origin_country_id ?? before?.origin_country_id ?? null,
      beforeData: before ?? null,
      afterData: after ?? null
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
    const before = await goodsRepository.getById(id);
    await goodsRepository.softDelete(id);
    await writeRecordChangeHistory({
      recordTable: "goods",
      recordId: id,
      action: "delete",
      beforeData: before ?? null,
      afterData: { deleted_at: new Date().toISOString() },
      countryId: before?.origin_country_id ?? null
    });
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
    await this.upsertVariationTranslations(variationId, input.size, input.brand, actorId ?? null, input.originalLanguage);
    const current = await goodsRepository.getById(input.goodsId);
    const variation = current?.variations?.find((item: any) => item.id === variationId) ?? null;
    await writeRecordChangeHistory({
      recordTable: "goods_variations",
      recordId: variationId,
      action: "create",
      actorId: actorId ?? null,
      countryId: current?.origin_country_id ?? null,
      beforeData: null,
      afterData: variation ?? { goods_id: input.goodsId, size: input.size, brand: input.brand }
    });
    return variationId;
  }

  async updateVariation(
    id: string,
    input: {
      goodsId: string;
      size?: string;
      brand?: string;
      isActive?: boolean;
      originalLanguage?: SupportedLanguage;
    },
    actorId?: string | null
  ) {
    const beforeGoods = await goodsRepository.getById(input.goodsId);
    const before = beforeGoods?.variations?.find((item: any) => item.id === id) ?? null;
    await goodsRepository.updateVariation(id, input);
    const afterGoods = await goodsRepository.getById(input.goodsId);
    const after = afterGoods?.variations?.find((item: any) => item.id === id) ?? null;

    await writeRecordChangeHistory({
      recordTable: "goods_variations",
      recordId: id,
      action: "update",
      actorId: actorId ?? null,
      countryId: afterGoods?.origin_country_id ?? beforeGoods?.origin_country_id ?? null,
      beforeData: before ?? null,
      afterData: after ?? null
    });

    if (input.size || input.brand) {
      await this.upsertVariationTranslations(id, input.size || "", input.brand || "", actorId ?? null, input.originalLanguage);
    }
  }

  async softDeleteVariation(id: string) {
    await goodsRepository.softDeleteVariation(id);
    await writeRecordChangeHistory({
      recordTable: "goods_variations",
      recordId: id,
      action: "delete",
      beforeData: null,
      afterData: { deleted_at: new Date().toISOString() }
    });
  }

  // --- Helper Methods ---

  private async upsertMasterTranslations(goodsId: string, goodsName: string, lang: SupportedLanguage, actorId: string | null) {
    if (!goodsName || !goodsName.trim()) return;
    await translateMasterRecord("goods", goodsId, { goods_name: goodsName }, lang, actorId);
  }

  private async upsertVariationTranslations(variationId: string, size: string, brand: string, actorId: string | null, lang?: SupportedLanguage) {
    // Registry (lib/i18n/translatable-fields.ts) only tracks "brand" for goods_variations —
    // "size" values are unit/measurement strings (e.g. "500g") and are intentionally left
    // untranslated, same as other technical/standard values.
    await translateMasterRecord("goods_variations", variationId, { brand }, lang || "en", actorId);
  }
}

export const goodsService = new GoodsService();
