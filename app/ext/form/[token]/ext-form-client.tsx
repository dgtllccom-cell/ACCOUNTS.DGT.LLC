"use client";

/**
 * External Form Client — /ext/form/[token]
 *
 * Standalone, high-converting public form page.
 * Matching the exact 4-Step Smart & Responsive UI:
 *   Step 1: Personal Info, Documents & Contracts
 *   Step 2: Address Information
 *   Step 3: Review Your Information
 *   Step 4: Photo & Final Submit
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
  Sparkles
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
    en: "Please enter your address details.",
    ur: "براہِ کرم اپنے پتے کی تفصیلات درج کریں۔",
    ar: "يرجى إدخال تفاصيل عنوانك.",
    fa: "لطفاً اطلاعات آدرس خود را وارد کنید.",
    ps: "مهرباني وکړئ د خپلې پتې تفصیلات ولیکئ.",
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
    en: "Postal / Zip Code",
    ur: "پوسٹل / زپ کوڈ",
    ar: "الرمز البريدي",
    fa: "کد پستی",
    ps: "پوسټل کوډ",
  },
  postalCodePh: {
    en: "Enter postal code",
    ur: "پوسٹل کوڈ درج کریں",
    ar: "أدخل الرمز البريدي",
    fa: "کد پستی را وارد کنید",
    ps: "پوسټل کوډ ولیکئ",
  },
  fullAddress: {
    en: "Full Address",
    ur: "مکمل پتہ",
    ar: "العنوان الكامل",
    fa: "آدرس کامل",
    ps: "بشپړه پته",
  },
  fullAddressPh: {
    en: "Enter your full address",
    ur: "اپنا مکمل پتہ درج کریں",
    ar: "أدخل عنوانك الكامل",
    fa: "آدرس کامل خود را وارد کنید",
    ps: "خپله بشپړه پته ولیکئ",
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

// ─── Document & Contract Types ────────────────────────────────────────────────

interface DocItem {
  id: string;
  type: string;
  number: string;
  fileName?: string;
  fileData?: string;
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
  const [docType, setDocType] = useState("Passport");
  const [docNumber, setDocNumber] = useState("");
  const [documents, setDocuments] = useState<DocItem[]>([
    { id: "1", type: "Passport", number: "AB1234567", fileName: "passport.pdf" },
    { id: "2", type: "CNIC", number: "42101-1234567-1", fileName: "cnic_front.jpg" },
    { id: "3", type: "ID Card", number: "ID987654321", fileName: "id_card.png" },
    { id: "4", type: "Photo", number: "photo.jpg", fileName: "photo.jpg" },
  ]);

  // Step 1: Contracts
  const [contractType, setContractType] = useState("Employment Contract");
  const [contracts, setContracts] = useState<ContractItem[]>([
    { id: "1", type: "Employment Contract", contractNo: "CNT-001", fileName: "employment_contract.pdf" },
  ]);

  // Step 2: Address Info
  const [country, setCountry] = useState("Pakistan");
  const [stateProvince, setStateProvince] = useState("Punjab");
  const [city, setCity] = useState("Lahore");
  const [postalCode, setPostalCode] = useState("54000");
  const [fullAddress, setFullAddress] = useState("123 Main Street, Model Town, Lahore, Punjab, Pakistan");

  // Step 4: Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Add Document Handler
  const handleAddDocument = () => {
    if (!docNumber.trim()) return;
    const newDoc: DocItem = {
      id: Date.now().toString(),
      type: docType,
      number: docNumber.trim(),
      fileName: `${docType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setDocuments((prev) => [...prev, newDoc]);
    setDocNumber("");
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

  // Photo Upload Handler
  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
  const isRtl = dir === "rtl";

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col items-center justify-start py-6 px-3 sm:px-6"
    >
      {/* Hidden File Inputs for Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handlePhotoFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handlePhotoFile}
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
            className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-xs"
            title="Change Language"
          >
            <Globe className="h-4 w-4" />
          </button>
        </div>

        {/* Language Modal */}
        {langModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Language
                </span>
                <button
                  type="button"
                  onClick={() => setLangModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
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
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      lang === item.code
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.nativeName}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {initialLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-500">{t("loading", lang)}</p>
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
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-8 text-center space-y-3">
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
              {/* Connector Line */}
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
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
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
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
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
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
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
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
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

            {/* STEP 1: PERSONAL INFO, DOCUMENTS & CONTRACTS */}
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
                        {t("fatherName", lang)} *
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

                {/* 2. Documents Section */}
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium"
                      >
                        <option value="Passport">Passport</option>
                        <option value="CNIC">CNIC / National ID</option>
                        <option value="ID Card">ID Card</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Visa">Visa</option>
                        <option value="Photo">Photo</option>
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

                    {/* Upload Box */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("uploadDocument", lang)} *
                      </label>
                      <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white p-3 hover:border-indigo-400 transition-all">
                        <div className="flex items-center gap-2.5">
                          <UploadCloud className="h-5 w-5 text-indigo-500" />
                          <div>
                            <div className="text-xs font-bold text-slate-700">Upload file</div>
                            <div className="text-[10px] text-slate-400">{t("uploadHelp", lang)}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDocument}
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t("addDocumentBtn", lang)}</span>
                    </button>
                  </div>

                  {/* Added Documents List */}
                  {documents.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {t("addedDocuments", lang)}
                      </div>
                      <div className="space-y-1.5">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <FileCheck className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{doc.type}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{doc.number}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="Download / View"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(doc.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 transition-all font-medium"
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
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-1.5"
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveContract(cnt.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  <span>{t("nextAddressBtn", lang)}</span>
                </button>
              </div>
            )}

            {/* STEP 2: ADDRESS INFORMATION */}
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
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("country", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <Globe className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder={t("selectCountry", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("stateProvince", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <Layers className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={stateProvince}
                          onChange={(e) => setStateProvince(e.target.value)}
                          placeholder={t("selectState", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {t("city", lang)} *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
                          <Building className="h-3.5 w-3.5" />
                        </div>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder={t("selectCity", lang)}
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      </div>
                    </div>

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
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                        />
                      </div>
                    </div>

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
                          className="w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-medium resize-none"
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
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{t("backBtn", lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{t("nextReviewBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW YOUR INFORMATION */}
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
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t("editBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-1.5 pt-1">
                    {documents.map((d) => (
                      <div key={d.id} className="flex justify-between">
                        <span className="text-slate-500 font-semibold">{d.type}:</span>
                        <span className="font-mono font-bold text-slate-800">{d.number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Contracts Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <Briefcase className="h-4 w-4 text-indigo-600" />
                      <span>{t("contractsTitle", lang)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t("editBtn", lang)}</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-1.5 pt-1">
                    {contracts.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span className="font-bold text-slate-900">{c.type}</span>
                        <span className="font-mono text-slate-500">{c.contractNo}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Address Information Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                      <span>{t("addressInfoTitle", lang)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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
                      <span className="max-w-[260px] text-end font-medium">{fullAddress}</span>
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
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{t("nextPhotoSubmitBtn", lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{t("backBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: UPLOAD YOUR PHOTO & SUBMIT */}
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

                  {/* Circular Avatar Placeholder / Preview */}
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
                      onClick={() => cameraInputRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera className="h-4 w-4 text-indigo-600" />
                      <span>{t("cameraBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
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
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? t("loading", lang) : t("submitFormBtn", lang)}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5"
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
