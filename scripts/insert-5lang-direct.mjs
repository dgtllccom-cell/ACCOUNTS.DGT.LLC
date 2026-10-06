import fs from 'fs';

const uiFilePath = 'lib/i18n/ui.ts';
let lines = fs.readFileSync(uiFilePath, 'utf8').split('\n');

const navTranslations = {
  en: {
    "nav.entry_register": "Entry Register",
    "nav.enterprise_audit_monitoring": "Enterprise Audit & Monitoring",
    "nav.edit_version_history": "Edit / Version History",
    "nav.deleted_records_vault": "Deleted Records",
    "nav.user_activity_productivity": "User Activity",
    "nav.daily_branch_activity": "Daily Activity Reports",
    "nav.security_events": "Security Events",
    "nav.audit_logs": "Audit Logs",
    "nav.export_pdf_center": "Export / PDF Center"
  },
  ur: {
    "nav.entry_register": "اندراج رجسٹر",
    "nav.enterprise_audit_monitoring": "انٹرپرائز آڈٹ اور مانیٹرنگ",
    "nav.edit_version_history": "ترمیم و ورژن ہسٹری",
    "nav.deleted_records_vault": "ڈیلیٹ شدہ ریکارڈز",
    "nav.user_activity_productivity": "صارف کی سرگرمی",
    "nav.daily_branch_activity": "روزانہ سرگرمی کی رپورٹس",
    "nav.security_events": "سیکیورٹی ایونٹس",
    "nav.audit_logs": "آڈٹ لاگز",
    "nav.export_pdf_center": "ایکسپورٹ و پی ڈی ایف سینٹر"
  },
  ar: {
    "nav.entry_register": "سجل القيود",
    "nav.enterprise_audit_monitoring": "تدقيق ومراقبة المؤسسة",
    "nav.edit_version_history": "سجل التعديلات والنسخ",
    "nav.deleted_records_vault": "السجلات المحذوفة",
    "nav.user_activity_productivity": "نشاط المستخدمين",
    "nav.daily_branch_activity": "تقارير النشاط اليومي",
    "nav.security_events": "أحداث الأمان",
    "nav.audit_logs": "سجلات التدقيق",
    "nav.export_pdf_center": "مركز التصدير وملفات PDF"
  },
  fa: {
    "nav.entry_register": "دفتر ثبت ورودی‌ها",
    "nav.enterprise_audit_monitoring": "حسابرسی و نظارت سازمانی",
    "nav.edit_version_history": "تاریخچه ویرایش و نسخه‌ها",
    "nav.deleted_records_vault": "سوابق حذف شده",
    "nav.user_activity_productivity": "فعالیت کاربر",
    "nav.daily_branch_activity": "گزارش‌های فعالیت روزانه",
    "nav.security_events": "رویدادهای امنیتی",
    "nav.audit_logs": "گزارش‌های حسابرسی",
    "nav.export_pdf_center": "مرکز صادرات و PDF"
  },
  ps: {
    "nav.entry_register": "د ننوتلو راجستر",
    "nav.enterprise_audit_monitoring": "د تصدۍ پلټنه او څارنه",
    "nav.edit_version_history": "د ترمیم او نسخې تاریخ",
    "nav.deleted_records_vault": "حذف شوي ریکارډونه",
    "nav.user_activity_productivity": "د کارونکي فعالیت",
    "nav.daily_branch_activity": "ورځني فعالیت راپورونه",
    "nav.security_events": "امنیتي پېښې",
    "nav.audit_logs": "د پلټنې لاګونه",
    "nav.export_pdf_center": "د صادراتو او PDF مرکز"
  }
};

const newLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  newLines.push(line);
  
  for (const [lang, dict] of Object.entries(navTranslations)) {
    if (line.trim() === `const ${lang}: Dict = {`) {
      for (const [k, v] of Object.entries(dict)) {
        newLines.push(`  "${k}": "${v}",`);
      }
    }
  }
}

fs.writeFileSync(uiFilePath, newLines.join('\n'), 'utf8');
console.log('✓ Successfully inserted 5-language nav keys directly below each language declaration!');
