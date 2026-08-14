"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  MapPin,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Key,
  Eye,
  EyeOff,
  Printer,
  Users,
  Globe2,
  CheckCircle2,
  Lock,
  Plus,
  Search,
  UserCheck,
  BadgeCheck,
  Shield,
  FileCheck,
  Calendar,
  Home,
  Info,
  ExternalLink,
  Edit,
  XCircle,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { EmployeeForm } from "@/features/hr-payroll/components/employee-form";
import type { LocationCountry } from "@/features/locations/location-api";
import { listCities, listCountries, type LocationCity } from "@/features/locations/location-api";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { buildRbacRoleSummary } from "@/lib/permissions/rbac-matrix-builder";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { apiPost } from "@/lib/api/client";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";
import { UserProfileReportModal, UserProfileData } from "./user-profile-report-modal";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string; country_branch_id: string };

type WizardStep = 1 | 2 | 3 | 4;

type Banner = { tone: "ok" | "err"; text: string } | null;

const branchTypeOptions = [
  { value: "main", label: "Main Branch" },
  { value: "city", label: "City Branch" }
] as const;

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string }> = [
  { value: "super_admin", label: "Super Admin User", help: "Global scope (full root system control)." },
  { value: "country_admin", label: "Country Admin User", help: "Country scope (full country ledger & branches)." },
  { value: "country_user", label: "Country Operations User", help: "Country scope user." },
  { value: "main_branch_admin", label: "Main Branch Admin User", help: "Main branch scope (Roznamcha & daily book closing)." },
  { value: "city_branch_admin", label: "City/Branch User", help: "City branch scope (transactions & entry)." },
  { value: "accountant", label: "Accountant", help: "Branch scope with direct ledger & financial posting." },
  { value: "cashier", label: "Cashier", help: "Branch scope with cash receipts & payments." },
  { value: "agent_user", label: "Clearing / Customs Agent", help: "Port & customs clearance limited scope." },
  { value: "staff_user", label: "Staff User", help: "Standard operational branch access." },
  { value: "auditor_viewer", label: "Auditor / Viewer", help: "Read-only audit & reporting scope." }
];

const userWizardTranslations: Record<string, Record<SupportedLanguage, string>> = {
  headerTitleNew: {
    en: "User Registration & Setup Wizard",
    ur: "صارف رجسٹریشن فارم و ویژرڈ",
    ar: "معالج تسجيل وإعداد المستخدم",
    fa: "ویزارد ثبت نام و تنظیمات کاربر",
    ps: "د کارونکي راجستر کولو فورمه"
  },
  headerTitleEdit: {
    en: "Edit System User Record",
    ur: "سسٹم صارف ریکارڈ ایڈٹ کریں",
    ar: "تعديل سجل مستخدم النظام",
    fa: "ویرایش حساب کاربر سیستم",
    ps: "د سیسټم د کارونکي اډیټ فورمه"
  },
  headerDesc: {
    en: "Link Employee master records, assign Country & Branch scopes, verify KYC identity, and issue System Login Credentials.",
    ur: "ملازمین کے ماسٹر ریکارڈز، ملک اور برانچ کے اختیارات، KYC تصدیق اور لاگ ان کی تفصیلات مرتب کریں۔",
    ar: "ربط سجلات الموظفين، وتعيين نطاقات الدولة والفرع، والتحقق من KYC وإصدار بيانات الدخول.",
    fa: "اتصال به پرسنل، تعیین دسترسی‌های کشور و شعبه، احراز هویت KYC و صدور اطلاعات ورود.",
    ps: "د کارمندانو اسناد، د هیواد او څانګې واکونه، د KYC تصدیق او ننوتلو سوابق برابرول."
  },
  step1Label: { en: "1. General Information", ur: "1. عام معلومات", ar: "1. المعلومات العامة", fa: "1. اطلاعات عمومی", ps: "1. عمومي معلومات" },
  step2Label: { en: "2. Employee & Branch Access", ur: "2. ایمپلائی و برانچ رسائی", ar: "2. صلاحيات الموظف والفرع", fa: "2. دسترسی پرسنل و شعبه", ps: "2. د کارمند او څانګې لاسرسی" },
  step3Label: { en: "3. KYC & Document Verification", ur: "3. کے وائی سی و دستاویزات", ar: "3. التحقق من الهوية (KYC)", fa: "3. احراز هویت (KYC)", ps: "3. د پیژندګلوۍ تصدیق (KYC)" },
  step4Label: { en: "4. Review & Complete", ur: "4. ریویو و محفوظ کریں", ar: "4. المراجعة والإكمال", fa: "4. مرور و تکمیل", ps: "4. کتنه او بشپړول" },
  next: { en: "Next Step", ur: "اگلا قدم", ar: "الخطوة التالية", fa: "مرحله بعد", ps: "بل ګام" },
  previous: { en: "Previous", ur: "پچھلا", ar: "السابق", fa: "قبلی", ps: "پخوانی" },
  saveUser: { en: "Save & Complete Registration", ur: "محفوظ کریں اور مکمل کریں", ar: "حفظ وإكمال التسجيل", fa: "ذخیره و تکمیل ثبت نام", ps: "خوندي او ثبت بشپړول" },
  savingText: { en: "Saving User Record...", ur: "صارف محفوظ ہو رہا ہے...", ar: "جاري حفظ بيانات المستخدم...", fa: "در حال ذخیره...", ps: "د کارونکي معلومات خوندي کیږي..." },
  printCard: { en: "Print A4 User Card", ur: "A4 یوزر کارڈ پرنٹ کریں", ar: "طباعة بطاقة المستخدم A4", fa: "چاپ کارت کاربر A4", ps: "د A4 د کارونکي کارت چاپول" },
  addNewUser: { en: "+ New User Registration", ur: "+ نیا صارف رجسٹر کریں", ar: "+ تسجيل مستخدم جديد", fa: "+ ثبت کاربر جدید", ps: "+ نوی کارونکی ثبت کړئ" },
  selectEmployee: { en: "Select Registered Employee", ur: "رجسٹرڈ ایمپلائی منتخب کریں", ar: "اختر الموظف المسجل", fa: "انتخاب پرسنل ثبت شده", ps: "ثبت شوی کارمند وټاکئ" },
  fullName: { en: "User Full Name *", ur: "صارف کا مکمل نام *", ar: "الاسم الكامل للمستخدم *", fa: "نام کامل کاربر *", ps: "د کارونکي بشپړ نوم *" },
  username: { en: "Login Username / Identifier *", ur: "لاگ ان یوزر نام *", ar: "اسم المستخدم للدخول *", fa: "نام کاربری ورود *", ps: "د ننوتلو کارن نوم *" },
  designation: { en: "Designation / Role Title", ur: "عہدہ / ڈیزگنیشن", ar: "المسمى الوظيفي", fa: "عنوان شغلی", ps: "دندې سرلیک" },
  department: { en: "Department", ur: "شعبہ / ڈیپارٹمنٹ", ar: "القسم", fa: "بخش / دپارتمان", ps: "څانګه / دیپارتمنت" },
  phone: { en: "Contact Phone / WhatsApp", ur: "رابطہ فون / واٹس ایپ", ar: "رقم الهاتف / الواتساب", fa: "تلفن تماس / واتساپ", ps: "د اړیکې تلیفون / واټساپ" },
  email: { en: "Personal Email / Identifier", ur: "ای میل ایڈریس", ar: "البريد الإلكتروني", fa: "ایمیل شخصی", ps: "برېښنالیک پته" },
  role: { en: "System Role Privilege Assignment *", ur: "سسٹم رول اور اختیارات *", ar: "تعيين صلاحيات الدور *", fa: "تعیین نقش و دسترسی‌ها *", ps: "د کارونکي رول او واکونه *" },
  country: { en: "Assigned Country Scope *", ur: "مقررہ ملک *", ar: "الدولة المعينة *", fa: "کشور مربوطه *", ps: "ټاکل شوی هیواد *" },
  branchType: { en: "Branch Access Scope *", ur: "برانچ کی قسم *", ar: "نوع الفرع *", fa: "نوع دسترسی شعبه *", ps: "د څانګې ډول *" },
  assignedBranch: { en: "Assigned Primary Branch *", ur: "مقررہ بنیادی برانچ *", ar: "الفرع الرئيسي المعين *", fa: "شعبه اصلی مربوطه *", ps: "ټاکل شوې اصلي څانګه *" },
  cnicPassport: { en: "National ID / CNIC / Passport Number", ur: "شناختی کارڈ / پاسپورٹ نمبر", ar: "رقم الهوية الوطنية / الجواز", fa: "شماره ملی / پاسپورت", ps: "د تذکرې / پاسپورټ شمیره" },
  expiryDate: { en: "Document Expiry Date", ur: "دستاویز کی تاریخ تنسیخ", ar: "تاريخ انتهاء الوثيقة", fa: "تاریخ انقضای مدرک", ps: "د سند د پای نیټه" },
  kycStatus: { en: "KYC Verification Status", ur: "تصدیقی حیثیت (KYC Status)", ar: "حالة التحقق (KYC)", fa: "وضعیت تایید هویت", ps: "د پیژندګلوۍ حالت" },
  address: { en: "Permanent Residential Address", ur: "مستقل رہائشی پتہ", ar: "العنوان السكني الدائم", fa: "آدرس کامل سکونت", ps: "د استوګنې بشپړ پته" },
  verifiedCompliant: { en: "Verified & Compliant", ur: "تصدیق شدہ و مکمل", ar: "متحقق ومطابق", fa: "تایید شده و معتبر", ps: "تصدیق شوی او بشپړ" },
  pendingVerification: { en: "Pending Document Verification", ur: "تصدیق زیر التوا", ar: "قيد التحقق من المستندات", fa: "در انتظار تایید مدارک", ps: "د اسنادو تصدیق پاتې" },
  optionalHint: { en: "(Optional - Empty field will not block Next)", ur: "(اختیاری - خالی چھوڑنے پر فارم بلاک نہیں ہوگا)", ar: "(اختياري - لن يمنع الحقل الفارغ المتابعة)", fa: "(اختیاری - خالی بودن مانع ادامه نمی‌شود)", ps: "(اختیاري - تش پریښودل ګام نه بندوي)" },
  requiredHint: { en: "* Mandatory field", ur: "* لازمی فیلڈ", ar: "* حقل إجباري", fa: "* فیلد الزامی", ps: "* اړین فیلډ" },
  addNewEmployee: { en: "Add New Employee", ur: "نیا ملازم شامل کریں", ar: "إضافة موظف جديد", fa: "افزودن پرسنل جدید", ps: "نوی کارمند اضافه کړئ" },
  newEmployeeModalTitle: { en: "New Employee Registration", ur: "نیا ملازم رجسٹریشن", ar: "تسجيل موظف جديد", fa: "ثبت پرسنل جدید", ps: "د نوي کارمند ثبت" },
  employeeSearchPlaceholder: { en: "Search employee by code, name, designation...", ur: "کوڈ، نام یا عہدہ سے ملازم تلاش کریں...", ar: "ابحث عن الموظف بالرمز أو الاسم أو المسمى الوظيفي...", fa: "جستجوی پرسنل با کد، نام یا عنوان شغلی...", ps: "کارمند د کوډ، نوم یا دندې له مخې پلټئ..." },
  noEmployeesFound: { en: "No matching employees found.", ur: "کوئی مماثل ملازم نہیں ملا۔", ar: "لم يتم العثور على موظفين مطابقين.", fa: "هیچ پرسنلی مطابقت پیدا نشد.", ps: "هیڅ ورته کارمند ونه موندل شو." }
};

function makeAutoUserCode() {
  const rand = Math.floor(1000 + Math.random() * 8999);
  return `USR-${rand}`;
}

function toCountryOption(row: LocationCountry): SearchSelectOption {
  return {
    value: row.id,
    label: row.name,
    keywords: `${row.name} ${row.iso2 ?? ""} ${row.iso3 ?? ""} ${row.currency_code ?? ""}`
  };
}

function UserRegistrationWizardContent({ userIdProp }: { userIdProp?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUserId = userIdProp || searchParams.get("userId");

  const activeLang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);

  const tr = (key: string) => userWizardTranslations[key]?.[activeLang] || userWizardTranslations[key]?.["en"] || key;

  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);

  // Modal for creating new employee on the fly
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  // Modal for viewing full saved user profile
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savedUserData, setSavedUserData] = useState<UserProfileData | null>(null);

  // HR Employees list for Step 1 dropdown
  const [hrEmployees, setHrEmployees] = useState<any[]>([]);
  const [hrEmployeesLoading, setHrEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState<string>("");

  // Step 1: User Core State
  const [userCode, setUserCode] = useState("");
  useEffect(() => {
    setUserCode((current) => current || makeAutoUserCode());
  }, []);
  const [fullName, setFullName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [designation, setDesignation] = useState("Staff");
  const [department, setDepartment] = useState("General Office");

  // Step 2: Location & Branch
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [branchType, setBranchType] = useState<"" | "main" | "city">("main");
  const [mainBranches, setMainBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [role, setRole] = useState<EnterpriseRole>("staff_user");

  // Step 3: KYC & Security
  const [cnicPassportNo, setCnicPassportNo] = useState("");
  const [idExpiryDate, setIdExpiryDate] = useState("");
  const [kycStatus, setKycStatus] = useState<"VERIFIED" | "PENDING">("VERIFIED");
  const [residentialAddress, setResidentialAddress] = useState("");

  // Step 4: Login Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Editing User
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isResettingBranch, setIsResettingBranch] = useState(true);

  // Dynamic RBAC summary computed in real-time
  const rbacSummary = useMemo(() => buildRbacRoleSummary(role), [role]);

  async function fetchHrEmployees(): Promise<any[]> {
    setHrEmployeesLoading(true);
    try {
      const res = await fetch(`/api/erp/hr-payroll/employees?lang=${activeLang}`).then((r) => r.json());
      if (res && res.employees && Array.isArray(res.employees)) {
        setHrEmployees(res.employees);
        return res.employees;
      }
    } catch (err) {
      console.error("Failed to load HR employees list", err);
    } finally {
      setHrEmployeesLoading(false);
    }
    return [];
  }

  useEffect(() => {
    fetchHrEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang]);

  // When Employee is selected from dropdown, populate fields across steps
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const emp = hrEmployees.find((e) => e.id === selectedEmployeeId);
    if (emp) {
      const empName = emp.person?.customer_name || emp.name || emp.full_name || "";
      setFullName(empName);
      setEmployeeCode(emp.employee_code || emp.code || "EMP-001");
      if (!loginUsername) {
        setLoginUsername(empName.toLowerCase().replace(/\s+/g, "."));
      }
      if (emp.person?.mobile) setContactPhone(emp.person.mobile);
      
      const cleanCode = (userCode || makeAutoUserCode()).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (emp.person?.email && !emp.person.email.includes("@dgt.local")) {
        setPersonalEmail(emp.person.email);
      } else {
        setPersonalEmail(`${cleanCode}@dgt.llc`);
      }

      if (emp.designation) setDesignation(emp.designation);
      if (emp.department) setDepartment(emp.department);
      if (emp.country_id) setCountryId(emp.country_id);
      if (emp.country_branch_id) {
        setBranchType("main");
        setCountryBranchId(emp.country_branch_id);
      } else if (emp.city_branch_id) {
        setBranchType("city");
        setCityBranchId(emp.city_branch_id);
      }

      if (emp.person?.national_id_or_passport) {
        setCnicPassportNo(emp.person.national_id_or_passport);
      }
      if (emp.person?.address) {
        setResidentialAddress(emp.person.address);
      }
    }
  }, [selectedEmployeeId, hrEmployees]);

  async function fetchSpecificUser(id: string) {
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(id)}`).then((r) => r.json());
      if (res && res.data) {
        const data = res.data;
        setEditUserId(data.userId);
        setFullName(data.fullName || "");
        setUserCode(data.userCode || makeAutoUserCode());
        setRole(data.role || "staff_user");
        setCountryId(data.countryId || "");
        if (data.email) setPersonalEmail(data.email);
        if (data.phone) setContactPhone(data.phone);
        if (data.designation) setDesignation(data.designation);
        if (data.department) setDepartment(data.department);
        if (data.cnicPassportNo) setCnicPassportNo(data.cnicPassportNo);
        if (data.idExpiryDate) setIdExpiryDate(data.idExpiryDate);
        if (data.kycStatus) setKycStatus(data.kycStatus);
        if (data.residentialAddress) setResidentialAddress(data.residentialAddress);

        if (data.countryBranchId && !data.cityBranchId) {
          setBranchType("main");
          setCountryBranchId(data.countryBranchId);
          setCityBranchId("");
        } else if (data.cityBranchId) {
          setBranchType("city");
          setCityBranchId(data.cityBranchId);
        }

        setStep(1);
      }
    } catch (err) {
      console.error("Failed to load user for edit", err);
    }
  }

  useEffect(() => {
    if (urlUserId && !editUserId) {
      fetchSpecificUser(urlUserId);
    }
  }, [urlUserId, editUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries();
        if (!cancelled) {
          setCountries(rows);
          if (rows.length > 0 && !countryId) {
            const defaultCountry = rows.find((r) => r.name.toLowerCase().includes("pakistan")) || rows[0];
            if (defaultCountry) setCountryId(defaultCountry.id);
          }
        }
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isResettingBranch) {
      setBranchType("main");
      setCountryBranchId("");
      setCityBranchId("");
      setMainBranches([]);
      setCityBranches([]);
      setCities([]);
    } else {
      setIsResettingBranch(true);
    }

    if (!countryId) return;

    let cancelled = false;
    (async () => {
      try {
        const [cbRes, ctyRes, cityList] = await Promise.all([
          fetch(`/api/branch-management/country-branches?countryId=${countryId}`).then((r) => r.json()),
          fetch(`/api/branch-management/city-branches?countryId=${countryId}`).then((r) => r.json()),
          listCities({ countryId })
        ]);

        if (!cancelled) {
          const mbRows: MainBranchRow[] = (Array.isArray(cbRes?.countryBranches) ? cbRes.countryBranches : Array.isArray(cbRes) ? cbRes : []).map((b: any) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            local_currency: b.local_currency || "USD",
            is_main: Boolean(b.is_main),
            city_id: b.city_id
          }));
          setMainBranches(mbRows);

          const cbRows: CityBranchRow[] = (Array.isArray(ctyRes?.cityBranches) ? ctyRes.cityBranches : Array.isArray(ctyRes) ? ctyRes : []).map((b: any) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            cityName: b.city_name || b.cityName || "City",
            local_currency: b.local_currency || "USD",
            country_branch_id: b.country_branch_id
          }));
          setCityBranches(cbRows);
          setCities(cityList);

          if (mbRows.length > 0 && !countryBranchId) setCountryBranchId(mbRows[0].id);
          if (cbRows.length > 0 && !cityBranchId) setCityBranchId(cbRows[0].id);
        }
      } catch (err) {
        console.error("Failed to load branches for country", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const countryOptions = useMemo(() => countries.map(toCountryOption), [countries]);

  const branchTypeSelectOptions = useMemo(
    () => branchTypeOptions.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  const employeeOptions = useMemo(
    () =>
      hrEmployees.map((e) => {
        const empName = e.person?.customer_name || e.name || e.full_name || "Employee";
        const empCode = e.employee_code || e.code || "EMP";
        const desig = e.designation ? ` - ${e.designation}` : "";
        return {
          value: e.id,
          label: `${empName} (${empCode}${desig})`,
          keywords: `${empName} ${empCode} ${e.designation ?? ""}`
        };
      }),
    [hrEmployees]
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const branchCode = useMemo(() => {
    if (branchType === "main") return selectedMainBranch?.code ?? "";
    if (branchType === "city") return selectedCityBranch?.code ?? "";
    return "";
  }, [branchType, selectedMainBranch, selectedCityBranch]);

  function isStepValid(currentStep: WizardStep) {
    if (currentStep === 1) {
      return Boolean(fullName.trim().length >= 2 || selectedEmployeeId);
    }
    if (currentStep === 2) {
      if (role === "super_admin") return true;
      if (!countryId) return false;
      return true;
    }
    if (currentStep === 3) {
      return true;
    }
    if (currentStep === 4) {
      if (!editUserId && (!password || password.length < 8)) return false;
      if (password && password !== confirmPassword) return false;
      return Boolean(userCode.trim());
    }
    return true;
  }

  function next() {
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  }

  function prev() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  async function finish() {
    setBanner(null);

    if (!fullName || fullName.trim().length < 2) {
      setBanner({ tone: "err", text: "User Full Name / Employee selection is required." });
      return;
    }

    const issuedCode = normalizeUserCode(userCode || "");
    if (!issuedCode) {
      setBanner({ tone: "err", text: "User ID / Code is required." });
      return;
    }

    const isEdit = Boolean(editUserId);

    if (!isEdit && (!password || password.length < 8)) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters for login access." });
      return;
    }

    if (password && password.length < 8) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }

    if (password && password !== confirmPassword) {
      setBanner({ tone: "err", text: "Confirm Password does not match." });
      return;
    }

    let resolvedCountryId: string | null = countryId || null;
    let resolvedCountryBranchId: string | null = null;
    let resolvedCityBranchId: string | null = null;

    if (role === "super_admin") {
      resolvedCountryId = null;
      resolvedCountryBranchId = null;
      resolvedCityBranchId = null;
    } else if (role === "country_admin" || role === "country_user") {
      resolvedCountryBranchId = null;
      resolvedCityBranchId = null;
    } else if (role === "main_branch_admin" || (role !== "city_branch_admin" && branchType === "main")) {
      resolvedCountryBranchId = countryBranchId || (mainBranches[0]?.id ?? null);
      resolvedCityBranchId = null;
    } else {
      resolvedCityBranchId = cityBranchId || (cityBranches[0]?.id ?? null);
      resolvedCountryBranchId = countryBranchId || selectedCityBranch?.country_branch_id || (mainBranches[0]?.id ?? null);
    }

    const preferredLanguage = activeLang;
    const cleanUserCode = issuedCode.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = personalEmail.trim() || `${cleanUserCode}@dgt.llc`;

    setSaving(true);
    try {
      const payload: any = {
        role: role,
        fullName: fullName.trim(),
        userCode: issuedCode,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        phone: contactPhone.trim(),
        designation,
        department,
        cnicPassportNo: cnicPassportNo.trim(),
        idExpiryDate,
        kycStatus,
        residentialAddress: residentialAddress.trim(),
        permissions: enterpriseRolePermissions[role] || []
      };

      let resUserId = editUserId;
      if (isEdit) {
        payload.userId = editUserId;
        if (password) payload.password = password;

        const fetchRes = await fetch("/api/erp/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user.");
      } else {
        payload.email = email;
        payload.password = password || "User@123456";
        payload.preferredLanguage = preferredLanguage;
        const createRes = await apiPost<{ userId: string; userCode: string }>("/api/erp/users", payload);
        if (createRes && (createRes as any).userId) {
          resUserId = (createRes as any).userId;
        }
      }

      const completedUser: UserProfileData = {
        userId: resUserId || "USR-RECORD",
        userCode: issuedCode,
        fullName: fullName.trim(),
        username: loginUsername || issuedCode,
        email: email,
        phone: contactPhone.trim(),
        designation: designation,
        department: department,
        employeeCode: employeeCode || "EMP-LINKED",
        countryName: selectedCountry?.name || "Global Scope",
        mainBranchName: selectedMainBranch?.name || "Main Branch",
        mainBranchCode: selectedMainBranch?.code || "MAIN-001",
        cityBranchName: selectedCityBranch?.name || "City Branch",
        cityBranchCode: selectedCityBranch?.code || "CITY-001",
        localCurrency: selectedMainBranch?.local_currency || "USD",
        role: role,
        status: "Active",
        cnicPassportNo: cnicPassportNo.trim(),
        idExpiryDate: idExpiryDate,
        kycStatus: kycStatus,
        residentialAddress: residentialAddress.trim(),
        passwordVaultRef: `VAULT-DGT-${issuedCode}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setSavedUserData(completedUser);
      setBanner({ tone: "ok", text: isEdit ? "User record & KYC updated successfully." : "User registered & KYC linked successfully." });
    } catch (e: any) {
      const errMsg = e?.message || (typeof e === "string" ? e : "User registration operation failed.");
      if (errMsg.includes("already registered") || errMsg.includes("already exists")) {
        setBanner({
          tone: "err",
          text: `A user with email address '${email}' has already been registered. Please click "+ Auto-Generate Unique Email" or use a unique email identifier.`
        });
      } else {
        setBanner({ tone: "err", text: errMsg });
      }
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { number: 1 as const, label: tr("step1Label"), icon: <Users className="h-4 w-4" /> },
    { number: 2 as const, label: tr("step2Label"), icon: <MapPin className="h-4 w-4" /> },
    { number: 3 as const, label: tr("step3Label"), icon: <FileCheck className="h-4 w-4" /> },
    { number: 4 as const, label: tr("step4Label"), icon: <ShieldCheck className="h-4 w-4" /> }
  ];

  const handlePrintCard = () => {
    openUserA4ReportWindow({
      title: "User Profile & Access Authorization Report",
      subtitle: "Official Centralized ERP User Registry Record",
      userData: {
        userId: editUserId || "USR-PREVIEW",
        userCode: userCode,
        fullName: fullName || "User Name",
        countryName: selectedCountry?.name || "Pakistan",
        branchName: (branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "Main Branch",
        branchCode: branchCode || "PK-MAIN-001",
        branchType: designation || "Company Staff",
        role: role,
        registrationDate: new Date().toISOString(),
        status: "Active",
        permissions: [],
        department: department,
        designation: designation,
        employeeCode: employeeCode,
        phone: contactPhone,
        email: personalEmail,
        cnicPassportNo: cnicPassportNo,
        idExpiryDate: idExpiryDate,
        kycStatus: kycStatus,
        residentialAddress: residentialAddress,
        passwordVaultRef: `VAULT-DGT-${userCode}`,
        lastActivity: new Date().toISOString(),
        lastActivityAction: "user.registered",
        rawPassword: `VAULT-DGT-${userCode}`,
        activityCounts: { logins: 1, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
      },
      lang: activeLang
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>{tr("headerTitleNew")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {editUserId ? tr("headerTitleEdit") : tr("headerTitleNew")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tr("headerDesc")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {savedUserData && (
            <Button
              size="sm"
              onClick={() => setShowProfileModal(true)}
              className="gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View User Profile Report</span>
            </Button>
          )}

          {editUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditUserId(null);
                setFullName("");
                setLoginUsername("");
                setSelectedEmployeeId("");
                setUserCode(makeAutoUserCode());
                setStep(1);
                setBanner(null);
                setSavedUserData(null);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5 text-slate-500" />
              <span>{tr("addNewUser")}</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handlePrintCard}
            className="gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-400" />
            <span>{tr("printCard")}</span>
          </Button>
        </div>
      </div>

      {/* Progress Steps Header */}
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((s) => {
          const isActive = step === s.number;
          const isDone = step > s.number;

          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setStep(s.number)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30"
                  : isDone
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : isDone
                    ? "bg-slate-900 text-emerald-400 dark:bg-slate-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step {s.number}</div>
                <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner Notification */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-semibold ${
            banner.tone === "ok"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-red-600" />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Main Split-Screen Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side Form Wizard (7 Columns) */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-slate-900 text-white px-5 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-100">
                {steps[step - 1].icon}
                <span>Step {step}: {steps[step - 1].label}</span>
              </CardTitle>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {userCode}
              </span>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* STEP 1: General Information */}
              {step === 1 && (
                <div className="space-y-3">
                  <SearchSelect
                    label={hrEmployeesLoading ? `${tr("selectEmployee")} (...)` : tr("selectEmployee")}
                    value={selectedEmployeeId}
                    placeholder={tr("employeeSearchPlaceholder")}
                    searchPlaceholder={tr("employeeSearchPlaceholder")}
                    emptyLabel={tr("noEmployeesFound")}
                    options={employeeOptions}
                    disabled={hrEmployeesLoading}
                    onValueChange={setSelectedEmployeeId}
                    createLabel={tr("addNewEmployee")}
                    createButtonPlacement="both"
                    onCreateNew={() => setShowEmployeeModal(true)}
                  />

                  {showEmployeeModal ? (
                    <SimpleModal
                      title={tr("newEmployeeModalTitle")}
                      onClose={() => setShowEmployeeModal(false)}
                      className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
                    >
                      <EmployeeForm
                        onSave={async (newEmployeeId) => {
                          setShowEmployeeModal(false);
                          const freshList = await fetchHrEmployees();
                          if (newEmployeeId && freshList.some((e) => e.id === newEmployeeId)) {
                            setSelectedEmployeeId(newEmployeeId);
                          }
                        }}
                        onCancel={() => setShowEmployeeModal(false)}
                      />
                    </SimpleModal>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("fullName")}</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Muhammad Ali Shah"
                        className="h-9 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("username")}</Label>
                      <Input
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. ali.shah"
                        className="h-9 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                        <span>{tr("designation")}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{tr("optionalHint")}</span>
                      </Label>
                      <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Accountant" className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                        <span>{tr("department")}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{tr("optionalHint")}</span>
                      </Label>
                      <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Finance & Accounts" className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                        <span>{tr("phone")}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{tr("optionalHint")}</span>
                      </Label>
                      <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+92 300 1234567" className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                        <span>{tr("email")}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{tr("optionalHint")}</span>
                      </Label>
                      <Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="user@dgt.llc" className="h-9 text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Employee & Branch Access */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("role")}</Label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as EnterpriseRole)}
                      className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label} — {r.help}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SearchSelect
                      label={loadingCountries ? `${tr("country")} (...)` : tr("country")}
                      value={countryId}
                      placeholder="Select country"
                      disabled={loadingCountries || role === "super_admin"}
                      options={countryOptions}
                      onValueChange={setCountryId}
                    />

                    <SearchSelect
                      label={tr("branchType")}
                      value={branchType}
                      placeholder="Select branch type"
                      disabled={role === "super_admin"}
                      options={branchTypeSelectOptions}
                      onValueChange={(v) => {
                        setBranchType(v as any);
                        setCountryBranchId("");
                        setCityBranchId("");
                      }}
                    />

                    {branchType === "main" ? (
                      <SearchSelect
                        label={tr("assignedBranch")}
                        value={countryBranchId}
                        placeholder="Select main branch"
                        options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: b.name }))}
                        disabled={!countryId || role === "super_admin"}
                        onValueChange={setCountryBranchId}
                      />
                    ) : (
                      <SearchSelect
                        label={tr("assignedBranch")}
                        value={cityBranchId}
                        placeholder="Select city branch"
                        options={cityBranches.map((b) => ({ value: b.id, label: `${b.cityName} - ${b.name} (${b.code})`, keywords: `${b.name} ${b.cityName}` }))}
                        disabled={!countryId || role === "super_admin"}
                        onValueChange={setCityBranchId}
                      />
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Branch Code & Scope</Label>
                      <Input value={`${branchCode || "MAIN"} (${currency})`} readOnly className="bg-slate-100 dark:bg-slate-900 font-mono font-bold h-9 text-xs text-emerald-600 dark:text-emerald-400 border-slate-200" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: KYC & Document Verification */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{tr("optionalHint")} — KYC details can be entered now or updated later without blocking registration.</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("cnicPassport")}</Label>
                      <Input value={cnicPassportNo} onChange={(e) => setCnicPassportNo(e.target.value)} placeholder="e.g. 42101-1234567-1 or A1234567" className="h-9 text-xs font-mono font-bold" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("expiryDate")}</Label>
                      <Input type="date" value={idExpiryDate} onChange={(e) => setIdExpiryDate(e.target.value)} className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("kycStatus")}</Label>
                      <select
                        value={kycStatus}
                        onChange={(e) => setKycStatus(e.target.value as any)}
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-500"
                      >
                        <option value="VERIFIED">✅ {tr("verifiedCompliant")}</option>
                        <option value="PENDING">⏳ {tr("pendingVerification")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("address")}</Label>
                      <Input value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} placeholder="Enter street / city address" className="h-9 text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Complete + Roles & Permissions Matrix */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Summary of Steps 1-3 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100 border-b pb-1 flex items-center justify-between">
                      <span>User & Organizational Master Summary</span>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">{userCode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div><span className="text-slate-500">Full Name:</span> <strong className="text-slate-900 dark:text-slate-100">{fullName || "-"}</strong></div>
                      <div><span className="text-slate-500">Username:</span> <strong className="text-emerald-600 font-mono">{loginUsername || userCode}</strong></div>
                      <div><span className="text-slate-500">Designation:</span> <strong>{designation}</strong></div>
                      <div><span className="text-slate-500">Department:</span> <strong>{department}</strong></div>
                      <div><span className="text-slate-500">Country Scope:</span> <strong>{selectedCountry?.name || "Global Scope"}</strong></div>
                      <div><span className="text-slate-500">Assigned Branch:</span> <strong>{branchCode || selectedMainBranch?.name || "Main Branch"}</strong></div>
                      <div><span className="text-slate-500">KYC Status:</span> <strong className="text-emerald-600">{kycStatus === "VERIFIED" ? "Verified & Compliant" : "Pending Verification"}</strong></div>
                      <div><span className="text-slate-500">CNIC / ID:</span> <strong className="font-mono">{cnicPassportNo || "Not Provided"}</strong></div>
                    </div>
                  </div>

                  {/* Dynamic Roles & Permissions Matrix */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                        <span>Assigned Role Authorization Matrix ({rbacSummary.roleTitle})</span>
                      </Label>
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded font-bold border border-blue-200 dark:border-blue-800">
                        {rbacSummary.accessibleModules.length} Modules Authorized
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] sticky top-0">
                          <tr>
                            <th className="p-2">Module</th>
                            <th className="p-2 text-center">View</th>
                            <th className="p-2 text-center">Create</th>
                            <th className="p-2 text-center">Edit</th>
                            <th className="p-2 text-center">Delete</th>
                            <th className="p-2 text-center">Approve</th>
                            <th className="p-2 text-center">Export</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {rbacSummary.accessibleModules.map((m) => (
                            <tr key={m.moduleKey} className="hover:bg-slate-50/50">
                              <td className="p-2 font-medium text-slate-900 dark:text-slate-100">{m.moduleName}</td>
                              <td className="p-2 text-center">{m.canView ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-2 text-center">{m.canCreate ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-2 text-center">{m.canEdit ? <span className="text-blue-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-2 text-center">{m.canDelete ? <span className="text-red-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-2 text-center">{m.canPostApprove ? <span className="text-purple-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="p-2 text-center">{m.canPrintExport ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">-</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Password & Security Credentials */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Account Password *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="h-9 text-xs pr-8"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2 text-slate-400">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Confirm Password *</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Footer Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={prev}
                  disabled={step === 1}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{tr("previous")}</span>
                </Button>

                {step < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={next}
                    disabled={!isStepValid(step)}
                    className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <span>{tr("next")}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {savedUserData && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowProfileModal(true)}
                        className="gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Profile Report</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={finish}
                      disabled={saving || !isStepValid(4)}
                      className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-4"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{saving ? tr("savingText") : tr("saveUser")}</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side Live User ID Card & KYC Status (5 Columns) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Live Persistent User Card</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                kycStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {kycStatus === "VERIFIED" ? "Verified" : "Pending KYC"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("fullName")}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{fullName || "User Name"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("username")}:</span>
                <span className="font-mono font-bold text-emerald-600">{loginUsername || userCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("designation")}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("department")}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("role")}:</span>
                <span className="font-bold text-blue-600 uppercase">{role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("country")}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedCountry?.name || "Global Scope"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("assignedBranch")}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{branchCode || selectedMainBranch?.name || "Main Branch"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">{tr("cnicPassport")}:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{cnicPassportNo || "Not Provided"}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-slate-500 font-semibold">Vault Reference:</span>
                <span className="font-mono font-bold text-purple-600">{`VAULT-DGT-${userCode}`}</span>
              </div>
            </div>

            {savedUserData && (
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  onClick={() => setShowProfileModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Open Full User Profile Report</span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Full User Profile Report Modal */}
      {savedUserData && (
        <UserProfileReportModal
          user={savedUserData}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onEdit={(id) => {
            setShowProfileModal(false);
            setEditUserId(id);
            setStep(1);
          }}
        />
      )}
    </div>
  );
}

export function UserRegistrationWizard(props: { userIdProp?: string }) {
  return <UserRegistrationWizardContent {...props} />;
}
