import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";

export type SenderInfo = {
  type: "customer" | "supplier" | "employee" | "transporter" | "agent" | "unknown";
  id: string | null;
  name: string;
  countryId: string | null;
  cityBranchId: string | null;
  email?: string | null;
  mobile?: string | null;
};

/**
 * Searches the ERP contact database (Customers, Suppliers, Employees, Users, Branch Contacts)
 * to resolve the identity of an incoming WhatsApp number or Email address.
 */
export async function resolveContactFromIdentifier(identifier: string): Promise<SenderInfo> {
  const admin = createSupabaseAdminClient();
  const clean = identifier.trim().toLowerCase();
  const isEmail = clean.includes("@");
  const cleanPhone = clean.replace(/[^0-9]/g, "");

  // 1. Check Customers
  let custQuery = admin
    .from("customers")
    .select("id, customer_name, company_name, email, mobile, whatsapp, country_id, city_id")
    .is("deleted_at", null);

  if (isEmail) {
    custQuery = custQuery.ilike("email", clean);
  } else if (cleanPhone) {
    custQuery = custQuery.or(`mobile.ilike.%${cleanPhone}%,whatsapp.ilike.%${cleanPhone}%`);
  }

  const { data: custRows } = await custQuery.limit(1);
  if (custRows && custRows.length > 0) {
    const c = custRows[0];
    return {
      type: "customer",
      id: c.id,
      name: c.customer_name || c.company_name || "Customer",
      countryId: c.country_id,
      cityBranchId: c.city_id,
      email: c.email,
      mobile: c.mobile || c.whatsapp
    };
  }

  // 2. Check Employees / User Profiles
  let userQuery = (admin as any)
    .from("profiles")
    .select("id, full_name, email, phone_number")
    .limit(1);

  if (isEmail) {
    userQuery = userQuery.ilike("email", clean);
  } else if (cleanPhone) {
    userQuery = userQuery.ilike("phone_number", `%${cleanPhone}%`);
  }

  const { data: userRows } = await userQuery;
  if (userRows && userRows.length > 0) {
    const u = userRows[0] as any;
    return {
      type: "employee",
      id: u.id,
      name: u.full_name || u.email || "Employee",
      countryId: null,
      cityBranchId: null,
      email: u.email,
      mobile: u.phone_number
    };
  }

  // 3. Fallback: Unknown sender
  return {
    type: "unknown",
    id: null,
    name: isEmail ? clean.split("@")[0] : identifier,
    countryId: null,
    cityBranchId: null,
    email: isEmail ? clean : null,
    mobile: !isEmail ? identifier : null
  };
}

/**
 * Searches live ERP records (PO, SO, Invoice, Roznamcha, Ledger, Loading) to link a conversation
 */
export async function findRelatedErpRecord(queryText: string, countryId?: string | null): Promise<{
  entityType: string | null;
  entityId: string | null;
  referenceNo: string | null;
  summaryText: string | null;
}> {
  const admin = createSupabaseAdminClient();
  const q = queryText.trim();
  if (!q) return { entityType: null, entityId: null, referenceNo: null, summaryText: null };

  // Search Purchase Orders
  const { data: pos } = await (admin as any)
    .from("purchase_orders")
    .select("id, po_number, total_amount, currency, status, remaining_amount")
    .or(`po_number.ilike.%${q}%,id.eq.${q}`)
    .is("deleted_at", null)
    .limit(1);

  if (pos && pos.length > 0) {
    const po = pos[0] as any;
    return {
      entityType: "purchase_order",
      entityId: po.id,
      referenceNo: po.po_number || po.id?.slice(0, 8),
      summaryText: `Purchase Order ${po.po_number || po.id?.slice(0, 8)} (${po.currency || "AED"} ${po.total_amount || 0}, Remaining: ${po.remaining_amount || 0}, Status: ${po.status})`
    };
  }

  // Search Sales Orders
  const { data: sos } = await (admin as any)
    .from("sales_orders")
    .select("id, order_number, total_amount, currency, status")
    .or(`order_number.ilike.%${q}%,id.eq.${q}`)
    .is("deleted_at", null)
    .limit(1);

  if (sos && sos.length > 0) {
    const so = sos[0] as any;
    return {
      entityType: "sales_order",
      entityId: so.id,
      referenceNo: so.order_number || so.id?.slice(0, 8),
      summaryText: `Sales Order ${so.order_number || so.id?.slice(0, 8)} (${so.currency || "AED"} ${so.total_amount || 0}, Status: ${so.status})`
    };
  }

  // Search Roznamcha Entries
  const { data: roz } = await (admin as any)
    .from("roznamcha_entries")
    .select("id, journal_no, voucher_no, narration, status")
    .or(`journal_no.ilike.%${q}%,voucher_no.ilike.%${q}%,id.eq.${q}`)
    .is("deleted_at", null)
    .limit(1);

  if (roz && roz.length > 0) {
    const r = roz[0] as any;
    return {
      entityType: "roznamcha",
      entityId: r.id,
      referenceNo: r.journal_no || r.voucher_no || r.id?.slice(0, 8),
      summaryText: `Roznamcha ${r.journal_no || r.voucher_no} (${r.narration || "Entry"}, Status: ${r.status})`
    };
  }

  return { entityType: null, entityId: null, referenceNo: null, summaryText: null };
}

/**
 * Gets or creates a conversation thread for a contact
 */
export async function getOrCreateConversation(params: {
  channel: "whatsapp" | "email";
  contactIdentifier: string;
  senderName?: string;
  countryId?: string | null;
  cityBranchId?: string | null;
  initialMessageText?: string;
}) {
  const admin = createSupabaseAdminClient();
  const cleanId = params.contactIdentifier.trim().toLowerCase();

  // Try fetching existing conversation
  const { data: existing } = await admin
    .from("communication_conversations")
    .select("*")
    .eq("contact_identifier", cleanId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Resolve contact details from ERP database
  const contactInfo = await resolveContactFromIdentifier(cleanId);

  // Link ERP record if matching reference number found in text
  let relatedType = null;
  let relatedId = null;
  if (params.initialMessageText) {
    const recordLink = await findRelatedErpRecord(params.initialMessageText, params.countryId);
    relatedType = recordLink.entityType;
    relatedId = recordLink.entityId;
  }

  const { data: created, error } = await admin
    .from("communication_conversations")
    .insert({
      channel: params.channel,
      contact_identifier: cleanId,
      sender_name: params.senderName || contactInfo.name,
      sender_type: contactInfo.type,
      sender_entity_id: contactInfo.id,
      country_id: params.countryId || contactInfo.countryId || null,
      city_branch_id: params.cityBranchId || contactInfo.cityBranchId || null,
      related_entity_type: relatedType,
      related_entity_id: relatedId,
      status: "unread",
      priority: "normal",
      message_language: "en",
      reply_mode: "manual",
      last_message_text: params.initialMessageText || "",
      last_message_at: new Date().toISOString(),
      unread_count: 1
    })
    .select()
    .single();

  if (error) {
    console.warn("[return-sms-reply] Failed to create conversation record:", error.message);
    // Fallback object if table not yet migrated
    return {
      id: `conv-${Date.now()}`,
      channel: params.channel,
      contact_identifier: cleanId,
      sender_name: params.senderName || contactInfo.name,
      sender_type: contactInfo.type,
      sender_entity_id: contactInfo.id,
      country_id: params.countryId || contactInfo.countryId || null,
      city_branch_id: params.cityBranchId || contactInfo.cityBranchId || null,
      related_entity_type: relatedType,
      related_entity_id: relatedId,
      status: "unread",
      priority: "normal",
      message_language: "en",
      reply_mode: "manual",
      last_message_text: params.initialMessageText || "",
      last_message_at: new Date().toISOString(),
      unread_count: 1,
      assigned_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  return created;
}
