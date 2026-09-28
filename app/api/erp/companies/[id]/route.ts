import { NextRequest } from "next/server";
import { assertCompanyAccess, assertCompanyTypeRules, findCompanyDuplicates, setCompanyBranchLinks } from "@/lib/services/company-master-service";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession, sessionInDomain } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { uuidSchema, companyUpdateSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames, wantsRawRecord } from "@/lib/i18n/localize-records";

// Resolve name/legal_name/owner_name into the requested language — always, regardless of
// which language was requested (see customers/[id]/route.ts for why skipping lang === "en"
// would leak non-English source text into the English view). Without this, the single-record
// GET/PATCH response always showed whatever script the company was originally typed in,
// even though the list endpoint (app/api/erp/companies/route.ts) already resolved it.
async function localizeCompany(company: any, lang: ReturnType<typeof normalizeLanguage>) {
  if (!company) return company;
  let [resolved] = await localizeRecordNames([company], "companies", "name", lang, { phraseFallback: true });
  [resolved] = await localizeRecordNames([resolved], "companies", "legal_name", lang, { phraseFallback: true });
  [resolved] = await localizeRecordNames([resolved], "companies", "owner_name", lang, { phraseFallback: true });
  [resolved] = await localizeRecordNames([resolved], "companies", "country_name", lang, { phraseFallback: true });
  [resolved] = await localizeRecordNames([resolved], "companies", "state_name", lang, { phraseFallback: true });
  [resolved] = await localizeRecordNames([resolved], "companies", "city_name", lang, { phraseFallback: true });
  return resolved;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    // Object-level scope = list scope: companies are country master data.
    await assertCompanyAccess(session, id);
    let company = await companiesService.getById(id);
    // ?raw=1 → edit form: return the untranslated original (never overwrite source text).
    if (!wantsRawRecord(request)) company = await localizeCompany(company, lang);
    return apiOk({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();

    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    // Validated + whitelisted (the raw body used to be passed straight to update()).
    const body = companyUpdateSchema.parse(await request.json());
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const existing = await assertCompanyAccess(session, id);

    authorizeApiScope(session, {
      resource: "companies",
      action: "update",
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    // Only re-check the domain axis when the caller is actually (re)assigning
    // a branch — leaving it untouched keeps whatever domain the company was
    // already correctly scoped to at creation time.
    if (body.countryBranchId !== undefined || body.cityBranchId !== undefined) {
      const targetDomain = await withLocalPg(async (sql) => {
        if (body.cityBranchId) {
          const rows = (await sql`select operational_domain from public.city_branches where id = ${body.cityBranchId}::uuid`) as unknown as any[];
          if (rows[0]?.operational_domain) return rows[0].operational_domain as "business" | "shipping";
        }
        if (body.countryBranchId) {
          const rows = (await sql`select operational_domain from public.country_branches where id = ${body.countryBranchId}::uuid`) as unknown as any[];
          if (rows[0]?.operational_domain) return rows[0].operational_domain as "business" | "shipping";
        }
        return "business" as const;
      });
      const resolvedDomain = targetDomain ?? "business";
      if (!sessionInDomain(session, resolvedDomain)) {
        throw new ApiClientError(
          `You do not have ${resolvedDomain} domain access to move this company to this branch.`,
          { status: 403, code: "DOMAIN_FORBIDDEN" }
        );
      }
    }

    const current: any = await companiesService.getById(id);
    const merged = {
      companyType: body.companyType !== undefined ? body.companyType : current.company_type ?? current.effective_company_type,
      ownerPersonId: body.ownerPersonId !== undefined ? body.ownerPersonId : current.owner_person_id,
      countryId: body.countryId !== undefined ? body.countryId : existing.country_id,
    };
    assertCompanyTypeRules(merged);
    const identityChanged = ["name", "legalName", "registrationNumber", "taxNumber"].some((k) => (body as any)[k] !== undefined);
    if (identityChanged && !body.acknowledgeDuplicates) {
      const dups = await findCompanyDuplicates(session, {
        name: body.name ?? current.name, legalName: body.legalName ?? current.legal_name,
        registrationNumber: body.registrationNumber ?? current.registration_number, taxNumber: body.taxNumber ?? current.tax_number,
        ownerPersonId: merged.ownerPersonId, countryId: merged.countryId, excludeId: id,
      });
      if (dups.length) throw new ApiClientError("Possible duplicate company", { status: 409, code: "POSSIBLE_DUPLICATE", details: { candidates: dups } });
    }
    const { linkedCountryBranchIds, linkedCityBranchIds, acknowledgeDuplicates: _ack, ...updateInput } = body;
    await companiesService.update(id, updateInput as any, session.userId);
    if (linkedCountryBranchIds !== undefined || linkedCityBranchIds !== undefined) {
      await setCompanyBranchLinks(session, id, { countryBranchIds: linkedCountryBranchIds ?? [], cityBranchIds: linkedCityBranchIds ?? [] });
    }
    let company = await companiesService.getById(id);
    // ?raw=1 → edit form: return the untranslated original (never overwrite source text).
    if (!wantsRawRecord(request)) company = await localizeCompany(company, lang);
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
    const session = await requireErpSession();
    const params = await context.params;
    const id = uuidSchema.parse(params.id);
    // Was completely unguarded: any logged-in user could soft-delete any company.
    authorizeApiScope(session, { resource: "companies", action: "delete" });
    await assertCompanyAccess(session, id);

    await companiesService.softDelete(id, session.userId);
    return apiOk({ success: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
