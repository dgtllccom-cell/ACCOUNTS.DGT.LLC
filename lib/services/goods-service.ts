import type { SupportedLanguage } from "@/lib/i18n/languages";
import { goodsRepository } from "@/lib/repositories/goods-repository";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

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
    if (!goodsName || !goodsName.trim()) return;
    await translateMasterRecord("goods", goodsId, { goods_name: goodsName }, lang, actorId);
  }

  private async upsertVariationTranslations(variationId: string, size: string, brand: string, actorId: string | null) {
    // Registry (lib/i18n/translatable-fields.ts) only tracks "brand" for goods_variations —
    // "size" values are unit/measurement strings (e.g. "500g") and are intentionally left
    // untranslated, same as other technical/standard values.
    await translateMasterRecord("goods_variations", variationId, { brand }, "en", actorId);
  }
}

export const goodsService = new GoodsService();
