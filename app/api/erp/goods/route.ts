import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { goodsCreateSchema } from "@/lib/api/erp-validation";
import { goodsService } from "@/lib/services/goods-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, {
      resource: "goods",
      action: "read"
    });

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    const result = await goodsService.search({
      query,
      limit: limit ? Number(limit) : 50
    });

    // Always resolve — see customers/[id]/route.ts for why skipping lang === "en" would leak
    // non-English source text into the English view.
    let goods: any[] = (result as any).goods ?? [];
    if (Array.isArray(goods) && goods.length > 0) {
      goods = await localizeRecordNames<any>(goods, "goods", "goods_name", lang);
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
