import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { ledgerScopeSchema, supportedLanguageSchema, uuidSchema } from "@/lib/api/erp-validation";
import { withLocalPg } from "@/lib/db/local-postgres";
import { localizeRecordNames, getPhraseTranslator } from "@/lib/i18n/localize-records";

/**
 * Localize the free-form account NAME of a set of report rows through the single ERP
 * 3-tier resolver (record-specific approved translation → central system_dictionary →
 * honest original). Mutates `accountName` in place. Safe no-op when DATABASE_URL is
 * unset or nothing resolves (keeps the original text).
 */
async function localizeAccountNames<T extends { accountId: string; accountName: string }>(
  rows: T[],
  language: "en" | "ar" | "ur" | "fa" | "ps"
): Promise<T[]> {
  if (!rows.length) return rows;
  const localized = await localizeRecordNames(
    rows.map((row) => ({ id: row.accountId, name: row.accountName })),
    "enterprise_accounts",
    "name",
    language,
    { phraseFallback: true }
  );
  const nameById = new Map(localized.map((row) => [row.id, row.name] as const));
  for (const row of rows) {
    const resolved = nameById.get(row.accountId);
    if (resolved) row.accountName = resolved;
  }
  return rows;
}

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  scope: ledgerScopeSchema.optional(),
  countryId: uuidSchema.optional(),
  countryBranchId: uuidSchema.optional(),
  cityBranchId: uuidSchema.optional(),
  status: z.enum(["all", "active", "archived"]).default("all"),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(1000),
  language: supportedLanguageSchema.default("en")
});

type EnterpriseAccountRow = {
  id: string;
  scope: "super_admin" | "country" | "main_branch" | "city_branch";
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  parent_id: string | null;
  customer_id: string | null;
  company_id: string | null;
  bank_id: string | null;
  code: string;
  account_number: string | null;
  customer_number: string | null;
  account_serial_number: string | number | null;
  country_serial_number: string | null;
  branch_serial_number: string | null;
  manual_reference_number: string | null;
  creation_date: string | null;
  branch_code: string | null;
  branch_account_sequence: string | number | null;
  name: string;
  kind: "asset" | "liability" | "equity" | "income" | "expense";
  currency: string;
  opening_balance: string | number;
  current_balance: string | number;
  status: "active" | "archived";
  is_control_account: boolean;
  contacts?: Array<{ type: string; value: string }>;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: string;
  enterprise_account_id: string | null;
  parent_ledger_id: string | null;
  code: string;
  name: string;
  currency: string;
  opening_balance: string | number;
  current_balance: string | number;
  debit_total: string | number | null;
  credit_total: string | number | null;
  normal_balance: "debit" | "credit" | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

type PostingLineRow = {
  enterprise_account_id: string | null;
  ledger_id: string | null;
  batch_id: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  usd_rate: string | number;
  usd_amount: string | number;
  created_at: string;
};

type PostingBatchRow = {
  id: string;
  reference_no: string | null;
  entry_date: string;
  status: string | null;
  created_at: string;
};

type RoznamchaLineRow = {
  enterprise_account_id: string | null;
  ledger_id: string | null;
  roznamcha_entry_id: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  usd_rate: string | number;
  usd_amount: string | number;
};

type RoznamchaEntryRow = {
  id: string;
  voucher_no: string | null;
  entry_date: string;
  status: string | null;
  created_at: string;
};

type AuditRow = {
  entity_id: string | null;
  entity_table: string;
  action: string;
  created_at: string;
};

function toNumber(value: string | number | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function titleCase(input: string) {
  return input
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scopeLabel(scope: EnterpriseAccountRow["scope"]) {
  if (scope === "super_admin") return "Super Admin";
  if (scope === "country") return "Country";
  if (scope === "main_branch") return "Main Branch";
  return "City Branch";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIdPrefix(id: string | null | undefined) {
  if (!id) return "-";
  return id.slice(0, 8).toUpperCase();
}

function latestByDate<T extends { created_at: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function isMissingPrivilegedSupabaseKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("SUPABASE_SECRET_KEY") || message.includes("SUPABASE_SERVICE_ROLE_KEY");
}

async function ensureCoreMasterAccounts(sql: any) {
  try {
    const countries = await sql`SELECT id, name, code FROM public.countries;`;
    let uae = countries.find((c: any) => (c.name || "").toLowerCase().includes("emirates") || c.code === "AE" || c.code === "UAE");
    let pak = countries.find((c: any) => (c.name || "").toLowerCase().includes("pakistan") || c.code === "PK" || c.code === "PAK");
    let afg = countries.find((c: any) => (c.name || "").toLowerCase().includes("afghanistan") || c.code === "AF" || c.code === "AFG");
    let chn = countries.find((c: any) => (c.name || "").toLowerCase().includes("china") || c.code === "CN" || c.code === "CHN");
    let ind = countries.find((c: any) => (c.name || "").toLowerCase().includes("india") || c.code === "IN" || c.code === "IND");

    if (!ind) {
      const [insertedInd] = await sql`
        INSERT INTO public.countries (name, code, is_active)
        VALUES ('India', 'IN', true)
        ON CONFLICT DO NOTHING
        RETURNING id, name, code;
      `;
      ind = insertedInd || (await sql`SELECT id, name, code FROM public.countries WHERE code = 'IN' OR name ILIKE '%India%' LIMIT 1;`)[0];
    }

    if (!chn) {
      const [insertedChn] = await sql`
        INSERT INTO public.countries (name, code, is_active)
        VALUES ('China', 'CN', true)
        ON CONFLICT DO NOTHING
        RETURNING id, name, code;
      `;
      chn = insertedChn || (await sql`SELECT id, name, code FROM public.countries WHERE code = 'CN' OR name ILIKE '%China%' LIMIT 1;`)[0];
    }

    // 1. Ensure China Location Hierarchy (Liaoning Province -> Dalian City -> Ganjingzi District)
    let liaoningState: any = null;
    let dalianCity: any = null;
    if (chn?.id) {
      const [existingState] = await sql`
        SELECT id, name FROM public.states_provinces 
        WHERE country_id = ${chn.id} AND (name ILIKE '%Liaoning%' OR code = 'LN') 
        LIMIT 1;
      `;
      if (existingState) {
        liaoningState = existingState;
      } else {
        const [newState] = await sql`
          INSERT INTO public.states_provinces (country_id, name, code, is_active)
          VALUES (${chn.id}, 'Liaoning', 'LN', true)
          RETURNING id, name;
        `;
        liaoningState = newState;
      }

      const [existingCity] = await sql`
        SELECT id, name FROM public.cities 
        WHERE country_id = ${chn.id} AND (name ILIKE '%Dalian%' OR code = 'DLN') 
        LIMIT 1;
      `;
      if (existingCity) {
        dalianCity = existingCity;
      } else {
        const [newCity] = await sql`
          INSERT INTO public.cities (country_id, state_province_id, name, code, is_active)
          VALUES (${chn.id}, ${liaoningState?.id || null}, 'Dalian', 'DLN', true)
          RETURNING id, name;
        `;
        dalianCity = newCity;
      }

      if (dalianCity?.id) {
        await sql`
          INSERT INTO public.areas_locations (city_id, name, is_active)
          VALUES (${dalianCity.id}, 'Ganjingzi District', true)
          ON CONFLICT DO NOTHING;
        `;
      }
    }

    // 2. Ensure Company: DALIAN SUNSHINE IMP. & EXP. (Owner: Lily)
    let dalianCompany: any = null;
    const [existingCompany] = await sql`
      SELECT id, name FROM public.companies 
      WHERE name ILIKE '%DALIAN SUNSHINE%' OR legal_name ILIKE '%DALIAN SUNSHINE%' 
      LIMIT 1;
    `;
    if (existingCompany) {
      dalianCompany = existingCompany;
    } else {
      const [newCompany] = await sql`
        INSERT INTO public.companies (
          name, legal_name, owner_name, business_type, base_currency,
          address, country_id, state_province_id, city_id, is_active
        ) VALUES (
          'DALIAN SUNSHINE IMP. & EXP.',
          'DALIAN SUNSHINE IMP. & EXP.',
          'Lily',
          'Supplier / Trading Company',
          'USD',
          '12-4 23# RONGTIANXIYUAN GANJINGZI DIS. DALIAN LIAONING CHINA',
          ${chn?.id || null},
          ${liaoningState?.id || null},
          ${dalianCity?.id || null},
          true
        ) RETURNING id, name;
      `;
      dalianCompany = newCompany;
    }

    // 3. Ensure Bank: CHINA CONSTRUCTION BANK DALIAN BRANCH (SWIFT: PCBCCNBJDLX)
    let dalianBank: any = null;
    const [existingBank] = await sql`
      SELECT id, bank_name, branch_name FROM public.banks 
      WHERE (swift_bic = 'PCBCCNBJDLX') OR (bank_name ILIKE '%CHINA CONSTRUCTION BANK%' AND branch_name ILIKE '%DALIAN%')
      LIMIT 1;
    `;
    if (existingBank) {
      dalianBank = existingBank;
    } else {
      const [newBank] = await sql`
        INSERT INTO public.banks (
          bank_name, branch_name, branch_code, short_name, account_title,
          swift_bic, currency, full_address, country_id, state_province_id, city_id,
          owner_company_id, is_active
        ) VALUES (
          'CHINA CONSTRUCTION BANK',
          'DALIAN BRANCH',
          'CCB-DLN',
          'CCB Dalian',
          'DALIAN SUNSHINE IMP. & EXP.',
          'PCBCCNBJDLX',
          'USD',
          'NO. 30, WUWU ROAD, ZHONGSHAN DISTRICT, DALIAN, CHINA',
          ${chn?.id || null},
          ${liaoningState?.id || null},
          ${dalianCity?.id || null},
          ${dalianCompany?.id || null},
          true
        ) RETURNING id, bank_name, branch_name;
      `;
      dalianBank = newBank;
    }

    // Ensure India Main Branch
    if (ind?.id) {
      const [existingBranch] = await sql`SELECT id FROM public.country_branches WHERE country_id = ${ind.id} LIMIT 1;`;
      if (!existingBranch) {
        await sql`
          INSERT INTO public.country_branches (country_id, name, code, is_main, is_active)
          VALUES (${ind.id}, 'India Main Branch', 'BR-DEL-001', true, true)
          ON CONFLICT DO NOTHING;
        `;
      }
    }

    const masterAccounts = [
      {
        code: "SA-CAP-0001",
        account_number: "0000001",
        customer_number: "CUST-SA-0001",
        account_serial_number: 1,
        country_serial_number: 1,
        branch_serial_number: 1,
        branch_code: "BR-GLOBAL-001",
        branch_account_sequence: 1,
        manual_ref: "0000-SA-CAP",
        name: "Haji Abdullah Jan Accounts",
        currency: "USD",
        country_id: uae?.id || null,
        company_id: null,
        bank_id: null,
        scope: "super_admin",
        kind: "equity"
      },
      {
        code: "UAE-CORP-GEN-001",
        account_number: "1000001",
        customer_number: "CUST-UAE-0001",
        account_serial_number: 1000001,
        country_serial_number: 1000001,
        branch_serial_number: 1,
        branch_code: "BR-DXB-001",
        branch_account_sequence: 1,
        manual_ref: "0001-UAE-HUB",
        name: "United Arab Emirates Main Country Clearing Ledger",
        currency: "AED",
        country_id: uae?.id || null,
        company_id: null,
        bank_id: null,
        scope: "country",
        kind: "asset"
      },
      {
        code: "UAE-DUB-AC-0003",
        account_number: "1000003",
        customer_number: "CUST-DUB-0003",
        account_serial_number: 1000003,
        country_serial_number: 1000003,
        branch_serial_number: 3,
        branch_code: "BR-DXB-001",
        branch_account_sequence: 3,
        manual_ref: "UAE-DUB-AC-0003",
        name: "DALIAN SUNSHINE IMP. & EXP.",
        currency: "USD",
        country_id: uae?.id || chn?.id || null,
        company_id: dalianCompany?.id || null,
        bank_id: dalianBank?.id || null,
        scope: "country",
        kind: "liability"
      },
      {
        code: "PAK-CORP-GEN-001",
        account_number: "2000001",
        customer_number: "CUST-PAK-0001",
        account_serial_number: 2000001,
        country_serial_number: 2000001,
        branch_serial_number: 1,
        branch_code: "BR-KHI-001",
        branch_account_sequence: 1,
        manual_ref: "0002-PAK-HUB",
        name: "Pakistan National Central Clearing Ledger",
        currency: "PKR",
        country_id: pak?.id || null,
        company_id: null,
        bank_id: null,
        scope: "country",
        kind: "asset"
      },
      {
        code: "AFG-CORP-GEN-001",
        account_number: "3000001",
        customer_number: "CUST-AFG-0001",
        account_serial_number: 3000001,
        country_serial_number: 3000001,
        branch_serial_number: 1,
        branch_code: "BR-KBL-001",
        branch_account_sequence: 1,
        manual_ref: "0003-AFG-HUB",
        name: "Afghanistan National Central Clearing Ledger",
        currency: "AFN",
        country_id: afg?.id || null,
        company_id: null,
        bank_id: null,
        scope: "country",
        kind: "asset"
      },
      {
        code: "CHN-CORP-GEN-001",
        account_number: "4000001",
        customer_number: "CUST-CHN-0001",
        account_serial_number: 4000001,
        country_serial_number: 4000001,
        branch_serial_number: 1,
        branch_code: "BR-BJS-001",
        branch_account_sequence: 1,
        manual_ref: "0004-CHN-HUB",
        name: "China & International Trade Clearing Ledger",
        currency: "USD",
        country_id: chn?.id || null,
        company_id: null,
        bank_id: null,
        scope: "country",
        kind: "asset"
      },
      {
        code: "IND-CORP-GEN-001",
        account_number: "5000001",
        customer_number: "CUST-IND-0001",
        account_serial_number: 5000001,
        country_serial_number: 5000001,
        branch_serial_number: 1,
        branch_code: "BR-DEL-001",
        branch_account_sequence: 1,
        manual_ref: "0005-IND-HUB",
        name: "India National Central Clearing Ledger",
        currency: "INR",
        country_id: ind?.id || null,
        company_id: null,
        bank_id: null,
        scope: "country",
        kind: "asset"
      }
    ];

    for (const acc of masterAccounts) {
      const [existing] = await sql`
        SELECT id FROM public.enterprise_accounts 
        WHERE code = ${acc.code} OR manual_reference_number = ${acc.manual_ref}
        LIMIT 1;
      `;
      if (!existing) {
        const [inserted] = await sql`
          INSERT INTO public.enterprise_accounts (
            code, name, account_number, customer_number,
            account_serial_number, country_serial_number, branch_serial_number,
            branch_code, branch_account_sequence, creation_date,
            manual_reference_number, currency, country_id, company_id, bank_id,
            scope, kind, status, is_control_account, opening_balance, current_balance
          ) VALUES (
            ${acc.code}, ${acc.name}, ${acc.account_number}, ${acc.customer_number},
            ${acc.account_serial_number}, ${acc.country_serial_number}, ${acc.branch_serial_number},
            ${acc.branch_code}, ${acc.branch_account_sequence}, NOW(),
            ${acc.manual_ref}, ${acc.currency}, ${acc.country_id}, ${acc.company_id}, ${acc.bank_id},
            ${acc.scope}, ${acc.kind}, 'active', true, 0, 0
          ) RETURNING id;
        `;
        if (inserted?.id) {
          await sql`
            INSERT INTO public.ledgers (
              enterprise_account_id, code, name, currency, scope, country_id, is_active
            ) VALUES (
              ${inserted.id}, ${acc.code}, ${acc.name}, ${acc.currency}, ${acc.scope}, ${acc.country_id}, true
            ) ON CONFLICT DO NOTHING;
          `;
        }
      }
    }
  } catch (e) {
    console.error("Auto-ensuring master accounts error:", e);
  }
}

async function buildAccountsReportViaLocalPg(session: Awaited<ReturnType<typeof requireErpSession>>, effectiveQuery: z.infer<typeof querySchema>) {
  const viaPg = await withLocalPg(async (sql) => {
    await ensureCoreMasterAccounts(sql);
    const limit = Math.max(1, Math.min(effectiveQuery.limit ?? 1000, 2000));
    const scopeWhere = effectiveQuery.scope ? sql`and ea.scope = ${effectiveQuery.scope}` : sql``;
    const countryWhere = effectiveQuery.countryId ? sql`and ea.country_id = ${effectiveQuery.countryId}` : sql``;
    const countryBranchWhere = effectiveQuery.countryBranchId ? sql`and ea.country_branch_id = ${effectiveQuery.countryBranchId}` : sql``;
    const cityBranchWhere = effectiveQuery.cityBranchId ? sql`and ea.city_branch_id = ${effectiveQuery.cityBranchId}` : sql``;
    const statusWhere = effectiveQuery.status !== "all" ? sql`and ea.status = ${effectiveQuery.status}` : sql``;
    const fromWhere = effectiveQuery.fromDate ? sql`and ea.created_at >= ${`${effectiveQuery.fromDate}T00:00:00.000Z`}` : sql``;
    const toWhere = effectiveQuery.toDate ? sql`and ea.created_at <= ${`${effectiveQuery.toDate}T23:59:59.999Z`}` : sql``;

    const rows = await sql`
      select
        ea.id,
        ea.scope,
        ea.country_id,
        ea.country_branch_id,
        ea.city_branch_id,
        ea.parent_id,
        ea.customer_id,
        ea.company_id,
        ea.bank_id,
        ea.code,
        ea.account_number,
        ea.customer_number,
        ea.account_serial_number,
        ea.country_serial_number,
        ea.branch_serial_number,
        ea.manual_reference_number,
        ea.creation_date,
        ea.branch_code,
        ea.branch_account_sequence,
        ea.name,
        ea.kind,
        ea.currency,
        ea.opening_balance,
        ea.current_balance,
        ea.status,
        ea.is_control_account,
        ea.contacts,
        ea.created_at,
        ea.updated_at,
        c.name as country_name,
        c.iso2 as country_code,
        cb.name as country_branch_name,
        cb.code as country_branch_code,
        cib.city_name as city_name,
        cib.code as city_code,
        led.id as ledger_id,
        led.code as ledger_code,
        led.name as ledger_name,
        led.currency as ledger_currency,
        led.is_active as ledger_is_active,
        co.name as company_name,
        co.legal_name as company_legal_name,
        co.owner_name as company_owner_name,
        cust.customer_name as customer_name,
        bank.bank_name as bank_name,
        bank.branch_name as bank_branch_name,
        bank.account_number as bank_account_number,
        bank.phone as bank_phone,
        bank.email as bank_email
      from public.enterprise_accounts ea
      left join public.countries c on c.id = ea.country_id
      left join public.country_branches cb on cb.id = ea.country_branch_id
      left join public.city_branches cib on cib.id = ea.city_branch_id
      left join lateral (
        select l.id, l.code, l.name, l.currency, l.is_active
        from public.ledgers l
        where l.enterprise_account_id = ea.id and l.deleted_at is null
        order by l.created_at desc
        limit 1
      ) led on true
      left join public.companies co on co.id = ea.company_id and co.deleted_at is null
      left join public.customers cust on cust.id = ea.customer_id and cust.deleted_at is null
      left join public.banks bank on bank.id = ea.bank_id and bank.deleted_at is null
      where ea.deleted_at is null
        ${scopeWhere}
        ${countryWhere}
        ${countryBranchWhere}
        ${cityBranchWhere}
        ${statusWhere}
        ${fromWhere}
        ${toWhere}
      order by ea.created_at desc
      limit ${limit}
    `;

    const filtered = (rows as Array<any>).map((account) => {
      const contactsList = Array.isArray(account.contacts) ? account.contacts : [];
      const companyName = account.company_legal_name || account.company_name || account.customer_name || "-";
      const branchType = scopeLabel(account.scope);
      const branchName =
        account.scope === "city_branch"
          ? `${account.city_name ?? "-"} (${account.city_code ?? "-"})`
          : account.scope === "main_branch"
            ? `${account.country_branch_name ?? "-"} (${account.country_branch_code ?? "-"})`
            : account.scope === "country"
              ? `${account.country_name ?? "-"} (${account.country_code ?? "-"})`
              : "Super Admin";

      return {
        accountId: account.id,
        accountCode: account.code ?? account.account_number ?? account.id,
        rawAccountCode: account.code ?? null,
        customerNumber: account.customer_number ?? null,
        countrySerialNumber: account.country_serial_number ?? "-",
        branchSerialNumber: account.branch_serial_number ?? "-",
        manualReferenceNumber: account.manual_reference_number ?? null,
        accountName: account.name ?? "-",
        journalCode: account.ledger_code ?? account.code ?? "-",
        ledgerId: account.ledger_id ?? null,
        ledgerName: account.ledger_name ?? null,
        ledgerStatus: account.ledger_is_active === false ? "inactive" : "active",
        ledgerCurrency: account.ledger_currency ?? account.currency ?? "-",
        branchType,
        branchName,
        mainBranchName: account.country_branch_name ?? "-",
        cityBranchName: account.city_name ?? "-",
        branchCode: account.branch_code || account.country_branch_code || account.city_code || "-",
        countryId: account.country_id,
        countryName: account.country_name ?? "-",
        countryCode: account.country_code ?? "-",
        stateName: "-",
        stateCode: "-",
        cityId: account.city_branch_id,
        cityName: account.city_name ?? "-",
        cityCode: account.city_code ?? "-",
        currency: account.currency ?? "-",
        accountCategory: titleCase(account.kind ?? "account"),
        subType: account.is_control_account ? "Control Account" : "Normal Account",
        status: account.status ?? "active",
        createdAt: account.creation_date || account.created_at,
        openingBalance: toNumber(account.opening_balance),
        debitTotal: 0,
        creditTotal: 0,
        currentBalance: toNumber(account.current_balance),
        linkedLedgerCount: account.ledger_id ? 1 : 0,
        journalActivityCount: 0,
        latestJournalNo: account.ledger_code ?? account.code ?? null,
        latestActivityAt: account.updated_at ?? account.created_at,
        companyName,
        companyCode: account.company_id ? parseIdPrefix(account.company_id) : "-",
        companyOwner: account.company_owner_name ?? "-",
        bankName: account.bank_name ?? "-",
        warehouseName: "-",
        ownerName: account.company_owner_name ?? account.customer_name ?? "-",
        mobile: contactsList.find((item: any) => String(item?.type ?? "").toLowerCase().includes("mobile"))?.value ?? account.bank_phone ?? null,
        whatsapp: contactsList.find((item: any) => String(item?.type ?? "").toLowerCase().includes("whatsapp"))?.value ?? null,
        email: contactsList.find((item: any) => String(item?.type ?? "").toLowerCase().includes("email"))?.value ?? account.bank_email ?? null,
        recentActivityLabel: null,
        recentActivityAt: account.updated_at ?? account.created_at,
        accountSerialNumber: Number(account.account_serial_number ?? 0),
        branchAccountSequence: Number(account.branch_account_sequence ?? 0),
        recentMovements: [],
        contacts: contactsList
      };
    });

    const q = normalizeSearch(effectiveQuery.q ?? "");
    const rowsFiltered = q
      ? filtered.filter((row) =>
          normalizeSearch(
            [
              row.accountCode,
              row.rawAccountCode,
              row.customerNumber,
              row.countrySerialNumber,
              row.branchSerialNumber,
              row.manualReferenceNumber ?? "",
              row.accountName,
              row.journalCode,
              row.ledgerName,
              row.branchName,
              row.branchCode,
              row.countryName,
              row.countryCode,
              row.cityName,
              row.cityCode,
              row.branchType,
              row.currency,
              row.accountCategory,
              row.subType,
              row.status,
              row.companyName,
              row.companyCode,
              row.companyOwner,
              row.latestJournalNo ?? "",
              row.recentActivityLabel ?? ""
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(q)
        )
      : filtered;

    const summary = {
      totalAccounts: rowsFiltered.length,
      activeAccounts: rowsFiltered.filter((row) => row.status === "active").length,
      countryAccounts: rowsFiltered.filter((row) => row.branchType === "Country").length,
      branchAccounts: rowsFiltered.filter((row) => row.branchType === "Main Branch" || row.branchType === "City Branch").length,
      adminAccounts: rowsFiltered.filter((row) => row.branchType === "Super Admin").length,
      totalLedgers: rowsFiltered.reduce((sum, row) => sum + row.linkedLedgerCount, 0),
      activeLedgers: rowsFiltered.filter((row) => row.ledgerStatus === "active").length,
      openingBalanceTotal: rowsFiltered.reduce((sum, row) => sum + row.openingBalance, 0),
      debitTotal: rowsFiltered.reduce((sum, row) => sum + row.debitTotal, 0),
      creditTotal: rowsFiltered.reduce((sum, row) => sum + row.creditTotal, 0),
      currentBalanceTotal: rowsFiltered.reduce((sum, row) => sum + row.currentBalance, 0),
      journalActivityTotal: rowsFiltered.reduce((sum, row) => sum + row.journalActivityCount, 0),
      recentUpdates: rowsFiltered.filter((row) => row.latestActivityAt && new Date(row.latestActivityAt).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 7).length
    };

    return {
      summary,
      workspace: {
        companyId: null,
        companyName: rowsFiltered[0]?.companyName ?? "-",
        companyCode: rowsFiltered[0]?.companyCode ?? "-",
        companyOwner: rowsFiltered[0]?.companyOwner ?? "-"
      },
      rows: rowsFiltered,
      generatedAt: new Date().toISOString()
    };
  });

  if (!viaPg) {
    throw new Error("DATABASE_URL is not configured for local account report fallback.");
  }
  await localizeAccountNames(viaPg.rows, effectiveQuery.language);
  // Batch 2/3 for the local-PG fallback path: localize the composite Branch/City/Country and
  // linked Company display strings with the phrase translator (approved place/business terms
  // translate, proper/unknown words stay). Mirrors the Supabase path below.
  const tpFallback = await getPhraseTranslator(effectiveQuery.language);
  // Translate only the human-readable NAME, never a trailing "(CODE)" identifier.
  const tpHead = (v: string) => {
    const s = (v ?? "").toString();
    const i = s.indexOf(" (");
    return i === -1 ? tpFallback(s) : tpFallback(s.slice(0, i)) + s.slice(i);
  };
  for (const r of viaPg.rows) {
    r.branchName = tpHead(r.branchName);
    r.mainBranchName = tpHead(r.mainBranchName);
    r.cityBranchName = tpHead(r.cityBranchName);
    r.cityName = tpFallback(r.cityName);
    r.countryName = tpFallback(r.countryName);
    if (r.companyName && r.companyName !== "-") r.companyName = tpFallback(r.companyName);
  }
  return viaPg;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      scope: request.nextUrl.searchParams.get("scope") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId") ?? undefined,
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") ?? undefined,
      toDate: request.nextUrl.searchParams.get("toDate") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      language: request.nextUrl.searchParams.get("language") ?? undefined
    });
    const effectiveQuery = { ...query };

    if (!session.isSuperAdmin) {
      const isCountryScope = session.roles.includes("country_admin") || session.roles.includes("country_user");
      const isMainBranchScope = session.roles.includes("main_branch_admin");

      if (isCountryScope) {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
      } else if (isMainBranchScope) {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
        if (!effectiveQuery.countryBranchId && session.countryBranchIds[0]) {
          effectiveQuery.countryBranchId = session.countryBranchIds[0];
        }
      } else {
        if (!effectiveQuery.countryId && session.countryIds[0]) {
          effectiveQuery.countryId = session.countryIds[0];
        }
        if (!effectiveQuery.countryBranchId && session.countryBranchIds[0]) {
          effectiveQuery.countryBranchId = session.countryBranchIds[0];
        }
        if (!effectiveQuery.cityBranchId && session.cityBranchIds[0]) {
          effectiveQuery.cityBranchId = session.cityBranchIds[0];
        }
      }
    }

    authorizeApiScope(session, {
      resource: "accounts",
      action: "read",
      countryId: effectiveQuery.countryId ?? null,
      countryBranchId: effectiveQuery.countryBranchId ?? null,
      cityBranchId: effectiveQuery.cityBranchId ?? null
    });

    await withLocalPg((sql) => ensureCoreMasterAccounts(sql)).catch(() => null);

    let supabase: any;
    try {
      supabase = createSupabaseAdminClient() as any;
    } catch (error) {
      if (isMissingPrivilegedSupabaseKey(error)) {
        const fallback = await buildAccountsReportViaLocalPg(session, effectiveQuery);
        return apiOk(fallback);
      }
      throw error;
    }
    const sessionUserIdIsUuid = uuidSchema.safeParse(session.userId).success;

    const profileRes = sessionUserIdIsUuid
      ? await supabase.from("profiles").select("id, full_name, default_company_id").eq("id", session.userId).maybeSingle()
      : { data: null, error: null };

    let accountQuery = supabase
      .from("enterprise_accounts")
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, parent_id, customer_id, company_id, bank_id, code, account_number, customer_number, account_serial_number, country_serial_number, branch_serial_number, manual_reference_number, creation_date, branch_code, branch_account_sequence, name, kind, currency, opening_balance, current_balance, status, is_control_account, contacts, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (effectiveQuery.scope) accountQuery = accountQuery.eq("scope", effectiveQuery.scope);
    if (effectiveQuery.countryId) accountQuery = accountQuery.eq("country_id", effectiveQuery.countryId);
    if (effectiveQuery.countryBranchId) accountQuery = accountQuery.eq("country_branch_id", effectiveQuery.countryBranchId);
    if (effectiveQuery.cityBranchId) accountQuery = accountQuery.eq("city_branch_id", effectiveQuery.cityBranchId);
    if (effectiveQuery.status !== "all") accountQuery = accountQuery.eq("status", effectiveQuery.status);
    if (effectiveQuery.fromDate) accountQuery = accountQuery.gte("created_at", `${effectiveQuery.fromDate}T00:00:00.000Z`);
    if (effectiveQuery.toDate) accountQuery = accountQuery.lte("created_at", `${effectiveQuery.toDate}T23:59:59.999Z`);

    const accountRes = await accountQuery.limit(effectiveQuery.limit);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (accountRes.error) throw new Error(accountRes.error.message);

    const accountRows = (accountRes.data ?? []) as EnterpriseAccountRow[];
    const accountIds = accountRows.map((row) => row.id);

    // Helper to chunk arrays to avoid URL length limits (> 16KB)
    async function fetchInChunks<T>(items: string[], chunkSize: number, fetcher: (chunk: string[]) => Promise<{ data: T[] | null; error: any }>) {
      if (!items.length) return { data: [], error: null };
      const results: T[] = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const res = await fetcher(chunk);
        if (res.error) return { data: null, error: res.error };
        if (res.data) results.push(...res.data);
      }
      return { data: results, error: null };
    }

    // Account/company name localization is handled in one batch after row assembly via the
    // central resolver (localizeAccountNames / localizeRecordNames) — no per-row translation
    // prefetch needed here anymore.
    const ledgerRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("ledgers")
        .select("id, enterprise_account_id, parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, normal_balance, is_active, created_at, updated_at")
        .is("deleted_at", null)
        .in("enterprise_account_id", chunk);
    });

    const postingRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("ledger_posting_lines")
        .select("enterprise_account_id, ledger_id, batch_id, debit, credit, currency, usd_rate, usd_amount, created_at")
        .in("enterprise_account_id", chunk);
    });

    const roznamchaLineRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("roznamcha_lines")
        .select("enterprise_account_id, ledger_id, roznamcha_entry_id, debit, credit, currency, usd_rate, usd_amount")
        .in("enterprise_account_id", chunk);
    });

    const auditRes = await fetchInChunks(accountIds, 150, async (chunk) => {
      return supabase
        .from("audit_logs")
        .select("entity_id, entity_table, action, created_at")
        .in("entity_id", chunk)
        .in("entity_table", ["enterprise_accounts", "ledgers"]);
    });

    if (ledgerRes.error) throw new Error(ledgerRes.error.message);
    if (postingRes.error) throw new Error(postingRes.error.message);
    if (roznamchaLineRes.error) throw new Error(roznamchaLineRes.error.message);
    if (auditRes.error) throw new Error(auditRes.error.message);

    const ledgers = (ledgerRes.data ?? []) as LedgerRow[];
    const postingLines = (postingRes.data ?? []) as PostingLineRow[];
    const rozLines = (roznamchaLineRes.data ?? []) as RoznamchaLineRow[];
    const audits = (auditRes.data ?? []) as AuditRow[];

    const batchIds = [...new Set(postingLines.map((row) => row.batch_id).filter((value): value is string => Boolean(value)))];
    const entryIds = [...new Set(rozLines.map((row) => row.roznamcha_entry_id).filter((value): value is string => Boolean(value)))];

    const postingBatchRes = await fetchInChunks(batchIds, 150, async (chunk) => {
      return supabase.from("ledger_posting_batches").select("id, reference_no, entry_date, status, created_at").in("id", chunk);
    });

    const roznamchaEntryRes = await fetchInChunks(entryIds, 150, async (chunk) => {
      return supabase.from("roznamcha_entries").select("id, voucher_no, entry_date, status, created_at").in("id", chunk);
    });

    if (postingBatchRes.error) throw new Error(postingBatchRes.error.message);
    if (roznamchaEntryRes.error) throw new Error(roznamchaEntryRes.error.message);

    const postingBatches = (postingBatchRes.data ?? []) as PostingBatchRow[];
    const rozEntries = (roznamchaEntryRes.data ?? []) as RoznamchaEntryRow[];

    const countryIds = [...new Set(accountRows.map((row) => row.country_id).filter((value): value is string => Boolean(value)))];
    const countryBranchIds = [...new Set(accountRows.map((row) => row.country_branch_id).filter((value): value is string => Boolean(value)))];
    const cityBranchIds = [...new Set(accountRows.map((row) => row.city_branch_id).filter((value): value is string => Boolean(value)))];
    const customerIds = [...new Set(accountRows.map((row) => row.customer_id).filter((value): value is string => Boolean(value)))];
    const companyIds = [...new Set(accountRows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))];
    const bankIds = [...new Set(accountRows.map((row) => row.bank_id).filter((value): value is string => Boolean(value)))];

    const countriesRes = await fetchInChunks(countryIds, 150, async (chunk) => supabase.from("countries").select("id, name, iso2, currency_code").in("id", chunk));
    const countryBranchesRes = await fetchInChunks(countryBranchIds, 150, async (chunk) => supabase.from("country_branches").select("id, country_id, name, code, local_currency, status").in("id", chunk));
    const cityBranchesRes = await fetchInChunks(cityBranchIds, 150, async (chunk) => supabase.from("city_branches").select("id, country_id, country_branch_id, city_name, name, code, local_currency, status").in("id", chunk));
    const companyRes = profileRes.data?.default_company_id ? await supabase.from("companies").select("id, name, legal_name, base_currency, created_at, updated_at").eq("id", profileRes.data.default_company_id).maybeSingle() : { data: null, error: null };
    const customersRes = await fetchInChunks(customerIds, 150, async (chunk) => supabase.from("customers").select("id, customer_name").in("id", chunk));
    const companiesListRes = await fetchInChunks(companyIds, 150, async (chunk) => supabase.from("companies").select("id, name, legal_name").in("id", chunk));
    const banksListRes = await fetchInChunks(bankIds, 150, async (chunk) => supabase.from("banks").select("id, bank_name, branch_name, account_number, phone, email").in("id", chunk));

    if (countriesRes.error) throw new Error(countriesRes.error.message);
    if (countryBranchesRes.error) throw new Error(countryBranchesRes.error.message);
    if (cityBranchesRes.error) throw new Error(cityBranchesRes.error.message);
    if (companyRes.error) throw new Error(companyRes.error.message);
    if (customersRes.error) throw new Error(customersRes.error.message);

    const countries = (countriesRes.data ?? []) as Array<{ id: string; name: string; iso2: string | null; currency_code: string }>;
    const countryBranches = (countryBranchesRes.data ?? []) as Array<{
      id: string;
      country_id: string;
      name: string;
      code: string;
      local_currency: string;
      status: string;
    }>;
    const cityBranches = (cityBranchesRes.data ?? []) as Array<{
      id: string;
      country_id: string;
      country_branch_id: string;
      city_name: string;
      name: string;
      code: string;
      local_currency: string;
      status: string;
    }>;
    const customers = (customersRes.data ?? []) as Array<{ id: string; customer_name: string }>;
    const company = companyRes.data as { id: string; name: string; legal_name: string | null; base_currency: string } | null;
    const profile = profileRes.data as { id: string; full_name: string | null; default_company_id: string | null } | null;

    const countryLookup = new Map(countries.map((row) => [row.id, row] as const));
    const countryBranchLookup = new Map(countryBranches.map((row) => [row.id, row] as const));
    const cityBranchLookup = new Map(cityBranches.map((row) => [row.id, row] as const));
    const ledgerLookup = new Map(ledgers.map((row) => [row.enterprise_account_id ?? row.id, row] as const));
    const customerLookup = new Map(customers.map((row) => [row.id, row.customer_name] as const));
    const companiesLookup = new Map(((companiesListRes.data ?? []) as any[]).map((row) => [row.id, row]));
    const banksLookup = new Map(((banksListRes.data ?? []) as any[]).map((row) => [row.id, row]));

    const postingByAccount = new Map<string, PostingLineRow[]>();
    for (const line of postingLines) {
      if (!line.enterprise_account_id) continue;
      const list = postingByAccount.get(line.enterprise_account_id) ?? [];
      list.push(line);
      postingByAccount.set(line.enterprise_account_id, list);
    }

    const rozByAccount = new Map<string, RoznamchaLineRow[]>();
    for (const line of rozLines) {
      if (!line.enterprise_account_id) continue;
      const list = rozByAccount.get(line.enterprise_account_id) ?? [];
      list.push(line);
      rozByAccount.set(line.enterprise_account_id, list);
    }

    const batchLookup = new Map(postingBatches.map((row) => [row.id, row] as const));
    const rozLookup = new Map(rozEntries.map((row) => [row.id, row] as const));

    const auditByEntity = new Map<string, AuditRow[]>();
    for (const row of audits) {
      if (!row.entity_id) continue;
      const list = auditByEntity.get(row.entity_id) ?? [];
      list.push(row);
      auditByEntity.set(row.entity_id, list);
    }

    const rows = accountRows.map((account) => {
      const linkedLedger = ledgerLookup.get(account.id) ?? null;
      const postingMovements = postingByAccount.get(account.id) ?? [];
      const rozMovements = rozByAccount.get(account.id) ?? [];
      const allMovements = [
        ...postingMovements.map((line) => ({
          source: "ledger" as const,
          id: line.batch_id,
          createdAt: line.created_at,
          referenceNo: batchLookup.get(line.batch_id)?.reference_no ?? null,
          entryDate: batchLookup.get(line.batch_id)?.entry_date ?? line.created_at.slice(0, 10),
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          currency: line.currency,
          usdRate: toNumber(line.usd_rate),
          usdAmount: toNumber(line.usd_amount)
        })),
        ...rozMovements.map((line) => ({
          source: "roznamcha" as const,
          id: line.roznamcha_entry_id,
          createdAt: `${rozLookup.get(line.roznamcha_entry_id)?.entry_date ?? account.created_at.slice(0, 10)}T00:00:00.000Z`,
          referenceNo: rozLookup.get(line.roznamcha_entry_id)?.voucher_no ?? null,
          entryDate: rozLookup.get(line.roznamcha_entry_id)?.entry_date ?? account.created_at.slice(0, 10),
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          currency: line.currency,
          usdRate: toNumber(line.usd_rate),
          usdAmount: toNumber(line.usd_amount)
        }))
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const accountAudits = (auditByEntity.get(account.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const latestAudit = accountAudits[0] ?? null;

      const debitTotal = allMovements.reduce((sum, row) => sum + row.debit, 0);
      const creditTotal = allMovements.reduce((sum, row) => sum + row.credit, 0);
      const latestMovement = allMovements[0] ?? null;
      const latestJournalNo = latestMovement?.referenceNo ?? linkedLedger?.code ?? account.code;
      const latestActivityAt = latestMovement?.createdAt ?? latestAudit?.created_at ?? account.updated_at;
      const journalActivityCount = new Set(allMovements.map((row) => `${row.source}:${row.id}`)).size;

      const country = account.country_id ? countryLookup.get(account.country_id) ?? null : null;
      const countryBranch = account.country_branch_id ? countryBranchLookup.get(account.country_branch_id) ?? null : null;
      const cityBranch = account.city_branch_id ? cityBranchLookup.get(account.city_branch_id) ?? null : null;
      // Raw name; the account name is localized in one batch below through the central
      // 3-tier resolver (localizeAccountNames). Used here only for the control-account bank label.
      const accountName = account.name;
      const translatedCityName = cityBranch?.city_name ?? "-";

      const branchType =
        account.scope === "super_admin"
          ? "Super Admin"
          : account.scope === "country"
            ? "Country"
            : account.scope === "main_branch"
              ? "Main Branch"
              : "City Branch";

      const branchName =
        account.scope === "super_admin"
          ? "Super Admin Workspace"
          : account.scope === "country"
            ? country?.name ?? "-"
            : account.scope === "main_branch"
              ? countryBranch?.name ?? "-"
              : cityBranch?.name ?? "-";

      const mainBranchName =
        account.scope === "city_branch"
          ? account.country_branch_id
            ? countryBranchLookup.get(account.country_branch_id)?.name ?? "-"
            : "-"
          : account.scope === "main_branch"
            ? countryBranch?.name ?? "-"
            : account.scope === "country"
              ? country?.name ?? "-"
              : "Super Admin Workspace";

      const cityBranchName = account.scope === "city_branch" ? cityBranch?.name ?? cityBranch?.city_name ?? "-" : "-";

      const branchCode =
        account.scope === "super_admin"
          ? "SUPER"
          : account.scope === "country"
            ? country?.iso2 ?? "-"
            : account.scope === "main_branch"
              ? countryBranch?.code ?? "-"
              : cityBranch?.code ?? "-";

      const linkedComp = account.company_id ? companiesLookup.get(account.company_id) : null;
      const linkedBnk = account.bank_id ? banksLookup.get(account.bank_id) : null;
      const contactsList = Array.isArray(account.contacts) ? account.contacts : [];
      const findContact = (prefix: string) => contactsList.find(c => c?.type?.toLowerCase()?.includes(prefix))?.value ?? null;

      const mobileVal = findContact("mobile") || findContact("phone") || linkedBnk?.phone || "-";
      const whatsappVal = findContact("whatsapp") || findContact("wa") || mobileVal;
      const emailVal = findContact("email") || linkedBnk?.email || "-";
      const custNameFromId = account.customer_id ? customerLookup.get(account.customer_id) ?? null : null;
      const ownerVal = 
        findContact("owner") ||
        findContact("customer") ||
        findContact("contact") ||
        (account as any).customer_name ||
        custNameFromId ||
        (account as any).owner_name ||
        (account as any).contact_name ||
        (account as any).company_owner_name ||
        linkedComp?.owner_name ||
        linkedComp?.contact_person ||
        profile?.full_name ||
        "-";
      const warehouseVal = findContact("warehouse") || "-";
      const bankVal = linkedBnk?.bank_name || (account.is_control_account ? accountName : "-");
      // Linked company name (raw); localized as a batch below (companies table) via the
      // central resolver so linked company names follow the same policy as account names.
      const companyVal = linkedComp?.name || company?.name || profile?.full_name || "-";

      return {
        accountId: account.id,
        accountCode: account.account_number || account.code,
        rawAccountCode: account.code,
        customerId: account.customer_id,
        customerName: account.customer_id ? customerLookup.get(account.customer_id) ?? "-" : "-",
        customerNumber: account.customer_number || `CUST-${account.code}`,
        companyId: account.company_id,
        bankId: account.bank_id,
        accountSerialNumber: Number(account.account_serial_number ?? 0),
        countrySerialNumber: account.country_serial_number ?? "-",
        branchSerialNumber: account.branch_serial_number ?? "-",
        manualReferenceNumber: account.manual_reference_number ?? null,
        branchAccountSequence: Number(account.branch_account_sequence ?? 0),
        // Raw stored name; localized as a batch below via the 3-tier resolver so the
        // central system_dictionary tier applies for English selection too.
        accountName: account.name,
        journalCode: linkedLedger?.code ?? account.code,
        ledgerId: linkedLedger?.id ?? null,
        ledgerName: linkedLedger?.name ?? null,
        ledgerStatus: linkedLedger?.is_active === false ? "inactive" : "active",
        ledgerCurrency: linkedLedger?.currency ?? account.currency,
        branchType,
        branchName,
        mainBranchName,
        cityBranchName,
        branchCode: account.branch_code || branchCode,
        countryId: account.country_id,
        countryName: country?.name ?? "-",
        countryCode: country?.iso2 ?? "-",
        stateName: "-",
        stateCode: "-",
        cityId: account.city_branch_id,
        cityName: translatedCityName,
        cityCode: cityBranch?.code ?? "-",
        currency: account.currency,
        accountCategory: titleCase(account.kind),
        subType: account.is_control_account ? "Control Account" : "Normal Account",
        status: account.status,
        createdAt: account.creation_date || account.created_at,
        openingBalance: toNumber(account.opening_balance),
        debitTotal,
        creditTotal,
        currentBalance: toNumber(account.current_balance),
        linkedLedgerCount: linkedLedger ? 1 : 0,
        journalActivityCount,
        latestJournalNo,
        latestActivityAt,
        companyName: companyVal,
        bankName: bankVal,
        warehouseName: warehouseVal,
        ownerName: ownerVal,
        mobile: mobileVal,
        whatsapp: whatsappVal,
        email: emailVal,
        companyCode: company?.id ? parseIdPrefix(company.id) : "-",
        companyOwner: ownerVal,
        recentActivityLabel: latestAudit?.action ?? latestMovement?.referenceNo ?? null,
        recentActivityAt: latestActivityAt,
        recentMovements: allMovements.map((row) => ({
          source: row.source,
          referenceNo: row.referenceNo,
          entryDate: row.entryDate,
          debit: row.debit,
          credit: row.credit,
          currency: row.currency,
          usdRate: row.usdRate,
          usdAmount: row.usdAmount
        })),
        contacts: contactsList
      };
    });

    // Localize account names through the single 3-tier ERP resolver (record translation →
    // central system_dictionary → honest original) so English selects English wherever an
    // approved/dictionary translation exists, and never machine-guesses a proper name.
    await localizeAccountNames(rows, effectiveQuery.language);

    // Batch 2 — linked Company + Customer/Owner names via the central resolver with
    // phrase-level fallback: approved business terms inside the name (General Traders,
    // Transport Co., …) translate; genuine person/company proper-name words stay original.
    const compTargets = rows.filter((r) => r.companyId).map((r) => ({ id: r.companyId as string, name: r.companyName }));
    if (compTargets.length) {
      const localizedCompanies = await localizeRecordNames(compTargets, "companies", "name", effectiveQuery.language, { phraseFallback: true });
      const companyById = new Map(localizedCompanies.map((c) => [c.id, c.name] as const));
      for (const r of rows) {
        if (r.companyId) {
          const resolved = companyById.get(r.companyId);
          if (resolved) r.companyName = resolved;
        }
      }
    }

    const custTargets = rows
      .filter((r) => r.customerId && r.customerName && r.customerName !== "-")
      .map((r) => ({ id: r.customerId as string, customer_name: r.customerName }));
    if (custTargets.length) {
      const localizedCustomers = await localizeRecordNames(custTargets, "customers", "customer_name", effectiveQuery.language, { phraseFallback: true });
      const customerById = new Map(localizedCustomers.map((c) => [c.id, c.customer_name] as const));
      for (const r of rows) {
        if (r.customerId) {
          const resolved = customerById.get(r.customerId);
          if (resolved) r.customerName = resolved;
        }
      }
    }

    // Batch 3 — Branch / City / Country display labels are composite strings ("Quetta (QTA)",
    // "Pakistan"), not single record fields, so localize them with the phrase translator:
    // approved place/business terms translate, codes and unknown proper words stay as-is.
    const tp = await getPhraseTranslator(effectiveQuery.language);
    // Translate only the human-readable NAME, never a trailing "(CODE)" identifier.
    const tpHead = (v: string) => {
      const s = (v ?? "").toString();
      const i = s.indexOf(" (");
      return i === -1 ? tp(s) : tp(s.slice(0, i)) + s.slice(i);
    };
    for (const r of rows) {
      r.branchName = tpHead(r.branchName);
      r.mainBranchName = tpHead(r.mainBranchName);
      r.cityBranchName = tpHead(r.cityBranchName);
      r.cityName = tp(r.cityName);
      r.countryName = tp(r.countryName);
    }

    const q = normalizeSearch(effectiveQuery.q ?? "");
    const filtered = q
      ? rows.filter((row) =>
          normalizeSearch(
            [
              row.accountCode,
              row.rawAccountCode,
              row.customerNumber,
              row.countrySerialNumber,
              row.branchSerialNumber,
              row.manualReferenceNumber ?? "",
              row.accountName,
              row.journalCode,
              row.ledgerName,
              row.branchName,
              row.branchCode,
              row.countryName,
              row.countryCode,
              row.cityName,
              row.cityCode,
              row.branchType,
              row.currency,
              row.accountCategory,
              row.subType,
              row.status,
              row.companyName,
              row.companyCode,
              row.companyOwner,
              row.latestJournalNo ?? "",
              row.recentActivityLabel ?? ""
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(q)
        )
      : rows;

    const summary = {
      totalAccounts: filtered.length,
      activeAccounts: filtered.filter((row) => row.status === "active").length,
      countryAccounts: filtered.filter((row) => row.branchType === "Country").length,
      branchAccounts: filtered.filter((row) => row.branchType === "Main Branch" || row.branchType === "City Branch").length,
      adminAccounts: filtered.filter((row) => row.branchType === "Super Admin").length,
      totalLedgers: filtered.reduce((sum, row) => sum + row.linkedLedgerCount, 0),
      activeLedgers: filtered.filter((row) => row.ledgerStatus === "active").length,
      openingBalanceTotal: filtered.reduce((sum, row) => sum + row.openingBalance, 0),
      debitTotal: filtered.reduce((sum, row) => sum + row.debitTotal, 0),
      creditTotal: filtered.reduce((sum, row) => sum + row.creditTotal, 0),
      currentBalanceTotal: filtered.reduce((sum, row) => sum + row.currentBalance, 0),
      journalActivityTotal: filtered.reduce((sum, row) => sum + row.journalActivityCount, 0),
      recentUpdates: filtered.filter((row) => row.latestActivityAt && new Date(row.latestActivityAt).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 7).length
    };

    return apiOk({
      summary,
      workspace: {
        companyId: profile?.default_company_id ?? null,
        companyName: company?.name || profile?.full_name || "-",
        companyCode: company?.id ? parseIdPrefix(company.id) : "-",
        companyOwner: profile?.full_name ?? "-"
      },
      rows: filtered,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
