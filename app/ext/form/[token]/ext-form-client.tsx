"use client";

/**
 * External Form Client — /ext/form/[token]
 *
 * Standalone, high-converting public form page.
 * Matching the exact 4-Step Smart & Responsive UI:
 *   Step 1: Personal Info, Documents (CNIC Front/Back, Passport Pages) & Contracts
 *   Step 2: Address Information (Dynamic Country -> State -> City -> Postal Code Cascader)
 *   Step 3: Review Your Information (4 Structured Cards with Edit jump-backs)
 *   Step 4: Photo & Final Submit (Circular Avatar Preview, Camera & Gallery)
 *
 * 100% Responsive on Mobile (iPhone/Android) and Desktop.
 * 5-Language Parity (English, Urdu, Arabic, Persian, Pashto) with full RTL.
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
  ChevronDown
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
    en: "Smart & Responsive",
    ur: "اسمارٹ اور ریسپانسو",
    ar: "ذكي ومتجاوب",
    fa: "هوشمند و واکنش‌گرا",
    ps: "هوښیار او چټک",
  },
  step1: {
    en: "Personal Info",
    ur: "ذاتی معلومات",
    ar: "المعلومات الشخصية",
    fa: "اطلاعات شخصی",
    ps: "شخصي معلومات",
  },
  step2: {
    en: "Address",
    ur: "پتہ",
    ar: "العنوان",
    fa: "آدرس",
    ps: "پته",
  },
  step3: {
    en: "Review",
    ur: "جائزہ",
    ar: "مراجعة",
    fa: "بازبینی",
    ps: "بیا کتنه",
  },
  step4: {
    en: "Photo & Submit",
    ur: "تصویر اور جمع",
    ar: "الصورة والإرسال",
    fa: "عکس و ارسال",
    ps: "عکس او سپارل",
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
    ur: "والد کا نام درج کریں",
    ar: "أدخل اسم الأب",
    fa: "نام پدر را وارد کنید",
    ps: "د پلار نوم ولیکئ",
  },
  mobile: {
    en: "Mobile / Phone",
    ur: "موبائل / فون",
    ar: "رقم الجوال",
    fa: "شماره تماس",
    ps: "موبایل نمبر",
  },
  mobilePh: {
    en: "Enter mobile number",
    ur: "موبائل نمبر درج کریں",
    ar: "أدخل رقم الجوال",
    fa: "شماره موبایل را وارد کنید",
    ps: "موبایل نمبر ولیکئ",
  },
  whatsapp: {
    en: "WhatsApp Number",
    ur: "واٹس ایپ نمبر",
    ar: "رقم الواتساب",
    fa: "شماره واتساپ",
    ps: "واټساپ نمبر",
  },
  email: {
    en: "Email Address",
    ur: "ای میل ایڈریس",
    ar: "البريد الإلكتروني",
    fa: "آدرس ایمیل",
    ps: "بریښنالیک پته",
  },
  gender: {
    en: "Gender",
    ur: "جنس",
    ar: "الجنس",
    fa: "جنسیت",
    ps: "جنسیت",
  },
  male: { en: "Male", ur: "مرد", ar: "ذكر", fa: "مرد", ps: "نارینه" },
  female: { en: "Female", ur: "خاتون", ar: "أنثى", fa: "زن", ps: "ښځه" },
  documentsTitle: {
    en: "Documents",
    ur: "دستاویزات",
    ar: "المستندات",
    fa: "اسناد و مدارک",
    ps: "اسناد او پاڼې",
  },
  documentsSub: {
    en: "Add your documents one by one.",
    ur: "اپنی دستاویزات ایک ایک کر کے شامل کریں۔",
    ar: "أضف مستنداتك واحداً تلو الآخر.",
    fa: "اسناد خود را یکی یکی اضافه کنید.",
    ps: "خپل اسناد یو یو اضافه کړئ.",
  },
  documentType: {
    en: "Document Type",
    ur: "دستاویز کی قسم",
    ar: "نوع المستند",
    fa: "نوع سند",
    ps: "د سند ډول",
  },
  documentNumber: {
    en: "Document Number",
    ur: "دستاویز نمبر",
    ar: "رقم المستند",
    fa: "شماره سند",
    ps: "د سند شمیره",
  },
  documentNumberPh: {
    en: "Enter document number",
    ur: "دستاویز نمبر درج کریں",
    ar: "أدخل رقم المستند",
    fa: "شماره سند را وارد کنید",
    ps: "د سند شمیره ولیکئ",
  },
  uploadDocument: {
    en: "Upload Document",
    ur: "دستاویز اپ لوڈ کریں",
    ar: "تحميل المستند",
    fa: "بارگذاری سند",
    ps: "سند پورته کړئ",
  },
  frontSide: {
    en: "Front Side",
    ur: "سامنے کا رخ (Front)",
    ar: "الوجه الأمامي",
    fa: "روی کارت / صفحه اول",
    ps: "مخکینۍ برخه",
  },
  backSide: {
    en: "Back Side",
    ur: "پیچھے کا رخ (Back)",
    ar: "الوجه الخلفي",
    fa: "پشت کارت / صفحه دوم",
    ps: "شا برخه",
  },
  passportMainPage: {
    en: "Main Info Page",
    ur: "پہلا معلوماتی صفحہ",
    ar: "صفحة المعلومات الرئيسية",
    fa: "صفحه اصلی گذرنامه",
    ps: "لومړی معلوماتي مخ",
  },
  passportVisaPage: {
    en: "Visa / Back Page",
    ur: "ویزا / دوسرا صفحہ",
    ar: "صفحة التأشيرة / الخلفية",
    fa: "صفحه ویزا / صفحه پشتی",
    ps: "د ویزې / شا مخ",
  },
  uploadHelp: {
    en: "Upload file PDF, JPG, PNG (Max 10MB)",
    ur: "فائل اپ لوڈ کریں PDF, JPG, PNG (زیادہ سے زیادہ 10MB)",
    ar: "تحميل ملف PDF, JPG, PNG (الحد الأقصى 10 ميجابايت)",
    fa: "بارگذاری فایل PDF, JPG, PNG (حداکثر 10 مگابایت)",
    ps: "فایل پورته کړئ PDF, JPG, PNG (تر 10MB پورې)",
  },
  addDocumentBtn: {
    en: "+ Add Document",
    ur: "+ دستاویز شامل کریں",
    ar: "+ إضافة مستند",
    fa: "+ افزودن سند",
    ps: "+ سند اضافه کړئ",
  },
  addedDocuments: {
    en: "Added Documents",
    ur: "شامل شدہ دستاویزات",
    ar: "المستندات المضافة",
    fa: "اسناد اضافه شده",
    ps: "اضافه شوي اسناد",
  },
  contractsTitle: {
    en: "Contracts",
    ur: "معاہدے / کنٹریکٹس",
    ar: "العقود",
    fa: "قراردادها",
    ps: "قراردادونه",
  },
  contractsSub: {
    en: "Add your contracts details.",
    ur: "اپنے معاہدے کی تفصیلات شامل کریں۔",
    ar: "أضف تفاصيل عقودك.",
    fa: "جزئیات قرارداد خود را اضافه کنید.",
    ps: "د خپلو قراردادونو تفصیلات اضافه کړئ.",
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
    ps: "+ قرارداد اضافه کړئ",
  },
  addedContracts: {
    en: "Added Contracts",
    ur: "شامل شدہ معاہدے",
    ar: "العقود المضافة",
    fa: "قراردادهای افزوده شده",
    ps: "اضافه شوي قراردادونه",
  },
  nextAddressBtn: {
    en: "Next: Address Information →",
    ur: "اگلا: پتے کی تفصیلات ←",
    ar: "التالي: تفاصيل العنوان ←",
    fa: "بعدی: اطلاعات آدرس ←",
    ps: "بل: د پتې معلومات ←",
  },
  addressInfoTitle: {
    en: "Address Information",
    ur: "پتے کی تفصیلات",
    ar: "معلومات العنوان",
    fa: "اطلاعات آدرس",
    ps: "د پتې معلومات",
  },
  addressInfoSub: {
    en: "Please select country, province, city, and enter your address.",
    ur: "براہِ کرم ملک، صوبہ اور شہر منتخب کریں اور مکمل پتہ درج کریں۔",
    ar: "يرجى تحديد الدولة والمحافظة والمدينة وإدخال العنوان.",
    fa: "لطفاً کشور، استان، شهر را انتخاب کرده و آدرس را وارد نمایید.",
    ps: "مهرباني وکړئ هیواد، ولایت، او ښار وټاکئ او خپله پته ولیکئ.",
  },
  country: {
    en: "Country",
    ur: "ملک",
    ar: "الدولة / البلد",
    fa: "کشور",
    ps: "هیواد",
  },
  selectCountry: {
    en: "Select country",
    ur: "ملک منتخب کریں",
    ar: "اختر الدولة",
    fa: "کشور را انتخاب کنید",
    ps: "هیواد وټاکئ",
  },
  stateProvince: {
    en: "State / Province",
    ur: "صوبہ / ریاست",
    ar: "الولاية / المقاطعة",
    fa: "استان / ایالت",
    ps: "ولایت / صوبه",
  },
  selectState: {
    en: "Select state / province",
    ur: "صوبہ منتخب کریں",
    ar: "اختر الولاية",
    fa: "استان را انتخاب کنید",
    ps: "ولایت وټاکئ",
  },
  city: {
    en: "City",
    ur: "شہر",
    ar: "المدينة",
    fa: "شهر",
    ps: "ښار",
  },
  selectCity: {
    en: "Select city",
    ur: "شہر منتخب کریں",
    ar: "اختر المدينة",
    fa: "شهر را انتخاب کنید",
    ps: "ښار وټاکئ",
  },
  postalCode: {
    en: "Postal / City Code",
    ur: "پوسٹل / سٹی کوڈ",
    ar: "الرمز البريدي / كود المدينة",
    fa: "کد پستی / کد شهر",
    ps: "پوسټل / ښار کوډ",
  },
  postalCodePh: {
    en: "Postal code (auto-filled)",
    ur: "پوسٹل کوڈ (خودکار درج ہوگا)",
    ar: "الرمز البريدي (تلقائي)",
    fa: "کد پستی (خودکار)",
    ps: "پوسټل کوډ (خپله ډکیږي)",
  },
  fullAddress: {
    en: "Full Address",
    ur: "مکمل پتہ",
    ar: "العنوان الكامل",
    fa: "آدرس کامل",
    ps: "بشپړه پته",
  },
  fullAddressPh: {
    en: "Enter your full address (Street, Building, Flat / Office)",
    ur: "اپنا مکمل پتہ درج کریں (گلی، عمارت، مکان / دفتر)",
    ar: "أدخل عنوانك الكامل (الشارع، المبنى، الشقة)",
    fa: "آدرس کامل خود را وارد کنید (خیابان، پلاک، واحد)",
    ps: "خپله بشپړه پته ولیکئ (کوڅه، ودانۍ، کور / دفتر)",
  },
  backBtn: {
    en: "← Back",
    ur: "← واپس",
    ar: "← رجوع",
    fa: "← بازگشت",
    ps: "← شاته",
  },
  nextReviewBtn: {
    en: "Next: Review →",
    ur: "اگلا: جائزہ لیں ←",
    ar: "التالي: المراجعة ←",
    fa: "بعدی: بازبینی ←",
    ps: "بل: بیاکتنه ←",
  },
  reviewTitle: {
    en: "Review Your Information",
    ur: "اپنی معلومات کا جائزہ لیں",
    ar: "مراجعة معلوماتك",
    fa: "بازبینی اطلاعات شما",
    ps: "خپل معلومات وڅیړئ",
  },
  reviewSub: {
    en: "Please review all information before submitting.",
    ur: "جمع کروانے سے پہلے تمام تفصیلات کی تصدیق کر لیں۔",
    ar: "يرجى مراجعة كافة البيانات قبل الإرسال النهائي.",
    fa: "لطفاً قبل از ارسال، تمام اطلاعات را بررسی کنید.",
    ps: "مهرباني وکړئ د سپارلو دمخه ټول معلومات وڅیړئ.",
  },
  editBtn: {
    en: "Edit",
    ur: "ترمیم کریں",
    ar: "تعديل",
    fa: "ویرایش",
    ps: "سمون",
  },
  reviewCheckAlert: {
    en: "Information looks correct? You can go back and edit any section if needed.",
    ur: "کیا تمام معلومات درست ہیں؟ آپ ضرورت پڑنے پر کسی بھی حصے میں ترمیم کر سکتے ہیں۔",
    ar: "هل تبدو المعلومات صحيحة؟ يمكنك الرجوع وتعديل أي قسم إذا لزم الأمر.",
    fa: "آیا اطلاعات درست به نظر می‌رسد؟ در صورت نیاز می‌توانید بازگردید و ویرایش کنید.",
    ps: "آیا معلومات سم ښکاري؟ تاسو کولی شئ هرې برخې ته بیرته لاړ شئ او سم یې کړئ.",
  },
  nextPhotoSubmitBtn: {
    en: "Next: Photo & Submit →",
    ur: "اگلا: تصویر اور سبمٹ ←",
    ar: "التالي: الصورة والإرسال ←",
    fa: "بعدی: عکس و ارسال ←",
    ps: "بل: عکس او سپارل ←",
  },
  uploadPhotoTitle: {
    en: "Upload Your Photo",
    ur: "اپنی تصویر اپ لوڈ کریں",
    ar: "تحميل صورتك الشخصية",
    fa: "بارگذاری عکس شما",
    ps: "خپل عکس پورته کړئ",
  },
  uploadPhotoSub: {
    en: "Please upload your recent photo.",
    ur: "براہِ کرم اپنی حالیہ تصویر اپ لوڈ کریں۔",
    ar: "يرجى تحميل صورة شخصية حديثة.",
    fa: "لطفاً عکس اخیر خود را بارگذاری کنید.",
    ps: "مهرباني وکړئ خپل تازه عکس پورته کړئ.",
  },
  cameraBtn: {
    en: "Camera",
    ur: "کیمرہ",
    ar: "الكاميرا",
    fa: "دوربین",
    ps: "کیمره",
  },
  galleryBtn: {
    en: "Gallery",
    ur: "گیلری",
    ar: "معرض الصور",
    fa: "گالری",
    ps: "ګالري",
  },
  photoSizeHint: {
    en: "JPG, PNG (Max 5MB)",
    ur: "JPG, PNG (زیادہ سے زیادہ 5MB)",
    ar: "JPG, PNG (الحد الأقصى 5 ميجابايت)",
    fa: "JPG, PNG (حداکثر 5 مگابایت)",
    ps: "JPG, PNG (تر 5MB پورې)",
  },
  submitFormBtn: {
    en: "Submit Form",
    ur: "فارم جمع کروائیں",
    ar: "إرسال النموذج",
    fa: "ارسال فرم",
    ps: "فورم وسپارئ",
  },
  successTitle: {
    en: "Submitted Successfully!",
    ur: "فارم کامیابی سے جمع ہو گیا!",
    ar: "تم الإرسال بنجاح!",
    fa: "با موفقیت ارسال شد!",
    ps: "په بریالیتوب سره وسپارل شو!",
  },
  successMsg: {
    en: "Thank you! Your information has been securely received and recorded in our ERP system.",
    ur: "شکریہ! آپ کی معلومات محفوظ طریقے سے ہمارے ERP سسٹم میں درج ہو چکی ہیں۔",
    ar: "شكراً لك! تم استلام بياناتك بأمان وتسجيلها في نظام ERP الخاص بنا.",
    fa: "با تشکر! اطلاعات شما با موفقیت و به صورت امن در سیستم ERP ثبت شد.",
    ps: "مننه! ستاسو معلومات په خوندي ډول زموږ په ERP سیسټم کې ثبت شول.",
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
};

function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.en ?? key;
}

// ─── Location Hierarchy Dataset ───────────────────────────────────────────────

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
      "Ras Al Khaimah": {
        cities: [{ name: "RAK City / RAKEZ", postalCode: "00000", cityCode: "RKT" }],
      },
      Fujairah: {
        cities: [{ name: "Fujairah Port / City", postalCode: "00000", cityCode: "FJR" }],
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
        cities: [{ name: "Kandahar City / Spin Boldak", postalCode: "3801", cityCode: "KDH" }],
      },
      Herat: {
        cities: [{ name: "Herat / Islam Qala Border", postalCode: "3001", cityCode: "HRT" }],
      },
      Nangarhar: {
        cities: [{ name: "Jalalabad / Torkham Border", postalCode: "2601", cityCode: "JAL" }],
      },
      Balkh: {
        cities: [{ name: "Mazar-i-Sharif / Hairatan", postalCode: "1701", cityCode: "MZR" }],
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
        cities: [
          { name: "Jeddah Islamic Port / City", postalCode: "21442", cityCode: "JED" },
          { name: "Makkah City", postalCode: "24231", cityCode: "MAK" },
        ],
      },
      "Eastern Province": {
        cities: [
          { name: "Dammam Port / City", postalCode: "31411", cityCode: "DMM" },
          { name: "Al Khobar", postalCode: "31952", cityCode: "KHB" },
          { name: "Jubail Industrial", postalCode: "31951", cityCode: "JBL" },
        ],
      },
    },
  },
  China: {
    code: "CN",
    phoneCode: "+86",
    states: {
      Guangdong: {
        cities: [
          { name: "Guangzhou", postalCode: "510000", cityCode: "CAN" },
          { name: "Shenzhen (Yantian / Shekou)", postalCode: "518000", cityCode: "SZX" },
          { name: "Yiwu / Jinhua", postalCode: "322000", cityCode: "YIW" },
        ],
      },
      Shanghai: {
        cities: [{ name: "Shanghai Port / City", postalCode: "200000", cityCode: "SHA" }],
      },
      Zhejiang: {
        cities: [{ name: "Ningbo Port", postalCode: "315000", cityCode: "NGB" }],
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

// ─── Document & Contract Types ────────────────────────────────────────────────

interface DocItem {
  id: string;
  type: string;
  number: string;
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

export function ExtFormClient({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

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
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("male");

  // Step 1: Documents
  const [docType, setDocType] = useState("CNIC");
  const [docNumber, setDocNumber] = useState("");
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

  // Step 1: Contracts
  const [contractType, setContractType] = useState("Employment Contract");
  const [contracts, setContracts] = useState<ContractItem[]>([]);

  // Step 2: Address Info (Cascading Location)
  const [country, setCountry] = useState("Pakistan");
  const [stateProvince, setStateProvince] = useState("Sindh");
  const [city, setCity] = useState("Karachi");
  const [postalCode, setPostalCode] = useState("74000");
  const [fullAddress, setFullAddress] = useState("");

  // Step 4: Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);

  // Document File Input Refs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ─── Fetch Token Metadata ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPageError("Invalid token");
      setInitialLoading(false);
      return;
    }
    fetch(`/api/public/form-link/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data) {
          setLinkMeta(json.data);
        } else {
          setPageError(json.error ?? "Link not found or expired");
        }
      })
      .catch(() => setPageError("Network error while validating link"))
      .finally(() => setInitialLoading(false));
  }, [token]);

  // ─── Cascading Location Handler ─────────────────────────────────────────────
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryObj = LOCATION_HIERARCHY[newCountry];
    if (countryObj) {
      const stateKeys = Object.keys(countryObj.states);
      const firstState = stateKeys[0] || "";
      setStateProvince(firstState);
      const cities = firstState ? countryObj.states[firstState]?.cities || [] : [];
      const firstCity = cities[0];
      setCity(firstCity ? firstCity.name : "");
      setPostalCode(firstCity ? firstCity.postalCode : "");
    } else {
      setStateProvince("");
      setCity("");
      setPostalCode("");
    }
  };

  const handleStateChange = (newState: string) => {
    setStateProvince(newState);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && countryObj.states[newState]) {
      const cities = countryObj.states[newState].cities;
      const firstCity = cities[0];
      setCity(firstCity ? firstCity.name : "");
      setPostalCode(firstCity ? firstCity.postalCode : "");
    } else {
      setCity("");
      setPostalCode("");
    }
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && countryObj.states[stateProvince]) {
      const foundCity = countryObj.states[stateProvince].cities.find((c) => c.name === newCity);
      if (foundCity) {
        setPostalCode(foundCity.postalCode);
      }
    }
  };

  // Helper for image file reading
  const handleFileRead = (file: File | undefined, cb: (dataUrl: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Add Document Handler
  const handleAddDocument = () => {
    if (!docNumber.trim()) return;
    const newDoc: DocItem = {
      id: Date.now().toString(),
      type: docType,
      number: docNumber.trim(),
      frontImage: docFrontImage || undefined,
      backImage: docBackImage || undefined,
      fileName: `${docType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setDocuments((prev) => [...prev, newDoc]);
    setDocNumber("");
    setDocFrontImage(null);
    setDocBackImage(null);
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

    const payload = {
      fullName: `${firstName} ${lastName}`.trim() || firstName || lastName,
      firstName,
      lastName,
      fatherName,
      mobile,
      whatsapp,
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
      } else {
        setSubmitError(json.error ?? "Submission failed. Please check inputs.");
      }
    } catch {
      setSubmitError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "ltr";

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
        onChange={(e) => handleFileRead(e.target.files?.[0], setPhotoPreview)}
      />
      <input
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleFileRead(e.target.files?.[0], setPhotoPreview)}
      />

      {/* Hidden File Inputs for Document Front/Back */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleFileRead(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={frontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileRead(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleFileRead(e.target.files?.[0], setDocBackImage)}
      />
      <input
        ref={backCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileRead(e.target.files?.[0], setDocBackImage)}
      />

      {/* Main Container Card */}
      <div className="w-full max-w-[580px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] border border-slate-100 p-5 sm:p-7 space-y-6">
        
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

        {/* Error / Expired Link */}
        {!initialLoading && pageError && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-6 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
            <h2 className="text-base font-bold text-rose-900">{t("errorInvalid", lang)}</h2>
            <p className="text-xs text-rose-700">{pageError}</p>
          </div>
        )}

        {/* Submission Success */}
        {!initialLoading && submitted && (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-8 text-center space-y-3 animate-in fade-in duration-300">
            <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="text-lg font-black text-emerald-900">{t("successTitle", lang)}</h2>
            <p className="text-xs font-semibold text-emerald-800 leading-relaxed max-w-sm mx-auto">
              {t("successMsg", lang)}
            </p>
          </div>
        )}

        {/* Wizard Form */}
        {!initialLoading && !pageError && !submitted && (
          <>
            {/* 4-Step Stepper Progress Bar */}
            <div className="relative flex items-center justify-between px-2 pt-1 pb-3">
              <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-0.5 bg-slate-200 z-0">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />
              </div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    currentStep > 1
                      ? "bg-emerald-500 text-white shadow-xs"
                      : currentStep === 1
                      ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {currentStep > 1 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "1"}
                </button>
                <span className={`text-[10px] font-bold ${currentStep === 1 ? "text-indigo-600" : "text-slate-500"}`}>
                  {t("step1", lang)}
                </span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    currentStep > 2
                      ? "bg-emerald-500 text-white shadow-xs"
                      : currentStep === 2
                      ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {currentStep > 2 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "2"}
                </button>
                <span className={`text-[10px] font-bold ${currentStep === 2 ? "text-indigo-600" : "text-slate-500"}`}>
                  {t("step2", lang)}
                </span>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    currentStep > 3
                      ? "bg-emerald-500 text-white shadow-xs"
                      : currentStep === 3
                      ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {currentStep > 3 ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : "3"}
                </button>
                <span className={`text-[10px] font-bold ${currentStep === 3 ? "text-indigo-600" : "text-slate-500"}`}>
                  {t("step3", lang)}
                </span>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    currentStep === 4
                      ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  4
                </button>
                <span className={`text-[10px] font-bold ${currentStep === 4 ? "text-indigo-600" : "text-slate-500"}`}>
                  {t("step4", lang)}
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                STEP 1: PERSONAL INFO, CNIC FRONT/BACK & CONTRACTS
               ══════════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 1. Personal Information Card */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {t("personalInfoTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400">{t("personalInfoSub", lang)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("firstName", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder={t("firstNamePh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("lastName", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder={t("lastNamePh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("fatherName", lang)}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={fatherName}
                          onChange={(e) => setFatherName(e.target.value)}
                          placeholder={t("fatherNamePh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {t("mobile", lang)} *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                            <Phone className="h-3.5 w-3.5" />
                          </div>
                          <input
                            type="tel"
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            placeholder={t("mobilePh", lang)}
                            className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {t("whatsapp", lang)}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </div>
                          <input
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder={t("mobilePh", lang)}
                            className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Documents Section (Front & Back for CNIC / Passport Pages) */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {t("documentsTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400">{t("documentsSub", lang)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("documentType", lang)} *
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium cursor-pointer"
                      >
                        <option value="CNIC">CNIC / National ID Card</option>
                        <option value="Passport">Passport</option>
                        <option value="ID Card">ID Card</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Trade License">Trade / Tax License</option>
                        <option value="Other">Other Document</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("documentNumber", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <CreditCard className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder={t("documentNumberPh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium"
                        />
                      </div>
                    </div>

                    {/* Dual Front & Back Upload Boxes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Front Side Upload */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">
                            {isPassport ? t("passportMainPage", lang) : t("frontSide", lang)}
                          </span>
                          {docFrontImage && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> Attached
                            </span>
                          )}
                        </div>

                        {docFrontImage ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 h-24">
                            <img src={docFrontImage} alt="Front Preview" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setDocFrontImage(null)}
                              className="absolute top-1 right-1 h-5 w-5 bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-xs"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => frontCameraRef.current?.click()}
                              className="flex-1 py-2 px-2 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-100 flex items-center justify-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
                            >
                              <Camera size={13} /> {t("cameraBtn", lang)}
                            </button>
                            <button
                              type="button"
                              onClick={() => frontInputRef.current?.click()}
                              className="flex-1 py-2 px-2 bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-100 cursor-pointer"
                            >
                              <UploadCloud size={13} /> {t("galleryBtn", lang)}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Back Side Upload */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">
                            {isPassport ? t("passportVisaPage", lang) : t("backSide", lang)}
                          </span>
                          {docBackImage && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> Attached
                            </span>
                          )}
                        </div>

                        {docBackImage ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 h-24">
                            <img src={docBackImage} alt="Back Preview" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setDocBackImage(null)}
                              className="absolute top-1 right-1 h-5 w-5 bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-xs"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => backCameraRef.current?.click()}
                              className="flex-1 py-2 px-2 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-100 flex items-center justify-center gap-1.5 hover:bg-indigo-100 cursor-pointer"
                            >
                              <Camera size={13} /> {t("cameraBtn", lang)}
                            </button>
                            <button
                              type="button"
                              onClick={() => backInputRef.current?.click()}
                              className="flex-1 py-2 px-2 bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 flex items-center justify-center gap-1.5 hover:bg-slate-100 cursor-pointer"
                            >
                              <UploadCloud size={13} /> {t("galleryBtn", lang)}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDocument}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t("addDocumentBtn", lang)}</span>
                    </button>
                  </div>

                  {/* Added Documents List */}
                  {documents.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {t("addedDocuments", lang)} ({documents.length})
                      </div>
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                  <FileCheck className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-800">{doc.type}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{doc.number}</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(doc.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Previews */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {doc.frontImage && (
                                <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Front</span>
                                  <img src={doc.frontImage} alt="Front" className="h-16 w-full object-cover rounded" />
                                </div>
                              )}
                              {doc.backImage && (
                                <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Back</span>
                                  <img src={doc.backImage} alt="Back" className="h-16 w-full object-cover rounded" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Contracts Section */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {t("contractsTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400">{t("contractsSub", lang)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("contractType", lang)} *
                      </label>
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium cursor-pointer"
                      >
                        <option value="Employment Contract">Employment Contract</option>
                        <option value="Service Agreement">Service Agreement</option>
                        <option value="NDA / Confidentiality">NDA / Confidentiality</option>
                        <option value="Partnership Agreement">Partnership Agreement</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddContract}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t("addContractBtn", lang)}</span>
                    </button>
                  </div>

                  {contracts.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {t("addedContracts", lang)}
                      </div>
                      <div className="space-y-1.5">
                        {contracts.map((cnt) => (
                          <div
                            key={cnt.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Briefcase className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{cnt.type}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Contract No: {cnt.contractNo}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveContract(cnt.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Next Step Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t("nextAddressBtn", lang)}</span>
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                STEP 2: ADDRESS INFORMATION (DYNAMIC CASCADE HIERARCHY)
               ══════════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        {t("addressInfoTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400">{t("addressInfoSub", lang)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* 1. Country Dropdown */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("country", lang)} *
                      </label>
                      <div className="relative">
                        <select
                          value={country}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium appearance-none cursor-pointer"
                        >
                          {Object.keys(LOCATION_HIERARCHY).map((cName) => (
                            <option key={cName} value={cName}>
                              {cName} ({LOCATION_HIERARCHY[cName].code})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* 2. State / Province Dropdown */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("stateProvince", lang)} *
                      </label>
                      <div className="relative">
                        <select
                          value={stateProvince}
                          onChange={(e) => handleStateChange(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium appearance-none cursor-pointer"
                        >
                          {availableStates.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* 3. City Dropdown */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("city", lang)} *
                      </label>
                      <div className="relative">
                        <select
                          value={city}
                          onChange={(e) => handleCityChange(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium appearance-none cursor-pointer"
                        >
                          {availableCities.map((ct) => (
                            <option key={ct.name} value={ct.name}>
                              {ct.name} ({ct.cityCode})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* 4. Postal / City Code (Auto-populated) */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("postalCode", lang)}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <CreditCard className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder={t("postalCodePh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 py-2.5 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* 5. Full Address */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("fullAddress", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute top-2.5 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <textarea
                          rows={3}
                          value={fullAddress}
                          onChange={(e) => setFullAddress(e.target.value)}
                          placeholder={t("fullAddressPh", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("backBtn", lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("nextReviewBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                STEP 3: REVIEW YOUR INFORMATION
               ══════════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="text-center space-y-1 mb-2">
                  <h3 className="text-sm font-black text-slate-900">{t("reviewTitle", lang)}</h3>
                  <p className="text-xs text-slate-500">{t("reviewSub", lang)}</p>
                </div>

                {/* 1. Personal Info Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <User className="h-4 w-4 text-indigo-600" />
                      <span>{t("personalInfoTitle", lang)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t("editBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("firstName", lang)}:</span>
                      <span className="font-bold text-slate-900">{firstName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("lastName", lang)}:</span>
                      <span className="font-bold text-slate-900">{lastName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("fatherName", lang)}:</span>
                      <span className="font-bold text-slate-900">{fatherName || "—"}</span>
                    </div>
                    {mobile && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">{t("mobile", lang)}:</span>
                        <span className="font-bold text-slate-900" dir="ltr">{mobile}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Documents Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span>{t("documentsTitle", lang)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t("editBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-2.5 pt-1">
                    {documents.map((d) => (
                      <div key={d.id} className="border border-slate-100 rounded-xl p-2 bg-slate-50 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-700 font-bold">{d.type}:</span>
                          <span className="font-mono font-bold text-slate-900">{d.number}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {d.frontImage && (
                            <img src={d.frontImage} alt="Front" className="h-14 w-full object-cover rounded border border-slate-200" />
                          )}
                          {d.backImage && (
                            <img src={d.backImage} alt="Back" className="h-14 w-full object-cover rounded border border-slate-200" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Address Information Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                      <span>{t("addressInfoTitle", lang)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t("editBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("country", lang)}:</span>
                      <span className="font-bold text-slate-900">{country}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("stateProvince", lang)}:</span>
                      <span className="font-bold text-slate-900">{stateProvince}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("city", lang)}:</span>
                      <span className="font-bold text-slate-900">{city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">{t("postalCode", lang)}:</span>
                      <span className="font-bold text-slate-900">{postalCode}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="text-slate-500 font-semibold">{t("fullAddress", lang)}:</span>
                      <span className="max-w-[260px] text-end font-medium">{fullAddress || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Correct Alert Box */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="font-medium">{t("reviewCheckAlert", lang)}</p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t("nextPhotoSubmitBtn", lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("backBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                STEP 4: UPLOAD YOUR PHOTO & SUBMIT
               ══════════════════════════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <User className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      {t("uploadPhotoTitle", lang)}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">{t("uploadPhotoSub", lang)}</p>

                  {/* Circular Avatar Preview */}
                  <div className="relative mx-auto h-32 w-32 rounded-full border-4 border-white bg-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Uploaded Photo" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-16 w-16 text-slate-400" />
                    )}
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => photoCameraRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="h-4 w-4 text-indigo-600" />
                      <span>{t("cameraBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ImageIcon className="h-4 w-4 text-indigo-600" />
                      <span>{t("galleryBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {t("photoSizeHint", lang)}
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                    {submitError}
                  </div>
                )}

                {/* Final Submit Button */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleFinalSubmit}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? t("loading", lang) : t("submitFormBtn", lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{t("backBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer Branding */}
        <div className="text-center text-[11px] font-medium text-slate-400 pt-2 border-t border-slate-100">
          Powered by Digital Dock ERP • Secure Public Gateway
        </div>
      </div>
    </div>
  );
}
