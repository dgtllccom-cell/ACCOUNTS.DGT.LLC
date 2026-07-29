import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveReminderRule, processAutomatedPaymentReminders } from "@/lib/services/payment-reminder-engine";

const reminderRuleSchema = z.object({
  id: z.string().optional(),
  ruleName: z.string().min(1, "Rule name is required"),
  triggerEvent: z.enum([
    "before_due_date",
    "on_due_date",
    "overdue",
    "payment_approved",
    "payment_completed",
    "payment_rejected",
    "invoice_created",
    "balance_changed"
  ]),
  daysOffset: z.coerce.number().default(0),
  triggerTime: z.string().optional(),
  channel: z.enum(["whatsapp", "email", "both"]).default("both"),
  recipientType: z.enum(["customer", "supplier", "both"]).default("customer"),
  countryId: z.string().optional().nullable(),
  cityBranchId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  preferredLanguage: z.enum(["en", "ur", "ps", "fa"]).default("en"),
  maxReminders: z.coerce.number().default(3),
  reminderIntervalDays: z.coerce.number().default(3),
  requireApproval: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

/**
 * GET /api/erp/return-sms-reply/reminders
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient();

    const { data: rows, error } = await admin
      .from("communication_reminder_rules")
      .select("*")
      .order("created_at", { ascending: false });

    let rules = (rows ?? []).map((r: any) => ({
      id: r.id,
      ruleName: r.rule_name,
      triggerEvent: r.trigger_event,
      daysOffset: r.days_offset,
      triggerTime: r.trigger_time,
      channel: r.channel,
      recipientType: r.recipient_type,
      countryId: r.country_id,
      cityBranchId: r.city_branch_id,
      templateId: r.template_id,
      preferredLanguage: r.preferred_language,
      maxReminders: r.max_reminders,
      reminderIntervalDays: r.reminder_interval_days,
      requireApproval: r.require_approval,
      isActive: r.is_active
    }));

    return apiOk({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/return-sms-reply/reminders
 * Save rule or trigger immediate reminder evaluation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "write" });

    const { searchParams } = request.nextUrl;
    if (searchParams.get("action") === "process") {
      // Trigger background processing engine for payment reminders
      const result = await processAutomatedPaymentReminders();
      return apiOk({ action: "process", ...result });
    }

    const body = await request.json();
    const parsed = reminderRuleSchema.parse(body);

    const saved = await saveReminderRule(parsed, session.userId);

    return apiCreated({ rule: saved });
  } catch (error) {
    return handleApiError(error);
  }
}
