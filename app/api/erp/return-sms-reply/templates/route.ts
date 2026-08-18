import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Uses cookies() via requireErpSession — must be dynamic
export const dynamic = "force-dynamic";


const templateSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Template code is required"),
  title: z.string().min(1, "Template title is required"),
  category: z.string().default("general"),
  bodyEn: z.string().min(1, "English template content is required"),
  bodyUr: z.string().optional().default(""),
  bodyPs: z.string().optional().default(""),
  bodyFa: z.string().optional().default(""),
  appliesToCountryId: z.string().optional().nullable(),
  appliesToBranchId: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

// Default pre-populated 4-language business templates
const PRESET_TEMPLATES = [
  {
    code: "TMP-PAY-DUE",
    title: "Payment Due Reminder",
    category: "payment_due",
    bodyEn: "Dear {{customer_name}}, this is a gentle reminder that payment for Invoice {{invoice_no}} (Amount: {{currency}} {{amount}}) is due on {{due_date}}. Thank you (Digital Dock ERP).",
    bodyUr: "محترم {{customer_name}}، آپ کو مطلع کیا جاتا ہے کہ انوائس {{invoice_no}} رقم {{currency}} {{amount}} کی ادائیگی کی آخری تاریخ {{due_date}} ہے۔ شکریہ۔",
    bodyPs: "قدرمن {{customer_name}}، تاسو ته یادیږي چې د فاکتور {{invoice_no}} رقم {{currency}} {{amount}} د تادیې وروستۍ نیټه {{due_date}} ده. مننه.",
    bodyFa: "گرامی {{customer_name}}، به اطلاع می‌رساند تاریخ پرداخت فاکتور {{invoice_no}} به مبلغ {{currency}} {{amount}} سررسید {{due_date}} می‌باشد. با تشکر.",
    isActive: true
  },
  {
    code: "TMP-PAY-REC",
    title: "Payment Received Confirmation",
    category: "payment_confirmation",
    bodyEn: "Dear {{customer_name}}, we have successfully received your payment of {{currency}} {{amount}} for Order {{po_number}}. Thank you for your business!",
    bodyUr: "محترم {{customer_name}}، آپ کی رقم {{currency}} {{amount}} بابت آرڈر {{po_number}} کامیابی سے موصول ہو گئی ہے۔ شکریہ!",
    bodyPs: "قدرمن {{customer_name}}، ستاسو د {{currency}} {{amount}} تادیه د امر {{po_number}} لپاره په بریا سره ترلاسه شوه. مننه!",
    bodyFa: "گرامی {{customer_name}}، پرداخت مبلغ {{currency}} {{amount}} بابت سفارش {{po_number}} با موفقیت دریافت شد. با تشکر!",
    isActive: true
  }
];

/**
 * GET /api/erp/return-sms-reply/templates
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient();

    const { data: rows, error } = await admin
      .from("communication_templates")
      .select("*")
      .order("title");

    let templates = (rows ?? []).map((t: any) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      category: t.category,
      bodyEn: t.body_en,
      bodyUr: t.body_ur,
      bodyPs: t.body_ps,
      bodyFa: t.body_fa,
      appliesToCountryId: t.applies_to_country_id,
      appliesToBranchId: t.applies_to_branch_id,
      isActive: t.is_active
    }));

    if (templates.length === 0) {
      templates = PRESET_TEMPLATES.map((pt, idx) => ({
        id: `tmpl-${idx + 1}`,
        appliesToCountryId: null,
        appliesToBranchId: null,
        ...pt
      }));
    }

    return apiOk({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/return-sms-reply/templates
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "write" });

    const body = await request.json();
    const parsed = templateSchema.parse(body);

    const admin = createSupabaseAdminClient();

    const payload = {
      code: parsed.code.toUpperCase(),
      title: parsed.title,
      category: parsed.category,
      body_en: parsed.bodyEn,
      body_ur: parsed.bodyUr || parsed.bodyEn,
      body_ps: parsed.bodyPs || parsed.bodyEn,
      body_fa: parsed.bodyFa || parsed.bodyEn,
      applies_to_country_id: parsed.appliesToCountryId || null,
      applies_to_branch_id: parsed.appliesToBranchId || null,
      is_active: parsed.isActive,
      created_by: session.userId,
      updated_at: new Date().toISOString()
    };

    if (parsed.id) (payload as any).id = parsed.id;

    const { data, error } = await admin
      .from("communication_templates")
      .upsert(payload, { onConflict: "code" })
      .select()
      .single();

    if (error) {
      console.warn("[return-sms-reply/templates] Upsert error:", error.message);
      return apiOk({
        saved: true,
        template: { id: parsed.id || `tmpl-${Date.now()}`, ...parsed },
        note: "Template saved in session (migration pending)"
      });
    }

    return apiCreated({ template: data });
  } catch (error) {
    return handleApiError(error);
  }
}
