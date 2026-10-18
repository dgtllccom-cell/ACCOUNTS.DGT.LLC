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
  fatherNameOnly: {
    en: "Father / Guardian Name",
    ur: "والد کا نام",
    ar: "اسم الأب",
    fa: "نام پدر",
    ps: "د پلار نوم"
  },
  filterToggle: {
    en: "Search & Filter",
    ur: "تلاش اور فلٹر",
    ar: "البحث والتصفية",
    fa: "جستجو و فیلتر",
    ps: "لټون او فلټر"
  },
  resetFilters: {
    en: "Reset",
    ur: "ری سیٹ",
    ar: "إعادة ضبط",
    fa: "بازنشانی",
    ps: "بیا تنظیمول"
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
  },
  editCustomerDetails: {
    en: "Edit Customer Details",
    ur: "کسٹمر کی تفصیلات میں تبدیلی",
    ar: "تعديل تفاصيل العميل",
    fa: "ویرایش جزئیات مشتری",
    ps: "د پیرودونکي توضیحات سمول"
  },
  updateExistingCustomerSub: {
    en: "Update existing customer registry records",
    ur: "موجودہ کسٹمر رجسٹری ریکارڈ اپ ڈیٹ کریں",
    ar: "تحديث سجلات العملاء الحالية",
    fa: "بروزرسانی سوابق ثبت‌شده مشتری موجود",
    ps: "شته پیرودونکي ثبت ریکارډونه تازه کړئ"
  },
  ready: {
    en: "Ready",
    ur: "تیار",
    ar: "جاهز",
    fa: "آماده",
    ps: "چمتو"
  },
  draftStatus: {
    en: "Draft",
    ur: "مسودہ",
    ar: "مسودة",
    fa: "پیش‌نویس",
    ps: "مسوده"
  },
  stepPersonalInfo: {
    en: "1. Personal Info",
    ur: "۱۔ ذاتی معلومات",
    ar: "١. المعلومات الشخصية",
    fa: "۱. اطلاعات شخصی",
    ps: "۱. شخصي معلومات"
  },
  stepLocation: {
    en: "2. Location",
    ur: "۲۔ مقام",
    ar: "٢. الموقع",
    fa: "۲. موقعیت",
    ps: "۲. ځای"
  },
  stepContactsDocs: {
    en: "3. Contacts & Docs",
    ur: "۳۔ رابطے اور دستاویزات",
    ar: "٣. الاتصال والمستندات",
    fa: "۳. تماس‌ها و اسناد",
    ps: "۳. اړیکې او اسناد"
  },
  stepReviewSave: {
    en: "4. Review & Save",
    ur: "۴۔ جائزہ اور محفوظ کریں",
    ar: "٤. المراجعة والحفظ",
    fa: "۴. بررسی و ذخیره",
    ps: "۴. بیاکتنه او خوندي کول"
  },
  businessNameCompanyName: {
    en: "Business Name / Company Name",
    ur: "کاروبار کا نام / کمپنی کا نام",
    ar: "اسم النشاط التجاري / اسم الشركة",
    fa: "نام کسب و کار / نام شرکت",
    ps: "د سوداګرۍ نوم / د شرکت نوم"
  },
  representativeFirstName: {
    en: "Representative First Name",
    ur: "نمائندے کا پہلا نام",
    ar: "الاسم الأول للممثل",
    fa: "نام نماینده",
    ps: "د استازي لومړی نوم"
  },
  representativeLastName: {
    en: "Representative Last Name",
    ur: "نمائندے کا آخری نام",
    ar: "اسم عائلة الممثل",
    fa: "نام خانوادگی نماینده",
    ps: "د استازي تخلص"
  },
  passportSizePicture: {
    en: "Passport Size Picture",
    ur: "پاسپورٹ سائز تصویر",
    ar: "صورة بحجم جواز السفر",
    fa: "عکس پاسپورتی",
    ps: "د پاسپورټ اندازه عکس"
  },
  attach: {
    en: "Attach",
    ur: "منسلک کریں",
    ar: "إرفاق",
    fa: "پیوست",
    ps: "ضمیمه کول"
  },
  addContact: {
    en: "+ Add Contact",
    ur: "+ رابطہ شامل کریں",
    ar: "+ إضافة جهة اتصال",
    fa: "+ افزودن مخاطب",
    ps: "+ اړیکه اضافه کړئ"
  },
  addDocument: {
    en: "+ Add Document",
    ur: "+ دستاویز شامل کریں",
    ar: "+ إضافة مستند",
    fa: "+ افزودن سند",
    ps: "+ سند اضافه کړئ"
  },
  typeLabel: {
    en: "Type",
    ur: "قسم",
    ar: "النوع",
    fa: "نوع",
    ps: "ډول"
  },
  contactValue: {
    en: "Contact Value",
    ur: "رابطہ کی قدر",
    ar: "قيمة الاتصال",
    fa: "مقدار تماس",
    ps: "د اړیکې ارزښت"
  },
  customType: {
    en: "+ Custom Type",
    ur: "+ حسب ضرورت قسم",
    ar: "+ نوع مخصص",
    fa: "+ نوع سفارشی",
    ps: "+ دودیز ډول"
  },
  removeAction: {
    en: "Remove",
    ur: "حذف کریں",
    ar: "إزالة",
    fa: "حذف",
    ps: "لرې کول"
  },
  activeStatus: {
    en: "Active",
    ur: "فعال",
    ar: "نشط",
    fa: "فعال",
    ps: "فعال"
  },
  inactiveStatus: {
    en: "Inactive",
    ur: "غیر فعال",
    ar: "غير نشط",
    fa: "غیرفعال",
    ps: "غیر فعال"
  },
  backButton: {
    en: "Back",
    ur: "پیچھے",
    ar: "رجوع",
    fa: "بازگشت",
    ps: "شاته"
  },
  nextButton: {
    en: "Next",
    ur: "اگلا",
    ar: "التالي",
    fa: "بعدی",
    ps: "بل"
  },
  savingLabel: {
    en: "Saving...",
    ur: "محفوظ ہو رہا ہے...",
    ar: "جارٍ الحفظ...",
    fa: "در حال ذخیره...",
    ps: "خوندي کیږي..."
  },
  completeRequiredFieldsMsg: {
    en: "Please complete all required fields first.",
    ur: "براہ کرم پہلے تمام لازمی خانے مکمل کریں۔",
    ar: "يرجى إكمال جميع الحقول المطلوبة أولاً.",
    fa: "لطفاً ابتدا تمام فیلدهای الزامی را تکمیل کنید.",
    ps: "مهرباني وکړئ لومړی ټول اړین ډګرونه بشپړ کړئ."
  },
  customerUpdatedMsg: {
    en: "Customer details updated successfully.",
    ur: "کسٹمر کی تفصیلات کامیابی سے اپ ڈیٹ ہو گئیں۔",
    ar: "تم تحديث تفاصيل العميل بنجاح.",
    fa: "جزئیات مشتری با موفقیت به‌روزرسانی شد.",
    ps: "د پیرودونکي توضیحات په بریالیتوب سره تازه شول."
  },
  customerCreatedMsg: {
    en: "Customer profile incorporated successfully.",
    ur: "کسٹمر پروفائل کامیابی سے شامل ہو گئی۔",
    ar: "تم إدراج ملف العميل بنجاح.",
    fa: "نمایه مشتری با موفقیت ثبت شد.",
    ps: "د پیرودونکي پروفایل په بریالیتوب سره ثبت شو."
  },

  // List page & print certificate
  officialCustomerProfileCertificate: {
    en: "Official Customer Profile Certificate",
    ur: "سرکاری کسٹمر پروفائل سرٹیفکیٹ",
    ar: "شهادة ملف العميل الرسمية",
    fa: "گواهی رسمی نمایه مشتری",
    ps: "رسمي د پیرودونکي پروفایل سند"
  },
  customerAccountCode: {
    en: "Customer Account Code",
    ur: "کسٹمر اکاؤنٹ کوڈ",
    ar: "رمز حساب العميل",
    fa: "کد حساب مشتری",
    ps: "د پیرودونکي حساب کوډ"
  },
  zipCityCode: {
    en: "Zip / City Code",
    ur: "زپ / شہر کوڈ",
    ar: "الرمز البريدي / رمز المدينة",
    fa: "کد پستی / کد شهر",
    ps: "زیپ / د ښار کوډ"
  },
  countryStateCity: {
    en: "Country / State / City",
    ur: "ملک / ریاست / شہر",
    ar: "البلد / الولاية / المدينة",
    fa: "کشور / استان / شهر",
    ps: "هیواد / ولایت / ښار"
  },
  noContactsRegistered: {
    en: "No contacts registered.",
    ur: "کوئی رابطہ رجسٹرڈ نہیں۔",
    ar: "لا توجد جهات اتصال مسجلة.",
    fa: "هیچ تماسی ثبت نشده است.",
    ps: "هیڅ اړیکه ثبت شوې نده."
  },
  noDocumentsRegistered: {
    en: "No documents registered.",
    ur: "کوئی دستاویز رجسٹرڈ نہیں۔",
    ar: "لا توجد مستندات مسجلة.",
    fa: "هیچ سندی ثبت نشده است.",
    ps: "هیڅ سند ثبت شوی نه دی."
  },
  customerListDirectory: {
    en: "Customer List Directory",
    ur: "کسٹمر لسٹ ڈائریکٹری",
    ar: "دليل قائمة العملاء",
    fa: "فهرست راهنمای مشتریان",
    ps: "د پیرودونکو لیست لارښود"
  },
  useActionsToViewEditPrintMsg: {
    en: "Use actions to view, edit, print profiles, or review history.",
    ur: "پروفائل دیکھنے، ترمیم کرنے، پرنٹ کرنے یا تاریخ کا جائزہ لینے کے لیے ایکشنز استعمال کریں۔",
    ar: "استخدم الإجراءات لعرض الملفات الشخصية أو تعديلها أو طباعتها أو مراجعة السجل.",
    fa: "برای مشاهده، ویرایش، چاپ نمایه‌ها یا بررسی سابقه از عملیات استفاده کنید.",
    ps: "د پروفایلونو کتلو، سمولو، چاپولو یا تاریخچې بیاکتلو لپاره کړنې وکاروئ."
  },
  loadingCustomerRegistryDirectory: {
    en: "Loading Customer Registry Directory...",
    ur: "کسٹمر رجسٹری ڈائریکٹری لوڈ ہو رہی ہے...",
    ar: "جارٍ تحميل دليل سجل العملاء...",
    fa: "در حال بارگیری فهرست ثبت مشتریان...",
    ps: "د پیرودونکو ثبت لارښود پورته کیږي..."
  },
  allContacts: {
    en: "All Contacts",
    ur: "تمام رابطے",
    ar: "جميع جهات الاتصال",
    fa: "همه مخاطبین",
    ps: "ټولې اړیکې"
  },
  noCustomersFoundFilterMsg: {
    en: "No customers found in directory registry matching the filters.",
    ur: "فلٹرز سے مماثل کوئی کسٹمر ڈائریکٹری رجسٹری میں نہیں ملا۔",
    ar: "لم يتم العثور على عملاء في دليل السجل مطابقين للمرشحات.",
    fa: "هیچ مشتری‌ای در فهرست ثبت مطابق با فیلترها یافت نشد.",
    ps: "د فلټرونو سره سم هیڅ پیرودونکی په لارښود ثبت کې ونه موندل شو."
  },
  customerProfileDetailsTitle: {
    en: "Customer Profile Details",
    ur: "کسٹمر پروفائل کی تفصیلات",
    ar: "تفاصيل ملف العميل",
    fa: "جزئیات نمایه مشتری",
    ps: "د پیرودونکي پروفایل توضیحات"
  },
  enterpriseRecordContactVerificationSub: {
    en: "Enterprise record and contact verification",
    ur: "انٹرپرائز ریکارڈ اور رابطہ تصدیق",
    ar: "سجل المؤسسة والتحقق من الاتصال",
    fa: "سابقه سازمانی و تأیید تماس",
    ps: "د سازمان ریکارډ او اړیکې تصدیق"
  },
  customerOwnerDirectoryReportTitle: {
    en: "Customer / Owner Directory Report",
    ur: "کسٹمر / مالک ڈائریکٹری رپورٹ",
    ar: "تقرير دليل العميل / المالك",
    fa: "گزارش فهرست مشتری / مالک",
    ps: "د پیرودونکي / مالک لارښود راپور"
  },
  completeMasterCustomerDirectorySub: {
    en: "Complete Master Customer, Client, and Business Owner Directory",
    ur: "مکمل ماسٹر کسٹمر، کلائنٹ اور بزنس اونر ڈائریکٹری",
    ar: "دليل رئيسي كامل للعملاء والزبائن وأصحاب الأعمال",
    fa: "فهرست کامل اصلی مشتری، ارباب‌رجوع و مالک کسب‌وکار",
    ps: "بشپړ اصلي پیرودونکی، پیرودونکی، او سوداګریز مالک لارښود"
  },
  searchQueryLabel: {
    en: "Search Query",
    ur: "تلاش کی درخواست",
    ar: "استعلام البحث",
    fa: "عبارت جستجو",
    ps: "د لټون پوښتنه"
  },
  customerOwnerNameLabel: {
    en: "Customer / Owner Name",
    ur: "کسٹمر / مالک کا نام",
    ar: "اسم العميل / المالك",
    fa: "نام مشتری / مالک",
    ps: "د پیرودونکي / مالک نوم"
  },
  companyFirmNameLabel: {
    en: "Company / Firm Name",
    ur: "کمپنی / فرم کا نام",
    ar: "اسم الشركة / المؤسسة",
    fa: "نام شرکت / مؤسسه",
    ps: "د شرکت / فرم نوم"
  },

  // Customer form fields
  quickSaveAvailableLabel: {
    en: "Quick Save Available:",
    ur: "فوری محفوظ کاری دستیاب:",
    ar: "الحفظ السريع متاح:",
    fa: "ذخیره سریع در دسترس است:",
    ps: "چټک خوندي کول شتون لري:"
  },
  quickSaveAvailableMsg: {
    en: "Enter Name and click Save & Finalize anytime.",
    ur: "نام درج کریں اور کسی بھی وقت محفوظ کریں اور حتمی کریں پر کلک کریں۔",
    ar: "أدخل الاسم واضغط على حفظ وإنهاء في أي وقت.",
    fa: "نام را وارد کنید و در هر زمان روی ذخیره و نهایی‌سازی کلیک کنید.",
    ps: "نوم دننه کړئ او هر وخت خوندي کول او پای ته رسول کلیک کړئ."
  },
  officeContactType: {
    en: "Office",
    ur: "دفتر",
    ar: "المكتب",
    fa: "دفتر",
    ps: "دفتر"
  },
  typeCustomContactLabelName: {
    en: "Type Custom Contact Label Name",
    ur: "حسب ضرورت رابطہ لیبل کا نام ٹائپ کریں",
    ar: "اكتب اسم تسمية اتصال مخصص",
    fa: "نام برچسب تماس سفارشی را تایپ کنید",
    ps: "دودیز د اړیکې لیبل نوم ولیکئ"
  },
  passportDocType: {
    en: "Passport",
    ur: "پاسپورٹ",
    ar: "جواز السفر",
    fa: "پاسپورت",
    ps: "پاسپورټ"
  },
  nationalIdDocType: {
    en: "National ID",
    ur: "قومی شناختی کارڈ",
    ar: "الهوية الوطنية",
    fa: "کارت ملی",
    ps: "ملي پیژندنه"
  },
  tradeLicenseDocType: {
    en: "Trade License",
    ur: "ٹریڈ لائسنس",
    ar: "الرخصة التجارية",
    fa: "مجوز تجاری",
    ps: "سوداګریز جواز"
  },
  typeCustomDocumentLabelName: {
    en: "Type Custom Document Label Name",
    ur: "حسب ضرورت دستاویز لیبل کا نام ٹائپ کریں",
    ar: "اكتب اسم تسمية مستند مخصص",
    fa: "نام برچسب سند سفارشی را تایپ کنید",
    ps: "دودیز د سند لیبل نوم ولیکئ"
  },
  companyNamePlaceholderExample: {
    en: "e.g. ABC Traders (Pvt) Ltd.",
    ur: "مثال کے طور پر ABC ٹریڈرز (پرائیویٹ) لمیٹڈ",
    ar: "مثال: شركة ABC للتجارة (خاصة) المحدودة",
    fa: "مثال: ABC Traders (خصوصی) با مسئولیت محدود",
    ps: "بیلګه: ABC سوداګر (خصوصي) محدود"
  },
  cityZipCodePlaceholder: {
    en: "City / Zip Code",
    ur: "شہر / زپ کوڈ",
    ar: "المدينة / الرمز البريدي",
    fa: "شهر / کد پستی",
    ps: "ښار / زیپ کوډ"
  },
  faxOrSkypeIdPlaceholder: {
    en: "e.g. Fax or Skype ID",
    ur: "مثال کے طور پر فیکس یا اسکائپ آئی ڈی",
    ar: "مثال: فاكس أو معرف سكايب",
    fa: "مثال: فکس یا شناسه اسکایپ",
    ps: "بیلګه: فیکس یا سکایپ ID"
  },
  taxCertificateTradeLicensePlaceholder: {
    en: "e.g. Tax Certificate or Trade License",
    ur: "مثال کے طور پر ٹیکس سرٹیفکیٹ یا ٹریڈ لائسنس",
    ar: "مثال: شهادة ضريبية أو رخصة تجارية",
    fa: "مثال: گواهی مالیاتی یا مجوز تجاری",
    ps: "بیلګه: مالیاتي سند یا سوداګریز جواز"
  },
  enterRemarksNotesPlaceholder: {
    en: "Enter remarks or additional notes here...",
    ur: "یہاں ریمارکس یا اضافی نوٹس درج کریں...",
    ar: "أدخل الملاحظات أو ملاحظات إضافية هنا...",
    fa: "توضیحات یا یادداشت‌های اضافی را اینجا وارد کنید...",
    ps: "دلته یادونې یا اضافي یادښتونه دننه کړئ..."
  },

  // Customer profile / print certificate
  loadingCustomerProfilePreview: {
    en: "Loading customer profile preview report...",
    ur: "کسٹمر پروفائل پریویو رپورٹ لوڈ ہو رہی ہے...",
    ar: "جارٍ تحميل تقرير معاينة ملف العميل...",
    fa: "در حال بارگیری گزارش پیش‌نمایش نمایه مشتری...",
    ps: "د پیرودونکي پروفایل مخکتنه راپور پورته کیږي..."
  },
  enterpriseRegistry: {
    en: "Enterprise Registry",
    ur: "انٹرپرائز رجسٹری",
    ar: "سجل المؤسسة",
    fa: "ثبت سازمانی",
    ps: "د سازمان ثبت"
  },
  manualReference: {
    en: "Manual Reference",
    ur: "دستی حوالہ",
    ar: "مرجع يدوي",
    fa: "مرجع دستی",
    ps: "لاسي حواله"
  },
  countryAndState: {
    en: "Country & State",
    ur: "ملک اور ریاست",
    ar: "البلد والولاية",
    fa: "کشور و استان",
    ps: "هیواد او ولایت"
  },
  customerCompanyDetails: {
    en: "Customer Company Details",
    ur: "کسٹمر کمپنی کی تفصیلات",
    ar: "تفاصيل شركة العميل",
    fa: "جزئیات شرکت مشتری",
    ps: "د پیرودونکي شرکت توضیحات"
  },
  taxNtnNumber: {
    en: "Tax / NTN Number",
    ur: "ٹیکس / این ٹی این نمبر",
    ar: "الرقم الضريبي / NTN",
    fa: "شماره مالیاتی / NTN",
    ps: "مالیاتي / NTN شمیره"
  },
  completeAddress: {
    en: "Complete Address",
    ur: "مکمل پتہ",
    ar: "العنوان الكامل",
    fa: "آدرس کامل",
    ps: "بشپړ پته"
  },
  numberLabel: {
    en: "Number",
    ur: "نمبر",
    ar: "الرقم",
    fa: "شماره",
    ps: "شمیره"
  },
  remarksRegistryNotes: {
    en: "Remarks / Registry Notes",
    ur: "ریمارکس / رجسٹری نوٹس",
    ar: "ملاحظات / ملاحظات السجل",
    fa: "توضیحات / یادداشت‌های ثبت",
    ps: "یادونې / ثبت یادښتونه"
  },
  documentPreview: {
    en: "Document Preview",
    ur: "دستاویز پریویو",
    ar: "معاينة المستند",
    fa: "پیش‌نمایش سند",
    ps: "د سند مخکتنه"
  },
  pageOneOfOne: {
    en: "Page 1 of 1",
    ur: "صفحہ 1 از 1",
    ar: "صفحة 1 من 1",
    fa: "صفحه ۱ از ۱",
    ps: "پاڼه 1 د 1"
  },
  enterpriseErpFmsPortal: {
    en: "Enterprise ERP / FMS Portal",
    ur: "انٹرپرائز ای آر پی / ایف ایم ایس پورٹل",
    ar: "بوابة تخطيط موارد المؤسسة / نظام إدارة الملفات",
    fa: "پورتال ERP / FMS سازمانی",
    ps: "د سازمان ERP / FMS پورتال"
  },
  officialCustomerProfileRegistry: {
    en: "Official Customer Profile Registry",
    ur: "سرکاری کسٹمر پروفائل رجسٹری",
    ar: "السجل الرسمي لملف العميل",
    fa: "ثبت رسمی نمایه مشتری",
    ps: "رسمي د پیرودونکي پروفایل ثبت"
  },
  databaseAuditRecordCertificateMsg: {
    en: "Database audit record & incorporated verification certificate",
    ur: "ڈیٹا بیس آڈٹ ریکارڈ اور شامل شدہ تصدیقی سرٹیفکیٹ",
    ar: "سجل تدقيق قاعدة البيانات وشهادة التحقق المدمجة",
    fa: "سابقه حسابرسی پایگاه داده و گواهی تأیید ادغام‌شده",
    ps: "د ډیټابیس پلټنه ریکارډ او یوځای شوی تصدیق سند"
  },
  communicationChannels: {
    en: "Communication Channels",
    ur: "رابطے کے ذرائع",
    ar: "قنوات الاتصال",
    fa: "کانال‌های ارتباطی",
    ps: "د اړیکو چینلونه"
  },
  contactDetailsValue: {
    en: "Contact Details / Value",
    ur: "رابطہ کی تفصیلات / قدر",
    ar: "تفاصيل الاتصال / القيمة",
    fa: "جزئیات تماس / مقدار",
    ps: "د اړیکې توضیحات / ارزښت"
  },
  noContactDetailsRegistered: {
    en: "No contact details registered.",
    ur: "کوئی رابطہ کی تفصیلات رجسٹرڈ نہیں۔",
    ar: "لا توجد تفاصيل اتصال مسجلة.",
    fa: "هیچ جزئیات تماسی ثبت نشده است.",
    ps: "هیڅ د اړیکې توضیحات ثبت شوي نه دي."
  },
  registeredVerificationDocuments: {
    en: "Registered Verification Documents",
    ur: "رجسٹرڈ تصدیقی دستاویزات",
    ar: "مستندات التحقق المسجلة",
    fa: "اسناد تأیید ثبت‌شده",
    ps: "ثبت شوي تصدیق اسناد"
  },
  scanAttachmentReference: {
    en: "Scan Attachment Reference",
    ur: "اسکین اٹیچمنٹ حوالہ",
    ar: "مرجع مرفق المسح",
    fa: "مرجع پیوست اسکن",
    ps: "د سکین ضمیمې حواله"
  },
  downloadScan: {
    en: "Download Scan",
    ur: "اسکین ڈاؤن لوڈ کریں",
    ar: "تنزيل المسح",
    fa: "دانلود اسکن",
    ps: "سکین ډاونلوډ کړئ"
  },
  noScanUpload: {
    en: "No scan upload",
    ur: "کوئی اسکین اپ لوڈ نہیں",
    ar: "لا يوجد مسح مرفوع",
    fa: "هیچ اسکنی بارگذاری نشده",
    ps: "هیڅ سکین پورته شوی نه دی"
  },
  remarksRegistryAuditorNotes: {
    en: "Remarks / Registry Auditor Notes",
    ur: "ریمارکس / رجسٹری آڈیٹر نوٹس",
    ar: "ملاحظات / ملاحظات مدقق السجل",
    fa: "توضیحات / یادداشت‌های ممیز ثبت",
    ps: "یادونې / د ثبت پلټونکي یادښتونه"
  },
  dateOfIssuance: {
    en: "Date of Issuance",
    ur: "اجراء کی تاریخ",
    ar: "تاريخ الإصدار",
    fa: "تاریخ صدور",
    ps: "د صادرېدو نیټه"
  },
  erpRegistrarOfficeStamp: {
    en: "ERP Registrar Office stamp",
    ur: "ای آر پی رجسٹرار آفس مہر",
    ar: "ختم مكتب مسجل ERP",
    fa: "مهر دفتر ثبت ERP",
    ps: "د ERP راجستر دفتر مهر"
  },
  openWhatsAppChatTitle: {
    en: "Open WhatsApp Chat",
    ur: "واٹس ایپ چیٹ کھولیں",
    ar: "فتح دردشة واتساب",
    fa: "باز کردن چت واتساپ",
    ps: "د واټساپ چیټ خلاص کړئ"
  },
  composeEmailTitle: {
    en: "Compose Email",
    ur: "ای میل لکھیں",
    ar: "إنشاء بريد إلكتروني",
    fa: "نوشتن ایمیل",
    ps: "برښنالیک ولیکئ"
  },
  downloadDocumentScanTitle: {
    en: "Download Document Scan",
    ur: "دستاویز اسکین ڈاؤن لوڈ کریں",
    ar: "تنزيل مسح المستند",
    fa: "دانلود اسکن سند",
    ps: "د سند سکین ډاونلوډ کړئ"
  },
  editCustomerRecordTitle: {
    en: "Edit customer record",
    ur: "کسٹمر ریکارڈ میں ترمیم کریں",
    ar: "تعديل سجل العميل",
    fa: "ویرایش سابقه مشتری",
    ps: "د پیرودونکي ریکارډ سمول"
  },
  printSavePdfA4Title: {
    en: "Print / Save PDF (A4 Layout)",
    ur: "پرنٹ / پی ڈی ایف محفوظ کریں (A4 لے آؤٹ)",
    ar: "طباعة / حفظ PDF (تخطيط A4)",
    fa: "چاپ / ذخیره PDF (چیدمان A4)",
    ps: "چاپ / PDF خوندي کول (A4 بڼه)"
  },
  failedToLoadCustomerProfile: {
    en: "Failed to load customer profile.",
    ur: "کسٹمر پروفائل لوڈ کرنے میں ناکامی۔",
    ar: "فشل تحميل ملف العميل.",
    fa: "بارگیری نمایه مشتری ناموفق بود.",
    ps: "د پیرودونکي پروفایل پورته کول ناکام شول."
  },
  customerProfileNotFound: {
    en: "Customer profile record not found.",
    ur: "کسٹمر پروفائل ریکارڈ نہیں ملا۔",
    ar: "لم يتم العثور على سجل ملف العميل.",
    fa: "سابقه نمایه مشتری یافت نشد.",
    ps: "د پیرودونکي پروفایل ریکارډ ونه موندل شو."
  },
  noWhatsAppNumberMsg: {
    en: "No active WhatsApp/Mobile number found for this customer.",
    ur: "اس کسٹمر کے لیے کوئی فعال واٹس ایپ/موبائل نمبر نہیں ملا۔",
    ar: "لم يتم العثور على رقم واتساب/جوال نشط لهذا العميل.",
    fa: "شماره واتساپ/موبایل فعالی برای این مشتری یافت نشد.",
    ps: "د دې پیرودونکي لپاره فعال واټساپ/موبایل شمیره ونه موندل شوه."
  },
  noEmailRegisteredMsg: {
    en: "No email address registered for this customer.",
    ur: "اس کسٹمر کے لیے کوئی ای میل ایڈریس رجسٹرڈ نہیں۔",
    ar: "لم يتم تسجيل عنوان بريد إلكتروني لهذا العميل.",
    fa: "آدرس ایمیلی برای این مشتری ثبت نشده است.",
    ps: "د دې پیرودونکي لپاره هیڅ برښنالیک پته ثبت شوې نده."
  },
  noDocumentFilesUploadedMsg: {
    en: "No document files uploaded for this customer.",
    ur: "اس کسٹمر کے لیے کوئی دستاویز فائل اپ لوڈ نہیں ہوئی۔",
    ar: "لم يتم رفع أي ملفات مستندات لهذا العميل.",
    fa: "هیچ فایل سندی برای این مشتری بارگذاری نشده است.",
    ps: "د دې پیرودونکي لپاره هیڅ سند فایلونه پورته شوي نه دي."
  },
  // ── 5-Language additions for matching Customer Management UI (Image 2 & 3) ──
  searchAndFilters: {
    en: "Search & Filters",
    ur: "تلاش اور فلٹرز",
    ar: "البحث والتصفية",
    fa: "جستجو و فیلترها",
    ps: "لټون او فلټرونه"
  },
  allReports: {
    en: "All Reports",
    ur: "تمام رپورٹس",
    ar: "جميع التقارير",
    fa: "همه گزارش‌ها",
    ps: "ټول راپورونه"
  },
  drafts: {
    en: "Drafts",
    ur: "ڈرافٹس",
    ar: "المسودات",
    fa: "پیش‌نویس‌ها",
    ps: "مسودې"
  },
  addCustomerBtn: {
    en: "Add Customer",
    ur: "کسٹمر شامل کریں",
    ar: "إضافة عميل",
    fa: "افزودن مشتری",
    ps: "پیرودونکی اضافه کړئ"
  },
  customerListSub: {
    en: "All registered customers",
    ur: "تمام رجسٹرڈ کسٹمرز",
    ar: "جميع العملاء المسجلين",
    fa: "همه مشتریان ثبت‌شده",
    ps: "ټول ثبت شوي پیرودونکي"
  },
  registeredThisMonth: {
    en: "Registered This Month",
    ur: "اس ماہ رجسٹرڈ",
    ar: "المسجلون هذا الشهر",
    fa: "ثبت‌نام این ماه",
    ps: "په دې میاشت کې ثبت شوي"
  },
  registeredThisMonthSub: {
    en: "New customers",
    ur: "نئے کسٹمرز",
    ar: "العملاء الجدد",
    fa: "مشتریان جدید",
    ps: "نوي پیرودونکي"
  },
  customerByCountry: {
    en: "Customer by Country",
    ur: "ملک کے لحاظ سے کسٹمرز",
    ar: "العملاء حسب الدولة",
    fa: "مشتریان بر اساس کشور",
    ps: "د هیواد له مخې پیرودونکي"
  },
  customerByCountrySub: {
    en: "Country wise report",
    ur: "ملک وار رپورٹ",
    ar: "تقرير حسب الدولة",
    fa: "گزارش تفکیک کشور",
    ps: "د هیواد وار راپور"
  },
  customerByBranch: {
    en: "Customer by Branch",
    ur: "برانچ کے لحاظ سے کسٹمرز",
    ar: "العملاء حسب الفرع",
    fa: "مشتریان بر اساس شعبه",
    ps: "د څانګې له مخې پیرودونکي"
  },
  customerByBranchSub: {
    en: "Branch wise report",
    ur: "برانچ وار رپورٹ",
    ar: "تقرير حسب الفرع",
    fa: "گزارش تفکیک شعبه",
    ps: "د څانګې وار راپور"
  },
  customerByStatus: {
    en: "Customer by Status",
    ur: "سٹیٹس کے لحاظ سے کسٹمرز",
    ar: "العملاء حسب الحالة",
    fa: "مشتریان بر اساس وضعیت",
    ps: "د حالت له مخې پیرودونکي"
  },
  customerByStatusSub: {
    en: "Active, Inactive, etc.",
    ur: "فعال، غیر فعال، وغیرہ",
    ar: "نشط، غير نشط، إلخ",
    fa: "فعال، غیرفعال، و غیره",
    ps: "فعال، غیر فعال، او نور"
  },
  exportData: {
    en: "Export Data",
    ur: "ڈیٹا برآمد کریں",
    ar: "تصدير البيانات",
    fa: "خروجی داده‌ها",
    ps: "د معلوماتو صادرول"
  },
  exportDataSub: {
    en: "Excel / PDF / Print",
    ur: "ایکسل / پی ڈی ایف / پرنٹ",
    ar: "إكسل / PDF / طباعة",
    fa: "اکسل / پی‌دی‌اف / چاپ",
    ps: "ایکسل / پی ډی ایف / چاپ"
  },
  viewDrafts: {
    en: "View Drafts",
    ur: "ڈرافٹس دیکھیں",
    ar: "عرض المسودات",
    fa: "مشاهده پیش‌نویس‌ها",
    ps: "مسودې کتل"
  },
  viewDraftsSub: {
    en: "All saved drafts",
    ur: "تمام محفوظ شدہ ڈرافٹس",
    ar: "جميع المسودات المحفوظة",
    fa: "همه پیش‌نویس‌های ذخیره‌شده",
    ps: "ټولې خوندي شوې مسودې"
  },
  myDrafts: {
    en: "My Drafts",
    ur: "میرے ڈرافٹس",
    ar: "مسوداتي",
    fa: "پیش‌نویس‌های من",
    ps: "زما مسودې"
  },
  myDraftsSub: {
    en: "Drafts by me",
    ur: "میری تیار کردہ مسودات",
    ar: "المسودات بواسطتي",
    fa: "پیش‌نویس‌های تهیه شده توسط من",
    ps: "زما لخوا جوړې شوې مسودې"
  },
  draftsByUsers: {
    en: "Drafts by Users",
    ur: "صارفین کے ڈرافٹس",
    ar: "مسودات المستخدمين",
    fa: "پیش‌نویس‌های کاربران",
    ps: "د کاروونکو مسودې"
  },
  draftsByUsersSub: {
    en: "User wise drafts",
    ur: "صارف وار مسودات",
    ar: "مسودات حسب المستخدم",
    fa: "پیش‌نویس‌های تفکیک کاربر",
    ps: "د کاروونکو له مخې مسودې"
  },
  todaysDrafts: {
    en: "Today's Drafts",
    ur: "آج کے ڈرافٹس",
    ar: "مسودات اليوم",
    fa: "پیش‌نویس‌های امروز",
    ps: "د نن ورځې مسودې"
  },
  todaysDraftsSub: {
    en: "Drafts created today",
    ur: "آج تیار کردہ مسودات",
    ar: "المسودات المنشأة اليوم",
    fa: "پیش‌نویس‌های ایجاد شده امروز",
    ps: "نن جوړې شوې مسودې"
  },
  restoreDraft: {
    en: "Restore Draft",
    ur: "ڈرافٹ بحال کریں",
    ar: "استعادة المسودة",
    fa: "بازیابی پیش‌نویس",
    ps: "مسوده بېرته راوستل"
  },
  restoreDraftSub: {
    en: "Open selected draft",
    ur: "منتخب مسودہ کھولیں",
    ar: "فتح المسودة المحددة",
    fa: "باز کردن پیش‌نویس انتخابی",
    ps: "ټاکل شوې مسوده پرانیستل"
  },
  manageDrafts: {
    en: "Manage Drafts",
    ur: "ڈرافٹس کا انتظام",
    ar: "إدارة المسودات",
    fa: "مدیریت پیش‌نویس‌ها",
    ps: "د مسودو مدیریت"
  },
  manageDraftsSub: {
    en: "Delete / Clear drafts",
    ur: "مسودات حذف / صاف کریں",
    ar: "حذف / مسح المسودات",
    fa: "حذف / پاکسازی پیش‌نویس‌ها",
    ps: "د مسودو پاکول / ړنګول"
  },
  newCustomerSub: {
    en: "Add new customer",
    ur: "نیا کسٹمر شامل کریں",
    ar: "إضافة عميل جديد",
    fa: "افزودن مشتری جدید",
    ps: "نوی پیرودونکی اضافه کړئ"
  },
  importCustomers: {
    en: "Import Customers",
    ur: "کسٹمرز درآمد کریں",
    ar: "استيراد العملاء",
    fa: "وارد کردن مشتریان",
    ps: "د پیرودونکو واردول"
  },
  importCustomersSub: {
    en: "Import from Excel",
    ur: "ایکسل سے امپورٹ کریں",
    ar: "استيراد من إكسل",
    fa: "وارد کردن از اکسل",
    ps: "له ایکسل څخه راوړل"
  },
  quickAdd: {
    en: "Quick Add",
    ur: "فوری اندراج",
    ar: "إضافة سريعة",
    fa: "افزودن سریع",
    ps: "چټک اضافه کول"
  },
  quickAddSub: {
    en: "Minimal form",
    ur: "مختصر فارم",
    ar: "نموذج مختصر",
    fa: "فرم خلاصه",
    ps: "لنډه فورمه"
  },
  duplicateCheck: {
    en: "Duplicate Check",
    ur: "ڈپلیکیٹ چیک",
    ar: "فحص التكرار",
    fa: "بررسی تکراری",
    ps: "د تکرار کتل"
  },
  duplicateCheckSub: {
    en: "Check existing customer",
    ur: "موجودہ کسٹمر کی جانچ کریں",
    ar: "التحقق من العميل الحالي",
    fa: "بررسی مشتریان موجود",
    ps: "شته پیرودونکی کتل"
  },
  openLastDraft: {
    en: "Open Last Draft",
    ur: "آخری ڈرافٹ کھولیں",
    ar: "فتح آخر مسودة",
    fa: "باز کردن آخرین پیش‌نویس",
    ps: "وروستۍ مسوده پرانیستل"
  },
  openLastDraftSub: {
    en: "Continue saved draft",
    ur: "محفوظ شدہ ڈرافٹ جاری رکھیں",
    ar: "متابعة المسودة المحفوظة",
    fa: "ادامه پیش‌نویس ذخیره‌شده",
    ps: "خوندي شوې مسوده دوام ورکول"
  },
  totalBranches: {
    en: "Total Branches",
    ur: "کل برانچیں",
    ar: "إجمالي الفروع",
    fa: "مجموع شعب",
    ps: "ټولې څانګې"
  },
  customersThisBranch: {
    en: "Customers (This Branch)",
    ur: "کسٹمرز (اس برانچ کے)",
    ar: "العملاء (هذا الفرع)",
    fa: "مشتریان (این شعبه)",
    ps: "پیرودونکي (دا څانګه)"
  },
  topCountry: {
    en: "Top Country",
    ur: "نمایاں ملک",
    ar: "أعلى دولة",
    fa: "کشور برتر",
    ps: "غوره هیواد"
  },
  branchAndUserDetails: {
    en: "Branch & User Details",
    ur: "برانچ اور صارف کی تفصیلات",
    ar: "تفاصيل الفرع والمستخدمين",
    fa: "اطلاعات شعبه و کاربران",
    ps: "د څانګې او کاروونکي توضیحات"
  },
  customerSummary: {
    en: "Customer Summary",
    ur: "کسٹمر سمری",
    ar: "ملخص العملاء",
    fa: "خلاصه مشتریان",
    ps: "د پیرودونکو لنډیز"
  },
  totalUsers: {
    en: "Total Users",
    ur: "کل صارفین",
    ar: "إجمالي المستخدمين",
    fa: "مجموع کاربران",
    ps: "ټول کاروونکي"
  },
  activeUsers: {
    en: "Active Users",
    ur: "فعال صارفین",
    ar: "المستخدمون النشطون",
    fa: "کاربران فعال",
    ps: "فعال کاروونکي"
  },
  inactiveUsers: {
    en: "Inactive Users",
    ur: "غیر فعال صارفین",
    ar: "المستخدمون غير النشطين",
    fa: "کاربران غیرفعال",
    ps: "غیر فعال کاروونکي"
  },
  newThisMonth: {
    en: "New This Month",
    ur: "اس ماہ نئے",
    ar: "جديد هذا الشهر",
    fa: "جدید این ماه",
    ps: "په دې میاشت کې نوي"
  },
  customerRegisterTitle: {
    en: "Customer Register",
    ur: "کسٹمر رجسٹر",
    ar: "سجل العملاء",
    fa: "دفتر ثبت مشتریان",
    ps: "د پیرودونکو راجستر"
  },
  customerRegisterSubtitle: {
    en: "Manage and view all registered customers.",
    ur: "تمام رجسٹرڈ کسٹمرز کا انتظام اور جائزہ لیں۔",
    ar: "إدارة وعرض جميع العملاء المسجلين.",
    fa: "مدیریت و مشاهده تمامی مشتریان ثبت‌شده.",
    ps: "د ټولو ثبت شویو پیرودونکو اداره او کتل."
  },
  allLeads: {
    en: "All Leads",
    ur: "تمام لیڈز",
    ar: "جميع العملاء المحتملين",
    fa: "همه مشتریان بالقوه",
    ps: "ټول پیرودونکي"
  },
  sendToCustomer: {
    en: "Send to Customer",
    ur: "کسٹمر کو بھیجیں",
    ar: "إرسال إلى العميل",
    fa: "ارسال به مشتری",
    ps: "پیرودونکي ته لیږل"
  },
  saveAsDraft: {
    en: "Save as Draft",
    ur: "ڈرافٹ کے طور پر محفوظ کریں",
    ar: "حفظ كمسودة",
    fa: "ذخیره به عنوان پیش‌نویس",
    ps: "د مسودې په توګه خوندي کول"
  },
  stepPersonalInfoTitle: {
    en: "Personal Info",
    ur: "ذاتی معلومات",
    ar: "المعلومات الشخصية",
    fa: "اطلاعات شخصی",
    ps: "شخصي معلومات"
  },
  stepPersonalInfoSub: {
    en: "Basic information & identity",
    ur: "بنیادی معلومات و شناخت",
    ar: "المعلومات الأساسية والهوية",
    fa: "اطلاعات پایه و هویت",
    ps: "بنسټیز معلومات او هویت"
  },
  stepLocationTitle: {
    en: "Location",
    ur: "مقام و پتہ",
    ar: "الموقع والعنوان",
    fa: "موقعیت و آدرس",
    ps: "ځای او پته"
  },
  stepLocationSub: {
    en: "Address & business location",
    ur: "پتہ اور کاروباری مقام",
    ar: "العنوان وموقع العمل",
    fa: "آدرس و محل کسب‌وکار",
    ps: "پته او د سوداګرۍ ځای"
  },
  stepContactsDocsTitle: {
    en: "Contacts & Docs",
    ur: "رابطہ و دستاویزات",
    ar: "جهات الاتصال والوثائق",
    fa: "تماس‌ها و مدارک",
    ps: "اړیکې او اسناد"
  },
  stepContactsDocsSub: {
    en: "Contact details & documents",
    ur: "رابطے کی تفصیلات اور دستاویزات",
    ar: "بيانات الاتصال والمستندات",
    fa: "اطلاعات تماس و مدارک",
    ps: "د اړیکو جزئیات او اسناد"
  },
  stepReviewSaveTitle: {
    en: "Review & Save",
    ur: "جائزہ اور محفوظ کریں",
    ar: "المراجعة والحفظ",
    fa: "بررسی و ذخیره",
    ps: "کتنه او خوندي کول"
  },
  stepReviewSaveSub: {
    en: "Verify and save customer",
    ur: "تصدیق کریں اور کسٹمر محفوظ کریں",
    ar: "التحقق وحفظ العميل",
    fa: "تأیید و ذخیره مشتری",
    ps: "تایید او پیرودونکی خوندي کړئ"
  },
  clickToUploadPhoto: {
    en: "Click to upload photo",
    ur: "تصویر اپ لوڈ کرنے کے لیے کلک کریں",
    ar: "انقر لتحميل الصورة",
    fa: "برای بارگذاری عکس کلیک کنید",
    ps: "د عکس پورته کولو لپاره کلیک وکړئ"
  },
  uploadPhotoHint1: {
    en: "PNG, JPG (Max 2MB)",
    ur: "PNG, JPG (زیادہ سے زیادہ 2MB)",
    ar: "PNG, JPG (الحد الأقصى 2 ميجابايت)",
    fa: "PNG, JPG (حداکثر ۲ مگابایت)",
    ps: "PNG, JPG (تر ټولو زیات 2MB)"
  },
  uploadPhotoHint2: {
    en: "Passport size recommended",
    ur: "پاسپورٹ سائز تصویر تجویز کردہ",
    ar: "يوصى بحجم صورة جواز السفر",
    fa: "عکس اندازه پاسپورت توصیه می‌شود",
    ps: "د پاسپورت د کچې عکس وړاندیز شوی"
  },
  editBtn: {
    en: "Edit",
    ur: "تبدیل کریں",
    ar: "تعديل",
    fa: "ویرایش",
    ps: "سمول"
  },
  savePersonMaster: {
    en: "Save Person Master",
    ur: "پرسن ماسٹر محفوظ کریں",
    ar: "حفظ الشخص الرئيسي",
    fa: "ذخیره شخص اصلی",
    ps: "اصلي شخص خوندي کول"
  },
  personalInfoSub: {
    en: "Enter customer's basic information and identity details",
    ur: "کسٹمر کی بنیادی معلومات اور شناختی تفصیلات درج کریں",
    ar: "أدخل المعلومات الأساسية وتفاصيل هوية العميل",
    fa: "اطلاعات پایه و مشخصات هویتی مشتری را وارد کنید",
    ps: "د پیرودونکي لومړني معلومات او د هویت توضیحات دننه کړئ"
  },
  stepBack: {
    en: "Back",
    ur: "پیچھے",
    ar: "السابق",
    fa: "قبلی",
    ps: "شاته"
  },
  stepNext: {
    en: "Next",
    ur: "اگلا",
    ar: "التالي",
    fa: "بعدی",
    ps: "بل"
  },
  customersGroup: {
    en: "Customers",
    ur: "کسٹمرز",
    ar: "العملاء",
    fa: "مشتریان",
    ps: "پیرودونکي"
  },
  perPage: {
    en: "per page",
    ur: "فی صفحہ",
    ar: "لكل صفحة",
    fa: "در هر صفحه",
    ps: "په هره پاڼه کې"
  },
  showing: {
    en: "Showing",
    ur: "دکھایا جا رہا ہے",
    ar: "عرض",
    fa: "نمایش",
    ps: "ښودل کیږي"
  },
  to: {
    en: "to",
    ur: "تا",
    ar: "إلى",
    fa: "تا",
    ps: "تر"
  },
  of: {
    en: "of",
    ur: "از",
    ar: "من",
    fa: "از",
    ps: "له"
  },
  customerAccountDetails: {
    en: "Customer Account Details",
    ur: "کسٹمر اکاؤنٹ کی تفصیلات",
    ar: "تفاصيل حساب العميل",
    fa: "جزئیات حساب مشتری",
    ps: "د پیرودونکي حساب توضیحات"
  },
  accountName: {
    en: "Account Name",
    ur: "اکاؤنٹ کا نام",
    ar: "اسم الحساب",
    fa: "نام حساب",
    ps: "د حساب نوم"
  },
  accountNumber: {
    en: "Account Number",
    ur: "اکاؤنٹ نمبر",
    ar: "رقم الحساب",
    fa: "شماره حساب",
    ps: "د حساب شمیره"
  },
  branchName: {
    en: "Branch Name",
    ur: "برانچ کا نام",
    ar: "اسم الفرع",
    fa: "نام شعبه",
    ps: "د څانګې نوم"
  },
  branchCode: {
    en: "Branch Code",
    ur: "برانچ کوڈ",
    ar: "رمز الفرع",
    fa: "کد شعبه",
    ps: "د څانګې کوډ"
  },
  cityBranch: {
    en: "City Branch",
    ur: "سٹی برانچ",
    ar: "فرع المدينة",
    fa: "شعبه شهر",
    ps: "د ښار څانګه"
  },
  companyName: {
    en: "Company Name",
    ur: "کمپنی کا نام",
    ar: "اسم الشركة",
    fa: "نام شرکت",
    ps: "د شرکت نوم"
  },
  companyRegNo: {
    en: "Company Registration No",
    ur: "کمپنی رجسٹریشن نمبر",
    ar: "رقم تسجيل الشركة",
    fa: "شماره ثبت شرکت",
    ps: "د شرکت د ثبت شمیره"
  },
  companyTaxNo: {
    en: "Company Tax No (NTN)",
    ur: "ٹیکس / این ٹی این نمبر",
    ar: "الرقم الضريبي (NTN)",
    fa: "شماره مالیاتی (NTN)",
    ps: "د مالیې / NTN شمیره"
  },
  companyBusinessType: {
    en: "Business Type",
    ur: "کاروبار کی قسم",
    ar: "نوع النشاط التجاري",
    fa: "نوع کسب‌وکار",
    ps: "د سوداګرۍ ډول"
  },
  companyPhone: {
    en: "Company Phone",
    ur: "کمپنی کا فون",
    ar: "هاتف الشركة",
    fa: "تلفن شرکت",
    ps: "د شرکت تلیفون"
  },
  companyEmail: {
    en: "Company Email",
    ur: "کمپنی ای میل",
    ar: "بريد الشركة الإلكتروني",
    fa: "ایمیل شرکت",
    ps: "د شرکت ایمیل"
  },
  companyAddress: {
    en: "Company Address",
    ur: "کمپنی کا پتہ",
    ar: "عنوان الشركة",
    fa: "آدرس شرکت",
    ps: "د شرکت پته"
  },
  enterAccountNamePlaceholder: {
    en: "Enter account title / name",
    ur: "اکاؤنٹ کا نام / عنوان درج کریں",
    ar: "أدخل عنوان / اسم الحساب",
    fa: "عنوان / نام حساب را وارد کنید",
    ps: "د حساب نوم / سرلیک دننه کړئ"
  },
  enterAccountNumberPlaceholder: {
    en: "e.g. CUST-00124 or Bank A/C",
    ur: "مثلاً CUST-00124 یا بینک اکاؤنٹ",
    ar: "مثال CUST-00124 أو حساب بنكي",
    fa: "مثلاً CUST-00124 یا حساب بانکی",
    ps: "د بېلګې په توګه CUST-00124 یا بانک حساب"
  },
  enterManualRefPlaceholder: {
    en: "e.g. REF-2026-001",
    ur: "مثلاً REF-2026-001",
    ar: "مثال REF-2026-001",
    fa: "مثلاً REF-2026-001",
    ps: "د بېلګې په توګه REF-2026-001"
  },
  enterBranchNamePlaceholder: {
    en: "e.g. Main Branch, Karachi",
    ur: "مثلاً مین برانچ، کراچی",
    ar: "مثال الفرع الرئيسي، كراتشي",
    fa: "مثلاً شعبه اصلی، کراچی",
    ps: "د بېلګې په توګه مرکزي څانګه، کراچۍ"
  },
  enterBranchCodePlaceholder: {
    en: "e.g. KHI-01",
    ur: "مثلاً KHI-01",
    ar: "مثال KHI-01",
    fa: "مثلاً KHI-01",
    ps: "د بېلګې په توګه KHI-01"
  },
  enterCityBranchPlaceholder: {
    en: "e.g. Lahore City Branch",
    ur: "مثلاً لاہور سٹی برانچ",
    ar: "مثال فرع مدينة لاهور",
    fa: "مثلاً شعبه شهر لاهور",
    ps: "د بېلګې په توګه د لاهور ښار څانګه"
  },
  enterCompanyRegNoPlaceholder: {
    en: "e.g. SECP-0019283",
    ur: "مثلاً SECP-0019283",
    ar: "مثال SECP-0019283",
    fa: "مثلاً SECP-0019283",
    ps: "د بېلګې په توګه SECP-0019283"
  },
  enterCompanyTaxNoPlaceholder: {
    en: "e.g. 1234567-8 / STRN",
    ur: "مثلاً 1234567-8 / ایس ٹی آر این",
    ar: "مثال 1234567-8 / الرقم الضريبي",
    fa: "مثلاً 1234567-8 / شناسه مالیاتی",
    ps: "د بېلګې په توګه 1234567-8 / مالیاتي شمیره"
  },
  accountDetailsSub: {
    en: "Account title, numbers, branches and banking references",
    ur: "اکاؤنٹ کا عنوان، نمبرز، برانچز اور بینکنگ حوالہ جات",
    ar: "عنوان الحساب والأرقام والفروع والمراجع المصرفية",
    fa: "عنوان حساب، شماره‌ها، شعب و مراجع بانکی",
    ps: "د حساب سرلیک، شمیرې، څانګې او بانکي حوالې"
  },
  companyDetailsSub: {
    en: "Legal entity, registration, tax / NTN and business contacts",
    ur: "قانونی ادارہ، رجسٹریشن، ٹیکس / این ٹی این اور کاروباری رابطے",
    ar: "الكيان القانوني والتسجيل والضرائب وجهات اتصال العمل",
    fa: "شخصیت حقوقی، ثبت، مالیات و تماس‌های کاری",
    ps: "قانوني اداره، نوم لیکنه، مالیه او سوداګریزې اړیکې"
  },
  corporateClient: {
    en: "Corporate",
    ur: "کارپوریٹ",
    ar: "شركات",
    fa: "شرکتی",
    ps: "کارپوریټ"
  }
};

export function getLabel(key: string, lang: SupportedLanguage): string {
  const dict = customerTranslations[key];
  if (!dict) return key;
  return dict[lang] || dict["en"];
}
