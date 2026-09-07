/**
 * Customer Auto-Reply — canonical 5-language business reply templates.
 *
 * These are real, professional customer communications used by the Customers
 * module's reply panel. They are NOT demo/sample text: each language is a
 * human-authored rendering, not a machine translation, so a reply picked from a
 * template always reaches the customer in fluent language.
 *
 * Placeholders (double braces) are filled from the customer + linked document
 * before the draft is shown to the operator, who can still edit every word
 * before sending.
 *
 *   {{customer_name}}  {{company_name}}  {{sender_name}}  {{branch_name}}
 *   {{invoice_no}}     {{order_no}}      {{amount}}       {{currency}}
 *   {{due_date}}       {{date}}          {{reference}}
 */

import type { SupportedLanguage } from "@/lib/i18n/languages";

export type AutoReplyTemplate = {
  code: string;
  title: string;
  category:
    | "inquiry_ack"
    | "payment_confirmation"
    | "payment_due"
    | "document_request"
    | "order_status"
    | "account_statement"
    | "general";
  /** Subject line per language. */
  subject: Record<SupportedLanguage, string>;
  /** Body per language. */
  body: Record<SupportedLanguage, string>;
};

export const AUTO_REPLY_TEMPLATES: AutoReplyTemplate[] = [
  {
    code: "CUSTREPLY-INQUIRY-ACK",
    title: "Inquiry acknowledgement",
    category: "inquiry_ack",
    subject: {
      en: "We have received your inquiry — {{company_name}}",
      ur: "آپ کی استفسار موصول ہو گئی ہے — {{company_name}}",
      ps: "ستاسو پوښتنه ترلاسه شوه — {{company_name}}",
      fa: "استعلام شما دریافت شد — {{company_name}}",
      ar: "لقد استلمنا استفساركم — {{company_name}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nThank you for contacting {{company_name}}. We have received your inquiry and our team is reviewing it. We will get back to you with a full response shortly.\n\nIf the matter is urgent, please reply to this message and we will prioritise it.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\n{{company_name}} سے رابطہ کرنے کا شکریہ۔ آپ کی استفسار ہمیں موصول ہو گئی ہے اور ہماری ٹیم اس کا جائزہ لے رہی ہے۔ ہم جلد ہی مکمل جواب کے ساتھ آپ سے رابطہ کریں گے۔\n\nاگر معاملہ فوری ہے تو براہِ کرم اس پیغام کا جواب دیں، ہم اسے ترجیح دیں گے۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nله {{company_name}} سره د اړیکې لپاره مننه. ستاسو پوښتنه مو ترلاسه کړه او زموږ ټیم یې څیړي. موږ به ژر تر ژره بشپړ ځواب درکړو.\n\nکه چیرې چاره بیړنۍ وي، مهرباني وکړئ دې پیغام ته ځواب ورکړئ، موږ به یې لومړیتوب ورکړو.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nاز تماس شما با {{company_name}} سپاسگزاریم. استعلام شما دریافت شد و تیم ما در حال بررسی آن است. به‌زودی پاسخ کامل را برای شما ارسال خواهیم کرد.\n\nاگر موضوع فوری است، لطفاً به این پیام پاسخ دهید تا در اولویت قرار گیرد.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nشكرًا لتواصلكم مع {{company_name}}. لقد استلمنا استفساركم ويقوم فريقنا بمراجعته، وسنعود إليكم برد كامل في أقرب وقت.\n\nإذا كان الأمر عاجلًا، يُرجى الرد على هذه الرسالة وسنمنحها الأولوية.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-PAYMENT-RECEIVED",
    title: "Payment received confirmation",
    category: "payment_confirmation",
    subject: {
      en: "Payment received — Invoice {{invoice_no}}",
      ur: "ادائیگی موصول — انوائس {{invoice_no}}",
      ps: "تادیه ترلاسه شوه — فاکتور {{invoice_no}}",
      fa: "پرداخت دریافت شد — فاکتور {{invoice_no}}",
      ar: "تم استلام الدفعة — الفاتورة {{invoice_no}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nWe confirm receipt of your payment of {{currency}} {{amount}} against Invoice {{invoice_no}} on {{date}}. Your account has been updated accordingly.\n\nThank you for your business.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\nہم تصدیق کرتے ہیں کہ انوائس {{invoice_no}} کے عوض آپ کی رقم {{currency}} {{amount}} مورخہ {{date}} کو موصول ہو گئی ہے۔ آپ کا اکاؤنٹ اسی کے مطابق اپ ڈیٹ کر دیا گیا ہے۔\n\nآپ کے کاروبار کا شکریہ۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nموږ تاییدوو چې ستاسو د {{currency}} {{amount}} تادیه د فاکتور {{invoice_no}} په مقابل کې د {{date}} په نیټه ترلاسه شوه. ستاسو حساب سم شو.\n\nستاسو د سوداګرۍ مننه.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nدریافت پرداخت شما به مبلغ {{currency}} {{amount}} بابت فاکتور {{invoice_no}} در تاریخ {{date}} را تأیید می‌کنیم. حساب شما مطابق آن به‌روزرسانی شد.\n\nاز همکاری شما سپاسگزاریم.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nنؤكد استلام دفعتكم بمبلغ {{currency}} {{amount}} مقابل الفاتورة {{invoice_no}} بتاريخ {{date}}. وقد تم تحديث حسابكم وفقًا لذلك.\n\nشكرًا لتعاملكم معنا.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-PAYMENT-DUE",
    title: "Payment due reminder",
    category: "payment_due",
    subject: {
      en: "Payment reminder — Invoice {{invoice_no}} due {{due_date}}",
      ur: "ادائیگی کی یاد دہانی — انوائس {{invoice_no}} آخری تاریخ {{due_date}}",
      ps: "د تادیې یادونه — فاکتور {{invoice_no}} وروستۍ نیټه {{due_date}}",
      fa: "یادآوری پرداخت — فاکتور {{invoice_no}} سررسید {{due_date}}",
      ar: "تذكير بالدفع — الفاتورة {{invoice_no}} تستحق في {{due_date}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nThis is a friendly reminder that payment of {{currency}} {{amount}} for Invoice {{invoice_no}} is due on {{due_date}}.\n\nIf you have already made this payment, please share the transfer details so we can reconcile your account. If you have any questions about this invoice, reply to this message and we will be glad to help.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\nیہ ایک یاد دہانی ہے کہ انوائس {{invoice_no}} کی رقم {{currency}} {{amount}} کی ادائیگی کی آخری تاریخ {{due_date}} ہے۔\n\nاگر آپ یہ ادائیگی کر چکے ہیں تو براہِ کرم ٹرانسفر کی تفصیل بھیج دیں تاکہ ہم آپ کا اکاؤنٹ ملا سکیں۔ اگر اس انوائس کے بارے میں کوئی سوال ہو تو اس پیغام کا جواب دیں، ہم مدد کے لیے حاضر ہیں۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nدا یوه دوستانه یادونه ده چې د فاکتور {{invoice_no}} د {{currency}} {{amount}} تادیه د {{due_date}} په نیټه سررسیدلې ده.\n\nکه تاسو دا تادیه دمخه کړې وي، مهرباني وکړئ د لیږد جزئیات راولیږئ چې ستاسو حساب برابر کړو. که پوښتنه لرئ، دې پیغام ته ځواب ورکړئ.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nاین یک یادآوری دوستانه است که پرداخت مبلغ {{currency}} {{amount}} بابت فاکتور {{invoice_no}} در تاریخ {{due_date}} سررسید می‌شود.\n\nاگر این پرداخت را انجام داده‌اید، لطفاً جزئیات انتقال را ارسال کنید تا حساب شما تطبیق داده شود. در صورت داشتن هرگونه پرسش دربارهٔ این فاکتور، به این پیام پاسخ دهید.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nهذا تذكير ودّي بأن سداد مبلغ {{currency}} {{amount}} عن الفاتورة {{invoice_no}} يستحق بتاريخ {{due_date}}.\n\nإذا كنتم قد سددتم هذه الدفعة، يُرجى تزويدنا ببيانات التحويل لتسوية حسابكم. وإن كان لديكم أي استفسار بخصوص هذه الفاتورة، فيرجى الرد على هذه الرسالة وسيسعدنا مساعدتكم.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-DOCUMENT-REQUEST",
    title: "Document request",
    category: "document_request",
    subject: {
      en: "Documents needed to proceed — {{reference}}",
      ur: "آگے بڑھنے کے لیے دستاویزات درکار — {{reference}}",
      ps: "د مخکې تګ لپاره اسناد ته اړتیا — {{reference}}",
      fa: "برای ادامه کار به مدارک نیاز است — {{reference}}",
      ar: "مستندات مطلوبة للمتابعة — {{reference}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nTo proceed with {{reference}}, we need the following from you:\n\n1. \n2. \n\nPlease reply to this message with the documents attached, or let us know if anything is unclear.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\n{{reference}} کو آگے بڑھانے کے لیے ہمیں آپ سے درج ذیل درکار ہے:\n\n1. \n2. \n\nبراہِ کرم دستاویزات منسلک کر کے اس پیغام کا جواب دیں، یا اگر کوئی بات واضح نہ ہو تو بتائیں۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nد {{reference}} د پرمخ وړلو لپاره موږ له تاسو څخه لاندې شیانو ته اړتیا لرو:\n\n1. \n2. \n\nمهرباني وکړئ اسناد ضمیمه کړئ او دې پیغام ته ځواب ورکړئ، یا که څه ناڅرګند وي موږ ته ووایاست.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nبرای ادامهٔ {{reference}}، به موارد زیر از شما نیاز داریم:\n\n1. \n2. \n\nلطفاً مدارک را پیوست کرده و به این پیام پاسخ دهید، یا در صورت ابهام به ما اطلاع دهید.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nلمتابعة {{reference}}، نحتاج منكم ما يلي:\n\n1. \n2. \n\nيُرجى الرد على هذه الرسالة مع إرفاق المستندات، أو إخبارنا إذا كان هناك ما هو غير واضح.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-ORDER-STATUS",
    title: "Order / shipment status update",
    category: "order_status",
    subject: {
      en: "Status update — Order {{order_no}}",
      ur: "صورتحال کی تازہ کاری — آرڈر {{order_no}}",
      ps: "د حالت تازه معلومات — امر {{order_no}}",
      fa: "به‌روزرسانی وضعیت — سفارش {{order_no}}",
      ar: "تحديث الحالة — الطلب {{order_no}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nHere is the latest status of Order {{order_no}} as of {{date}}:\n\n\n\nWe will send the next update as soon as there is a change. Please reply if you need any details.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\n{{date}} تک آرڈر {{order_no}} کی تازہ ترین صورتحال درج ذیل ہے:\n\n\n\nجیسے ہی کوئی تبدیلی ہو گی، ہم اگلی تازہ کاری بھیج دیں گے۔ کسی تفصیل کی ضرورت ہو تو جواب دیں۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nد {{date}} تر نیټې پورې د امر {{order_no}} وروستی حالت دا دی:\n\n\n\nکله چې کوم بدلون راشي، موږ به بل تازه معلومات درولیږو. که کوم جزئیاتو ته اړتیا لرئ، ځواب راکړئ.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nآخرین وضعیت سفارش {{order_no}} تا تاریخ {{date}} به شرح زیر است:\n\n\n\nبه‌محض هرگونه تغییر، به‌روزرسانی بعدی را ارسال خواهیم کرد. در صورت نیاز به جزئیات پاسخ دهید.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nفيما يلي آخر حالة للطلب {{order_no}} حتى تاريخ {{date}}:\n\n\n\nسنرسل التحديث التالي فور حدوث أي تغيير. يُرجى الرد إذا احتجتم إلى أي تفاصيل.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-STATEMENT",
    title: "Statement of account",
    category: "account_statement",
    subject: {
      en: "Your statement of account — {{date}}",
      ur: "آپ کا اکاؤنٹ اسٹیٹمنٹ — {{date}}",
      ps: "ستاسو د حساب لیست — {{date}}",
      fa: "صورت‌حساب شما — {{date}}",
      ar: "كشف حسابكم — {{date}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nPlease find your statement of account as of {{date}}. The closing balance is {{currency}} {{amount}}.\n\nKindly review it and let us know if you have any questions. If everything is in order, no action is needed.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\n{{date}} تک آپ کا اکاؤنٹ اسٹیٹمنٹ منسلک ہے۔ اختتامی بیلنس {{currency}} {{amount}} ہے۔\n\nبراہِ کرم اس کا جائزہ لیں اور کوئی سوال ہو تو بتائیں۔ اگر سب درست ہے تو کسی کارروائی کی ضرورت نہیں۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nد {{date}} تر نیټې پورې ستاسو د حساب لیست ضمیمه دی. د پای پاتې اندازه {{currency}} {{amount}} ده.\n\nمهرباني وکړئ وګورئ او که پوښتنه لرئ موږ ته ووایاست. که هر څه سم وي، هیڅ کار ته اړتیا نشته.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nصورت‌حساب شما تا تاریخ {{date}} پیوست است. مانده نهایی {{currency}} {{amount}} می‌باشد.\n\nلطفاً آن را بررسی کنید و در صورت وجود پرسش به ما اطلاع دهید. اگر همه‌چیز درست است، اقدامی لازم نیست.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nمرفق كشف حسابكم حتى تاريخ {{date}}. الرصيد الختامي هو {{currency}} {{amount}}.\n\nنرجو مراجعته وإبلاغنا بأي استفسار. وإذا كان كل شيء صحيحًا، فلا حاجة إلى أي إجراء.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
  {
    code: "CUSTREPLY-GENERAL-THANKS",
    title: "General thank-you / follow-up",
    category: "general",
    subject: {
      en: "Thank you — {{company_name}}",
      ur: "شکریہ — {{company_name}}",
      ps: "مننه — {{company_name}}",
      fa: "با تشکر — {{company_name}}",
      ar: "شكرًا لكم — {{company_name}}",
    },
    body: {
      en: "Dear {{customer_name}},\n\nThank you for your message. \n\nPlease let us know if there is anything else we can help you with.\n\nBest regards,\n{{sender_name}}\n{{branch_name}}",
      ur: "محترم {{customer_name}}،\n\nآپ کے پیغام کا شکریہ۔ \n\nاگر ہم کسی اور معاملے میں آپ کی مدد کر سکتے ہیں تو بتائیں۔\n\nنیک تمنائیں،\n{{sender_name}}\n{{branch_name}}",
      ps: "قدرمن {{customer_name}}،\n\nستاسو د پیغام مننه. \n\nکه په بل کوم کار کې کولی شو مرسته وکړو، موږ ته ووایاست.\n\nنیکې هیلې،\n{{sender_name}}\n{{branch_name}}",
      fa: "مشتری گرامی {{customer_name}}،\n\nاز پیام شما سپاسگزاریم. \n\nاگر در مورد دیگری می‌توانیم کمک کنیم، اطلاع دهید.\n\nبا احترام،\n{{sender_name}}\n{{branch_name}}",
      ar: "عزيزنا {{customer_name}}،\n\nشكرًا لرسالتكم. \n\nيُرجى إخبارنا إن كان هناك أي شيء آخر يمكننا مساعدتكم فيه.\n\nمع خالص التقدير،\n{{sender_name}}\n{{branch_name}}",
    },
  },
];

export const AUTO_REPLY_LANGS: SupportedLanguage[] = ["en", "ur", "ps", "fa", "ar"];

export function getAutoReplyTemplate(code: string): AutoReplyTemplate | undefined {
  return AUTO_REPLY_TEMPLATES.find((t) => t.code === code);
}

/** Fill {{placeholders}} from a values map. A placeholder with no value becomes
 *  `missingMarker` — default a blank underline so the operator sees exactly what
 *  still needs filling in the draft, and a half-filled token never silently
 *  reaches the customer as an empty gap. */
export function fillPlaceholders(
  text: string,
  values: Record<string, string | null | undefined>,
  missingMarker = "  ____  ",
): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = values[key];
    return v == null || String(v).trim() === "" ? missingMarker : String(v);
  });
}
