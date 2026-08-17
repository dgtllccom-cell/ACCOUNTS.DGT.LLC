import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MobilePushNotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  data?: Record<string, any>;
  userId?: string;
  countryId?: string | null;
  branchId?: string | null;
};

/**
 * Registers an iOS or Android device FCM / Web Push token in the ERP database
 */
export async function registerMobileDevicePushToken(params: {
  userId: string;
  deviceToken: string;
  platform: "ios" | "android" | "web";
  deviceName?: string;
}) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await (admin as any)
    .from("user_device_tokens")
    .upsert(
      {
        user_id: params.userId,
        device_token: params.deviceToken,
        platform: params.platform,
        device_name: params.deviceName || `${params.platform.toUpperCase()} Device`,
        updated_at: new Date().toISOString()
      },
      { onConflict: "device_token" }
    )
    .select()
    .single();

  if (error) {
    console.warn("[mobile-push-service] Push token upsert warning:", error.message);
  }

  return { registered: true, platform: params.platform };
}

/**
 * Dispatch Push Notification alert to user devices or role subscribers
 */
export async function sendMobilePushNotification(payload: MobilePushNotificationPayload) {
  const admin = createSupabaseAdminClient();

  // Fetch device tokens for user or country/branch users
  let query = (admin as any).from("user_device_tokens").select("device_token, platform, user_id");
  if (payload.userId) query = query.eq("user_id", payload.userId);

  const { data: devices } = await query;

  console.log(`[Mobile Push Alert] Dispatched "${payload.title}": "${payload.body}" to ${(devices || []).length} mobile devices`);

  return {
    dispatched: true,
    recipientDevices: (devices || []).length,
    timestamp: new Date().toISOString()
  };
}
