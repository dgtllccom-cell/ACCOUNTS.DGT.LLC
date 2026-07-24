import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { v4 as uuidv4 } from 'uuid';

/**
 * HierarchyService
 * Centralizes the creation of Countries, Branches, and City Branches.
 * Enforces Requirement 2, 3, 4, 5 by automatically generating scopes and logins.
 */
export class HierarchyService {
  /**
   * Determines the logical division of a branch based on its name or configuration.
   * This allows running the Clearing Agent/Shipping Line division alongside Trading
   * on the same architecture without duplicate ERP installations.
   */
  static getBranchDivision(branchName: string | null | undefined): "clearing" | "trading" {
    if (!branchName) return "trading";
    const lower = branchName.toLowerCase();
    if (lower.includes("clearing") || lower.includes("shipping") || lower.includes("logistics")) {
      return "clearing";
    }
    return "trading";
  }

  /**
   * Helper to create a new user profile and assign a role/scope.
   */
  private static async createAdminProfile(
    email: string,
    fullName: string,
    role: EnterpriseRole,
    scope: { countryId?: string; countryBranchId?: string; cityBranchId?: string }
  ) {
    const supabase = createSupabaseAdminClient();
    
    // 1. Create Auth User
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: "ChangeMe123!", // Temporary password, should ideally trigger a reset email
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError || !authUser.user) {
      throw new Error(`Failed to create admin auth user: ${authError?.message}`);
    }

    const userId = authUser.user.id;

    // 2. Insert Profile
    await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 3. Assign Role and Scope
    await supabase.from("user_role_assignments").insert({
      user_id: userId,
      role: role,
      country_id: scope.countryId || null,
      country_branch_id: scope.countryBranchId || null,
      city_branch_id: scope.cityBranchId || null,
      is_active: true
    });

    return userId;
  }

  /**
   * Requirement 3: Country Creation Logic
   */
  static async createCountry(name: string, iso2: string, currencyCode: string) {
    const supabase = createSupabaseAdminClient();

    // 1. Create Country
    const { data: country, error: countryError } = await supabase
      .from("countries")
      .insert({ name, iso2, currency_code: currencyCode, is_active: true })
      .select("id")
      .single();

    if (countryError || !country) {
      throw new Error(`Failed to create country: ${countryError?.message}`);
    }

    // 2. Automatically generate Country Login & Scope
    const adminEmail = `admin@${iso2.toLowerCase()}.dgt.local`; // Example convention
    await this.createAdminProfile(
      adminEmail, 
      `${name} Admin`, 
      "country_admin", 
      { countryId: country.id }
    );

    return country.id;
  }

  /**
   * Requirement 4: Branch Creation Logic
   */
  static async createCountryBranch(countryId: string, name: string, code: string, localCurrency: string) {
    const supabase = createSupabaseAdminClient();

    const { data: branch, error } = await supabase
      .from("country_branches")
      .insert({ country_id: countryId, name, code, local_currency: localCurrency, is_main: false })
      .select("id")
      .single();

    if (error || !branch) {
      throw new Error(`Failed to create branch: ${error?.message}`);
    }

    // Automatically generate Branch Login & Scope
    const adminEmail = `branch_${code.toLowerCase()}@dgt.local`;
    await this.createAdminProfile(
      adminEmail,
      `${name} Main Branch Admin`,
      "main_branch_admin",
      { countryId, countryBranchId: branch.id }
    );

    return branch.id;
  }

  /**
   * Requirement 5: City Branch Creation Logic
   */
  static async createCityBranch(countryId: string, countryBranchId: string, cityName: string, name: string, code: string, localCurrency: string) {
    const supabase = createSupabaseAdminClient();

    const { data: cityBranch, error } = await supabase
      .from("city_branches")
      .insert({ country_id: countryId, country_branch_id: countryBranchId, city_name: cityName, name, code, local_currency: localCurrency })
      .select("id")
      .single();

    if (error || !cityBranch) {
      throw new Error(`Failed to create city branch: ${error?.message}`);
    }

    // Automatically generate City Branch Login & Scope
    const adminEmail = `city_${code.toLowerCase()}@dgt.local`;
    await this.createAdminProfile(
      adminEmail,
      `${name} City Admin`,
      "city_branch_admin",
      { countryId, countryBranchId, cityBranchId: cityBranch.id }
    );

    return cityBranch.id;
  }
}
