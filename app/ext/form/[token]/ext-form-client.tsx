"use client";

/**
 * External Form Client — /ext/form/[token]
 *
 * Completely standalone public page. No ERP login, no sidebar, no dashboard.
 * Supports 5 languages: English, Urdu, Arabic, Persian, Pashto.
 *
 * Flow:
 *   1. Fetch token metadata → determine formType
 *   2. Show language selector + appropriate form fields
 *   3. Submit → POST /api/public/form-link/[token]
 *   4. Show success / error state
 */

import React, { useState, useEffect, useCallback } from "react";

// ─── 5-Language Dictionary ────────────────────────────────────────────────────

type Lang = "en" | "ur" | "ar" | "fa" | "ps";

const LANGS: { code: Lang; label: string; dir: "ltr" | "rtl"; nativeName: string }[] = [
  { code: "en", label: "English",  dir: "ltr", nativeName: "English"   },
  { code: "ur", label: "Urdu",     dir: "rtl", nativeName: "اردو"      },
  { code: "ar", label: "Arabic",   dir: "rtl", nativeName: "العربية"   },
  { code: "fa", label: "Persian",  dir: "rtl", nativeName: "فارسی"     },
  { code: "ps", label: "Pashto",   dir: "rtl", nativeName: "پښتو"      },
];

const dict: Record<string, Record<Lang, string>> = {
  pageTitle: {
    en: "Secure Form Submission",
    ur: "محفوظ فارم جمع کروائیں",
    ar: "تقديم النموذج الآمن",
    fa: "ارسال فرم امن",
    ps: "خوندي فورم ثبتول",
  },
  pageSubtitle: {
    en: "This form was shared with you by our team. Please fill in your details and submit.",
    ur: "یہ فارم ہماری ٹیم نے آپ کے ساتھ شیئر کیا ہے۔ براہِ کرم اپنی تفصیلات بھریں اور جمع کروائیں۔",
    ar: "تمت مشاركة هذا النموذج معك من قِبَل فريقنا. يرجى ملء بياناتك وتقديمها.",
    fa: "این فرم توسط تیم ما با شما به اشتراک گذاشته شده است. لطفاً اطلاعات خود را وارد کنید.",
    ps: "دا فورم زموږ ټیم لخوا تاسو سره شریک شوی دی. مهرباني وکړئ خپل معلومات ډک کړئ.",
  },
  selectLanguage: {
    en: "Select Language",
    ur: "زبان منتخب کریں",
    ar: "اختر اللغة",
    fa: "زبان را انتخاب کنید",
    ps: "ژبه وټاکئ",
  },
  // Form type titles
  customerForm: {
    en: "Customer Registration Form",
    ur: "کسٹمر رجسٹریشن فارم",
    ar: "نموذج تسجيل العميل",
    fa: "فرم ثبت مشتری",
    ps: "د پیرودونکي ثبت فورم",
  },
  employeeForm: {
    en: "Employee Registration Form",
    ur: "ملازم رجسٹریشن فارم",
    ar: "نموذج تسجيل الموظف",
    fa: "فرم ثبت کارمند",
    ps: "د کارمند ثبت فورم",
  },
  companyForm: {
    en: "Company Registration Form",
    ur: "کمپنی رجسٹریشن فارم",
    ar: "نموذج تسجيل الشركة",
    fa: "فرم ثبت شرکت",
    ps: "د شرکت ثبت فورم",
  },
  agentForm: {
    en: "Agent Registration Form",
    ur: "ایجنٹ رجسٹریشن فارم",
    ar: "نموذج تسجيل الوكيل",
    fa: "فرم ثبت نمایندگی",
    ps: "د ایجنټ ثبت فورم",
  },
  // Common fields
  fullName: {
    en: "Full Name *", ur: "پورا نام *", ar: "الاسم الكامل *", fa: "نام کامل *", ps: "بشپړ نوم *",
  },
  firstName: {
    en: "First Name", ur: "پہلا نام", ar: "الاسم الأول", fa: "نام", ps: "لومړی نوم",
  },
  lastName: {
    en: "Last Name", ur: "آخری نام", ar: "اسم العائلة", fa: "نام خانوادگی", ps: "وروستی نوم",
  },
  fatherName: {
    en: "Father's Name", ur: "والد کا نام", ar: "اسم الأب", fa: "نام پدر", ps: "د پلار نوم",
  },
  gender: {
    en: "Gender", ur: "جنس", ar: "الجنس", fa: "جنسیت", ps: "جنسیت",
  },
  male: { en: "Male", ur: "مرد", ar: "ذكر", fa: "مرد", ps: "نارینه" },
  female: { en: "Female", ur: "خاتون", ar: "أنثى", fa: "زن", ps: "ښځه" },
  mobile: {
    en: "Mobile / Phone *", ur: "موبائل / فون *", ar: "رقم الجوال *", fa: "موبایل *", ps: "موبایل *",
  },
  whatsapp: {
    en: "WhatsApp Number", ur: "واٹس ایپ نمبر", ar: "رقم واتساب", fa: "شماره واتساپ", ps: "واټساپ نمبر",
  },
  email: {
    en: "Email Address", ur: "ای میل ایڈریس", ar: "البريد الإلكتروني", fa: "آدرس ایمیل", ps: "بریښنالیک",
  },
  address: {
    en: "Address", ur: "پتہ", ar: "العنوان", fa: "آدرس", ps: "پته",
  },
  companyName: {
    en: "Company / Business Name", ur: "کمپنی / کاروبار کا نام", ar: "اسم الشركة", fa: "نام شرکت", ps: "د شرکت نوم",
  },
  legalName: {
    en: "Legal / Registered Name", ur: "قانونی / رجسٹرڈ نام", ar: "الاسم القانوني", fa: "نام قانونی", ps: "قانوني نوم",
  },
  businessType: {
    en: "Business Type", ur: "کاروبار کی نوعیت", ar: "نوع النشاط التجاري", fa: "نوع کسب‌وکار", ps: "د سوداګرۍ ډول",
  },
  ownerName: {
    en: "Owner Name", ur: "مالک کا نام", ar: "اسم المالك", fa: "نام مالک", ps: "د مالک نوم",
  },
  designation: {
    en: "Designation / Job Title", ur: "عہدہ / جاب ٹائٹل", ar: "المسمى الوظيفي", fa: "عنوان شغلی", ps: "دنده / کار عنوان",
  },
  department: {
    en: "Department", ur: "شعبہ", ar: "القسم", fa: "دپارتمان", ps: "سیکشن",
  },
  cnicPassport: {
    en: "CNIC / Passport Number", ur: "شناختی کارڈ / پاسپورٹ نمبر", ar: "رقم الهوية / جواز السفر", fa: "شناسه ملی / پاسپورت", ps: "کارت / پاسپورت نمبر",
  },
  notes: {
    en: "Additional Notes", ur: "اضافی نوٹس", ar: "ملاحظات إضافية", fa: "یادداشت اضافه", ps: "اضافي نوټونه",
  },
  submit: {
    en: "Submit Form", ur: "فارم جمع کروائیں", ar: "تقديم النموذج", fa: "ارسال فرم", ps: "فورم وسپارئ",
  },
  submitting: {
    en: "Submitting...", ur: "جمع کیا جا رہا ہے...", ar: "جاري الإرسال...", fa: "در حال ارسال...", ps: "وسپارل کیږي...",
  },
  successTitle: {
    en: "Form Submitted Successfully!",
    ur: "فارم کامیابی سے جمع ہو گیا!",
    ar: "تم تقديم النموذج بنجاح!",
    fa: "فرم با موفقیت ارسال شد!",
    ps: "فورم بریالیتوب سره وسپارل شو!",
  },
  successMsg: {
    en: "Thank you! Your information has been received. Our team will review it and get back to you.",
    ur: "شکریہ! آپ کی معلومات موصول ہو گئی ہیں۔ ہماری ٹیم اسے جائزہ لے گی اور آپ سے رابطہ کرے گی۔",
    ar: "شكراً! تم استلام معلوماتك. سيراجعها فريقنا ويتواصل معك.",
    fa: "ممنون! اطلاعات شما دریافت شد. تیم ما آن را بررسی کرده با شما تماس خواهد گرفت.",
    ps: "مننه! ستاسو معلومات ترلاسه شول. زموږ ټیم به یې وگوري او تاسو سره به اړیکه ونیسي.",
  },
  errorInvalid: {
    en: "This form link is invalid, expired, or has already been used.",
    ur: "یہ فارم لنک غلط ہے، میعاد ختم ہو گئی ہے، یا پہلے ہی استعمال ہو چکا ہے۔",
    ar: "رابط النموذج غير صالح أو منتهي الصلاحية أو تم استخدامه مسبقاً.",
    fa: "لینک فرم نامعتبر، منقضی یا قبلاً استفاده شده است.",
    ps: "د فورم لینک ناسم دی، میعاد یې پای ته رسیدلی یا دمخه کارول شوی.",
  },
  required: {
    en: "This field is required",
    ur: "یہ فیلڈ ضروری ہے",
    ar: "هذا الحقل مطلوب",
    fa: "این فیلد الزامی است",
    ps: "دا ساحه ضروري ده",
  },
  loading: {
    en: "Loading form...", ur: "فارم لوڈ ہو رہا ہے...", ar: "جار تحميل النموذج...", fa: "در حال بارگیری فرم...", ps: "فورم پورته کیږي...",
  },
  poweredBy: {
    en: "Powered by DGT ERP", ur: "DGT ERP کی طرف سے", ar: "مدعوم من DGT ERP", fa: "با پشتیبانی DGT ERP", ps: "د DGT ERP لخوا",
  },
};

function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? dict[key]?.["en"] ?? key;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "24px 16px 48px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
  },
  card: {
    width: "100%",
    maxWidth: 680,
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "36px 32px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
  },
  logo: {
    width: 56, height: 56, borderRadius: 14,
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 24, fontWeight: 700, color: "#fff",
    marginBottom: 20,
    boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
  },
  pageTitle: {
    color: "#f8fafc", fontSize: 26, fontWeight: 700,
    marginBottom: 8, lineHeight: 1.3,
  },
  pageSubtitle: {
    color: "#94a3b8", fontSize: 14, marginBottom: 28, lineHeight: 1.6,
  },
  langRow: {
    display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 28,
  },
  langBtn: (active: boolean) => ({
    padding: "6px 14px",
    borderRadius: 20,
    border: active ? "1.5px solid #6366f1" : "1.5px solid rgba(255,255,255,0.15)",
    background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
    color: active ? "#a5b4fc" : "#94a3b8",
    cursor: "pointer",
    fontSize: 13, fontWeight: active ? 600 : 400,
    transition: "all 0.2s",
  }),
  sectionTitle: {
    color: "#e2e8f0", fontSize: 18, fontWeight: 600,
    marginBottom: 24,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  fieldGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 20px",
    marginBottom: 0,
  },
  fieldFull: {
    gridColumn: "1 / -1" as const,
  },
  label: {
    display: "block",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#f1f5f9",
    fontSize: 14,
    outline: "none",
    resize: "vertical" as const,
    minHeight: 80,
    boxSizing: "border-box" as const,
  },
  submitBtn: (loading: boolean) => ({
    width: "100%",
    padding: "14px 24px",
    marginTop: 28,
    background: loading
      ? "rgba(99,102,241,0.5)"
      : "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
  }),
  successBox: {
    textAlign: "center" as const,
    padding: "40px 20px",
  },
  successIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  successTitle: {
    color: "#4ade80",
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 12,
  },
  successMsg: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 460,
    margin: "0 auto",
  },
  errorBox: {
    textAlign: "center" as const,
    padding: "60px 20px",
  },
  errorIcon: { fontSize: 64, marginBottom: 20 },
  errorTitle: {
    color: "#f87171",
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 10,
  },
  errorMsg: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.7,
  },
  footer: {
    color: "#475569",
    fontSize: 12,
    textAlign: "center" as const,
    marginTop: 28,
  },
};

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  dir = "ltr",
  required = false,
  full = false,
  as: As = "input",
  options,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
  full?: boolean;
  as?: "input" | "textarea" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = `ef-${name}`;
  return (
    <div style={full ? styles.fieldFull : {}}>
      <label htmlFor={id} style={styles.label}>
        {label}
      </label>
      {As === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...styles.select, direction: dir }}
          required={required}
        >
          <option value="">—</option>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : As === "textarea" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...styles.textarea, direction: dir }}
          required={required}
          placeholder={placeholder}
          dir={dir}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...styles.input, direction: dir }}
          required={required}
          placeholder={placeholder}
          dir={dir}
        />
      )}
    </div>
  );
}

// ─── Form type definitions ────────────────────────────────────────────────────

interface CustomerData {
  fullName: string; firstName: string; lastName: string; fatherName: string;
  gender: string; mobile: string; whatsapp: string; email: string;
  companyName: string; address: string; notes: string; originalLanguage: string;
}

interface CompanyData {
  name: string; legalName: string; ownerName: string; businessType: string;
  mobile: string; email: string; address: string; notes: string; originalLanguage: string;
}

interface EmployeeAgentData {
  fullName: string; firstName: string; lastName: string; fatherName: string;
  gender: string; mobile: string; email: string; designation: string;
  department: string; cnicPassport: string; address: string; notes: string;
  originalLanguage: string;
}

// ─── Sub-forms ───────────────────────────────────────────────────────────────

function CustomerFormFields({
  lang, dir, data, onChange,
}: {
  lang: Lang; dir: "ltr" | "rtl";
  data: CustomerData;
  onChange: (k: keyof CustomerData, v: string) => void;
}) {
  return (
    <div style={styles.fieldGroup}>
      <Field label={t("fullName", lang)} name="fullName" value={data.fullName}
        onChange={(v) => onChange("fullName", v)} dir={dir} required full />
      <Field label={t("firstName", lang)} name="firstName" value={data.firstName}
        onChange={(v) => onChange("firstName", v)} dir={dir} />
      <Field label={t("lastName", lang)} name="lastName" value={data.lastName}
        onChange={(v) => onChange("lastName", v)} dir={dir} />
      <Field label={t("fatherName", lang)} name="fatherName" value={data.fatherName}
        onChange={(v) => onChange("fatherName", v)} dir={dir} />
      <Field label={t("gender", lang)} name="gender" value={data.gender}
        onChange={(v) => onChange("gender", v)} dir={dir} as="select"
        options={[
          { value: "male", label: t("male", lang) },
          { value: "female", label: t("female", lang) },
        ]} />
      <Field label={t("mobile", lang)} name="mobile" value={data.mobile}
        onChange={(v) => onChange("mobile", v)} dir="ltr" type="tel" required />
      <Field label={t("whatsapp", lang)} name="whatsapp" value={data.whatsapp}
        onChange={(v) => onChange("whatsapp", v)} dir="ltr" type="tel" />
      <Field label={t("email", lang)} name="email" value={data.email}
        onChange={(v) => onChange("email", v)} dir="ltr" type="email" />
      <Field label={t("companyName", lang)} name="companyName" value={data.companyName}
        onChange={(v) => onChange("companyName", v)} dir={dir} full />
      <Field label={t("address", lang)} name="address" value={data.address}
        onChange={(v) => onChange("address", v)} dir={dir} as="textarea" full />
      <Field label={t("notes", lang)} name="notes" value={data.notes}
        onChange={(v) => onChange("notes", v)} dir={dir} as="textarea" full />
    </div>
  );
}

function CompanyFormFields({
  lang, dir, data, onChange,
}: {
  lang: Lang; dir: "ltr" | "rtl";
  data: CompanyData;
  onChange: (k: keyof CompanyData, v: string) => void;
}) {
  return (
    <div style={styles.fieldGroup}>
      <Field label={t("companyName", lang) + " *"} name="name" value={data.name}
        onChange={(v) => onChange("name", v)} dir={dir} required full />
      <Field label={t("legalName", lang)} name="legalName" value={data.legalName}
        onChange={(v) => onChange("legalName", v)} dir={dir} full />
      <Field label={t("ownerName", lang)} name="ownerName" value={data.ownerName}
        onChange={(v) => onChange("ownerName", v)} dir={dir} />
      <Field label={t("businessType", lang)} name="businessType" value={data.businessType}
        onChange={(v) => onChange("businessType", v)} dir={dir} />
      <Field label={t("mobile", lang)} name="mobile" value={data.mobile}
        onChange={(v) => onChange("mobile", v)} dir="ltr" type="tel" required />
      <Field label={t("email", lang)} name="email" value={data.email}
        onChange={(v) => onChange("email", v)} dir="ltr" type="email" />
      <Field label={t("address", lang)} name="address" value={data.address}
        onChange={(v) => onChange("address", v)} dir={dir} as="textarea" full />
      <Field label={t("notes", lang)} name="notes" value={data.notes}
        onChange={(v) => onChange("notes", v)} dir={dir} as="textarea" full />
    </div>
  );
}

function EmployeeAgentFormFields({
  lang, dir, data, onChange,
}: {
  lang: Lang; dir: "ltr" | "rtl";
  data: EmployeeAgentData;
  onChange: (k: keyof EmployeeAgentData, v: string) => void;
}) {
  return (
    <div style={styles.fieldGroup}>
      <Field label={t("fullName", lang)} name="fullName" value={data.fullName}
        onChange={(v) => onChange("fullName", v)} dir={dir} required full />
      <Field label={t("firstName", lang)} name="firstName" value={data.firstName}
        onChange={(v) => onChange("firstName", v)} dir={dir} />
      <Field label={t("lastName", lang)} name="lastName" value={data.lastName}
        onChange={(v) => onChange("lastName", v)} dir={dir} />
      <Field label={t("fatherName", lang)} name="fatherName" value={data.fatherName}
        onChange={(v) => onChange("fatherName", v)} dir={dir} />
      <Field label={t("gender", lang)} name="gender" value={data.gender}
        onChange={(v) => onChange("gender", v)} dir={dir} as="select"
        options={[
          { value: "male", label: t("male", lang) },
          { value: "female", label: t("female", lang) },
        ]} />
      <Field label={t("mobile", lang)} name="mobile" value={data.mobile}
        onChange={(v) => onChange("mobile", v)} dir="ltr" type="tel" required />
      <Field label={t("email", lang)} name="email" value={data.email}
        onChange={(v) => onChange("email", v)} dir="ltr" type="email" />
      <Field label={t("designation", lang)} name="designation" value={data.designation}
        onChange={(v) => onChange("designation", v)} dir={dir} />
      <Field label={t("department", lang)} name="department" value={data.department}
        onChange={(v) => onChange("department", v)} dir={dir} />
      <Field label={t("cnicPassport", lang)} name="cnicPassport" value={data.cnicPassport}
        onChange={(v) => onChange("cnicPassport", v)} dir="ltr" />
      <Field label={t("address", lang)} name="address" value={data.address}
        onChange={(v) => onChange("address", v)} dir={dir} as="textarea" full />
      <Field label={t("notes", lang)} name="notes" value={data.notes}
        onChange={(v) => onChange("notes", v)} dir={dir} as="textarea" full />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExtFormClient({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [linkMeta, setLinkMeta] = useState<{
    formType: string; createdByName: string | null; expiresAt: string | null;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form data states
  const [customerData, setCustomerData] = useState<CustomerData>({
    fullName: "", firstName: "", lastName: "", fatherName: "",
    gender: "", mobile: "", whatsapp: "", email: "",
    companyName: "", address: "", notes: "", originalLanguage: "en",
  });
  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "", legalName: "", ownerName: "", businessType: "",
    mobile: "", email: "", address: "", notes: "", originalLanguage: "en",
  });
  const [empAgentData, setEmpAgentData] = useState<EmployeeAgentData>({
    fullName: "", firstName: "", lastName: "", fatherName: "",
    gender: "", mobile: "", email: "", designation: "", department: "",
    cnicPassport: "", address: "", notes: "", originalLanguage: "en",
  });

  // Detect token metadata on mount
  useEffect(() => {
    fetch(`/api/public/form-link/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data) {
          setLinkMeta(json.data);
        } else {
          setPageError(json.error ?? "Link error");
        }
      })
      .catch(() => setPageError("Network error"))
      .finally(() => setInitialLoading(false));
  }, [token]);

  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "ltr";

  const handleLangChange = useCallback(
    (code: Lang) => {
      setLang(code);
      setCustomerData((d) => ({ ...d, originalLanguage: code }));
      setCompanyData((d) => ({ ...d, originalLanguage: code }));
      setEmpAgentData((d) => ({ ...d, originalLanguage: code }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!linkMeta) return;
      setSubmitting(true);
      setSubmitError(null);

      let payload: Record<string, unknown> = {};
      const ft = linkMeta.formType;

      if (ft === "customer") {
        payload = {
          ...customerData,
          customerName: customerData.fullName,
          originalLanguage: lang,
        };
      } else if (ft === "company") {
        payload = { ...companyData, originalLanguage: lang };
      } else {
        payload = {
          ...empAgentData,
          originalLanguage: lang,
        };
      }

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
          setSubmitError(json.error ?? "Submission failed");
        }
      } catch {
        setSubmitError("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [linkMeta, customerData, companyData, empAgentData, lang, token]
  );

  const formTitle = linkMeta
    ? t(
        linkMeta.formType === "customer"
          ? "customerForm"
          : linkMeta.formType === "company"
          ? "companyForm"
          : linkMeta.formType === "employee"
          ? "employeeForm"
          : "agentForm",
        lang
      )
    : "";

  return (
    <div style={styles.page} dir={dir}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>D</div>

        {/* Loading */}
        {initialLoading && (
          <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
            <div>{t("loading", lang)}</div>
          </div>
        )}

        {/* Invalid / expired / used link */}
        {!initialLoading && pageError && (
          <div style={styles.errorBox}>
            <div style={styles.errorIcon}>🔒</div>
            <div style={styles.errorTitle}>{t("errorInvalid", lang)}</div>
            <div style={styles.errorMsg}>{pageError}</div>
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✅</div>
            <div style={styles.successTitle}>{t("successTitle", lang)}</div>
            <div style={styles.successMsg}>{t("successMsg", lang)}</div>
          </div>
        )}

        {/* Form */}
        {!initialLoading && !pageError && !submitted && linkMeta && (
          <>
            {/* Header */}
            <div style={styles.pageTitle} dir={dir}>{t("pageTitle", lang)}</div>
            <div style={styles.pageSubtitle} dir={dir}>{t("pageSubtitle", lang)}</div>

            {/* Language Selector */}
            <div style={{ marginBottom: 6, color: "#64748b", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {t("selectLanguage", lang)}
            </div>
            <div style={styles.langRow}>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleLangChange(l.code)}
                  style={styles.langBtn(lang === l.code)}
                >
                  {l.nativeName}
                </button>
              ))}
            </div>

            {/* Form Section Title */}
            <div style={styles.sectionTitle} dir={dir}>{formTitle}</div>

            {/* Created by info */}
            {linkMeta.createdByName && (
              <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 24, color: "#a5b4fc", fontSize: 13 }} dir={dir}>
                📤 {lang === "ur" ? "یہ فارم بھیجا گیا ہے از:" : lang === "ar" ? "أرسل هذا النموذج من قِبَل:" : lang === "fa" ? "این فرم توسط:" : lang === "ps" ? "دا فورم لیږل شوی د:" : "Shared by:"} {linkMeta.createdByName}
              </div>
            )}

            {/* The correct sub-form */}
            <form onSubmit={handleSubmit} dir={dir}>
              {linkMeta.formType === "customer" && (
                <CustomerFormFields
                  lang={lang} dir={dir}
                  data={customerData}
                  onChange={(k, v) => setCustomerData((d) => ({ ...d, [k]: v }))}
                />
              )}
              {linkMeta.formType === "company" && (
                <CompanyFormFields
                  lang={lang} dir={dir}
                  data={companyData}
                  onChange={(k, v) => setCompanyData((d) => ({ ...d, [k]: v }))}
                />
              )}
              {(linkMeta.formType === "employee" || linkMeta.formType === "agent") && (
                <EmployeeAgentFormFields
                  lang={lang} dir={dir}
                  data={empAgentData}
                  onChange={(k, v) => setEmpAgentData((d) => ({ ...d, [k]: v }))}
                />
              )}

              {submitError && (
                <div style={{ color: "#f87171", fontSize: 13, marginTop: 16, padding: "10px 14px", background: "rgba(248,113,113,0.1)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)" }}>
                  ⚠️ {submitError}
                </div>
              )}

              <button type="submit" style={styles.submitBtn(submitting)} disabled={submitting}>
                {submitting ? t("submitting", lang) : t("submit", lang)}
              </button>
            </form>
          </>
        )}

        {/* Footer */}
        <div style={styles.footer}>{t("poweredBy", lang)}</div>
      </div>
    </div>
  );
}
