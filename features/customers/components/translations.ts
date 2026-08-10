import type { SupportedLanguage } from "@/lib/i18n/languages";

export const customerTranslations: Record<string, Record<SupportedLanguage, string>> = {
  // Page titles & navigation
  customersTitle: {
    en: "Customer Management",
    ur: "کسٹمر مینجمنٹ",
    ar: "إدارة العملاء",
    fa: "مدیریت مشتریان",
    ps: "د پیرودونکو مدیریت"
  },
  customerDetails: {
    en: "Customer Details",
    ur: "کسٹمر کی تفصیلات",
    ar: "تفاصيل العميل",
    fa: "جزئیات مشتری",
    ps: "د پیرودونکي توضیحات"
  },
  addEditCustomer: {
    en: "Add / Edit Customer (Form View)",
    ur: "کسٹمر کا اندراج / تبدیلی (فارم ویو)",
    ar: "إضافة / تعديل عميل (عرض النموذج)",
    fa: "افزودن / ویرایش مشتری (نمای فرم)",
    ps: "پیرودونکی اضافه / سم کړئ (د فارم بڼه)"
  },
  customerProfileTitle: {
    en: "Customer Profile / Report View",
    ur: "کسٹمر پروفائل / رپورٹ ویو",
    ar: "ملف العميل / عرض التقرير",
    fa: "نمایه مشتری / نمای گزارش",
    ps: "د پیرودونکي پیژندنه / د راپور بڼه"
  },
  createOrUpdateCustomerSub: {
    en: "Create new customer or update existing customer information",
    ur: "نیا کسٹمر بنائیں یا موجودہ کسٹمر کی معلومات تبدیل کریں",
    ar: "إنشاء عميل جديد أو تحديث معلومات العميل الحالية",
    fa: "ایجاد مشتری جدید یا بروزرسانی اطلاعات مشتری موجود",
    ps: "نوی پیرودونکی رامینځته کړئ یا د شته معلوماتو تازه کول"
  },
  backToCustomers: {
    en: "Back to Customers",
    ur: "کسٹمرز پر واپس جائیں",
    ar: "العودة إلى العملاء",
    fa: "بازگشت به مشتریان",
    ps: "بیرته پیرودونکو ته"
  },
  backToList: {
    en: "Back to List",
    ur: "فہرست پر واپس جائیں",
    ar: "العودة إلى القائمة",
    fa: "بازگشت به لیست",
    ps: "بیرته لیست ته"
  },

  // Sections
  personalInfo: {
    en: "Personal Information",
    ur: "ذاتی معلومات",
    ar: "معلومات شخصية",
    fa: "اطلاعات شخصی",
    ps: "شخصي معلومات"
  },
  locationInfo: {
    en: "Location Information",
    ur: "مقام کی معلومات",
    ar: "معلومات الموقع",
    fa: "اطلاعات موقعیت",
    ps: "د ځای معلومات"
  },
  contactInfo: {
    en: "Contact Information",
    ur: "رابطہ کی معلومات",
    ar: "معلومات الاتصال",
    fa: "اطلاعات تماس",
    ps: "د اړيکې معلومات"
  },
  documentInfo: {
    en: "Document Information",
    ur: "دستاویز کی معلومات",
    ar: "معلومات الوثيقة",
    fa: "اطلاعات سند",
    ps: "د سند معلومات"
  },
  accountInfo: {
    en: "Account Information",
    ur: "اکاؤنٹ کی معلومات",
    ar: "معلومات الحساب",
    fa: "اطلاعات حساب",
    ps: "د حساب معلومات"
  },
  additionalInfo: {
    en: "Additional Information",
    ur: "اضافی معلومات",
    ar: "معلومات إضافية",
    fa: "اطلاعات اضافی",
    ps: "اضافي معلومات"
  },

  // Fields
  customerType: {
    en: "Customer Type",
    ur: "کسٹمر کی قسم",
    ar: "نوع العميل",
    fa: "نوع مشتری",
    ps: "د پیریدونکي ډول"
  },
  firstName: {
    en: "First Name",
    ur: "پہلا نام",
    ar: "الاسم الأول",
    fa: "نام",
    ps: "لومړی نوم"
  },
  lastName: {
    en: "Last Name",
    ur: "آخری نام",
    ar: "اسم العائلة",
    fa: "نام خانوادگی",
    ps: "تخلص"
  },
  fatherNameRepresentative: {
    en: "Father Name / Representative",
    ur: "والد کا نام / نمائندہ",
    ar: "اسم الأب / الممثل",
    fa: "نام پدر / نماینده",
    ps: "د پلار نوم / استازی"
  },
  country: {
    en: "Country",
    ur: "ملک",
    ar: "البلد",
    fa: "کشور",
    ps: "هیواد"
  },
  stateProvince: {
    en: "State / Province",
    ur: "ریاست / صوبہ",
    ar: "الولاية / المقاطعة",
    fa: "استان / ایالت",
    ps: "ولایت"
  },
  city: {
    en: "City",
    ur: "شہر",
    ar: "المدينة",
    fa: "شهر",
    ps: "ښار"
  },
  cityCode: {
    en: "City Code",
    ur: "شہر کا کوڈ",
    ar: "رمز المدينة",
    fa: "کد شهر",
    ps: "د ښار کوډ"
  },
  fullAddress: {
    en: "Full Address",
    ur: "مکمل پتہ",
    ar: "العنوان بالكامل",
    fa: "آدرس کامل",
    ps: "بشپړ پته"
  },
  contactType: {
    en: "Contact Type",
    ur: "رابطے کی قسم",
    ar: "نوع الاتصال",
    fa: "نوع تماس",
    ps: "د اړیکې ډول"
  },
  contactNumber: {
    en: "Contact Number",
    ur: "رابطہ نمبر",
    ar: "رقم الاتصال",
    fa: "شماره تماس",
    ps: "د اړيکې شمېره"
  },
  whatsappNumber: {
    en: "WhatsApp Number",
    ur: "واٹس ایپ نمبر",
    ar: "رقم الواتساب",
    fa: "شماره واتساپ",
    ps: "د واټساپ شمېره"
  },
  emailAddress: {
    en: "Email Address",
    ur: "ای میل ایڈریس",
    ar: "البريد الإلكتروني",
    fa: "آدرس ایمیل",
    ps: "برښناليک پته"
  },
  documentType: {
    en: "Document Type",
    ur: "دستاویز کی قسم",
    ar: "نوع الوثيقة",
    fa: "نوع سند",
    ps: "د سند ډول"
  },
  documentNumber: {
    en: "Document Number",
    ur: "دستاویز کا نمبر",
    ar: "رقم الوثيقة",
    fa: "شماره سند",
    ps: "د سند شمېره"
  },
  documentUpload: {
    en: "Document Upload",
    ur: "دستاویز اپ لوڈ",
    ar: "تحميل الوثيقة",
    fa: "بارگذاری سند",
    ps: "سند پورته کول"
  },
  customerAccountNumber: {
    en: "Customer Account Number",
    ur: "کسٹمر اکاؤنٹ نمبر",
    ar: "رقم حساب العميل",
    fa: "شماره حساب مشتری",
    ps: "د پیریدونکي حساب شمیره"
  },
  ledgerNumber: {
    en: "Ledger Number",
    ur: "لیجر نمبر",
    ar: "رقم دفتر الأستاذ",
    fa: "شماره دفتر کل",
    ps: "د لیجر شمیره"
  },
  openingBalance: {
    en: "Opening Balance",
    ur: "افتتاحی بقایا",
    ar: "الرصيد الافتتاحي",
    fa: "تراز افتتاحیه",
    ps: "لومړنی بیلانس"
  },
  currentBalance: {
    en: "Current Balance",
    ur: "موجودہ بقایا",
    ar: "الرصيد الحالي",
    fa: "تراز فعلی",
    ps: "اوسنی بیلانس"
  },
  status: {
    en: "Status",
    ur: "حالت",
    ar: "الحالة",
    fa: "وضعیت",
    ps: "حالت"
  },
  remarksNotes: {
    en: "Remarks / Notes",
    ur: "ریمارکس / نوٹس",
    ar: "ملاحظات",
    fa: "توضیحات / یادداشت",
    ps: "یادونې"
  },

  // Buttons & Actions
  reset: {
    en: "Reset",
    ur: "ری سیٹ",
    ar: "إعادة تعيين",
    fa: "بازنشانی",
    ps: "بیا تنظیمول"
  },
  saveCustomer: {
    en: "Save Customer",
    ur: "کسٹمر محفوظ کریں",
    ar: "حفظ العميل",
    fa: "ذخیره مشتری",
    ps: "پیرودونکی خوندي کړئ"
  },
  editCustomer: {
    en: "Edit Customer",
    ur: "تبدیلی کریں",
    ar: "تعديل العميل",
    fa: "ویرایش مشتری",
    ps: "پیرودونکی سم کړئ"
  },
  print: {
    en: "Print",
    ur: "پرنٹ کریں",
    ar: "طباعة",
    fa: "چاپ",
    ps: "چاپ کړه"
  },
  exportPdf: {
    en: "Export PDF",
    ur: "پی ڈی ایف ایکسپورٹ",
    ar: "تصدير PDF",
    fa: "خروجی PDF",
    ps: "PDF ایکسپورٹ"
  },
  exportExcel: {
    en: "Export Excel",
    ur: "ایکسل ایکسپورٹ",
    ar: "تصدير Excel",
    fa: "خروجی Excel",
    ps: "Excel ایکسپورٹ"
  },

  // Stats Summary
  totalCustomers: {
    en: "Total Customers",
    ur: "کل کسٹمرز",
    ar: "إجمالي العملاء",
    fa: "کل مشتریان",
    ps: "ټول پیرودونکي"
  },
  activeCustomers: {
    en: "Active Customers",
    ur: "سرگرم کسٹمرز",
    ar: "العملاء النشطين",
    fa: "مشتریان فعال",
    ps: "فعال پیرودونکي"
  },
  inactiveCustomers: {
    en: "Inactive Customers",
    ur: "غیر فعال کسٹمرز",
    ar: "العملاء غير النشطين",
    fa: "مشتریان غیرفعال",
    ps: "غیر فعال پیرودونکي"
  },
  businessCustomers: {
    en: "Business Customers",
    ur: "کاروباری کسٹمرز",
    ar: "عملاء الشركات",
    fa: "مشتریان تجاری",
    ps: "تجاري پیرودونکي"
  },
  individualCustomers: {
    en: "Individual Customers",
    ur: "انفرادی کسٹمرز",
    ar: "العملاء الأفراد",
    fa: "مشتریان حقیقی",
    ps: "انفرادي پیرودونکي"
  },

  // List headings
  customerCode: {
    en: "Customer Code",
    ur: "کسٹمر کوڈ",
    ar: "رمز العميل",
    fa: "کد مشتری",
    ps: "د پیریدونکي کوډ"
  },
  customerName: {
    en: "Customer Name",
    ur: "کسٹمر کا نام",
    ar: "اسم العميل",
    fa: "نام مشتری",
    ps: "د پیریدونکي نوم"
  },
  createdDate: {
    en: "Created Date",
    ur: "تخلیق کی تاریخ",
    ar: "تاريخ الإنشاء",
    fa: "تاریخ ایجاد",
    ps: "د جوړیدو نیټه"
  },
  actions: {
    en: "Actions",
    ur: "اقدامات",
    ar: "الإجراءات",
    fa: "عملیات",
    ps: "کړنې"
  },
  searchPlaceholder: {
    en: "Search by name, code, phone, email...",
    ur: "نام، کوڈ، فون، ای میل سے تلاش کریں...",
    ar: "البحث بالاسم، الرمز، الهاتف، البريد...",
    fa: "جستجو با نام، کد، تلفن، ایمیل...",
    ps: "نوم، کوډ، تلیفون، بریښنالیک له لارې لټون..."
  },
  allStatuses: {
    en: "All Statuses",
    ur: "تمام حالتیں",
    ar: "جميع الحالات",
    fa: "همه وضعیت‌ها",
    ps: "ټول حالتونه"
  },
  filter: {
    en: "Filter",
    ur: "فلٹر",
    ar: "تصفية",
    fa: "فیلتر",
    ps: "فلټر"
  },

  // Profile sidebar
  memberSince: {
    en: "Member Since",
    ur: "ممبر چونکہ",
    ar: "عضو منذ",
    fa: "عضو از",
    ps: "غړی له"
  },
  lastUpdated: {
    en: "Last Updated",
    ur: "آخری بار اپ ڈیٹ",
    ar: "آخر تحديث",
    fa: "آخرین بروزرسانی",
    ps: "وروستی تازه"
  },
  createdBy: {
    en: "Created By",
    ur: "تخلیق کار",
    ar: "أنشئت بواسطة",
    fa: "ایجاد شده توسط",
    ps: "لخوا جوړ شوی"
  },

  // KPI Summary Cards
  branchUserDetails: {
    en: "BRANCH & USER DETAILS",
    ur: "برانچ و صارف کی تفصیلات",
    ar: "تفاصيل الفرع والمستخدم",
    fa: "جزئیات شعبه و کاربر",
    ps: "د څانګې او کارونکي توضیحات"
  },
  personsSummary: {
    en: "PERSONS SUMMARY",
    ur: "افراد کا خلاصہ",
    ar: "ملخص الأشخاص",
    fa: "خلاصه افراد",
    ps: "د کسانو لنډیز"
  },
  typeBreakdown: {
    en: "TYPE BREAKDOWN",
    ur: "اقسام کی تقسیم",
    ar: "توزيع الأنواع",
    fa: "تفکیک انواع",
    ps: "د ډولونو ویش"
  },
  branchesTitle: {
    en: "BRANCHES",
    ur: "برانچیں",
    ar: "الفروع",
    fa: "شعبات",
    ps: "څانګې"
  },
  quickInfoTitle: {
    en: "QUICK INFO",
    ur: "فوری معلومات",
    ar: "معلومات سريعة",
    fa: "اطلاعات سریع",
    ps: "چټک معلومات"
  },
  totalPersonsLabel: {
    en: "Total Persons",
    ur: "کل افراد",
    ar: "إجمالي الأشخاص",
    fa: "کل افراد",
    ps: "ټول کسان"
  },
  activePersonsLabel: {
    en: "Active Persons",
    ur: "فعال افراد",
    ar: "الأشخاص النشطون",
    fa: "افراد فعال",
    ps: "فعال کسان"
  },
  inactivePersonsLabel: {
    en: "Inactive Persons",
    ur: "غیر فعال افراد",
    ar: "الأشخاص غير النشطين",
    fa: "افراد غیرفعال",
    ps: "غیر فعال کسان"
  },
  corporateBusinessLabel: {
    en: "Corporate / Business",
    ur: "کارپوریٹ / کاروباری",
    ar: "شركات / أعمال",
    fa: "شرکتی / تجاری",
    ps: "کارپوریټ / سوداګریز"
  },
  individualPersonalLabel: {
    en: "Individual / Personal",
    ur: "انفرادی / شخصی",
    ar: "أفراد / شخصي",
    fa: "فردی / شخصی",
    ps: "انفراډي / شخصي"
  },
  totalBranchesLabel: {
    en: "Total Branches",
    ur: "کل برانچیں",
    ar: "إجمالي الفروع",
    fa: "کل شعبات",
    ps: "ټولې څانګې"
  },
  activeBranchesLabel: {
    en: "Active Branches",
    ur: "فعال برانچیں",
    ar: "الفروع النشطة",
    fa: "شعبات فعال",
    ps: "فعالې څانګې"
  },
  currencyLabel: {
    en: "Currency",
    ur: "کرنسی",
    ar: "العملة",
    fa: "ارز",
    ps: "اسعار"
  },
  companyLabel: {
    en: "Company",
    ur: "کمپنی",
    ar: "الشركة",
    fa: "شرکت",
    ps: "کمپنۍ"
  },
  financialYearLabel: {
    en: "Financial Year",
    ur: "مالی سال",
    ar: "السنة المالية",
    fa: "سال مالی",
    ps: "مالي کال"
  },
  activeSessionText: {
    en: "Active Session",
    ur: "فعال سیشن",
    ar: "جلسة نشطة",
    fa: "نشست فعال",
    ps: "فعال سیشن"
  },

  // Live Preview keys
  livePreview: {
    en: "Live Preview",
    ur: "لائیو پریویو",
    ar: "معاينة مباشرة",
    fa: "پیش‌نمایش زنده",
    ps: "ژوندی مخکتنه"
  },
  draftPreview: {
    en: "Draft Preview",
    ur: "ڈرافٹ پریویو",
    ar: "مسودة",
    fa: "پیش‌نمایش پیش‌نویس",
    ps: "ناپایلی مخکتنه"
  },
  businessCompanyName: {
    en: "Business / Company Name",
    ur: "کاروبار / کمپنی کا نام",
    ar: "اسم الشركة / النشاط التجارية",
    fa: "نام شرکت / کسب و کار",
    ps: "د سوداګرۍ / شرکت نوم"
  },
  representativeName: {
    en: "Representative Name",
    ur: "نمائندے کا نام",
    ar: "اسم الممثل",
    fa: "نام نماینده",
    ps: "د استازي نوم"
  },
  fatherName: {
    en: "Father Name",
    ur: "والد کا نام",
    ar: "اسم الأب",
    fa: "نام پدر",
    ps: "د پلار نوم"
  },
  location: {
    en: "Location",
    ur: "مقام",
    ar: "الموقع",
    fa: "موقعیت",
    ps: "ځای"
  },
  zipCode: {
    en: "Zip Code",
    ur: "زپ کوڈ",
    ar: "الرمز البريدي",
    fa: "کد پستی",
    ps: "زیپ کوډ"
  },
  contacts: {
    en: "Contacts",
    ur: "رابطے",
    ar: "جهات الاتصال",
    fa: "مخاطبین",
    ps: "اړیکې"
  },
  documents: {
    en: "Documents",
    ur: "دستاویزات",
    ar: "المستندات",
    fa: "اسناد",
    ps: "اسناد"
  },
  noContactsEntered: {
    en: "No contacts entered",
    ur: "کوئی رابطہ درج نہیں ہوا",
    ar: "لم يتم إدخال اتصالات",
    fa: "هیچ تماسی وارد نشده",
    ps: "هیڅ اړیکه نه ده داخل شوې"
  },
  noDocumentsEntered: {
    en: "No documents entered",
    ur: "کوئی دستاویز درج نہیں ہوئی",
    ar: "لم يتم إدخال مستندات",
    fa: "هیچ سندی وارد نشده",
    ps: "هیڅ سند نه دی داخل شوی"
  },
  newCustomer: {
    en: "New Customer",
    ur: "نیا گاہک",
    ar: "عميل جديد",
    fa: "مشتری جدید",
    ps: "نوی پیرودونکی"
  },
  newBusiness: {
    en: "New Business",
    ur: "نیا کاروبار",
    ar: "نشاط تجاري جديد",
    fa: "کسب و کار جدید",
    ps: "نوی سوداګري"
  }
};

export function getLabel(key: string, lang: SupportedLanguage): string {
  const dict = customerTranslations[key];
  if (!dict) return key;
  return dict[lang] || dict["en"];
}
