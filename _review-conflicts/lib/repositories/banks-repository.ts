import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class BanksRepository {
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    limit?: number;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

    let query = supabase
      .from("banks")
      .select(
        "id, bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type, short_name, account_title, account_number, iban_number, currency, account_status, country_id, state_province_id, district_id, city_id, full_address, phone, email, swift_bic, website, remarks, is_active, created_at, updated_at"
      )
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("bank_name", { ascending: true });

    if (input.countryId) query = query.eq("country_id", input.countryId);

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
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
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("banks")
      .select(
        "id, bank_type, account_type, bank_name, branch_name, branch_code, branch_code_type, short_name, account_title, account_number, iban_number, currency, account_status, country_id, state_province_id, district_id, city_id, full_address, phone, email, swift_bic, website, remarks, is_active, created_at, updated_at"
      )
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
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("banks")
      .insert({
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
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
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
  }>) {
    const supabase = createSupabaseAdminClient() as any;
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

    const { error } = await supabase.from("banks").update(patch).eq("id", id).is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("banks")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const banksRepository = new BanksRepository();
