import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { customerCreateSchema } from "@/lib/api/erp-validation";
import { customersService } from "@/lib/services/customers-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, localizeJoinedNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "customers",
      action: "read",
      ...scope
    });

    const query = request.nextUrl.searchParams.get("q");
    let countryId = request.nextUrl.searchParams.get("countryId");
    const allCountries = request.nextUrl.searchParams.get("allCountries") === "true" || request.nextUrl.searchParams.get("all") === "true";
    const filterByCountry = request.nextUrl.searchParams.get("filterByCountry");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    // Enforce session scope only when not searching globally or reusing across ERP:
    // Person/Customer Master is a global authoritative entity that must be searchable and reusable across countries/branches.
    if (!session.isSuperAdmin && !countryId && !allCountries && filterByCountry !== "false" && !query && session.countryIds.length > 0) {
      countryId = session.countryIds[0];
    }
    if (allCountries || filterByCountry === "false") {
      countryId = null;
    }

    const result = await customersService.search({
      query,
      countryId,
      limit: limit ? Number(limit) : 100
    });


    // Resolve customer_name / company_name into the requested language — without this, any
    // consumer of this endpoint (Person Master picker, generic customer search, etc.) always
    // showed whatever script each record happened to be typed in, mixed record-to-record
    // regardless of the selected UI language (the exact "mixed English/Urdu names in the same
    // dropdown" bug). See lib/services/customers-service.ts for the write side.
    let rawCustomers: any[] = (result as any).customers ?? [];
    let customers: any[] = rawCustomers;
    if (Array.isArray(rawCustomers) && rawCustomers.length > 0) {
      // Localize metadata fields without destructively overwriting registered proper names
      const [ownNames, joined] = await Promise.all([
        localizeRecordFields<any>(rawCustomers, "customers", ["company_name", "contact_person"], lang),
        localizeJoinedNames<any>(rawCustomers, lang, [
          { idField: "country_id", nameField: "country_name", table: "countries" },
          { idField: "state_province_id", nameField: "state_province_name", table: "states_provinces" },
          { idField: "district_id", nameField: "district_name", table: "districts" },
          { idField: "city_id", nameField: "city_name", table: "cities" },
        ]),
      ]);
      const joinedById = new Map(joined.map((r: any) => [r.id, r]));
      const rawById = new Map(rawCustomers.map((r: any) => [r.id, r]));
      customers = ownNames.map((r: any) => {
        const raw = rawById.get(r.id) || r;
        const j = joinedById.get(r.id);
        return {
          ...r,
          // Preserve registered spelling and original language uncorrupted
          customer_name: raw.original_customer_name || raw.customer_name,
          original_customer_name: raw.original_customer_name || raw.customer_name,
          customer_name_en: raw.customer_name_en || (raw.original_language_code === "en" ? raw.customer_name : null),
          native_customer_name: raw.native_customer_name || (raw.original_language_code !== "en" && raw.original_language_code ? raw.customer_name : null),
          linked_companies: raw.linked_companies ?? [],
          companies_count: raw.companies_count ?? (raw.linked_companies?.length ?? 0),
          linked_branches: raw.linked_branches ?? [],
          branches_count: raw.branches_count ?? (raw.linked_branches?.length ?? 0),
          ...(j ? { country_name: j.country_name, state_province_name: j.state_province_name, district_name: j.district_name, city_name: j.city_name } : {})
        };
      });
    }

    return apiOk({ ...(result as any), customers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = customerCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "customers",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const customerId = await customersService.create(
      {
        countryId: body.countryId || session.countryIds?.[0] || "",
        stateProvinceId: body.stateProvinceId ?? null,
        districtId: body.districtId ?? null,
        cityId: body.cityId ?? null,
        areaLocationId: body.areaLocationId ?? null,
        customerName: body.customerName,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        fatherName: body.fatherName ?? null,
        gender: body.gender ?? null,
        photoUrl: body.photoUrl ?? null,
        companyName: body.companyName ?? null,
        contactPerson: body.contactPerson ?? null,
        mobile: body.mobile ?? null,
        whatsapp: body.whatsapp ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
        originalLanguage: body.originalLanguage,
        contacts: body.contacts ?? [],
        registrations: body.registrations ?? []
      },
      session.userId
    );

    await auditApiAction(request, {
      action: "customer.create.api",
      entityTable: "customers",
      entityId: customerId,
      after: {
        countryId: body.countryId,
        customerName: body.customerName,
        companyName: body.companyName ?? null,
        email: body.email ?? null,
        mobile: body.mobile ?? null
      }
    });

    return apiCreated({ customerId });
  } catch (error) {
    return handleApiError(error);
  }
}

