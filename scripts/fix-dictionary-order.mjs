import fs from 'fs';

const uiFilePath = 'lib/i18n/ui.ts';
let content = fs.readFileSync(uiFilePath, 'utf8');

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

// First, clean out all existing occurrences of these keys in ui.ts
for (const key of Object.keys(navTranslations.en)) {
  const reg = new RegExp(`^\\s*"${key}":.*$\\n?`, 'gm');
  content = content.replace(reg, '');
}

// 1. In `en`, place right after `const en: Dict = {`
let enBlock = '';
for (const [k, v] of Object.entries(navTranslations.en)) {
  enBlock += `  "${k}": "${v}",\n`;
}
content = content.replace('const en: Dict = {', `const en: Dict = {\n${enBlock}`);

// 2. In `ur`, `ar`, `fa`, `ps`, place right after `...en,` in their respective dictionaries!
for (const lang of ['ur', 'ar', 'fa', 'ps']) {
  const dictHeader = `const ${lang}: Dict = {`;
  const headerIdx = content.indexOf(dictHeader);
  if (headerIdx !== -1) {
    const spreadIdx = content.indexOf('...en,', headerIdx);
    if (spreadIdx !== -1 && spreadIdx - headerIdx < 100) {
      let langBlock = '\n';
      for (const [k, v] of Object.entries(navTranslations[lang])) {
        langBlock += `  "${k}": "${v}",\n`;
      }
      const insertPos = spreadIdx + '...en,'.length;
      content = content.slice(0, insertPos) + langBlock + content.slice(insertPos);
    }
  }
}

fs.writeFileSync(uiFilePath, content, 'utf8');
console.log('✓ Successfully placed all 5-language nav keys AFTER ...en spread!');
