import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MetaConfig = {
  token: string | null;
  phoneNumberId: string | null;
  wabaId: string;
  isConfigured: boolean;
};

/**
 * Resolves the server-wide default Meta WhatsApp Cloud API credentials.
 * Checks environment variables first, then checks database system accounts.
 */
export async function getSystemMetaConfig(): Promise<MetaConfig> {
  let token = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
  let phoneNumberId = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || "154760354377649";
  let wabaId = process.env.META_WABA_ID || process.env.WHATSAPP_WABA_ID || "335626955041488";

  const isRealToken = (t: string | null) => t && t.length > 20 && !t.includes("SECURE_TOKEN");
  const isRealPnid = (p: string | null) => p && p.length > 5 && !p.startsWith("PNID-");

  if (isRealToken(token) && isRealPnid(phoneNumberId)) {
    return { token, phoneNumberId, wabaId, isConfigured: true };
  }

  // Fall back to checking active accounts in database
  try {
    const admin = createSupabaseAdminClient();
    const { data: accounts } = await admin
      .from("whatsapp_accounts")
      .select("phone_number_id, access_token, waba_id")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (accounts && accounts.length > 0) {
      const activeAcc = accounts.find(a => isRealToken(a.access_token) && isRealPnid(a.phone_number_id));
      if (activeAcc) {
        token = activeAcc.access_token;
        phoneNumberId = activeAcc.phone_number_id;
        wabaId = activeAcc.waba_id || wabaId;
        return { token, phoneNumberId, wabaId, isConfigured: true };
      }
    }
  } catch (e) {
    console.warn("[Meta Config Lookup Warning]:", e);
  }

  return { token: null, phoneNumberId: null, wabaId, isConfigured: false };
}
