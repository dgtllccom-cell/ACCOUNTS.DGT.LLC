/**
 * Server & Project Monitoring — modular multilingual dictionary.
 *
 * Kept self-contained (English source + Arabic / Urdu / Persian / Pashto) so the
 * module is fully translatable without editing the global ui.ts dictionary for every
 * string. Resolution mirrors the app engine: selected language -> English -> key.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type MonitorKey =
  | "title" | "subtitle" | "overall" | "updated" | "refresh" | "autorefresh"
  | "status.healthy" | "status.warning" | "status.error" | "status.unknown"
  | "group.source" | "group.server" | "group.database" | "group.network" | "group.operations"
  | "m.repo" | "m.branch" | "m.commit" | "m.actions" | "m.deploy" | "m.updatedBy" | "m.build"
  | "m.vps" | "m.cpu" | "m.ram" | "m.disk" | "m.pm2" | "m.uptime" | "m.node" | "m.npm"
  | "m.db" | "m.api" | "m.resp" | "m.dbConn" | "m.activeUsers"
  | "m.domain" | "m.ssl" | "m.backup" | "m.errors" | "m.warnings"
  | "v.online" | "v.offline" | "v.healthy" | "v.degraded" | "v.notConfigured" | "v.active" | "v.expired" | "v.none" | "v.cores" | "v.daysLeft"
  | "act.restartApp" | "act.restartPm2" | "act.health" | "act.logs" | "act.github" | "act.supabase" | "act.deploy" | "act.quickActions"
  | "confirm.restartApp" | "confirm.restartPm2"
  | "tbl.status" | "tbl.time" | "tbl.event" | "tbl.user" | "tbl.branch" | "tbl.details"
  | "tbl.name" | "tbl.cpu" | "tbl.mem" | "tbl.restarts" | "tbl.uptime"
  | "pm2.title" | "history.title" | "history.empty" | "footer" | "superadminOnly"
  | "notice.done" | "notice.failed";

type Row = Record<SupportedLanguage, string>;

const DICT: Record<MonitorKey, Row> = {
  title: { en: "Server & Project Monitoring", ar: "مراقبة الخادم والمشروع", ur: "سرور اور پروجیکٹ مانیٹرنگ", fa: "پایش سرور و پروژه", ps: "د سرور او پروژې څارنه" },
  subtitle: { en: "Live health of your infrastructure", ar: "الحالة المباشرة للبنية التحتية", ur: "آپ کے انفراسٹرکچر کی لائیو صحت", fa: "سلامت زندهٔ زیرساخت شما", ps: "ستاسو د زیربنا ژوندۍ روغتیا" },
  overall: { en: "Overall", ar: "الحالة العامة", ur: "مجموعی حالت", fa: "وضعیت کلی", ps: "ټولیز حالت" },
  updated: { en: "Updated", ar: "آخر تحديث", ur: "اپ ڈیٹ ہوا", fa: "به‌روزرسانی", ps: "تازه شوی" },
  refresh: { en: "Refresh", ar: "تحديث", ur: "ریفریش", fa: "تازه‌سازی", ps: "تازه کول" },
  autorefresh: { en: "Auto-refreshes every {n}s · all data collected live", ar: "تحديث تلقائي كل {n} ثانية · جميع البيانات مباشرة", ur: "ہر {n} سیکنڈ بعد خودکار ریفریش · تمام ڈیٹا لائیو", fa: "هر {n} ثانیه به‌روزرسانی خودکار · همهٔ داده‌ها زنده", ps: "هرو {n} ثانیو تازه کیږي · ټول معلومات ژوندي" },

  "status.healthy": { en: "Healthy", ar: "سليم", ur: "درست", fa: "سالم", ps: "روغ" },
  "status.warning": { en: "Warning", ar: "تحذير", ur: "انتباہ", fa: "هشدار", ps: "خبرداری" },
  "status.error": { en: "Error", ar: "خطأ", ur: "خرابی", fa: "خطا", ps: "تېروتنه" },
  "status.unknown": { en: "Unknown", ar: "غير معروف", ur: "نامعلوم", fa: "نامشخص", ps: "نامعلوم" },

  "group.source": { en: "Source Control & CI/CD", ar: "إدارة الشيفرة و CI/CD", ur: "سورس کنٹرول اور CI/CD", fa: "کنترل کد و CI/CD", ps: "د سرچينې کنټرول او CI/CD" },
  "group.server": { en: "Server / VPS", ar: "الخادم / VPS", ur: "سرور / VPS", fa: "سرور / VPS", ps: "سرور / VPS" },
  "group.database": { en: "Database & API", ar: "قاعدة البيانات و API", ur: "ڈیٹابیس اور API", fa: "پایگاه داده و API", ps: "ډېټابېس او API" },
  "group.network": { en: "Network & Security", ar: "الشبكة والأمان", ur: "نیٹ ورک اور سیکیورٹی", fa: "شبکه و امنیت", ps: "شبکه او امنیت" },
  "group.operations": { en: "Operations", ar: "العمليات", ur: "آپریشنز", fa: "عملیات", ps: "عملیات" },

  "m.repo": { en: "GitHub Repository", ar: "مستودع GitHub", ur: "گٹ ہب ریپوزٹری", fa: "مخزن GitHub", ps: "د GitHub ذخیره" },
  "m.branch": { en: "Current Branch", ar: "الفرع الحالي", ur: "موجودہ برانچ", fa: "شاخهٔ فعلی", ps: "اوسنۍ څانګه" },
  "m.commit": { en: "Latest Commit", ar: "آخر Commit", ur: "تازہ ترین کمِٹ", fa: "آخرین Commit", ps: "وروستی Commit" },
  "m.actions": { en: "GitHub Actions", ar: "GitHub Actions", ur: "گٹ ہب ایکشنز", fa: "GitHub Actions", ps: "GitHub Actions" },
  "m.deploy": { en: "Last Deployment", ar: "آخر نشر", ur: "آخری ڈیپلائمنٹ", fa: "آخرین استقرار", ps: "وروستی ځای‌پرځای‌کول" },
  "m.updatedBy": { en: "Last Updated By", ar: "آخر تحديث بواسطة", ur: "آخری اپ ڈیٹ بذریعہ", fa: "آخرین به‌روزرسانی توسط", ps: "وروستی تازه‌کول لخوا" },
  "m.build": { en: "Build Version", ar: "إصدار البناء", ur: "بلڈ ورژن", fa: "نسخهٔ ساخت", ps: "د جوړولو نسخه" },

  "m.vps": { en: "VPS Server", ar: "خادم VPS", ur: "وی پی ایس سرور", fa: "سرور VPS", ps: "د VPS سرور" },
  "m.cpu": { en: "CPU Usage", ar: "استخدام المعالج", ur: "سی پی یو استعمال", fa: "مصرف پردازنده", ps: "د CPU کارونه" },
  "m.ram": { en: "RAM Usage", ar: "استخدام الذاكرة", ur: "ریم استعمال", fa: "مصرف حافظه", ps: "د RAM کارونه" },
  "m.disk": { en: "Disk Usage", ar: "استخدام القرص", ur: "ڈسک استعمال", fa: "مصرف دیسک", ps: "د ډیسک کارونه" },
  "m.pm2": { en: "PM2 Process", ar: "عملية PM2", ur: "PM2 پروسیس", fa: "فرآیند PM2", ps: "د PM2 پروسه" },
  "m.uptime": { en: "System Uptime", ar: "مدة تشغيل النظام", ur: "سسٹم اپ ٹائم", fa: "زمان کارکرد سیستم", ps: "د سیسټم کاري وخت" },
  "m.node": { en: "Node.js Version", ar: "إصدار Node.js", ur: "نوڈ جے ایس ورژن", fa: "نسخهٔ Node.js", ps: "د Node.js نسخه" },
  "m.npm": { en: "NPM Version", ar: "إصدار NPM", ur: "این پی ایم ورژن", fa: "نسخهٔ NPM", ps: "د NPM نسخه" },

  "m.db": { en: "Database (Supabase)", ar: "قاعدة البيانات (Supabase)", ur: "ڈیٹابیس (Supabase)", fa: "پایگاه داده (Supabase)", ps: "ډېټابېس (Supabase)" },
  "m.api": { en: "API Health", ar: "صحة API", ur: "API صحت", fa: "سلامت API", ps: "د API روغتیا" },
  "m.resp": { en: "Response Time", ar: "زمن الاستجابة", ur: "رسپانس ٹائم", fa: "زمان پاسخ", ps: "د ځواب وخت" },
  "m.dbConn": { en: "Database Connections", ar: "اتصالات قاعدة البيانات", ur: "ڈیٹابیس کنکشنز", fa: "اتصالات پایگاه داده", ps: "د ډېټابېس اړیکې" },
  "m.activeUsers": { en: "Active Users (15m)", ar: "المستخدمون النشطون (15 د)", ur: "ایکٹو صارفین (15 منٹ)", fa: "کاربران فعال (۱۵ دقیقه)", ps: "فعال کاروونکي (۱۵ دقیقې)" },

  "m.domain": { en: "Domain Status", ar: "حالة النطاق", ur: "ڈومین اسٹیٹس", fa: "وضعیت دامنه", ps: "د ډومین حالت" },
  "m.ssl": { en: "SSL Certificate", ar: "شهادة SSL", ur: "ایس ایس ایل سرٹیفکیٹ", fa: "گواهی SSL", ps: "د SSL سند" },
  "m.backup": { en: "Last Backup", ar: "آخر نسخة احتياطية", ur: "آخری بیک اپ", fa: "آخرین پشتیبان", ps: "وروستی بیک‌اپ" },
  "m.errors": { en: "Error Logs (recent)", ar: "سجلات الأخطاء (حديثة)", ur: "ایرر لاگز (حالیہ)", fa: "گزارش خطاها (اخیر)", ps: "د تېروتنو لاګونه (وروستي)" },
  "m.warnings": { en: "Warning Logs (recent)", ar: "سجلات التحذيرات (حديثة)", ur: "وارننگ لاگز (حالیہ)", fa: "گزارش هشدارها (اخیر)", ps: "د خبردارۍ لاګونه (وروستي)" },

  "v.online": { en: "Online", ar: "متصل", ur: "آن لائن", fa: "آنلاین", ps: "آنلاین" },
  "v.offline": { en: "Offline", ar: "غير متصل", ur: "آف لائن", fa: "آفلاین", ps: "آفلاین" },
  "v.healthy": { en: "Healthy", ar: "سليم", ur: "درست", fa: "سالم", ps: "روغ" },
  "v.degraded": { en: "Degraded", ar: "متدهور", ur: "خراب", fa: "افت‌کرده", ps: "کمزوری" },
  "v.notConfigured": { en: "Not configured", ar: "غير مُهيأ", ur: "کنفیگر نہیں", fa: "پیکربندی‌نشده", ps: "ناتنظیم" },
  "v.active": { en: "Active", ar: "نشط", ur: "فعال", fa: "فعال", ps: "فعال" },
  "v.expired": { en: "Expired", ar: "منتهي", ur: "میعاد ختم", fa: "منقضی", ps: "پای‌ته‌رسېدلی" },
  "v.none": { en: "None", ar: "لا شيء", ur: "کوئی نہیں", fa: "هیچ", ps: "هیڅ" },
  "v.cores": { en: "cores", ar: "أنوية", ur: "کورز", fa: "هسته", ps: "کورونه" },
  "v.daysLeft": { en: "{n} days left", ar: "متبقٍ {n} يوم", ur: "{n} دن باقی", fa: "{n} روز باقی", ps: "{n} ورځې پاتې" },

  "act.quickActions": { en: "Quick Actions", ar: "إجراءات سريعة", ur: "فوری اقدامات", fa: "اقدامات سریع", ps: "چټک اقدامات" },
  "act.restartApp": { en: "Restart Application", ar: "إعادة تشغيل التطبيق", ur: "ایپلیکیشن ری اسٹارٹ", fa: "راه‌اندازی مجدد برنامه", ps: "اپلیکیشن بیا پیل" },
  "act.restartPm2": { en: "Restart PM2", ar: "إعادة تشغيل PM2", ur: "PM2 ری اسٹارٹ", fa: "راه‌اندازی مجدد PM2", ps: "PM2 بیا پیل" },
  "act.health": { en: "Run Health Check", ar: "فحص الصحة", ur: "ہیلتھ چیک چلائیں", fa: "اجرای بررسی سلامت", ps: "د روغتیا معاینه" },
  "act.logs": { en: "View Logs", ar: "عرض السجلات", ur: "لاگز دیکھیں", fa: "مشاهدهٔ گزارش‌ها", ps: "لاګونه وګورئ" },
  "act.github": { en: "Open GitHub", ar: "فتح GitHub", ur: "گٹ ہب کھولیں", fa: "باز کردن GitHub", ps: "GitHub پرانیستل" },
  "act.supabase": { en: "Open Supabase", ar: "فتح Supabase", ur: "Supabase کھولیں", fa: "باز کردن Supabase", ps: "Supabase پرانیستل" },
  "act.deploy": { en: "Check Deployment", ar: "فحص النشر", ur: "ڈیپلائمنٹ چیک کریں", fa: "بررسی استقرار", ps: "ځای‌پرځای‌کول وګورئ" },

  "confirm.restartApp": { en: "Restart the application (PM2 process)? Active users may briefly disconnect.", ar: "إعادة تشغيل التطبيق؟ قد يُقطع اتصال المستخدمين لفترة قصيرة.", ur: "ایپلیکیشن ری اسٹارٹ کریں؟ ایکٹو صارفین کچھ دیر منقطع ہو سکتے ہیں۔", fa: "برنامه راه‌اندازی مجدد شود؟ کاربران فعال ممکن است لحظه‌ای قطع شوند.", ps: "اپلیکیشن بیا پیل شي؟ فعال کاروونکي یوه شېبه بندیدلی شي." },
  "confirm.restartPm2": { en: "Restart ALL PM2 processes on the server? This affects every app managed by PM2.", ar: "إعادة تشغيل كل عمليات PM2؟ سيؤثر على كل تطبيق يديره PM2.", ur: "سرور کی تمام PM2 پروسیسز ری اسٹارٹ کریں؟ یہ PM2 کے ہر ایپ کو متاثر کرے گا۔", fa: "همهٔ فرآیندهای PM2 راه‌اندازی مجدد شوند؟ روی همهٔ برنامه‌ها اثر می‌گذارد.", ps: "د PM2 ټولې پروسې بیا پیل شي؟ دا به د PM2 هر اپ اغیزمن کړي." },

  "tbl.status": { en: "Status", ar: "الحالة", ur: "اسٹیٹس", fa: "وضعیت", ps: "حالت" },
  "tbl.time": { en: "Date & Time", ar: "التاريخ والوقت", ur: "تاریخ و وقت", fa: "تاریخ و زمان", ps: "نېټه او وخت" },
  "tbl.event": { en: "Event", ar: "الحدث", ur: "ایونٹ", fa: "رویداد", ps: "پیښه" },
  "tbl.user": { en: "User", ar: "المستخدم", ur: "صارف", fa: "کاربر", ps: "کاروونکی" },
  "tbl.branch": { en: "Branch", ar: "الفرع", ur: "برانچ", fa: "شاخه", ps: "څانګه" },
  "tbl.details": { en: "Details", ar: "التفاصيل", ur: "تفصیلات", fa: "جزئیات", ps: "جزئیات" },
  "tbl.name": { en: "Name", ar: "الاسم", ur: "نام", fa: "نام", ps: "نوم" },
  "tbl.cpu": { en: "CPU", ar: "المعالج", ur: "سی پی یو", fa: "پردازنده", ps: "CPU" },
  "tbl.mem": { en: "Memory", ar: "الذاكرة", ur: "میموری", fa: "حافظه", ps: "حافظه" },
  "tbl.restarts": { en: "Restarts", ar: "إعادة التشغيل", ur: "ری اسٹارٹس", fa: "راه‌اندازی‌ها", ps: "بیا پیلونه" },
  "tbl.uptime": { en: "Uptime", ar: "مدة التشغيل", ur: "اپ ٹائم", fa: "زمان کارکرد", ps: "کاري وخت" },

  "pm2.title": { en: "PM2 Processes", ar: "عمليات PM2", ur: "PM2 پروسیسز", fa: "فرآیندهای PM2", ps: "د PM2 پروسې" },
  "history.title": { en: "Event History & Logs", ar: "سجل الأحداث", ur: "ایونٹ ہسٹری اور لاگز", fa: "تاریخچهٔ رویدادها", ps: "د پیښو تاریخچه" },
  "history.empty": { en: "No events recorded yet. Deployments, restarts and health checks will appear here.", ar: "لا توجد أحداث بعد. ستظهر عمليات النشر والتشغيل والفحص هنا.", ur: "ابھی کوئی ایونٹ نہیں۔ ڈیپلائمنٹ، ری اسٹارٹ اور ہیلتھ چیک یہاں ظاہر ہوں گے۔", fa: "هنوز رویدادی ثبت نشده است. استقرارها و بررسی‌ها اینجا نمایش داده می‌شوند.", ps: "تر اوسه پیښه نشته. ځای‌پرځای‌کول، بیا پیلونه او معاینې به دلته ښکاره شي." },
  footer: { en: "All data collected live from the server, database, GitHub and your domain.", ar: "جميع البيانات مباشرة من الخادم وقاعدة البيانات و GitHub والنطاق.", ur: "تمام ڈیٹا سرور، ڈیٹابیس، گٹ ہب اور آپ کے ڈومین سے لائیو۔", fa: "همهٔ داده‌ها به‌صورت زنده از سرور، پایگاه داده، GitHub و دامنه.", ps: "ټول معلومات ژوندي د سرور، ډېټابېس، GitHub او ستاسو د ډومین څخه." },
  superadminOnly: { en: "Restart and health-check actions are restricted to super admins.", ar: "إجراءات إعادة التشغيل والفحص مقصورة على المشرفين.", ur: "ری اسٹارٹ اور ہیلتھ چیک صرف سپر ایڈمن کے لیے ہیں۔", fa: "اقدامات راه‌اندازی و بررسی فقط برای مدیران ارشد است.", ps: "بیا پیل او معاینه یوازې د سوپر اډمینانو لپاره ده." },
  "notice.done": { en: "Action completed.", ar: "تم تنفيذ الإجراء.", ur: "ایکشن مکمل۔", fa: "اقدام انجام شد.", ps: "کړنه بشپړه شوه." },
  "notice.failed": { en: "Action failed.", ar: "فشل الإجراء.", ur: "ایکشن ناکام۔", fa: "اقدام ناموفق بود.", ps: "کړنه ناکامه شوه." }
};

export function mt(lang: SupportedLanguage, key: MonitorKey, params?: Record<string, string | number>): string {
  const row = DICT[key];
  let text = (row && (row[lang] || row.en)) || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, String(v));
  }
  return text;
}
