"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
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
  Pencil,
  RotateCcw,
  XCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  DollarSign,
  Clock,
  Layers,
  Sparkles
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
import { 
  buildRbacRoleSummary, 
  buildAllModulesCapabilities, 
  convertMatrixToPermissions,
  ModulePermissionCapability,
  ERP_MODULE_DEFINITIONS 
} from "@/lib/permissions/rbac-matrix-builder";
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
    en: "Link Employee master records, assign Country & Branch scopes, customize form permissions, verify KYC identity, and issue System Login Credentials.",
    ur: "ملازمین کے ماسٹر ریکارڈز، ملک اور برانچ کے اختیارات، فارم پرمیشنز، KYC تصدیق اور لاگ ان کی تفصیلات مرتب کریں۔",
    ar: "ربط سجلات الموظفين، وتعيين نطاقات الدولة والفرع، وتخصيص صلاحيات النماذج، والتحقق من KYC وإصدار بيانات الدخول.",
    fa: "اتصال به پرسنل، تعیین دسترسی‌های کشور و شعبه، تنظیم مجوزهای فرم‌ها، احراز هویت KYC و صدور اطلاعات ورود.",
    ps: "د کارمندانو اسناد، د هیواد او څانګې واکونه، د فورمو واکونه، د KYC تصدیق او ننوتلو سوابق برابرول."
  },
  step1Label: { en: "1. Employee Information", ur: "1. ملازم کی معلومات", ar: "1. معلومات الموظف", fa: "1. مشخصات پرسنل", ps: "1. د کارمند معلومات" },
  step2Label: { en: "2. Employee & Branch Access", ur: "2. ایمپلائی و برانچ رسائی", ar: "2. صلاحيات الموظف والفرع", fa: "2. دسترسی پرسنل و شعبه", ps: "2. د کارمند او څانګې لاسرسی" },
  step3Label: { en: "3. KYC & Document Verification", ur: "3. کے وائی سی و دستاویزات", ar: "3. التحقق من الهوية (KYC)", fa: "3. احراز هویت (KYC)", ps: "3. د پیژندګلوۍ تصدیق (KYC)" },
  step4Label: { en: "4. Review & Permissions", ur: "4. ریویو و پرمیشنز", ar: "4. المراجعة والصلاحيات", fa: "4. مرور و مجوزها", ps: "4. کتنه او واکونه" },
  next: { en: "Next Step", ur: "اگلا قدم", ar: "الخطوة التالية", fa: "مرحله بعد", ps: "بل ګام" },
  previous: { en: "Previous", ur: "پچھلا", ar: "السابق", fa: "قبلی", ps: "پخوانی" },
  saveUser: { en: "Save & Complete Registration", ur: "محفوظ کریں اور مکمل کریں", ar: "حفظ وإكمال التسجيل", fa: "ذخیره و تکمیل ثبت نام", ps: "خوندي او ثبت بشپړول" },
  savingText: { en: "Saving User Record...", ur: "صارف محفوظ ہو رہا ہے...", ar: "جاري حفظ بيانات المستخدم...", fa: "در حال ذخیره...", ps: "د کارونکي معلومات خوندي کیږي..." },
  printCard: { en: "Print A4 User Card", ur: "A4 یوزر کارڈ پرنٹ کریں", ar: "طباعة بطاقة المستخدم A4", fa: "چاپ کارت کاربر A4", ps: "د A4 د کارونکي کارت چاپول" },
  addNewUser: { en: "New User Registration", ur: "نیا صارف رجسٹر کریں", ar: "تسجيل مستخدم جديد", fa: "ثبت کاربر جدید", ps: "نوی کارونکی ثبت کړئ" },
  selectEmployee: { en: "Select Registered Employee (Master Profile)", ur: "رجسٹرڈ ایمپلائی منتخب کریں (ماسٹر پروفائل)", ar: "اختر الموظف المسجل (الملف التعريفي الرئيسي)", fa: "انتخاب پرسنل ثبت شده (پروفایل اصلی)", ps: "ثبت شوی کارمند وټاکئ (اصلي پروفایل)" },
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
  optionalHint: { en: "(Auto-filled from Employee Master)", ur: "(ملازم کے ماسٹر ریکارڈ سے خودکار بھرا گیا)", ar: "(تم التعبئة تلقائياً من سجل الموظف)", fa: "(تکمیل خودکار از پرونده پرسنل)", ps: "(د کارمند له ماسټر ریکارډ څخه اتومات ډک شوی)" },
  addNewEmployee: { en: "Add New Employee", ur: "نیا ملازم شامل کریں", ar: "إضافة موظف جديد", fa: "افزودن پرسنل جدید", ps: "نوی کارمند اضافه کړئ" },
  newEmployeeModalTitle: { en: "New Employee Registration", ur: "نیا ملازم رجسٹریشن", ar: "تسجيل موظف جديد", fa: "ثبت پرسنل جدید", ps: "د نوي کارمند ثبت" },
  employeeSearchPlaceholder: { en: "Search employee by code, name, designation...", ur: "کوڈ، نام یا عہدہ سے ملازم تلاش کریں...", ar: "ابحث عن الموظف بالرمز أو الاسم أو المسمى الوظيفي...", fa: "جستجوی پرسنل با کد، نام یا عنوان شغلی...", ps: "کارمند د کوډ، نوم یا دندې له مخې پلټئ..." },
  noEmployeesFound: { en: "No matching employees found.", ur: "کوئی مماثل ملازم نہیں ملا۔", ar: "لم يتم العثور على موظفين مطابقين.", fa: "هیچ پرسنلی مطابقت پیدا نشد.", ps: "هیڅ ورته کارمند ونه موندل شو." },
  genderFilterLabel: { en: "Gender / Staff Filter", ur: "جنس / عملہ فلٹر", ar: "تصفية الجنس / الموظفين", fa: "فیلتر جنسیت / پرسنل", ps: "د جنسیت / کارکوونکو فلټر" },
  genderAll: { en: "All Staff", ur: "تمام عملہ", ar: "جميع الموظفين", fa: "همه پرسنل", ps: "ټول کارکوونکي" },
  genderMale: { en: "Male", ur: "مرد", ar: "ذكر", fa: "مرد", ps: "نارینه" },
  genderFemale: { en: "Female", ur: "خاتون", ar: "أنثى", fa: "زن", ps: "ښځینه" },
  firstNameLabel: { en: "First Name *", ur: "پہلا نام *", ar: "الاسم الأول *", fa: "نام کوچک *", ps: "لومړی نوم *" },
  lastNameLabel: { en: "Surname / Last Name *", ur: "خاندانی / آخری نام *", ar: "اسم العائلة / اللقب *", fa: "نام خانوادگی *", ps: "تخلص / وروستی نوم *" },
  selectedEmployeeBanner: { en: "Selected Employee Master Profile", ur: "منتخب کردہ ملازم کا ماسٹر پروفائل", ar: "الملف التعريفي للموظف المختار", fa: "پروفایل پرسنل انتخاب شده", ps: "ټاکل شوی کارمند پروفایل" },
  changeSelection: { en: "Change / Clear", ur: "تبدیل / صاف کریں", ar: "تغيير / مسح", fa: "تغییر / حذف", ps: "بدلول / پاکول" },
  viewMasterRecord: { en: "View Full Master Record", ur: "مکمل ماسٹر ریکارڈ دیکھیں", ar: "عرض السجل الرئيسي الكامل", fa: "مشاهده کامل پرونده", ps: "بشپړ ریکارډ کتل" }
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
  const [viewEmployeeId, setViewEmployeeId] = useState<string | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);

  // Modal for viewing full saved user profile
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savedUserData, setSavedUserData] = useState<UserProfileData | null>(null);

  // HR Employees list for Step 1 dropdown
  const [hrEmployees, setHrEmployees] = useState<any[]>([]);
  const [hrEmployeesLoading, setHrEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  // Complete Detailed Employee Master Profile State
  const [employeeProfile, setEmployeeProfile] = useState<{
    personMasterId?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
    employeeCode?: string;
    gender?: string;
    designation?: string;
    department?: string;
    employmentType?: string;
    jobStatus?: string;
    workingShift?: string;
    dutyStartTime?: string;
    dutyEndTime?: string;
    joiningDate?: string;
    contractStartDate?: string;
    contractEndDate?: string;
    basicSalary?: number;
    salaryCurrency?: string;
    salaryType?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    countryName?: string;
    cityName?: string;
    photoUrl?: string;
  }>({});

  // Step 1: User Core State
  const [userCode, setUserCode] = useState("");
  useEffect(() => {
    setUserCode((current) => current || makeAutoUserCode());
  }, []);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

  // Step 4: Login Password & Custom Permissions Matrix
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Active Category Filter for Permissions Table
  const [selectedPermissionCategory, setSelectedPermissionCategory] = useState<string>("All Categories");

  // Interactive Form/Module Capabilities State (Manually assignable checkboxes)
  const [moduleCapabilities, setModuleCapabilities] = useState<ModulePermissionCapability[]>(() => {
    return buildAllModulesCapabilities("staff_user", enterpriseRolePermissions["staff_user"]);
  });

  // When role changes, pre-populate default module capabilities for that role
  useEffect(() => {
    setModuleCapabilities(buildAllModulesCapabilities(role, enterpriseRolePermissions[role] || []));
  }, [role]);

  // Editing User
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isResettingBranch, setIsResettingBranch] = useState(true);

  // Toggle individual capability checkbox for a module
  const handleToggleCapability = (moduleKey: string, field: "canView" | "canCreate" | "canEdit" | "canDelete" | "canPostApprove" | "canPrintExport") => {
    setModuleCapabilities(prev => prev.map(mod => {
      if (mod.moduleKey === moduleKey) {
        const nextVal = !mod[field];
        const updated = { ...mod, [field]: nextVal };
        if (field !== "canView" && nextVal && !updated.canView) {
          updated.canView = true;
        }
        if (field === "canView" && !nextVal) {
          updated.canCreate = false;
          updated.canEdit = false;
          updated.canDelete = false;
          updated.canPostApprove = false;
          updated.canPrintExport = false;
        }
        return updated;
      }
      return mod;
    }));
  };

  // Toggle all capabilities for a single module
  const handleToggleAllForModule = (moduleKey: string) => {
    setModuleCapabilities(prev => prev.map(mod => {
      if (mod.moduleKey === moduleKey) {
        const hasAll = mod.canView && mod.canCreate && mod.canEdit && mod.canDelete && mod.canPostApprove && mod.canPrintExport;
        const target = !hasAll;
        return {
          ...mod,
          canView: target,
          canCreate: target,
          canEdit: target,
          canDelete: target,
          canPostApprove: target,
          canPrintExport: target
        };
      }
      return mod;
    }));
  };

  // Toggle all capabilities for an entire category
  const handleToggleCategory = (categoryName: string, grant: boolean) => {
    setModuleCapabilities(prev => prev.map(mod => {
      if (categoryName === "All Categories" || mod.category === categoryName) {
        return {
          ...mod,
          canView: grant,
          canCreate: grant,
          canEdit: grant,
          canDelete: grant,
          canPostApprove: grant,
          canPrintExport: grant
        };
      }
      return mod;
    }));
  };

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

  // When Employee is selected or language changes, populate rich profile across steps
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeCode("");
      setEmployeeProfile({});
      return;
    }
    const emp = hrEmployees.find((e) => e.id === selectedEmployeeId);
    if (emp) {
      const empName = emp.person?.customer_name || emp.name || emp.full_name || "";
      const code = emp.employee_code || emp.code || "EMP-001";
      setFullName(empName);
      setEmployeeCode(code);
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

      if (emp.person?.national_id_or_passport || emp.person?.tax_id) {
        setCnicPassportNo(emp.person.national_id_or_passport || emp.person.tax_id || "");
      }
      if (emp.person?.address) {
        setResidentialAddress(emp.person.address);
      }

      // Extract first/last name
      const nameParts = empName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

      // Populate rich employee master profile object
      setEmployeeProfile({
        personMasterId: emp.person_master_id || emp.person?.id,
        firstName,
        middleName,
        lastName,
        fullName: empName,
        employeeCode: code,
        designation: emp.designation || "Staff",
        department: emp.department || "General Office",
        employmentType: emp.employmentType || emp.employment_type || "Full-Time",
        jobStatus: emp.jobStatus || emp.job_status || "Active",
        workingShift: emp.workingShift || emp.working_shift || "General Day Shift",
        dutyStartTime: emp.dutyStartTime || emp.duty_start_time || "09:00 AM",
        dutyEndTime: emp.dutyEndTime || emp.duty_end_time || "06:00 PM",
        joiningDate: emp.joiningDate || emp.joining_date,
        contractStartDate: emp.contractStartDate || emp.contract_start_date,
        contractEndDate: emp.contractEndDate || emp.contract_end_date,
        basicSalary: emp.basicSalary || emp.basic_salary || 0,
        salaryCurrency: emp.salaryCurrency || emp.salary_currency || "USD",
        salaryType: emp.salaryType || emp.salary_type || "Monthly",
        phone: emp.person?.mobile,
        whatsapp: emp.person?.whatsapp || emp.person?.mobile,
        email: emp.person?.email,
        address: emp.person?.address,
        countryName: emp.country?.name,
        cityName: emp.city_branch?.name || emp.city_branch?.cityName,
        photoUrl: emp.photo_url || emp.person?.photo_url
      });
    }
  }, [selectedEmployeeId, hrEmployees, activeLang]);

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
        if (data.employeeId) setSelectedEmployeeId(data.employeeId);

        if (data.countryBranchId && !data.cityBranchId) {
          setBranchType("main");
          setCountryBranchId(data.countryBranchId);
          setCityBranchId("");
        } else if (data.cityBranchId) {
          setBranchType("city");
          setCityBranchId(data.cityBranchId);
        }

        if (Array.isArray(data.permissions) && data.permissions.length > 0) {
          setModuleCapabilities(buildAllModulesCapabilities(data.role || "staff_user", data.permissions));
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

  const filteredHrEmployees = useMemo(() => {
    if (genderFilter === "all") return hrEmployees;
    return hrEmployees.filter((e) => {
      const g = (e.gender || e.person?.gender || "").toLowerCase();
      if (genderFilter === "male") return g.startsWith("m") || g === "male" || g === "مرد" || !g;
      if (genderFilter === "female") return g.startsWith("f") || g === "female" || g === "خاتون" || g === "زن";
      return true;
    });
  }, [hrEmployees, genderFilter]);

  const employeeOptions = useMemo(
    () =>
      filteredHrEmployees.map((e) => {
        const empName = e.person?.customer_name || e.name || e.full_name || "Employee";
        const empCode = e.employee_code || e.code || "EMP";
        const desig = e.designation ? ` • ${e.designation}` : "";
        const branch = e.country_branch?.name || e.city_branch?.name ? ` • ${e.country_branch?.name || e.city_branch?.name}` : "";
        const isFemale = (e.gender || e.person?.gender || "").toLowerCase().startsWith("f");
        const genderBadge = isFemale ? " [♀ Female]" : " [♂ Male]";

        const pNames = empName.trim().split(" ");
        const fName = e.first_name || e.person?.first_name || pNames[0] || "";
        const lName = e.last_name || e.person?.last_name || (pNames.length > 1 ? pNames.slice(1).join(" ") : "");

        return {
          value: e.id,
          label: `${fName} ${lName ? lName + " " : ""}(${empCode}${desig}${branch})${genderBadge}`,
          keywords: `${empName} ${fName} ${lName} ${empCode} ${e.designation ?? ""} ${e.gender ?? ""}`
        };
      }),
    [filteredHrEmployees]
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const branchCode = useMemo(() => {
    if (branchType === "main") return selectedMainBranch?.code ?? "";
    if (branchType === "city") return selectedCityBranch?.code ?? "";
    return "";
  }, [branchType, selectedMainBranch, selectedCityBranch]);

  // Derive effective calculated permissions from current interactive checkbox state
  const effectivePermissions = useMemo(() => {
    return convertMatrixToPermissions(role, moduleCapabilities);
  }, [role, moduleCapabilities]);

  const rbacSummary = useMemo(() => {
    return buildRbacRoleSummary(role, effectivePermissions);
  }, [role, effectivePermissions]);

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

    let fallbackCountryId = countries[0]?.id || null;
    let fallbackCountryBranchId = mainBranches[0]?.id || null;
    let fallbackCityBranchId = cityBranches[0]?.id || null;

    let resolvedCountryId: string | null = countryId || fallbackCountryId;
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
      resolvedCountryBranchId = countryBranchId || fallbackCountryBranchId;
      resolvedCityBranchId = null;
    } else {
      resolvedCityBranchId = cityBranchId || fallbackCityBranchId;
      resolvedCountryBranchId = countryBranchId || selectedCityBranch?.country_branch_id || fallbackCountryBranchId;
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
        employeeId: selectedEmployeeId || null,
        personMasterId: employeeProfile.personMasterId || null,
        firstName: employeeProfile.firstName || null,
        middleName: employeeProfile.middleName || null,
        lastName: employeeProfile.lastName || null,
        photoUrl: employeeProfile.photoUrl || null,
        permissions: effectivePermissions
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
        firstName: employeeProfile.firstName,
        middleName: employeeProfile.middleName,
        lastName: employeeProfile.lastName,
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
        permissions: effectivePermissions,
        moduleCapabilities: moduleCapabilities,
        employmentType: employeeProfile.employmentType,
        jobStatus: employeeProfile.jobStatus,
        workingShift: employeeProfile.workingShift,
        joiningDate: employeeProfile.joiningDate,
        contractStartDate: employeeProfile.contractStartDate,
        contractEndDate: employeeProfile.contractEndDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setSavedUserData(completedUser);
      setBanner({ tone: "ok", text: isEdit ? "User profile & customized RBAC permissions updated successfully." : "User registered & customized RBAC permissions saved successfully." });
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
      title: "Comprehensive User Profile & Authorization Report",
      subtitle: "Official Centralized ERP User Registry Record",
      userData: {
        userId: editUserId || "USR-PREVIEW",
        userCode: userCode,
        fullName: fullName || "User Name",
        firstName: employeeProfile.firstName,
        middleName: employeeProfile.middleName,
        lastName: employeeProfile.lastName,
        countryName: selectedCountry?.name || "Pakistan",
        branchName: (branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "Main Branch",
        branchCode: branchCode || "PK-MAIN-001",
        branchType: designation || "Company Staff",
        role: role,
        registrationDate: new Date().toISOString(),
        status: "Active",
        permissions: effectivePermissions,
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
        employmentType: employeeProfile.employmentType,
        joiningDate: employeeProfile.joiningDate,
        contractStartDate: employeeProfile.contractStartDate,
        contractEndDate: employeeProfile.contractEndDate,
        jobStatus: employeeProfile.jobStatus,
        workingShift: employeeProfile.workingShift,
        lastActivity: new Date().toISOString(),
        lastActivityAction: "user.registered",
        rawPassword: `VAULT-DGT-${userCode}`
      },
      lang: activeLang
    });
  };

  const allowedModulesCount = moduleCapabilities.filter(m => m.canView || m.canCreate || m.canEdit).length;
  const restrictedModulesCount = moduleCapabilities.filter(m => !m.canView && !m.canCreate && !m.canEdit).length;

  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    ERP_MODULE_DEFINITIONS.forEach(m => cats.add(m.category));
    return ["All Categories", ...Array.from(cats)];
  }, []);

  const filteredModuleCapabilities = useMemo(() => {
    if (selectedPermissionCategory === "All Categories") return moduleCapabilities;
    return moduleCapabilities.filter(m => m.category === selectedPermissionCategory);
  }, [moduleCapabilities, selectedPermissionCategory]);

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
                setEmployeeProfile({});
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
              {/* STEP 1: Employee Master Profile Information */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Gender / Category Filter Tabs */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-blue-600" />
                        <span>{tr("genderFilterLabel")}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Filter registered profiles</span>
                    </Label>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 p-0.5 gap-1">
                      <button
                        type="button"
                        onClick={() => setGenderFilter("all")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                          genderFilter === "all"
                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-700"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        {tr("genderAll")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenderFilter("male")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                          genderFilter === "male"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 dark:text-slate-400 hover:text-blue-600"
                        }`}
                      >
                        <span>♂</span>
                        <span>{tr("genderMale")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenderFilter("female")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                          genderFilter === "female"
                            ? "bg-pink-600 text-white shadow-sm"
                            : "text-slate-600 dark:text-slate-400 hover:text-pink-600"
                        }`}
                      >
                        <span>♀</span>
                        <span>{tr("genderFemale")}</span>
                      </button>
                    </div>
                  </div>

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
                    onViewOption={(empId) => setViewEmployeeId(empId)}
                    onEditOption={(empId) => setEditEmployeeId(empId)}
                  />

                  {/* Selected Employee Master Profile Banner */}
                  {selectedEmployeeId && employeeProfile.fullName && (
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-slate-50 p-3.5 space-y-2.5 dark:border-blue-900/50 dark:from-blue-950/30 dark:to-slate-900 shadow-sm">
                      <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/50 pb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm overflow-hidden shrink-0">
                            {employeeProfile.photoUrl ? (
                              <img src={employeeProfile.photoUrl} alt="Employee" className="h-full w-full object-cover" />
                            ) : (
                              <span>{employeeProfile.gender?.toLowerCase().startsWith("f") ? "♀" : "♂"}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {employeeProfile.fullName}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                employeeProfile.gender?.toLowerCase().startsWith("f")
                                  ? "bg-pink-50 text-pink-700 border-pink-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}>
                                {employeeProfile.gender || "Staff"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {employeeProfile.employeeCode} • {employeeProfile.designation} • {employeeProfile.department}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewEmployeeId(selectedEmployeeId)}
                            className="h-7 px-2 text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-100/50 dark:text-blue-300"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {tr("viewMasterRecord")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedEmployeeId("");
                              setEmployeeCode("");
                              setEmployeeProfile({});
                            }}
                            className="h-7 px-2 text-[11px] font-semibold text-slate-600 hover:text-red-600 border-slate-200 hover:border-red-200"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {tr("changeSelection")}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <div><span className="text-slate-400">Branch:</span> <span className="font-semibold">{employeeProfile.cityName || "Main Branch"}</span></div>
                        <div><span className="text-slate-400">Employment:</span> <span className="font-semibold">{employeeProfile.employmentType || "Full-Time"}</span></div>
                        <div><span className="text-slate-400">Phone:</span> <span className="font-mono">{employeeProfile.phone || contactPhone || "-"}</span></div>
                        <div><span className="text-slate-400">Shift:</span> <span>{employeeProfile.workingShift || "General Shift"}</span></div>
                      </div>
                    </div>
                  )}

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

                  {editEmployeeId ? (
                    <SimpleModal
                      title="Edit Employee Master Record"
                      onClose={() => setEditEmployeeId(null)}
                      className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
                    >
                      <EmployeeForm
                        employeeId={editEmployeeId}
                        onSave={async (savedId) => {
                          setEditEmployeeId(null);
                          const freshList = await fetchHrEmployees();
                          if (savedId && freshList.some((e) => e.id === savedId)) {
                            setSelectedEmployeeId(savedId);
                          }
                        }}
                        onCancel={() => setEditEmployeeId(null)}
                      />
                    </SimpleModal>
                  ) : null}

                  {viewEmployeeId ? (
                    <EmployeeDetailModal
                      employeeId={viewEmployeeId}
                      employees={hrEmployees}
                      onClose={() => setViewEmployeeId(null)}
                      onEdit={(empId) => {
                        setViewEmployeeId(null);
                        setEditEmployeeId(empId);
                      }}
                    />
                  ) : null}

                  {/* Core Identity Fields with First Name & Surname Split */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("firstNameLabel")}</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFirstName(val);
                          const combined = `${val} ${lastName}`.trim();
                          setFullName(combined);
                          if (!loginUsername || loginUsername.includes(".")) {
                            setLoginUsername(`${val}.${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "."));
                          }
                        }}
                        placeholder="e.g. Muhammad"
                        className="h-9 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("lastNameLabel")}</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLastName(val);
                          const combined = `${firstName} ${val}`.trim();
                          setFullName(combined);
                          if (!loginUsername || loginUsername.includes(".")) {
                            setLoginUsername(`${firstName}.${val}`.toLowerCase().replace(/[^a-z0-9]/g, "."));
                          }
                        }}
                        placeholder="e.g. Ali Shah"
                        className="h-9 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("fullName")}</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFullName(val);
                          const parts = val.trim().split(" ");
                          setFirstName(parts[0] || "");
                          setLastName(parts.length > 1 ? parts.slice(1).join(" ") : "");
                        }}
                        placeholder="e.g. Muhammad Ali Shah"
                        className="h-9 text-xs font-medium bg-slate-50/50 dark:bg-slate-900/50"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("username")}</Label>
                      <Input
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. muhammad.ali"
                        className="h-9 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("designation")}</Label>
                      <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Senior Accountant" className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("department")}</Label>
                      <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Finance & Accounts" className="h-9 text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("phone")}</Label>
                      <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+92 300 1234567" className="h-9 text-xs font-mono" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("email")}</Label>
                      <Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="user@dgt.llc" className="h-9 text-xs font-mono" />
                    </div>
                  </div>

                  {/* Additional Employee Master Fields if Linked */}
                  {selectedEmployeeId && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2 text-xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b pb-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                        <span>Linked Employment Contract & Schedule Data</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-slate-500">Employment Type:</span> <strong>{employeeProfile.employmentType || "Full-Time"}</strong></div>
                        <div><span className="text-slate-500">Job Status:</span> <strong>{employeeProfile.jobStatus || "Active"}</strong></div>
                        <div><span className="text-slate-500">Working Shift:</span> <strong>{employeeProfile.workingShift || "Day Shift"}</strong></div>
                        <div><span className="text-slate-500">Duty Hours:</span> <strong>{`${employeeProfile.dutyStartTime || "09:00 AM"} - ${employeeProfile.dutyEndTime || "06:00 PM"}`}</strong></div>
                        <div><span className="text-slate-500">Contract End:</span> <strong>{employeeProfile.contractEndDate || "Permanent"}</strong></div>
                        <div><span className="text-slate-500">Salary Schedule:</span> <strong>{`${employeeProfile.salaryType || "Monthly"} (${employeeProfile.salaryCurrency || "USD"})`}</strong></div>
                      </div>
                    </div>
                  )}
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
                        options={cityBranches.map((b) => ({ value: b.id, label: `${b.city_name || (b as any).cityName || ""} - ${b.name} (${b.code})`, keywords: `${b.name} ${b.city_name || (b as any).cityName || ""}` }))}
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
                    <span>KYC details are synchronized with the Employee Master Record and stored securely.</span>
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

              {/* STEP 4: Review & Complete + MANUALLY ASSIGNABLE PERMISSION MATRIX */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Summary of Steps 1-3 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100 border-b pb-1 flex items-center justify-between">
                      <span>User & Master Profile Summary</span>
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

                  {/* MANUALLY ASSIGNABLE FORM/MODULE PERMISSIONS MATRIX */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>Interactive Form / Module Permission Matrix</span>
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-bold border border-emerald-200 dark:border-emerald-800">
                          {allowedModulesCount} Allowed
                        </span>
                        <span className="text-[10px] font-mono text-red-600 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded font-bold border border-red-200 dark:border-red-800">
                          {restrictedModulesCount} Restricted
                        </span>
                      </div>
                    </div>

                    {/* Category Filter & Global Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {categoriesList.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedPermissionCategory(cat)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                              selectedPermissionCategory === cat
                                ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(selectedPermissionCategory, true)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(selectedPermissionCategory, false)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Matrix Table */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[9px] sticky top-0 z-10">
                          <tr>
                            <th className="p-2.5">Module / Form</th>
                            <th className="p-2 text-center">View</th>
                            <th className="p-2 text-center">Create</th>
                            <th className="p-2 text-center">Edit</th>
                            <th className="p-2 text-center">Delete</th>
                            <th className="p-2 text-center">Approve</th>
                            <th className="p-2 text-center">Export</th>
                            <th className="p-2 text-center">All</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                          {filteredModuleCapabilities.map((mod) => (
                            <tr key={mod.moduleKey} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">
                                <div>{mod.moduleName}</div>
                                <div className="text-[9px] text-slate-400 font-normal">{mod.category}</div>
                              </td>
                              
                              {/* View Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canView}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canView")}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Create Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canCreate}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canCreate")}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Edit Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canEdit}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canEdit")}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              {/* Delete Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canDelete}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canDelete")}
                                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                />
                              </td>

                              {/* Approve Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canPostApprove}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canPostApprove")}
                                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                              </td>

                              {/* Export Checkbox */}
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={mod.canPrintExport}
                                  onChange={() => handleToggleCapability(mod.moduleKey, "canPrintExport")}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>

                              {/* Toggle All Checkbox */}
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllForModule(mod.moduleKey)}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                                  title="Toggle all permissions for this module"
                                >
                                  {mod.canView && mod.canCreate && mod.canEdit && mod.canDelete && mod.canPostApprove && mod.canPrintExport ? "None" : "All"}
                                </button>
                              </td>
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
                        <Eye className="h-3.5 w-3.5" />
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

        {/* Right Side COMPLETE LIVE REGISTRATION REPORT (5 Columns) */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-950">
            
            {/* Live Card Header with Photo & Name */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-slate-900 text-emerald-400 font-bold flex items-center justify-center border border-slate-800 shadow-inner overflow-hidden shrink-0">
                  {employeeProfile.photoUrl ? (
                    <img src={employeeProfile.photoUrl} alt="Employee" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">
                      {employeeProfile.gender?.toLowerCase().startsWith("f") ? "♀" : "♂"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate block">
                      {fullName || (firstName ? `${firstName} ${lastName}`.trim() : "Employee Name")}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                      employeeProfile.gender?.toLowerCase().startsWith("f")
                        ? "bg-pink-50 text-pink-700 border-pink-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {employeeProfile.gender || (genderFilter === "female" ? "Female" : genderFilter === "male" ? "Male" : "General Staff")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="font-mono text-emerald-600 font-bold">{employeeCode || userCode}</span>
                    <span>•</span>
                    <span className="truncate">{designation}</span>
                  </div>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                kycStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {kycStatus === "VERIFIED" ? "Verified" : "Pending KYC"}
              </span>
            </div>

            {/* Section 1: Complete Employee Master Profile (Step 1+) */}
            <div className="space-y-2 text-xs">
              <div className="font-bold text-[11px] text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>1. Employee Master & Employment</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pl-1 text-[11px] text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">First Name:</span> <span className="font-semibold">{firstName || "-"}</span></div>
                <div><span className="text-slate-400">Surname / Last:</span> <span className="font-semibold">{lastName || "-"}</span></div>
                <div><span className="text-slate-400">Department:</span> <span className="font-semibold">{department}</span></div>
                <div><span className="text-slate-400">Employment:</span> <span>{employeeProfile.employmentType || "Full-Time"}</span></div>
                <div><span className="text-slate-400">Shift:</span> <span>{employeeProfile.workingShift || "Day Shift"}</span></div>
                <div><span className="text-slate-400">Job Status:</span> <span>{employeeProfile.jobStatus || "Active Permanent"}</span></div>
                <div><span className="text-slate-400">Phone:</span> <span>{contactPhone || "-"}</span></div>
                <div><span className="text-slate-400">WhatsApp:</span> <span>{employeeProfile.whatsapp || contactPhone || "-"}</span></div>
                <div className="col-span-2"><span className="text-slate-400">Email:</span> <span className="font-medium truncate">{personalEmail || "user@dgt.llc"}</span></div>
                <div className="col-span-2 border-t pt-1 mt-0.5"><span className="text-slate-400">Address:</span> <span className="font-medium text-slate-800 dark:text-slate-200">{residentialAddress || "Not Provided"}</span></div>
              </div>
            </div>

            {/* Section 2: Country & Branch Scope (Step 2+) */}
            <div className="space-y-2 text-xs border-t pt-3">
              <div className="font-bold text-[11px] text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>2. Geographic Scope & Branch Access</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pl-1 text-[11px] text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">Country:</span> <span className="font-bold text-slate-900 dark:text-slate-100">{selectedCountry?.name || "Global Scope"}</span></div>
                <div><span className="text-slate-400">Branch:</span> <span className="font-semibold">{branchCode || selectedMainBranch?.name || "Main Branch"}</span></div>
                <div><span className="text-slate-400">Currency:</span> <span className="font-mono font-bold text-emerald-600">{selectedMainBranch?.local_currency || "USD"}</span></div>
                <div><span className="text-slate-400">Role:</span> <span className="font-bold text-blue-600 uppercase">{role}</span></div>
              </div>
            </div>

            {/* Section 3: KYC & Security Credentials (Step 3+) */}
            <div className="space-y-2 text-xs border-t pt-3">
              <div className="font-bold text-[11px] text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>3. KYC & Credential Vault</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 pl-1 text-[11px] text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">Login ID:</span> <span className="font-mono font-bold text-emerald-600">{loginUsername || userCode}</span></div>
                <div><span className="text-slate-400">CNIC/Passport:</span> <span className="font-mono font-bold">{cnicPassportNo || "Not Provided"}</span></div>
                <div><span className="text-slate-400">Expiry Date:</span> <span>{idExpiryDate || "Permanent"}</span></div>
                <div><span className="text-slate-400">Vault Ref:</span> <span className="font-mono font-bold text-purple-600">{`VAULT-DGT-${userCode}`}</span></div>
              </div>
            </div>

            {/* Section 4: Live Interactive Permission Breakdown (Step 4+) */}
            <div className="space-y-2 text-xs border-t pt-3">
              <div className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span>4. Assigned Permissions ({allowedModulesCount}/20)</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-mono font-bold">{effectivePermissions.length} rules</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-center">
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">View</span><strong className="text-emerald-600 text-xs">{moduleCapabilities.filter(m => m.canView).length}</strong></div>
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">Create</span><strong className="text-emerald-600 text-xs">{moduleCapabilities.filter(m => m.canCreate).length}</strong></div>
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">Edit</span><strong className="text-blue-600 text-xs">{moduleCapabilities.filter(m => m.canEdit).length}</strong></div>
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">Delete</span><strong className="text-red-600 text-xs">{moduleCapabilities.filter(m => m.canDelete).length}</strong></div>
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">Approve</span><strong className="text-purple-600 text-xs">{moduleCapabilities.filter(m => m.canPostApprove).length}</strong></div>
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-900 border"><span className="text-slate-400 block">Export</span><strong className="text-emerald-600 text-xs">{moduleCapabilities.filter(m => m.canPrintExport).length}</strong></div>
              </div>
            </div>

            {savedUserData && (
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  onClick={() => setShowProfileModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1.5 shadow-sm"
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

function EmployeeDetailModal({
  employeeId,
  employees,
  onClose,
  onEdit
}: {
  employeeId: string;
  employees: any[];
  onClose: () => void;
  onEdit: (empId: string) => void;
}) {
  const emp = employees.find((e) => e.id === employeeId);

  if (!emp) return null;

  const empName = emp.person?.customer_name || emp.name || emp.full_name || "N/A";
  const code = emp.employee_code || emp.code || "EMP-001";
  const designation = emp.designation || "Staff";
  const department = emp.department || "General Office";
  const status = emp.job_status || emp.jobStatus || "Active";
  const basicSalary = emp.basic_salary || emp.basicSalary || 0;
  const currency = emp.salary_currency || emp.salaryCurrency || "USD";
  const phone = emp.person?.mobile || emp.mobile || "N/A";
  const email = emp.person?.email || emp.email || "N/A";
  const address = emp.person?.address || emp.address || "N/A";
  const joiningDate = emp.joining_date || emp.joiningDate || "N/A";

  const handlePrintCertificate = () => {
    const printWin = window.open("", "_blank", "width=850,height=900");
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Record Sheet - ${code}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .company { font-size: 24px; font-weight: 800; color: #0f172a; }
            .title { font-size: 14px; text-transform: uppercase; tracking: 2px; color: #0284c7; font-weight: 700; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
            .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .label { color: #64748b; }
            .val { font-weight: 600; color: #0f172a; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">DGT ERP SYSTEM</div>
              <div class="title">OFFICIAL EMPLOYEE MASTER PROFILE</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${code}</div>
              <div style="font-size: 12px; color: #64748b;">Status: <strong>${status}</strong></div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">Employee Details</div>
              <div class="row"><span class="label">Full Name:</span><span class="val">${empName}</span></div>
              <div class="row"><span class="label">Designation:</span><span class="val">${designation}</span></div>
              <div class="row"><span class="label">Department:</span><span class="val">${department}</span></div>
              <div class="row"><span class="label">Joining Date:</span><span class="val">${joiningDate}</span></div>
              <div class="row"><span class="label">Basic Salary:</span><span class="val">${currency} ${Number(basicSalary).toLocaleString()}</span></div>
            </div>

            <div class="card">
              <div class="card-title">Contact & Branch Info</div>
              <div class="row"><span class="label">Mobile Phone:</span><span class="val">${phone}</span></div>
              <div class="row"><span class="label">Email Address:</span><span class="val">${email}</span></div>
              <div class="row"><span class="label">Branch:</span><span class="val">${emp.country_branch?.name || emp.city_branch?.name || "Main Office"}</span></div>
              <div class="row"><span class="label">Country:</span><span class="val">${emp.country?.name || "Global"}</span></div>
              <div class="row"><span class="label">Address:</span><span class="val">${address}</span></div>
            </div>
          </div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} | DGT ERP Enterprise Control System
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <SimpleModal
      title={`Employee Master Report - ${code}`}
      onClose={onClose}
      className="max-w-3xl w-[95vw] overflow-hidden"
    >
      <div className="space-y-5 p-1">
        {/* Header Info Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-blue-600/30 border-2 border-blue-400 flex items-center justify-center text-xl font-bold text-blue-200 uppercase">
              {empName.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{empName}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {status}
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-mono mt-0.5">
                Code: <strong className="text-white">{code}</strong> | Designation: <strong className="text-white">{designation}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(employeeId)}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs font-semibold gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Form</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrintCertificate}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-1.5 shadow-md"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Record</span>
            </Button>
          </div>
        </div>

        {/* Detailed Grid Info */}
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Employment Information</span>
            </h4>
            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold">{department}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Joining Date:</span>
                <span className="font-semibold">{joiningDate}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Employment Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Basic Salary:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {currency} {Number(basicSalary).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Contact & Branch Details</span>
            </h4>
            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Mobile Phone:</span>
                <span className="font-mono font-semibold">{phone}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{email}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">Assigned Branch:</span>
                <span className="font-semibold">{emp.country_branch?.name || emp.city_branch?.name || "Main Office"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Address:</span>
                <span className="font-medium truncate max-w-[180px]">{address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}
