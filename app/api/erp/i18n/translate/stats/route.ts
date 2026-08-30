import { apiOk, apiError } from "@/lib/api/response";
import { getCurrentErpSession } from "@/lib/auth/session";
import { erpTranslationStats } from "@/lib/i18n/erp-translator";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentErpSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication is required", 401);
  try {
    return apiOk(await erpTranslationStats());
  } catch (error) {
    console.error("[i18n/translate/stats]", error instanceof Error ? error.message : error);
    return apiError("STATS_ERROR", "Unavailable", 503);
  }
}
