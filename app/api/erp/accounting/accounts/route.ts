import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { enterpriseAccountCreateSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getSupabasePublicKey, getSupabaseSecretKey } from "@/lib/supabase/config";

function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function normalizeCodePart(value: string | null | undefined, fallback: string) {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return fallback;
  return raw.replace(/[^A-Z0-9]/g, "").slice(0, 6) || fallback;
}

function cityShortCode(value: string | null | undefined, fallback: string) {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return fallback;
  if (raw.includes("CHAMAN")) return "CHM";
  if (raw.includes("QUETTA")) return "QTA";
  const words = raw.split(/[\s_-]+/g).filter(Boolean);
  if (words.length >= 2) return words.map((word) => word[0]).join("").slice(0, 3);
  return raw.replace(/[^A-Z0-9]/g, "").slice(0, 3) || fallback;
}

function sequencePrefix(value: string | null | undefined, fallback: string, length = 6) {
  return normalizeCodePart(value, fallback).slice(0, length) || fallback;
}

function isMissingPrivilegedSupabaseKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("SUPABASE_SECRET_KEY") || message.includes("SUPABASE_SERVICE_ROLE_KEY");
}

function hasRealServiceRoleKey() {
  const secretKey = getSupabaseSecretKey();
  return Boolean(secretKey && !/^sb_(publishable|anon)_/i.test(secretKey) && secretKey !== getSupabasePublicKey());
}

async function buildAccountListViaLocalPg(
  session: Awaited<ReturnType<typeof requireErpSession>>,
  scope: ReturnType<typeof getScopeFromSearchParams>,
  limit: number
) {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql`
      select
        ea.id,
        ea.code,
        ea.name,
        ea.kind,
        ea.currency,
        ea.status,
        ea.scope,
        ea.country_id,
        ea.country_branch_id,
        ea.city_branch_id,
        ea.branch_code,
        ea.manual_reference_number,
        ea.account_number,
        ea.created_at
      from public.enterprise_accounts ea
      where ea.deleted_at is null
        and (
          ${session.isSuperAdmin}
          or ea.country_id = any(${session.countryIds ?? []}::uuid[])
          or ea.country_branch_id = any(${session.countryBranchIds ?? []}::uuid[])
          or ea.city_branch_id = any(${session.cityBranchIds ?? []}::uuid[])
        )
        ${scope.countryId ? sql`and (ea.country_id = ${scope.countryId}::uuid or ea.country_id is null)` : sql``}
        ${scope.countryBranchId ? sql`and (ea.country_branch_id = ${scope.countryBranchId}::uuid or ea.country_branch_id is null)` : sql``}
        ${scope.cityBranchId ? sql`and (ea.city_branch_id = ${scope.cityBranchId}::uuid or ea.city_branch_id is null)` : sql``}
      order by ea.code asc, ea.created_at desc
      limit ${limit}
    `;

    return {
      accounts: (rows as Array<{
        id: string;
        code: string;
        name: string;
        kind: string | null;
        currency: string | null;
        status: string | null;
      }>).map((row) => ({
        ...row,
        is_active: String(row.status ?? "").toLowerCase() === "active"
      })),
      limit
    };
  });

  if (!viaPg) {
    throw new Error("DATABASE_URL is not configured for local account list fallback.");
  }
  return viaPg;
}

function countrySerialPrefix(country: { name?: string | null; iso2?: string | null } | null | undefined) {
  const name = country?.name ?? "";
  const normalizedName = normalizeCodePart(name, "");
  if (name.toLowerCase().includes("united arab emirates")) return "UAE";
  if (name.toLowerCase().includes("afghanistan")) return "AFG";
  if (normalizedName.length >= 3) return normalizedName.slice(0, 3);
  return normalizeCodePart(country?.iso2 ?? null, "CT").slice(0, 3) || "CT";
}

async function nextEnterpriseAccountCode(
  supabase: Awaited<ReturnType<typeof createApiSupabaseClient>>,
  input: {
    scope: string;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
  }
) {
  let prefix = "SA-AC";

  if (input.scope !== "super_admin" && input.countryId) {
    const { data: country, error: countryError } = await supabase
      .from("countries")
      .select("name, iso2")
      .eq("id", input.countryId)
      .maybeSingle();
    if (countryError) throw new Error(countryError.message);

    const countryPrefix =
      (country as any)?.name?.toLowerCase?.().includes("united arab emirates")
        ? "UAE"
        : normalizeCodePart((country as any)?.iso2 ?? null, "CT");

    prefix = `${countryPrefix}-AC`;

    if ((input.scope === "main_branch" || input.scope === "city_branch") && input.cityBranchId) {
      const { data: cityBranch, error: cityError } = await supabase
        .from("city_branches")
        .select("city_name, code")
        .eq("id", input.cityBranchId)
        .maybeSingle();
      if (cityError) throw new Error(cityError.message);

      const cityPrefix =
        cityShortCode((cityBranch as any)?.city_name ?? null, "") ||
        normalizeCodePart((cityBranch as any)?.code ?? null, "BR").slice(0, 3);
      prefix = `${countryPrefix}-${cityPrefix}-AC`;
    }
  }

  const { data: existing, error } = await (supabase as any)
    .from("enterprise_accounts")
    .select("code")
    .ilike("code", `${prefix}-%`)
    .order("code", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);

  const latest = Array.isArray(existing) ? (existing[0] as any)?.code as string | undefined : undefined;
  const latestNo = latest ? Number(latest.split("-").pop()) : 0;
  const next = Number.isFinite(latestNo) ? latestNo + 1 : 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

async function resolveBranchCode(
  supabase: Awaited<ReturnType<typeof createApiSupabaseClient>>,
  input: {
    scope: string;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
  }
) {
  if (input.scope === "super_admin") return "SUPER";

  if (input.scope === "city_branch" && input.cityBranchId) {
    const { data, error } = await supabase
      .from("city_branches")
      .select("code, city_name")
      .eq("id", input.cityBranchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizeCodePart((data as any)?.code ?? (data as any)?.city_name ?? null, "CITY");
  }

  if ((input.scope === "main_branch" || input.scope === "country") && input.countryBranchId) {
    const { data, error } = await supabase
      .from("country_branches")
      .select("code, name")
      .eq("id", input.countryBranchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizeCodePart((data as any)?.code ?? (data as any)?.name ?? null, "MAIN");
  }

  if (input.countryId) {
    const { data, error } = await supabase
      .from("countries")
      .select("iso2, name")
      .eq("id", input.countryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizeCodePart((data as any)?.iso2 ?? (data as any)?.name ?? null, "CT");
  }

  return "BRANCH";
}

async function nextAccountIdentity(
  supabase: Awaited<ReturnType<typeof createApiSupabaseClient>>,
  input: {
    scope: string;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    accountCode: string;
    manualReferenceNumber?: string | null;
  }
) {
  const branchCode = await resolveBranchCode(supabase, input);
  let countryPrefix = "SA";
  let branchPrefix = branchCode;

  if (input.scope !== "super_admin" && input.countryId) {
    const { data: country, error: countryError } = await supabase
      .from("countries")
      .select("name, iso2")
      .eq("id", input.countryId)
      .maybeSingle();
    if (countryError) throw new Error(countryError.message);

    countryPrefix = countrySerialPrefix(country as any);
  }

  if (input.scope === "city_branch" && input.cityBranchId) {
    const { data: cityBranch, error: cityBranchError } = await supabase
      .from("city_branches")
      .select("code, name, city_name")
      .eq("id", input.cityBranchId)
      .maybeSingle();
    if (cityBranchError) throw new Error(cityBranchError.message);
    branchPrefix = cityShortCode((cityBranch as any)?.city_name ?? (cityBranch as any)?.name ?? (cityBranch as any)?.code ?? null, "CITY");
  } else if ((input.scope === "main_branch" || input.scope === "country") && input.countryBranchId) {
    const { data: countryBranch, error: branchError } = await supabase
      .from("country_branches")
      .select("code, name")
      .eq("id", input.countryBranchId)
      .maybeSingle();
    if (branchError) throw new Error(branchError.message);
    branchPrefix = "MAIN";
  }

  const { count: totalCount, error: totalError } = await (supabase as any)
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true });
  if (totalError) throw new Error(totalError.message);

  let countryQuery = (supabase as any)
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("manual_reference_number", "is", null);
  if (input.countryId) countryQuery = countryQuery.eq("country_id", input.countryId);
  else countryQuery = countryQuery.is("country_id", null);

  const { count: countryCount, error: countryCountError } = await countryQuery;
  if (countryCountError) throw new Error(countryCountError.message);

  let branchQuery = (supabase as any)
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true })
    .eq("scope", input.scope)
    .is("deleted_at", null)
    .not("manual_reference_number", "is", null);

  if (input.countryId) branchQuery = branchQuery.eq("country_id", input.countryId);
  else branchQuery = branchQuery.is("country_id", null);

  if (input.countryBranchId) branchQuery = branchQuery.eq("country_branch_id", input.countryBranchId);
  else branchQuery = branchQuery.is("country_branch_id", null);

  if (input.cityBranchId) branchQuery = branchQuery.eq("city_branch_id", input.cityBranchId);
  else branchQuery = branchQuery.is("city_branch_id", null);

  const { count: branchCount, error: branchError } = await branchQuery;
  if (branchError) throw new Error(branchError.message);

  const accountSerialNumber = Number(totalCount ?? 0) + 1;
  const branchAccountSequence = Number(branchCount ?? 0) + 1;

  return {
    accountNumber: input.accountCode,
    customerNumber: `CUST-${input.accountCode}`,
    accountSerialNumber,
    countrySerialNumber: `${countryPrefix}-${String(Number(countryCount ?? 0) + 1).padStart(6, "0")}`,
    branchSerialNumber: `${countryPrefix}-${branchPrefix}-${String(branchAccountSequence).padStart(6, "0")}`,
    branchCode,
    branchAccountSequence
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 500);
    const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 500, 1000));

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      ...scope
    });

    if (!hasRealServiceRoleKey()) {
      return apiOk(await buildAccountListViaLocalPg(session, scope, limit));
    }

    let supabase = await createApiSupabaseClient();
    let query: any = supabase
      .from("enterprise_accounts")
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, created_at, updated_at, customers:customer_id(id, customer_name, mobile, whatsapp)"
      )
      .is("deleted_at", null)
      .order("code", { ascending: true });

    if (!session.isSuperAdmin) {
      const conditions: string[] = ["country_id.is.null", "scope.eq.super_admin"];
      if (session.cityBranchIds && session.cityBranchIds.length > 0) {
        conditions.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
      }
      if (session.countryBranchIds && session.countryBranchIds.length > 0) {
        conditions.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
      }
      if (session.countryIds && session.countryIds.length > 0) {
        conditions.push(`country_id.in.(${session.countryIds.join(",")})`);
      }

      query = query.or(conditions.join(","));
    }

    if (scope.countryId) {
      query = query.or(`country_id.eq.${scope.countryId},country_id.is.null`);
    }
    if (scope.countryBranchId) {
      query = query.or(`country_branch_id.eq.${scope.countryBranchId},country_branch_id.is.null`);
    }
    if (scope.cityBranchId) {
      query = query.or(`city_branch_id.eq.${scope.cityBranchId},city_branch_id.is.null`);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    if ((!data || data.length === 0) && !hasRealServiceRoleKey()) {
      return apiOk(await buildAccountListViaLocalPg(session, scope, limit));
    }

    return apiOk({
      accounts: data ?? [],
      limit
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = enterpriseAccountCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "accounts",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const issuedCode =
      body.code.trim().toUpperCase() === "AUTO"
        ? await nextEnterpriseAccountCode(supabase, {
            scope: body.scope,
            countryId: body.countryId,
            countryBranchId: body.countryBranchId,
            cityBranchId: body.cityBranchId
          })
        : body.code.trim().toUpperCase();

    const identity = await nextAccountIdentity(supabase, {
      scope: body.scope,
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId,
      accountCode: issuedCode,
      manualReferenceNumber: body.manualReferenceNumber?.trim() || null
    });
    const actorId = isUuid(session.userId) ? session.userId : null;
    
    if (!actorId) {
      throw new Error("A valid logged-in user ID is required to create an account.");
    }

    const localPgResult = await withLocalPg(async (sql) => {
      return await sql.begin(async (tx) => {
        await tx`
          select set_config(
            'request.jwt.claims',
            ${JSON.stringify({ sub: session.userId, role: "authenticated" })},
            true
          );
        `;

        const profileRows = await tx`
          select id
          from profiles
          where id = ${actorId}::uuid
          limit 1
          for update;
        `;
        if ((profileRows?.length ?? 0) === 0) {
          await tx`
            insert into profiles (id, full_name, user_code)
            values (
              ${actorId}::uuid,
              ${session.fullName || session.email || "Bootstrapped User"},
              ${"BOOTSTRAP-" + actorId.slice(0, 4).toUpperCase()}
            )
            on conflict (id) do nothing;
          `;
        }

        const requestedCode = body.code.trim().toUpperCase();
        let issuedCode = requestedCode === "AUTO" ? "SA-AC" : requestedCode;

        if (requestedCode === "AUTO") {
          let prefix = "SA-AC";
          if (body.scope !== "super_admin" && body.countryId) {
            const countryRows = await tx`
              select name, iso2
              from countries
              where id = ${body.countryId}::uuid
              limit 1;
            `;
            const country = (countryRows[0] as any) ?? {};
            const countryName = String(country?.name ?? "");
            const normalizedIso = normalizeCodePart(country?.iso2 ?? null, "CT");
            const countryPrefix =
              countryName.toLowerCase().includes("united arab emirates")
                ? "UAE"
                : normalizedIso;

            prefix = `${countryPrefix}-AC`;

            if ((body.scope === "main_branch" || body.scope === "city_branch") && body.cityBranchId) {
              const cityBranchRows = await tx`
                select city_name, code
                from city_branches
                where id = ${body.cityBranchId}::uuid
                limit 1;
              `;
              const cityBranch = (cityBranchRows[0] as any) ?? {};
              const cityPrefix =
                cityShortCode(cityBranch?.city_name ?? null, "") ||
                normalizeCodePart(cityBranch?.code ?? null, "BR").slice(0, 3);
              prefix = `${countryPrefix}-${cityPrefix}-AC`;
            }
          }

          const existingRows = await tx`
            select code
            from enterprise_accounts
            where code ilike ${`${prefix}-%`}
            order by code desc
            limit 1;
          `;
          const latest = String((existingRows[0] as any)?.code ?? "");
          const latestNo = latest ? Number(latest.split("-").pop()) : 0;
          const nextNo = Number.isFinite(latestNo) ? latestNo + 1 : 1;
          issuedCode = `${prefix}-${String(nextNo).padStart(4, "0")}`;
        }

        const branchCode = (() => {
          if (body.scope === "super_admin") return "SUPER";
          return "BRANCH";
        })();

        let countryPrefix = "SA";
        let branchPrefix = branchCode;

        if (body.scope !== "super_admin" && body.countryId) {
          const countryRows = await tx`
            select name, iso2
            from countries
            where id = ${body.countryId}::uuid
            limit 1;
          `;
          const country = (countryRows[0] as any) ?? {};
          countryPrefix = countrySerialPrefix(country);
        }

        if (body.scope === "city_branch" && body.cityBranchId) {
          const cityBranchRows = await tx`
            select code, name, city_name
            from city_branches
            where id = ${body.cityBranchId}::uuid
            limit 1;
          `;
          const cityBranch = (cityBranchRows[0] as any) ?? {};
          branchPrefix = cityShortCode(cityBranch?.city_name ?? cityBranch?.name ?? cityBranch?.code ?? null, "CITY");
        } else if ((body.scope === "main_branch" || body.scope === "country") && body.countryBranchId) {
          const branchRows = await tx`
            select code, name
            from country_branches
            where id = ${body.countryBranchId}::uuid
            limit 1;
          `;
          const countryBranch = (branchRows[0] as any) ?? {};
          branchPrefix = normalizeCodePart(countryBranch?.code ?? countryBranch?.name ?? null, "MAIN");
        }

        const totalCountRows = await tx`
          select count(*)::int as count
          from enterprise_accounts;
        `;
        const countryCountRows = await tx`
          select count(*)::int as count
          from enterprise_accounts
          where deleted_at is null
            and manual_reference_number is not null
            and ${body.countryId ?? null}::uuid is not distinct from country_id;
        `;
        const branchCountRows = await tx`
          select count(*)::int as count
          from enterprise_accounts
          where scope = ${body.scope}
            and deleted_at is null
            and manual_reference_number is not null
            and ${body.countryId ?? null}::uuid is not distinct from country_id
            and ${body.countryBranchId ?? null}::uuid is not distinct from country_branch_id
            and ${body.cityBranchId ?? null}::uuid is not distinct from city_branch_id;
        `;

        const accountSerialNumber = Number((totalCountRows[0] as any)?.count ?? 0) + 1;
        const countrySerialNumber = `${countryPrefix}-${String(Number((countryCountRows[0] as any)?.count ?? 0) + 1).padStart(6, "0")}`;
        const branchSequence = Number((branchCountRows[0] as any)?.count ?? 0) + 1;
        const branchSerialNumber = `${countryPrefix}-${branchPrefix}-${String(branchSequence).padStart(6, "0")}`;
        const customerNumber = `CUST-${issuedCode}`;
        const manualReferenceNumber = body.manualReferenceNumber?.trim() || null;
        const nowIso = new Date().toISOString();

        const accountRows = await tx`
          insert into enterprise_accounts ${tx({
            scope: body.scope,
            country_id: body.countryId ?? null,
            country_branch_id: body.countryBranchId ?? null,
            city_branch_id: body.cityBranchId ?? null,
            parent_id: body.parentId ?? null,
            customer_id: body.customerId ?? null,
            company_id: body.companyId ?? null,
            bank_id: body.bankId ?? null,
            code: issuedCode,
            account_number: issuedCode,
            customer_number: customerNumber,
            account_serial_number: accountSerialNumber,
            country_serial_number: countrySerialNumber,
            branch_serial_number: branchSerialNumber,
            manual_reference_number: manualReferenceNumber,
            creation_date: nowIso,
            branch_code: branchCode,
            branch_account_sequence: branchSequence,
            name: body.name,
            kind: body.kind,
            currency: body.currency.toUpperCase(),
            opening_balance: body.openingBalance,
            current_balance: body.openingBalance,
            status: body.status || "active",
            is_control_account: body.isControlAccount,
            contacts: body.contacts,
            created_by: actorId
          })}
          returning id;
        `;

        const accountId = (accountRows[0] as any)?.id as string;
        if (!accountId) {
          throw new Error("Account creation did not return a record ID.");
        }

        const creditNormal = body.kind === "liability" || body.kind === "equity" || body.kind === "income";
        let parentLedgerId: string | null = null;

        if (body.parentId) {
          const parentLedgerRows = await tx`
            select id
            from ledgers
            where enterprise_account_id = ${body.parentId}::uuid
              and deleted_at is null
            limit 1;
          `;
          parentLedgerId = (parentLedgerRows[0] as any)?.id ?? null;
        }

        const ledgerRows = await tx`
          insert into ledgers ${tx({
            scope: body.scope,
            country_id: body.countryId ?? null,
            country_branch_id: body.countryBranchId ?? null,
            city_branch_id: body.cityBranchId ?? null,
            enterprise_account_id: accountId,
            parent_ledger_id: parentLedgerId,
            code: issuedCode,
            name: body.name,
            currency: body.currency.toUpperCase(),
            opening_balance: body.openingBalance,
            current_balance: body.openingBalance,
            debit_total: 0,
            credit_total: 0,
            normal_balance: creditNormal ? "credit" : "debit",
            is_active: true,
            created_by: actorId
          })}
          returning id;
        `;

        const ledgerId = (ledgerRows[0] as any)?.id as string;
        if (!ledgerId) {
          throw new Error("Ledger creation did not return a record ID.");
        }

        await tx`
          insert into enterprise_account_history ${tx({
            enterprise_account_id: accountId,
            account_number: issuedCode,
            event_type: "created",
            created_by: actorId,
            debit_total: 0,
            credit_total: 0,
            current_balance: body.openingBalance,
            details: {
              customerNumber,
              accountSerialNumber,
              countrySerialNumber,
              branchSerialNumber,
              manualReferenceNumber,
              branchCode,
              branchAccountSequence: branchSequence,
              linkedLedgerId: ledgerId,
              sessionUser: {
                id: session.userId,
                email: session.email,
                fullName: session.fullName
              }
            }
          })}
        `;

        return {
          accountId,
          ledgerId,
          accountCode: issuedCode,
          accountNumber: issuedCode,
          customerNumber,
          accountSerialNumber,
          countrySerialNumber,
          branchSerialNumber,
          manualReferenceNumber,
          branchCode,
          branchAccountSequence: branchSequence
        };
      });
    });

    if (localPgResult) {
      // Register the new account + ledger names in record_translations so they enter the
      // translation review pipeline. Uses the HONEST verified writer (no machine-guessed
      // spellings): it records the original text and only stores approved/dictionary
      // translations, leaving proper-name languages null until a human approves them.
      // Previously this direct-Postgres path returned here WITHOUT saving any translation,
      // so accounts created on VPS/local-PG never got a name translation row at all.
      const actorLanguage = (session.preferredLanguage || "en") as "en" | "ar" | "ur" | "fa" | "ps";
      import("@/lib/services/enterprise-multilingual-service")
        .then(({ saveEnterpriseRecordTranslations }) => {
          return Promise.all([
            saveEnterpriseRecordTranslations({
              recordTable: "enterprise_accounts",
              recordId: localPgResult.accountId,
              originalLanguage: actorLanguage,
              fields: [{ fieldName: "name", value: body.name }],
              actorId,
              source: "auto"
            }),
            saveEnterpriseRecordTranslations({
              recordTable: "ledgers",
              recordId: localPgResult.ledgerId,
              originalLanguage: actorLanguage,
              fields: [{ fieldName: "name", value: body.name }],
              actorId,
              source: "auto"
            })
          ]);
        })
        .catch((err) => console.error("Failed to register new account name translations (local-pg path):", err));
      return apiCreated(localPgResult);
    }

    // Verify the actorId exists in the profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", actorId)
      .maybeSingle();

    if (profileError || !userProfile) {
      // Auto-create a default profile row for this actorId using the admin client
      const admin = createSupabaseAdminClient() as any;
      const { error: insertError } = await admin
        .from("profiles")
        .insert({
          id: actorId,
          full_name: session.fullName || session.email || "Bootstrapped User",
          user_code: "BOOTSTRAP-" + actorId.slice(0, 4).toUpperCase()
        });
      if (insertError) {
        throw new Error(
          `The user ID does not exist in the referenced users table and could not be auto-created: ${insertError.message}`
        );
      }
    }

    const manualReferenceNumber = body.manualReferenceNumber?.trim() || null;

    const { data: createdAccount, error } = await (supabase as any)
      .from("enterprise_accounts")
      .insert({
        scope: body.scope,
        country_id: body.countryId ?? null,
        country_branch_id: body.countryBranchId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        parent_id: body.parentId ?? null,
        customer_id: body.customerId ?? null,
        company_id: body.companyId ?? null,
        bank_id: body.bankId ?? null,
        code: issuedCode,
        account_number: identity.accountNumber,
        customer_number: identity.customerNumber,
        account_serial_number: identity.accountSerialNumber,
        country_serial_number: identity.countrySerialNumber,
        branch_serial_number: identity.branchSerialNumber,
        manual_reference_number: manualReferenceNumber,
        creation_date: new Date().toISOString(),
        branch_code: identity.branchCode,
        branch_account_sequence: identity.branchAccountSequence,
        name: body.name,
        kind: body.kind,
        currency: body.currency.toUpperCase(),
        opening_balance: body.openingBalance,
        current_balance: body.openingBalance,
        status: body.status || "active",
        is_control_account: body.isControlAccount,
        contacts: body.contacts,
        created_by: actorId
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const accountId = (createdAccount as { id: string }).id;

    // ERP rule: every account should have a ledger.
    // We auto-create a ledger record bound to this enterprise account.
    const creditNormal = body.kind === "liability" || body.kind === "equity" || body.kind === "income";

    let parentLedgerId: string | null = null;
    if (body.parentId) {
      const { data: parentLedger, error: parentLedgerError } = await supabase
        .from("ledgers")
        .select("id")
        .eq("enterprise_account_id", body.parentId)
        .is("deleted_at", null)
        .maybeSingle();
      if (parentLedgerError) {
        throw new Error(parentLedgerError.message);
      }
      parentLedgerId = (parentLedger as any)?.id ?? null;
    }

    const { data: createdLedger, error: ledgerError } = await (supabase as any)
      .from("ledgers")
      .insert({
        scope: body.scope,
        country_id: body.countryId ?? null,
        country_branch_id: body.countryBranchId ?? null,
        city_branch_id: body.cityBranchId ?? null,
        enterprise_account_id: accountId,
        parent_ledger_id: parentLedgerId,
        code: issuedCode,
        name: body.name,
        currency: body.currency.toUpperCase(),
        opening_balance: body.openingBalance,
        current_balance: body.openingBalance,
        debit_total: 0,
        credit_total: 0,
        normal_balance: creditNormal ? "credit" : "debit",
        is_active: true,
        created_by: actorId
      })
      .select("id")
      .single();

    if (ledgerError) {
      throw new Error(ledgerError.message);
    }

    const ledgerId = (createdLedger as { id: string }).id;

    await supabase.from("enterprise_account_history").insert({
      enterprise_account_id: accountId,
      account_number: identity.accountNumber,
      event_type: "created",
      created_by: actorId,
      debit_total: 0,
      credit_total: 0,
      current_balance: body.openingBalance,
      details: {
        customerNumber: identity.customerNumber,
        accountSerialNumber: identity.accountSerialNumber,
        countrySerialNumber: identity.countrySerialNumber,
        branchSerialNumber: identity.branchSerialNumber,
        manualReferenceNumber,
        branchCode: identity.branchCode,
        branchAccountSequence: identity.branchAccountSequence,
        linkedLedgerId: ledgerId,
        sessionUser: {
          id: session.userId,
          email: session.email,
          fullName: session.fullName
        }
      }
    });

    const actorLanguage = (session.preferredLanguage || "en") as "en" | "ar" | "ur" | "fa" | "ps";
    import("@/lib/services/enterprise-multilingual-service")
      .then(({ saveEnterpriseRecordTranslations }) => {
        return Promise.all([
          saveEnterpriseRecordTranslations({
            recordTable: "enterprise_accounts",
            recordId: accountId,
            originalLanguage: actorLanguage,
            fields: [{ fieldName: "name", value: body.name }],
            actorId,
            source: "auto"
          }),
          saveEnterpriseRecordTranslations({
            recordTable: "ledgers",
            recordId: ledgerId,
            originalLanguage: actorLanguage,
            fields: [{ fieldName: "name", value: body.name }],
            actorId,
            source: "auto"
          })
        ]);
      })
      .catch((err) => console.error("Failed to register new account name translations:", err));

    return apiCreated({
      accountId,
      ledgerId,
      accountCode: issuedCode,
      accountNumber: identity.accountNumber,
      customerNumber: identity.customerNumber,
      accountSerialNumber: identity.accountSerialNumber,
      countrySerialNumber: identity.countrySerialNumber,
      branchSerialNumber: identity.branchSerialNumber,
      manualReferenceNumber,
      branchCode: identity.branchCode,
      branchAccountSequence: identity.branchAccountSequence
    });
  } catch (error) {
    return handleApiError(error);
  }
}
