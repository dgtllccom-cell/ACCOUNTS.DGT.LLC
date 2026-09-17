import fs from 'fs';

const filePath = 'lib/i18n/ui.ts';
let content = fs.readFileSync(filePath, 'utf8');

const newKeys = [
  'cbill.select_orders',
  'cbill.select_orders_sub',
  'cbill.search_orders_ph',
  'cbill.select_all',
  'cbill.clear_all',
  'cbill.no_orders_found',
  'cbill.assign_user',
  'cbill.assign_user_sub',
  'cbill.transfer_notice',
  'cbill.live_preview',
  'cbill.live_preview_sub',
  'cbill.tab_itemized',
  'cbill.tab_logistics',
  'cbill.tab_notes',
  'cbill.tab_documents',
  'cbill.branch_office',
  'cbill.bill_report',
  'cbill.workflow_route',
  'cbill.customer_details',
  'cbill.open_bill_form',
  'cbill.step_select_orders',
  'cbill.step_assign_user',
  'cbill.step_add_charges',
  'cbill.total_due',
  'cbill.active_badge',
  'cbill.bill_transfer_types'
];

const dicts = {
  en: {
    'cbill.select_orders': 'Select Customer Orders',
    'cbill.select_orders_sub': 'Choose one or more customer orders to include in this bill.',
    'cbill.search_orders_ph': 'Search customer orders...',
    'cbill.select_all': 'Select All',
    'cbill.clear_all': 'Clear All',
    'cbill.no_orders_found': 'No customer orders found.',
    'cbill.assign_user': 'Assign To User',
    'cbill.assign_user_sub': 'Transfer this bill to a user for processing.',
    'cbill.transfer_notice': 'Bill will be transferred to selected user. Selected user will be notified.',
    'cbill.live_preview': 'LIVE BILL PREVIEW',
    'cbill.live_preview_sub': 'Preview of customer bill. Updates in real-time as you add charges.',
    'cbill.tab_itemized': 'Itemized Charges',
    'cbill.tab_logistics': 'Shipment & Logistics',
    'cbill.tab_notes': 'Notes',
    'cbill.tab_documents': 'Documents',
    'cbill.branch_office': 'Branch / Office',
    'cbill.bill_report': 'Bill Generated Report',
    'cbill.workflow_route': 'Transfer / Workflow Route',
    'cbill.customer_details': 'Customer Details',
    'cbill.open_bill_form': 'Open Bill Form',
    'cbill.step_select_orders': 'Select Customer Orders',
    'cbill.step_assign_user': 'Assign To User',
    'cbill.step_add_charges': 'Add Charges',
    'cbill.total_due': 'Total Due',
    'cbill.active_badge': 'Active',
    'cbill.bill_transfer_types': 'Select Bill Transfer Types'
  },
  ur: {
    'cbill.select_orders': 'کسٹمر آرڈرز منتخب کریں',
    'cbill.select_orders_sub': 'اس بل میں شامل کرنے کے لیے ایک یا زیادہ کسٹمر آرڈرز منتخب کریں۔',
    'cbill.search_orders_ph': 'کسٹمر آرڈرز تلاش کریں...',
    'cbill.select_all': 'سب منتخب کریں',
    'cbill.clear_all': 'سب ختم کریں',
    'cbill.no_orders_found': 'کوئی کسٹمر آرڈر نہیں ملا۔',
    'cbill.assign_user': 'صارف کو تفویض کریں',
    'cbill.assign_user_sub': 'پروسیسنگ کے لیے یہ بل صارف کو منتقل کریں۔',
    'cbill.transfer_notice': 'بل منتخب کردہ صارف کو منتقل کیا جائے گا۔ صارف کو مطلع کر دیا جائے گا۔',
    'cbill.live_preview': 'لائیو بل کا پیش منظر',
    'cbill.live_preview_sub': 'کسٹمر بل کا پیش منظر۔ چارجز شامل کرنے پر حقیقی وقت میں اپ ڈیٹ ہوتا ہے۔',
    'cbill.tab_itemized': 'تفصیلی چارجز',
    'cbill.tab_logistics': 'شپمنٹ اور لاجسٹکس',
    'cbill.tab_notes': 'نوٹس',
    'cbill.tab_documents': 'دستاویزات',
    'cbill.branch_office': 'برانچ / دفتر',
    'cbill.bill_report': 'بل رپورٹ',
    'cbill.workflow_route': 'ٹرانسفر / ورک فلو روٹ',
    'cbill.customer_details': 'کسٹمر کی تفصیلات',
    'cbill.open_bill_form': 'بل فارم کھولیں',
    'cbill.step_select_orders': 'کسٹمر آرڈرز منتخب کریں',
    'cbill.step_assign_user': 'صارف کو تفویض کریں',
    'cbill.step_add_charges': 'چارجز شامل کریں',
    'cbill.total_due': 'کل واجب الادا',
    'cbill.active_badge': 'فعال',
    'cbill.bill_transfer_types': 'بل ٹرانسفر کی اقسام منتخب کریں'
  },
  ar: {
    'cbill.select_orders': 'تحديد طلبات العملاء',
    'cbill.select_orders_sub': 'اختر طلب عميل واحد أو أكثر لتضمينه في هذه الفاتورة.',
    'cbill.search_orders_ph': 'البحث في طلبات العملاء...',
    'cbill.select_all': 'تحديد الكل',
    'cbill.clear_all': 'مسح الكل',
    'cbill.no_orders_found': 'لم يتم العثور على طلبات عملاء.',
    'cbill.assign_user': 'تعيين إلى مستخدم',
    'cbill.assign_user_sub': 'تحويل هذه الفاتورة إلى مستخدم للمعالجة.',
    'cbill.transfer_notice': 'سيتم تحويل الفاتورة إلى المستخدم المحدد، وسيتم إخطاره.',
    'cbill.live_preview': 'معاينة الفاتورة المباشرة',
    'cbill.live_preview_sub': 'معاينة فاتورة العميل. يتم التحديث في الوقت الفعلي مع إضافة الرسوم.',
    'cbill.tab_itemized': 'الرسوم المفصلة',
    'cbill.tab_logistics': 'الشحن واللوجستيات',
    'cbill.tab_notes': 'الملاحظات',
    'cbill.tab_documents': 'المستندات',
    'cbill.branch_office': 'الفرع / المكتب',
    'cbill.bill_report': 'تقرير الفاتورة الصادرة',
    'cbill.workflow_route': 'مسار التحويل / سير العمل',
    'cbill.customer_details': 'بيانات العميل',
    'cbill.open_bill_form': 'فتح نموذج الفاتورة',
    'cbill.step_select_orders': 'تحديد طلبات العملاء',
    'cbill.step_assign_user': 'تعيين إلى مستخدم',
    'cbill.step_add_charges': 'إضافة الرسوم',
    'cbill.total_due': 'إجمالي المستحق',
    'cbill.active_badge': 'نشط',
    'cbill.bill_transfer_types': 'تحديد أنواع تحويل الفاتورة'
  },
  fa: {
    'cbill.select_orders': 'انتخاب سفارش‌های مشتری',
    'cbill.select_orders_sub': 'یک یا چند سفارش مشتری را برای درج در این صورت‌حساب انتخاب کنید.',
    'cbill.search_orders_ph': 'جستجوی سفارش‌های مشتری...',
    'cbill.select_all': 'انتخاب همه',
    'cbill.clear_all': 'پاک کردن همه',
    'cbill.no_orders_found': 'هیچ سفارش مشتری یافت نشد.',
    'cbill.assign_user': 'واگذاری به کاربر',
    'cbill.assign_user_sub': 'انتقال این صورت‌حساب به کاربر جهت پردازش.',
    'cbill.transfer_notice': 'صورت‌حساب به کاربر انتخاب‌شده منتقل خواهد شد و به وی اطلاع داده می‌شود.',
    'cbill.live_preview': 'پیش‌نمایش زنده صورت‌حساب',
    'cbill.live_preview_sub': 'پیش‌نمایش صورت‌حساب مشتری. هم‌زمان با افزودن هزینه‌ها به‌روزرسانی می‌شود.',
    'cbill.tab_itemized': 'هزینه‌های تفکیک‌شده',
    'cbill.tab_logistics': 'حمل‌ونقل و لجستیک',
    'cbill.tab_notes': 'یادداشت‌ها',
    'cbill.tab_documents': 'اسناد و مدارک',
    'cbill.branch_office': 'شعبه / دفتر',
    'cbill.bill_report': 'گزارش صورت‌حساب',
    'cbill.workflow_route': 'مسیر انتقال / گردش کار',
    'cbill.customer_details': 'اطلاعات مشتری',
    'cbill.open_bill_form': 'باز کردن فرم صورت‌حساب',
    'cbill.step_select_orders': 'انتخاب سفارش‌های مشتری',
    'cbill.step_assign_user': 'واگذاری به کاربر',
    'cbill.step_add_charges': 'افزودن هزینه‌ها',
    'cbill.total_due': 'مبلغ کل قابل پرداخت',
    'cbill.active_badge': 'فعال',
    'cbill.bill_transfer_types': 'انتخاب انواع انتقال صورت‌حساب'
  },
  ps: {
    'cbill.select_orders': 'د پیرودونکي فرمایشونه وټاکئ',
    'cbill.select_orders_sub': 'په دې بل کې د شاملولو لپاره یو یا څو د پیرودونکي فرمایشونه وټاکئ.',
    'cbill.search_orders_ph': 'د پیرودونکي فرمایشونه وپلټئ...',
    'cbill.select_all': 'ټول وټاکئ',
    'cbill.clear_all': 'ټول پاک کړئ',
    'cbill.no_orders_found': 'د پیرودونکي هیڅ فرمایش ونه موندل شو.',
    'cbill.assign_user': 'کارونکي ته وسپارئ',
    'cbill.assign_user_sub': 'دا بل د پروسس کولو لپاره کارونکي ته انتقال کړئ.',
    'cbill.transfer_notice': 'بل به ټاکل شوي کارونکي ته انتقال شي او هغه ته به خبر ورکړل شي.',
    'cbill.live_preview': 'د بل ژوندی مخکتنه',
    'cbill.live_preview_sub': 'د پیرودونکي د بل مخکتنه. د لګښتونو په اضافه کولو سره سمدستي تازه کیږي.',
    'cbill.tab_itemized': 'تفصيلي لګښتونه',
    'cbill.tab_logistics': 'بار وړل او لوژستیک',
    'cbill.tab_notes': 'یادښتونه',
    'cbill.tab_documents': 'اسناد',
    'cbill.branch_office': 'څانګه / دفتر',
    'cbill.bill_report': 'د بل راپور',
    'cbill.workflow_route': 'د انتقال / کاري جریان لاره',
    'cbill.customer_details': 'د پیرودونکي تفصیلات',
    'cbill.open_bill_form': 'د بل فورمه پرانیزئ',
    'cbill.step_select_orders': 'د پیرودونکي فرمایشونه وټاکئ',
    'cbill.step_assign_user': 'کارونکي ته وسپارئ',
    'cbill.step_add_charges': 'لګښتونه اضافه کړئ',
    'cbill.total_due': 'ټوله پاتې شوې پیسې',
    'cbill.active_badge': 'فعال',
    'cbill.bill_transfer_types': 'د بل لیږد ډولونه وټاکئ'
  }
};

// 1. Insert into UiKey type before '  | "cbill.charge_other"'
const targetUiKey = '  | "cbill.charge_other"';
if (content.includes(targetUiKey)) {
  const uiKeyAdditions = newKeys.map(k => '  | "' + k + '"').join('\n');
  content = content.replace(targetUiKey, targetUiKey + '\n' + uiKeyAdditions);
  console.log('Added keys to UiKey');
}

// 2. Insert into each dict block after '  "cbill.charge_other": ...'
const langs = ['en', 'ur', 'ar', 'fa', 'ps'];
let currentPos = 0;
for (const lang of langs) {
  const map = dicts[lang];
  const langKeyAnchor = '  "cbill.charge_other":';
  const idx = content.indexOf(langKeyAnchor, currentPos);
  if (idx !== -1) {
    const endOfLine = content.indexOf('\n', idx);
    const entriesToAdd = '\n' + Object.entries(map).map(([k, v]) => '  "' + k + '": ' + JSON.stringify(v) + ',').join('\n');
    content = content.slice(0, endOfLine) + entriesToAdd + content.slice(endOfLine);
    currentPos = endOfLine + entriesToAdd.length;
    console.log('Added keys to dictionary:', lang);
  } else {
    console.warn('Anchor not found for:', lang);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated lib/i18n/ui.ts');
