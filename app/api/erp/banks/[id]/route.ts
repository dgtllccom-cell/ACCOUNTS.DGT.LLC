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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    authorizeApiScope(session, { resource: "banks", action: "read" });

    const bank = await getBankById(id);
    if (!bank) throw new Error("Bank not found");
    if (!session.isSuperAdmin && bank.country_id && !session.countryIds.includes(bank.country_id)) {
      throw new Error("Not authorized");
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
          bank_name = COALESCE(${body.bankName ?? null}, bank_name),
          branch_name = COALESCE(${body.branchName ?? null}, branch_name),
          branch_code = COALESCE(${body.bankCode ?? null}, branch_code),
          account_title = COALESCE(${body.accountTitle ?? null}, account_title),
          account_number = COALESCE(${body.accountNumber ?? null}, account_number),
          iban_number = COALESCE(${body.iban ?? null}, iban_number),
          swift_bic = COALESCE(${body.swiftCode ?? null}, swift_bic),
          currency = COALESCE(${body.currencyCode ?? null}, currency),
          account_status = COALESCE(${body.accountStatus ?? null}, account_status),
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

    await withLocalPg(async (sql) => {
      await sql`UPDATE public.banks SET deleted_at = ${new Date().toISOString()}, updated_at = ${new Date().toISOString()}, is_active = false WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    return apiOk({ message: "Deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
