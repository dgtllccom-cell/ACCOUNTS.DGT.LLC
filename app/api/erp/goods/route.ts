import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { goodsCreateSchema } from "@/lib/api/erp-validation";
import { goodsService } from "@/lib/services/goods-service";
import { localizeRecordNames, localizeRecordFields } from "@/lib/i18n/localize-records";
import { getRequestLanguage } from "@/lib/i18n/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, {
      resource: "goods",
      action: "read"
    });

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    // Prefer an explicit ?lang= / ?language=, else the erp_lang cookie — NEVER a bare "en"
    // default, which is what left goods dropdowns in English when a caller forgot the param.
    const lang = await getRequestLanguage(
      request.nextUrl.searchParams.get("lang") || request.nextUrl.searchParams.get("language"),
    );

    const result = await goodsService.search({
      query,
      limit: limit ? Number(limit) : 50
    });

    // Localise DISPLAY text for the active language (so the Goods registry, which
    // renders `goods_name` / variation values directly, follows the language) —
    // while PRESERVING the canonical value under `*_original`, which the Purchase /
    // Sales / Local wizards use as the stable identity to store + match on. Skipping
    // lang === "en" would leak non-English source text into the English view
    // (see customers/[id]/route.ts), so we always resolve.
    let goods: any[] = (result as any).goods ?? [];
    if (Array.isArray(goods) && goods.length > 0) {
      // snapshot canonical values before any mutation
      const orig = goods.map((g: any) => ({
        id: g.id,
        goods_name: g.goods_name,
        variations: (g.variations || []).map((v: any) => ({ id: v.id, size: v.size, brand: v.brand, variety: v.variety })),
      }));
      const origById = new Map(orig.map((g) => [g.id, g]));
      const origVarById = new Map<string, any>();
      for (const g of orig) for (const v of g.variations) origVarById.set(v.id, v);

      goods = await localizeRecordNames<any>(goods, "goods", "goods_name", lang).catch(() => goods);

      const variationRows = goods.flatMap((g: any) =>
        Array.isArray(g.variations) ? g.variations.map((v: any) => ({ id: v.id, size: v.size, brand: v.brand, variety: v.variety })) : [],
      );
      const locVarById = new Map<string, any>();
      if (variationRows.length) {
        const localizedVars = await localizeRecordFields(variationRows, "goods_variations", ["size", "brand", "variety"], lang, { phraseFallback: true }).catch(() => variationRows);
        for (const v of localizedVars as any[]) locVarById.set(v.id, v);
      }

      goods = goods.map((g: any) => ({
        ...g,
        goods_name_original: origById.get(g.id)?.goods_name ?? g.goods_name,
        variations: Array.isArray(g.variations)
          ? g.variations.map((v: any) => {
              const lv = locVarById.get(v.id);
              const ov = origVarById.get(v.id);
              return {
                ...v,
                size: lv?.size ?? v.size,
                brand: lv?.brand ?? v.brand,
                variety: lv?.variety ?? v.variety,
                size_original: ov?.size ?? v.size,
                brand_original: ov?.brand ?? v.brand,
                variety_original: ov?.variety ?? v.variety,
              };
            })
          : g.variations,
      }));
    }

    return apiOk({ ...(result as any), goods });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = goodsCreateSchema.parse(await request.json());

    let authorized = false;
    const scopesToTry = [
      { resource: "goods", action: "create" },
      { resource: "goods_master", action: "create" },
      { resource: "goods_master", action: "update" },
      { resource: "purchases", action: "create" },
      { resource: "purchases", action: "update" }
    ];

    let lastError = null;
    for (const scope of scopesToTry) {
      try {
        authorizeApiScope(session, scope);
        authorized = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!authorized && lastError) {
      throw lastError;
    }

    const goodsId = await goodsService.create(
      {
        chsCode: body.chsCode,
        goodsName: body.goodsName,
        originCountryId: body.originCountryId,
        originalLanguage: body.originalLanguage || "en",
        minStockLevel: body.minStockLevel ?? null,
        reorderLevel: body.reorderLevel ?? null,
        barcode: body.barcode ?? null,
        barcodeType: body.barcodeType ?? null,
        initialVariation: body.initialVariation
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "goods.create.api",
      entityTable: "goods",
      entityId: goodsId,
      after: {
        chsCode: body.chsCode,
        goodsName: body.goodsName
      }
    });

    return apiCreated({ goodsId });
  } catch (error) {
    return handleApiError(error);
  }
}
