"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Printer,
  FileText,
  Building2,
  MapPin,
  Calendar,
  BadgeDollarSign,
  Clock,
  ShieldCheck,
  Layers,
  Sparkles,
  UserPlus,
  Phone,
  Mail
} from "lucide-react";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { PersonPicker } from "./person-picker";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";

type EmployeeFormProps = {
  employeeId?: string | null;
  /** Called after a successful create/update. `newEmployeeId` is the created/updated
   * employee's id — callers that embed this form to pick-and-create-on-the-fly (e.g. the
   * User Registration wizard) use it to auto-select the new row without a second lookup. */
  onSave: (newEmployeeId?: string) => void;
  onCancel: () => void;
  /** Active language from the host page. When this form is rendered inside a modal, the shared
   * useActiveLanguage() store can lag behind the page's resolved language, so hosts that already
   * know the language pass it here; we reconcile (prefer a non-"en" explicit value). */
  lang?: SupportedLanguage;
};

const CATEGORY_DEFAULTS: Record<string, Record<string, { designation: string; department: string }>> = {
  en: {
    "Country Owner": { designation: "Country Director / Managing Partner", department: "Executive Management" },
    "Branch Owner": { designation: "Branch Managing Director", department: "Branch Administration" },
    "Company Owner": { designation: "Chief Executive Officer / Owner", department: "Executive Board" },
    "Manager": { designation: "General Operations Manager", department: "Operations & Management" },
    "Normal Staff": { designation: "Senior Office Associate", department: "General Administration" },
    "Employee": { designation: "Executive Staff Officer", department: "General Operations" },
    "Others": { designation: "General Staff Officer", department: "Operations" }
  },
  ur: {
    "Country Owner": { designation: "کنٹری ڈائریکٹر / مینجنگ پارٹنر", department: "ایگزیکٹو مینجمنٹ" },
    "Branch Owner": { designation: "برانچ مینجنگ ڈائریکٹر", department: "برانچ ایڈمنسٹریشن" },
    "Company Owner": { designation: "چیف ایگزیکٹو آفیسر / اونر", department: "ایگزیکٹو بورڈ" },
    "Manager": { designation: "جنرل آپریشنز منیجر", department: "آپریشنز و مینجمنٹ" },
    "Normal Staff": { designation: "سینئر آفس ایسوسی ایٹ", department: "جنرل ایڈمنسٹریشن" },
    "Employee": { designation: "ایگزیکٹو اسٹاف آفیسر", department: "جنرل آپریشنز" },
    "Others": { designation: "جنرل اسٹاف آفیسر", department: "آپریشنز" }
  },
  ps: {
    "Country Owner": { designation: "د هیواد مدیر / ملګری", department: "اجرایوي اداره" },
    "Branch Owner": { designation: "د څانګې مدیر", department: "د څانګې اداره" },
    "Company Owner": { designation: "اجرایوي مشر / مالک", department: "اجرایوي بورډ" },
    "Manager": { designation: "عمومي عملیاتي مدیر", department: "عملیات او مدیریت" },
    "Normal Staff": { designation: "لوړپوړی دفتري همکار", department: "عمومي اداره" },
    "Employee": { designation: "اجرایوي کارمند", department: "عمومي عملیات" },
    "Others": { designation: "عمومي کارمند", department: "عملیات" }
  },
  fa: {
    "Country Owner": { designation: "مدیر کشوری / شریک مدیر", department: "مدیریت اجرایی" },
    "Branch Owner": { designation: "مدیر عامل شعبه", department: "امور اداری شعبه" },
    "Company Owner": { designation: "مدیرعامل / مالک شرکت", department: "هیئت اجرایی" },
    "Manager": { designation: "مدیر عملیات عمومی", department: "عملیات و مدیریت" },
    "Normal Staff": { designation: "کارشناس ارشد دفتر", department: "امور اداری عمومی" },
    "Employee": { designation: "افسر اجرایی پرسنل", department: "عملیات عمومی" },
    "Others": { designation: "افسر عمومی پرسنل", department: "عملیات" }
  },
  ar: {
    "Country Owner": { designation: "المدير الإقليمي / شريك إداري", department: "الإدارة التنفيذية" },
    "Branch Owner": { designation: "المدير الإداري للفرع", department: "إدارة الفرع" },
    "Company Owner": { designation: "الرئيس التنفيذي / المالك", department: "المجلس التنفيذي" },
    "Manager": { designation: "مدير العمليات العامة", department: "العمليات والإدارة" },
    "Normal Staff": { designation: "أخصائي مكتب أول", department: "الإدارة العامة" },
    "Employee": { designation: "مسؤول تنفيذي", department: "العمليات العامة" },
    "Others": { designation: "موظف عام", department: "العمليات" }
  }
};

const hrLabels: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  "Live Employee Master Report": { ur: "ملازم ماسٹر لائیو رپورٹ", ar: "تقرير الموظف المباشر", fa: "گزارش زنده مشخصات کارمند", ps: "د کارمند اصلي ژوندی راپور" },
  "No Person Selected": { ur: "کوئی شخص منتخب نہیں", ar: "لم يتم اختيار شخص", fa: "هیچ فردی انتخاب نشده", ps: "هیڅ شخص نه دی ټاکل شوی" },
  "Location & Branch": { ur: "مقام اور برانچ کے اختیارات", ar: "الموقع والفرع", fa: "موقعیت و شعبه", ps: "موقعیت او څانګه" },
  "Contact Details": { ur: "رابطے کی تفصیلات", ar: "تفاصيل الاتصال", fa: "اطلاعات تماس", ps: "د اړیکې معلومات" },
  "Shift & Timelines": { ur: "ڈیوٹی اوقات و شیڈول", ar: "أوقات العمل والجدول", fa: "شیفت و زمان‌بندی", ps: "دندې وختونه او مهالوېش" },
  "Salary / Compensation": { ur: "تنخواہ و مالی معاوضہ", ar: "الراتب والمستحقات", fa: "حقوق و مزایا", ps: "معاش او مالي امتیازات" },
  "Country: -": { ur: "ملک: منتخب نہیں", ar: "الدولة: غير محدد", fa: "کشور: نامشخص", ps: "هیواد: نه دی ټاکل شوی" },
  "Main Branch: -": { ur: "مین برانچ: منتخب نہیں", ar: "الفرع الرئيسي: غير محدد", fa: "شعبه اصلی: نامشخص", ps: "مرکزي څانګه: نه ده ټاکل شوې" },
  "City Branch: -": { ur: "سٹی برانچ: منتخب نہیں", ar: "فرع المدينة: غير محدد", fa: "شعبه شهری: نامشخص", ps: "ښاري څانګه: نه ده ټاکل شوې" },
  "Shift": { ur: "شفٹ", ar: "الوردية", fa: "شیفت", ps: "شفټ" },
  "Joining": { ur: "شمولیت", ar: "تاريخ الالتحاق", fa: "تاریخ استخدام", ps: "ګډون" },
  "Day Shift": { ur: "دن کی شفٹ", ar: "وردية نهارية", fa: "شیفت روز", ps: "د ورځې شفټ" },
  "Night Shift": { ur: "رات کی شفٹ", ar: "وردية ليلية", fa: "شیفت شب", ps: "د شپې شفټ" },
  "Rotational": { ur: "گردشی شفٹ", ar: "وردية دورية", fa: "شیفت چرخشی", ps: "ګرځنده شفټ" },
  "Flexible": { ur: "لچکدار اوقات", ar: "مرن", fa: "انعطاف‌پذیر", ps: "نرم" },
  "Monthly": { ur: "ماہانہ", ar: "شهري", fa: "ماهانه", ps: "میاشتنی" },
  "Daily": { ur: "روزانہ", ar: "يومي", fa: "روزانه", ps: "ورځنی" },
  "Weekly": { ur: "ہفتہ وار", ar: "أسبوعي", fa: "هفتگی", ps: "اونیز" },
  "Hourly": { ur: "فی گھنٹہ", ar: "بالساعة", fa: "ساعتی", ps: "ساعتي" },
  "Rate": { ur: "شرح", ar: "معدل", fa: "نرخ", ps: "کچه" },
  "Step 1 Packet: Employee Category & Person Selection": { ur: "مرحلہ 1: ملازم زمرہ اور شخص کا انتخاب", ar: "المرحلة 1: فئة الموظف واختيار الشخص", fa: "مرحله 1: دسته کارمند و انتخاب شخص", ps: "لومړی پړاو: د کارمند کټګوري او شخص ټاکنه" },
  "Step 2 Packet: Location Scope, Branch & Hierarchy": { ur: "مرحلہ 2: مقام، برانچ اور تنظیمی درجہ بندی", ar: "المرحلة 2: نطاق الموقع والفرع والتسلسل", fa: "مرحله 2: موقعیت، شعبه و سلسله‌مراتب", ps: "دویم پړاو: موقعیت او څانګه" },
  "Step 3 Packet: Employment Type, Shift & Duty Schedule": { ur: "مرحلہ 3: ملازمت کی قسم، شفٹ اور ڈیوٹی شیڈول", ar: "المرحلة 3: نوع التوظيف والوردية وجدول الدوام", fa: "مرحله 3: نوع استخدام، شیفت و برنامه کاری", ps: "دریم پړاو: د کار ډول، شفټ او دندې مهالوېش" },
  "Step 4 Packet: Salary, Allowances & GL Ledgers": { ur: "مرحلہ 4: تنخواہ، الاؤنسز اور جی ایل کھاتہ جات", ar: "المرحلة 4: الراتب والبدلات ودفتر الأستاذ", fa: "مرحله 4: حقوق، مزایا و دفاتر کل", ps: "څلورم پړاو: معاش، الاونسونه او د حساب کتاب" },
  "Step 5 Packet: Verification, Documents & Final Review": { ur: "مرحلہ 5: حتمی تصدیق، دستاویزات اور جائزہ", ar: "المرحلة 5: التحقق والمستندات والمراجعة النهائية", fa: "مرحله 5: تأیید نهایی، مدارک و بررسی", ps: "پنځم پړاو: وروستۍ تصدیق، اسناد او بیاکتنه" },
  "Step 1: Category & Identity": { ur: "مرحلہ 1: زمرہ اور شناخت", ar: "المرحلة 1: الفئة والهوية", fa: "مرحله 1: دسته‌بندی و هویت", ps: "لومړی پړاو: کټګوري او پېژندنه" },
  "Step 2: Location & Scopes": { ur: "مرحلہ 2: مقام اور اختیارات", ar: "المرحلة 2: الموقع والنطاقات", fa: "مرحله 2: موقعیت و اختیارات", ps: "دویم پړاو: موقعیت او څانګې" },
  "Step 3: Timelines & Shift": { ur: "مرحلہ 3: اوقات اور شفٹ", ar: "المرحلة 3: المواعيد والوردية", fa: "مرحله 3: زمان‌بندی و شیفت", ps: "دریم پړاو: مهال وېش او شفټ" },
  "Step 4: Salary & Accounts": { ur: "مرحلہ 4: تنخواہ اور کھاتے", ar: "المرحلة 4: الراتب والحسابات", fa: "مرحله 4: حقوق و حساب‌ها", ps: "څلورم پړاو: معاش او حسابونه" },
  "Step 5: Entry Verification Report": { ur: "مرحلہ 5: انٹری تصدیقی رپورٹ", ar: "المرحلة 5: تقرير التحقق", fa: "مرحله 5: گزارش تأیید ثبت", ps: "پنځم پړاو: د ثبت تصدیقي راپور" },
  "Enterprise Employee Registration Wizard": { ur: "انٹرپرائز ملازم رجسٹریشن وزرڈ", ar: "معالج تسجيل موظفي المؤسسة", fa: "ویزارد ثبت سازمانی پرسنل", ps: "د سازماني کارمندانو ثبتولو وزرډ" },
  "Register New Employee Master Record": { ur: "نیا ملازم ماسٹر ریکارڈ رجسٹر کریں", ar: "تسجيل سجل موظف رئيسي جديد", fa: "ثبت پرونده اصلی کارمند جدید", ps: "د نوي کارمند اصلي ریکارډ ثبت کړئ" },
  "Edit Employee Master Setup": { ur: "ملازم ماسٹر سیٹ اپ میں ترمیم کریں", ar: "تعديل إعدادات الموظف الرئيسية", fa: "ویرایش تنظیمات اصلی کارمند", ps: "د کارمند اصلي تنظیم سم کړئ" },
  "Executive Partner (Fixed Salary N/A / Optional)": { ur: "پارٹنر ایکویٹی و ڈرائنگ (فکسڈ تنخواہ لاگو نہیں)", ar: "شريك تنفيذي (الراتب الثابت غير منطبق / اختياري)", fa: "شریک اجرایی (حقوق ثابت نامربوط / اختیاری)", ps: "اجرایوي ملګری (ثابت معاش نه تطبیقیږي / اختیاري)" }
};

function translateHr(label: string, lang: SupportedLanguage): string {
  if (!label) return "";
  if (lang === "en") return label;
  return hrLabels[label]?.[lang] || label;
}

type LedgerOption = {
  id: string;
  name: string;
  code: string;
  currency: string;
};

type CountryOption = {
  id: string;
  name: string;
  currency_code: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
  country_branch_id?: string | null;
};

export function EmployeeForm({ employeeId, onSave, onCancel, lang: langProp }: EmployeeFormProps) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  // Prefer an explicit non-"en" language from the host; otherwise follow the reactive store.
  const lang = (langProp && langProp !== "en") ? langProp : activeLang;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Core fields
  const [personMasterId, setPersonMasterId] = useState("");
  const [loadedPerson, setLoadedPerson] = useState<any>(null);
  // Structured person identity. Populated from the selected person master, editable here,
  // and synced back to the person master (customers) on save. Full name is derived from these.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState<"Country Owner" | "Branch Owner" | "Company Owner" | "Manager" | "Normal Staff" | "Employee" | "Others">("Employee");
  const [designation, setDesignation] = useState(() => (CATEGORY_DEFAULTS[lang]?.[category] || CATEGORY_DEFAULTS.en[category])?.designation || "");
  const [department, setDepartment] = useState(() => (CATEGORY_DEFAULTS[lang]?.[category] || CATEGORY_DEFAULTS.en[category])?.department || "");

  // Location scopes
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");

  // Timelines
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [probationStartDate, setProbationStartDate] = useState("");
  const [probationEndDate, setProbationEndDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [jobStatus, setJobStatus] = useState("Probation");
  const [workingShift, setWorkingShift] = useState("Day Shift");
  const [dutyStartTime, setDutyStartTime] = useState("09:00");
  const [dutyEndTime, setDutyEndTime] = useState("18:00");
  const [weeklyOffDay, setWeeklyOffDay] = useState("Sunday");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [status, setStatus] = useState("Active");

  // Salary components
  const [salaryType, setSalaryType] = useState("Monthly");
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [accommodationAllowance, setAccommodationAllowance] = useState<number>(0);
  const [transportAllowance, setTransportAllowance] = useState<number>(0);
  const [foodAllowance, setFoodAllowance] = useState<number>(0);
  const [mobileAllowance, setMobileAllowance] = useState<number>(0);
  const [otherAllowance, setOtherAllowance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);
  const [taxDeduction, setTaxDeduction] = useState<number>(0);

  // Account integration links
  const [salaryExpenseAccountId, setSalaryExpenseAccountId] = useState("");
  const [employeePayableAccountId, setEmployeePayableAccountId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [advanceSalaryAccountId, setAdvanceSalaryAccountId] = useState("");
  const [loanAccountId, setLoanAccountId] = useState("");
  const [deductionAccountId, setDeductionAccountId] = useState("");

  // Select Options Lists
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchOption[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [personsList, setPersonsList] = useState<any[]>([]);

  // Load select lists
  useEffect(() => {
    async function loadSelectData() {
      try {
        const countriesRes = await apiGet<{ countries: any[] }>("/api/erp/locations/countries");
        setCountries(countriesRes.countries || []);

        const managersRes = await apiGet<{ employees: any[] }>("/api/erp/hr-payroll/employees?category=Manager");
        setManagers(managersRes.employees || []);

        const ledgersRes = await apiGet<{ ledgers: any[] }>("/api/erp/ledgers");
        setLedgers(ledgersRes.ledgers || []);

        const personsRes = await apiGet<{ customers: any[] }>("/api/erp/customers?type=person");
        if (personsRes && personsRes.customers) {
          setPersonsList(personsRes.customers);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSelectData();
  }, []);

  // Fetch branches when country changes
  useEffect(() => {
    if (!countryId) {
      setBranches([]);
      setCountryBranchId("");
      setCityBranches([]);
      setCityBranchId("");
      return;
    }
    async function loadBranches() {
      try {
        const res: any = await apiGet(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(countryId)}`);
        const list = Array.isArray(res?.data?.branches) ? res.data.branches : Array.isArray(res?.branches) ? res.branches : [];
        setBranches(list);
        if (list.length > 0) {
          setCountryBranchId((prev: string) => (list.some((b: any) => b.id === prev) ? prev : list[0].id));
        } else {
          setCountryBranchId("");
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, [countryId]);

  // Fetch city branches when country or main branch changes
  useEffect(() => {
    if (!countryId) {
      setCityBranches([]);
      setCityBranchId("");
      return;
    }
    async function loadCityBranches() {
      try {
        const url = `/api/erp/locations/branches/city?countryId=${encodeURIComponent(countryId)}${countryBranchId ? `&countryBranchId=${encodeURIComponent(countryBranchId)}` : ""}`;
        const res: any = await apiGet(url);
        const list = Array.isArray(res?.data?.cityBranches) ? res.data.cityBranches : Array.isArray(res?.cityBranches) ? res.cityBranches : [];
        setCityBranches(list);
        if (list.length > 0) {
          setCityBranchId((prev: string) => (list.some((cb: any) => cb.id === prev) ? prev : list[0].id));
        } else {
          setCityBranchId("");
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCityBranches();
  }, [countryId, countryBranchId]);

  // Auto-sync countryBranchId if a city branch with parent branch is selected
  useEffect(() => {
    if (cityBranchId && cityBranches.length > 0) {
      const selectedCb = cityBranches.find((cb) => cb.id === cityBranchId);
      if (selectedCb?.country_branch_id && selectedCb.country_branch_id !== countryBranchId) {
        setCountryBranchId(selectedCb.country_branch_id);
      }
    }
  }, [cityBranchId, cityBranches, countryBranchId]);

  // Fetch employee details if editing
  useEffect(() => {
    if (!employeeId) return;
    async function loadEmployee() {
      setLoading(true);
      try {
        const res = await apiGet<{ employee: any }>(`/api/erp/hr-payroll/employees/${employeeId}`);
        if (res.employee) {
          const emp = res.employee;
          setPersonMasterId(emp.person_master_id);
          setCategory(emp.category || "Employee");
          setDesignation(emp.designation || "");
          setDepartment(emp.department || "");
          setCountryId(emp.country_id || "");
          setCountryBranchId(emp.country_branch_id || "");
          setCityBranchId(emp.city_branch_id || "");
          setReportingManagerId(emp.reporting_manager_id || "");
          setJoiningDate(emp.joining_date || "");
          setProbationStartDate(emp.probation_start_date || "");
          setProbationEndDate(emp.probation_end_date || "");
          setEmploymentType(emp.employment_type || "Full-time");
          setJobStatus(emp.job_status || "Probation");
          setWorkingShift(emp.working_shift || "Day Shift");
          setDutyStartTime(emp.duty_start_time || "09:00");
          setDutyEndTime(emp.duty_end_time || "18:00");
          setWeeklyOffDay(emp.weekly_off_day || "Sunday");
          setContractStartDate(emp.contract_start_date || "");
          setContractEndDate(emp.contract_end_date || "");
          setStatus(emp.status || "Active");

          setSalaryType(emp.salary_type || "Monthly");
          setBasicSalary(emp.basic_salary || emp.monthly_salary || 0);
          setSalaryCurrency(emp.salary_currency || "USD");
          setAccommodationAllowance(emp.accommodation_allowance || 0);
          setTransportAllowance(emp.transport_allowance || 0);
          setFoodAllowance(emp.food_allowance || 0);
          setMobileAllowance(emp.mobile_allowance || 0);
          setOtherAllowance(emp.other_allowance || 0);
          setDeduction(emp.deduction || 0);
          setTaxDeduction(emp.tax_deduction || 0);

          setSalaryExpenseAccountId(emp.salary_expense_account_id || "");
          setEmployeePayableAccountId(emp.employee_payable_account_id || "");
          setCashAccountId(emp.cash_account_id || "");
          setBankAccountId(emp.bank_account_id || "");
          setAdvanceSalaryAccountId(emp.advance_salary_account_id || "");
          setLoanAccountId(emp.loan_account_id || "");
          setDeductionAccountId(emp.deduction_account_id || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadEmployee();
  }, [employeeId]);

  // Calculations
  const totalAllowances = Number(accommodationAllowance) + Number(transportAllowance) + Number(foodAllowance) + Number(mobileAllowance) + Number(otherAllowance);
  const netSalary = Math.max(0, Number(basicSalary) + totalAllowances - Number(deduction) - Number(taxDeduction));

  // Fetch person master dynamically whenever personMasterId changes
  useEffect(() => {
    if (!personMasterId) {
      setLoadedPerson(null);
      setFirstName("");
      setLastName("");
      setGender("");
      return;
    }
    let alive = true;
    apiGet<{ customer?: any }>(`/api/erp/customers/${encodeURIComponent(personMasterId)}?lang=${encodeURIComponent(lang)}`)
      .then((res) => {
        if (!alive || !res?.customer) return;
        setLoadedPerson(res.customer);
        const p = res.customer;
        if (p.first_name || p.last_name) {
          setFirstName(p.first_name || "");
          setLastName(p.last_name || "");
        } else if (p.customer_name) {
          const parts = p.customer_name.trim().split(/\s+/);
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
        if (p.gender) setGender(p.gender);
        if (p.country_id && !countryId) setCountryId(p.country_id);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [personMasterId, lang]);

  const selectedPersonObj = useMemo(() => {
    return loadedPerson || personsList.find((p) => p.id === personMasterId) || null;
  }, [loadedPerson, personsList, personMasterId]);
  const selectedCountryObj = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranchObj = useMemo(() => branches.find((b) => b.id === countryBranchId) ?? null, [branches, countryBranchId]);
  const selectedCityBranchObj = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);
  const selectedManagerObj = useMemo(() => managers.find((m) => m.id === reportingManagerId) ?? null, [managers, reportingManagerId]);

  // Real linked User / Role / Permissions + Documents for the selected person (Step 5 sections).
  const [personDetail, setPersonDetail] = useState<any>(null);
  useEffect(() => {
    if (!personMasterId) { setPersonDetail(null); return; }
    let alive = true;
    apiGet<any>(`/api/erp/general-office/person-detail?id=${encodeURIComponent(personMasterId)}`)
      .then((r) => { if (alive) setPersonDetail(r); })
      .catch(() => { if (alive) setPersonDetail(null); });
    return () => { alive = false; };
  }, [personMasterId]);

  // Full name is always derived from the structured fields, falling back to the stored display name.
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || (selectedPersonObj?.customer_name || "");

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!personMasterId) {
      alert(t(lang, "hr.select_person_first", "Please select or add an Employee / Person Name first."));
      setActiveStep(1);
      return;
    }

    setSaving(true);
    const payload = {
      personMasterId,
      category,
      designation,
      department,
      countryId,
      countryBranchId,
      cityBranchId,
      reportingManagerId,
      joiningDate,
      probationStartDate,
      probationEndDate,
      employmentType,
      jobStatus,
      workingShift,
      dutyStartTime,
      dutyEndTime,
      weeklyOffDay,
      contractStartDate,
      contractEndDate,
      status,

      salaryType,
      basicSalary,
      salaryCurrency,
      monthlySalary: salaryType === "Monthly" ? basicSalary : 0,
      dailySalary: salaryType === "Daily" ? basicSalary : 0,
      hourlySalary: salaryType === "Hourly" ? basicSalary : 0,
      allowance: totalAllowances,
      accommodationAllowance,
      transportAllowance,
      foodAllowance,
      mobileAllowance,
      otherAllowance,
      deduction,
      taxDeduction,
      netSalary,
      salaryStartDate: joiningDate,
      salaryPaymentMethod: bankAccountId ? "Bank" : "Cash",
      salarySchedule: "Monthly",

      salaryExpenseAccountId,
      employeePayableAccountId,
      cashAccountId,
      bankAccountId,
      advanceSalaryAccountId,
      loanAccountId,
      deductionAccountId
    };

    try {
      // Persist the structured identity back to the person master (customers) so First/Last/Full
      // Name stay canonical and synced across the selector, wizard, table and Print/PDF (item 4).
      const personCountryId = selectedPersonObj?.country_id || countryId;
      if (personMasterId && personCountryId && (firstName.trim() || lastName.trim())) {
        try {
          await apiPatch(`/api/erp/customers/${personMasterId}`, {
            countryId: personCountryId,
            customerName: fullName,
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            gender: gender || null
          });
        } catch { /* non-fatal — the employee still saves even if the master sync fails */ }
      }

      let savedId = employeeId ?? undefined;
      if (employeeId) {
        await apiPatch(`/api/erp/hr-payroll/employees/${employeeId}`, payload);
      } else {
        const result = await apiPost<{ employee?: { id?: string } }>("/api/erp/hr-payroll/employees", payload);
        savedId = result?.employee?.id;
      }
      onSave(savedId);
    } catch (err: any) {
      alert(t(lang, "hr.error_saving_profile", "Error saving employee profile: ") + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Central-dictionary labels only — no per-component machine translation.
  const CAT_KEYS: Record<string, string> = { 
    "Country Owner": "hr.f_cat_country_owner",
    "Branch Owner": "hr.f_cat_branch_owner",
    "Company Owner": "hr.f_cat_company_owner",
    "Manager": "hr.f_cat_manager", 
    "Normal Staff": "hr.f_cat_normal_staff", 
    "Employee": "hr.f_cat_employee", 
    "Others": "hr.f_cat_others" 
  };
  const catLabel = (c: string) => {
    if (lang === "ur") {
      if (c === "Country Owner") return "👑 کنٹری اونر / ہیڈ";
      if (c === "Branch Owner") return "🏛️ برانچ اونر / منیجر";
      if (c === "Company Owner") return "🏢 کمپنی اونر";
      if (c === "Manager") return "👔 منیجر";
      if (c === "Normal Staff") return "👥 اسٹاف";
      if (c === "Employee") return "💼 ملازم";
      if (c === "Others") return "دیگر";
    } else if (lang === "ps") {
      if (c === "Country Owner") return "👑 د هیواد مالک / مشر";
      if (c === "Branch Owner") return "🏛️ د څانګې مالک / مدیر";
      if (c === "Company Owner") return "🏢 د شرکت مالک";
      if (c === "Manager") return "👔 مدیر";
      if (c === "Normal Staff") return "👥 کارمندان";
      if (c === "Employee") return "💼 کارمند";
      if (c === "Others") return "نور";
    } else if (lang === "fa") {
      if (c === "Country Owner") return "👑 مالک کشوری / رئیس";
      if (c === "Branch Owner") return "🏛️ مالک شعبه / مدیر";
      if (c === "Company Owner") return "🏢 مالک شرکت";
      if (c === "Manager") return "👔 مدیر";
      if (c === "Normal Staff") return "👥 پرسنل";
      if (c === "Employee") return "💼 کارمند";
      if (c === "Others") return "سایر";
    } else if (lang === "ar") {
      if (c === "Country Owner") return "👑 مالك الدولة / رئيس";
      if (c === "Branch Owner") return "🏛️ مالك الفرع / مدير";
      if (c === "Company Owner") return "🏢 مالك الشركة";
      if (c === "Manager") return "👔 مدير";
      if (c === "Normal Staff") return "👥 طاقم العمل";
      if (c === "Employee") return "💼 موظف";
      if (c === "Others") return "أخرى";
    }
    if (c === "Country Owner") return "👑 Country Owner / Head";
    if (c === "Branch Owner") return "🏛️ Branch Owner / Manager";
    if (c === "Company Owner") return "🏢 Company Owner";
    if (c === "Manager") return "👔 Manager";
    if (c === "Normal Staff") return "👥 Normal Staff";
    if (c === "Employee") return "💼 Employee";
    if (c === "Others") return "Others";
    return c;
  };

  // A4 Employee Master Profile Print/PDF via the shared master-profile engine (item 10).
  function printProfile() {
    const dash = "-";
    const cur = salaryCurrency;
    openMasterProfileReportWindow({
      lang,
      title: t(lang, "hr.f_master_report_card", "Employee Master Profile"),
      subtitle: fullName || t(lang, "hr.f_cat_employee", "Employee"),
      reportTypeLabel: catLabel(category),
      meta: [
        { label: t(lang, "hr.f_full_name", "Full Name"), value: fullName },
        { label: t(lang, "rozrep.country", "Country"), value: selectedCountryObj?.name },
        { label: t(lang, "hr.f_main_branch", "Main Branch"), value: selectedMainBranchObj?.name },
        { label: t(lang, "hr.f_joining_date", "Joining Date"), value: joiningDate }
      ],
      kpis: [
        { label: t(lang, "hr.f_basic_salary", "Basic Salary"), value: `${Number(basicSalary).toLocaleString()} ${cur}`, tone: "current" },
        { label: t(lang, "hr.f_total_allowances", "Total Allowances"), value: `${totalAllowances.toLocaleString()} ${cur}`, tone: "credit" },
        { label: t(lang, "hr.f_deductions", "Deductions"), value: `${(Number(deduction) + Number(taxDeduction)).toLocaleString()} ${cur}`, tone: "debit" },
        { label: t(lang, "hr.f_net_salary", "Net Salary"), value: `${netSalary.toLocaleString()} ${cur}`, tone: "open" }
      ],
      sections: [
        { title: t(lang, "hr.f_sec_identity", "Identity & Contact"), rows: [
          { label: t(lang, "hr.f_first_name", "First Name"), value: firstName || dash },
          { label: t(lang, "hr.f_last_name", "Last Name"), value: lastName || dash },
          { label: t(lang, "hr.f_full_name", "Full Name"), value: fullName || dash },
          { label: t(lang, "hr.f_gender", "Gender"), value: gender || dash },
          { label: t(lang, "hr.pp_mobile_phone", "Mobile Phone"), value: selectedPersonObj?.mobile || dash },
          { label: t(lang, "sed.f_whatsapp", "WhatsApp"), value: selectedPersonObj?.whatsapp || dash },
          { label: t(lang, "hr.pp_email_address", "Email"), value: selectedPersonObj?.email || dash },
          { label: t(lang, "hr.pp_address_location", "Address"), value: selectedPersonObj?.address || dash }
        ] },
        { title: t(lang, "hr.f_sec_employment", "Employment & Designation"), rows: [
          { label: t(lang, "hr.f_lbl_category", "Category"), value: catLabel(category) },
          { label: t(lang, "hr.f_lbl_designation_short", "Designation"), value: designation || dash },
          { label: t(lang, "hr.f_lbl_department", "Department"), value: department || dash },
          { label: t(lang, "hr.f_employment_type", "Employment Type"), value: employmentType || dash },
          { label: t(lang, "hr.f_job_status", "Job Status"), value: jobStatus || dash }
        ] },
        { title: t(lang, "hr.f_sec_location", "Country / Branches"), rows: [
          { label: t(lang, "rozrep.country", "Country"), value: selectedCountryObj?.name || dash },
          { label: t(lang, "hr.f_main_branch", "Main Branch"), value: selectedMainBranchObj?.name || dash },
          { label: t(lang, "hr.f_city_branch", "City Branch"), value: selectedCityBranchObj?.name || dash }
        ] },
        { title: t(lang, "hr.f_sec_shift", "Shift & Attendance"), rows: [
          { label: t(lang, "hr.f_working_shift", "Working Shift"), value: workingShift || dash },
          { label: t(lang, "hr.f_duty_hours", "Duty Hours"), value: (dutyStartTime && dutyEndTime) ? `${dutyStartTime} – ${dutyEndTime}` : dash },
          { label: t(lang, "hr.f_weekly_off", "Weekly Off"), value: weeklyOffDay || dash },
          { label: t(lang, "hr.f_joining_date", "Joining Date"), value: joiningDate || dash }
        ] },
        { title: t(lang, "hr.f_sec_payroll", "Salary & Payroll"), rows: [
          { label: t(lang, "hr.f_salary_type", "Salary Type"), value: salaryType || dash },
          { label: t(lang, "hr.f_basic_salary", "Basic Salary"), value: `${Number(basicSalary).toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_total_allowances", "Total Allowances"), value: `${totalAllowances.toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_net_salary", "Net Salary"), value: `${netSalary.toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_currency", "Currency"), value: cur }
        ] },
        { title: t(lang, "hr.f_sec_status", "Status & Audit"), rows: [
          { label: t(lang, "hr.f_status", "Status"), value: status || dash },
          { label: t(lang, "hr.f_job_status", "Job Status"), value: jobStatus || dash }
        ] }
      ]
    });
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">{t(lang, "hr.f_loading_details", "Loading employee details...")}</div>;
  }

  const stepsList = [
    { number: 1, label: lang === "ur" ? "مرحلہ ۱: زمرہ اور شناخت" : lang === "ps" ? "۱ ګام: کټګوري او هویت" : lang === "fa" ? "مرحله ۱: دسته و هویت" : lang === "ar" ? "الخطوة ۱: الفئة والهوية" : "Step 1: Category & Identity", icon: <UserCheck className="h-4 w-4" /> },
    { number: 2, label: lang === "ur" ? "مرحلہ ۲: لوکیشن اور برانچ" : lang === "ps" ? "۲ ګام: ځای او څانګه" : lang === "fa" ? "مرحله ۲: موقعیت و شعبه" : lang === "ar" ? "الخطوة ۲: الموقع والفرع" : "Step 2: Location & Branch", icon: <MapPin className="h-4 w-4" /> },
    { number: 3, label: lang === "ur" ? "مرحلہ ۳: اوقات اور شفٹ" : lang === "ps" ? "۳ ګام: وخت او شفټ" : lang === "fa" ? "مرحله ۳: زمان و شیفت" : lang === "ar" ? "الخطوة ۳: الدوام والمناوبة" : "Step 3: Timelines & Shift", icon: <Clock className="h-4 w-4" /> },
    { number: 4, label: lang === "ur" ? "مرحلہ ۴: تنخواہ اور کھاتہ" : lang === "ps" ? "۴ ګام: معاش او حساب" : lang === "fa" ? "مرحله ۴: حقوق و حساب" : lang === "ar" ? "الخطوة ۴: الراتب والحساب" : "Step 4: Salary & Accounts", icon: <BadgeDollarSign className="h-4 w-4" /> },
    { number: 5, label: lang === "ur" ? "مرحلہ ۵: تصدیق اور رپورٹ" : lang === "ps" ? "۵ ګام: تایید او راپور" : lang === "fa" ? "مرحله ۵: تأیید و گزارش" : lang === "ar" ? "الخطوة ۵: التدقيق والتقرير" : "Step 5: Verification Report", icon: <FileText className="h-4 w-4" /> }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-card text-card-foreground p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>{t(lang, "hr.f_wizard_title", "Enterprise Employee Registration Wizard")}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            {employeeId ? t(lang, "hr.f_edit_title", "Edit Employee Master Setup") : t(lang, "hr.f_register_title", "Register New Employee Master Record")}
          </h2>
        </div>

        {selectedPersonObj && (
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            {(fullName || t(lang, "hr.f_cat_employee", "Employee"))} ({catLabel(category)})
          </span>
        )}
      </div>

      {/* 5-Step Packets Bar */}
      <div className="grid gap-2 sm:grid-cols-5">
        {stepsList.map((s) => {
          const isActive = activeStep === s.number;
          const isDone = activeStep > s.number;

          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setActiveStep(s.number)}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-start min-h-[52px] transition-all font-sans ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500/30"
                  : isDone
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : isDone
                    ? "bg-slate-900 text-emerald-400 dark:bg-slate-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold leading-tight">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2-Column Split for Steps 1-4, Full-Width for Step 5 */}
      {activeStep < 5 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: PROMINENT LIVE EMPLOYEE MASTER REPORT (6 cols) */}
          <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-4">
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-white via-slate-50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 shadow-lg space-y-4">
              
              {/* Live Report Top Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-sm" />
                  <div>
                    <div className="text-[10px] font-black tracking-widest text-emerald-700 dark:text-emerald-400 uppercase">
                      RECORD TYPE: EMPLOYEE
                    </div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {translateHr("Live Employee Master Report", lang)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                    {catLabel(category)}
                  </span>
                </div>
              </div>

              {/* Identity & Person Profile Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0 uppercase">
                    {(fullName || "?").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                        {fullName || <span className="text-slate-400 font-normal italic">{translateHr("No Person Selected", lang)}</span>}
                      </div>
                      {selectedPersonObj?.person_code && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {selectedPersonObj.person_code}
                        </span>
                      )}
                    </div>

                    {selectedPersonObj?.father_name && (
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        S/O {selectedPersonObj.father_name}
                      </div>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        {designation || "Role / Designation Pending"}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                        {department || "General Operations"}
                      </span>
                    </div>

                    {selectedPersonObj && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        {selectedPersonObj.mobile && (
                          <div className="flex items-center gap-1 truncate" dir="ltr">
                            <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="font-mono">{selectedPersonObj.mobile}</span>
                          </div>
                        )}
                        {selectedPersonObj.email && (
                          <div className="flex items-center gap-1 truncate" dir="ltr">
                            <Mail className="h-3 w-3 text-blue-600 shrink-0" />
                            <span className="truncate">{selectedPersonObj.email}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Packet 2: Location, Branch & Hierarchy */}
              <div className={`p-3 rounded-xl border transition-all ${
                activeStep >= 2
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs"
                  : "bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800/60 opacity-80"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>2. {translateHr("Location & Branch", lang)}</span>
                  </span>
                  {activeStep >= 2 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                      Configured
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">{t(lang, "rozrep.country", "Country")}:</span>
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedCountryObj?.name || <span className="text-slate-400 font-normal">Pending Selection</span>}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">{t(lang, "hr.f_main_branch", "Main Branch")}:</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedMainBranchObj ? selectedMainBranchObj.name : <span className="text-slate-400 font-normal">Default Main</span>}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">{t(lang, "hr.f_city_branch", "City Branch")}:</span>
                    <div className="font-bold text-emerald-700 dark:text-emerald-400 truncate">
                      {selectedCityBranchObj ? selectedCityBranchObj.name : <span className="text-slate-400 font-normal">All Branches</span>}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">{t(lang, "hr.f_reporting_manager", "Reporting Manager")}:</span>
                    <div className="font-bold text-indigo-700 dark:text-indigo-400 truncate">
                      {selectedManagerObj ? `${selectedManagerObj.person?.customer_name || selectedManagerObj.employee_code}` : <span className="text-slate-400 font-normal">Direct to Board</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Packet 3: Timelines, Duty Shift & Hours */}
              <div className={`p-3 rounded-xl border transition-all ${
                activeStep >= 3
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs"
                  : "bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800/60 opacity-80"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    <span>3. {translateHr("Shift & Timelines", lang)}</span>
                  </span>
                  {activeStep >= 3 && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span className="text-slate-500 font-medium">Schedule:</span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                      {employmentType || "Full-time"} | {workingShift || "Day Shift"} | {dutyStartTime || "09:00"} – {dutyEndTime || "18:00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">{translateHr("Joining", lang)}:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{joiningDate || "Immediate"}</span>
                  </div>
                </div>
              </div>

              {/* Packet 4: Salary, Allowances & GL Ledgers */}
              <div className={`p-3 rounded-xl border transition-all ${
                activeStep >= 4
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs"
                  : "bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800/60 opacity-80"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <BadgeDollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span>4. {translateHr("Salary / Compensation", lang)}</span>
                  </span>
                  {activeStep >= 4 && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                      Calculated
                    </span>
                  )}
                </div>

                {category === "Country Owner" || category === "Branch Owner" || category === "Company Owner" ? (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 border border-amber-200 dark:border-amber-900/50 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    👑 {catLabel(category)} · {translateHr("Executive Partner (Fixed Salary N/A / Optional)", lang)}
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Basic ({salaryCurrency})</span>
                        <strong className="text-slate-900 dark:text-slate-100">{Number(basicSalary || 0).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Allowances</span>
                        <strong className="text-emerald-600">+{totalAllowances.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium">Net Payroll</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">{netSalary.toLocaleString()} {salaryCurrency}</strong>
                      </div>
                    </div>

                    {(salaryExpenseAccountId || employeePayableAccountId) && (
                      <div className="pt-1 text-[10px] text-slate-500 space-y-0.5">
                        {salaryExpenseAccountId && (
                          <div className="truncate">GL Expense: <span className="font-mono text-slate-700 dark:text-slate-300">{ledgers.find(l => l.id === salaryExpenseAccountId)?.name || "Mapped"}</span></div>
                        )}
                        {employeePayableAccountId && (
                          <div className="truncate">GL Payable: <span className="font-mono text-slate-700 dark:text-slate-300">{ledgers.find(l => l.id === employeePayableAccountId)?.name || "Mapped"}</span></div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: STEP PACKETS (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {/* STEP 1 PACKET: Category & Identity */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                    <span>{translateHr("Step 1 Packet: Employee Category & Person Selection", lang)}</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step1_of5", "Step 1 of 5")}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 font-sans">
                    {t(lang, "hr.f_select_category", "Select Employee / Master Category *")}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__GO_TO_COMPANY__") {
                        router.push("/dashboard/settings/company" as Route);
                        return;
                      }
                      if (val === "__GO_TO_CUSTOMER__") {
                        router.push("/dashboard/settings/customers" as Route);
                        return;
                      }
                      if (val === "__GO_TO_BANK__") {
                        router.push("/dashboard/settings/bank" as Route);
                        return;
                      }
                      const cat = val as any;
                      setCategory(cat);
                      const def = (CATEGORY_DEFAULTS[lang] || CATEGORY_DEFAULTS.en)[cat] || CATEGORY_DEFAULTS.en[cat];
                      if (def) {
                        setDesignation(def.designation);
                        setDepartment(def.department);
                      }
                    }}
                    className="flex h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 shadow-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
                  >
                    <optgroup label={lang === "ur" ? "ملازمین کے زمرے" : lang === "ar" ? "فئات الموظفين" : "Employee Categories"}>
                      <option value="Country Owner">{catLabel("Country Owner")}</option>
                      <option value="Branch Owner">{catLabel("Branch Owner")}</option>
                      <option value="Company Owner">{catLabel("Company Owner")}</option>
                      <option value="Manager">{catLabel("Manager")}</option>
                      <option value="Employee">{catLabel("Employee")}</option>
                      <option value="Normal Staff">{catLabel("Normal Staff")}</option>
                      <option value="Others">{catLabel("Others")}</option>
                    </optgroup>
                    <optgroup label={lang === "ur" ? "دیگر ماسٹر فارمز" : lang === "ar" ? "النماذج الرئيسية الأخرى" : "Other Master Forms"}>
                      <option value="__GO_TO_CUSTOMER__">👤 {lang === "ur" ? "کسٹمر / پرسن ماسٹر فارم کھولیں ↗" : lang === "ar" ? "فتح نموذج الشخص / العميل ↗" : "Open Customer / Person Master ↗"}</option>
                      <option value="__GO_TO_COMPANY__">🏢 {lang === "ur" ? "کمپنی رجسٹریشن فارم کھولیں ↗" : lang === "ar" ? "فتح نموذج تسجيل الشركة ↗" : "Open Company Master Form ↗"}</option>
                      <option value="__GO_TO_BANK__">🏦 {lang === "ur" ? "بینک اکاؤنٹ ماسٹر فارم کھولیں ↗" : lang === "ar" ? "فتح نموذج الحساب البنكي ↗" : "Open Bank Master Form ↗"}</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <PersonPicker
                    label={t(lang, "hr.f_select_person", "Select or Add Employee / Person Master Name *")}
                    value={personMasterId}
                    onValueChange={setPersonMasterId}
                    countryId={countryId}
                    lang={lang}
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {t(lang, "hr.f_lbl_designation_short", "Designation / Job Role *")}
                      </label>
                      <input
                        type="text"
                        list="common-job-roles"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="e.g. Manager, Accountant, Cook, Driver"
                        className="flex h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-xs outline-none focus:border-emerald-500"
                      />
                      <datalist id="common-job-roles">
                        <option value="General Operations Manager" />
                        <option value="Chief Accountant" />
                        <option value="Accountant" />
                        <option value="Branch Administrator" />
                        <option value="Cashier" />
                        <option value="Transport Driver" />
                        <option value="Cook" />
                        <option value="Cleaner" />
                        <option value="Store / Warehouse In-Charge" />
                        <option value="Customs Clearing Supervisor" />
                        <option value="Logistics Coordinator" />
                        <option value="Executive Staff Officer" />
                      </datalist>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {t(lang, "hr.f_lbl_department", "Department / Position *")}
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Finance, Operations, Logistics"
                        className="flex h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Quick Role Selection Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Roles:</span>
                    {[
                      { role: "Manager", dept: "Operations" },
                      { role: "Accountant", dept: "Finance" },
                      { role: "Branch Administrator", dept: "Administration" },
                      { role: "Driver", dept: "Logistics" },
                      { role: "Cook", dept: "General Services" },
                      { role: "Cleaner", dept: "Facilities" },
                      { role: "Cashier", dept: "Finance" }
                    ].map((item) => (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => {
                          setDesignation(item.role);
                          setDepartment(item.dept);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition ${
                          designation === item.role
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-400"
                        }`}
                      >
                        {item.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Packet Summary Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step1_preview", "STEP 1 PACKET PREVIEW")}</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_category", "Category:")}</span> <span className="font-bold text-emerald-600">{catLabel(category)}</span></div>
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_name", "Name:")}</span> <span className="font-bold truncate block">{fullName || t(lang, "hr.f_not_selected", "Not Selected")}</span></div>
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_designation_short", "Role:")}</span> <span className="font-bold truncate block">{designation || "-"}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 PACKET: Location & Branch Scopes */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <span>{t(lang, "hr.f_step2_title", "Step 2 Packet: Country, Branch Scopes & Reporting Manager")}</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step2_of5", "Step 2 of 5")}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "common.country", "Country")} *</label>
                    <select
                      value={countryId}
                      onChange={(e) => setCountryId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="">{t(lang, "hr.f_select_country", "Select Country")}</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_main_branch", "Main Branch")}</label>
                    <select
                      value={countryBranchId}
                      onChange={(e) => setCountryBranchId(e.target.value)}
                      disabled={!countryId}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 disabled:opacity-40"
                    >
                      <option value="">{t(lang, "hr.f_select_main_branch", "Select Main Branch")}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_city_branch", "City Branch")}</label>
                    <select
                      value={cityBranchId}
                      onChange={(e) => setCityBranchId(e.target.value)}
                      disabled={!countryId}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 disabled:opacity-40"
                    >
                      <option value="">{t(lang, "hr.f_select_city_branch", "Select City Branch")}</option>
                      {cityBranches.map((cb) => (
                        <option key={cb.id} value={cb.id}>
                          {cb.name} {cb.code ? `(${cb.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {category !== "Manager" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_reporting_manager", "Reporting Manager")}</label>
                    <select
                      value={reportingManagerId}
                      onChange={(e) => setReportingManagerId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="">{t(lang, "hr.f_select_manager", "Select Manager (Optional)")}</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>{m.person?.customer_name} ({m.employee_code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Packet Summary Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step2_preview", "Step 2 Packet Preview")}</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><span className="font-semibold text-slate-400">{t(lang, "common.country", "Country")}:</span> {selectedCountryObj?.name || "-"}</div>
                    <div>
                      <span className="font-semibold text-slate-400">{t(lang, "hr.f_main_branch", "Main Branch")}:</span>{" "}
                      {selectedMainBranchObj ? `${selectedMainBranchObj.name}` : "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400">{t(lang, "hr.f_city_branch", "City Branch")}:</span>{" "}
                      {selectedCityBranchObj ? `${selectedCityBranchObj.name}` : "-"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 PACKET: Timelines, Duty Shift & Contract */}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>{t(lang, "hr.f_step3_title", "Step 3 Packet: Employment Type, Shift & Contract Timelines")}</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step3_of5", "Step 3 of 5")}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_joining_date", "Joining Date")} *</label>
                    <input
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_employment_type", "Employment Type")}</label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="Full-time">{t(lang, "hr.f_full_time", "Full-time")}</option>
                      <option value="Part-time">{t(lang, "hr.f_part_time", "Part-time")}</option>
                      <option value="Contract">{t(lang, "hr.f_contract", "Contract")}</option>
                      <option value="Internship">{t(lang, "hr.f_internship", "Internship")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_shift", "Duty Shift")}</label>
                    <input
                      type="text"
                      value={workingShift}
                      onChange={(e) => setWorkingShift(e.target.value)}
                      placeholder={t(lang, "hr.f_ph_day_shift", "Day Shift")}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_start", "Duty Start Time")}</label>
                    <input
                      type="time"
                      value={dutyStartTime}
                      onChange={(e) => setDutyStartTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_end", "Duty End Time")}</label>
                    <input
                      type="time"
                      value={dutyEndTime}
                      onChange={(e) => setDutyEndTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Packet Summary Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step3_preview", "Step 3 Packet Preview")}</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_joining_date", "Joining:")}</span> {joiningDate || "-"}</div>
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_type", "Type:")}</span> {employmentType}</div>
                    <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_shift", "Shift:")}</span> {workingShift} ({dutyStartTime}-{dutyEndTime})</div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 PACKET: Salary Details & Account Mapping */}
            {activeStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
                    <span>{t(lang, "hr.f_step4_title", "Step 4 Packet: Basic Salary, Allowances & GL Ledgers")}</span>
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step4_of5", "Step 4 of 5")}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_salary_basis", "Salary Basis")}</label>
                    <select
                      value={salaryType}
                      onChange={(e) => setSalaryType(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="Monthly">{t(lang, "hr.f_monthly", "Monthly")}</option>
                      <option value="Daily">{t(lang, "hr.f_daily", "Daily")}</option>
                      <option value="Hourly">{t(lang, "hr.f_hourly", "Hourly")}</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_basic_salary", "Basic Salary Rate")} ({salaryCurrency})</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={basicSalary || ""}
                        onChange={(e) => setBasicSalary(Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-14 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">{salaryCurrency}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">{t(lang, "hr.f_monthly_allowances", "Allowances Breakdown")}</label>
                  <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t(lang, "hr.f_housing", "Housing")}</label>
                      <input
                        type="number"
                        value={accommodationAllowance || ""}
                        onChange={(e) => setAccommodationAllowance(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t(lang, "hr.f_transport", "Transport")}</label>
                      <input
                        type="number"
                        value={transportAllowance || ""}
                        onChange={(e) => setTransportAllowance(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t(lang, "hr.f_food", "Food")}</label>
                      <input
                        type="number"
                        value={foodAllowance || ""}
                        onChange={(e) => setFoodAllowance(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t(lang, "hr.f_mobile_utility", "Mobile / Utility")}</label>
                      <input
                        type="number"
                        value={mobileAllowance || ""}
                        onChange={(e) => setMobileAllowance(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_general_deduction", "Monthly Deduction")}</label>
                    <input
                      type="number"
                      value={deduction || ""}
                      onChange={(e) => setDeduction(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_tax_social", "Tax / Social Security")}</label>
                    <input
                      type="number"
                      value={taxDeduction || ""}
                      onChange={(e) => setTaxDeduction(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_salary_expense_acc", "Salary Expense Account")}</label>
                    <select
                      value={salaryExpenseAccountId}
                      onChange={(e) => setSalaryExpenseAccountId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="">{t(lang, "hr.f_select_ledger", "Select Ledger")}</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_payable_acc", "Employee Payable Account")}</label>
                    <select
                      value={employeePayableAccountId}
                      onChange={(e) => setEmployeePayableAccountId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="">{t(lang, "hr.f_select_ledger", "Select Ledger")}</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STEP 5: FULL-WIDTH EXECUTIVE EMPLOYEE MASTER VERIFICATION REPORT */
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Step 5: Employee Master Full Verification Report
              </h3>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={printProfile}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 dark:border-blue-800 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>{t(lang, "bankroz.print_pdf", "Print / PDF Report")}</span>
              </button>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-xs">
                ✓ Verified & Ready for Master Registration
              </span>
            </div>
          </div>

          {/* Large Executive Master Card */}
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-white via-slate-50 to-emerald-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-md space-y-6">
            
            {/* Top Identity Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shrink-0 uppercase">
                  {(fullName || "?").charAt(0)}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    RECORD TYPE: EMPLOYEE MASTER
                  </div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {fullName || "Unnamed Employee"}
                  </h1>
                  {selectedPersonObj?.father_name && (
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      S/O {selectedPersonObj.father_name}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-600 font-extrabold">{designation || "Designation"}</span>
                    <span>·</span>
                    <span>{department || "Department"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-md">
                  {catLabel(category)}
                </span>
                {selectedPersonObj?.person_code && (
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    Person Code: {selectedPersonObj.person_code}
                  </span>
                )}
              </div>
            </div>

            {/* 4 Multi-Column Section Dossiers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card 1: Identity & Contact Details */}
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <UserCheck className="h-4 w-4" />
                  <span>1. Identity & Contact Information</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Full Name:</span><span className="font-bold text-slate-900 dark:text-slate-100">{fullName || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Father's Name:</span><span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPersonObj?.father_name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Gender:</span><span className="font-semibold">{gender || selectedPersonObj?.gender || "Male"}</span></div>
                  <div className="flex justify-between" dir="ltr"><span className="text-slate-500">Mobile Phone:</span><span className="font-mono font-bold text-emerald-600">{selectedPersonObj?.mobile || "-"}</span></div>
                  <div className="flex justify-between" dir="ltr"><span className="text-slate-500">Email Address:</span><span className="font-medium text-blue-600 truncate">{selectedPersonObj?.email || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Address / City:</span><span className="font-medium truncate text-slate-700 dark:text-slate-300">{selectedPersonObj?.address || selectedCityBranchObj?.name || "-"}</span></div>
                </div>
              </div>

              {/* Card 2: Organizational Scope & Location */}
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>2. Organization, Branch & Hierarchy</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Country:</span><span className="font-bold text-slate-900 dark:text-slate-100">{selectedCountryObj?.name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Main Branch:</span><span className="font-semibold text-slate-800 dark:text-slate-200">{selectedMainBranchObj?.name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">City Branch:</span><span className="font-bold text-emerald-600">{selectedCityBranchObj?.name || "All Branches"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Reporting Manager:</span><span className="font-bold text-indigo-600">{selectedManagerObj ? `${selectedManagerObj.person?.customer_name} (${selectedManagerObj.employee_code})` : "Direct to Executive Management"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Master Category:</span><span className="font-bold text-slate-900 dark:text-slate-100">{catLabel(category)}</span></div>
                </div>
              </div>

              {/* Card 3: Duty Shift & Employment Timelines */}
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <Clock className="h-4 w-4" />
                  <span>3. Employment Type, Shift & Timelines</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Joining Date:</span><span className="font-bold text-slate-900 dark:text-slate-100">{joiningDate || "Immediate"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Employment Type:</span><span className="font-semibold">{employmentType || "Full-time"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Working Shift:</span><span className="font-semibold">{workingShift || "Day Shift"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Duty Hours:</span><span className="font-bold text-blue-600">{dutyStartTime || "09:00"} – {dutyEndTime || "18:00"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Weekly Off Day:</span><span className="font-semibold">{weeklyOffDay || "Friday / Sunday"}</span></div>
                </div>
              </div>

              {/* Card 4: Compensation & GL Mapping */}
              <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-1.5">
                  <BadgeDollarSign className="h-4 w-4" />
                  <span>4. Compensation, Allowances & GL Mapping</span>
                </div>
                {category === "Country Owner" || category === "Branch Owner" || category === "Company Owner" ? (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 font-bold">
                    👑 Executive Owner / Partner Mode — Drawings & equity-based compensation.
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Salary Basis:</span><span className="font-semibold">{salaryType || "Monthly"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Basic Salary:</span><span className="font-bold text-slate-900 dark:text-slate-100">{Number(basicSalary || 0).toLocaleString()} {salaryCurrency}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Total Allowances:</span><span className="font-bold text-emerald-600">+{totalAllowances.toLocaleString()} {salaryCurrency}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Deductions:</span><span className="font-semibold text-rose-600">-{((Number(deduction) || 0) + (Number(taxDeduction) || 0)).toLocaleString()} {salaryCurrency}</span></div>
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-700 pt-1">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">Net Monthly Payroll:</span>
                      <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">{netSalary.toLocaleString()} {salaryCurrency}</span>
                    </div>
                    {salaryExpenseAccountId && (
                      <div className="text-[10px] text-slate-500 pt-0.5 truncate">
                        GL Expense: <span className="font-mono">{ledgers.find(l => l.id === salaryExpenseAccountId)?.name || "Mapped"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="text-xs font-semibold"
        >
          {t(lang, "common.cancel", "Cancel")}
        </Button>

        <div className="flex items-center gap-2">
          {activeStep > 1 && (
            <Button
              type="button"
              onClick={() => setActiveStep((s) => s - 1)}
              variant="outline"
              className="text-xs font-semibold gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t(lang, "common.previous_step", "Previous Step")}</span>
            </Button>
          )}

          {activeStep < 5 && (
            <Button
              type="button"
              onClick={() => setActiveStep((s) => s + 1)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 gap-1"
            >
              <span>{t(lang, "common.next_step", "Next Step")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 shadow-sm gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{saving ? t(lang, "common.saving", "Saving...") : t(lang, "hr.f_save_finalize_employee", "Save & Finalize Employee")}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
