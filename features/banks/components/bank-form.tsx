"use client";

import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Globe,
  Landmark,
  Minus,
  Plus,
  Save,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { createBank, type BankRecord } from "@/features/banks/bank-api";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { PersonPicker } from "@/components/erp/person-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";

const DEFAULT_BANK_TYPES = [
  "Customer Account",
  "Business Account",
  "Personal Account",
  "Credit Card",
  "Debit Card",
  "Commercial Bank",
  "Islamic Bank",
  "Central Bank",
  "Exchange Company"
];

const BANK_TYPE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Customer Account": { ur: "کسٹمر اکاؤنٹ", ar: "حساب العميل", fa: "حساب مشتری", ps: "د پیرودونکي حساب" },
  "Business Account": { ur: "بزنس اکاؤنٹ", ar: "حساب تجاري", fa: "حساب تجاری", ps: "تجارتي حساب" },
  "Personal Account": { ur: "ذاتی اکاؤنٹ", ar: "حساب شخصي", fa: "حساب شخصی", ps: "شخصي حساب" },
  "Credit Card": { ur: "کریڈٹ کارڈ", ar: "بطاقة ائتمان", fa: "کارت اعتباری", ps: "کریډیټ کارت" },
  "Debit Card": { ur: "ڈیبٹ کارڈ", ar: "بطاقة الخصم", fa: "کارت نقدی", ps: "ډیبیټ کارت" },
  "Commercial Bank": { ur: "کمرشل بینک", ar: "بنك تجاري", fa: "بانک تجاری", ps: "سوداګریز بانک" },
  "Islamic Bank": { ur: "اسلامی بینک", ar: "مصرف إسلامي", fa: "بانک اسلامی", ps: "اسلامي بانک" },
  "Central Bank": { ur: "مرکزی بینک", ar: "البنك المركزي", fa: "بانک مرکزی", ps: "مرکزي بانک" },
  "Exchange Company": { ur: "ایکسچینج کمپنی", ar: "شركة صرافة", fa: "شرکت صرافی", ps: "د تبادلې شرکت" }
};

const DEFAULT_ACCOUNT_TYPES = [
  "Business Account",
  "Company Account",
  "Personal Account",
  "Current Account",
  "Savings Account",
  "Fixed Deposit",
  "Joint Account"
];

const ACCOUNT_TYPE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Business Account": { ur: "بزنس اکاؤنٹ", ar: "حساب تجاري", fa: "حساب تجاری", ps: "تجارتي حساب" },
  "Company Account": { ur: "کمپنی اکاؤنٹ", ar: "حساب شركة", fa: "حساب شرکت", ps: "د شرکت حساب" },
  "Personal Account": { ur: "ذاتی اکاؤنٹ", ar: "حساب شخصي", fa: "حساب شخصی", ps: "شخصي حساب" },
  "Current Account": { ur: "کرنٹ اکاؤنٹ", ar: "حساب جاري", fa: "حساب جاری", ps: "روان حساب" },
  "Savings Account": { ur: "سیونگ اکاؤنٹ", ar: "حساب توفير", fa: "حساب پس‌انداز", ps: "د سپما حساب" },
  "Fixed Deposit": { ur: "فکسڈ ڈپازٹ", ar: "وديعة لأجل", fa: "سپرده ثابت", ps: "ثابت امانت" },
  "Joint Account": { ur: "مشترکہ اکاؤنٹ", ar: "حساب مشترك", fa: "حساب مشترک", ps: "ګډ حساب" }
};

const DEFAULT_BRANCH_CODE_TYPES = [
  "SWIFT Code",
  "Routing Number",
  "IFSC Code",
  "Sort Code",
  "BSB Number",
  "Branch Code",
  "IBAN Prefix"
];

const BRANCH_CODE_TYPE_TRANSLATIONS: Record<string, Record<string, string>> = {
  "SWIFT Code": { ur: "سوئفٹ کوڈ (SWIFT Code)", ar: "رمز سويفت (SWIFT)", fa: "کد سویفت", ps: "سویفټ کوډ" },
  "Routing Number": { ur: "راؤٹنگ نمبر (Routing Number)", ar: "رقم التوجيه", fa: "شماره مسیریابی", ps: "روټینګ شمیره" },
  "IFSC Code": { ur: "آئی ایف ایس سی کوڈ (IFSC Code)", ar: "رمز IFSC", fa: "کد IFSC", ps: "د IFSC کوډ" },
  "Sort Code": { ur: "سورٹ کوڈ (Sort Code)", ar: "رمز الفرز", fa: "سورت کد", ps: "سارټ کوډ" },
  "BSB Number": { ur: "بی ایس بی نمبر (BSB Number)", ar: "رقم BSB", fa: "شماره BSB", ps: "د BSB شمیره" },
  "Branch Code": { ur: "برانچ کوڈ (Branch Code)", ar: "رمز الفرع", fa: "کد شعبه", ps: "د څانګې کوډ" },
  "IBAN Prefix": { ur: "آئی بین پریفکس (IBAN Prefix)", ar: "بادئة الآيبان", fa: "پیشوند شبا", ps: "د IBAN مختاړی" }
};

const CURRENCIES = [
  "USD", "PKR", "AED", "AFN", "EUR", "GBP", "SAR", "INR",
  "CNY", "TRY", "IRR", "OMR", "KWD", "QAR", "BHD"
];

const STATUS_OPTIONS = ["Active", "Inactive", "Frozen", "Closed"];

const STATUS_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Active": { ur: "فعال (Active)", ar: "نشط", fa: "فعال", ps: "فعال" },
  "Inactive": { ur: "غیر فعال (Inactive)", ar: "غير نشط", fa: "غیرفعال", ps: "غیر فعال" },
  "Frozen": { ur: "منجمد (Frozen)", ar: "مجمد", fa: "مسدود", ps: "کنګل شوی" },
  "Closed": { ur: "بند (Closed)", ar: "مغلق", fa: "بسته", ps: "تړل شوی" }
};

function localizeOption(val: string, dict: Record<string, Record<string, string>>, lang: string): string {
  if (lang === "en") return val;
  return dict[val]?.[lang] || val;
}

type BankFormState = {
  bankType: string;
  accountType: string;
  bankName: string;
  branchName: string;
  branchCodeType: string;
  branchCode: string;
  shortName: string;
  accountTitle: string;
  accountNumber: string;
  ibanNumber: string;
  currency: string;
  accountStatus: string;
  countryId: string;
  stateProvinceId: string;
  districtId: string;
  cityId: string;
  fullAddress: string;
  phone: string;
  email: string;
  swiftBic: string;
  website: string;
  remarks: string;
};

const emptyForm: BankFormState = {
  bankType: "",
  accountType: "",
  bankName: "",
  branchName: "",
  branchCodeType: "SWIFT Code",
  branchCode: "",
  shortName: "",
  accountTitle: "",
  accountNumber: "",
  ibanNumber: "",
  currency: "USD",
  accountStatus: "Active",
  countryId: "",
  stateProvinceId: "",
  districtId: "",
  cityId: "",
  fullAddress: "",
  phone: "",
  email: "",
  swiftBic: "",
  website: "",
  remarks: ""
};

export type BankFormProps = {
  /** "standalone" = full settings page, "embedded" = inside a modal from BankPicker */
  mode?: "standalone" | "embedded";
  initialBankId?: string;
  onSave?: (bankId: string, bank: BankRecord) => void;
  onCancel?: () => void;
};

export function BankForm({
  mode = "standalone",
  onSave,
  onCancel
}: BankFormProps) {
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const [form, setForm] = useState<BankFormState>(emptyForm);
  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: ""
  });
  const [ownerType, setOwnerType] = useState<"person" | "company" | "none">("none");
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [ownerCompanyId, setOwnerCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedBank, setSavedBank] = useState<BankRecord | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [bankTypes, setBankTypes] = useState(DEFAULT_BANK_TYPES);
  const [accountTypes, setAccountTypes] = useState(DEFAULT_ACCOUNT_TYPES);
  const [branchCodeTypes, setBranchCodeTypes] = useState(DEFAULT_BRANCH_CODE_TYPES);
  const [typeModal, setTypeModal] = useState<"bankType" | "accountType" | "branchCodeType" | null>(null);
  const [newType, setNewType] = useState("");

  function saveType() {
    if (!newType.trim()) return;
    if (typeModal === "bankType") {
      setBankTypes([...bankTypes, newType.trim()]);
      set("bankType", newType.trim());
    } else if (typeModal === "accountType") {
      setAccountTypes([...accountTypes, newType.trim()]);
      set("accountType", newType.trim());
    } else if (typeModal === "branchCodeType") {
      setBranchCodeTypes([...branchCodeTypes, newType.trim()]);
      set("branchCodeType", newType.trim());
    }
    setTypeModal(null);
    setNewType("");
  }

  function set(field: keyof BankFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setLocation(next);
    setForm((prev) => {
      let phoneVal = prev.phone;
      if (meta.country?.phone_code && !prev.phone.trim()) {
        phoneVal = meta.country.phone_code + " ";
      }
      return {
        ...prev,
        countryId: next.countryId,
        stateProvinceId: next.stateProvinceId,
        districtId: next.districtId,
        cityId: next.cityId,
        phone: phoneVal
      };
    });
  }

  const isReady =
    form.bankType &&
    form.accountType &&
    form.bankName &&
    form.branchCode &&
    form.shortName &&
    form.accountTitle &&
    form.accountNumber &&
    form.currency;

  async function handleSave() {
    if (!isReady) {
      setMessage({ type: "error", text: tr("bank.validation_required_fields", "Please fill all required fields marked with *") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const computedBranchName = `${form.branchCodeType} - ${form.branchCode}`;
      const bankId = await createBank({
        ownerPersonId: ownerType === "person" ? ownerPersonId || null : null,
        ownerCompanyId: ownerType === "company" ? ownerCompanyId || null : null,
        bankType: form.bankType,
        accountType: form.accountType,
        bankName: form.bankName,
        branchName: computedBranchName,
        branchCode: form.branchCode,
        branchCodeType: form.branchCodeType,
        shortName: form.shortName,
        accountTitle: form.accountTitle,
        accountNumber: form.accountNumber,
        ibanNumber: form.ibanNumber || null,
        currency: form.currency,
        accountStatus: form.accountStatus,
        countryId: form.countryId || null,
        stateProvinceId: form.stateProvinceId || null,
        districtId: form.districtId || null,
        cityId: form.cityId || null,
        fullAddress: form.fullAddress || null,
        phone: form.phone || null,
        email: form.email || null,
        swiftBic: form.swiftBic || null,
        website: form.website || null,
        remarks: form.remarks || null
      });

      const saved: BankRecord = {
        id: bankId,
        owner_person_id: ownerType === "person" ? ownerPersonId || null : null,
        owner_company_id: ownerType === "company" ? ownerCompanyId || null : null,
        bank_type: form.bankType,
        account_type: form.accountType,
        bank_name: form.bankName,
        branch_name: computedBranchName,
        branch_code: form.branchCode,
        branch_code_type: form.branchCodeType,
        short_name: form.shortName,
        account_title: form.accountTitle,
        account_number: form.accountNumber,
        iban_number: form.ibanNumber || null,
        currency: form.currency,
        account_status: form.accountStatus,
        country_id: form.countryId || null,
        state_province_id: form.stateProvinceId || null,
        district_id: form.districtId || null,
        city_id: form.cityId || null,
        full_address: form.fullAddress || null,
        phone: form.phone || null,
        email: form.email || null,
        swift_bic: form.swiftBic || null,
        website: form.website || null,
        remarks: form.remarks || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSavedBank(saved);
      setMessage({ type: "success", text: tr("bank.saved_success_message", `Bank "${form.bankName}" saved successfully!`).replace("{name}", form.bankName) });
      onSave?.(bankId, saved);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? tr("bank.save_failed", "Failed to save bank.") });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(emptyForm);
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "" });
    setSavedBank(null);
    setMessage(null);
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className={mode === "standalone" ? "space-y-6" : "space-y-4"}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Landmark className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {mode === "standalone" ? tr("bank.settings_master_forms", "Settings / Master Forms") : tr("bank.master_form_title", "Bank Master Form")}
            </p>
            <h1 className={mode === "standalone" ? "mt-0.5 text-2xl font-bold tracking-tight" : "text-lg font-bold"}>
              {tr("bank.master_form_title", "Bank Master Form")}
            </h1>
            {mode === "standalone" && (
              <p className="text-sm text-muted-foreground">
                {tr("bank.subtitle", "Create and manage bank information for personal or business use")}
              </p>
            )}
          </div>
        </div>
        <span
          className={
            isReady
              ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200"
              : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200"
          }
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {isReady ? tr("bank.ready_to_save", "Ready to Save") : tr("bank.draft", "Draft")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-semibold text-slate-500 mb-2">
        {[
          { id: 1, label: tr("bank.step_bank_info", "1. Bank Information") },
          { id: 2, label: tr("bank.step_contact_address", "2. Contact & Address") },
          { id: 3, label: tr("bank.step_review_save", "3. Review & Save") },
        ].map((s) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as any)}
              className={`flex items-center gap-2 border rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-primary text-white" : completed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">

          {/* Section 1: Bank Information */}
          {currentStep === 1 && (
          <section className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3">
              <Landmark className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{tr("bank.section_bank_info", "Bank Information")}</h2>
            </div>

            {/* Account owner — Person Master or Company Master, or neither (legacy/unassigned) */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label className="text-xs font-semibold">{tr("bank.account_owner", "Account Owner")}</Label>
              <div className="flex gap-2">
                {(["none", "person", "company"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setOwnerType(opt)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      ownerType === opt ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt === "none" && tr("bank.owner_none", "Unassigned")}
                    {opt === "person" && tr("bank.owner_individual", "Individual (Person)")}
                    {opt === "company" && tr("bank.owner_firm", "Firm (Company)")}
                  </button>
                ))}
              </div>
              {ownerType === "person" && (
                <PersonPicker
                  label={tr("bank.owner_person_label", "Account Owner (Person)")}
                  value={ownerPersonId}
                  onValueChange={setOwnerPersonId}
                  lang={lang}
                />
              )}
              {ownerType === "company" && (
                <CompanyPicker
                  label={tr("bank.owner_company_label", "Account Owner (Company)")}
                  value={ownerCompanyId}
                  onValueChange={setOwnerCompanyId}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Bank Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.bank_type", "Bank Type")} *</Label>
                <select
                  value={form.bankType}
                  onChange={(e) => {
                    if (e.target.value === "__new__") setTypeModal("bankType");
                    else set("bankType", e.target.value);
                  }}
                  className={selectClass}
                >
                  <option value="">{tr("bank.select_bank_type", "Select Bank Type")}</option>
                  {bankTypes.map((bt) => <option key={bt} value={bt}>{localizeOption(bt, BANK_TYPE_TRANSLATIONS, lang)}</option>)}
                  <option value="__new__">{tr("bank.add_new_type", "+ Add New Type")}</option>
                </select>
              </div>

              {/* Account Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.account_type", "Account Type")} *</Label>
                <select
                  value={form.accountType}
                  onChange={(e) => {
                    if (e.target.value === "__new__") setTypeModal("accountType");
                    else set("accountType", e.target.value);
                  }}
                  className={selectClass}
                >
                  <option value="">{tr("bank.select_account_type", "Select Account Type")}</option>
                  {accountTypes.map((at) => <option key={at} value={at}>{localizeOption(at, ACCOUNT_TYPE_TRANSLATIONS, lang)}</option>)}
                  <option value="__new__">{tr("bank.add_new_type", "+ Add New Type")}</option>
                </select>
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.bank_name", "Bank Name")} *</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                  placeholder={tr("bank.enter_bank_name", "Enter bank name")}
                />
              </div>
            </div>

            {/* Branch Code & Short Name */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">{localizeOption(form.branchCodeType, BRANCH_CODE_TYPE_TRANSLATIONS, lang) || tr("bank.branch_code_generic", "Branch Code")} *</Label>
                <div className="flex gap-1.5">
                  <select
                    value={form.branchCodeType}
                    onChange={(e) => {
                      if (e.target.value === "__new__") setTypeModal("branchCodeType");
                      else set("branchCodeType", e.target.value);
                    }}
                    className="h-10 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
                  >
                    {branchCodeTypes.map((bct) => <option key={bct} value={bct}>{localizeOption(bct, BRANCH_CODE_TYPE_TRANSLATIONS, lang)}</option>)}
                    <option value="__new__">{tr("bank.add_new_type", "+ Add New Type")}</option>
                  </select>
                  <Input
                    value={form.branchCode}
                    onChange={(e) => set("branchCode", e.target.value)}
                    placeholder={`${tr("bank.enter_prefix", "Enter")} ${localizeOption(form.branchCodeType, BRANCH_CODE_TYPE_TRANSLATIONS, lang).toLowerCase()}`}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Short Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.short_name_code", "Short Name / Code")} *</Label>
                <Input
                  value={form.shortName}
                  onChange={(e) => set("shortName", e.target.value)}
                  placeholder={tr("bank.short_name_placeholder", "e.g. SCB, HBL, UBL")}
                  maxLength={20}
                />
                <p className="text-[10px] text-muted-foreground">{tr("bank.short_code_hint", "Short code for bank")}</p>
              </div>
            </div>

            {/* Account Title + Account Number */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.account_title_name", "Account Title / Name")} *</Label>
                <Input
                  value={form.accountTitle}
                  onChange={(e) => set("accountTitle", e.target.value)}
                  placeholder={tr("bank.enter_account_title", "Enter account title / name")}
                />
                <p className="text-[10px] text-muted-foreground">{tr("bank.account_title_hint", "Account holder name (Personal or Company)")}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.account_number", "Account Number")} *</Label>
                <Input
                  value={form.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  placeholder={tr("bank.enter_account_number", "Enter account number")}
                  className="font-mono text-lg h-14 tracking-widest"
                />
              </div>
            </div>

            {/* IBAN */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tr("bank.iban_number_optional", "IBAN Number (Optional)")}</Label>
              <Input
                value={form.ibanNumber}
                onChange={(e) => set("ibanNumber", e.target.value)}
                placeholder={tr("bank.enter_iban", "Enter IBAN number")}
                maxLength={34}
                className="font-mono"
              />
            </div>

            {/* Currency + Status */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.currency_of_account", "Currency of Account")} *</Label>
                <div className="flex gap-3">
                  <select
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value)}
                    className={selectClass}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 shrink-0">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {form.currency ? form.currency.charAt(0) : "$"}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {form.currency || tr("bank.not_selected", "Not selected")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tr("bank.currency_selected", "Currency Selected")}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.account_status", "Account Status")} *</Label>
                <select
                  value={form.accountStatus}
                  onChange={(e) => set("accountStatus", e.target.value)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{localizeOption(s, STATUS_TRANSLATIONS, lang)}</option>)}
                </select>
              </div>
            </div>
          </section>
          )}


          {/* Section 2: Contact & Address */}
          {currentStep === 2 && (
          <section className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3">
              <Globe className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{tr("bank.section_contact_address", "Contact & Address Information")}</h2>
            </div>

            <LocationHierarchySelect
              value={location}
              onChange={handleLocationChange}
              showArea={false}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tr("bank.full_address", "Full Address")}</Label>
              <Input
                value={form.fullAddress}
                onChange={(e) => set("fullAddress", e.target.value)}
                placeholder={tr("bank.enter_full_address", "Enter full address")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.phone_number", "Phone Number")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder={tr("bank.enter_phone_optional", "Enter phone number (optional)")}
                  type="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.email_address", "Email Address")}</Label>
                <Input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder={tr("bank.enter_email_optional", "Enter email address (optional)")}
                  type="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.swift_bic_optional", "SWIFT / BIC Code (Optional)")}</Label>
                <Input
                  value={form.swiftBic}
                  onChange={(e) => set("swiftBic", e.target.value)}
                  placeholder={tr("bank.enter_swift", "Enter SWIFT / BIC code")}
                  className="font-mono uppercase"
                  maxLength={11}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tr("bank.website_optional", "Website (Optional)")}</Label>
                <Input
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder={tr("bank.enter_website", "Enter website")}
                  type="url"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{tr("bank.remarks_optional", "Remarks (Optional)")}</Label>
              <textarea
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder={tr("bank.enter_remarks", "Enter any additional remarks")}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

          </section>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-800">{tr("bank.review_save_title", "Review & Save")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("bank.review_save_desc", "Please review the bank details on the right. Once confirmed, you can save the bank record.")}
              </p>
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={
                message.type === "success"
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                  : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              }
            >
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as any)}
              disabled={currentStep === 1}
              className="border-slate-200 text-slate-700 font-medium h-10 px-4"
            >
              {tr("common.back", "Back")}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel ?? handleReset}
                className="h-10 px-4"
              >
                {tr("common.cancel", "Cancel")}
              </Button>
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((Math.min(3, currentStep + 1)) as any)}
                  className="rounded-lg bg-primary hover:bg-primary-dark text-white font-medium shadow-sm h-10 px-8 gap-2"
                >
                  {tr("common.next", "Next")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isReady}
                  className="rounded-lg bg-primary text-white hover:bg-primary-dark transition gap-2 shadow-sm font-medium h-10 px-5"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {saving ? tr("bank.saving", "Saving...") : tr("bank.save_bank", "Save Bank")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Bank Summary Preview */}
        <aside className="h-fit rounded-lg border bg-card p-5 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-semibold text-sm">{tr("bank.bank_preview", "Bank Preview")}</h2>
            </div>
            <div>
              {savedBank ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {tr("bank.saved_record", "Saved Record")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {tr("bank.live_draft", "Live Draft")}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {savedBank && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-center mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-emerald-700 font-semibold text-xs">{tr("bank.saved_successfully", "Saved Successfully")}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{tr("bank.bank_name", "Bank Name")}</p>
              <p className="font-bold text-sm mt-0.5 text-slate-900">{savedBank ? savedBank.bank_name : form.bankName || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{tr("bank.account_title_label", "Account Title")}</p>
              <p className="font-semibold mt-0.5 text-slate-800">{savedBank ? savedBank.account_title : form.accountTitle || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{tr("bank.account_number", "Account Number")}</p>
              <p className="font-mono font-bold mt-0.5 text-slate-900">{savedBank ? savedBank.account_number : form.accountNumber || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{tr("bank.iban_label", "IBAN")}</p>
              <p className="font-mono mt-0.5 break-all text-slate-700">{savedBank ? (savedBank.iban_number || "-") : form.ibanNumber || "-"}</p>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">{tr("bank.currency_of_account", "Currency of Account")}</span>
              <span className="font-bold font-mono text-slate-900">{savedBank ? savedBank.currency : form.currency || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr("bank.branch_label", "Branch")}</span>
              <span className="font-semibold text-slate-800">
                {savedBank ? savedBank.branch_name : (form.branchCode ? `${localizeOption(form.branchCodeType, BRANCH_CODE_TYPE_TRANSLATIONS, lang)} - ${form.branchCode}` : "-")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr("common.status", "Status")}</span>
              <span className={`font-bold ${savedBank ? (savedBank.account_status === "Active" ? "text-emerald-600" : "text-amber-600") : (form.accountStatus === "Active" ? "text-emerald-600" : "text-amber-600")}`}>
                {localizeOption(savedBank ? (savedBank.account_status || "Active") : form.accountStatus, STATUS_TRANSLATIONS, lang)}
              </span>
            </div>

            {savedBank && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={handleReset}
              >
                {tr("bank.add_another_bank", "+ Add Another Bank")}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {typeModal && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-2xl">
            <h2 className="font-semibold text-slate-950">{tr("bank.add_new_type_modal_title", "Add New Type")}</h2>
            <div className="mt-4 space-y-3">
              <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder={tr("bank.enter_new_type", "Enter new type")} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTypeModal(null)}>
                  {tr("common.cancel", "Cancel")}
                </Button>
                <Button type="button" onClick={saveType}>
                  {tr("common.save", "Save")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
