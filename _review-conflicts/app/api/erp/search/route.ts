/**
 * Global Search API Endpoint
 *
 * GET /api/erp/search?q=...&modules=...&limit=...
 *
 * Searches across all ERP modules with session-based scope filtering.
 * Supports filtering by module types and result limits.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { globalSearch, MODULE_MAP } from "@/lib/search/global-search-service";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  modules: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const query = searchQuerySchema.parse({
      q: searchParams.get("q") || "",
      modules: searchParams.get("modules") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const modules = query.modules
      ? query.modules.split(",").filter((m) => m in MODULE_MAP)
      : undefined;

    const result = await globalSearch(session, query.q, {
      modules,
      limit: query.limit,
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
