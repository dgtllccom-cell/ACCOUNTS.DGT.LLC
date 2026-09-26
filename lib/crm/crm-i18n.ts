import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface CrmTranslations {
  // Sidebar & Report Center
  crmReports: string;
  crmReportCenter: string;
  searchCrmReport: string;
  clickReportFullScreen: string;
  executiveDashboard: string;
  leadPipeline: string;
  customer360: string;
  dueFollowUp: string;
  paymentsRecovery: string;
  cityBranchAnalysis: string;
  teamPerformance: string;
  universalReports: string;

  // Header & Toolbar
  customer360Title: string;
  customer360Subtitle: string;
  allCrmReports: string;
  newCustomer: string;
  searchPlaceholder: string;
  allCountries: string;
  allBranches: string;
  assignedUser: string;
  searchFilter: string;
  more: string;
  columns: string;
  exportReport: string;
  printReport: string;
  exportCsv: string;
  exportExcel: string;
  downloadDetails: string;
  exportDetailedCsv: string;
  downloadFullStatement: string;
  downloading: string;
  fullScreen: string;
  exitFullScreen: string;

  // KPI Cards
  totalCustomers: string;
  activeCustomers: string;
  followUpsToday: string;
  receivableDue: string;
  customerHealth: string;
  vsLastPeriod: string;
  healthyAccounts: string;
  calls: string;
  meetings: string;
  others: string;

  // Table Headers
  customerRegister: string;
  customersCount: string;
  srNo: string;
  customerId: string;
  company: string;
  country: string;
  branch: string;
  lastContact: string;
  nextAction: string;
  health: string;
  status: string;
  actions: string;
  view360: string;

  // Status & Health Badges
  healthExcellent: string;
  healthGood: string;
  healthMedium: string;
  healthLow: string;
  statusActive: string;
  statusAtRisk: string;
  statusDueNow: string;
  statusDueToday: string;
  statusUpcoming: string;
  statusCompleted: string;

  // Action Types
  actionCall: string;
  actionMeeting: string;
  actionSendQuote: string;
  actionFollowUp: string;
  actionPayment: string;
  actionShipment: string;
  actionToday: string;

  // Bottom Section
  upcomingFollowUps: string;
  viewAll: string;
  subject: string;
  assignedTo: string;
  dueDate: string;
  startAction: string;

  // Quick Actions
  quickActions: string;
  logCall: string;
  logCallDesc: string;
  message: string;
  messageDesc: string;
  scheduleMeeting: string;
  meetingDesc: string;
  addNote: string;
  noteDesc: string;

  // Profile View
  profileOverview: string;
  financialPosition: string;
  totalReceivable: string;
  totalPayable: string;
  netPosition: string;
  chequesBalance: string;
  activityTimeline: string;
  salesOrders: string;
  purchases: string;
  cheques: string;
  shippingClearing: string;
  documents: string;
  openOriginalRecord: string;
  logNewActivity: string;
  saveActivity: string;
  cancel: string;
  noteText: string;
  selectType: string;
  close: string;
  backToRegister: string;
}

const CRM_DICTIONARY: Record<SupportedLanguage, CrmTranslations> = {
  en: {
    crmReports: "CRM Reports",
    crmReportCenter: "CRM REPORT CENTER",
    searchCrmReport: "Search CRM report...",
    clickReportFullScreen: "Click any report to open full screen.",
    executiveDashboard: "Executive Dashboard",
    leadPipeline: "Lead Pipeline",
    customer360: "Customer 360",
    dueFollowUp: "Due & Follow-Up",
    paymentsRecovery: "Payments & Recovery",
    cityBranchAnalysis: "City & Branch Analysis",
    teamPerformance: "Team Performance",
    universalReports: "Universal Reports Hub",

    customer360Title: "CRM Reports — Customer 360",
    customer360Subtitle: "A complete 360° view of your customers, relationships, activities, deals, and financials.",
    allCrmReports: "All CRM Reports",
    newCustomer: "+ New Customer",
    searchPlaceholder: "Search customer by name, ID, phone, email...",
    allCountries: "All Countries",
    allBranches: "All Branches",
    assignedUser: "Assigned User",
    searchFilter: "Search & Filter",
    more: "More",
    columns: "Columns",
    exportReport: "Export",
    printReport: "Print",
    exportCsv: "Export CSV",
    exportExcel: "Export Excel",
    downloadDetails: "Download Details",
    exportDetailedCsv: "Export Detailed Excel (.csv)",
    downloadFullStatement: "Download Full 360 Statement",
    downloading: "Downloading...",
    fullScreen: "Full Screen",
    exitFullScreen: "Exit Full Screen",

    totalCustomers: "Total Customers",
    activeCustomers: "Active Customers",
    followUpsToday: "Follow-Ups Today",
    receivableDue: "Receivable Due",
    customerHealth: "Customer Health",
    vsLastPeriod: "vs last period",
    healthyAccounts: "healthy accounts",
    calls: "calls",
    meetings: "meetings",
    others: "others",

    customerRegister: "Customer Register",
    customersCount: "customers",
    srNo: "#",
    customerId: "CUSTOMER ID",
    company: "COMPANY",
    country: "COUNTRY",
    branch: "BRANCH",
    lastContact: "LAST CONTACT",
    nextAction: "NEXT ACTION",
    health: "HEALTH",
    status: "STATUS",
    actions: "ACTIONS",
    view360: "View 360",

    healthExcellent: "Excellent",
    healthGood: "Good",
    healthMedium: "Medium",
    healthLow: "Low",
    statusActive: "Active",
    statusAtRisk: "At Risk",
    statusDueNow: "Due Now",
    statusDueToday: "Due Today",
    statusUpcoming: "Upcoming",
    statusCompleted: "Completed",

    actionCall: "Call",
    actionMeeting: "Meeting",
    actionSendQuote: "Send Quote",
    actionFollowUp: "Follow Up",
    actionPayment: "Payment",
    actionShipment: "Shipment",
    actionToday: "Today",

    upcomingFollowUps: "Upcoming Follow-Ups",
    viewAll: "View All",
    subject: "SUBJECT",
    assignedTo: "ASSIGNED TO",
    dueDate: "DUE DATE",
    startAction: "Start",

    quickActions: "Quick Actions",
    logCall: "Call",
    logCallDesc: "Log a call",
    message: "Message",
    messageDesc: "WhatsApp / Email",
    scheduleMeeting: "Meeting",
    meetingDesc: "Schedule meeting",
    addNote: "Add Note",
    noteDesc: "Add activity note",

    profileOverview: "Customer Overview",
    financialPosition: "Financial Position",
    totalReceivable: "Total Receivable",
    totalPayable: "Total Payable",
    netPosition: "Net Position",
    chequesBalance: "Cheques Outstanding",
    activityTimeline: "Complete Activity History & Follow-Up Timeline",
    salesOrders: "Quotations & Sales Records",
    purchases: "Purchase & Payment References",
    cheques: "Cheques & Recoveries",
    shippingClearing: "Shipping & Clearing Records",
    documents: "Documents & Registrations",
    openOriginalRecord: "Open ERP Record",
    logNewActivity: "Log Interaction",
    saveActivity: "Save Activity",
    cancel: "Cancel",
    noteText: "Activity Note / Summary",
    selectType: "Select Activity Type",
    close: "Close",
    backToRegister: "Back to Customer Register"
  },
  ur: {
    crmReports: "سی آر ایم رپورٹس",
    crmReportCenter: "سی آر ایم رپورٹ سینٹر",
    searchCrmReport: "سی آر ایم رپورٹ تلاش کریں...",
    clickReportFullScreen: "فل سکرین کھولنے کے لیے کسی بھی رپورٹ پر کلک کریں۔",
    executiveDashboard: "ایگزیکٹو ڈیش بورڈ",
    leadPipeline: "لیڈ پائپ لائن",
    customer360: "کسٹمر 360",
    dueFollowUp: "واجبات اور فالو اپ",
    paymentsRecovery: "ادائیگیاں اور وصولیاں",
    cityBranchAnalysis: "شہر اور برانچ تجزیہ",
    teamPerformance: "ٹیم کی کارکردگی",
    universalReports: "جامع رپورٹس ہب",

    customer360Title: "سی آر ایم رپورٹس — کسٹمر 360",
    customer360Subtitle: "آپ کے گاہکوں، تعلقات، سرگرمیوں، سودوں اور مالیات کا مکمل 360° جائزہ۔",
    allCrmReports: "تمام سی آر ایم رپورٹس",
    newCustomer: "+ نیا کسٹمر",
    searchPlaceholder: "نام، آئی ڈی، فون، ای میل کے ذریعے کسٹمر تلاش کریں...",
    allCountries: "تمام ممالک",
    allBranches: "تمام برانچز",
    assignedUser: "متعلقہ صارف",
    searchFilter: "تلاش اور فلٹر",
    more: "مزید",
    columns: "کالمز",
    exportReport: "ایکسپورٹ",
    printReport: "پرنٹ",
    exportCsv: "CSV ایکسپورٹ",
    exportExcel: "Excel ایکسپورٹ",
    downloadDetails: "تفصیلی ڈاؤن لوڈ",
    exportDetailedCsv: "تفصیلی ایکسل ڈاؤن لوڈ (.csv)",
    downloadFullStatement: "مکمل 360 اسٹیٹمنٹ ڈاؤن لوڈ کریں",
    downloading: "ڈاؤن لوڈ ہو رہا ہے...",
    fullScreen: "مکمل سکرین",
    exitFullScreen: "فل سکرین بند کریں",

    totalCustomers: "کل کسٹمرز",
    activeCustomers: "فعال کسٹمرز",
    followUpsToday: "آج کے فالو اپ",
    receivableDue: "واجب الوصول رقم",
    customerHealth: "کسٹمر کی صحت",
    vsLastPeriod: "پچھلی مدت کے مقابلے میں",
    healthyAccounts: "صحت مند کھاتے",
    calls: "کالز",
    meetings: "ملاقاتیں",
    others: "دیگر",

    customerRegister: "کسٹمر رجسٹر",
    customersCount: "کسٹمرز",
    srNo: "#",
    customerId: "کسٹمر آئی ڈی",
    company: "کمپنی / نام",
    country: "ملک",
    branch: "برانچ",
    lastContact: "آخری رابطہ",
    nextAction: "اگلا اقدام",
    health: "صحت",
    status: "حیثیت",
    actions: "اقدامات",
    view360: "360 جائزہ",

    healthExcellent: "شاندار",
    healthGood: "اچھا",
    healthMedium: "درمیانہ",
    healthLow: "کمزور",
    statusActive: "فعال",
    statusAtRisk: "خطرے میں",
    statusDueNow: "ابھی واجب ہے",
    statusDueToday: "آج واجب ہے",
    statusUpcoming: "آئندہ",
    statusCompleted: "مکمل",

    actionCall: "کال",
    actionMeeting: "میٹنگ",
    actionSendQuote: "کوٹیشن بھیجیں",
    actionFollowUp: "فالو اپ",
    actionPayment: "ادائیگی",
    actionShipment: "شپمنٹ",
    actionToday: "آج",

    upcomingFollowUps: "آئندہ فالو اپ",
    viewAll: "سب دیکھیں",
    subject: "عنوان",
    assignedTo: "مفوضہ شخص",
    dueDate: "مقررہ تاریخ",
    startAction: "شروع کریں",

    quickActions: "فوری اقدامات",
    logCall: "کال",
    logCallDesc: "کال درج کریں",
    message: "پیغام",
    messageDesc: "واٹس ایپ / ای میل",
    scheduleMeeting: "میٹنگ",
    meetingDesc: "ملاقات طے کریں",
    addNote: "نوٹ شامل کریں",
    noteDesc: "سرگرمی کا نوٹ لکھیں",

    profileOverview: "کسٹمر کا مکمل خاکہ",
    financialPosition: "مالیاتی پوزیشن",
    totalReceivable: "کل وصول طلب",
    totalPayable: "کل واجب الادا",
    netPosition: "خالص پوزیشن",
    chequesBalance: "زیر التواء چیک",
    activityTimeline: "مکمل سرگرمی کی تاریخ اور فالو اپ ٹائم لائن",
    salesOrders: "کوٹیشنز اور فروخت کے ریکارڈ",
    purchases: "خریداری اور ادائیگی کے حوالہ جات",
    cheques: "چیک اور وصولیاں",
    shippingClearing: "شپنگ اور کلیئرنگ ریکارڈ",
    documents: "دستاویزات اور رجسٹریشن",
    openOriginalRecord: "اصل ERP ریکارڈ کھولیں",
    logNewActivity: "نئی سرگرمی درج کریں",
    saveActivity: "محفوظ کریں",
    cancel: "منسوخ",
    noteText: "سرگرمی کی تفصیل",
    selectType: "سرگرمی کی قسم منتخب کریں",
    close: "بند کریں",
    backToRegister: "کسٹمر رجسٹر پر واپس جائیں"
  },
  ar: {
    crmReports: "تقارير CRM",
    crmReportCenter: "مركز تقارير CRM",
    searchCrmReport: "البحث في تقارير CRM...",
    clickReportFullScreen: "انقر فوق أي تقرير لفتحه في وضع ملء الشاشة.",
    executiveDashboard: "لوحة التحكم التنفيذية",
    leadPipeline: "مسار العملاء المحتملين",
    customer360: "نظرة شاملة 360 للعميل",
    dueFollowUp: "الاستحقاقات والمتابعة",
    paymentsRecovery: "المدفوعات والتحصيل",
    cityBranchAnalysis: "تحليل المدن والفروع",
    teamPerformance: "أداء الفريق",
    universalReports: "مركز تقارير CRM الشامل",

    customer360Title: "تقارير CRM — نظرة 360 للعميل",
    customer360Subtitle: "نظرة متكاملة 360° لعملائك وعلاقاتهم وأنشطتهم وصفقاتهم وبياناتهم المالية.",
    allCrmReports: "جميع تقارير CRM",
    newCustomer: "+ عميل جديد",
    searchPlaceholder: "البحث بالاسم، الرقم، الهاتف، البريد...",
    allCountries: "جميع البلدان",
    allBranches: "جميع الفروع",
    assignedUser: "الموظف المسؤول",
    searchFilter: "بحث وتصفية",
    more: "المزيد",
    columns: "الأعمدة",
    exportReport: "تصدير",
    printReport: "طباعة",
    exportCsv: "تصدير CSV",
    exportExcel: "تصدير Excel",
    downloadDetails: "تنزيل التفاصيل",
    exportDetailedCsv: "تصدير تفصيلي Excel (.csv)",
    downloadFullStatement: "تنزيل كشف الحساب الشامل 360",
    downloading: "جاري التنزيل...",
    fullScreen: "ملء الشاشة",
    exitFullScreen: "إنهاء ملء الشاشة",

    totalCustomers: "إجمالي العملاء",
    activeCustomers: "العملاء النشطون",
    followUpsToday: "متابعات اليوم",
    receivableDue: "المستحقات للتحصيل",
    customerHealth: "حالة العميل",
    vsLastPeriod: "مقارنة بالفترة السابقة",
    healthyAccounts: "حسابات مستقرة",
    calls: "مكالمات",
    meetings: "اجتماعات",
    others: "أخرى",

    customerRegister: "سجل العملاء",
    customersCount: "عملاء",
    srNo: "#",
    customerId: "رقم العميل",
    company: "الشركة / الاسم",
    country: "البلد",
    branch: "الفرع",
    lastContact: "آخر اتصال",
    nextAction: "الإجراء القادم",
    health: "الحالة",
    status: "الحالة",
    actions: "الإجراءات",
    view360: "عرض 360",

    healthExcellent: "ممتاز",
    healthGood: "جيد",
    healthMedium: "متوسط",
    healthLow: "منخفض",
    statusActive: "نشط",
    statusAtRisk: "في خطر",
    statusDueNow: "مستحق الآن",
    statusDueToday: "مستحق اليوم",
    statusUpcoming: "قادم",
    statusCompleted: "مكتمل",

    actionCall: "اتصال",
    actionMeeting: "اجتماع",
    actionSendQuote: "إرسال عرض",
    actionFollowUp: "متابعة",
    actionPayment: "دفعة",
    actionShipment: "شحنة",
    actionToday: "اليوم",

    upcomingFollowUps: "المتابعات القادمة",
    viewAll: "عرض الكل",
    subject: "الموضوع",
    assignedTo: "المسؤول",
    dueDate: "تاريخ الاستحقاق",
    startAction: "بدء",

    quickActions: "إجراءات سريعة",
    logCall: "اتصال",
    logCallDesc: "تسجيل مكالمة",
    message: "رسالة",
    messageDesc: "واتساب / بريد",
    scheduleMeeting: "اجتماع",
    meetingDesc: "جدولة اجتماع",
    addNote: "إضافة ملاحظة",
    noteDesc: "تدوين ملاحظة نشاط",

    profileOverview: "الملف التعريفي للعميل",
    financialPosition: "المركز المالي",
    totalReceivable: "إجمالي المدين (لنا)",
    totalPayable: "إجمالي الدائن (علينا)",
    netPosition: "صافي الرصيد",
    chequesBalance: "الشيكات المعلقة",
    activityTimeline: "سجل الأنشطة والجدول الزمني للمتابعة",
    salesOrders: "عروض الأسعار وسجلات المبيعات",
    purchases: "أوامر الشراء والمدفوعات",
    cheques: "الشيكات والتحصيلات",
    shippingClearing: "سجلات الشحن والتخليص",
    documents: "المستندات والتسجيلات",
    openOriginalRecord: "فتح قيد ERP الأصلي",
    logNewActivity: "تسجيل نشاط",
    saveActivity: "حفظ",
    cancel: "إلغاء",
    noteText: "ملاحظات النشاط",
    selectType: "نوع النشاط",
    close: "إغلاق",
    backToRegister: "العودة إلى سجل العملاء"
  },
  fa: {
    crmReports: "گزارش‌های CRM",
    crmReportCenter: "مرکز گزارش‌های CRM",
    searchCrmReport: "جستجوی گزارش CRM...",
    clickReportFullScreen: "برای باز شدن در حالت تمام‌صفحه روی گزارش کلیک کنید.",
    executiveDashboard: "داشبورد مدیریتی",
    leadPipeline: "جریان سرنخ‌ها",
    customer360: "دیدگاه ۳۶۰ مشتری",
    dueFollowUp: "سررسید و پیگیری",
    paymentsRecovery: "پرداخت‌ها و وصولی‌ها",
    cityBranchAnalysis: "تحلیل شهر و شعبه",
    teamPerformance: "عملکرد تیم",
    universalReports: "مرکز گزارش‌های جامع CRM",

    customer360Title: "گزارش‌های CRM — دیدگاه ۳۶۰ مشتری",
    customer360Subtitle: "دیدگاه جامع ۳۶۰ درجه از مشتریان، تعاملات، فعالیت‌ها، معاملات و وضعیت مالی.",
    allCrmReports: "تمام گزارش‌های CRM",
    newCustomer: "+ مشتری جدید",
    searchPlaceholder: "جستجوی مشتری بر اساس نام، شناسه، تلفن، ایمیل...",
    allCountries: "همه کشورها",
    allBranches: "همه شعبه‌ها",
    assignedUser: "کاربر مسئول",
    searchFilter: "جستجو و فیلتر",
    more: "بیشتر",
    columns: "ستون‌ها",
    exportReport: "خروجی",
    printReport: "چاپ",
    exportCsv: "خروجی CSV",
    exportExcel: "خروجی Excel",
    downloadDetails: "دانلود جزئیات",
    exportDetailedCsv: "خروجی جامع اکسل (.csv)",
    downloadFullStatement: "دانلود صورتحساب کامل ۳۶۰",
    downloading: "در حال دریافت...",
    fullScreen: "تمام‌صفحه",
    exitFullScreen: "خروج از تمام‌صفحه",

    totalCustomers: "کل مشتریان",
    activeCustomers: "مشتریان فعال",
    followUpsToday: "پیگیری‌های امروز",
    receivableDue: "مطالبات سررسید شده",
    customerHealth: "سلامت مشتری",
    vsLastPeriod: "نسبت به دوره قبل",
    healthyAccounts: "حساب‌های پایدار",
    calls: "تماس‌ها",
    meetings: "جلسات",
    others: "سایر",

    customerRegister: "دفتر ثبت مشتریان",
    customersCount: "مشتری",
    srNo: "#",
    customerId: "شناسه مشتری",
    company: "شرکت / نام",
    country: "کشور",
    branch: "شعبه",
    lastContact: "آخرین تماس",
    nextAction: "اقدام بعدی",
    health: "سلامت",
    status: "وضعیت",
    actions: "عملیات",
    view360: "مشاهده ۳۶۰",

    healthExcellent: "عالی",
    healthGood: "خوب",
    healthMedium: "متوسط",
    healthLow: "ضعیف",
    statusActive: "فعال",
    statusAtRisk: "در معرض خطر",
    statusDueNow: "سررسید فوری",
    statusDueToday: "سررسید امروز",
    statusUpcoming: "آینده",
    statusCompleted: "تکمیل شده",

    actionCall: "تماس",
    actionMeeting: "جلسه",
    actionSendQuote: "ارسال پیش‌فاکتور",
    actionFollowUp: "پیگیری",
    actionPayment: "پرداخت",
    actionShipment: "ارسال بار",
    actionToday: "امروز",

    upcomingFollowUps: "پیگیری‌های آینده",
    viewAll: "مشاهده همه",
    subject: "موضوع",
    assignedTo: "ارجاع به",
    dueDate: "تاریخ سررسید",
    startAction: "شروع",

    quickActions: "اقدامات سریع",
    logCall: "تماس",
    logCallDesc: "ثبت تماس تلفنی",
    message: "پیام",
    messageDesc: "واتس‌اپ / ایمیل",
    scheduleMeeting: "جلسه",
    meetingDesc: "تنظیم جلسه",
    addNote: "افزودن یادداشت",
    noteDesc: "ثبت یادداشت فعالیت",

    profileOverview: "مشخصات کلی مشتری",
    financialPosition: "موقعیت مالی",
    totalReceivable: "کل مطالبات (طلب ما)",
    totalPayable: "کل بدهی‌ها (بدهی ما)",
    netPosition: "تراز خالص",
    chequesBalance: "چک‌های معوقه",
    activityTimeline: "تاریخچه کامل فعالیت‌ها و جدول پیگیری",
    salesOrders: "پیش‌فاکتورها و سوابق فروش",
    purchases: "سوابق خرید و پرداخت",
    cheques: "چک‌ها و وصولی‌ها",
    shippingClearing: "سوابق حمل و ترخیص",
    documents: "مدارک و ثبت‌ها",
    openOriginalRecord: "باز کردن سند در ERP",
    logNewActivity: "ثبت فعالیت جدید",
    saveActivity: "ذخیره",
    cancel: "انصراف",
    noteText: "متن یادداشت",
    selectType: "نوع فعالیت",
    close: "بستن",
    backToRegister: "بازگشت به فهرست مشتریان"
  },
  ps: {
    crmReports: "د CRM راپورونه",
    crmReportCenter: "د CRM راپور مرکز",
    searchCrmReport: "د CRM راپور لټون...",
    clickReportFullScreen: "د بشپړې سکرین خلاصولو لپاره هر راپور باندې کلیک وکړئ.",
    executiveDashboard: "اجرائیوي ډشبورډ",
    leadPipeline: "د فرصتونو پایپ لاین",
    customer360: "د پیرودونکي ۳۶۰ لید",
    dueFollowUp: "واجبات او تعقیب",
    paymentsRecovery: "تادیات او بیرته ترلاسه کول",
    cityBranchAnalysis: "د ښار او څانګې تحلیل",
    teamPerformance: "د ټیم فعالیت",
    universalReports: "د راپورونو جامع مرکز",

    customer360Title: "د CRM راپورونه — د پیرودونکي ۳۶۰ لید",
    customer360Subtitle: "ستاسو د پیرودونکو، اړیکو، فعالیتونو، معاملو او مالي حالت بشپړ ۳۶۰ درجې لید.",
    allCrmReports: "ټول CRM راپورونه",
    newCustomer: "+ نوی پیرودونکی",
    searchPlaceholder: "د نوم، پیژندپاڼې، تلیفون، یا بریښنالیک له لارې لټون...",
    allCountries: "ټول هیوادونه",
    allBranches: "ټولې څانګې",
    assignedUser: "ټاکل شوی کاروونکی",
    searchFilter: "لټون او فلټر",
    more: "نور",
    columns: "ستونونه",
    exportReport: "صادرول",
    printReport: "چاپ",
    exportCsv: "CSV صادرول",
    exportExcel: "Excel صادرول",
    downloadDetails: "تفصيلي ډاونلوډ",
    exportDetailedCsv: "تفصیلي Excel راایستل (.csv)",
    downloadFullStatement: "د بشپړ ۳۶۰ حساب ډاونلوډ",
    downloading: "ډاونلوډ روان دی...",
    fullScreen: "بشپړه سکرین",
    exitFullScreen: "بشپړ سکرین بندول",

    totalCustomers: "ټول پیرودونکي",
    activeCustomers: "فعال پیرودونکي",
    followUpsToday: "د نن ورځې تعقیب",
    receivableDue: "د ترلاسه کولو وړ پیسې",
    customerHealth: "د پیرودونکي وضعیت",
    vsLastPeriod: "د تیرې مودې په پرتله",
    healthyAccounts: "باثباته حسابونه",
    calls: "تلیفونونه",
    meetings: "غونډې",
    others: "نور",

    customerRegister: "د پیرودونکو راجستر",
    customersCount: "پیرودونکي",
    srNo: "#",
    customerId: "پیرودونکي پیژند",
    company: "شرکت / نوم",
    country: "هیواد",
    branch: "څانګه",
    lastContact: "وروستۍ اړیکه",
    nextAction: "راتلونکی عمل",
    health: "روغتیا",
    status: "حالت",
    actions: "کړنې",
    view360: "۳۶۰ لید",

    healthExcellent: "عالي",
    healthGood: "ښه",
    healthMedium: "منځنی",
    healthLow: "ټیټ",
    statusActive: "فعال",
    statusAtRisk: "په خطر کې",
    statusDueNow: "همدا اوس واجب",
    statusDueToday: "نن واجب",
    statusUpcoming: "راتلونکی",
    statusCompleted: "بشپړ شوی",

    actionCall: "تلیفون",
    actionMeeting: "غونډه",
    actionSendQuote: "نرخ لیږل",
    actionFollowUp: "تعقیب",
    actionPayment: "تادیه",
    actionShipment: "بار وړل",
    actionToday: "نن",

    upcomingFollowUps: "راتلونکي تعقیبونه",
    viewAll: "ټول کتل",
    subject: "موضوع",
    assignedTo: "مسؤول شخص",
    dueDate: "د تادیې نیټه",
    startAction: "پیل",

    quickActions: "ګړندي اقدامات",
    logCall: "تلیفون",
    logCallDesc: "د تلیفون ثبت",
    message: "پیغام",
    messageDesc: "واټساپ / بریښنالیک",
    scheduleMeeting: "غونډه",
    meetingDesc: "غونډه پلانول",
    addNote: "نوټ اضافه کول",
    noteDesc: "د فعالیت یادښت ولیکئ",

    profileOverview: "د پیرودونکي عمومي معلومات",
    financialPosition: "مالي موقف",
    totalReceivable: "ټول پور (زموږ طلب)",
    totalPayable: "ټول پور (زموږ پور)",
    netPosition: "خالص وضعیت",
    chequesBalance: "پاتې چکونه",
    activityTimeline: "د فعالیتونو بشپړ تاریخ او تعقیب مهال ویش",
    salesOrders: "د پلور ریکارډونه او وړاندیزونه",
    purchases: "د پیرود او تادیاتو حوالې",
    cheques: "چکونه او بیرته ترلاسه کول",
    shippingClearing: "د بار وړلو او ګمرک اسناد",
    documents: "اسناد او راجسترونه",
    openOriginalRecord: "اصلي ERP ریکارډ پرانیزئ",
    logNewActivity: "نوی فعالیت ثبت کړئ",
    saveActivity: "ساتل",
    cancel: "لغوه",
    noteText: "د فعالیت یادښت",
    selectType: "د فعالیت ډول",
    close: "بندول",
    backToRegister: "بیرته راجستر ته"
  }
};

export function getCrmTranslation(lang: SupportedLanguage): CrmTranslations {
  return CRM_DICTIONARY[lang] || CRM_DICTIONARY.en;
}
