/**
 * /api/whatsapp/webhook
 *
 * Handles Meta WhatsApp Cloud API webhook:
 *   GET  — webhook verification (hub.challenge handshake)
 *   POST — incoming events (messages, status updates, media)
 *
 * Uses Supabase Admin client to bypass RLS — the webhook has no user session.
 * All data is scoped by matching the phone_number_id to the whatsapp_accounts table.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN ?? "";
const APP_SECRET = process.env.META_WHATSAPP_APP_SECRET ?? "";

// ─── GET: Webhook verification ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("[WhatsApp Webhook] Verified successfully");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WhatsApp Webhook] Verification failed", { mode, token });
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: Incoming webhook events ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Verify HMAC signature
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256") ?? "")) {
    console.warn("[WhatsApp Webhook] Invalid signature");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // 2. Process asynchronously — return 200 immediately per Meta requirements
  processWebhookPayload(payload).catch((err) => {
    console.error("[WhatsApp Webhook] Processing error:", err);
  });

  return new NextResponse("OK", { status: 200 });
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(body: string, signature: string): boolean {
  if (!APP_SECRET) return true; // Dev mode: skip if secret not configured
  if (!signature.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(`sha256=${expected}`), Buffer.from(signature));
}

// ─── Main payload processor ───────────────────────────────────────────────────

async function processWebhookPayload(payload: MetaWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") return;

  const supabase = createSupabaseAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      // Resolve the WhatsApp account from phone_number_id
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: account } = await supabase
        .from("whatsapp_accounts")
        .select("id, country_id, country_branch_id, city_branch_id, is_active")
        .eq("phone_number_id", phoneNumberId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!account || !account.is_active) {
        console.warn("[WhatsApp Webhook] Unknown or inactive phone_number_id:", phoneNumberId);
        continue;
      }

      const scopeCols = {
        country_id: account.country_id,
        country_branch_id: account.country_branch_id,
        city_branch_id: account.city_branch_id,
        whatsapp_account_id: account.id
      };

      // Process messages
      for (const msg of value.messages ?? []) {
        await processInboundMessage(supabase, scopeCols, msg, value.contacts?.[0]);
      }

      // Process status updates
      for (const status of value.statuses ?? []) {
        await processStatusUpdate(supabase, status);
      }
    }
  }
}

// ─── Inbound message processor ────────────────────────────────────────────────

async function processInboundMessage(
  supabase: any,
  scope: ScopeColumns,
  msg: MetaMessage,
  contactInfo?: MetaContact
) {
  const phoneNumber = normalizePhone(msg.from);

  // 1. Upsert contact
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .upsert(
      {
        whatsapp_account_id: scope.whatsapp_account_id,
        country_id: scope.country_id,
        country_branch_id: scope.country_branch_id,
        city_branch_id: scope.city_branch_id,
        phone_number: phoneNumber,
        wa_profile_name: contactInfo?.profile?.name ?? null,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "whatsapp_account_id,phone_number", ignoreDuplicates: false }
    )
    .select("id, customer_id")
    .maybeSingle();

  if (!contact) return;

  // Try to link to ERP customer by phone if not already linked
  if (!contact.customer_id) {
    await tryLinkErpCustomer(supabase, contact.id, phoneNumber, scope.country_id);
  }

  // 2. Upsert conversation
  const { data: conversation } = await supabase
    .from("whatsapp_conversations")
    .upsert(
      {
        whatsapp_account_id: scope.whatsapp_account_id,
        contact_id: contact.id,
        country_id: scope.country_id,
        country_branch_id: scope.country_branch_id,
        city_branch_id: scope.city_branch_id,
        status: "open"
      },
      { onConflict: "whatsapp_account_id,contact_id", ignoreDuplicates: false }
    )
    .select("id")
    .maybeSingle();

  if (!conversation) return;

  // 3. Deduplicate by wamid
  const { count } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("external_message_id", msg.id);

  if ((count ?? 0) > 0) return; // Already processed

  // 4. Build message record
  const messageRecord = buildMessageRecord(scope, conversation.id, msg);

  await supabase.from("whatsapp_messages").insert(messageRecord);
}

function buildMessageRecord(scope: ScopeColumns, conversationId: string, msg: MetaMessage) {
  const msgType = detectMessageType(msg);
  let body: string | null = null;
  let mediaUrl: string | null = null;
  let mediaMime: string | null = null;

  if (msg.text) body = msg.text.body;
  if (msg.image) { body = msg.image.caption ?? null; mediaMime = "image/jpeg"; }
  if (msg.document) { body = msg.document.caption ?? msg.document.filename ?? null; mediaMime = msg.document.mime_type ?? null; }
  if (msg.audio) { mediaMime = msg.audio.mime_type ?? "audio/ogg"; }
  if (msg.video) { body = msg.video.caption ?? null; mediaMime = msg.video.mime_type ?? "video/mp4"; }
  if (msg.sticker) { mediaMime = "image/webp"; }

  return {
    conversation_id: conversationId,
    whatsapp_account_id: scope.whatsapp_account_id,
    country_id: scope.country_id,
    country_branch_id: scope.country_branch_id,
    city_branch_id: scope.city_branch_id,
    direction: "inbound",
    message_type: msgType,
    status: "delivered",
    body,
    media_mime_type: mediaMime,
    media_url: mediaUrl,
    external_message_id: msg.id,
    context_message_id: msg.context?.id ?? null,
    sender_phone: normalizePhone(msg.from),
    raw_payload: msg,
    sent_at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString()
  };
}

// ─── Status update processor ──────────────────────────────────────────────────

async function processStatusUpdate(supabase: any, status: MetaStatus) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status.status === "delivered") {
    update.status = "delivered";
    update.delivered_at = new Date(Number(status.timestamp) * 1000).toISOString();
  } else if (status.status === "read") {
    update.status = "read";
    update.read_at = new Date(Number(status.timestamp) * 1000).toISOString();
  } else if (status.status === "failed") {
    update.status = "failed";
    update.failed_at = new Date(Number(status.timestamp) * 1000).toISOString();
    update.failed_reason = status.errors?.[0]?.message ?? "Unknown error";
  }

  await supabase
    .from("whatsapp_messages")
    .update(update)
    .eq("external_message_id", status.id);
}

// ─── ERP customer linking ─────────────────────────────────────────────────────

async function tryLinkErpCustomer(
  supabase: any,
  contactId: string,
  phoneNumber: string,
  countryId: string | null
) {
  // Strip leading + and country codes for fuzzy matching
  const digits = phoneNumber.replace(/\D/g, "").slice(-10);

  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_name")
    .or(`mobile.ilike.%${digits},whatsapp.ilike.%${digits}`)
    .eq("country_id", countryId ?? "")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (customer) {
    await supabase
      .from("whatsapp_contacts")
      .update({ customer_id: customer.id, display_name: customer.customer_name })
      .eq("id", contactId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function detectMessageType(msg: MetaMessage): string {
  if (msg.text) return "text";
  if (msg.image) return "image";
  if (msg.document) return "document";
  if (msg.audio) return "audio";
  if (msg.video) return "video";
  if (msg.sticker) return "sticker";
  if (msg.location) return "location";
  if (msg.contacts) return "contact";
  if (msg.reaction) return "reaction";
  return "unknown";
}

// ─── Meta API Types ───────────────────────────────────────────────────────────

type ScopeColumns = {
  whatsapp_account_id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
};

type MetaWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: MetaChangeValue;
    }>;
  }>;
};

type MetaChangeValue = {
  metadata?: { phone_number_id: string; display_phone_number: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
};

type MetaContact = {
  profile?: { name: string };
  wa_id: string;
};

type MetaMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  context?: { id: string; from: string };
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  sticker?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: unknown[];
  reaction?: { message_id: string; emoji: string };
};

type MetaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; message: string }>;
};
