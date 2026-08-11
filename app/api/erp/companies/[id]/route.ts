import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

// Resolve name/legal_name/owner_name into the requested language — always, regardless of
// which language was requested (see customers/[id]/route.ts for why skipping lang === "en"
// would leak non-English source text into the English view). Without this, the single-record
// GET/PATCH response always showed whatever script the company was originally typed in,
// even though the list endpoint (app/api/erp/companies/route.ts) already resolved it.
async function localizeCompany(company: any, lang: ReturnType<typeof normalizeLanguage>) {
  if (!company) return company;
  let [resolved] = await localizeRecordNames([company], "companies", "name", lang);
  [resolved] = await localizeRecordNames([resolved], "companies", "legal_name", lang);
  [resolved] = await localizeRecordNames([resolved], "companies", "owner_name", lang);
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

    let company = await companiesService.getById(id);
    company = await localizeCompany(company, lang);
    return apiOk({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // Allow fallback
    }

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const body = await request.json();
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    await companiesService.update(id, body, session?.userId ?? null);
    let company = await companiesService.getById(id);
    company = await localizeCompany(company, lang);
    return apiOk({ company });
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

    await companiesService.softDelete(id);
    return apiOk({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
