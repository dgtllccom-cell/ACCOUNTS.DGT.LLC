import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/api/erp-validation";
import { clearingAgentsRepository } from "@/lib/repositories/clearing-agents-repository";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

async function localizeClearingAgent(clearingAgent: any, lang: ReturnType<typeof normalizeLanguage>) {
  if (!clearingAgent) return clearingAgent;
  const [resolved] = await localizeRecordNames([clearingAgent], "clearing_agents", "name", lang);
  return resolved;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback
    }

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    let clearingAgent = await clearingAgentsRepository.getById(id);
    clearingAgent = await localizeClearingAgent(clearingAgent, lang);
    return apiOk({ clearingAgent });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const body = await request.json();
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    if (body.personId && body.companyId) {
      return apiError("VALIDATION_ERROR", "A clearing agent can be linked to a Person or a Company, not both.", 400);
    }

    await clearingAgentsRepository.update(id, body);
    let clearingAgent = await clearingAgentsRepository.getById(id);
    clearingAgent = await localizeClearingAgent(clearingAgent, lang);
    return apiOk({ clearingAgent });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = uuidSchema.parse(params.id);

    await clearingAgentsRepository.softDelete(id);
    return apiOk({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
