"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Truck as TruckIcon,
  User,
  UserCheck,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  Eye,
  Download,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  FileCheck,
  AlertCircle,
  Globe,
  Loader2,
  Building2,
  ShieldCheck,
  Fuel,
  Hash,
  Scale
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { autoTranslate5Languages, resolveActiveText, type MultilingualText } from "@/lib/i18n/multilingual-translator";
import { PersonPicker } from "@/features/hr-payroll/components/person-picker";
import { Th } from "@/components/ui/translated-th";

interface DocumentItem {
  id: string;
  type: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  fileName: string;
  fileSize: string;
}

interface ContractItem {
  id: string;
  type: string;
  number: string;
  startDate: string;
  endDate: string;
  terms: string;
  fileName?: string;
}

interface TruckMasterOption {
  id: string;
  category: string;
  code: string;
  name_en: string;
  name_ur?: string;
  name_ar?: string;
  name_fa?: string;
  name_ps?: string;
}

interface TruckFormData {
  // Step 1: Truck Info
  truckType: string;
  registrationNo: string;
  truckNumber: string;
  make: string;
  model: string;
  year: string;
  capacityTons: string;
  chassisNo: string;
  engineNo: string;
  color: string;
  fuelType: string;
  purchaseDate: string;
  remarks: string;
  truckDocuments: DocumentItem[];

  // Step 2: Owner Info
  ownerName: MultilingualText;
  ownerCnicPassport: string;
  ownerMobile: string;
  ownerAddress: string;
  transportCompany: MultilingualText;
  ownerDocuments: DocumentItem[];

  // Step 3: Driver Info
  driverName: MultilingualText;
  licenseNo: string;
  driverMobile: string;
  driverAddress: string;
  driverDocuments: DocumentItem[];

  // Step 4: Contracts & Attachments
  contracts: ContractItem[];
}

const INITIAL_FORM: TruckFormData = {
  truckType: "",
  registrationNo: "",
  truckNumber: "",
  make: "",
  model: "",
  year: "",
  capacityTons: "",
  chassisNo: "",
  engineNo: "",
  color: "",
  fuelType: "",
  purchaseDate: "",
  remarks: "",
  truckDocuments: [],

  ownerName: { en: "", ur: "", ar: "", fa: "", ps: "" },
  ownerCnicPassport: "",
  ownerMobile: "",
  ownerAddress: "",
  transportCompany: { en: "", ur: "", ar: "", fa: "", ps: "" },
  ownerDocuments: [],

  driverName: { en: "", ur: "", ar: "", fa: "", ps: "" },
  licenseNo: "",
  driverMobile: "",
  driverAddress: "",
  driverDocuments: [],

  contracts: []
};

const UI_DICT: Record<string, Record<SupportedLanguage, string>> = {
  title: {
    en: "TRUCK NEW RECREATION",
    ur: "ٹرک کی نئی رجسٹریشن",
    ar: "تسجيل شاحنة جديدة",
    fa: "ثبت جدید کامیون",
    ps: "د نوي ټراک ثبتول"
  },
  subtitle: {
    en: "Create complete truck record with all details and documents",
    ur: "تمام تفصیلات اور دستاویزات کے ساتھ مکمل ٹرک ریکارڈ بنائیں",
    ar: "إنشاء سجل شاحنة كامل مع كافة التفاصيل والمستندات",
    fa: "ایجاد پرونده کامل کامیون با تمام جزئیات و مدارک",
    ps: "د ټولو جزییاتو او اسنادو سره بشپړ ټراک ریکارډ جوړ کړئ"
  },
  step1: {
    en: "Truck Information",
    ur: "ٹرک کی معلومات",
    ar: "معلومات الشاحنة",
    fa: "اطلاعات کامیون",
    ps: "د ټراک معلومات"
  },
  step1Sub: {
    en: "Enter truck and registration details",
    ur: "ٹرک اور رجسٹریشن کی تفصیلات درج کریں",
    ar: "أدخل تفاصيل الشاحنة والتسجيل",
    fa: "جزئیات کامیون و ثبت نام را وارد کنید",
    ps: "د ټراک او راجستر جزییات داخل کړئ"
  },
  step2: {
    en: "Owner Information",
    ur: "مالک کی معلومات",
    ar: "معلومات المالك",
    fa: "اطلاعات مالک",
    ps: "د مالک معلومات"
  },
  step2Sub: {
    en: "Enter owner details",
    ur: "مالک کی تفصیلات درج کریں",
    ar: "أدخل تفاصيل المالك",
    fa: "جزئیات مالک را وارد کنید",
    ps: "د مالک جزییات داخل کړئ"
  },
  step3: {
    en: "Driver Information",
    ur: "ڈرائیور کی معلومات",
    ar: "معلومات السائق",
    fa: "اطلاعات راننده",
    ps: "د ډرایور معلومات"
  },
  step3Sub: {
    en: "Enter driver details",
    ur: "ڈرائیور کی تفصیلات درج کریں",
    ar: "أدخل تفاصيل السائق",
    fa: "جزئیات راننده را وارد کنید",
    ps: "د ډرایور جزییات داخل کړئ"
  },
  step4: {
    en: "Contract & Documents",
    ur: "معاہدہ اور دستاویزات",
    ar: "العقد والمستندات",
    fa: "قرارداد و مدارک",
    ps: "تړون او اسناد"
  },
  step4Sub: {
    en: "Contracts and attachments",
    ur: "معاہدے اور منسلک فائلیں",
    ar: "العقود والمرفقات",
    fa: "قراردادها و پیوست‌ها",
    ps: "تړونونه او نښلول شوي فايلونه"
  },
  step5: {
    en: "Review & Confirm",
    ur: "جائزہ اور تصدیق",
    ar: "المراجعة والتأكيد",
    fa: "بررسی و تایید",
    ps: "کتنه او تایید"
  },
  step5Sub: {
    en: "Verify and submit",
    ur: "تصدیق کریں اور جمع کرائیں",
    ar: "التحقق والتقديم",
    fa: "بررسی و ارسال",
    ps: "تایید او استول"
  },
  liveReportTitle: {
    en: "LIVE SUMMARY REPORT",
    ur: "لائیو خلاصہ رپورٹ",
    ar: "تقرير الملخص المباشر",
    fa: "گزارش خلاصه زنده",
    ps: "د ژوندی لنډیز راپور"
  },
  liveReportSub: {
    en: "Real-time summary of entered information",
    ur: "درج شدہ معلومات کا ریئل ٹائم خلاصہ",
    ar: "ملخص مباشر للمعلومات المدخلة",
    fa: "خلاصه لحظه‌ای اطلاعات وارد شده",
    ps: "د داخل شوو معلوماتو د پام وړ لنډیز"
  },
  cancel: { en: "Cancel", ur: "منسوخ", ar: "إلغاء", fa: "انصراف", ps: "کینسل" },
  saveDraft: { en: "Save Draft", ur: "ڈرافٹ محفوظ کریں", ar: "حفظ مسودة", fa: "ذخیره پیش‌نویس", ps: "مسوده خوندي کړئ" },
  nextStep: { en: "Next Step →", ur: "اگلا مرحلہ ←", ar: "الخطوة التالية ←", fa: "مرحله بعدی ←", ps: "بل ګام →" },
  prevStep: { en: "← Previous", ur: "← پچھلا", ar: "← السابق", fa: "← قبلی", ps: "← پخوانی" },
  submit: { en: "Submit Truck Record", ur: "ٹرک ریکارڈ جمع کرائیں", ar: "تقديم سجل الشاحنة", fa: "ثبت نهایی پرونده کامیون", ps: "د ټراک ریکارډ وسپارئ" },
  truckType: { en: "Truck Type *", ur: "ٹرک کی قسم *", ar: "نوع الشاحنة *", fa: "نوع کامیون *", ps: "د ټراک ډول *" },
  regNo: { en: "Registration No *", ur: "رجسٹریشن نمبر *", ar: "رقم التسجيل *", fa: "شماره ثبت *", ps: "د راجستر شمیره *" },
  truckNo: { en: "Truck Number *", ur: "ٹرک نمبر *", ar: "رقم الشاحنة *", fa: "شماره کامیون *", ps: "د ټراک شمیره *" },
  make: { en: "Make *", ur: "کمپنی / میک *", ar: "الماركة *", fa: "سازنده *", ps: "جوړونکی *" },
  model: { en: "Model *", ur: "ماڈل *", ar: "الموديل *", fa: "مدل *", ps: "ماډل *" },
  year: { en: "Year *", ur: "سال *", ar: "السنة *", fa: "سال ساخت *", ps: "کال *" },
  capacity: { en: "Capacity (Tons) *", ur: "گنجائش (ٹن) *", ar: "الحمولة (طن) *", fa: "ظرفیت (تن) *", ps: "ظرفیت (ټنه) *" },
  chassisNo: { en: "Chassis No *", ur: "چیسس نمبر *", ar: "رقم الشاسي *", fa: "شماره شاسی *", ps: "د شاسۍ شمیره *" },
  engineNo: { en: "Engine No", ur: "انجن نمبر", ar: "رقم المحرك", fa: "شماره موتور", ps: "د انجن شمیره" },
  color: { en: "Color", ur: "رنگ", ar: "اللون", fa: "رنگ", ps: "رنګ" },
  fuelType: { en: "Fuel Type", ur: "ایندھن کی قسم", ar: "نوع الوقود", fa: "نوع سوخت", ps: "د تیلو ډول" },
  purchaseDate: { en: "Purchase Date", ur: "خریداری کی تاریخ", ar: "تاريخ الشراء", fa: "تاریخ خرید", ps: "د اخیستلو نیټه" },
  addDocument: { en: "+ Add Document", ur: "+ دستاویز شامل کریں", ar: "+ إضافة مستند", fa: "+ افزودن مدرک", ps: "+ سند اضافه کړئ" },
  remarks: { en: "Remarks (Optional)", ur: "ریمارکس (اختیاری)", ar: "ملاحظات (اختياري)", fa: "توضیحات (اختیاری)", ps: "نوټونه (اختیاري)" }
};

export function TruckRecreationWizard({ lang: initialLang = "en" }: { lang?: SupportedLanguage }) {
  const [activeLang, setActiveLang] = useState<SupportedLanguage>(initialLang);
  const dir = getLanguageDirection(activeLang);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [formData, setFormData] = useState<TruckFormData>(INITIAL_FORM);

  // Master Dropdown Options from DB / Fallback
  const [optionsMap, setOptionsMap] = useState<Record<string, TruckMasterOption[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Document Draft Form
  const [newDocType, setNewDocType] = useState("reg_book");
  const [newDocNum, setNewDocNum] = useState("");
  const [newDocIssue, setNewDocIssue] = useState("");
  const [newDocExpiry, setNewDocExpiry] = useState("");

  // New Contract Draft Form
  const [newContractType, setNewContractType] = useState("long_term");
  const [newContractNum, setNewContractNum] = useState("");
  const [newContractStart, setNewContractStart] = useState("");
  const [newContractEnd, setNewContractEnd] = useState("");
  const [newContractTerms, setNewContractTerms] = useState("");

  // Person/Customer Master File Pickers
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");

  useEffect(() => {
    if (!selectedOwnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(selectedOwnerId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.customer) {
          const c = res.customer;
          const nameEn = c.customer_name || "";
          const updated5 = autoTranslate5Languages(nameEn, "en", formData.ownerName);
          const compEn = c.company_name || "";
          const comp5 = autoTranslate5Languages(compEn, "en", formData.transportCompany);
          setFormData((prev) => ({
            ...prev,
            ownerName: updated5,
            ownerCnicPassport: c.cnic || c.passport || prev.ownerCnicPassport,
            ownerMobile: c.mobile || c.whatsapp || prev.ownerMobile,
            ownerAddress: c.address || prev.ownerAddress,
            transportCompany: comp5
          }));
        }
      } catch (err) {
        console.error("Failed to load customer details", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOwnerId]);

  useEffect(() => {
    if (!selectedDriverId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/erp/customers/${encodeURIComponent(selectedDriverId)}`).then((r) => r.json());
        if (cancelled) return;
        if (res?.customer) {
          const c = res.customer;
          const nameEn = c.customer_name || "";
          const updated5 = autoTranslate5Languages(nameEn, "en", formData.driverName);
          setFormData((prev) => ({
            ...prev,
            driverName: updated5,
            licenseNo: c.license_no || c.cnic || prev.licenseNo,
            driverMobile: c.mobile || c.whatsapp || prev.driverMobile,
            driverAddress: c.address || prev.driverAddress
          }));
        }
      } catch (err) {
        console.error("Failed to load driver details", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDriverId]);

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const res = await fetch("/api/erp/master-data/truck-options");
        const json = await res.json();
        const grouped: Record<string, TruckMasterOption[]> = {};
        (json.options || []).forEach((opt: TruckMasterOption) => {
          if (!grouped[opt.category]) grouped[opt.category] = [];
          grouped[opt.category].push(opt);
        });
        setOptionsMap(grouped);
      } catch (err) {
        console.error("Failed to load options", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const tUI = (key: string) => UI_DICT[key]?.[activeLang] || UI_DICT[key]?.en || key;

  // Auto 5-language field updater helper
  const handleAutoTranslateField = (
    fieldKey: "ownerName" | "transportCompany" | "driverName",
    value: string
  ) => {
    const updated5 = autoTranslate5Languages(value, activeLang, formData[fieldKey]);
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: updated5
    }));
  };

  const handleAddDocument = (target: "truckDocuments" | "ownerDocuments" | "driverDocuments") => {
    if (!newDocNum) return;
    const docItem: DocumentItem = {
      id: `doc-${Date.now()}`,
      type: newDocType,
      number: newDocNum,
      issueDate: newDocIssue || new Date().toISOString().slice(0, 10),
      expiryDate: newDocExpiry || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      fileName: `${newDocType}_${newDocNum}.pdf`,
      fileSize: "210 KB"
    };
    setFormData((prev) => ({
      ...prev,
      [target]: [...prev[target], docItem]
    }));
    setNewDocNum("");
  };

  const handleRemoveDocument = (target: "truckDocuments" | "ownerDocuments" | "driverDocuments", id: string) => {
    setFormData((prev) => ({
      ...prev,
      [target]: prev[target].filter((d) => d.id !== id)
    }));
  };

  const handleAddContract = () => {
    if (!newContractNum) return;
    const item: ContractItem = {
      id: `contract-${Date.now()}`,
      type: newContractType,
      number: newContractNum,
      startDate: newContractStart || new Date().toISOString().slice(0, 10),
      endDate: newContractEnd || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      terms: newContractTerms || "Standard Freight Delivery Terms"
    };
    setFormData((prev) => ({
      ...prev,
      contracts: [...prev.contracts, item]
    }));
    setNewContractNum("");
    setNewContractTerms("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        truck_number: formData.truckNumber || `TK-${Math.floor(10000 + Math.random() * 90000)}`,
        registration_number: formData.registrationNo,
        truck_type: formData.truckType,
        make: formData.make,
        model: formData.model,
        manufacturing_year: parseInt(formData.year || "2024"),
        capacity: formData.capacityTons,
        chassis_number: formData.chassisNo,
        engine_number: formData.engineNo,
        color: formData.color,
        fuel_type: formData.fuelType,
        purchase_date: formData.purchaseDate || null,

        owner_person_id: selectedOwnerId || null,
        owner_name: formData.ownerName.en || formData.ownerName.ur || "Owner Name",
        owner_name_en: formData.ownerName.en,
        owner_name_ur: formData.ownerName.ur,
        owner_name_ar: formData.ownerName.ar,
        owner_name_fa: formData.ownerName.fa,
        owner_name_ps: formData.ownerName.ps,
        owner_cnic_passport: formData.ownerCnicPassport,
        owner_mobile: formData.ownerMobile,
        owner_address: formData.ownerAddress,
        transport_company: formData.transportCompany.en || formData.transportCompany.ur,

        driver_person_id: selectedDriverId || null,
        driver_name: formData.driverName.en || formData.driverName.ur || "Driver Name",
        driver_name_en: formData.driverName.en,
        driver_name_ur: formData.driverName.ur,
        driver_name_ar: formData.driverName.ar,
        driver_name_fa: formData.driverName.fa,
        driver_name_ps: formData.driverName.ps,
        driver_license_no: formData.licenseNo,
        driver_mobile: formData.driverMobile,
        driver_address: formData.driverAddress,

        notes: formData.remarks,
        status: "active"
      };

      const res = await fetch("/api/erp/master-data/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save truck record");

      setSuccessMessage("Truck Record Successfully Created in 5 Languages!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: any) {
      alert(e.message || "Error saving record");
    } finally {
      setSaving(false);
    }
  };

  // Step Completion Checks for Live Summary
  const isStep1Done = Boolean(formData.truckNumber || formData.registrationNo || formData.truckType);
  const isStep2Done = Boolean(formData.ownerName.en || formData.ownerName.ur || formData.ownerMobile);
  const isStep3Done = Boolean(formData.driverName.en || formData.driverName.ur || formData.licenseNo);
  const isStep4Done = formData.contracts.length > 0 || formData.truckDocuments.length > 0;

  const totalCompleted = [isStep1Done, isStep2Done, isStep3Done, isStep4Done].filter(Boolean).length;
  const progressPercent = Math.min(100, Math.max(20, totalCompleted * 25));

  return (
    <div dir={dir} className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 dark:bg-blue-500">
            <TruckIcon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {tUI("title")}
              </h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                5-Language Active
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {tUI("subtitle")}
            </p>
          </div>
        </div>

        {/* 5-Language Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-950">
            {[
              { code: "en", label: "US English" },
              { code: "ur", label: "اردو PK" },
              { code: "ps", label: "پښتو AF" },
              { code: "ar", label: "العربية AE" },
              { code: "fa", label: "فارسی IR" }
            ].map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setActiveLang(l.code as SupportedLanguage)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  activeLang === l.code
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" /> {tUI("cancel")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
            >
              <Save className="h-4 w-4" /> {tUI("saveDraft")}
            </button>
            {activeStep < 5 ? (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-95"
              >
                {tUI("nextStep")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tUI("submit")}
              </button>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          ✓ {successMessage}
        </div>
      )}

      {/* 5-Wizard Steps Progress Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {[
          { id: 1, title: tUI("step1"), sub: tUI("step1Sub"), icon: TruckIcon },
          { id: 2, title: tUI("step2"), sub: tUI("step2Sub"), icon: User },
          { id: 3, title: tUI("step3"), sub: tUI("step3Sub"), icon: UserCheck },
          { id: 4, title: tUI("step4"), sub: tUI("step4Sub"), icon: FileText },
          { id: 5, title: tUI("step5"), sub: tUI("step5Sub"), icon: CheckCircle2 }
        ].map((s) => {
          const IconComponent = s.icon;
          const isActive = activeStep === s.id;
          const isPassed = activeStep > s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition-all ${
                isActive
                  ? "border-blue-600 bg-blue-50/70 shadow-md dark:border-blue-500 dark:bg-blue-950/40"
                  : isPassed
                  ? "border-emerald-200 bg-white dark:border-emerald-950 dark:bg-slate-900"
                  : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 opacity-75"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : isPassed
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isPassed ? <CheckCircle2 className="h-5 w-5" /> : s.id}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-black truncate ${isActive ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-white"}`}>
                  {s.title}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate dark:text-slate-400">
                  {s.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid (Form Left, Live Summary Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form Column */}
        <div className="space-y-6 lg:col-span-8">
          {/* STEP 1: TRUCK INFORMATION */}
          {activeStep === 1 && (
            <div className="space-y-6">
              {/* Step Banner */}
              <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-center gap-3">
                  <TruckIcon className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wide">
                      {tUI("step1")}
                    </h2>
                    <p className="text-xs font-medium text-blue-100">{tUI("step1Sub")}</p>
                  </div>
                </div>
              </div>

              {/* Truck Details Form Card */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                  <FileText className="h-5 w-5 text-blue-600" /> Truck Details
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {/* Truck Type Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("truckType")}
                    </label>
                    <select
                      value={formData.truckType}
                      onChange={(e) => setFormData({ ...formData, truckType: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">Select truck type</option>
                      {(optionsMap["truck_type"] || []).map((o) => (
                        <option key={o.code} value={o.code}>
                          {resolveActiveText(o as any, activeLang, o.name_en)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Registration No */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("regNo")}
                    </label>
                    <input
                      type="text"
                      value={formData.registrationNo}
                      onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                      placeholder="Enter registration no"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Truck Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("truckNo")}
                    </label>
                    <input
                      type="text"
                      value={formData.truckNumber}
                      onChange={(e) => setFormData({ ...formData, truckNumber: e.target.value })}
                      placeholder="Enter truck number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Make */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("make")}
                    </label>
                    <select
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">Select make</option>
                      {(optionsMap["make"] || []).map((m) => (
                        <option key={m.code} value={m.code}>
                          {resolveActiveText(m as any, activeLang, m.name_en)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("model")}
                    </label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Enter model"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Year */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("year")}
                    </label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Capacity */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("capacity")}
                    </label>
                    <input
                      type="text"
                      value={formData.capacityTons}
                      onChange={(e) => setFormData({ ...formData, capacityTons: e.target.value })}
                      placeholder="Enter capacity"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Chassis No */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("chassisNo")}
                    </label>
                    <input
                      type="text"
                      value={formData.chassisNo}
                      onChange={(e) => setFormData({ ...formData, chassisNo: e.target.value })}
                      placeholder="Enter chassis number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Engine No */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("engineNo")}
                    </label>
                    <input
                      type="text"
                      value={formData.engineNo}
                      onChange={(e) => setFormData({ ...formData, engineNo: e.target.value })}
                      placeholder="Enter engine number"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("color")}
                    </label>
                    <select
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">Select color</option>
                      <option value="White">White / سفید</option>
                      <option value="Black">Black / سیاہ</option>
                      <option value="Blue">Blue / نیلا</option>
                      <option value="Red">Red / سرخ</option>
                      <option value="Yellow">Yellow / پیلا</option>
                      <option value="Silver">Silver / سلور</option>
                    </select>
                  </div>

                  {/* Fuel Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("fuelType")}
                    </label>
                    <select
                      value={formData.fuelType}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">Select fuel type</option>
                      {(optionsMap["fuel_type"] || []).map((f) => (
                        <option key={f.code} value={f.code}>
                          {resolveActiveText(f as any, activeLang, f.name_en)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tUI("purchaseDate")}
                    </label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>

              {/* Truck Documents Card */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                    <FileText className="h-5 w-5 text-blue-600" /> Truck Documents
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-950"
                    >
                      {(optionsMap["document_type"] || []).map((d) => (
                        <option key={d.code} value={d.code}>
                          {resolveActiveText(d as any, activeLang, d.name_en)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Doc No."
                      value={newDocNum}
                      onChange={(e) => setNewDocNum(e.target.value)}
                      className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddDocument("truckDocuments")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Document
                    </button>
                  </div>
                </div>

                {/* Documents Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-wide dark:bg-slate-950">
                      <tr>
                        <Th className="p-3 text-start">#</Th>
                        <Th className="p-3 text-start">Document Type</Th>
                        <Th className="p-3 text-start">Document Number</Th>
                        <Th className="p-3 text-start">Issue Date</Th>
                        <Th className="p-3 text-start">Expiry Date</Th>
                        <Th className="p-3 text-start">Document File</Th>
                        <Th className="p-3 text-center">Actions</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {formData.truckDocuments.map((doc, idx) => (
                        <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/40">
                          <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{doc.type}</td>
                          <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{doc.number}</td>
                          <td className="p-3 text-slate-500">{doc.issueDate}</td>
                          <td className="p-3 text-slate-500">{doc.expiryDate}</td>
                          <td className="p-3">
                            <span className="font-bold text-blue-600 underline dark:text-blue-400 cursor-pointer">
                              {doc.fileName}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">({doc.fileSize})</span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" className="p-1 text-slate-400 hover:text-blue-600">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" className="p-1 text-slate-400 hover:text-emerald-600">
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDocument("truckDocuments", doc.id)}
                                className="p-1 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Information */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-2 text-sm font-black text-slate-900 dark:text-white">
                  {tUI("remarks")}
                </h3>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter any additional notes or remarks in any language..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>
          )}

          {/* STEP 2: OWNER INFORMATION */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-center gap-3">
                  <User className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wide">{tUI("step2")}</h2>
                    <p className="text-xs font-medium text-blue-100">{tUI("step2Sub")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Owner Details (Auto 5-Language Translation Active)
                  </h3>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full dark:bg-blue-950/60 dark:text-blue-300">
                    Active Input: {activeLang.toUpperCase()}
                  </span>
                </div>

                {/* Person / Owner Database Selector */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-slate-950 space-y-2">
                  <PersonPicker
                    label="Search & Select Owner / Customer Record from Database (or + Add New Owner)"
                    value={selectedOwnerId}
                    onValueChange={(id) => setSelectedOwnerId(id)}
                    placeholder="Search by owner name, mobile, company, CNIC..."
                  />
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Selecting an owner auto-fills their Name, CNIC, Mobile, Transport Company, and Address. Click &quot;+ Add New Person Master&quot; to register a new owner in the database.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Owner Name ({activeLang.toUpperCase()}) *
                    </label>
                    <input
                      type="text"
                      value={formData.ownerName[activeLang] || ""}
                      onChange={(e) => handleAutoTranslateField("ownerName", e.target.value)}
                      placeholder="Enter owner name..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      CNIC / Passport Number
                    </label>
                    <input
                      type="text"
                      value={formData.ownerCnicPassport}
                      onChange={(e) => setFormData({ ...formData, ownerCnicPassport: e.target.value })}
                      placeholder="e.g. 54400-1234567-1"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Owner Mobile Number
                    </label>
                    <input
                      type="text"
                      value={formData.ownerMobile}
                      onChange={(e) => setFormData({ ...formData, ownerMobile: e.target.value })}
                      placeholder="+92 300 1234567"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Transport Company Name ({activeLang.toUpperCase()})
                    </label>
                    <input
                      type="text"
                      value={formData.transportCompany[activeLang] || ""}
                      onChange={(e) => handleAutoTranslateField("transportCompany", e.target.value)}
                      placeholder="e.g. Damaan Goods Transport"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Owner Address
                    </label>
                    <input
                      type="text"
                      value={formData.ownerAddress}
                      onChange={(e) => setFormData({ ...formData, ownerAddress: e.target.value })}
                      placeholder="Enter owner address..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>
                </div>

                {/* 5-Language Translation Preview Box */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-black uppercase text-slate-500 mb-2">
                    ✓ Automatic 5-Language DB Transliteration Preview:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-medium sm:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">ENGLISH</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.ownerName.en || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">URDU</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.ownerName.ur || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">ARABIC</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.ownerName.ar || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">PERSIAN</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.ownerName.fa || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">PASHTO</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.ownerName.ps || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DRIVER INFORMATION */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wide">{tUI("step3")}</h2>
                    <p className="text-xs font-medium text-blue-100">{tUI("step3Sub")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
                  Driver Personal & License Details
                </h3>

                {/* Person / Driver Database Selector */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-slate-950 space-y-2">
                  <PersonPicker
                    label="Search & Select Driver / Person Record from Database (or + Add New Driver)"
                    value={selectedDriverId}
                    onValueChange={(id) => setSelectedDriverId(id)}
                    placeholder="Search by driver name, license, mobile..."
                  />
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Selecting a driver auto-fills their Name, License Number, Mobile, and Address. Click &quot;+ Add New Person Master&quot; to register a new driver in the database.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Driver Name ({activeLang.toUpperCase()}) *
                    </label>
                    <input
                      type="text"
                      value={formData.driverName[activeLang] || ""}
                      onChange={(e) => handleAutoTranslateField("driverName", e.target.value)}
                      placeholder="Enter driver name..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Driving License Number *
                    </label>
                    <input
                      type="text"
                      value={formData.licenseNo}
                      onChange={(e) => setFormData({ ...formData, licenseNo: e.target.value })}
                      placeholder="e.g. DL-9876543"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Driver Mobile Number
                    </label>
                    <input
                      type="text"
                      value={formData.driverMobile}
                      onChange={(e) => setFormData({ ...formData, driverMobile: e.target.value })}
                      placeholder="+92 301 9876543"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Driver Address
                    </label>
                    <input
                      type="text"
                      value={formData.driverAddress}
                      onChange={(e) => setFormData({ ...formData, driverAddress: e.target.value })}
                      placeholder="Enter driver residential address..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>
                </div>

                {/* Driver Name 5-Lang Preview */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-black uppercase text-slate-500 mb-2">
                    ✓ Automatic 5-Language Driver Name Saved in DB:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-medium sm:grid-cols-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">ENGLISH</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.driverName.en || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">URDU</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.driverName.ur || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">ARABIC</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.driverName.ar || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">PERSIAN</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.driverName.fa || "—"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                      <span className="text-[10px] text-slate-400 font-bold block">PASHTO</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formData.driverName.ps || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONTRACTS & DOCUMENTS */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-lg shadow-blue-600/20">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wide">{tUI("step4")}</h2>
                    <p className="text-xs font-medium text-blue-100">{tUI("step4Sub")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white border-b pb-3 border-slate-100 dark:border-slate-800">
                  Add Transport Contract / Agreement
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Contract Type
                    </label>
                    <select
                      value={newContractType}
                      onChange={(e) => setNewContractType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    >
                      {(optionsMap["contract_type"] || []).map((c) => (
                        <option key={c.code} value={c.code}>
                          {resolveActiveText(c as any, activeLang, c.name_en)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Contract Number
                    </label>
                    <input
                      type="text"
                      value={newContractNum}
                      onChange={(e) => setNewContractNum(e.target.value)}
                      placeholder="e.g. CNT-2024-889"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Start & End Date
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={newContractStart}
                        onChange={(e) => setNewContractStart(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-2.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                      />
                      <input
                        type="date"
                        value={newContractEnd}
                        onChange={(e) => setNewContractEnd(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-2.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={newContractTerms}
                      onChange={(e) => setNewContractTerms(e.target.value)}
                      placeholder="Enter contract terms or notes..."
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={handleAddContract}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      + Add Contract
                    </button>
                  </div>
                </div>

                {/* Contracts List Table */}
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 font-black text-slate-500 uppercase tracking-wide dark:bg-slate-950">
                      <tr>
                        <Th className="p-3 text-start">Contract Type</Th>
                        <Th className="p-3 text-start">Contract No.</Th>
                        <Th className="p-3 text-start">Duration</Th>
                        <Th className="p-3 text-start">Terms</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {formData.contracts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">
                            No active contracts added yet. Click "+ Add Contract" above to record contracts.
                          </td>
                        </tr>
                      ) : (
                        formData.contracts.map((c) => (
                          <tr key={c.id}>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{c.type}</td>
                            <td className="p-3 font-medium text-slate-600 dark:text-slate-300">{c.number}</td>
                            <td className="p-3 text-slate-500">{c.startDate} to {c.endDate}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-300">{c.terms}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-lg shadow-emerald-600/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-wide">{tUI("step5")}</h2>
                    <p className="text-xs font-medium text-emerald-100">{tUI("step5Sub")}</p>
                  </div>
                </div>
              </div>

              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                    <span>1. Truck Details</span>
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950">Verified</span>
                  </h4>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p><strong className="text-slate-900 dark:text-white">Truck No:</strong> {formData.truckNumber || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Reg No:</strong> {formData.registrationNo || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Type:</strong> {formData.truckType || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Make / Model:</strong> {`${formData.make || ""} ${formData.model || ""}`.trim() || "—"}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                    <span>2. Owner Details (5-Lang)</span>
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950">Verified</span>
                  </h4>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p><strong className="text-slate-900 dark:text-white">Owner Name:</strong> {resolveActiveText(formData.ownerName, activeLang, "—")}</p>
                    <p><strong className="text-slate-900 dark:text-white">CNIC/Passport:</strong> {formData.ownerCnicPassport || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Mobile:</strong> {formData.ownerMobile || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Company:</strong> {resolveActiveText(formData.transportCompany, activeLang, "—")}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                    <span>3. Driver Details (5-Lang)</span>
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950">Verified</span>
                  </h4>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p><strong className="text-slate-900 dark:text-white">Driver Name:</strong> {resolveActiveText(formData.driverName, activeLang, "—")}</p>
                    <p><strong className="text-slate-900 dark:text-white">License No:</strong> {formData.licenseNo || "—"}</p>
                    <p><strong className="text-slate-900 dark:text-white">Mobile:</strong> {formData.driverMobile || "—"}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                    <span>4. Attachments & Contracts</span>
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950">Verified</span>
                  </h4>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p><strong className="text-slate-900 dark:text-white">Documents Uploaded:</strong> {formData.truckDocuments.length + formData.ownerDocuments.length + formData.driverDocuments.length}</p>
                    <p><strong className="text-slate-900 dark:text-white">Contracts Attached:</strong> {formData.contracts.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Step Navigation Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              disabled={activeStep === 1}
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {tUI("prevStep")}
            </button>

            {activeStep < 5 ? (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-95"
              >
                {tUI("nextStep")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tUI("submit")}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Summary Report Panel (Matching Mockup Screenshot) */}
        <div className="lg:col-span-4">
          <div className="sticky top-6 space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                  {tUI("liveReportTitle")}
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {tUI("liveReportSub")}
                </p>
              </div>
            </div>

            {/* Step 1 Live Summary Box */}
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isStep1Done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {isStep1Done ? "✓" : "1"}
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Step 1 - Truck Information
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isStep1Done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                  {isStep1Done ? "Completed" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 font-medium">Truck Number</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.truckNumber || "—"}</span>

                <span className="text-slate-400 font-medium">Registration No</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.registrationNo || "—"}</span>

                <span className="text-slate-400 font-medium">Truck Type</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.truckType || "—"}</span>

                <span className="text-slate-400 font-medium">Capacity (Tons)</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.capacityTons || "—"}</span>

                <span className="text-slate-400 font-medium">Make / Model</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{`${formData.make || ""} ${formData.model || ""}`.trim() || "—"}</span>

                <span className="text-slate-400 font-medium">Year</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.year || "—"}</span>
              </div>
            </div>

            {/* Step 2 Live Summary Box */}
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isStep2Done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {isStep2Done ? "✓" : "2"}
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Step 2 - Owner Information
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isStep2Done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"}`}>
                  {isStep2Done ? "Completed" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 font-medium">Owner Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-end truncate">
                  {resolveActiveText(formData.ownerName, activeLang, "—")}
                </span>

                <span className="text-slate-400 font-medium">CNIC / Passport</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.ownerCnicPassport || "—"}</span>

                <span className="text-slate-400 font-medium">Mobile</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.ownerMobile || "—"}</span>
              </div>
            </div>

            {/* Step 3 Live Summary Box */}
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isStep3Done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {isStep3Done ? "✓" : "3"}
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Step 3 - Driver Information
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isStep3Done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"}`}>
                  {isStep3Done ? "Completed" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 font-medium">Driver Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-end truncate">
                  {resolveActiveText(formData.driverName, activeLang, "—")}
                </span>

                <span className="text-slate-400 font-medium">License No</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.licenseNo || "—"}</span>

                <span className="text-slate-400 font-medium">Mobile</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.driverMobile || "—"}</span>
              </div>
            </div>

            {/* Step 4 Live Summary Box */}
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${isStep4Done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {isStep4Done ? "✓" : "4"}
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Step 4 - Contracts & Documents
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isStep4Done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"}`}>
                  {isStep4Done ? "Completed" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                <span className="text-slate-400 font-medium">Contracts Added</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">{formData.contracts.length}</span>

                <span className="text-slate-400 font-medium">Total Documents</span>
                <span className="font-bold text-slate-900 dark:text-white text-end">
                  {formData.truckDocuments.length + formData.ownerDocuments.length + formData.driverDocuments.length}
                </span>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-1.5">
                <span>Overall Progress</span>
                <span className="text-blue-600 dark:text-blue-400">{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-400">
                Please complete all steps to submit the truck record.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
