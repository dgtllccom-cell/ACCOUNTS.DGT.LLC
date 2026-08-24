import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";

type BankRow = {
  id: string;
  bank_type: string;
  account_type: string;
  bank_name: string;
  branch_name: string;
  branch_code: string;
  branch_code_type: string;
  short_name: string;
  account_title: string;
  account_number: string;
  iban_number: string | null;
  currency: string;
  account_status: string;
  country_id: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  full_address: string | null;
  phone: string | null;
  email: string | null;
  swift_bic: string | null;
  website: string | null;
  remarks: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  country_name: string | null;
};

type LegacyBankRecord = {
  id: string;
  bank_code: string | null;
  bank_name: string;
  branch_name: string | null;
  country_id: string | null;
  account_title: string | null;
  account_number: string | null;
  iban: string | null;
  swift_code: string | null;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  country?: { name: string } | null;
};

function mapBank(row: BankRow): LegacyBankRecord {
  return {
    id: row.id,
    bank_code: row.branch_code ?? null,
    bank_name: row.bank_name,
    branch_name: row.branch_name ?? null,
    country_id: row.country_id ?? null,
    account_title: row.account_title ?? null,
    account_number: row.account_number ?? null,
    iban: row.iban_number ?? null,
    swift_code: row.swift_bic ?? null,
    currency_code: row.currency ?? "USD",
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    country: row.country_name ? { name: row.country_name } : null
  };
}

async function loadBanks(): Promise<LegacyBankRecord[]> {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql<BankRow[]>`
      SELECT
        b.id,
        b.bank_type,
        b.account_type,
        b.bank_name,
        b.branch_name,
        b.branch_code,
        b.branch_code_type,
        b.short_name,
        b.account_title,
        b.account_number,
        b.iban_number,
        b.currency,
        b.account_status,
        b.country_id,
        b.state_province_id,
        b.district_id,
        b.city_id,
        b.full_address,
        b.phone,
        b.email,
        b.swift_bic,
        b.website,
        b.remarks,
        b.is_active,
        b.created_at,
        b.updated_at,
        c.name AS country_name
      FROM public.banks b
      LEFT JOIN public.countries c ON c.id = b.country_id
      WHERE b.deleted_at IS NULL
      ORDER BY b.created_at DESC
    `;
    return rows.map(mapBank);
  });
  if (viaPg) return viaPg;
  return [];
}

async function getBankById(id: string): Promise<LegacyBankRecord | null> {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql<BankRow[]>`
      SELECT
        b.id,
        b.bank_type,
        b.account_type,
        b.bank_name,
        b.branch_name,
        b.branch_code,
        b.branch_code_type,
        b.short_name,
        b.account_title,
        b.account_number,
        b.iban_number,
        b.currency,
        b.account_status,
        b.country_id,
        b.state_province_id,
        b.district_id,
        b.city_id,
        b.full_address,
        b.phone,
        b.email,
        b.swift_bic,
        b.website,
        b.remarks,
        b.is_active,
        b.created_at,
        b.updated_at,
        c.name AS country_name
      FROM public.banks b
      LEFT JOIN public.countries c ON c.id = b.country_id
      WHERE b.id = ${id}::uuid AND b.deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? mapBank(rows[0]) : null;
  });
  if (viaPg !== null) return viaPg;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "banks", action: "read" });

    const search = (request.nextUrl.searchParams.get("search") || request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const status = request.nextUrl.searchParams.get("status");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "500");
    const offset = Number(request.nextUrl.searchParams.get("offset") || "0");

    const all = await loadBanks();
    const scoped = !session.isSuperAdmin
      ? all.filter((bank) => !bank.country_id || session.countryIds.includes(bank.country_id))
      : all;
    const filtered = scoped.filter((bank) => {
      if (status === "Active" && !bank.is_active) return false;
      if (status === "Inactive" && bank.is_active) return false;
      if (!search) return true;
      const haystack = [
        bank.bank_name,
        bank.bank_code || "",
        bank.account_title || "",
        bank.account_number || "",
        bank.iban || "",
        bank.branch_name || "",
        bank.country?.name || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
    const paged = filtered.slice(offset, offset + limit);
    const active = filtered.filter((bank) => bank.is_active).length;
    const inactive = filtered.length - active;

    return apiOk({ banks: paged, summary: { total: filtered.length, active, inactive } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "banks", action: "create" });

    const body = await request.json();
    const { bankName, bankCode, branchName, countryId, accountTitle, accountNumber, iban, swiftCode, currencyCode, isActive } = body;

    if (!bankName || !countryId) {
      return new Response(JSON.stringify({ error: "bankName and countryId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return new Response(JSON.stringify({ error: "Not authorized for this country" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const bank = await withLocalPg(async (sql) => {
      const rows = await sql<BankRow[]>`
        INSERT INTO public.banks (
          bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type,
          short_name, account_title, account_number, iban_number, currency, account_status,
          country_id, state_province_id, district_id, city_id, full_address, phone, email,
          swift_bic, website, remarks, is_active, created_at, updated_at
        ) VALUES (
          ${body.bankType || "Customer Account"},
          ${body.accountType || "Business Account"},
          ${bankName},
          ${branchName || null},
          ${bankCode || body.branchCode || "0000"},
          ${body.branchCodeType || "Branch Code"},
          ${body.shortName || bankName.slice(0, 16)},
          ${accountTitle || null},
          ${accountNumber || null},
          ${iban || null},
          ${currencyCode || "USD"},
          ${body.accountStatus || (isActive === false ? "Inactive" : "Active")},
          ${countryId}::uuid,
          ${body.stateProvinceId || null}::uuid,
          ${body.districtId || null}::uuid,
          ${body.cityId || null}::uuid,
          ${body.fullAddress || null},
          ${body.phone || null},
          ${body.email || null},
          ${swiftCode || null},
          ${body.website || null},
          ${body.remarks || null},
          ${isActive !== false},
          ${new Date().toISOString()},
          ${new Date().toISOString()}
        )
        RETURNING
          id, bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type, short_name,
          account_title, account_number, iban_number, currency, account_status, country_id, state_province_id,
          district_id, city_id, full_address, phone, email, swift_bic, website, remarks, is_active, created_at, updated_at,
          NULL::text AS country_name
      `;
      return mapBank(rows[0] as unknown as BankRow);
    });

    // Register the bank's names in all 5 languages (honest engine; fire-and-forget).
    if (bank?.id) {
      void syncRecordTranslations({
        table: "banks",
        recordId: bank.id,
        record: bank as unknown as Record<string, unknown>,
        originalLanguage: session.preferredLanguage ?? "en",
        actorId: session.userId
      }).catch(() => {});
    }

    return apiOk({ bank }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
