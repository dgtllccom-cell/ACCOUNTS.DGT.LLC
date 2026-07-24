import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { applySessionScopeDefaults } from "@/lib/communication-center/communication-center-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const leadSchema = z.object({
  leadName: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional(),
  contactPerson: z.string().trim().max(160).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(80).optional(),
  whatsapp: z.string().trim().max(80).optional(),
  source: z.string().trim().max(80).optional(),
  status: z.string().trim().max(50).default("new"),
  priority: z.string().trim().max(50).default("normal"),
  notes: z.string().trim().max(5000).optional(),
  nextFollowUpAt: z.string().trim().optional(),
  countryId: z.string().uuid().or(z.literal("")).nullable().optional(),
  countryBranchId: z.string().uuid().or(z.literal("")).nullable().optional(),
  cityBranchId: z.string().uuid().or(z.literal("")).nullable().optional()
});

function clean(value: string | null | undefined) {
  return value && value !== "all" ? value : null;
}

function applyScope(query: any, scope: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null }) {
  if (scope.countryId) query = query.eq("country_id", scope.countryId);
  if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
  if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);
  return query;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(searchParams.get("countryId")),
      countryBranchId: clean(searchParams.get("countryBranchId")),
      cityBranchId: clean(searchParams.get("cityBranchId"))
    });

    let query = admin
      .from("communication_center_leads")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Number(searchParams.get("limit") ?? 50));
    query = applyScope(query, scope);
    const { data, error } = await query;
    if (error) throw error;

    return apiOk({ leads: data ?? [], scope });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const body = leadSchema.parse(await req.json());
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(body.countryId),
      countryBranchId: clean(body.countryBranchId),
      cityBranchId: clean(body.cityBranchId)
    });

    const { data, error } = await admin
      .from("communication_center_leads")
      .insert({
        country_id: scope.countryId,
        country_branch_id: scope.countryBranchId,
        city_branch_id: scope.cityBranchId,
        lead_name: body.leadName,
        company_name: body.companyName ?? null,
        contact_person: body.contactPerson ?? null,
        email: body.email || null,
        phone: body.phone ?? null,
        whatsapp: body.whatsapp ?? null,
        source: body.source ?? null,
        status: body.status,
        priority: body.priority,
        notes: body.notes ?? null,
        next_follow_up_at: body.nextFollowUpAt || null,
        created_by: session.userId
      })
      .select("*")
      .single();

    if (error) throw error;
    return apiCreated({ lead: data });
  } catch (error) {
    return handleApiError(error);
  }
}
