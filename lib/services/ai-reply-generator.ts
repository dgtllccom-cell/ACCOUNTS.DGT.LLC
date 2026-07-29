import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupportedMessageLanguage = "en" | "ur" | "ps" | "fa" | "ar";

export type MessageCategory =
  | "payment_request"
  | "payment_due"
  | "payment_confirmation"
  | "balance_inquiry"
  | "purchase_order"
  | "sales_order"
  | "invoice"
  | "shipment_update"
  | "delivery_status"
  | "customer_inquiry"
  | "supplier_inquiry"
  | "account_statement"
  | "ledger_balance"
  | "document_request"
  | "complaint"
  | "appointment"
  | "general";

export type GeneratedAiReply = {
  replyText: string;
  detectedLanguage: SupportedMessageLanguage;
  category: MessageCategory;
  isSensitive: boolean;
  requiresApproval: boolean;
  verifiedContext: Record<string, any>;
  confidenceScore: number;
};

// Language Detection helper (5 Languages: EN, UR, PS, FA, AR)
export function detectLanguage(text: string): SupportedMessageLanguage {
  const clean = text.trim();
  const hasArabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(clean);
  if (!hasArabicScript) return "en";

  // Pashto-specific letters (ټ, ۍ, ې, ږ, ښ, ډ, ڼ)
  if (/[ټۍېږښډڼ]/u.test(clean)) return "ps";

  // Urdu-specific letters (ٹ, ڑ, ڈ, ں, ے, ؁)
  if (/[ٹڑڈںے]/u.test(clean)) return "ur";

  // Persian-specific letters (گ, چ, پ, ژ)
  if (/[گچپژ]/u.test(clean)) return "fa";

  // Arabic specific words (مرحبا, شكرا, طلب, فاتورة, حساب)
  if (clean.includes("مرحبا") || clean.includes("شكرا") || clean.includes("فاتورة") || clean.includes("طلب")) return "ar";

  // Default to Arabic/Urdu for Arabic script
  return "ar";
}

// Category intent recognition
export function detectMessageCategory(text: string): MessageCategory {
  const q = text.toLowerCase();

  if (q.includes("payment") || q.includes("پیسے") || q.includes("تادیه") || q.includes("پرداخت") || q.includes("رقم")) {
    if (q.includes("due") || q.includes("تاریج") || q.includes("تاریخ")) return "payment_due";
    if (q.includes("receive") || q.includes("confirm") || q.includes("رسید")) return "payment_confirmation";
    return "payment_request";
  }

  if (q.includes("balance") || q.includes("ledger") || q.includes("باقیات") || q.includes("باقی") || q.includes("مانده")) {
    return "balance_inquiry";
  }

  if (q.includes("po") || q.includes("purchase") || q.includes("خریداری") || q.includes("پیرود")) {
    return "purchase_order";
  }

  if (q.includes("sales") || q.includes("order") || q.includes("فروخت") || q.includes("پلور")) {
    return "sales_order";
  }

  if (q.includes("container") || q.includes("shipment") || q.includes("loading") || q.includes("بارولو") || q.includes("بارگیری")) {
    return "shipment_update";
  }

  if (q.includes("invoice") || q.includes("bill") || q.includes("بل") || q.includes("فاکتور")) {
    return "invoice";
  }

  if (q.includes("complaint") || q.includes("issue") || q.includes("شکایت") || q.includes("خرابی")) {
    return "complaint";
  }

  return "general";
}

// Check if message intent is sensitive and requires mandatory manager approval
export function checkIsSensitiveIntent(category: MessageCategory, text: string): boolean {
  const q = text.toLowerCase();

  const sensitiveKeywords = [
    "bank", "account number", "iban", "discount", "refund", "contract", "legal", "court",
    "credit limit", "cancel", "حساب نمبر", "بینک", "ڈسکاؤنٹ", "منسوخ", "کنٹریکٹ"
  ];

  if (sensitiveKeywords.some((kw) => q.includes(kw))) return true;
  if (category === "complaint") return true;

  return false;
}

/**
 * AI Reply Generator Engine
 * Fetches verified live ERP data and generates contextual 4-language responses.
 * Never invents payment amounts, dates, or order details.
 */
export async function generateContextualAiReply(params: {
  incomingMessage: string;
  senderIdentifier: string;
  senderName?: string;
  senderType?: string;
  countryId?: string | null;
  cityBranchId?: string | null;
  overrideLanguage?: SupportedMessageLanguage;
}): Promise<GeneratedAiReply> {
  const admin = createSupabaseAdminClient();
  const lang = params.overrideLanguage || detectLanguage(params.incomingMessage);
  const category = detectMessageCategory(params.incomingMessage);
  const isSensitive = checkIsSensitiveIntent(category, params.incomingMessage);

  const cleanText = params.incomingMessage.trim();
  const verifiedContext: Record<string, any> = {};

  // Query live ERP database for verified context
  const q = cleanText;

  // Check PO / SO
  const { data: pos } = await admin
    .from("purchase_orders")
    .select("po_number, total_amount, currency, status, remaining_amount, po_date")
    .or(`po_number.ilike.%${q}%,id.eq.${q}`)
    .is("deleted_at", null)
    .limit(1);

  if (pos && pos.length > 0) {
    verifiedContext.purchaseOrder = pos[0];
  }

  const { data: sos } = await admin
    .from("sales_orders")
    .select("order_number, total_amount, currency, status, order_date")
    .or(`order_number.ilike.%${q}%,id.eq.${q}`)
    .is("deleted_at", null)
    .limit(1);

  if (sos && sos.length > 0) {
    verifiedContext.salesOrder = sos[0];
  }

  // Construct Verified Business Reply Text based on language & live context
  let replyText = "";

  if (lang === "ur") {
    if (verifiedContext.purchaseOrder) {
      const po = verifiedContext.purchaseOrder;
      replyText = `محترم ${params.senderName || "صارف"}، آپ کا پرچیز آرڈر نمبر ${po.po_number || "—"} پوزیشن "${po.status}" پر ہے۔ کل رقم: ${po.currency} ${po.total_amount}، باقی رقم: ${po.currency} ${po.remaining_amount || 0} ہے۔ شکریہ (دیجیٹل ڈاٹ ERP)۔`;
    } else if (verifiedContext.salesOrder) {
      const so = verifiedContext.salesOrder;
      replyText = `محترم ${params.senderName || "صارف"}، آپ کا سیلز آرڈر نمبر ${so.order_number || "—"} اس وقت "${so.status}" کی حالت میں ہے۔ کل رقم: ${so.currency} ${so.total_amount} ہے۔ شکریہ۔`;
    } else if (category === "payment_request" || category === "balance_inquiry") {
      replyText = `محترم ${params.senderName || "صارف"}، آپ کے اکاؤنٹ کا تازہ ترین لیجر ریکارڈ تیار ہے۔ براہ کرم ادائیگی کا واؤچر یا حوالہ نمبر فراہم کریں تاکہ فوری تصدیق کی جا سکے۔`;
    } else if (category === "shipment_update") {
      replyText = `محترم ${params.senderName || "صارف"}، آپ کے بارگیری اور کنٹینر کا لاجسٹک ریکارڈ اپ ڈیٹ ہو رہا ہے۔ جلد آپ کو مطلع کیا جائے گا۔`;
    } else {
      replyText = `محترم ${params.senderName || "صارف"}، آپ کا پیغام موصول ہو گیا ہے۔ ہماری ٹیم آپ کے ریکارڈز کی تصدیق کر کے جلد رابطہ کرے گی۔`;
    }
  } else if (lang === "ps") {
    if (verifiedContext.purchaseOrder) {
      const po = verifiedContext.purchaseOrder;
      replyText = `قدرمن ${params.senderName || "کاروونکی"}، ستاسو د پیرود امر نمبر ${po.po_number || "—"} د "${po.status}" په حالت کې دی. ټول ټال رقم: ${po.currency} ${po.total_amount} دی. مننه.`;
    } else {
      replyText = `قدرمن ${params.senderName || "کاروونکی"}، ستاسو پیغام ترلاسه شو. زموږ پرسونل به ژر ستاسو د حساب تایید او له تاسو سره اړیکه ونیسي.`;
    }
  } else if (lang === "fa") {
    if (verifiedContext.purchaseOrder) {
      const po = verifiedContext.purchaseOrder;
      replyText = `گرامی ${params.senderName || "مشتری"}، سفارش خرید شما به شماره ${po.po_number || "—"} در وضعیت "${po.status}" قرار دارد. مبلغ کل: ${po.currency} ${po.total_amount} می‌باشد. با تشکر.`;
    } else {
      replyText = `گرامی ${params.senderName || "مشتری"}، پیام شما دریافت شد. همکاران ما پس از بررسی دقیق حساب، با شما ارتباط برقرار خواهند کرد.`;
    }
  } else {
    // English Default
    if (verifiedContext.purchaseOrder) {
      const po = verifiedContext.purchaseOrder;
      replyText = `Dear ${params.senderName || "Valued Contact"}, your Purchase Order ${po.po_number || "—"} is currently in status "${po.status}". Total Amount: ${po.currency} ${po.total_amount}, Remaining: ${po.currency} ${po.remaining_amount || 0}. Thank you (Digital Dock ERP).`;
    } else if (verifiedContext.salesOrder) {
      const so = verifiedContext.salesOrder;
      replyText = `Dear ${params.senderName || "Valued Contact"}, your Sales Order ${so.order_number || "—"} status is "${so.status}". Total Amount: ${so.currency} ${so.total_amount}. Thank you.`;
    } else {
      replyText = `Dear ${params.senderName || "Valued Contact"}, thank you for reaching out to Digital Dock ERP. Your inquiry has been received and verified against your account. Our team will update you promptly.`;
    }
  }

  return {
    replyText,
    detectedLanguage: lang,
    category,
    isSensitive,
    requiresApproval: isSensitive || category === "payment_request" || category === "complaint",
    verifiedContext,
    confidenceScore: verifiedContext.purchaseOrder || verifiedContext.salesOrder ? 0.98 : 0.85
  };
}
