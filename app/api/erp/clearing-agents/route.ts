import { NextRequest } from "next/server";
import { apiCreated, apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { clearingAgentsRepository } from "@/lib/repositories/clearing-agents-repository";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

export async function GET(request: NextRequest) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback, matching companies/route.ts's convention.
    }

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    const result = await clearingAgentsRepository.search({
      query,
      limit: limit ? Number(limit) : 100
    });

    let clearingAgents: any[] = (result as any).clearingAgents ?? [];
    if (Array.isArray(clearingAgents) && clearingAgents.length > 0) {
      clearingAgents = await localizeRecordNames<any>(clearingAgents, "clearing_agents", "name", lang);
    }

    return apiOk({ ...(result as any), clearingAgents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // allow fallback userId if unauthenticated demo
    }

    const body = await request.json();
    if (!body?.name || !String(body.name).trim()) {
      return apiError("VALIDATION_ERROR", "name is required", 400);
    }
    if (body.personId && body.companyId) {
      return apiError("VALIDATION_ERROR", "A clearing agent can be linked to a Person or a Company, not both.", 400);
    }

    const clearingAgentId = await clearingAgentsRepository.create({
      name: body.name,
      personId: body.personId ?? null,
      companyId: body.companyId ?? null,
      headOfficeCountryId: body.headOfficeCountryId ?? null,
      contactPerson: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      status: body.status ?? "active",
      notes: body.notes ?? null,
      originalLanguage: body.originalLanguage || "en"
    });

    await translateMasterRecord(
      "clearing_agents",
      clearingAgentId,
      { name: body.name },
      body.originalLanguage || "en",
      session?.userId ?? null
    );

    return apiCreated({ clearingAgentId });
  } catch (error) {
    return handleApiError(error);
  }
}
