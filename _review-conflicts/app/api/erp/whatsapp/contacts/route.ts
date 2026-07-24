import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/erp/whatsapp/contacts?phone=+971...&countryId=...
 *
 * Look up a WhatsApp contact by phone number and return linked ERP data:
 * - Customer info (name, balance stub, recent orders)
 * - Supplier info
 * - Assigned conversations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "read" });

    const { searchParams } = request.nextUrl;
    const phone = searchParams.get("phone");
    const countryId = searchParams.get("countryId");

    if (!phone) return apiOk({ contact: null, erpCustomer: null });

    const supabase = await createServerSupabaseClient();

    // Normalize phone for search
    const digits = phone.replace(/\D/g, "").slice(-10);

    // 1. Look up WhatsApp contact
    const { data: contact } = await (supabase as any)
      .from("whatsapp_contacts")
      .select("id, phone_number, wa_profile_name, display_name, customer_id, labels, notes, last_seen_at")
      .ilike("phone_number", `%${digits}`)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    // 2. Look up ERP customer by mobile/whatsapp
    const { data: customers } = await (supabase as any)
      .from("customers")
      .select(`
        id, customer_name, company_name, mobile, whatsapp, email, address,
        country_id, notes,
        countries:country_id(name)
      `)
      .or(`mobile.ilike.%${digits},whatsapp.ilike.%${digits}`)
      .is("deleted_at", null)
      .limit(3);

    const erpCustomer = customers?.[0] ?? null;

    // 3. If customer found and contact exists, update the link
    if (erpCustomer && contact && !contact.customer_id) {
      await (supabase as any)
        .from("whatsapp_contacts")
        .update({ customer_id: erpCustomer.id, display_name: erpCustomer.customer_name })
        .eq("id", contact.id);
    }

    return apiOk({ contact, erpCustomer, allMatches: customers ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
