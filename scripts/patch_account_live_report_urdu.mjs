import fs from 'fs';

const filePath = 'features/accounts/components/account-live-report-panel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add transliteration and localization imports
if (!content.includes('import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";')) {
  content = `import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";\n` + content;
}

// Enhance liveReportLabels with rich Urdu dictionary
const oldLabels = `const liveReportLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  active: { en: "Active", ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  inProgress: { en: "In Progress", ur: "جاری ہے", ar: "قيد التنفيذ", fa: "در حال اجرا", ps: "په جریان کې" },
  accountTitle: { en: "Account Title", ur: "اکاؤنٹ عنوان" },
  accountCodeAuto: { en: "Account Code (Auto)", ur: "اکاؤنٹ کوڈ (خودکار)" },
  accountGroup: { en: "Account Group", ur: "اکاؤنٹ گروپ" },
  currency: { en: "Currency", ur: "کرنسی" },
  date: { en: "Date", ur: "تاریخ" },
  openingBalance: { en: "Opening Balance", ur: "اوپننگ بیلنس" },
  debitAmount: { en: "Debit Amount", ur: "ڈیبٹ رقم" },
  creditAmount: { en: "Credit Amount", ur: "کریڈٹ رقم" },
  netBalance: { en: "Net Balance", ur: "نیٹ بیلنس" },
  accountInformation: { en: "ACCOUNT INFORMATION", ur: "اکاؤنٹ معلومات" },
  customerInformation: { en: "CUSTOMER INFORMATION", ur: "کسمٹر معلومات" },
  customerName: { en: "Customer Name", ur: "کسمٹر نام" },
  customerCode: { en: "Customer Code", ur: "کسمٹر کوڈ" },
  customerType: { en: "Customer Type", ur: "کسمٹر قسم" },
  phone: { en: "Phone", ur: "فون" },
  email: { en: "Email", ur: "ای میل" },
  address: { en: "Address", ur: "پتہ" },
  lastUpdated: { en: "Last Updated", ur: "آخری اپڈیٹ" },
  companyDetails: { en: "COMPANY DETAILS", ur: "کمپنی تفصیلات" },
  companyName: { en: "Company Name", ur: "کمپنی نام" },
  companyCode: { en: "Company Code", ur: "کمپنی کوڈ" },
  registrationNo: { en: "Registration No.", ur: "رجسٹریشن نمبر" },
  bankDetails: { en: "BANK DETAILS", ur: "بینک تفصیلات" },
  bankName: { en: "Bank Name", ur: "بینک نام" },
  accountNumber: { en: "Account Number", ur: "اکاؤنٹ نمبر" },
  bankBranch: { en: "Bank Branch", ur: "بینک برانچ" },
  swiftCode: { en: "Swift Code", ur: "سوفٹ کوڈ" },
  warehouseDetails: { en: "WAREHOUSE DETAILS", ur: "گودام تفصیلات" },
  warehouseName: { en: "Warehouse Name", ur: "گودام نام" },
  warehouseCode: { en: "Warehouse Code", ur: "گودام کوڈ" },
  location: { en: "Location", ur: "مقام" },
  auditInformation: { en: "AUDIT INFORMATION", ur: "آڈٹ معلومات" },
  accountName: { en: "Account Name", ur: "اکاؤنٹ نام" },
  accountCode: { en: "Account Code", ur: "اکاؤنٹ کوڈ" },
  subType: { en: "Sub Type", ur: "ذیلی قسم" },
  category: { en: "Category", ur: "کیٹیگری" },
  manualRef: { en: "Manual Ref", ur: "دستی حوالہ" },
  country: { en: "Country", ur: "ملک" },
  branch: { en: "Branch", ur: "برانچ" },
  createdBy: { en: "Created By", ur: "بنایا گیا بذریعہ" },
  createdAt: { en: "Created At", ur: "بنانے کا وقت" },
  updatedBy: { en: "Updated By", ur: "اپڈیٹ بذریعہ" },
  updatedAt: { en: "Updated At", ur: "اپڈیٹ وقت" },
  ipAddress: { en: "IP Address", ur: "آئی پی ایڈریس" },
  browserPlatform: { en: "Browser / Platform", ur: "براؤزر / پلیٹ فارم" },
  mobileNumber: { en: "Mobile Number", ur: "موبائل نمبر", ar: "رقم الهاتف المحمول", fa: "شماره موبایل", ps: "د موبایل شمیره" },
  contactsList: { en: "Contacts", ur: "رابطہ نمبرز", ar: "جهات الاتصال", fa: "مخاطبین", ps: "اړیکې" }
};`;

const newLabels = `const liveReportLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  active: { en: "Active", ur: "فعال", ar: "نشط", fa: "فعال", ps: "فعال" },
  inProgress: { en: "In Progress", ur: "جاری ہے", ar: "قيد التنفيذ", fa: "در حال اجرا", ps: "په جریان کې" },
  accountTitle: { en: "Account Title", ur: "اکاؤنٹ عنوان" },
  accountCodeAuto: { en: "Account Code (Auto)", ur: "اکاؤنٹ کوڈ (خودکار)" },
  accountGroup: { en: "Account Group", ur: "اکاؤنٹ گروپ" },
  currency: { en: "Currency", ur: "کرنسی" },
  date: { en: "Date", ur: "تاریخ" },
  openingBalance: { en: "Opening Balance", ur: "ابتدائی بیلنس" },
  debitAmount: { en: "Debit Amount", ur: "ڈیبٹ رقم" },
  creditAmount: { en: "Credit Amount", ur: "کریڈٹ رقم" },
  netBalance: { en: "Net Balance", ur: "نیٹ بیلنس" },
  accountInformation: { en: "ACCOUNT INFORMATION", ur: "اکاؤنٹ کی معلومات" },
  customerInformation: { en: "CUSTOMER INFORMATION", ur: "کسٹمر کی معلومات" },
  customerName: { en: "Customer Name", ur: "کسٹمر کا نام" },
  customerCode: { en: "Customer Code", ur: "کسٹمر کوڈ" },
  customerType: { en: "Customer Type", ur: "کسٹمر کی قسم" },
  phone: { en: "Phone", ur: "فون نمبر" },
  email: { en: "Email", ur: "ای میل" },
  address: { en: "Address", ur: "پتہ" },
  lastUpdated: { en: "Last Updated", ur: "آخری اپ ڈیٹ" },
  companyDetails: { en: "COMPANY DETAILS", ur: "کمپنی کی تفصیلات" },
  companyName: { en: "Company Name", ur: "کمپنی کا نام" },
  companyCode: { en: "Company Code", ur: "کمپنی کوڈ" },
  registrationNo: { en: "Registration No.", ur: "رجسٹریشن نمبر" },
  bankDetails: { en: "BANK DETAILS", ur: "بینک کی تفصیلات" },
  bankName: { en: "Bank Name", ur: "بینک کا نام" },
  accountNumber: { en: "Account Number", ur: "اکاؤنٹ نمبر" },
  bankBranch: { en: "Bank Branch", ur: "بینک برانچ" },
  swiftCode: { en: "Swift Code", ur: "سوئفٹ کوڈ" },
  warehouseDetails: { en: "WAREHOUSE DETAILS", ur: "گودام کی تفصیلات" },
  warehouseName: { en: "Warehouse Name", ur: "گودام کا نام" },
  warehouseCode: { en: "Warehouse Code", ur: "گودام کوڈ" },
  location: { en: "Location", ur: "مقام" },
  auditInformation: { en: "AUDIT INFORMATION", ur: "آڈٹ معلومات" },
  accountName: { en: "Account Name", ur: "اکاؤنٹ کا نام" },
  accountCode: { en: "Account Code", ur: "اکاؤنٹ کوڈ" },
  subType: { en: "Sub Type", ur: "ذیلی قسم" },
  category: { en: "Category", ur: "کیٹیگری" },
  manualRef: { en: "Manual Ref", ur: "دستی حوالہ" },
  country: { en: "Country", ur: "ملک" },
  branch: { en: "Branch", ur: "برانچ" },
  createdBy: { en: "Created By", ur: "بنایا گیا بذریعہ" },
  createdAt: { en: "Created At", ur: "تخلیق کی تاریخ" },
  updatedBy: { en: "Updated By", ur: "اپ ڈیٹ بذریعہ" },
  updatedAt: { en: "Updated At", ur: "اپ ڈیٹ کا وقت" },
  ipAddress: { en: "IP Address", ur: "آئی پی ایڈریس" },
  browserPlatform: { en: "Browser / Platform", ur: "براؤزر / پلیٹ فارم" },
  mobileNumber: { en: "Mobile Number", ur: "موبائل نمبر", ar: "رقم الهاتف المحمول", fa: "شماره موبایل", ps: "د موبایل شمیره" },
  contactsList: { en: "Contacts", ur: "رابطہ نمبرز", ar: "جهات الاتصال", fa: "مخاطبین", ps: "اړیکې" }
};`;

content = content.replace(oldLabels, newLabels);

// Enhance header and section values with proper Urdu transliteration / localization
const oldHeader = `<h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">{accountName || "ASMATKHAN"}</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">{accountTitle || t("accountTitle", "Account Title")}</p>
          </div>
          
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl lg:ml-8 text-left">
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountCodeAuto", "Account Code (Auto)")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{accountCode || "AST-001"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountGroup", "Account Group")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{category || "Sundry Debtors"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("currency", "Currency")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{currency || "PKR"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("date", "Date")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">{stampDate || "31 Dec 2024"}</div>
            </div>`;

const newHeader = `<h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
              {lang === "ur" ? transliterateProperNoun(accountName || "ASMATKHAN", "ur") : (accountName || "ASMATKHAN")}
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {localizeTerm(accountTitle || t("accountTitle", "Account Title"), lang)}
            </p>
          </div>
          
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl lg:ml-8 text-left rtl:text-right">
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountCodeAuto", "Account Code (Auto)")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700 font-mono">{accountCode || "AST-001"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("accountGroup", "Account Group")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700">
                {localizeTerm(category || "Sundry Debtors", lang)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("currency", "Currency")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700 font-mono">{currency || "PKR"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t("date", "Date")}</div>
              <div className="text-xs font-bold mt-1 text-slate-700 font-mono">{stampDate || "31 Dec 2024"}</div>
            </div>`;

content = content.replace(oldHeader, newHeader);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ account-live-report-panel.tsx updated with comprehensive Urdu transliteration and localization!');
