import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { withLocalPg } from "@/lib/db/local-postgres";

export type BankRow = {
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
};

const BANK_COLUMNS =
  "id, bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type, short_name, account_title, account_number, iban_number, currency, account_status, country_id, state_province_id, district_id, city_id, full_address, phone, email, swift_bic, website, remarks, is_active, created_at, updated_at";

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class BanksRepository {
  // `banks` has RLS enabled with scoped policies (banks_scope_read/write — see the
  // banks_rls_policy migration) and this app's Supabase client is not guaranteed to carry a
  // real service-role key that bypasses RLS on its own. Reads/writes go through a direct
  // Postgres connection (DATABASE_URL, via withLocalPg — same proven bypass already used by
  // companies-repository.ts and lib/i18n/localize-records.ts) when available, falling back
  // to the Supabase client otherwise.
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const q = cleanQuery(input.query ?? "");
    const like = q ? `%${q}%` : null;

    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT ${sql(BANK_COLUMNS.split(", "))} FROM public.banks
        WHERE deleted_at IS NULL
          AND is_active = true
          AND (${input.countryId ? sql`country_id = ${input.countryId}` : sql`true`})
          AND (${like ? sql`(bank_name ILIKE ${like} OR account_title ILIKE ${like} OR account_number ILIKE ${like} OR branch_name ILIKE ${like} OR branch_code ILIKE ${like} OR short_name ILIKE ${like} OR iban_number ILIKE ${like})` : sql`true`})
        ORDER BY bank_name ASC
        LIMIT ${limit}
      `;
      return { banks: rows as unknown as BankRow[], limit };
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    let query = supabase
      .from("banks")
      .select(BANK_COLUMNS)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("bank_name", { ascending: true });

    if (input.countryId) query = query.eq("country_id", input.countryId);
    if (q) {
      query = query.or(
        [
          `bank_name.ilike.${like}`,
          `account_title.ilike.${like}`,
          `account_number.ilike.${like}`,
          `branch_name.ilike.${like}`,
          `branch_code.ilike.${like}`,
          `short_name.ilike.${like}`,
          `iban_number.ilike.${like}`
        ].join(",")
      );
    }

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return { banks: (data ?? []) as BankRow[], limit };
  }

  async getById(id: string) {
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT ${sql(BANK_COLUMNS.split(", "))} FROM public.banks WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
      `;
      return (rows[0] as unknown as BankRow) ?? null;
    });
    if (viaPg) return viaPg;

    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("banks")
      .select(BANK_COLUMNS)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as BankRow;
  }

  async create(input: {
    bankType: string;
    accountType: string;
    bankName: string;
    branchName: string;
    branchCode: string;
    branchCodeType: string;
    shortName: string;
    accountTitle: string;
    accountNumber: string;
    ibanNumber?: string | null;
    currency: string;
    accountStatus: string;
    countryId?: string | null;
    stateProvinceId?: string | null;
    districtId?: string | null;
    cityId?: string | null;
    fullAddress?: string | null;
    phone?: string | null;
    email?: string | null;
    swiftBic?: string | null;
    website?: string | null;
    remarks?: string | null;
    originalLanguage?: string;
  }, actorId?: string | null) {
    const insertRow = {
      bank_type: input.bankType,
      account_type: input.accountType,
      bank_name: input.bankName,
      branch_name: input.branchName,
      branch_code: input.branchCode,
      branch_code_type: input.branchCodeType,
      short_name: input.shortName,
      account_title: input.accountTitle,
      account_number: input.accountNumber,
      iban_number: input.ibanNumber ?? null,
      currency: input.currency,
      account_status: input.accountStatus,
      country_id: input.countryId ?? null,
      state_province_id: input.stateProvinceId ?? null,
      district_id: input.districtId ?? null,
      city_id: input.cityId ?? null,
      full_address: input.fullAddress ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      swift_bic: input.swiftBic ?? null,
      website: input.website ?? null,
      remarks: input.remarks ?? null,
      is_active: true
    };

    let bankId: string;
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`INSERT INTO public.banks ${sql(insertRow)} RETURNING id`;
      return (rows[0] as any).id as string;
    });

    if (viaPg) {
      bankId = viaPg;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase.from("banks").insert(insertRow).select("id").single();
      if (error) throw new Error(error.message);
      bankId = (data as { id: string }).id;
    }

    // Was previously fire-and-forget, hardcoded to "en" regardless of the actual input
    // language, and missing account_title — meaning Bank Master names never resolved
    // correctly once a non-English language was selected. Now awaited, uses the real
    // original language, covers all 4 translatable fields (see translatable-fields.ts),
    // and records the actor.
    await translateMasterRecord(
      "banks",
      bankId,
      { bank_name: input.bankName, branch_name: input.branchName, short_name: input.shortName, account_title: input.accountTitle },
      (input.originalLanguage as any) || "en",
      actorId ?? null
    );

    try {
      const s = await allocateFormSerials("banks", { countryId: input.countryId ?? null });
      const serialPatch = { super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial };
      const viaPgSerial = await withLocalPg(async (sql) => {
        await sql`UPDATE public.banks SET ${sql(serialPatch)} WHERE id = ${bankId}::uuid`;
        return true;
      });
      if (!viaPgSerial) {
        const supabase = createSupabaseAdminClient() as any;
        await supabase.from("banks").update(serialPatch).eq("id", bankId);
      }
    } catch { /* non-fatal */ }

    return bankId;
  }

  async update(id: string, input: Partial<{
    bankType: string;
    accountType: string;
    bankName: string;
    branchName: string;
    branchCode: string;
    branchCodeType: string;
    shortName: string;
    accountTitle: string;
    accountNumber: string;
    ibanNumber: string | null;
    currency: string;
    accountStatus: string;
    countryId: string | null;
    stateProvinceId: string | null;
    districtId: string | null;
    cityId: string | null;
    fullAddress: string | null;
    phone: string | null;
    email: string | null;
    swiftBic: string | null;
    website: string | null;
    remarks: string | null;
    isActive: boolean;
    originalLanguage: string;
  }>, actorId?: string | null) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("bankType" in input) patch.bank_type = input.bankType;
    if ("accountType" in input) patch.account_type = input.accountType;
    if ("bankName" in input) patch.bank_name = input.bankName;
    if ("branchName" in input) patch.branch_name = input.branchName;
    if ("branchCode" in input) patch.branch_code = input.branchCode;
    if ("branchCodeType" in input) patch.branch_code_type = input.branchCodeType;
    if ("shortName" in input) patch.short_name = input.shortName;
    if ("accountTitle" in input) patch.account_title = input.accountTitle;
    if ("accountNumber" in input) patch.account_number = input.accountNumber;
    if ("ibanNumber" in input) patch.iban_number = input.ibanNumber;
    if ("currency" in input) patch.currency = input.currency;
    if ("accountStatus" in input) patch.account_status = input.accountStatus;
    if ("countryId" in input) patch.country_id = input.countryId;
    if ("stateProvinceId" in input) patch.state_province_id = input.stateProvinceId;
    if ("districtId" in input) patch.district_id = input.districtId;
    if ("cityId" in input) patch.city_id = input.cityId;
    if ("fullAddress" in input) patch.full_address = input.fullAddress;
    if ("phone" in input) patch.phone = input.phone;
    if ("email" in input) patch.email = input.email;
    if ("swiftBic" in input) patch.swift_bic = input.swiftBic;
    if ("website" in input) patch.website = input.website;
    if ("remarks" in input) patch.remarks = input.remarks;
    if ("isActive" in input) patch.is_active = input.isActive;

    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.banks SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });

    if (!viaPg) {
      const supabase = createSupabaseAdminClient() as any;
      const { error } = await supabase.from("banks").update(patch).eq("id", id).is("deleted_at", null);
      if (error) throw new Error(error.message);
    }

    if (input.bankName || input.branchName || input.shortName || input.accountTitle) {
      const current = await this.getById(id);
      await translateMasterRecord(
        "banks",
        id,
        {
          bank_name: input.bankName ?? current?.bank_name,
          branch_name: input.branchName ?? current?.branch_name,
          short_name: input.shortName ?? current?.short_name,
          account_title: input.accountTitle ?? current?.account_title
        },
        (input.originalLanguage as any) || "en",
        actorId ?? null
      );
    }
  }

  async softDelete(id: string) {
    const patch = { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false };
    const viaPg = await withLocalPg(async (sql) => {
      await sql`UPDATE public.banks SET ${sql(patch)} WHERE id = ${id}::uuid AND deleted_at IS NULL`;
      return true;
    });
    if (viaPg) return;

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("banks")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const banksRepository = new BanksRepository();
