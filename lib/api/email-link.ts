import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function linkEmailAccount(options: {
  countryId: string;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  scope: "country" | "country_branch" | "city_branch";
  displayName: string;
  emailAddress: string;
  adminEmail?: string | null;
  isActive?: boolean;
  settings?: any;
}) {
  const supabase = createSupabaseAdminClient() as any;
  const emailLower = options.emailAddress.trim().toLowerCase();

  // Resolve default email provider (from email domain or default)
  const domain = emailLower.split("@")[1] || "dgt.llc";
  const { data: provider } = await supabase
    .from("erp_email_providers")
    .select("id")
    .eq("domain", domain)
    .is("deleted_at", null)
    .maybeSingle();

  let providerId = provider?.id;
  if (!providerId) {
    const { data: defaultProvider } = await supabase
      .from("erp_email_providers")
      .select("id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    providerId = defaultProvider?.id || null;
  }

  // Check if email account already exists
  const { data: existing } = await supabase
    .from("erp_email_accounts")
    .select("id")
    .eq("email_address", emailLower)
    .is("deleted_at", null)
    .maybeSingle();

  const payload = {
    country_id: options.countryId,
    country_branch_id: options.countryBranchId || null,
    city_branch_id: options.cityBranchId || null,
    provider_id: providerId,
    scope: options.scope,
    display_name: options.displayName.trim(),
    email_address: emailLower,
    admin_email: options.adminEmail ? options.adminEmail.trim().toLowerCase() : null,
    cc_super_admin: true,
    cc_country_admin: true,
    is_active: options.isActive !== false,
    settings: options.settings || {},
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("erp_email_accounts")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase
      .from("erp_email_accounts")
      .insert({
        ...payload,
        created_at: new Date().toISOString()
      });
    if (insertError) throw new Error(insertError.message);
  }
}
