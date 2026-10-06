import fs from 'fs';

const filePath = 'features/accounts/components/translations.ts';
let content = fs.readFileSync(filePath, 'utf8');

const additions = `  createSaveAccount: {
    en: "Create and Save Account",
    ur: "اکاؤنٹ بنائیں اور محفوظ کریں",
    ar: "إنشاء وحفظ الحساب",
    fa: "ایجاد و ذخیره حساب",
    ps: "حساب جوړ او خوندي کړئ"
  },
  updateAccount: {
    en: "Update Account",
    ur: "اکاؤنٹ اپ ڈیٹ کریں",
    ar: "تحديث الحساب",
    fa: "بروزرسانی حساب",
    ps: "حساب تازه کړئ"
  },
  submitForApproval: {
    en: "Submit for Approval",
    ur: "منظوری کے لیے جمع کروائیں",
    ar: "إرسال للموافقة",
    fa: "ارسال برای تایید",
    ps: "د تصویب لپاره وسپارئ"
  },
  simulateCityAdmin: {
    en: "Simulate as City Admin",
    ur: "شہر ایڈمن کے طور پر سمولیشن کریں",
    ar: "المحاكاة كمسؤول المدينة",
    fa: "شبیه‌سازی به عنوان مدیر شهر",
    ps: "د ښار د مدیر په توګه سمولیشن"
  },
  pendingApprovalHint: {
    en: "This account will require Branch Manager approval before activation.",
    ur: "یہ اکاؤنٹ برانچ مینیجر کی منظوری کے بعد فعال ہو گا۔",
    ar: "يتطلب هذا الحساب موافقة مدير الفرع قبل التفعيل.",
    fa: "این حساب قبل از فعال‌سازی نیاز به تایید مدیر شعبه دارد.",
    ps: "دا حساب د فعالیدو دمخه د څانګې مدیر تصویب ته اړتیا لري."
  },
  saving: {
    en: "Saving Account...",
    ur: "اکاؤنٹ محفوظ ہو رہا ہے...",
    ar: "جاري حفظ الحساب...",
    fa: "در حال ذخیره حساب...",
    ps: "حساب خوندي کیږي..."
  },
  reviewDetailsHint: {
    en: "Please review all details before creating the account.",
    ur: "اکاؤنٹ بنانے سے پہلے تمام تفصیلات کا جائزہ لیں۔",
    ar: "يرجى مراجعة كافة التفاصيل قبل إنشاء الحساب.",
    fa: "لطفاً قبل از ایجاد حساب، تمام جزئیات را بررسی کنید.",
    ps: "مهرباني وکړئ د حساب جوړولو دمخه ټول توضیحات بیاکتنه وکړئ."
  },
  linkedMasterRecords: {
    en: "Linked Master Records",
    ur: "منسلک ماسٹر ریکارڈز",
    ar: "السجلات الرئيسية المرتبطة",
    fa: "سوابق اصلی متصل",
    ps: "تړلي اصلي ریکارډونه"
  },
  linkedCustomer: {
    en: "Linked Customer",
    ur: "منسلک کسٹمر",
    ar: "العميل المرتبط",
    fa: "مشتری متصل",
    ps: "تړلی پیرودونکی"
  },
  linkedCompany: {
    en: "Linked Company",
    ur: "منسلک کمپنی",
    ar: "الشركة المرتبطة",
    fa: "شرکت متصل",
    ps: "تړلې شرکت"
  },
  linkedBank: {
    en: "Linked Bank",
    ur: "منسلک بینک",
    ar: "البنك المرتبط",
    fa: "بانک متصل",
    ps: "تړلی بانک"
  },
  accountInfo: {
    en: "Account Info",
    ur: "اکاؤنٹ معلومات",
    ar: "معلومات الحساب",
    fa: "اطلاعات حساب",
    ps: "د حساب معلومات"
  },
  manualReference: {
    en: "Manual Ref",
    ur: "دستی حوالہ",
    ar: "المرجع اليدوي",
    fa: "مرجع دستی",
    ps: "لاسي مرجع"
  },
  noCompany: {`;

content = content.replace('  noCompany: {', additions);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ translations.ts updated with save labels!');
