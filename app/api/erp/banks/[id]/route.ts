import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { banksService } from "@/lib/services/banks-service";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, localizeJoinedNames, wantsRawRecord } from "@/lib/i18n/localize-records";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

type BankRow = {
  id: string;
  account_code: string | null;
  owner_person_id: string | null;
  owner_company_id: string | null;
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
  account_code: string | null;
  owner_person_id: string | null;
  owner_company_id: string | null;
  // Legacy names — kept for existing consumers (bank-registry.tsx list,
  // new-account-setup.tsx's linked-bank display). Never rename these.
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
  // Full field set (added 2026-09-10 so the Bank Edit form can load and save
  // every field the create form captures) — same names as `createBank`'s
  // payload in features/banks/bank-api.ts.
  bank_type: string | null;
  account_type: string | null;
  branch_code: string | null;
  branch_code_type: string | null;
  short_name: string | null;
  iban_number: string | null;
  swift_bic: string | null;
  currency: string;
  account_status: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  full_address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  remarks: string | null;
};

function mapBank(row: BankRow): LegacyBankRecord {
  return {
    id: row.id,
    account_code: row.account_code ?? null,
    owner_person_id: row.owner_person_id ?? null,
    owner_company_id: row.owner_company_id ?? null,
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
    country: row.country_name ? { name: row.country_name } : null,
    bank_type: row.bank_type ?? null,
    account_type: row.account_type ?? null,
    branch_code: row.branch_code ?? null,
    branch_code_type: row.branch_code_type ?? null,
    short_name: row.short_name ?? null,
    iban_number: row.iban_number ?? null,
    swift_bic: row.swift_bic ?? null,
    currency: row.currency ?? "USD",
    account_status: row.account_status ?? null,
    state_province_id: row.state_province_id ?? null,
    district_id: row.district_id ?? null,
    city_id: row.city_id ?? null,
    full_address: row.full_address ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    remarks: row.remarks ?? null
  };
}

async function getBankById(id: string): Promise<LegacyBankRecord | null> {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql<BankRow[]>`
      SELECT
        b.id,
        b.account_code,
        b.owner_person_id,
        b.owner_company_id,
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "banks", action: "read" });

    let bank = await getBankById(id);
    if (!bank) throw new Error("Bank not found");
    if (!session.isSuperAdmin && bank.country_id && !session.countryIds.includes(bank.country_id)) {
      throw new Error("Not authorized");
    }
    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      [bank] = await localizeRecordFields<any>([bank], "banks", ["bank_name", "branch_name", "short_name", "account_title"], lang);
      [bank] = await localizeJoinedNames<any>([bank], lang, [{ idField: "country_id", nameField: "country_name", table: "countries" }]);
    }
    return apiOk({ bank });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "banks", action: "update" });

    const body = await request.json();
    const existing = await getBankById(id);
    if (!existing) throw new Error("Bank not found");
    if (!session.isSuperAdmin && existing.country_id && !session.countryIds.includes(existing.country_id)) {
      throw new Error("Not authorized");
    }

    const bank = await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.banks SET
          owner_person_id = COALESCE(${body.ownerPersonId !== undefined ? (body.ownerPersonId || null) : null}::uuid, owner_person_id),
          owner_company_id = COALESCE(${body.ownerCompanyId !== undefined ? (body.ownerCompanyId || null) : null}::uuid, owner_company_id),
          bank_type = COALESCE(${body.bankType ?? null}, bank_type),
          account_type = COALESCE(${body.accountType ?? null}, account_type),
          bank_name = COALESCE(${body.bankName ?? null}, bank_name),
          branch_name = COALESCE(${body.branchName ?? null}, branch_name),
          branch_code = COALESCE(${body.branchCode ?? body.bankCode ?? null}, branch_code),
          branch_code_type = COALESCE(${body.branchCodeType ?? null}, branch_code_type),
          short_name = COALESCE(${body.shortName ?? null}, short_name),
          account_title = COALESCE(${body.accountTitle ?? null}, account_title),
          account_number = COALESCE(${body.accountNumber ?? null}, account_number),
          iban_number = COALESCE(${body.ibanNumber ?? body.iban ?? null}, iban_number),
          swift_bic = COALESCE(${body.swiftBic ?? body.swiftCode ?? null}, swift_bic),
          currency = COALESCE(${body.currency ?? body.currencyCode ?? null}, currency),
          account_status = COALESCE(${body.accountStatus ?? null}, account_status),
          country_id = COALESCE(${body.countryId !== undefined ? (body.countryId || null) : null}::uuid, country_id),
          state_province_id = COALESCE(${body.stateProvinceId !== undefined ? (body.stateProvinceId || null) : null}::uuid, state_province_id),
          district_id = COALESCE(${body.districtId !== undefined ? (body.districtId || null) : null}::uuid, district_id),
          city_id = COALESCE(${body.cityId !== undefined ? (body.cityId || null) : null}::uuid, city_id),
          full_address = COALESCE(${body.fullAddress ?? null}, full_address),
          phone = COALESCE(${body.phone ?? null}, phone),
          email = COALESCE(${body.email ?? null}, email),
          website = COALESCE(${body.website ?? null}, website),
          remarks = COALESCE(${body.remarks ?? null}, remarks),
          is_active = COALESCE(${body.isActive !== undefined ? body.isActive : null}, is_active),
          updated_at = ${new Date().toISOString()}
        WHERE id = ${id}::uuid AND deleted_at IS NULL
      `;
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

    if (!bank) throw new Error("Bank not found");

    // Re-register the bank's names in all 5 languages after edit (honest engine).
    void syncRecordTranslations({
      table: "banks",
      recordId: id,
      record: bank as unknown as Record<string, unknown>,
      originalLanguage: session.preferredLanguage ?? "en",
      actorId: session.userId
    }).catch(() => {});

    // Bank edits were silently not reaching the central Edit History audit —
    // this route updates public.banks directly (no banks-service layer), so
    // the write has to happen here, matching the same call companies/customers/
    // goods already make from their own services.
    void writeRecordChangeHistory({
      recordTable: "banks",
      recordId: id,
      action: "update",
      actorId: session.userId,
      countryId: bank.country_id ?? existing.country_id ?? null,
      beforeData: existing,
      afterData: bank
    }).catch(() => {});

    return apiOk({ bank });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "banks", action: "delete" });

    const existing = await getBankById(id);
    if (!existing) throw new Error("Bank not found");
    if (!session.isSuperAdmin && existing.country_id && !session.countryIds.includes(existing.country_id)) {
      throw new Error("Not authorized");
    }

    await banksService.softDelete(id, session.userId);
    return apiOk({ message: "Deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
