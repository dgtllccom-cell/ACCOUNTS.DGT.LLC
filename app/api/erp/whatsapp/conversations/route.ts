import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "read" });

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");           // open|assigned|resolved|spam|all
    const accountId = searchParams.get("accountId");
    const assignedUserId = searchParams.get("assignedUserId");
    const countryId = searchParams.get("countryId");
    const cityBranchId = searchParams.get("cityBranchId");
    const search = searchParams.get("search");
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 25)));
    const offset = (page - 1) * limit;

    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("whatsapp_conversations")
      .select(`
        id, status, unread_count, last_message_text, last_message_at, last_message_dir,
        labels, created_at, updated_at,
        whatsapp_accounts:whatsapp_account_id(id, display_name, phone_number),
        whatsapp_contacts:contact_id(
          id, phone_number, wa_profile_name, display_name, customer_id, labels
        ),
        assigned_profiles:assigned_user_id(id, full_name),
        countries:country_id(id, name),
        city_branches:city_branch_id(id, name, city_name)
      `, { count: "exact" })
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Scope filters
    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length > 0) {
        query = query.in("city_branch_id", session.cityBranchIds);
      } else if (session.countryIds.length > 0) {
        query = query.in("country_id", session.countryIds);
      }
    }

    // Optional filters
    if (status && status !== "all") query = query.eq("status", status);
    if (accountId) query = query.eq("whatsapp_account_id", accountId);
    if (assignedUserId) query = query.eq("assigned_user_id", assignedUserId);
    if (countryId) query = query.eq("country_id", countryId);
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Client-side search filter (contact name / phone)
    let results = data ?? [];
    if (search) {
      const s = search.toLowerCase();
      results = results.filter((conv: any) => {
        const contact = conv.whatsapp_contacts;
        return (
          contact?.display_name?.toLowerCase().includes(s) ||
          contact?.wa_profile_name?.toLowerCase().includes(s) ||
          contact?.phone_number?.includes(s) ||
          conv.last_message_text?.toLowerCase().includes(s)
        );
      });
    }

    return apiOk({
      conversations: results,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "create" });

    const body = await request.json();
    const { phone } = z.object({ phone: z.string().min(7).max(25) }).parse(body);

    const supabase = await createServerSupabaseClient();

    // 1. Find the active/default WhatsApp account matching the user's scope
    let accountQuery = (supabase as any)
      .from("whatsapp_accounts")
      .select("id, country_id, country_branch_id, city_branch_id, scope, is_default")
      .eq("is_active", true)
      .is("deleted_at", null);

    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length > 0) {
        accountQuery = accountQuery.in("city_branch_id", session.cityBranchIds);
      } else if (session.countryIds.length > 0) {
        accountQuery = accountQuery.in("country_id", session.countryIds);
      }
    }
    
    const { data: accounts } = await accountQuery;
    const account = accounts?.find(a => a.is_default) ?? accounts?.[0] ?? null;
    if (!account) {
      throw new Error("No active WhatsApp account found for your branch scope.");
    }

    // 2. Normalize and check if contact exists
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    const digits = normalizedPhone.replace(/\D/g, "").slice(-10);

    let { data: contact } = await (supabase as any)
      .from("whatsapp_contacts")
      .select("id, customer_id")
      .ilike("phone_number", `%${digits}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (!contact) {
      // Look up ERP customer by phone/whatsapp
      const { data: customers } = await (supabase as any)
        .from("customers")
        .select("id, customer_name")
        .or(`mobile.ilike.%${digits},whatsapp.ilike.%${digits}`)
        .is("deleted_at", null)
        .limit(1);
      
      const erpCustomer = customers?.[0] ?? null;

      // Create new contact
      const { data: newContact, error: createContactErr } = await (supabase as any)
        .from("whatsapp_contacts")
        .insert({
          whatsapp_account_id: account.id,
          phone_number: normalizedPhone,
          wa_profile_name: erpCustomer ? erpCustomer.customer_name : normalizedPhone,
          display_name: erpCustomer ? erpCustomer.customer_name : normalizedPhone,
          customer_id: erpCustomer ? erpCustomer.id : null
        })
        .select("id")
        .single();
      if (createContactErr) throw new Error(createContactErr.message);
      contact = newContact;
    }

    // 3. Create or find conversation
    let { data: conv } = await (supabase as any)
      .from("whatsapp_conversations")
      .select("id")
      .eq("whatsapp_account_id", account.id)
      .eq("contact_id", contact.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!conv) {
      const { data: newConv, error: createConvErr } = await (supabase as any)
        .from("whatsapp_conversations")
        .insert({
          whatsapp_account_id: account.id,
          contact_id: contact.id,
          status: "open",
          unread_count: 0,
          country_id: account.country_id,
          country_branch_id: account.country_branch_id,
          city_branch_id: account.city_branch_id
        })
        .select("id")
        .single();
      if (createConvErr) throw new Error(createConvErr.message);
      conv = newConv;
    }

    return apiOk({ conversationId: conv.id });
  } catch (error) {
    return handleApiError(error);
  }
}
