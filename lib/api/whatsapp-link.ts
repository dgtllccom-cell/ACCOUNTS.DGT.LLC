import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function linkWhatsAppAccount(options: {
  countryId: string;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  scope: "country" | "country_branch" | "city_branch";
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  isActive?: boolean;
}) {
  const supabase = createSupabaseAdminClient() as any;
  const phone = options.phoneNumber.trim();

  const { data: existing } = await supabase
    .from("whatsapp_accounts")
    .select("id")
    .eq("phone_number_id", options.phoneNumberId)
    .is("deleted_at", null)
    .maybeSingle();

  const payload = {
    country_id: options.countryId,
    country_branch_id: options.countryBranchId || null,
    city_branch_id: options.cityBranchId || null,
    scope: options.scope,
    display_name: options.displayName.trim(),
    phone_number: phone,
    phone_number_id: options.phoneNumberId.trim(),
    waba_id: options.wabaId.trim(),
    access_token: options.accessToken.trim(),
    is_active: options.isActive !== false,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("whatsapp_accounts")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase
      .from("whatsapp_accounts")
      .insert({
        ...payload,
        created_at: new Date().toISOString()
      });
    if (insertError) throw new Error(insertError.message);
  }
}
