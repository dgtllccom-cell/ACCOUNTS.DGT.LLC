"use client";

/**
 * External Form Client — /ext/form/[token]
 *
 * Standalone, high-converting public form page.
 * Matching the exact 4-Step Smart & Responsive UI:
 *   Step 1: Personal Info (Multi-Phone + Numbers Keypad), Documents (CNIC Front/Back, Passport Pages) & Contracts
 *   Step 2: Address Information (100% 5-Language Localized Country -> State -> City -> Postal Code Cascader)
 *   Step 3: Review Your Information (Structured Cards with Edit jump-backs)
 *   Step 4: Photo, Final Submit & Comprehensive Confirmation Receipt Card
 *
 * 100% Responsive on Mobile (iPhone/Android) and Desktop.
 * 5-Language Parity (English, Urdu, Arabic, Persian, Pashto) with full RTL and A-to-Z translation.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Shield,
  Globe,
  User,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  CreditCard,
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Download,
  Printer,
  MapPin,
  Building,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Send,
  AlertCircle,
  Check,
  X,
  FileCheck,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Calendar
} from "lucide-react";

// ─── 5-Language Dictionary ────────────────────────────────────────────────────

type Lang = "en" | "ur" | "ar" | "fa" | "ps";

const LANGS: { code: Lang; label: string; dir: "ltr" | "rtl"; nativeName: string }[] = [
  { code: "en", label: "English", dir: "ltr", nativeName: "English" },
  { code: "ur", label: "Urdu", dir: "rtl", nativeName: "اردو" },
  { code: "ar", label: "Arabic", dir: "rtl", nativeName: "العربية" },
  { code: "fa", label: "Persian", dir: "rtl", nativeName: "فارسی" },
  { code: "ps", label: "Pashto", dir: "rtl", nativeName: "پښتو" },
];

const dict: Record<string, Record<Lang, string>> = {
  headerTitle: {
    en: "Secure Form Submission",
    ur: "محفوظ فارم جمع کروائیں",
    ar: "تقديم النموذج الآمن",
    fa: "ارسال فرم امن",
    ps: "خوندي فورم ثبتول",
  },
  headerSubtitle: {
    en: "Smart & Responsive ERP Registration",
    ur: "اسمارٹ اور ریسپانسو رجسٹریشن فارم",
    ar: "تسجيل ذكي ومتجاوب في نظام ERP",
    fa: "ثبت‌نام هوشمند و واکنش‌گرا در سیستم",
    ps: "هوښیار او چټک د ثبت نام فورم",
  },
  step1: {
    en: "Personal Info",
    ur: "ذاتی معلومات",
    ar: "المعلومات الشخصية",
    fa: "اطلاعات شخصی",
    ps: "شخصي معلومات",
  },
  step2: {
    en: "Documents & Contracts",
    ur: "دستاویزات اور معاہدے",
    ar: "المستندات والعقود",
    fa: "مدارک و قراردادها",
    ps: "اسناد او قراردادونه",
  },
  step3: {
    en: "Address",
    ur: "پتہ اور رہائش",
    ar: "العنوان والإقامة",
    fa: "آدرس و اقامت",
    ps: "پته او استوګنه",
  },
  step4: {
    en: "Profile Photo",
    ur: "امیدوار کی تصویر",
    ar: "الصورة الشخصية",
    fa: "عکس پرسنلی",
    ps: "د غوښتونکي انځور",
  },
  step5: {
    en: "Review & Report",
    ur: "جائزہ اور رپورٹ",
    ar: "المراجعة والتقرير",
    fa: "بازبینی و گزارش",
    ps: "کتنه او راپور",
  },
  personalInfoTitle: {
    en: "Personal Information",
    ur: "ذاتی معلومات",
    ar: "المعلومات الشخصية",
    fa: "اطلاعات شخصی",
    ps: "شخصي معلومات",
  },
  personalInfoSub: {
    en: "Please enter your personal details.",
    ur: "براہِ کرم اپنی ذاتی تفصیلات درج کریں۔",
    ar: "يرجى إدخال بياناتك الشخصية.",
    fa: "لطفاً اطلاعات شخصی خود را وارد کنید.",
    ps: "مهرباني وکړئ خپل شخصي معلومات دننه کړئ.",
  },
  firstName: {
    en: "First Name",
    ur: "پہلا نام",
    ar: "الاسم الأول",
    fa: "نام",
    ps: "لومړی نوم",
  },
  firstNamePh: {
    en: "Enter first name",
    ur: "پہلا نام درج کریں",
    ar: "أدخل الاسم الأول",
    fa: "نام را وارد کنید",
    ps: "لومړی نوم ولیکئ",
  },
  lastName: {
    en: "Last Name",
    ur: "آخری نام",
    ar: "اسم العائلة",
    fa: "نام خانوادگی",
    ps: "وروستی نوم",
  },
  lastNamePh: {
    en: "Enter last name",
    ur: "آخری نام درج کریں",
    ar: "أدخل اسم العائلة",
    fa: "نام خانوادگی را وارد کنید",
    ps: "وروستی نوم ولیکئ",
  },
  fatherName: {
    en: "Father's / Guardian's Name",
    ur: "والد / سرپرست کا نام",
    ar: "اسم الأب / ولي الأمر",
    fa: "نام پدر / سرپرست",
    ps: "د پلار / سرپرست نوم",
  },
  fatherNamePh: {
    en: "Enter father / guardian name",
    ur: "والد یا سرپرست کا نام درج کریں",
    ar: "أدخل اسم الأب أو ولي الأمر",
    fa: "نام پدر یا سرپرست را وارد کنید",
    ps: "د پلار یا سرپرست نوم ولیکئ",
  },
  mobile: {
    en: "Mobile / Phone",
    ur: "موبائل / فون",
    ar: "الجوال / الهاتف",
    fa: "تلفن همراه",
    ps: "ګرځنده تیلیفون / شمېره",
  },
  mobilePh: {
    en: "Enter mobile number",
    ur: "موبائل نمبر درج کریں",
    ar: "أدخل رقم الجوال",
    fa: "شماره موبایل را وارد کنید",
    ps: "د مبایل شمېره ولیکئ",
  },
  addAnotherMobile: {
    en: "+ Add Another Phone",
    ur: "+ اضافی فون نمبر شامل کریں",
    ar: "+ إضافة هاتف آخر",
    fa: "+ افزودن شماره دیگر",
    ps: "+ بله شمېره ورزیاته کړئ",
  },
  whatsapp: {
    en: "WhatsApp Number",
    ur: "واٹس ایپ نمبر",
    ar: "رقم الواتساب",
    fa: "شماره واتس‌اپ",
    ps: "د واټس‌اپ شمېره",
  },
  whatsappPh: {
    en: "Enter WhatsApp number",
    ur: "واٹس ایپ نمبر درج کریں",
    ar: "أدخل رقم الواتساب",
    fa: "شماره واتس‌اپ را وارد کنید",
    ps: "د واټس‌اپ شمېره ولیکئ",
  },
  addAnotherWhatsapp: {
    en: "+ Add Another WhatsApp",
    ur: "+ اضافی واٹس ایپ شامل کریں",
    ar: "+ إضافة واتساب آخر",
    fa: "+ افزودن واتس‌اپ دیگر",
    ps: "+ بل واټس‌اپ ورزیاته کړئ",
  },
  email: {
    en: "Email Address (English)",
    ur: "ای میل ایڈریس (انگریزی میں لکھیں)",
    ar: "البريد الإلكتروني (باللغة الإنجليزية)",
    fa: "آدرس ایمیل (به انگلیسی)",
    ps: "د بریښنالیک پته (په انګلیسي ولیکئ)",
  },
  emailPh: {
    en: "name@example.com",
    ur: "name@example.com",
    ar: "name@example.com",
    fa: "name@example.com",
    ps: "name@example.com",
  },
  gender: {
    en: "Gender",
    ur: "جنس",
    ar: "الجنس",
    fa: "جنسیت",
    ps: "جنسیت",
  },
  male: {
    en: "Male",
    ur: "مرد",
    ar: "ذكر",
    fa: "مرد",
    ps: "نارینه",
  },
  female: {
    en: "Female",
    ur: "عورت",
    ar: "أنثى",
    fa: "زن",
    ps: "ښځینه",
  },
  other: {
    en: "Other",
    ur: "دیگر",
    ar: "آخر",
    fa: "سایر",
    ps: "نور",
  },
  documentsTitle: {
    en: "Documents",
    ur: "دستاویزات",
    ar: "المستندات",
    fa: "مدارک",
    ps: "اسناد",
  },
  documentsSub: {
    en: "Add your documents one by one.",
    ur: "اپنی دستاویزات ایک ایک کر کے شامل کریں۔",
    ar: "أضف مستنداتك واحداً تلو الآخر.",
    fa: "مدارک خود را یکی یکی اضافه کنید.",
    ps: "خپل اسناد یو یو ورزیات کړئ.",
  },
  docType: {
    en: "Document Type",
    ur: "دستاویز کی قسم",
    ar: "نوع المستند",
    fa: "نوع مدرک",
    ps: "د سند ډول",
  },
  docNumber: {
    en: "Document Number",
    ur: "دستاویز نمبر",
    ar: "رقم المستند",
    fa: "شماره مدرک",
    ps: "د سند شمېره",
  },
  docNumberPh: {
    en: "Enter document number",
    ur: "دستاویز نمبر درج کریں",
    ar: "أدخل رقم المستند",
    fa: "شماره مدرک را وارد کنید",
    ps: "د سند شمېره ولیکئ",
  },
  frontSide: {
    en: "Front Side",
    ur: "سامنے کا رخ (Front)",
    ar: "الوجه الأمامي",
    fa: "روی مدرک (جلو)",
    ps: "مخکینی مخ",
  },
  backSide: {
    en: "Back Side",
    ur: "پیچھے کا رخ (Back)",
    ar: "الوجه الخلفي",
    fa: "پشت مدرک (عقب)",
    ps: "شاته مخ",
  },
  mainPage: {
    en: "Main Info Page",
    ur: "پہلا معلوماتی صفحہ",
    ar: "صفحة البيانات الرئيسية",
    fa: "صفحه مشخصات اصلی",
    ps: "د اصلي معلوماتو پاڼه",
  },
  visaPage: {
    en: "Visa / Back Page",
    ur: "ویزا / پچھلا صفحہ",
    ar: "صفحة التأشيرة / الخلفية",
    fa: "صفحه ویزا / پشت",
    ps: "د ویزې / شاته پاڼه",
  },
  cameraBtn: {
    en: "Camera",
    ur: "کیمرہ",
    ar: "كاميرا",
    fa: "دوربین",
    ps: "کیمره",
  },
  galleryBtn: {
    en: "Gallery",
    ur: "گیلری",
    ar: "المعرض",
    fa: "گالری",
    ps: "ګالري",
  },
  addDocBtn: {
    en: "+ Add Document",
    ur: "+ دستاویز شامل کریں",
    ar: "+ إضافة مستند",
    fa: "+ افزودن مدرک",
    ps: "+ سند ورزیات کړئ",
  },
  contractsTitle: {
    en: "Contracts & Attachments",
    ur: "معاہدے اور دستاویزات",
    ar: "العقود والمرفقات",
    fa: "قراردادها و ضمائم",
    ps: "قراردادونه او ضمیمې",
  },
  contractsSub: {
    en: "Add applicable agreements or reference letters.",
    ur: "متعلقہ معاہدے یا حوالہ جاتی دستاویزات شامل کریں۔",
    ar: "أضف الاتفاقيات المعمول بها أو خطابات المرجعية.",
    fa: "توافق‌نامه‌ها یا اسناد مربوطه را اضافه کنید.",
    ps: "اړوند قراردادونه یا ضمیمې اضافه کړئ.",
  },
  contractType: {
    en: "Contract Type",
    ur: "معاہدے کی قسم",
    ar: "نوع العقد",
    fa: "نوع قرارداد",
    ps: "د قرارداد ډول",
  },
  addContractBtn: {
    en: "+ Add Contract",
    ur: "+ معاہدہ شامل کریں",
    ar: "+ إضافة عقد",
    fa: "+ افزودن قرارداد",
    ps: "+ قرارداد ورزیات کړئ",
  },
  step2Title: {
    en: "Address Details",
    ur: "پتے کی تفصیلات",
    ar: "تفاصيل العنوان",
    fa: "جزئیات آدرس",
    ps: "د پتې تفصیلات",
  },
  step2Sub: {
    en: "Select country, state, city and enter full street address.",
    ur: "براہِ کرم ملک، صوبہ اور شہر منتخب کریں اور مکمل پتہ درج کریں۔",
    ar: "يرجى تحديد الدولة والمحافظة والمدينة وإدخال العنوان الكامل.",
    fa: "لطفاً کشور، استان و شهر را انتخاب کرده و آدرس کامل را وارد کنید.",
    ps: "مهرباني وکړئ هیواد، ولایت او ښار وټاکئ او بشپړه پته ولیکئ.",
  },
  country: {
    en: "Country",
    ur: "ملک",
    ar: "الدولة / البلد",
    fa: "کشور",
    ps: "هیواد",
  },
  stateProvince: {
    en: "State / Province / Emirate",
    ur: "صوبہ / ریاست / امارت",
    ar: "المحافظة / الإمارة / الولاية",
    fa: "استان / ایالت",
    ps: "ولایت / ایالت",
  },
  city: {
    en: "City / Port / Commercial Hub",
    ur: "شہر / پورٹ / تجارتی مرکز",
    ar: "المدينة / الميناء / المركز التجاري",
    fa: "شهر / بندر / مرکز تجاری",
    ps: "ښار / بندر / سوداګریز مرکز",
  },
  postalCode: {
    en: "Postal / City Code (Auto-Filled)",
    ur: "پوسٹل / سٹی کوڈ (خودکار درج)",
    ar: "الرمز البريدي / رمز المدينة",
    fa: "کد پستی / کد شهر",
    ps: "پوسټل / ښار کوډ",
  },
  fullAddress: {
    en: "Full Address (Street, Building, Office)",
    ur: "مکمل پتہ (گلی، عمارت، مکان / دفتر)",
    ar: "العنوان الكامل (الشارع، المبنى، المكتب)",
    fa: "آدرس کامل (خیابان، ساختمان، پلاک)",
    ps: "بشپړه پته (کوڅه، ودانۍ، دفتر)",
  },
  fullAddressPh: {
    en: "Enter complete street address, suite, or flat number",
    ur: "اپنا مکمل پتہ درج کریں (گلی، عمارت، مکان / دفتر)",
    ar: "أدخل عنوان الشارع الكامل أو رقم المكتب أو الشقة",
    fa: "آدرس دقیق خیابان، ساختمان و پلاک را وارد کنید",
    ps: "خپله بشپړه پته (کوڅه، ودانۍ، دفتر) ولیکئ",
  },
  step3Title: {
    en: "Review Your Information",
    ur: "اپنی معلومات کا جائزہ لیں",
    ar: "مراجعة معلوماتك",
    fa: "بازبینی اطلاعات شما",
    ps: "د خپلو معلوماتو بیاکتنه وکړئ",
  },
  step3Sub: {
    en: "Please verify all details before final submission.",
    ur: "جمع کروانے سے پہلے تمام تفصیلات کی تصدیق کر لیں۔",
    ar: "يرجى التحقق من جميع البيانات قبل الإرسال النهائي.",
    fa: "لطفاً قبل از ارسال نهایی تمام مشخصات را بازبینی کنید.",
    ps: "مهرباني وکړئ د سپارلو دمخه ټول معلومات تایید کړئ.",
  },
  editBtn: {
    en: "Edit",
    ur: "ترمیم کریں",
    ar: "تعديل",
    fa: "ویرایش",
    ps: "بدلون",
  },
  reviewVerifyBadge: {
    en: "Are all details accurate? You can edit any section before submitting.",
    ur: "کیا تمام معلومات درست ہیں؟ آپ ضرورت پڑنے پر کسی بھی حصے میں ترمیم کر سکتے ہیں۔",
    ar: "هل جميع البيانات دقيقة؟ يمكنك تعديل أي قسم قبل الإرسال.",
    fa: "آیا تمام اطلاعات صحیح است؟ می‌توانید هر بخش را ویرایش کنید.",
    ps: "ایا ټول معلومات سم دي؟ تاسو کولی شئ اړین بدلونونه راولئ.",
  },
  step4Title: {
    en: "Upload Profile Photo",
    ur: "اپنی تصویر اپ لوڈ کریں",
    ar: "تحميل الصورة الشخصية",
    fa: "بارگذاری عکس پرسنلی",
    ps: "خپل انځور پورته کړئ",
  },
  step4Sub: {
    en: "Please upload your recent photo.",
    ur: "براہِ کرم اپنی حالیہ تصویر اپ لوڈ کریں۔",
    ar: "يرجى تحميل صورتك الشخصية الحديثة.",
    fa: "لطفاً عکس پرسنلی جدید خود را بارگذاری کنید.",
    ps: "مهرباني وکړئ خپل نوی عکس پورته کړئ.",
  },
  photoSizeHint: {
    en: "JPG, PNG (Max 5MB)",
    ur: "(5MB سے زیادہ نہ ہو JPG, PNG)",
    ar: "JPG, PNG (الحد الأقصى 5 ميجابايت)",
    fa: "JPG, PNG (حداکثر ۵ مگابایت)",
    ps: "JPG, PNG (تر 5MB پورې)",
  },
  nextDocsBtn: {
    en: "Next: Documents & Contracts →",
    ur: "اگلا: دستاویزات اور معاہدے →",
    ar: "التالي: المستندات والعقود ←",
    fa: "بعدی: مدارک و قراردادها ←",
    ps: "بل: اسناد او قراردادونه ←",
  },
  nextAddressBtn: {
    en: "Next: Address Details →",
    ur: "اگلا: پتہ اور رہائش →",
    ar: "التالي: العنوان والإقامة ←",
    fa: "بعدی: آدرس و اقامت ←",
    ps: "بل: پته او استوګنه ←",
  },
  nextPhotoBtn: {
    en: "Next: Profile Photo →",
    ur: "اگلا: تصویر اپلوڈ کریں →",
    ar: "التالي: الصورة الشخصية ←",
    fa: "بعدی: عکس پرسنلی ←",
    ps: "بل: انځور پورته کول ←",
  },
  nextReviewBtn: {
    en: "Next: Review & Application Report →",
    ur: "اگلا: مکمل جائزہ اور تصدیقی رپورٹ →",
    ar: "التالي: المراجعة وتقرير الطلب ←",
    fa: "بعدی: بازبینی و گزارش درخواست ←",
    ps: "بل: کتنه او د غوښتنلیک راپور ←",
  },
  backBtn: {
    en: "Back",
    ur: "واپس",
    ar: "رجوع",
    fa: "بازگشت",
    ps: "شاته",
  },
  submitFormBtn: {
    en: "Submit Form",
    ur: "فارم جمع کروائیں",
    ar: "إرسال النموذج",
    fa: "ارسال فرم",
    ps: "فورم وسپارئ",
  },
  successTitle: {
    en: "Form Submitted Successfully!",
    ur: "فارم کامیابی سے جمع ہو گیا!",
    ar: "تم إرسال النموذج بنجاح!",
    fa: "فرم با موفقیت ارسال شد!",
    ps: "فورم په بریالیتوب سره ثبت شو!",
  },
  successMsg: {
    en: "Thank you! Your submission has been securely recorded in our ERP system.",
    ur: "شکریہ! آپ کی معلومات اور دستاویزات محفوظ طریقے سے ERP سسٹم میں درج ہو چکی ہیں۔",
    ar: "شكراً لك! تم استلام بياناتك ومستنداتك بأمان وتسجيلها في نظام ERP الخاص بنا.",
    fa: "با تشکر! اطلاعات و مدارک شما با موفقیت و به صورت امن در سیستم ERP ثبت شد.",
    ps: "مننه! ستاسو معلومات او اسناد په خوندي ډول زموږ په ERP سیسټم کې ثبت شول.",
  },
  receiptTitle: {
    en: "Official Submission Receipt",
    ur: "آفیشل سمبیشن رسید",
    ar: "إيصال التقديم الرسمي",
    fa: "رسید رسمی ثبت‌نام",
    ps: "د ثبت رسمي رسید",
  },
  receiptRef: {
    en: "Reference Token",
    ur: "ریفرنس ٹوکن",
    ar: "رمز المرجع",
    fa: "کد پیگیری",
    ps: "د حوالې کوډ",
  },
  submittedOn: {
    en: "Submitted On",
    ur: "جمع کرنے کی تاریخ",
    ar: "تاريخ التقديم",
    fa: "تاریخ ارسال",
    ps: "د سپارلو نېټه",
  },
  printReceipt: {
    en: "Print / Save Receipt",
    ur: "رسید پرنٹ / محفوظ کریں",
    ar: "طباعة / حفظ الإيصال",
    fa: "چاپ / ذخیره رسید",
    ps: "رسید چاپ / خوندي کړئ",
  },
  submitAnother: {
    en: "Submit Another Form",
    ur: "دوسرا فارم جمع کروائیں",
    ar: "تقديم نموذج آخر",
    fa: "ارسال فرم دیگر",
    ps: "بل فورم وسپارئ",
  },
  errorInvalid: {
    en: "Invalid or Expired Link",
    ur: "غیر معتبر یا ختم شدہ لنک",
    ar: "الرابط غير صالح أو منتهي الصلاحية",
    fa: "لینک نامعتبر یا منقضی شده است",
    ps: "لینک ناسم دی یا وخت یې پوره شوی دی",
  },
  loading: {
    en: "Loading form...",
    ur: "فارم لوڈ ہو رہا ہے...",
    ar: "جارٍ تحميل النموذج...",
    fa: "در حال بارگذاری فرم...",
    ps: "فورم لوډ کیږي...",
  },
  issueDate: {
    en: "Issue Date",
    ur: "تاریخِ اجراء",
    ar: "تاريخ الإصدار",
    fa: "تاریخ صدور",
    ps: "د صادرېدو نېټه",
  },
  expiryDate: {
    en: "Expiry Date",
    ur: "تاریخِ تنسیخ / میعاد",
    ar: "تاريخ الانتهاء",
    fa: "تاریخ انقضا",
    ps: "د پای نېټه",
  },
  dob: {
    en: "Date of Birth",
    ur: "تاریخِ پیدائش",
    ar: "تاريخ الميلاد",
    fa: "تاریخ تولد",
    ps: "د زېږېدو نېټه",
  },
  contactType: {
    en: "Contact Type",
    ur: "رابطے کی قسم",
    ar: "نوع جهة الاتصال",
    fa: "نوع تماس",
    ps: "د اړیکې ډول",
  },
  customDocName: {
    en: "Custom Document Name",
    ur: "دستاویز کا نیا نام",
    ar: "اسم المستند المخصص",
    fa: "نام مدرک سفارشی",
    ps: "د سند نوی نوم",
  },
  customDocNamePh: {
    en: "e.g. Tazkira / QID / Business Card",
    ur: "مثلاً تذکرہ / قطری شناختی کارڈ وغیرہ",
    ar: "مثال: بطاقة شخصية / تذكرة / بطاقة عمل",
    fa: "مثلاً تذکره / کارت هویت محلی",
    ps: "لکه برېښنايي تذکره یا بل ځانګړی سند",
  },
  addContactBtn: {
    en: "+ Add Another Contact",
    ur: "+ نیا فون / رابطہ شامل کریں",
    ar: "+ إضافة جهة اتصال أخرى",
    fa: "+ افزودن تماس دیگر",
    ps: "+ بله اړیکه ورزیاته کړئ",
  },
  phoneLabel: {
    en: "Phone / Contact Number",
    ur: "فون / رابطہ نمبر",
    ar: "رقم الهاتف / الاتصال",
    fa: "شماره تماس / تلفن",
    ps: "د اړیکې / تیلیفون شمېره",
  },
  aiScanTitle: {
    en: "⚡ Instant AI Document & Smart ID Scanner",
    ur: "⚡ فوری اسمارٹ شناختی کارڈ اسکینر (آٹو فل)",
    ar: "⚡ الماسح الذكي للهوية والمستندات (تعبئة تلقائية)",
    fa: "⚡ اسکنر هوشمند کارت شناسایی (تکمیل خودکار)",
    ps: "⚡ د هویت د کارت هوښیار سکینر (خپلکار ډکول)",
  },
  aiScanSubtitle: {
    en: "Take a photo of your ID card — names, ID number & dates are auto-extracted instantly!",
    ur: "شناختی کارڈ کی تصویر لیں — نام، شناختی نمبر اور تاریخیں خود بخود درج ہو جائیں گی!",
    ar: "التقط صورة لبطاقة الهوية — سيتم استخراج الاسم ورقم الهوية والتواريخ تلقائيًا!",
    fa: "از کارت شناسایی عکس بگیرید — نام، شماره و تاریخ‌ها خودکار پر می‌شوند!",
    ps: "د هویت د کارت انځور واخلئ — نوم، د کارت شمېره او نېټې به پخپله ډکې شي!",
  },
  aiScanningBadge: {
    en: "⚡ Scanning & Auto-Extracting details...",
    ur: "⚡ اسمارٹ اسکیننگ جاری ہے، تفصیلات حاصل کی جا رہی ہیں...",
    ar: "⚡ جارٍ المسح واستخراج البيانات تلقائيًا...",
    fa: "⚡ در حال اسکن و استخراج هوشمند اطلاعات...",
    ps: "⚡ سکین روان دی، معلومات په اوتومات ډول راایستل کیږي...",
  },
  aiScanSuccessMsg: {
    en: "Document details auto-extracted! You can review or edit anytime.",
    ur: "دستاویز کی تفصیلات خود بخود درج ہو گئیں۔ آپ ضرورت کے مطابق ترمیم کر سکتے ہیں۔",
    ar: "تم استخراج بيانات المستند بنجاح! يمكنك مراجعتها أو تعديلها في أي وقت.",
    fa: "اطلاعات مدرک با موفقیت استخراج شد! می‌توانید در صورت نیاز ویرایش کنید.",
    ps: "د سند معلومات په بریالیتوب سره راواخیستل شول! تاسو یې هر وخت سمولی شئ.",
  },
  retakeBtn: {
    en: "Retake",
    ur: "دوبارہ تصویر لیں",
    ar: "إعادة التقاط",
    fa: "عکس مجدد",
    ps: "بیا انځور واخلئ",
  },
  clearBtn: {
    en: "Clear",
    ur: "صاف کریں",
    ar: "مسح",
    fa: "پاک کردن",
    ps: "پاک کړئ",
  },
  viewFullBtn: {
    en: "View Full",
    ur: "بڑی تصویر دیکھیں",
    ar: "عرض الصورة",
    fa: "مشاهده کامل",
    ps: "بشپړ انځور کتل",
  },
  frontSideReady: {
    en: "Front Side (Ready)",
    ur: "سامنے والی سائیڈ (تیار ہے)",
    ar: "الجهة الأمامية (جاهزة)",
    fa: "رویه کارت (آماده)",
    ps: "مخکینی اړخ (چمتو دی)",
  },
  backSideReady: {
    en: "Back Side (Ready)",
    ur: "پچھلی سائیڈ (تیار ہے)",
    ar: "الجهة الخلفية (جاهزة)",
    fa: "پشت کارت (آماده)",
    ps: "شا اړخ (چمتو دی)",
  },
  downloadSlipBtn: {
    en: "Download Application Slip (PDF)",
    ur: "درخواست کی تصدیقی سلپ ڈاؤنلوڈ کریں (PDF)",
    ar: "تحميل استمارة التقديم الرسمية (PDF)",
    fa: "دانلود برگ درخواست رسمی (PDF)",
    ps: "د غوښتنلیک رسمي پاڼه ډاونلوډ کړئ (PDF)",
  },
  printSlipBtn: {
    en: "Print Application Sheet",
    ur: "درخواست فارم پرنٹ کریں",
    ar: "طباعة استمارة التقديم",
    fa: "چاپ برگ درخواست",
    ps: "د غوښتنلیک پاڼه چاپ کړئ",
  },
  appSlipHeading: {
    en: "Official Registration & Verification Sheet",
    ur: "آفیشل رجسٹریشن اور تصدیقی رپورٹ",
    ar: "استمارة التسجيل والتحقق الرسمية",
    fa: "برگ رسمی ثبت‌نام و راستی‌آزمایی",
    ps: "د ثبت نام او تایید رسمي پاڼه",
  },
  appSlipSub: {
    en: "Please review and download your complete verification application before final submission.",
    ur: "براہِ کرم حتمی جمع کروانے سے پہلے اپنی مکمل تصدیقی درخواست کا جائزہ لیں اور ڈاؤنلوڈ کریں۔",
    ar: "يرجى مراجعة استمارة التقديم وتحميلها لحفظ سجلك قبل الإرسال النهائي.",
    fa: "لطفاً قبل از ارسال نهایی، برگ درخواست خود را بازبینی و ذخیره کنید.",
    ps: "مهرباني وکړئ د وروستي سپارلو مخکې خپله بشپړه تایید شوې پاڼه وګورئ او ډاونلوډ یې کړئ.",
  },
  declarationText: {
    en: "I hereby confirm that the personal details, contact information, address, and uploaded documents provided in this application are accurate, true, and complete.",
    ur: "میں تصدیق کرتا/کرتی ہوں کہ اس درخواست میں درج کی گئی تمام ذاتی معلومات، رابطہ نمبر، پتہ اور منسلک دستاویزات بالکل درست اور مکمل ہیں۔",
    ar: "أقر وأؤكد بموجب هذا أن جميع البيانات الشخصية وأرقام الاتصال والعنوان والمستندات المرفقة صحيحة ودقيقة وكاملة.",
    fa: "بدینوسیله تأیید می‌نمایم که کلیه اطلاعات شخصی، شماره‌های تماس، آدرس و مدارک بارگذاری‌شده دقیق، صحیح و کامل می‌باشند.",
    ps: "زه دلته تصدیق کوم چې په دې غوښتنلیک کې وړاندې شوي شخصي معلومات، د اړیکې شمېرې، پته او اسناد بشپړ سم او باوري دي.",
  },
};

function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}

// ─── Location Dataset & 5-Language Translations ───────────────────────────────

const LOCATION_TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Countries
  Pakistan: { en: "Pakistan (PK)", ur: "پاکستان (PK)", ar: "باكستان (PK)", fa: "پاکستان (PK)", ps: "پاکستان (PK)" },
  "United Arab Emirates": { en: "United Arab Emirates (UAE)", ur: "متحدہ عرب امارات (UAE)", ar: "الإمارات العربية المتحدة (UAE)", fa: "امارات متحده عربی (UAE)", ps: "متحده عربي امارات (UAE)" },
  Afghanistan: { en: "Afghanistan (AF)", ur: "افغانستان (AF)", ar: "أفغانستان (AF)", fa: "افغانستان (AF)", ps: "افغانستان (AF)" },
  "Saudi Arabia": { en: "Saudi Arabia (KSA)", ur: "سعودی عرب (KSA)", ar: "المملكة العربية السعودية (KSA)", fa: "عربستان سعودی (KSA)", ps: "سعودي عربستان (KSA)" },
  China: { en: "China (CN)", ur: "چین (CN)", ar: "الصين (CN)", fa: "چین (CN)", ps: "چین (CN)" },
  Turkey: { en: "Turkey (TR)", ur: "ترکی (TR)", ar: "تركيا (TR)", fa: "ترکیه (TR)", ps: "ترکیه (TR)" },
  Iran: { en: "Iran (IR)", ur: "ایران (IR)", ar: "إيران (IR)", fa: "ایران (IR)", ps: "ایران (IR)" },
  Oman: { en: "Oman (OM)", ur: "عمان (OM)", ar: "عمان (OM)", fa: "عمان (OM)", ps: "عمان (OM)" },
  "United Kingdom": { en: "United Kingdom (UK)", ur: "برطانیہ (UK)", ar: "المملكة المتحدة (UK)", fa: "انگلستان (UK)", ps: "برطانیه (UK)" },
  "United States": { en: "United States (USA)", ur: "امریکہ (USA)", ar: "الولايات المتحدة (USA)", fa: "ایالات متحده (USA)", ps: "امريکا (USA)" },

  // States
  Sindh: { en: "Sindh", ur: "سندھ", ar: "السند", fa: "سند", ps: "سندھ" },
  Punjab: { en: "Punjab", ur: "پنجاب", ar: "البنجاب", fa: "پنجاب", ps: "پنجاب" },
  "Khyber Pakhtunkhwa": { en: "Khyber Pakhtunkhwa", ur: "خیبر پختونخوا", ar: "خيبر بختونخوا", fa: "خیبر پختونخوا", ps: "خيبر پښتونخوا" },
  Balochistan: { en: "Balochistan", ur: "بلوچستان", ar: "بلوشستان", fa: "بلوچستان", ps: "بلوچستان" },
  "Islamabad Capital Territory": { en: "Islamabad Capital", ur: "اسلام آباد کیپیٹل", ar: "إسلام آباد العاصمة", fa: "اسلام‌آباد پایتخت", ps: "اسلام آباد پلازمېنه" },
  "Azad Jammu & Kashmir": { en: "Azad Kashmir", ur: "آزاد کشمیر", ar: "كشمير الحرة", fa: "کشمیر آزاد", ps: "آزاد کشمیر" },
  Dubai: { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دوبۍ" },
  "Abu Dhabi": { en: "Abu Dhabi", ur: "ابوظہبی", ar: "أبوظبي", fa: "ابوظبی", ps: "ابوظبۍ" },
  Sharjah: { en: "Sharjah", ur: "شارجہ", ar: "الشارقة", fa: "شارجه", ps: "شارجه" },
  Ajman: { en: "Ajman", ur: "عجمان", ar: "عجمان", fa: "عجمان", ps: "عجمان" },
  Kabul: { en: "Kabul", ur: "کابل", ar: "كابل", fa: "کابل", ps: "کابل" },
  Kandahar: { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" },
  Herat: { en: "Herat", ur: "ہرات", ar: "هرات", fa: "هرات", ps: "هرات" },
  Nangarhar: { en: "Nangarhar", ur: "ننگرہار", ar: "ننگرهار", fa: "ننگرهار", ps: "ننګرهار" },
  Balkh: { en: "Balkh", ur: "بلخ", ar: "بلخ", fa: "بلخ", ps: "بلخ" },
  Nimruz: { en: "Nimruz", ur: "نیمروز", ar: "نیمروز", fa: "نیمروز", ps: "نیمروز" },
  Riyadh: { en: "Riyadh Region", ur: "ریاض ریجن", ar: "منطقة الرياض", fa: "منطقه ریاض", ps: "د ریاض سیمه" },
  Makkah: { en: "Makkah / Jeddah", ur: "مکہ / جدہ", ar: "منطقة مكة / جدة", fa: "مکه / جده", ps: "مکه / جده" },
  "Eastern Province": { en: "Eastern Province", ur: "مشرقی صوبہ (دمام)", ar: "المنطقة الشرقية", fa: "استان شرقی", ps: "ختیځ ولایت" },
  Zhejiang: { en: "Zhejiang (Yiwu)", ur: "ژجیانگ (ایوو)", ar: "تشجيانغ (إيوو)", fa: "چجیانگ (ایوو)", ps: "ژجیانګ (ایوو)" },
  Guangdong: { en: "Guangdong (Guangzhou)", ur: "گوانگ ڈونگ (گوانگزو)", ar: "غوانغدونغ", fa: "گوانگ‌دونگ", ps: "ګوانګډونګ" },
  Shanghai: { en: "Shanghai", ur: "شنگھائی", ar: "شنغهاي", fa: "شانگهای", ps: "شانګهای" },
  Istanbul: { en: "Istanbul", ur: "استنبول", ar: "إسطنبول", fa: "استانبول", ps: "استانبول" },
  Mersin: { en: "Mersin", ur: "مرسین", ar: "مرسين", fa: "مرسین", ps: "مرسین" },
  Hormozgan: { en: "Hormozgan", ur: "ہرمزگان", ar: "هرمزغان", fa: "هرمزگان", ps: "هرمزګان" },
  "Sistan & Baluchestan": { en: "Sistan & Baluchestan", ur: "سیستان و بلوچستان", ar: "سيستان وبلوشستان", fa: "سیستان و بلوچستان", ps: "سیستان او بلوچستان" },
  Tehran: { en: "Tehran", ur: "تہران", ar: "طهران", fa: "تهران", ps: "تهران" },
  Muscat: { en: "Muscat", ur: "مسقط", ar: "مسقط", fa: "مسقط", ps: "مسقط" },
  "Al Batinah": { en: "Al Batinah (Sohar)", ur: "الباطنہ (صحار)", ar: "الباطنة (صحار)", fa: "الباطنه (صحار)", ps: "الباطنه (صحار)" },
  England: { en: "England", ur: "انگلستان", ar: "إنجلترا", fa: "انگلستان", ps: "انګلستان" },
  California: { en: "California", ur: "کیلیفورنیا", ar: "كاليفورنيا", fa: "کالیفرنیا", ps: "کلیفورنیا" },
  Texas: { en: "Texas", ur: "ٹیکساس", ar: "تكساس", fa: "تگزاس", ps: "ټیکساس" },
  "New York": { en: "New York", ur: "نیویارک", ar: "نيويورك", fa: "نیویورک", ps: "نیویارک" },

  // Cities
  Karachi: { en: "Karachi (KHI)", ur: "کراچی (KHI)", ar: "كراتشي (KHI)", fa: "کراچی (KHI)", ps: "کراچۍ (KHI)" },
  Hyderabad: { en: "Hyderabad (HYD)", ur: "حیدرآباد (HYD)", ar: "حيدر آباد (HYD)", fa: "حیدرآباد (HYD)", ps: "حیدرآباد (HYD)" },
  Sukkur: { en: "Sukkur (SKR)", ur: "سکھر (SKR)", ar: "سکھر (SKR)", fa: "سکھر (SKR)", ps: "سکھر (SKR)" },
  Larkana: { en: "Larkana (LRK)", ur: "لاڑکانہ (LRK)", ar: "لاركانا (LRK)", fa: "لارکانه (LRK)", ps: "لاړکانه (LRK)" },
  "Mirpur Khas": { en: "Mirpur Khas (MPK)", ur: "میرپور خاص (MPK)", ar: "ميربور خاص (MPK)", fa: "میرپور خاص (MPK)", ps: "میرپور خاص (MPK)" },
  Nawabshah: { en: "Nawabshah (NBS)", ur: "نواب شاہ (NBS)", ar: "نوابشاه (NBS)", fa: "نواب‌شاه (NBS)", ps: "نوابشاه (NBS)" },
  Lahore: { en: "Lahore (LHE)", ur: "لاہور (LHE)", ar: "لاهور (LHE)", fa: "لاهور (LHE)", ps: "لاهور (LHE)" },
  Rawalpindi: { en: "Rawalpindi (RWP)", ur: "راولپنڈی (RWP)", ar: "راولبندي (RWP)", fa: "راولپندی (RWP)", ps: "راولپنډۍ (RWP)" },
  Faisalabad: { en: "Faisalabad (FSD)", ur: "فیصل آباد (FSD)", ar: "فيصل آباد (FSD)", fa: "فیصل‌آباد (FSD)", ps: "فیصل آباد (FSD)" },
  Multan: { en: "Multan (MUX)", ur: "ملتان (MUX)", ar: "ملتان (MUX)", fa: "ملتان (MUX)", ps: "ملتان (MUX)" },
  Gujranwala: { en: "Gujranwala (GUJ)", ur: "گوجرانوالہ (GUJ)", ar: "غوجرانوالا (GUJ)", fa: "گوجرانوالا (GUJ)", ps: "ګوجرانواله (GUJ)" },
  Sialkot: { en: "Sialkot (SKT)", ur: "سیالکوٹ (SKT)", ar: "سيالكوت (SKT)", fa: "سیالکوت (SKT)", ps: "سیالکوټ (SKT)" },
  Bahawalpur: { en: "Bahawalpur (BWP)", ur: "بہاولپور (BWP)", ar: "بهاولبور (BWP)", fa: "بهاولپور (BWP)", ps: "بهاولپور (BWP)" },
  Sargodha: { en: "Sargodha (SGD)", ur: "سرگودھا (SGD)", ar: "سرغودها (SGD)", fa: "سرگودها (SGD)", ps: "سرګودها (SGD)" },
  Sheikhupura: { en: "Sheikhupura (SKP)", ur: "شیخوپورہ (SKP)", ar: "شيخوبورا (SKP)", fa: "شیخوپوره (SKP)", ps: "شیخوپوره (SKP)" },
  "Rahim Yar Khan": { en: "Rahim Yar Khan (RYK)", ur: "رحیم یار خان (RYK)", ar: "رحيم يار خان (RYK)", fa: "رحیم‌یارخان (RYK)", ps: "رحیم یار خان (RYK)" },
  Peshawar: { en: "Peshawar (PEW)", ur: "پشاور (PEW)", ar: "بيشاور (PEW)", fa: "پیشاور (PEW)", ps: "پېښور (PEW)" },
  Mardan: { en: "Mardan (MDN)", ur: "مردان (MDN)", ar: "مردان (MDN)", fa: "مردان (MDN)", ps: "مردان (MDN)" },
  Abbottabad: { en: "Abbottabad (ABT)", ur: "ایبٹ آباد (ABT)", ar: "أبوت آباد (ABT)", fa: "ایبت‌آباد (ABT)", ps: "ایبټ اباد (ABT)" },
  "Swat (Mingora)": { en: "Swat / Mingora (SWT)", ur: "سوات / مینگورہ (SWT)", ar: "سوات (SWT)", fa: "سوات (SWT)", ps: "سوات / مینګوره (SWT)" },
  "Dera Ismail Khan": { en: "D.I. Khan (DIK)", ur: "ڈیرہ اسماعیل خان (DIK)", ar: "ديرا إسماعيل خان (DIK)", fa: "دیره اسماعیل خان (DIK)", ps: "ډیره اسماعیل خان (DIK)" },
  Kohat: { en: "Kohat (KHT)", ur: "کوہاٹ (KHT)", ar: "كوهات (KHT)", fa: "کوهات (KHT)", ps: "کوهاټ (KHT)" },
  Bannu: { en: "Bannu (BNU)", ur: "بنوں (BNU)", ar: "بنو (BNU)", fa: "بنو (BNU)", ps: "بنو (BNU)" },
  Quetta: { en: "Quetta (UET)", ur: "کوئٹہ (UET)", ar: "كويته (UET)", fa: "کویته (UET)", ps: "کوټه (UET)" },
  Gwadar: { en: "Gwadar Port (GWD)", ur: "گوادر پورٹ (GWD)", ar: "ميناء جوادر (GWD)", fa: "بندر گوادر (GWD)", ps: "ګوادر بندر (GWD)" },
  "Chaman (Border)": { en: "Chaman Border (CHM)", ur: "چمن بارڈر (CHM)", ar: "معبر چمن (CHM)", fa: "مرز چمن (CHM)", ps: "چمن پوله (CHM)" },
  Turbat: { en: "Turbat (TBT)", ur: "تربت (TBT)", ar: "تربت (TBT)", fa: "تربت (TBT)", ps: "تربت (TBT)" },
  "Hub Industrial": { en: "Hub Industrial (HUB)", ur: "حب انڈسٹریل (HUB)", ar: "حب الصناعية (HUB)", fa: "شهرک صنعتی حب (HUB)", ps: "حب صنعتي ښارګوټی (HUB)" },
  Sibi: { en: "Sibi (SBI)", ur: "سبی (SBI)", ar: "سيبي (SBI)", fa: "سبی (SBI)", ps: "سبۍ (SBI)" },
  Khuzdar: { en: "Khuzdar (KZD)", ur: "خضدار (KZD)", ar: "خضدار (KZD)", fa: "خضدار (KZD)", ps: "خضدار (KZD)" },
  Islamabad: { en: "Islamabad (ISB)", ur: "اسلام آباد (ISB)", ar: "إسلام آباد (ISB)", fa: "اسلام‌آباد (ISB)", ps: "اسلام آباد (ISB)" },
  Muzaffarabad: { en: "Muzaffarabad (MZD)", ur: "مظفرآباد (MZD)", ar: "مظفر آباد (MZD)", fa: "مظفرآباد (MZD)", ps: "مظفراباد (MZD)" },
  Mirpur: { en: "Mirpur (MPR)", ur: "میرپور (MPR)", ar: "ميربور (MPR)", fa: "میرپور (MPR)", ps: "میرپور (MPR)" },

  // UAE Cities
  "Dubai (Deira / Port Rashid)": { en: "Dubai (Deira / Port Rashid)", ur: "دبئی (دیرہ / پورٹ راشد)", ar: "دبي (ديرة / ميناء راشد)", fa: "دبی (دیره / بندر راشد)", ps: "دوبۍ (دیره / راشد بندر)" },
  "Jebel Ali Free Zone (JAFZA)": { en: "Jebel Ali Free Zone (JAFZA)", ur: "جبل علی فری زون (JAFZA)", ar: "منطقة جبل علي الحرة (JAFZA)", fa: "منطقه آزاد جبل علی (JAFZA)", ps: "جبل علي ازاده سيمه (JAFZA)" },
  "Bur Dubai": { en: "Bur Dubai", ur: "بر دبئی", ar: "بر دبي", fa: "بر دبی", ps: "بر دوبۍ" },
  "Al Quoz Industrial": { en: "Al Quoz Industrial", ur: "القوز انڈسٹریل", ar: "القوز الصناعية", fa: "القوز صنعتی", ps: "القوز صنعتي" },
  "Abu Dhabi City": { en: "Abu Dhabi City (AUH)", ur: "ابوظہبی سٹی (AUH)", ar: "مدينة أبوظبي (AUH)", fa: "شهر ابوظبی (AUH)", ps: "ابوظبۍ ښار (AUH)" },
  "Musaffah Industrial": { en: "Musaffah Industrial (MSF)", ur: "مصفح انڈسٹریل (MSF)", ar: "مصفح الصناعية (MSF)", fa: "مصفح صنعتی (MSF)", ps: "مصفح صنعتي (MSF)" },
  "Khalifa Port (KIZAD)": { en: "Khalifa Port (KIZAD)", ur: "خلیفہ پورٹ (KIZAD)", ar: "ميناء خليفة (KIZAD)", fa: "بندر خلیفه (KIZAD)", ps: "خليفه بندر (KIZAD)" },
  "Al Ain": { en: "Al Ain (AAN)", ur: "العین (AAN)", ar: "العين (AAN)", fa: "العین (AAN)", ps: "العین (AAN)" },
  "Sharjah City": { en: "Sharjah City (SHJ)", ur: "شارجہ سٹی (SHJ)", ar: "مدينة الشارقة (SHJ)", fa: "شهر شارجه (SHJ)", ps: "شارجه ښار (SHJ)" },
  "Hamriyah Free Zone": { en: "Hamriyah Free Zone (HFZ)", ur: "حمریہ فری زون (HFZ)", ar: "منطقة الحمرية الحرة (HFZ)", fa: "منطقه آزاد حمریه (HFZ)", ps: "د حمريه ازاده سيمه (HFZ)" },
  "Khor Fakkan": { en: "Khor Fakkan Port (KLF)", ur: "خورفکاں پورٹ (KLF)", ar: "ميناء خورفكان (KLF)", fa: "بندر خورفکان (KLF)", ps: "خورفکان بندر (KLF)" },
  "Ajman Free Zone / City": { en: "Ajman City / Free Zone", ur: "عجمان سٹی / فری زون", ar: "مدينة عجمان / المنطقة الحرة", fa: "عجمان / منطقه آزاد", ps: "عجمان ښار / ازاده سيمه" },

  // Afghanistan Cities
  "Kabul City": { en: "Kabul City (KBL)", ur: "کابل شہر (KBL)", ar: "مدينة كابل (KBL)", fa: "شهر کابل (KBL)", ps: "کابل ښار (KBL)" },
  "Kandahar City": { en: "Kandahar City (KDH)", ur: "قندھار سٹی (KDH)", ar: "مدينة قندهار (KDH)", fa: "شهر قندهار (KDH)", ps: "کندهار ښار (KDH)" },
  "Spin Boldak Border Crossing": { en: "Spin Boldak Border (SBD)", ur: "سپین بولدک بارڈر (SBD)", ar: "معبر سبين بولداك (SBD)", fa: "مرز اسپین بولدک (SBD)", ps: "سپين بولدک پوله (SBD)" },
  "Herat City": { en: "Herat City (HEA)", ur: "ہرات سٹی (HEA)", ar: "مدينة هرات (HEA)", fa: "شهر هرات (HEA)", ps: "هرات ښار (HEA)" },
  "Islam Qala Border Crossing": { en: "Islam Qala Border (ISQ)", ur: "اسلام قلعہ بارڈر (ISQ)", ar: "معبر إسلام قلعة (ISQ)", fa: "مرز اسلام قلعه (ISQ)", ps: "اسلام کلا پوله (ISQ)" },
  "Torghundi Border": { en: "Torghundi Border (TGH)", ur: "تور غنڈی بارڈر (TGH)", ar: "معبر تورغندي (TGH)", fa: "مرز تورغندی (TGH)", ps: "تورغونډۍ پوله (TGH)" },
  "Jalalabad City": { en: "Jalalabad (JAA)", ur: "جلال آباد (JAA)", ar: "جلال آباد (JAA)", fa: "جلال‌آباد (JAA)", ps: "جلال اباد (JAA)" },
  "Torkham Border Crossing": { en: "Torkham Border (TKM)", ur: "تورخم بارڈر (TKM)", ar: "معبر طورخم (TKM)", fa: "مرز تورخم (TKM)", ps: "تورخم پوله (TKM)" },
  "Mazar-i-Sharif": { en: "Mazar-i-Sharif (MZR)", ur: "مزار شریف (MZR)", ar: "مزار شريف (MZR)", fa: "مزار شریف (MZR)", ps: "مزار شریف (MZR)" },
  "Hairatan Port / Border": { en: "Hairatan Port (HRT)", ur: "حیرتان پورٹ / بارڈر (HRT)", ar: "ميناء حيرتان (HRT)", fa: "بندر حیرتان (HRT)", ps: "حیرتان بندر (HRT)" },
  "Zaranj (Milak Border)": { en: "Zaranj / Milak Border (ZRJ)", ur: "زرنج / میلک بارڈر (ZRJ)", ar: "معبر زرنج (ZRJ)", fa: "مرز زرنج / میلک (ZRJ)", ps: "زرنج / میلک پوله (ZRJ)" },

  // Saudi Cities
  "Riyadh City": { en: "Riyadh City (RUH)", ur: "ریاض سٹی (RUH)", ar: "مدينة الرياض (RUH)", fa: "شهر ریاض (RUH)", ps: "ریاض ښار (RUH)" },
  "Jeddah Islamic Port / City": { en: "Jeddah Islamic Port (JED)", ur: "جدہ اسلامک پورٹ (JED)", ar: "ميناء جدة الإسلامي (JED)", fa: "بندر اسلامی جده (JED)", ps: "د جدې اسلامي بندر (JED)" },
  "King Abdulaziz Port (Dammam)": { en: "King Abdulaziz Port (DMM)", ur: "کنگ عبدالعزیز پورٹ دمام (DMM)", ar: "ميناء الملك عبد العزيز (DMM)", fa: "بندر ملک عبدالعزیز دمام (DMM)", ps: "د ملک عبدالعزیز بندر دمام (DMM)" },

  // China Cities
  "Yiwu (International Trade City)": { en: "Yiwu Trade City (YIW)", ur: "ایوو انٹرنیشنل ٹریڈ سٹی (YIW)", ar: "مدينة إيوو التجارية (YIW)", fa: "شهر تجاری ایوو (YIW)", ps: "د ایوو سوداګریز ښار (YIW)" },
  "Guangzhou (Huangpu / Nansha Port)": { en: "Guangzhou Port (CAN)", ur: "گوانگزو پورٹ (CAN)", ar: "ميناء غوانغدونغ (CAN)", fa: "بندر گوانگژو (CAN)", ps: "ګوانګډونګ بندر (CAN)" },
  "Shanghai Port": { en: "Shanghai Port (SHA)", ur: "شنگھائی پورٹ (SHA)", ar: "ميناء شنغهاي (SHA)", fa: "بندر شانگهای (SHA)", ps: "شانګهای بندر (SHA)" },
};

function locName(key: string, lang: Lang): string {
  return LOCATION_TRANSLATIONS[key]?.[lang] ?? LOCATION_TRANSLATIONS[key]?.en ?? key;
}

interface CityData {
  name: string;
  postalCode: string;
  cityCode: string;
}

interface StateData {
  cities: CityData[];
}

interface CountryData {
  code: string;
  phoneCode: string;
  states: Record<string, StateData>;
}

const LOCATION_HIERARCHY: Record<string, CountryData> = {
  Pakistan: {
    code: "PK",
    phoneCode: "+92",
    states: {
      Sindh: {
        cities: [
          { name: "Karachi", postalCode: "74000", cityCode: "KHI" },
          { name: "Hyderabad", postalCode: "71000", cityCode: "HYD" },
          { name: "Sukkur", postalCode: "65200", cityCode: "SKR" },
          { name: "Larkana", postalCode: "77150", cityCode: "LRK" },
          { name: "Mirpur Khas", postalCode: "69000", cityCode: "MPK" },
          { name: "Nawabshah", postalCode: "67450", cityCode: "NBS" },
        ],
      },
      Punjab: {
        cities: [
          { name: "Lahore", postalCode: "54000", cityCode: "LHE" },
          { name: "Rawalpindi", postalCode: "46000", cityCode: "RWP" },
          { name: "Faisalabad", postalCode: "38000", cityCode: "FSD" },
          { name: "Multan", postalCode: "60000", cityCode: "MUX" },
          { name: "Gujranwala", postalCode: "52250", cityCode: "GUJ" },
          { name: "Sialkot", postalCode: "51310", cityCode: "SKT" },
          { name: "Bahawalpur", postalCode: "63100", cityCode: "BWP" },
          { name: "Sargodha", postalCode: "40100", cityCode: "SGD" },
          { name: "Sheikhupura", postalCode: "39350", cityCode: "SKP" },
          { name: "Rahim Yar Khan", postalCode: "64200", cityCode: "RYK" },
        ],
      },
      "Khyber Pakhtunkhwa": {
        cities: [
          { name: "Peshawar", postalCode: "25000", cityCode: "PEW" },
          { name: "Mardan", postalCode: "23200", cityCode: "MDN" },
          { name: "Abbottabad", postalCode: "22010", cityCode: "ABT" },
          { name: "Swat (Mingora)", postalCode: "19130", cityCode: "SWT" },
          { name: "Dera Ismail Khan", postalCode: "29050", cityCode: "DIK" },
          { name: "Kohat", postalCode: "26000", cityCode: "KHT" },
          { name: "Bannu", postalCode: "28100", cityCode: "BNU" },
        ],
      },
      Balochistan: {
        cities: [
          { name: "Quetta", postalCode: "87300", cityCode: "UET" },
          { name: "Gwadar", postalCode: "91200", cityCode: "GWD" },
          { name: "Chaman (Border)", postalCode: "86000", cityCode: "CHM" },
          { name: "Turbat", postalCode: "92600", cityCode: "TBT" },
          { name: "Hub Industrial", postalCode: "90150", cityCode: "HUB" },
          { name: "Sibi", postalCode: "82000", cityCode: "SBI" },
          { name: "Khuzdar", postalCode: "89100", cityCode: "KZD" },
        ],
      },
      "Islamabad Capital Territory": {
        cities: [{ name: "Islamabad", postalCode: "44000", cityCode: "ISB" }],
      },
      "Azad Jammu & Kashmir": {
        cities: [
          { name: "Muzaffarabad", postalCode: "13100", cityCode: "MZD" },
          { name: "Mirpur", postalCode: "10250", cityCode: "MPR" },
        ],
      },
    },
  },
  "United Arab Emirates": {
    code: "AE",
    phoneCode: "+971",
    states: {
      Dubai: {
        cities: [
          { name: "Dubai (Deira / Port Rashid)", postalCode: "00000", cityCode: "DXB" },
          { name: "Jebel Ali Free Zone (JAFZA)", postalCode: "00000", cityCode: "JAF" },
          { name: "Bur Dubai", postalCode: "00000", cityCode: "BDB" },
          { name: "Al Quoz Industrial", postalCode: "00000", cityCode: "AQZ" },
        ],
      },
      "Abu Dhabi": {
        cities: [
          { name: "Abu Dhabi City", postalCode: "00000", cityCode: "AUH" },
          { name: "Musaffah Industrial", postalCode: "00000", cityCode: "MSF" },
          { name: "Khalifa Port (KIZAD)", postalCode: "00000", cityCode: "KHD" },
          { name: "Al Ain", postalCode: "00000", cityCode: "AAN" },
        ],
      },
      Sharjah: {
        cities: [
          { name: "Sharjah City", postalCode: "00000", cityCode: "SHJ" },
          { name: "Hamriyah Free Zone", postalCode: "00000", cityCode: "HFZ" },
          { name: "Khor Fakkan", postalCode: "00000", cityCode: "KLF" },
        ],
      },
      Ajman: {
        cities: [{ name: "Ajman Free Zone / City", postalCode: "00000", cityCode: "AJM" }],
      },
    },
  },
  Afghanistan: {
    code: "AF",
    phoneCode: "+93",
    states: {
      Kabul: {
        cities: [{ name: "Kabul City", postalCode: "1001", cityCode: "KBL" }],
      },
      Kandahar: {
        cities: [
          { name: "Kandahar City", postalCode: "3801", cityCode: "KDH" },
          { name: "Spin Boldak Border Crossing", postalCode: "3805", cityCode: "SBD" },
        ],
      },
      Herat: {
        cities: [
          { name: "Herat City", postalCode: "3001", cityCode: "HEA" },
          { name: "Islam Qala Border Crossing", postalCode: "3005", cityCode: "ISQ" },
          { name: "Torghundi Border", postalCode: "3006", cityCode: "TGH" },
        ],
      },
      Nangarhar: {
        cities: [
          { name: "Jalalabad City", postalCode: "2601", cityCode: "JAA" },
          { name: "Torkham Border Crossing", postalCode: "2605", cityCode: "TKM" },
        ],
      },
      Balkh: {
        cities: [
          { name: "Mazar-i-Sharif", postalCode: "1701", cityCode: "MZR" },
          { name: "Hairatan Port / Border", postalCode: "1705", cityCode: "HRT" },
        ],
      },
      Nimruz: {
        cities: [{ name: "Zaranj (Milak Border)", postalCode: "8501", cityCode: "ZRJ" }],
      },
    },
  },
  "Saudi Arabia": {
    code: "SA",
    phoneCode: "+966",
    states: {
      Riyadh: {
        cities: [{ name: "Riyadh City", postalCode: "11564", cityCode: "RUH" }],
      },
      Makkah: {
        cities: [{ name: "Jeddah Islamic Port / City", postalCode: "21589", cityCode: "JED" }],
      },
      "Eastern Province": {
        cities: [{ name: "King Abdulaziz Port (Dammam)", postalCode: "31411", cityCode: "DMM" }],
      },
    },
  },
  China: {
    code: "CN",
    phoneCode: "+86",
    states: {
      Zhejiang: {
        cities: [{ name: "Yiwu (International Trade City)", postalCode: "322000", cityCode: "YIW" }],
      },
      Guangdong: {
        cities: [{ name: "Guangzhou (Huangpu / Nansha Port)", postalCode: "510000", cityCode: "CAN" }],
      },
      Shanghai: {
        cities: [{ name: "Shanghai Port", postalCode: "200000", cityCode: "SHA" }],
      },
    },
  },
  Turkey: {
    code: "TR",
    phoneCode: "+90",
    states: {
      Istanbul: {
        cities: [{ name: "Istanbul (Ambarli Port)", postalCode: "34000", cityCode: "IST" }],
      },
      Mersin: {
        cities: [{ name: "Mersin International Port", postalCode: "33000", cityCode: "MER" }],
      },
    },
  },
  Iran: {
    code: "IR",
    phoneCode: "+98",
    states: {
      Hormozgan: {
        cities: [{ name: "Bandar Abbas (Shahid Rajaee)", postalCode: "79177", cityCode: "BND" }],
      },
      "Sistan & Baluchestan": {
        cities: [
          { name: "Chabahar (Beheshti Port)", postalCode: "99717", cityCode: "CHB" },
          { name: "Zahedan / Mirjaveh Border", postalCode: "98135", cityCode: "ZAH" },
        ],
      },
      Tehran: {
        cities: [{ name: "Tehran", postalCode: "11369", cityCode: "THR" }],
      },
    },
  },
  Oman: {
    code: "OM",
    phoneCode: "+968",
    states: {
      Muscat: {
        cities: [{ name: "Muscat / Port Sultan Qaboos", postalCode: "100", cityCode: "MCT" }],
      },
      "Al Batinah": {
        cities: [{ name: "Sohar Port & Freezone", postalCode: "311", cityCode: "SOH" }],
      },
    },
  },
  "United Kingdom": {
    code: "GB",
    phoneCode: "+44",
    states: {
      England: {
        cities: [
          { name: "London", postalCode: "EC1A 1BB", cityCode: "LON" },
          { name: "Felixstowe Port", postalCode: "IP11 3SY", cityCode: "FXT" },
          { name: "Southampton Port", postalCode: "SO14 2AQ", cityCode: "SOU" },
        ],
      },
    },
  },
  "United States": {
    code: "US",
    phoneCode: "+1",
    states: {
      California: {
        cities: [{ name: "Los Angeles / Long Beach Port", postalCode: "90001", cityCode: "LAX" }],
      },
      Texas: {
        cities: [{ name: "Houston Port / City", postalCode: "77001", cityCode: "HOU" }],
      },
      "New York": {
        cities: [{ name: "New York / Port of NY & NJ", postalCode: "10001", cityCode: "NYC" }],
      },
    },
  },
};

// ─── Document & Contract & Contact Types with 5-Language Labels ───────────────

const CONTACT_TYPES: { value: string; labels: Record<Lang, string> }[] = [
  { value: "Mobile", labels: { en: "Mobile Phone", ur: "موبائل فون", ar: "هاتف جوال", fa: "تلفن همراه", ps: "ګرځنده تیلیفون" } },
  { value: "WhatsApp", labels: { en: "WhatsApp Number", ur: "واٹس ایپ نمبر", ar: "رقم الواتساب", fa: "شماره واتس‌اپ", ps: "د واټس‌اپ شمېره" } },
  { value: "Phone", labels: { en: "Phone / Landline", ur: "لینڈ لائن / فون", ar: "هاتف ثابت", fa: "تلفن ثابت", ps: "ثابت تیلیفون" } },
  { value: "Office", labels: { en: "Office Contact", ur: "دفتری فون", ar: "هاتف المكتب", fa: "تلفن دفتر", ps: "د دفتر تیلیفون" } },
  { value: "Emergency", labels: { en: "Emergency Contact", ur: "ہنگامی رابطہ", ar: "جهة اتصال الطوارئ", fa: "تماس اضطراری", ps: "بیړنۍ اړیکه" } },
  { value: "Custom", labels: { en: "Other / Custom", ur: "دیگر رابطہ", ar: "آخر / مخصص", fa: "سایر / سفارشی", ps: "نور / دودیز" } },
];

const DOC_TYPES: { value: string; labels: Record<Lang, string> }[] = [
  {
    value: "CNIC",
    labels: {
      en: "CNIC / National ID Card",
      ur: "شناختی کارڈ / قومی شناختی کارڈ (CNIC)",
      ar: "بطاقة الهوية الوطنية (CNIC)",
      fa: "کارت ملی / کارت شناسایی (CNIC)",
      ps: "ملي پېژندپاڼه / تذکره (CNIC)",
    },
  },
  {
    value: "Passport",
    labels: {
      en: "Passport",
      ur: "پاسپورٹ (Passport)",
      ar: "جواز السفر (Passport)",
      fa: "گذرنامه / پاسپورت",
      ps: "پاسپورت (Passport)",
    },
  },
  {
    value: "Emirates ID",
    labels: {
      en: "Emirates ID (UAE)",
      ur: "ایمریٹس آئی ڈی (UAE)",
      ar: "الهوية الإماراتية (UAE)",
      fa: "کارت شناسایی امارات (UAE)",
      ps: "د اماراتو پیژندپاڼه (UAE)",
    },
  },
  {
    value: "Tazkira",
    labels: {
      en: "Tazkira / National ID (AFG)",
      ur: "افغانستان کا تذکرہ (Tazkira)",
      ar: "تذكرة الهوية الأفغانية (Tazkira)",
      fa: "تذکره تابعیت افغانستان",
      ps: "د افغانستان برېښنايي تذکره",
    },
  },
  {
    value: "Iqama",
    labels: {
      en: "Iqama / Resident Card",
      ur: "اقامہ / رہائشی کارڈ (Iqama)",
      ar: "الإقامة / بطاقة مقيم",
      fa: "کارت اقامت / اقامه",
      ps: "د اقامې کارت",
    },
  },
  {
    value: "Aadhaar Card",
    labels: {
      en: "Aadhaar Card",
      ur: "آدھار کارڈ (Aadhaar)",
      ar: "بطاقة آدهار (Aadhaar)",
      fa: "کارت آدهار",
      ps: "د آدهار کارت",
    },
  },
  {
    value: "Driving License",
    labels: {
      en: "Driving License",
      ur: "ڈرائیونگ لائسنس",
      ar: "رخصة القيادة",
      fa: "گواهینامه رانندگی",
      ps: "د موټر چلولو جواز",
    },
  },
  {
    value: "Trade / Tax License",
    labels: {
      en: "Trade / Tax License",
      ur: "تجارتی / ٹیکس لائسنس",
      ar: "الرخصة التجارية / الضريبية",
      fa: "جواز کسب / مالیاتی",
      ps: "سوداګریز / مالیاتي جواز",
    },
  },
  {
    value: "Custom",
    labels: {
      en: "+ Add Custom Document Type",
      ur: "+ دیگر نئی قسم کا نام درج کریں",
      ar: "+ إضافة نوع مستند مخصص",
      fa: "+ افزودن نوع مدرک جدید",
      ps: "+ نوی ډول سند ورزیات کړئ",
    },
  },
];

const CONTRACT_TYPES: { value: string; labels: Record<Lang, string> }[] = [
  {
    value: "Employment Contract",
    labels: {
      en: "Employment Contract",
      ur: "ملازمت کا معاہدہ",
      ar: "عقد العمل",
      fa: "قرارداد استخدامی",
      ps: "د کار قرارداد",
    },
  },
  {
    value: "Customer Service Agreement",
    labels: {
      en: "Customer Service Agreement",
      ur: "کسٹمر سروس معاہدہ",
      ar: "اتفاقية خدمة العملاء",
      fa: "توافق‌نامه خدمات مشتریان",
      ps: "د پیرودونکي د خدمت تړون",
    },
  },
  {
    value: "Trade & Clearing Terms",
    labels: {
      en: "Trade & Clearing Terms",
      ur: "تجارت و کلیرنگ شرائط",
      ar: "شروط التجارة والتخليص",
      fa: "شرایط تجارت و ترخیص",
      ps: "د سوداګرۍ او تصفیې شرایط",
    },
  },
  {
    value: "NDA & Confidentiality",
    labels: {
      en: "NDA & Confidentiality Agreement",
      ur: "خفیہ رکھنے کا معاہدہ (NDA)",
      ar: "اتفاقية عدم الإفصاح والسرية",
      fa: "قرارداد محرمانگی و عدم افشا",
      ps: "د محرمیت تړون (NDA)",
    },
  },
  {
    value: "Other Attachment",
    labels: {
      en: "Other Attachment / Contract",
      ur: "دیگر معاہدہ / اٹیچمنٹ",
      ar: "مرفق / عقد آخر",
      fa: "سایر ضمائم / قراردادها",
      ps: "نور قرارداد / ضمیمه",
    },
  },
];

interface ContactEntry {
  id: string;
  type: string;
  customLabel?: string;
  value: string;
}

interface DocItem {
  id: string;
  type: string;
  customName?: string;
  number: string;
  issueDate?: string;
  expiryDate?: string;
  dob?: string;
  fileName?: string;
  frontImage?: string;
  backImage?: string;
}

interface ContractItem {
  id: string;
  type: string;
  contractNo: string;
  fileName?: string;
}

/**
 * Client-Side Canvas Image Compression
 * Scales photo to max 1200px and converts to 80% JPEG.
 * Reduces 10MB mobile camera photos to ~120KB-200KB crystal-clear images,
 * eliminating all HTTP 413 and mobile Network Connection Errors!
 */
async function compressImageFile(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ExtFormClient({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("ur");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Link metadata
  const [initialLoading, setInitialLoading] = useState(true);
  const [linkMeta, setLinkMeta] = useState<{
    formType: string;
    createdByName: string | null;
    status: string;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Language Modal
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [contactsList, setContactsList] = useState<ContactEntry[]>([
    { id: "1", type: "Mobile", value: "" },
    { id: "2", type: "WhatsApp", value: "" },
  ]);
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("male");

  // Step 1: Documents
  const [docType, setDocType] = useState("CNIC");
  const [customDocType, setCustomDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDob, setDocDob] = useState("");
  const [docIssueDate, setDocIssueDate] = useState("");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

  // Smart ID Scanning & Extraction State
  const [scanningId, setScanningId] = useState(false);
  const [scanNotification, setScanNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<{ src: string; title: string } | null>(null);

  // Step 1: Contracts
  const [contractType, setContractType] = useState("Customer Service Agreement");
  const [contracts, setContracts] = useState<ContractItem[]>([]);

  // Step 2: Address Info (Cascading Location)
  const [country, setCountry] = useState("Pakistan");
  const [stateProvince, setStateProvince] = useState("Sindh");
  const [city, setCity] = useState("Karachi");
  const [postalCode, setPostalCode] = useState("74000");
  const [fullAddress, setFullAddress] = useState("");

  // Step 4: Photo & Submission
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTimestamp, setSubmittedTimestamp] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // File Input Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  // Load link details on mount
  useEffect(() => {
    async function checkToken() {
      try {
        const res = await fetch(`/api/public/form-link/${token}`);
        const data = await res.json();
        const linkInfo = data?.data || data?.link;
        if (data?.ok && linkInfo) {
          setLinkMeta(linkInfo);
          if (linkInfo.status === "used" || linkInfo.status === "submitted") {
            setPageError("This form link has already been used and submitted.");
          } else if (linkInfo.status === "expired") {
            setPageError("This form link has expired. Please request a new link.");
          } else if (linkInfo.status === "revoked") {
            setPageError("This form link has been revoked by administration.");
          }
        } else {
          setPageError(data?.error || "Invalid or non-existent form link.");
        }
      } catch {
        setPageError("Could not reach verification server. Please try again.");
      } finally {
        setInitialLoading(false);
      }
    }
    checkToken();
  }, [token]);

  // Update State when Country changes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryObj = LOCATION_HIERARCHY[newCountry];
    if (countryObj) {
      const firstState = Object.keys(countryObj.states)[0] || "";
      setStateProvince(firstState);
      if (firstState && countryObj.states[firstState]) {
        const firstCity = countryObj.states[firstState].cities[0];
        if (firstCity) {
          setCity(firstCity.name);
          setPostalCode(firstCity.postalCode);
        }
      }
    }
  };

  // Update City & Postal Code when State changes
  const handleStateChange = (newState: string) => {
    setStateProvince(newState);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && countryObj.states[newState]) {
      const firstCity = countryObj.states[newState].cities[0];
      if (firstCity) {
        setCity(firstCity.name);
        setPostalCode(firstCity.postalCode);
      }
    }
  };

  // Update Postal Code when City changes
  const handleCityChange = (newCityName: string) => {
    setCity(newCityName);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && stateProvince && countryObj.states[stateProvince]) {
      const foundCity = countryObj.states[stateProvince].cities.find((c) => c.name === newCityName);
      if (foundCity) {
        setPostalCode(foundCity.postalCode);
      }
    }
  };

  // Contact list handlers
  const handleAddContact = (type: string = "Mobile") => {
    setContactsList((prev) => [
      ...prev,
      { id: Date.now().toString(), type, value: "" },
    ]);
  };

  const handleRemoveContact = (id: string) => {
    setContactsList((prev) => prev.filter((c) => c.id !== id));
  };

  const handleContactTypeChange = (id: string, newType: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, type: newType } : c))
    );
  };

  const handleContactCustomLabelChange = (id: string, label: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, customLabel: label } : c))
    );
  };

  const handleContactValueChange = (id: string, val: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value: val } : c))
    );
  };

  // Smart OCR Scan & Auto-Fill Handler
  const scanAndAutoFill = async (base64Img: string, typeHint?: string) => {
    setScanningId(true);
    setScanNotification({ message: t("aiScanningBadge", lang), type: "info" });
    try {
      const res = await fetch("/api/public/scan-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Img, docTypeHint: typeHint || docType })
      });
      const data = await res.json();
      if (data?.ok && data?.extracted) {
        const ext = data.extracted;
        if (ext.firstName && !firstName) setFirstName(ext.firstName);
        if (ext.lastName && !lastName) setLastName(ext.lastName);
        if (ext.fatherName && !fatherName) setFatherName(ext.fatherName);
        if (ext.documentNumber) setDocNumber(ext.documentNumber);
        if (ext.dob) setDocDob(ext.dob);
        if (ext.issueDate) setDocIssueDate(ext.issueDate);
        if (ext.expiryDate) setDocExpiryDate(ext.expiryDate);
        if (ext.gender) setGender(ext.gender.toLowerCase() === "female" ? "female" : "male");
        
        if (ext.documentType) {
          const match = DOC_TYPES.find((dt) =>
            dt.value.toLowerCase().includes(ext.documentType.toLowerCase()) ||
            ext.documentType.toLowerCase().includes(dt.value.toLowerCase())
          );
          if (match) setDocType(match.value);
        }

        if (ext.country) {
          const cMatch = Object.keys(LOCATION_HIERARCHY).find(
            (c) => c.toLowerCase() === ext.country.toLowerCase() || ext.country.toLowerCase().includes(c.toLowerCase())
          );
          if (cMatch) handleCountryChange(cMatch);
        }

        const summary = [ext.fullName || `${ext.firstName} ${ext.lastName}`.trim(), ext.documentNumber].filter(Boolean).join(" • ");
        setScanNotification({
          message: summary ? `✓ ${summary} — ${t("aiScanSuccessMsg", lang)}` : t("aiScanSuccessMsg", lang),
          type: "success"
        });
      } else {
        setScanNotification(null);
      }
    } catch {
      setScanNotification(null);
    } finally {
      setScanningId(false);
    }
  };

  // Image Upload Helper with Canvas Compression
  const handleImageUpload = async (file: File | undefined, setter: (val: string | null) => void) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 1400, 0.85);
      setter(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Dedicated Front ID Upload with Auto-Scan Trigger
  const handleFrontUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 1400, 0.85);
      setDocFrontImage(compressed);
      await scanAndAutoFill(compressed, docType);
    } catch {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = reader.result as string;
        setDocFrontImage(res);
        await scanAndAutoFill(res, docType);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Document Handler
  const handleAddDoc = () => {
    if (!docNumber && !docFrontImage) return;
    const finalType = docType === "Custom" && customDocType.trim() ? customDocType.trim() : docType;
    const newDoc: DocItem = {
      id: Date.now().toString(),
      type: finalType,
      customName: docType === "Custom" ? customDocType.trim() : undefined,
      number: docNumber || "N/A",
      dob: docDob || undefined,
      issueDate: docIssueDate || undefined,
      expiryDate: docExpiryDate || undefined,
      frontImage: docFrontImage || undefined,
      backImage: docBackImage || undefined,
      fileName: `${finalType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setDocuments((prev) => [...prev, newDoc]);
    setDocNumber("");
    setDocDob("");
    setDocIssueDate("");
    setDocExpiryDate("");
    setCustomDocType("");
    setDocFrontImage(null);
    setDocBackImage(null);
    setScanNotification(null);
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Add Contract Handler
  const handleAddContract = () => {
    const newCnt: ContractItem = {
      id: Date.now().toString(),
      type: contractType,
      contractNo: `CNT-00${contracts.length + 1}`,
      fileName: `${contractType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setContracts((prev) => [...prev, newCnt]);
  };

  const handleRemoveContract = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const mobContacts = contactsList.filter((c) => c.type === "Mobile" && c.value.trim());
    const waContacts = contactsList.filter((c) => c.type === "WhatsApp" && c.value.trim());
    const primaryMobile = mobContacts.length > 0 ? mobContacts.map((c) => c.value.trim()).join(" / ") : contactsList.find((c) => c.value.trim())?.value.trim() || "";
    const primaryWhatsapp = waContacts.length > 0 ? waContacts.map((c) => c.value.trim()).join(" / ") : primaryMobile;

    const payload = {
      fullName: `${firstName} ${lastName}`.trim() || firstName || lastName,
      firstName,
      lastName,
      fatherName,
      mobile: primaryMobile,
      whatsapp: primaryWhatsapp,
      mobiles: mobContacts.map((c) => c.value.trim()),
      whatsapps: waContacts.map((c) => c.value.trim()),
      contacts: contactsList.filter((c) => c.value.trim()).map((c) => ({
        type: c.type === "Custom" && c.customLabel ? c.customLabel : c.type,
        value: c.value.trim()
      })),
      email,
      gender,
      country,
      stateProvince,
      city,
      postalCode,
      address: fullAddress,
      documents,
      contracts,
      photo: photoPreview,
      originalLanguage: lang,
    };

    try {
      const res = await fetch(`/api/public/form-link/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setSubmitted(true);
        setSubmittedTimestamp(new Date().toLocaleString());
      } else {
        setSubmitError(json.error ?? "Submission failed. Please check inputs.");
      }
    } catch {
      setSubmitError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "rtl";

  const isCnic = docType === "CNIC" || docType === "ID Card";
  const isPassport = docType === "Passport";

  const currentCountryObj = LOCATION_HIERARCHY[country];
  const availableStates = currentCountryObj ? Object.keys(currentCountryObj.states) : [];
  const availableCities =
    currentCountryObj && stateProvince && currentCountryObj.states[stateProvince]
      ? currentCountryObj.states[stateProvince].cities
      : [];

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col items-center justify-start py-6 px-3 sm:px-6"
    >
      {/* Hidden File Inputs for Photo Upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setPhotoPreview)}
      />
      <input
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setPhotoPreview)}
      />

      {/* Hidden File Inputs for Document Front/Back */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={frontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
      />
      <input
        ref={backCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
      />

      {/* Main Container Card */}
      <div className="w-full max-w-[620px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] border border-slate-100 p-5 sm:p-7 space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Shield className="h-5 w-5 fill-indigo-100" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {t("headerTitle", lang)}
              </h1>
              <p className="text-xs font-semibold text-slate-400">
                {t("headerSubtitle", lang)}
              </p>
            </div>
          </div>

          {/* Language Selector Button */}
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-xs cursor-pointer"
            title="Change Language"
          >
            <Globe className="h-4 w-4" />
          </button>
        </div>

        {/* Language Modal */}
        {langModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xs w-full border border-slate-200 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Select Language / زبان منتخب کریں</h3>
                <button
                  type="button"
                  onClick={() => setLangModalOpen(false)}
                  className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {LANGS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setLangModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      lang === item.code
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.nativeName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {initialLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="h-10 w-10 mx-auto border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400">{t("loading", lang)}</p>
          </div>
        )}

        {/* Page Error / Invalid Link */}
        {!initialLoading && pageError && (
          <div className="py-12 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center border border-red-200">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-base font-bold text-slate-800">{t("errorInvalid", lang)}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">{pageError}</p>
          </div>
        )}

        {/* Form Body */}
        {!initialLoading && !pageError && !submitted && (
          <div className="space-y-6">
            
            {/* Step Wizard Progress Header */}
            <div className="relative flex items-center justify-between px-2 pt-2 pb-1">
              <div className="absolute left-6 right-6 top-5 h-0.5 bg-slate-200 -z-0" />
              {[1, 2, 3, 4, 5].map((stepNum) => {
                const isPassed = currentStep > stepNum;
                const isCurrent = currentStep === stepNum;
                const stepLabelKey = `step${stepNum}`;

                return (
                  <div key={stepNum} className="flex flex-col items-center relative z-10 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPassed) setCurrentStep(stepNum as 1 | 2 | 3 | 4 | 5);
                      }}
                      className={`h-9 w-9 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                        isPassed
                          ? "bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50 cursor-pointer"
                          : isCurrent
                          ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-50"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {isPassed ? <Check size={14} className="stroke-[3]" /> : stepNum}
                    </button>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold text-center ${
                        isCurrent
                          ? "text-indigo-600"
                          : isPassed
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {t(stepLabelKey, lang)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 1: PERSONAL INFORMATION & CONTACTS
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Personal Information Box */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-indigo-100/60 text-indigo-600 flex items-center justify-center">
                      <User size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("personalInfoTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("personalInfoSub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Gender / Title Selection (Dropdown at the top before names) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("gender", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute start-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                        >
                          <option value="male">{t("male", lang)}</option>
                          <option value="female">{t("female", lang)}</option>
                          <option value="other">{t("other", lang)}</option>
                        </select>
                      </div>
                    </div>

                    {/* First Name & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("firstName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder={t("firstNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("lastName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder={t("lastNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Father Name & Date of Birth (Compact 2-col Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("fatherName", lang)}
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={fatherName}
                            onChange={(e) => setFatherName(e.target.value)}
                            placeholder={t("fatherNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("dob", lang)}
                        </label>
                        <div className="relative">
                          <Calendar className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="date"
                            value={docDob}
                            onChange={(e) => setDocDob(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contact Numbers with Type Selector & Dynamic Add/Remove */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("mobile", lang)} / {t("contactType", lang)} <span className="text-red-500">*</span>
                        </label>
                      </div>

                      <div className="space-y-2">
                        {contactsList.map((contact) => (
                          <div key={contact.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              {/* Contact Type Selector */}
                              <select
                                value={contact.type}
                                onChange={(e) => handleContactTypeChange(contact.id, e.target.value)}
                                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              >
                                {CONTACT_TYPES.map((ct) => (
                                  <option key={ct.value} value={ct.value}>
                                    {ct.labels[lang] || ct.labels.en}
                                  </option>
                                ))}
                              </select>

                              {/* Number Dialer Input */}
                              <div className="relative flex-1">
                                {contact.type === "WhatsApp" ? (
                                  <MessageSquare className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Phone className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-indigo-500" />
                                )}
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  dir="ltr"
                                  pattern="[0-9+]*"
                                  value={contact.value}
                                  onChange={(e) => handleContactValueChange(contact.id, e.target.value)}
                                  placeholder="+92 300 1234567"
                                  className="w-full bg-white border border-slate-200 rounded-lg ps-8 pe-2 py-1.5 text-xs sm:text-sm font-medium text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                                />
                              </div>

                              {/* Remove Button */}
                              {contactsList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveContact(contact.id)}
                                  className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer shrink-0"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            {/* Custom Label if Custom Type is chosen */}
                            {contact.type === "Custom" && (
                              <input
                                type="text"
                                value={contact.customLabel || ""}
                                onChange={(e) => handleContactCustomLabelChange(contact.id, e.target.value)}
                                placeholder="Enter Custom Label (e.g. Office Assistant / Warehouse)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Quick Add Contact Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddContact("Mobile")}
                          className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addAnotherMobile", lang)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddContact("WhatsApp")}
                          className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addAnotherWhatsapp", lang)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddContact("Phone")}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addContactBtn", lang)}</span>
                        </button>
                      </div>
                    </div>

                    {/* Email (English Typing with Localized Label) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("email", lang)}
                      </label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          inputMode="email"
                          dir="ltr"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("emailPh", lang)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 1 Next Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextDocsBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 2: DOCUMENTS & CONTRACTS (Moved to Step 2)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Documents Box (CNIC, Passport, Emirates ID, Tazkira, Iqama, Aadhaar, Custom) */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles size={16} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                          {t("aiScanTitle", lang)}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {t("aiScanSubtitle", lang)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Scanning Status Pulse */}
                  {scanningId && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2.5 text-indigo-700 text-xs font-bold animate-pulse">
                      <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{t("aiScanningBadge", lang)}</span>
                    </div>
                  )}

                  {/* Scan Result Notification */}
                  {!scanningId && scanNotification && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-emerald-800 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>{scanNotification.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScanNotification(null)}
                        className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 pt-1">
                    {/* Document Type Dropdown (Fully Localized with Custom Type option) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("docType", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {DOC_TYPES.map((dt) => (
                          <option key={dt.value} value={dt.value}>
                            {dt.labels[lang] || dt.labels.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Document Name Input if 'Custom' is selected */}
                    {docType === "Custom" && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-700">
                          {t("customDocName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customDocType}
                          onChange={(e) => setCustomDocType(e.target.value)}
                          placeholder={t("customDocNamePh", lang)}
                          className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    )}

                    {/* Dual Visual Photo Upload Cards: Front Side & Back Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Front Side Card */}
                      <div className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${docFrontImage ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 shadow-2xs'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CreditCard size={13} className="text-indigo-600" />
                            <span className="text-xs font-bold text-slate-800">
                              {isPassport ? t("mainPage", lang) : t("frontSide", lang)}
                            </span>
                          </div>
                          {docFrontImage ? (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={11} /> {t("frontSideReady", lang)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              Required *
                            </span>
                          )}
                        </div>

                        {/* Front Side Thumbnail Preview */}
                        {docFrontImage ? (
                          <div className="space-y-2">
                            <div
                              onClick={() => setPreviewModalImage({ src: docFrontImage, title: isPassport ? "Passport Main Page" : "ID Front Side" })}
                              className="relative h-28 w-full rounded-xl overflow-hidden border border-indigo-100 bg-slate-100 flex items-center justify-center cursor-pointer group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={docFrontImage} alt="Front Preview" className="h-full w-full object-contain" />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                <Eye size={14} />
                                <span>{t("viewFullBtn", lang)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => frontCameraRef.current?.click()}
                                className="flex-1 py-1.5 px-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <Camera size={12} />
                                <span>{t("retakeBtn", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => frontInputRef.current?.click()}
                                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <ImageIcon size={12} />
                                <span>{t("chooseGallery", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocFrontImage(null)}
                                className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-all shrink-0"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => frontCameraRef.current?.click()}
                              className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                            >
                              <Camera size={14} />
                              <span>{t("cameraBtn", lang)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => frontInputRef.current?.click()}
                              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                            >
                              <ImageIcon size={14} />
                              <span>{t("galleryBtn", lang)}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Back Side Card (Hidden for Passport) */}
                      {!isPassport && (
                        <div className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${docBackImage ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 shadow-2xs'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CreditCard size={13} className="text-indigo-600" />
                              <span className="text-xs font-bold text-slate-800">
                                {t("backSide", lang)}
                              </span>
                            </div>
                            {docBackImage ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> {t("backSideReady", lang)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">
                                Optional
                              </span>
                            )}
                          </div>

                          {/* Back Side Thumbnail Preview */}
                          {docBackImage ? (
                            <div className="space-y-2">
                              <div
                                onClick={() => setPreviewModalImage({ src: docBackImage, title: "ID Back Side" })}
                                className="relative h-28 w-full rounded-xl overflow-hidden border border-indigo-100 bg-slate-100 flex items-center justify-center cursor-pointer group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={docBackImage} alt="Back Preview" className="h-full w-full object-contain" />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                  <Eye size={14} />
                                  <span>{t("viewFullBtn", lang)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => backCameraRef.current?.click()}
                                  className="flex-1 py-1.5 px-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                                >
                                  <Camera size={12} />
                                  <span>{t("retakeBtn", lang)}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => backInputRef.current?.click()}
                                  className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                                >
                                  <ImageIcon size={12} />
                                  <span>{t("chooseGallery", lang)}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDocBackImage(null)}
                                  className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-all shrink-0"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => backCameraRef.current?.click()}
                                className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                              >
                                <Camera size={14} />
                                <span>{t("cameraBtn", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => backInputRef.current?.click()}
                                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                              >
                                <ImageIcon size={14} />
                                <span>{t("galleryBtn", lang)}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hidden Native File Inputs */}
                    <input
                      ref={frontCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFrontUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <input
                      ref={frontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFrontUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <input
                      ref={backCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
                      className="hidden"
                    />
                    <input
                      ref={backInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
                      className="hidden"
                    />

                    {/* Document Number */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("docNumber", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder={t("docNumberPh", lang)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Dates: Issue Date, Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          {t("issueDate", lang)}
                        </label>
                        <input
                          type="date"
                          value={docIssueDate}
                          onChange={(e) => setDocIssueDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          {t("expiryDate", lang)}
                        </label>
                        <input
                          type="date"
                          value={docExpiryDate}
                          onChange={(e) => setDocExpiryDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    {/* Add Document to List Button */}
                    <button
                      type="button"
                      onClick={handleAddDoc}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      <span>{t("addDocBtn", lang)}</span>
                    </button>

                    {/* Render Added Documents */}
                    {documents.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-indigo-600" />
                                <div>
                                  <span className="font-bold text-xs text-slate-800">
                                    {DOC_TYPES.find((d) => d.value === doc.type)?.labels[lang] || doc.type}
                                  </span>
                                  <span className="text-[11px] text-slate-600 font-mono ms-2">
                                    #{doc.number}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(doc.id)}
                                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Dates details */}
                            {(doc.dob || doc.issueDate || doc.expiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600 font-mono bg-white/70 p-1.5 rounded-lg border border-slate-100">
                                {doc.dob && <span>DOB: <b>{doc.dob}</b></span>}
                                {doc.issueDate && <span>Issued: <b>{doc.issueDate}</b></span>}
                                {doc.expiryDate && <span>Expires: <b>{doc.expiryDate}</b></span>}
                              </div>
                            )}

                            {/* Image Thumbnails */}
                            {(doc.frontImage || doc.backImage) && (
                              <div className="flex items-center gap-2 pt-1">
                                {doc.frontImage && (
                                  <div className="h-12 w-20 rounded-md border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.frontImage} alt="Front" className="h-full w-full object-cover" />
                                  </div>
                                )}
                                {doc.backImage && (
                                  <div className="h-12 w-20 rounded-md border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.backImage} alt="Back" className="h-full w-full object-cover" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contracts & Attachments Box */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-purple-100/60 text-purple-600 flex items-center justify-center">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("contractsTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("contractsSub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("contractType", lang)}
                      </label>
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {CONTRACT_TYPES.map((ct) => (
                          <option key={ct.value} value={ct.value}>
                            {ct.labels[lang] || ct.labels.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddContract}
                      className="w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      <span>{t("addContractBtn", lang)}</span>
                    </button>

                    {contracts.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {contracts.map((cnt) => (
                          <div
                            key={cnt.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-purple-100 bg-purple-50/40"
                          >
                            <div className="flex items-center gap-2">
                              <FileCheck size={14} className="text-purple-600" />
                              <span className="font-bold text-xs text-slate-800">
                                {CONTRACT_TYPES.find((c) => c.value === cnt.type)?.labels[lang] || cnt.type}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveContract(cnt.id)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextAddressBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 3: ADDRESS INFORMATION (100% 5-Language Localized Cascader)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-100/60 text-emerald-600 flex items-center justify-center">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("step2Title", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("step2Sub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Country Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("country", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {Object.keys(LOCATION_HIERARCHY).map((cKey) => (
                          <option key={cKey} value={cKey}>
                            {locName(cKey, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* State / Province Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("stateProvince", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={stateProvince}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {availableStates.map((stKey) => (
                          <option key={stKey} value={stKey}>
                            {locName(stKey, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City / Port Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("city", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={city}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {availableCities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {locName(c.name, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Postal Code (Auto-filled) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("postalCode", lang)}
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="Postal Code"
                          className="w-full bg-slate-100/70 border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-bold text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    {/* Full Street Address */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("fullAddress", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <textarea
                          rows={3}
                          value={fullAddress}
                          onChange={(e) => setFullAddress(e.target.value)}
                          placeholder={t("fullAddressPh", lang)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextPhotoBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 4: PROFILE PHOTO (Applicant Photo / Selfie)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base">
                      {t("step4Title", lang)}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {t("step4Sub", lang)}
                    </p>
                  </div>

                  {/* Circular Avatar Preview */}
                  <div className="relative mx-auto w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-200 flex items-center justify-center">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="Candidate Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User size={56} className="text-slate-400" />
                    )}
                  </div>

                  {/* Camera / Gallery Upload Buttons */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => photoCameraRef.current?.click()}
                      className="py-2.5 px-5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer transition-all"
                    >
                      <Camera size={15} />
                      <span>{t("cameraBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="py-2.5 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer transition-all"
                    >
                      <ImageIcon size={15} />
                      <span>{t("galleryBtn", lang)}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">{t("photoSizeHint", lang)}</p>
                </div>

                {/* Step 4 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextReviewBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 5: REVIEW YOUR INFORMATION & PRE-SUBMISSION APPLICATION SLIP
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 5 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="text-center space-y-1 pb-1">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-wide">
                    {t("appSlipHeading", lang)}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
                    {t("appSlipSub", lang)}
                  </p>
                </div>

                {/* Pre-Submission Download & Print Action Toolbar */}
                <div className="bg-linear-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
                  <div className="space-y-0.5 text-center sm:text-start">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <ShieldCheck size={16} className="text-emerald-400" />
                      <span className="font-black text-xs sm:text-sm tracking-wide uppercase">
                        {t("receiptTitle", lang)} (Draft / Verified)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-normal">
                      Download or print your complete verified application before submitting.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <Download size={14} />
                      <span>{t("downloadSlipBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-white/20"
                    >
                      <Printer size={14} />
                      <span>{t("printSlipBtn", lang)}</span>
                    </button>
                  </div>
                </div>

                {/* Official Verification Application Summary Sheet */}
                <div className="border-2 border-indigo-200 bg-white rounded-3xl p-5 sm:p-7 space-y-5 shadow-sm print:border-none print:shadow-none print:p-0">
                  {/* Enterprise Official Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        DD
                      </div>
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                          Digital Dock ERP
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                          Public Verification Gateway
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="inline-block text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        APPLICATION DRAFT
                      </span>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Ref: {token.slice(0, 12).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Applicant Profile Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="h-20 w-20 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                      {photoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoPreview} alt="Applicant" className="h-full w-full object-cover" />
                      ) : (
                        <User size={36} className="text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1 text-center sm:text-start flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="font-black text-base sm:text-lg text-slate-900">
                          {firstName} {lastName}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center sm:justify-start gap-1 cursor-pointer print:hidden"
                        >
                          <Edit3 size={11} />
                          <span>{t("editBtn", lang)}</span>
                        </button>
                      </div>
                      {fatherName && (
                        <p className="text-xs text-slate-500 font-medium">
                          {t("fatherName", lang)}: <span className="font-bold text-slate-800">{fatherName}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                          {t(gender, lang)}
                        </span>
                        {docDob && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            DOB: {docDob}
                          </span>
                        )}
                        {email && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            {email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Contact Breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("phoneLabel", lang)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {contactsList.filter(c => c.value.trim()).length} Registered
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contactsList.filter(c => c.value.trim()).map((c) => (
                        <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-700 text-[11px]">
                            {c.type === "Custom" && c.customLabel ? c.customLabel : c.type}
                          </span>
                          <span className="font-mono font-bold text-slate-800">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Identity Documents & Dual Card Previews */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("documentsTitle", lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Edit3 size={11} />
                        <span>{t("editBtn", lang)}</span>
                      </button>
                    </div>

                    {documents.length === 0 && !docFrontImage ? (
                      <p className="text-xs text-slate-400 italic">No identity documents attached.</p>
                    ) : (
                      <div className="space-y-3">
                        {/* If user hasn't pressed '+ Add Document' but has active front image */}
                        {docFrontImage && (
                          <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {DOC_TYPES.find((d) => d.value === docType)?.labels[lang] || (docType === "Custom" ? customDocType : docType)}
                              </span>
                              <span className="text-xs font-mono font-bold text-indigo-700">#{docNumber || "N/A"}</span>
                            </div>
                            {(docDob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {docDob && <span>DOB: <b>{docDob}</b></span>}
                                {docIssueDate && <span>Issued: <b>{docIssueDate}</b></span>}
                                {docExpiryDate && <span>Expires: <b>{docExpiryDate}</b></span>}
                              </div>
                            )}
                            {/* Dual Side-by-Side Photo Previews */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {docFrontImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">Front Side</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docFrontImage, title: "ID Front Side" })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docFrontImage} alt="Front" className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                              {docBackImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">Back Side</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docBackImage, title: "ID Back Side" })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docBackImage} alt="Back" className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stored Documents in List */}
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {DOC_TYPES.find((d) => d.value === doc.type)?.labels[lang] || doc.type}
                              </span>
                              <span className="text-xs font-mono font-bold text-indigo-700">#{doc.number}</span>
                            </div>
                            {(doc.dob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {doc.dob && <span>DOB: <b>{doc.dob}</b></span>}
                                {doc.issueDate && <span>Issued: <b>{doc.issueDate}</b></span>}
                                {doc.expiryDate && <span>Expires: <b>{doc.expiryDate}</b></span>}
                              </div>
                            )}
                            {(doc.frontImage || doc.backImage) && (
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {doc.frontImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.frontImage!, title: "Document Front" })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.frontImage} alt="Front" className="h-full w-full object-contain" />
                                  </div>
                                )}
                                {doc.backImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.backImage!, title: "Document Back" })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.backImage} alt="Back" className="h-full w-full object-contain" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Full Address Hierarchy */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("step2Title", lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Edit3 size={11} />
                        <span>{t("editBtn", lang)}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("country", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(country, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("stateProvince", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(stateProvince, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("city", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(city, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("postalCode", lang)}:</span>
                        <span className="font-mono font-bold text-slate-800">{postalCode || "—"}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-200">
                        <span className="text-slate-400 text-[10px] block">{t("fullAddress", lang)}:</span>
                        <p className="font-medium text-slate-800 mt-0.5">{fullAddress || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Declaration & Signature Box */}
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      {t("declarationText", lang)}
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Generated On</span>
                        <span className="text-[10px] font-mono text-slate-700">
                          {new Date().toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-end">
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Applicant Status</span>
                        <span className="text-[10px] font-bold text-emerald-700 font-mono">
                          Ready for Submission
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Step 5 Navigation & Submit Buttons */}
                <div className="flex items-center gap-3 pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={submitting}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        <span>{t("submitFormBtn", lang)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            STEP 4 COMPLETE: OFFICIAL DIGITAL RECEIPT & CONFIRMATION SCREEN
        ════════════════════════════════════════════════════════════════════════ */}
        {submitted && (
          <div className="space-y-6 animate-in zoom-in-95 duration-400">
            {/* Success Banner */}
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {t("successTitle", lang)}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t("successMsg", lang)}
              </p>
            </div>

            {/* Official Digital Receipt Card */}
            <div className="border-2 border-dashed border-indigo-200 bg-slate-50/70 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <span className="font-black text-xs sm:text-sm text-indigo-950 uppercase tracking-wide">
                    {t("receiptTitle", lang)}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  VERIFIED RECORD
                </span>
              </div>

              {/* Header: Photo + Name */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-14 w-14 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Applicant" className="h-full w-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-black text-sm text-slate-900">
                    {firstName} {lastName}
                  </h4>
                  {fatherName && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t("fatherName", lang)}: <span className="font-bold text-slate-700">{fatherName}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">
                    Token: {token.slice(0, 16)}...
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] block">{t("phoneLabel", lang)}:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {contactsList.filter(c => c.value.trim()).map(c => (
                      <span key={c.id} className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800">
                        <b>{c.type === "Custom" && c.customLabel ? c.customLabel : c.type}:</b> {c.value}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{t("country", lang)} / {t("city", lang)}:</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {locName(country, lang)} / {locName(city, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{t("postalCode", lang)}:</span>
                  <span className="font-bold font-mono text-slate-800 text-[11px]">{postalCode || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] block">{t("fullAddress", lang)}:</span>
                  <span className="font-medium text-slate-800 text-[11px]">{fullAddress || "—"}</span>
                </div>
                {email && (
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] block">{t("email", lang)}:</span>
                    <span className="font-bold font-mono text-slate-800 text-[11px]">{email}</span>
                  </div>
                )}
              </div>

              {/* Attached Documents Thumbnails */}
              {documents.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    {t("documentsTitle", lang)} ({documents.length}):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {documents.map((d) => (
                      <div key={d.id} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-[11px] text-slate-800 block">
                          {DOC_TYPES.find((dt) => dt.value === d.type)?.labels[lang] || d.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block">#{d.number}</span>
                        {(d.dob || d.issueDate || d.expiryDate) && (
                          <div className="text-[9px] text-slate-400 font-mono">
                            {d.dob && <div>DOB: {d.dob}</div>}
                            {d.expiryDate && <div>Exp: {d.expiryDate}</div>}
                          </div>
                        )}
                        {(d.frontImage || d.backImage) && (
                          <div className="flex gap-1 pt-1">
                            {d.frontImage && (
                              <div className="h-9 w-12 rounded border border-slate-200 overflow-hidden bg-slate-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={d.frontImage} alt="Front" className="h-full w-full object-cover" />
                              </div>
                            )}
                            {d.backImage && (
                              <div className="h-9 w-12 rounded border border-slate-200 overflow-hidden bg-slate-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={d.backImage} alt="Back" className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Timestamp */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>{t("submittedOn", lang)}: {submittedTimestamp}</span>
                <span className="font-mono font-bold text-indigo-600">SECURE ERP GATEWAY</span>
              </div>
            </div>

            {/* Print / Download Receipt Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={15} />
                <span>{t("printReceipt", lang)}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Gateway Brand */}
        <div className="text-center pt-2 border-t border-slate-100 print:hidden">
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            Powered by Digital Dock ERP • Secure Public Gateway
          </p>
        </div>

        {/* Full Image Lightbox / Inspection Modal */}
        {previewModalImage && (
          <div
            onClick={() => setPreviewModalImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                  {previewModalImage.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-[70vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewModalImage.src}
                  alt={previewModalImage.title}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
