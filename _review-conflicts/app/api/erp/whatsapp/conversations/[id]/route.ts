import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const conversationUpdateSchema = z.object({
  status: z.enum(["open", "assigned", "resolved", "spam"]).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  labels: z.array(z.string()).optional()
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "read" });

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Conversation + contact detail
    const { data: conversation, error } = await (supabase as any)
      .from("whatsapp_conversations")
      .select(`
        id, status, unread_count, labels, linked_module, linked_document_no,
        meta_conversation_id, window_expires_at, created_at, updated_at,
        whatsapp_accounts:whatsapp_account_id(
          id, display_name, phone_number, phone_number_id, waba_id, scope
        ),
        whatsapp_contacts:contact_id(
          id, phone_number, wa_profile_name, display_name, notes, labels,
          customer_id, is_blocked, last_seen_at
        ),
        assigned_profiles:assigned_user_id(id, full_name),
        countries:country_id(id, name, currency_code),
        country_branches:country_branch_id(id, name),
        city_branches:city_branch_id(id, name, city_name)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!conversation) return apiOk({ error: "Not found" });

    // Load ERP customer data if linked
    let erpCustomer = null;
    const customerId = conversation.whatsapp_contacts?.customer_id;
    if (customerId) {
      const { data: customer } = await (supabase as any)
        .from("customers")
        .select(`
          id, customer_name, company_name, mobile, whatsapp, email, address,
          country_id, notes
        `)
        .eq("id", customerId)
        .is("deleted_at", null)
        .maybeSingle();
      erpCustomer = customer;
    }

    // Reset unread count
    await (supabase as any)
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", id);

    // Activity log
    const { data: activity } = await (supabase as any)
      .from("whatsapp_activity_log")
      .select("id, event_type, event_data, actor_name, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    return apiOk({ conversation, erpCustomer, activity: activity ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "update" });

    const { id } = await params;
    const body = conversationUpdateSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();

    // Load current conversation for scope check
    const { data: conv } = await (supabase as any)
      .from("whatsapp_conversations")
      .select("id, status, assigned_user_id, country_id, country_branch_id, city_branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!conv) return apiOk({ error: "Not found" });

    authorizeApiScope(session, {
      resource: "whatsapp",
      action: "update",
      countryId: conv.country_id,
      countryBranchId: conv.country_branch_id,
      cityBranchId: conv.city_branch_id
    });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const logData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      logData.previous_status = conv.status;
      logData.new_status = body.status;
      updates.status = body.status;
    }
    if (body.assignedUserId !== undefined) {
      logData.previous_assigned = conv.assigned_user_id;
      logData.new_assigned = body.assignedUserId;
      updates.assigned_user_id = body.assignedUserId;
      if (body.assignedUserId) updates.status = "assigned";
    }
    if (body.labels !== undefined) {
      updates.labels = body.labels;
    }

    await (supabase as any).from("whatsapp_conversations").update(updates).eq("id", id);

    // Log activity
    if (Object.keys(logData).length > 0) {
      await (supabase as any).from("whatsapp_activity_log").insert({
        conversation_id: id,
        country_id: conv.country_id,
        city_branch_id: conv.city_branch_id,
        actor_id: session.userId,
        actor_name: session.fullName ?? session.email,
        event_type: body.status ? "status_change" : "assigned",
        event_data: logData
      });
    }

    return apiOk({ conversationId: id, updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
