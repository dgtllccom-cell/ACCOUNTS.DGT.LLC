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
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t as centralT } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiPost } from "@/lib/api/client";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";
import { UserProfileReportModal, UserProfileData } from "./user-profile-report-modal";
import { ClearingAgentPicker } from "@/features/shipping/components/clearing-agent-picker";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; cityName?: string; local_currency: string; country_branch_id: string };

type WizardStep = 1 | 2 | 3 | 4;

type Banner = { tone: "ok" | "err"; text: string } | null;

const branchTypeOptions = [
  { value: "main", label: "Main Branch", labelKey: "urw2.bt_main" },
  { value: "city", label: "City Branch", labelKey: "urw2.bt_city" }
] as const;

// Which roles are offered per operational domain. A role name can serve both
// worlds — the domain + ledger_visibility on the assignment keeps the data apart.
const DOMAIN_ROLES: Record<"business" | "shipping", EnterpriseRole[]> = {
  business: ["super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "staff_user", "accountant", "cashier", "auditor_viewer"],
  shipping: ["country_admin", "country_user", "main_branch_admin", "city_branch_admin", "staff_user", "agent_user", "auditor_viewer"],
};

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string; labelKey: string; helpKey: string }> = [
  { value: "super_admin", label: "Super Admin", labelKey: "urw2.role_super_admin", help: "Global Scope — Full root control across all countries and branches.", helpKey: "urw2.help_super_admin" },
  { value: "country_admin", label: "Country Admin", labelKey: "urw2.role_country_admin", help: "Country Scope — Full country ledger, branches and management.", helpKey: "urw2.help_country_admin" },
  { value: "country_user", label: "Country Normal User", labelKey: "urw2.role_country_user", help: "Country Scope — Standard operational and transactions access for the country.", helpKey: "urw2.help_country_user" },
  { value: "main_branch_admin", label: "Main Branch Admin", labelKey: "urw2.role_main_branch_admin", help: "Main Branch Scope — Main branch Roznamcha, daily book closing and approvals.", helpKey: "urw2.help_main_branch_admin" },
  { value: "city_branch_admin", label: "City Branch Admin", labelKey: "urw2.role_city_branch_admin", help: "City Branch Scope — City branch management and full branch approvals.", helpKey: "urw2.help_city_branch_admin" },
  { value: "staff_user", label: "City Normal User / Staff", labelKey: "urw2.role_staff_user", help: "City Branch Scope — Standard city branch entry and transactions.", helpKey: "urw2.help_staff_user" },
  { value: "agent_user", label: "Clearing Agent Admin / Agent User", labelKey: "urw2.role_agent_user", help: "Port & Customs Scope — Port clearance, container tracking and customs documentation.", helpKey: "urw2.help_agent_user" },
  { value: "accountant", label: "Accountant", labelKey: "urw2.role_accountant", help: "Financial Scope — Direct journal posting, ledger auditing and bank reconciliation.", helpKey: "urw2.help_accountant" },
  { value: "cashier", label: "Cashier", labelKey: "urw2.role_cashier", help: "Cash Counter Scope — Daily cash receipts, counter payments and cash safe.", helpKey: "urw2.help_cashier" },
  { value: "auditor_viewer", label: "Auditor / Read-Only Viewer", labelKey: "urw2.role_auditor_viewer", help: "Audit Scope — Read-only access to statements, audit trails and journals.", helpKey: "urw2.help_auditor_viewer" }
];

// Wizard labels resolve through the central five-language dictionary
// (lib/i18n/ui.ts → "urw.*"). The strings below are only the t() fallback argument.
const userWizardFallback: Record<string, string> = {
  headerTitleNew: "User Registration & Setup Wizard",
  headerTitleEdit: "Edit System User Record",
  headerDesc: "Link Employee master records, assign Country & Branch scopes, customize form permissions, verify KYC identity, and issue System Login Credentials.",
  step1Label: "1. Employee Information",
  step2Label: "2. Employee & Branch Access",
  step3Label: "3. KYC & Document Verification",
  step4Label: "4. Review & Permissions",
  next: "Next Step",
  previous: "Previous",
  saveUser: "Save & Complete Registration",
  savingText: "Saving User Record...",
  printCard: "Print A4 User Card",
  addNewUser: "New User Registration",
  selectEmployee: "Select Registered Employee (Master Profile)",
  fullName: "User Full Name *",
  username: "Login Username / Identifier *",
  designation: "Designation / Role Title",
  department: "Department",
  phone: "Contact Phone / WhatsApp",
  email: "Personal Email / Identifier",
  role: "System Role Privilege Assignment *",
  country: "Assigned Country Scope *",
  branchType: "Branch Access Scope *",
  assignedBranch: "Assigned Primary Branch *",
  cnicPassport: "National ID / CNIC / Passport Number",
  expiryDate: "Document Expiry Date",
  kycStatus: "KYC Verification Status",
  address: "Permanent Residential Address",
  verifiedCompliant: "Verified & Compliant",
  pendingVerification: "Pending Document Verification",
  optionalHint: "(Auto-filled from Master Record)",
  addNewEmployee: "Add New Employee",
  newEmployeeModalTitle: "New Employee Registration",
  employeeSearchPlaceholder: "Search by code, customer name, employee, designation...",
  noEmployeesFound: "No matching profiles found.",
  genderFilterLabel: "Filter Profiles",
  genderAll: "All Profiles",
  customersOnly: "Customer Management",
  employeesOnly: "Employees",
  genderMale: "Male",
  genderFemale: "Female",
  firstNameLabel: "First Name *",
  lastNameLabel: "Surname / Last Name *",
  selectedEmployeeBanner: "Selected Master Profile",
  changeSelection: "Change / Clear",
  viewMasterRecord: "View Full Master Record"
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

  const tr = (key: string) => centralT(activeLang, ("urw." + key) as never, userWizardFallback[key] ?? key);
  const th = (label: string) => translateHeader(activeLang, label);

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

  // HR Employees & Customer Management profiles for Step 1 dropdown
  const [hrEmployees, setHrEmployees] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [hrEmployeesLoading, setHrEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const [genderFilter, setGenderFilter] = useState<"all" | "customers" | "employees" | "male" | "female">("all");

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
  // Mandatory operational domain — decides which role set + data world the user belongs to.
  const [operationalDomain, setOperationalDomain] = useState<"business" | "shipping">("business");
  const [clearingAgentId, setClearingAgentId] = useState("");
  // Simplified mobile working interface (reuses this same user id / login / scope /
  // permissions). "standard" = full ERP; "mobile_cash_ledger" = Brother User;
  // "mobile_field" = Munshi / field user.
  const [mobileProfile, setMobileProfile] = useState<"standard" | "mobile_cash_ledger" | "mobile_field">("standard");

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

  async function fetchMasterProfiles(): Promise<any[]> {
    setHrEmployeesLoading(true);
    try {
      const [empRes, custRes] = await Promise.all([
        fetch(`/api/erp/hr-payroll/employees?lang=${activeLang}`).then((r) => r.json()).catch(() => ({ employees: [] })),
        fetch(`/api/erp/customers?limit=1000&lang=${activeLang}`).then((r) => r.json()).catch(() => ({ customers: [] }))
      ]);
      if (empRes && empRes.employees && Array.isArray(empRes.employees)) {
        setHrEmployees(empRes.employees);
      }
      if (custRes && custRes.customers && Array.isArray(custRes.customers)) {
        setCustomersList(custRes.customers);
      }
      return empRes?.employees || [];
    } catch (err) {
      console.error("Failed to load master profiles list", err);
    } finally {
      setHrEmployeesLoading(false);
    }
    return [];
  }

  useEffect(() => {
    fetchMasterProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang]);

  // When Employee or Customer is selected or language changes, populate rich profile across steps
  useEffect(() => {
    if (!selectedEmployeeId) {
      setEmployeeCode("");
      setEmployeeProfile({});
      return;
    }

    if (selectedEmployeeId.startsWith("cust_")) {
      const custId = selectedEmployeeId.replace(/^cust_/, "");
      const cust = customersList.find((c) => c.id === custId);
      if (cust) {
        const custName = cust.customer_name || cust.contact_person || cust.company_name || "";
        const nameParts = custName.trim().split(" ");
        const firstNameVal = cust.first_name || nameParts[0] || "";
        const lastNameVal = cust.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
        const middleNameVal = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
        const code = cust.person_code || cust.employee_code || `CUST-${String(custId).slice(-4)}`;

        setFirstName(firstNameVal);
        setLastName(lastNameVal);
        setFullName(custName);
        setEmployeeCode(code);
        if (!loginUsername) {
          setLoginUsername(custName.toLowerCase().replace(/[^a-z0-9]/g, "."));
        }
        if (cust.mobile) setContactPhone(cust.mobile);

        const cleanCode = (userCode || makeAutoUserCode()).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cust.email && !cust.email.includes("@dgt.local")) {
          setPersonalEmail(cust.email);
        } else {
          setPersonalEmail(`${cleanCode}@dgt.llc`);
        }

        const desig = cust.employee_designation || cust.gender || "Customer / Contact";
        const dept = cust.employee_department || "Customer Management";
        setDesignation(desig);
        setDepartment(dept);
        if (cust.country_id) setCountryId(cust.country_id);

        if (cust.national_id_or_passport || cust.tax_id) {
          setCnicPassportNo(cust.national_id_or_passport || cust.tax_id || "");
        }
        if (cust.address) {
          setResidentialAddress(cust.address);
        }

        setEmployeeProfile({
          personMasterId: cust.id,
          firstName: firstNameVal,
          middleName: middleNameVal,
          lastName: lastNameVal,
          fullName: custName,
          employeeCode: code,
          designation: desig,
          department: dept,
          employmentType: "Customer / Representative",
          jobStatus: "Active",
          workingShift: "General Day Shift",
          dutyStartTime: "09:00 AM",
          dutyEndTime: "06:00 PM",
          salaryCurrency: "USD",
          phone: cust.mobile,
          whatsapp: cust.whatsapp || cust.mobile,
          email: cust.email,
          address: cust.address,
          countryName: cust.country_name,
          cityName: cust.city_name,
          photoUrl: cust.photo_url
        });
      }
      return;
    }

    const emp = hrEmployees.find((e) => e.id === selectedEmployeeId);
    if (emp) {
      const empName = emp.person?.customer_name || emp.name || emp.full_name || "";
      const code = emp.employee_code || emp.code || "EMP-001";

      // Extract first/last name
      const nameParts = empName.trim().split(" ");
      const firstNameVal = nameParts[0] || "";
      const lastNameVal = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const middleNameVal = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";

      setFirstName(firstNameVal);
      setLastName(lastNameVal);
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

      // Populate rich employee master profile object
      setEmployeeProfile({
        personMasterId: emp.person_master_id || emp.person?.id,
        firstName: firstNameVal,
        middleName: middleNameVal,
        lastName: lastNameVal,
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
        salaryCurrency: emp.salaryCurrency || emp.salary_currency || (
          (emp.country?.name?.toLowerCase().includes("pakistan") || emp.country_branch?.name?.toLowerCase().includes("pak") || emp.city_branch?.name?.toLowerCase().includes("pak") || emp.employee_code?.startsWith("EMP-000"))
            ? "PKR"
            : "USD"
        ),
        phone: emp.person?.mobile,
        whatsapp: emp.person?.whatsapp || emp.person?.mobile,
        email: emp.person?.email,
        address: emp.person?.address,
        countryName: emp.country?.name,
        cityName: emp.city_branch?.name || emp.city_branch?.cityName,
        photoUrl: emp.photo_url || emp.person?.photo_url
      });
    }
  }, [selectedEmployeeId, hrEmployees, customersList, activeLang]);

  async function fetchSpecificUser(id: string) {
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(id)}`).then((r) => r.json());
      if (res && res.data) {
        const data = res.data;
        setEditUserId(data.userId);
        setFullName(data.fullName || "");
        setUserCode(data.userCode || makeAutoUserCode());
        const resolvedUsername = data.username || data.userCode || (data.email ? data.email.split("@")[0] : "") || "";
        setLoginUsername(resolvedUsername);
        if (data.firstName) setFirstName(data.firstName);
        if (data.lastName) setLastName(data.lastName);
        setRole(data.role || "staff_user");
        if (data.operationalDomain === "shipping") setOperationalDomain("shipping");
        if (data.clearingAgentId) setClearingAgentId(data.clearingAgentId);
        if (data.mobileProfile === "mobile_cash_ledger" || data.mobileProfile === "mobile_field") {
          setMobileProfile(data.mobileProfile);
        }
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

        // Synthesize employeeProfile from user record so left card immediately displays user details
        const empCode = data.userCode || "USR";
        setEmployeeProfile({
          personMasterId: data.personMasterId || null,
          firstName: data.firstName || data.fullName?.split(" ")[0] || "",
          middleName: data.middleName || "",
          lastName: data.lastName || data.fullName?.split(" ").slice(1).join(" ") || "",
          fullName: data.fullName || "",
          employeeCode: empCode,
          designation: data.designation || "Staff",
          department: data.department || "General Office",
          employmentType: "Full-Time",
          jobStatus: data.isActive ? "Active" : "Inactive",
          workingShift: "General Day Shift",
          dutyStartTime: "09:00 AM",
          dutyEndTime: "06:00 PM",
          joiningDate: data.createdAt ? String(data.createdAt).slice(0, 10) : undefined,
          salaryCurrency: "USD",
          phone: data.phone,
          whatsapp: data.phone,
          email: data.email,
          address: data.residentialAddress,
          photoUrl: data.photoUrl
        });

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
        const rows = await listCountries({ withBranchesOnly: true });
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
          fetch(`/api/branch-management/country-branches?countryId=${countryId}&operationalDomain=${operationalDomain}`).then((r) => r.json()),
          fetch(`/api/branch-management/city-branches?countryId=${countryId}&operationalDomain=${operationalDomain}`).then((r) => r.json()),
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
  }, [countryId, operationalDomain]);

  const countryOptions = useMemo(() => countries.map(toCountryOption), [countries]);

  const branchTypeSelectOptions = useMemo(
    () => branchTypeOptions.map((o) => ({ value: o.value, label: centralT(activeLang, o.labelKey as never, o.label) })),
    [activeLang]
  );

  // Combine Employees + Customers into unified profiles list
  const combinedProfiles = useMemo(() => {
    const list: Array<{
      id: string;
      value: string;
      type: "employee" | "customer";
      name: string;
      code: string;
      designation?: string;
      department?: string;
      gender?: string;
      branch?: string;
      country?: string;
      first_name?: string;
      last_name?: string;
    }> = [];

    const seenPersonIds = new Set<string>();

    // 1. Add HR employees first
    for (const e of hrEmployees) {
      const personKey = e.person_master_id || e.person?.id || (e.name || e.full_name || e.person?.customer_name || "").toLowerCase().trim();
      if (personKey) seenPersonIds.add(personKey);
      const empName = e.person?.customer_name || e.name || e.full_name || "Employee";
      const empCode = e.employee_code || e.code || "EMP";
      const branchName = e.city_branch?.name || e.country_branch?.name || undefined;
      const pNames = empName.trim().split(" ");
      list.push({
        id: e.id,
        value: e.id,
        type: "employee",
        name: empName,
        code: empCode,
        designation: e.designation || undefined,
        department: e.department || undefined,
        gender: e.gender || e.person?.gender || undefined,
        branch: branchName,
        country: e.country?.name || undefined,
        first_name: e.first_name || e.person?.first_name || pNames[0] || "",
        last_name: e.last_name || e.person?.last_name || (pNames.length > 1 ? pNames.slice(1).join(" ") : "")
      });
    }

    // 2. Add all Customer Management customers/contacts
    for (const c of customersList) {
      if (seenPersonIds.has(c.id)) continue; // already represented as employee
      const custName = c.customer_name || c.contact_person || c.company_name || "Customer";
      const custCode = c.person_code || c.code || "CUST";
      const pNames = custName.trim().split(" ");
      list.push({
        id: `cust_${c.id}`,
        value: `cust_${c.id}`,
        type: "customer",
        name: custName,
        code: custCode,
        designation: c.employee_designation || c.gender || "Customer / Contact",
        department: c.employee_department || "Customer Management",
        gender: c.gender || undefined,
        branch: c.city_name || undefined,
        country: c.country_name || undefined,
        first_name: c.first_name || pNames[0] || "",
        last_name: c.last_name || (pNames.length > 1 ? pNames.slice(1).join(" ") : "")
      });
    }

    return list;
  }, [hrEmployees, customersList]);

  const filteredProfiles = useMemo(() => {
    if (genderFilter === "all") return combinedProfiles;
    if (genderFilter === "customers") return combinedProfiles.filter((p) => p.type === "customer");
    if (genderFilter === "employees") return combinedProfiles.filter((p) => p.type === "employee");
    if (genderFilter === "male") {
      return combinedProfiles.filter((p) => {
        const g = (p.gender || "").toLowerCase();
        return g.startsWith("m") || g === "male" || g === "مرد" || !g;
      });
    }
    if (genderFilter === "female") {
      return combinedProfiles.filter((p) => {
        const g = (p.gender || "").toLowerCase();
        return g.startsWith("f") || g === "female" || g === "خاتون" || g === "زن";
      });
    }
    return combinedProfiles;
  }, [combinedProfiles, genderFilter]);

  const employeeOptions = useMemo(
    () =>
      filteredProfiles.map((p) => {
        const desig = p.designation ? ` • ${p.designation}` : "";
        const isCustomer = p.type === "customer";
        const isFemale = (p.gender || "").toLowerCase().startsWith("f");
        const typeBadge = isCustomer ? " [Customer]" : isFemale ? " [Female]" : " [Employee]";

        const fName = p.first_name || "";
        const lName = p.last_name || "";

        return {
          value: p.value,
          label: `${fName} ${lName ? lName + " " : ""}(${p.code}${desig})${typeBadge}`,
          keywords: `${p.name} ${fName} ${lName} ${p.code} ${p.designation ?? ""} ${p.department ?? ""} ${p.gender ?? ""} ${p.branch ?? ""} ${isCustomer ? "customer management" : "employee staff"}`,
          primaryText: `${fName} ${lName}`.trim() || p.name,
          secondaryText: `${p.designation || (isCustomer ? "Customer Management" : "Employee")}${p.branch ? " • " + p.branch : ""}`,
          code: p.code,
          branch: p.branch,
          country: p.country
        };
      }),
    [filteredProfiles]
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const branchCode = useMemo(() => {
    if (branchType === "main") return selectedMainBranch?.code ?? "";
    if (branchType === "city") return selectedCityBranch?.code ?? "";
    return "";
  }, [branchType, selectedMainBranch, selectedCityBranch]);

  const effectiveCurrency = useMemo(() => {
    if (branchType === "main" && selectedMainBranch?.local_currency) return selectedMainBranch.local_currency;
    if (branchType === "city" && selectedCityBranch?.local_currency) return selectedCityBranch.local_currency;
    if (selectedCountry?.currency_code) return selectedCountry.currency_code;
    const cName = selectedCountry?.name?.toLowerCase() || "";
    if (cName.includes("pakistan") || (branchCode && branchCode.startsWith("PAK"))) return "PKR";
    if (cName.includes("emirates") || cName.includes("uae") || cName.includes("dubai") || (branchCode && branchCode.startsWith("UAE"))) return "AED";
    if (cName.includes("afghanistan") || (branchCode && branchCode.startsWith("AFG"))) return "AFN";
    if (cName.includes("iran") || (branchCode && branchCode.startsWith("IRN"))) return "IRR";
    if (cName.includes("india") || (branchCode && branchCode.startsWith("IND"))) return "INR";
    return "PKR"; // Default to PKR instead of USD
  }, [branchType, selectedMainBranch, selectedCityBranch, selectedCountry, branchCode]);

  // Derive effective calculated permissions from current interactive checkbox state
  const effectivePermissions = useMemo(() => {
    return convertMatrixToPermissions(role, moduleCapabilities);
  }, [role, moduleCapabilities]);

  const rbacSummary = useMemo(() => {
    return buildRbacRoleSummary(role, effectivePermissions);
  }, [role, effectivePermissions]);

  function isStepValid(currentStep: WizardStep) {
    if (currentStep === 1) {
      return Boolean(selectedEmployeeId || fullName.trim().length >= 2);
    }
    if (currentStep === 2) {
      if (role === "super_admin") return true;
      if (!countryId) return false;
      if (operationalDomain === "shipping" && role === "agent_user" && !clearingAgentId) return false;
      return true;
    }
    if (currentStep === 3) {
      if (!loginUsername.trim()) return false;
      const cleanEmail = personalEmail.trim();
      if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) return false;
      if (!editUserId && (!password || password.length < 8)) return false;
      if (password && confirmPassword && password !== confirmPassword) return false;
      return true;
    }
    if (currentStep === 4) {
      return Boolean(userCode.trim());
    }
    return true;
  }

  function next() {
    if (step === 2 && !personalEmail.trim()) {
      const codeClean = (userCode || makeAutoUserCode()).toLowerCase().replace(/[^a-z0-9]/g, "");
      const userClean = (loginUsername || firstName || fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "");
      setPersonalEmail(`${userClean}.${codeClean}@dgt.llc`);
    }
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  }

  function prev() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  async function finish() {
    setBanner(null);

    if (!fullName || fullName.trim().length < 2) {
      setBanner({ tone: "err", text: centralT(activeLang, "urw2.err_full_name" as never, "User Full Name / Employee selection is required.") });
      return;
    }

    const issuedCode = normalizeUserCode(userCode || "");
    if (!issuedCode) {
      setBanner({ tone: "err", text: centralT(activeLang, "urw2.err_user_code" as never, "User ID / Code is required.") });
      return;
    }

    const cleanEmail = personalEmail.trim();
    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      setBanner({
        tone: "err",
        text: centralT(activeLang, "urw2.err_email_valid" as never, "A valid Login Email Address (e.g. user@dgt.llc or personal@email.com) is required for user login access.")
      });
      return;
    }

    const isEdit = Boolean(editUserId);

    if (!isEdit && (!password || password.length < 8)) {
      setBanner({ tone: "err", text: centralT(activeLang, "urw2.err_pw_login" as never, "Password must be at least 8 characters for login access.") });
      return;
    }

    if (password && password.length < 8) {
      setBanner({ tone: "err", text: centralT(activeLang, "urw2.err_pw_len" as never, "Password must be at least 8 characters.") });
      return;
    }

    if (password && password !== confirmPassword) {
      setBanner({ tone: "err", text: centralT(activeLang, "urw2.err_pw_match" as never, "Confirm Password does not match.") });
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
    let resolvedTargetEmail = cleanEmail;

    setSaving(true);
    try {
      const payload: any = {
        role: role,
        fullName: fullName.trim(),
        userCode: issuedCode,
        username: loginUsername.trim() || issuedCode,
        operationalDomain,
        clearingAgentId: operationalDomain === "shipping" ? (clearingAgentId || null) : null,
        mobileProfile,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        phone: contactPhone.trim(),
        email: cleanEmail,
        designation,
        department,
        cnicPassportNo: cnicPassportNo.trim(),
        idExpiryDate,
        kycStatus,
        residentialAddress: residentialAddress.trim(),
        employeeId: (selectedEmployeeId && !selectedEmployeeId.startsWith("cust_")) ? selectedEmployeeId : null,
        personMasterId: employeeProfile.personMasterId || (selectedEmployeeId?.startsWith("cust_") ? selectedEmployeeId.replace(/^cust_/, "") : null),
        firstName: employeeProfile.firstName || firstName || (fullName.trim().split(" ")[0] || null),
        middleName: employeeProfile.middleName || null,
        lastName: employeeProfile.lastName || lastName || (fullName.trim().split(" ").slice(1).join(" ") || null),
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
        payload.email = cleanEmail;
        payload.password = password;
        payload.preferredLanguage = preferredLanguage;
        const createRes = await apiPost<{ userId: string; userCode: string; email?: string }>("/api/erp/users", payload);
        if (createRes && (createRes as any).userId) {
          resUserId = (createRes as any).userId;
          if ((createRes as any).email) {
            resolvedTargetEmail = (createRes as any).email;
          }
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
        email: resolvedTargetEmail,
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
          text: `A user with email address '${cleanEmail}' has already been registered. Please click "+ Auto-Generate @dgt.llc Email" or use a unique email identifier.`
        });
      } else {
        setBanner({ tone: "err", text: errMsg });
      }
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { number: 1 as const, label: centralT(activeLang, "urw2.step1_title" as never, "Employee & Operational Section"), icon: <Users className="h-4 w-4" /> },
    { number: 2 as const, label: centralT(activeLang, "urw2.step2_title" as never, "Role & Branch Scope"), icon: <MapPin className="h-4 w-4" /> },
    { number: 3 as const, label: centralT(activeLang, "urw2.step3_title" as never, "Login & Mobile Access"), icon: <Lock className="h-4 w-4" /> },
    { number: 4 as const, label: centralT(activeLang, "urw2.step4_title" as never, "Permissions & Confirmation"), icon: <ShieldCheck className="h-4 w-4" /> }
  ];

  const handlePrintCard = () => {
    openUserA4ReportWindow({
      title: centralT(activeLang, "urw2.report_title" as never, "Comprehensive User Profile & Authorization Report"),
      subtitle: centralT(activeLang, "urw2.report_subtitle" as never, "Official Centralized ERP User Registry Record"),
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
              <span>{centralT(activeLang, "urw2.view_user_report" as never, "View User Profile Report")}</span>
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
                  ? "border-[#0F172A] bg-slate-900/5 text-slate-900 dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-300 shadow-sm ring-1 ring-slate-900/20"
                  : isDone
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-[#0F172A] text-white dark:bg-sky-600 shadow-xs"
                    : isDone
                    ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
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

      {/* Success Credentials & Ready to Login Card */}
      {savedUserData && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 shadow-lg text-xs space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800/60 pb-2.5">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100 font-black text-sm">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <span>{centralT(activeLang, "urw2.ready_title" as never, "User Login Account Created & Verified")}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white tracking-wide">
              {savedUserData.status || "ACTIVE"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                {centralT(activeLang, "urw2.login_email" as never, "Login Email Address")}
              </span>
              <strong className="text-sm font-mono font-black text-blue-700 dark:text-blue-400 select-all">
                {savedUserData.email}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                {centralT(activeLang, "urw2.user_code_lbl" as never, "System User ID / Code")}
              </span>
              <strong className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-400 select-all">
                {savedUserData.userCode}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                {centralT(activeLang, "urw2.login_user_lbl" as never, "Username / Identifier")}
              </span>
              <strong className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 select-all">
                {savedUserData.username || savedUserData.userCode}
              </strong>
            </div>
          </div>

          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
            {centralT(
              activeLang,
              "urw2.login_hint" as never,
              "You can now log in immediately at /auth/login using either the Login Email Address or User ID above with your password."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const text = `ERP Credentials:\nUser ID: ${savedUserData.userCode}\nLogin Email: ${savedUserData.email}\nUsername: ${savedUserData.username}\nLogin URL: ${window.location.origin}/auth/login`;
                navigator.clipboard.writeText(text);
                setBanner({ tone: "ok", text: "Login credentials copied to clipboard!" });
              }}
              className="gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Copy Credentials</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => window.open("/auth/login", "_blank")}
              className="gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Go to Login (/auth/login)</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowProfileModal(true)}
              className="gap-1.5 text-xs font-bold"
            >
              <Eye className="h-3.5 w-3.5 text-blue-600" />
              <span>View Profile Report</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePrintCard}
              className="gap-1.5 text-xs font-bold"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print A4 User Card</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditUserId(null);
                setFullName("");
                setLoginUsername("");
                setPersonalEmail("");
                setPassword("");
                setConfirmPassword("");
                setSelectedEmployeeId("");
                setUserCode(makeAutoUserCode());
                setStep(1);
                setBanner(null);
                setSavedUserData(null);
                setEmployeeProfile({});
              }}
              className="gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Register Another User</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Split-Screen Section: Authoritative Employee Summary on LEFT, Wizard Steps on RIGHT */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Authoritative Read-Only Employee Summary Panel (5 Columns on desktop) */}
        <div className="space-y-4 lg:col-span-5 order-2 lg:order-1">
          <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-950">
            {/* Header: Title & Source Badge */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {centralT(activeLang, "urw2.authoritative_summary" as never, "Authoritative Employee Master")}
                </span>
              </div>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                {centralT(activeLang, "urw2.single_source_truth" as never, "Source of Truth")}
              </span>
            </div>

            {selectedEmployeeId && employeeProfile.fullName ? (
              <div className="space-y-4">
                {/* Employee Card: Photo, Name, Code, Badges */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-xl bg-slate-900 text-slate-100 font-bold flex items-center justify-center border border-slate-800 shadow-inner overflow-hidden shrink-0">
                      {employeeProfile.photoUrl ? (
                        <img src={employeeProfile.photoUrl} alt="Employee" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-7 w-7 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate block">
                          {employeeProfile.fullName || fullName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                            employeeProfile.gender?.toLowerCase().startsWith("f")
                              ? "bg-pink-50 text-pink-700 border-pink-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {employeeProfile.gender || "Staff"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                        <span className="text-emerald-600 font-bold">{employeeProfile.employeeCode || employeeCode}</span>
                        <span>•</span>
                        <span className="truncate">{employeeProfile.designation || designation}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {employeeProfile.department || department}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      kycStatus === "VERIFIED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {kycStatus === "VERIFIED"
                      ? centralT(activeLang, "urw2.verified" as never, "Verified & Compliant")
                      : centralT(activeLang, "urw2.pending" as never, "Pending Verification")}
                  </span>
                </div>

                {/* Prominent Master Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedEmployeeId.startsWith("cust_")) {
                        window.open(`/dashboard/customers?id=${selectedEmployeeId.replace(/^cust_/, "")}`, "_blank");
                      } else {
                        setViewEmployeeId(selectedEmployeeId);
                      }
                    }}
                    className="flex-1 h-8 text-[11px] font-bold text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-900"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    <span>{selectedEmployeeId.startsWith("cust_") ? "View Customer Record" : centralT(activeLang, "urw2.view_employee" as never, "View Employee Record")}</span>
                  </Button>
                  {!selectedEmployeeId.startsWith("cust_") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditEmployeeId(selectedEmployeeId)}
                      className="flex-1 h-8 text-[11px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-900"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      <span>{centralT(activeLang, "urw2.edit_employee" as never, "Edit Employee Record")}</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedEmployeeId("");
                      setEmployeeCode("");
                      setEmployeeProfile({});
                    }}
                    className="h-8 px-2 text-[11px] font-semibold text-slate-500 hover:text-red-600"
                    title={centralT(activeLang, "urw2.change_selection" as never, "Change Employee Selection")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Section 1: Employment Details */}
                <div className="space-y-1.5 text-xs rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="font-bold text-[11px] text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{th("Employment Details")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">{th("Type")}:</span>{" "}
                      <span className="font-semibold">{employeeProfile.employmentType || "Full-Time"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Job Status")}:</span>{" "}
                      <span className="font-semibold">{employeeProfile.jobStatus || "Active"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Shift")}:</span>{" "}
                      <span>{employeeProfile.workingShift || "Day Shift"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Duty Hours")}:</span>{" "}
                      <span>{`${employeeProfile.dutyStartTime || "09:00 AM"} - ${employeeProfile.dutyEndTime || "06:00 PM"}`}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Joining")}:</span>{" "}
                      <span>{employeeProfile.joiningDate || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Salary")}:</span>{" "}
                      <span>{`${employeeProfile.salaryType || "Monthly"} (${employeeProfile.salaryCurrency || "USD"})`}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact & Location */}
                <div className="space-y-1.5 text-xs rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="font-bold text-[11px] text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{th("Contact & Location")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">{th("Mobile")}:</span>{" "}
                      <span className="font-mono">{contactPhone || employeeProfile.phone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("WhatsApp")}:</span>{" "}
                      <span className="font-mono">{employeeProfile.whatsapp || contactPhone || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">{th("Email")}:</span>{" "}
                      <span className="font-mono truncate block">{personalEmail || "user@dgt.llc"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">{th("Address")}:</span>{" "}
                      <span className="truncate block">{residentialAddress || employeeProfile.address || "Not Provided"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Identity & Relevant Documents */}
                <div className="space-y-1.5 text-xs rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="font-bold text-[11px] text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>{th("Relevant Documents & KYC")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">{th("CNIC / Passport")}:</span>{" "}
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{cnicPassportNo || "Not Provided"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{th("Expiry Date")}:</span>{" "}
                      <span>{idExpiryDate || "Permanent / Not Set"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">{th("Status")}:</span>{" "}
                      <span className="font-bold text-emerald-600">
                        {kycStatus === "VERIFIED" ? "Verified & Compliant" : "Pending Verification"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Placeholder state when no employee is selected */
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                  <User className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {centralT(activeLang, "urw2.no_employee_title" as never, "No Employee Selected")}
                  </h4>
                  <p className="text-[11px] text-slate-400 italic pt-1">
                    {centralT(
                      activeLang,
                      "urw2.employee_master_note" as never,
                      "Note: Employees must be registered in HR & Payroll / Employee Master before issuing user login credentials."
                    )}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: Streamlined User Registration Wizard (7 Columns on desktop) */}
        <div className="space-y-4 lg:col-span-7 order-1 lg:order-2">
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
              {/* STEP 1: Employee Selection & Operational Domain */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Employee Selection Header */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{tr("selectEmployee")}</span>
                      </div>
                      <div className="inline-flex flex-wrap rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-0.5 gap-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setGenderFilter("all")}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                            genderFilter === "all"
                              ? "bg-slate-900 text-white shadow-xs dark:bg-slate-800"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                        >
                          <Users className="h-3 w-3" />
                          <span>{tr("genderAll")} ({combinedProfiles.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenderFilter("customers")}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                            genderFilter === "customers"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-blue-600"
                          }`}
                        >
                          <Users className="h-3 w-3 text-blue-500" />
                          <span>{tr("customersOnly")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenderFilter("employees")}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                            genderFilter === "employees"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-emerald-600"
                          }`}
                        >
                          <Briefcase className="h-3 w-3 text-emerald-500" />
                          <span>{tr("employeesOnly")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenderFilter("male")}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                            genderFilter === "male"
                              ? "bg-slate-900 text-white shadow-xs dark:bg-slate-800"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                        >
                          <User className="h-3 w-3" />
                          <span>{tr("genderMale")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGenderFilter("female")}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                            genderFilter === "female"
                              ? "bg-slate-900 text-white shadow-xs dark:bg-slate-800"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                        >
                          <UserCheck className="h-3 w-3" />
                          <span>{tr("genderFemale")}</span>
                        </button>
                      </div>
                    </div>

                    <SearchSelect
                      label=""
                      value={selectedEmployeeId}
                      placeholder={tr("employeeSearchPlaceholder")}
                      searchPlaceholder={tr("employeeSearchPlaceholder")}
                      emptyLabel={tr("noEmployeesFound")}
                      options={employeeOptions}
                      disabled={hrEmployeesLoading}
                      richList
                      onValueChange={setSelectedEmployeeId}
                      onViewOption={(profId) => {
                        if (profId.startsWith("cust_")) {
                          window.open(`/dashboard/customers?id=${profId.replace(/^cust_/, "")}`, "_blank");
                        } else {
                          setViewEmployeeId(profId);
                        }
                      }}
                      onEditOption={(profId) => {
                        if (!profId.startsWith("cust_")) {
                          setEditEmployeeId(profId);
                        }
                      }}
                      createLabel={centralT(activeLang, "urw2.add_new_employee" as never, "+ Add New Employee")}
                      createButtonPlacement="both"
                      onCreateNew={async () => setShowEmployeeModal(true)}
                    />
                  </div>

                  {/* Editable Full Name & Personal Information (Direct & Override) */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3.5 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-emerald-600" />
                      <span>{editUserId ? "Edit User Profile & Identity Information" : "User Profile & Identity Details"}</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Full Name *</Label>
                        <Input
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            setEmployeeProfile((p) => ({ ...p, fullName: e.target.value }));
                          }}
                          placeholder="e.g. Muhammad Ali"
                          className="h-9 text-xs font-bold"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Designation</Label>
                        <Input
                          value={designation}
                          onChange={(e) => {
                            setDesignation(e.target.value);
                            setEmployeeProfile((p) => ({ ...p, designation: e.target.value }));
                          }}
                          placeholder="e.g. Manager / Accountant"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Contact Phone / Mobile</Label>
                        <Input
                          value={contactPhone}
                          onChange={(e) => {
                            setContactPhone(e.target.value);
                            setEmployeeProfile((p) => ({ ...p, phone: e.target.value }));
                          }}
                          placeholder="+971 50 ... / +92 300 ..."
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Department</Label>
                        <Input
                          value={department}
                          onChange={(e) => {
                            setDepartment(e.target.value);
                            setEmployeeProfile((p) => ({ ...p, department: e.target.value }));
                          }}
                          placeholder="e.g. Finance & Accounts"
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* MANDATORY Operational Domain */}
                  <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 dark:border-teal-900 dark:bg-teal-950/20">
                    <Label className="text-xs font-black uppercase tracking-wide text-teal-800 dark:text-teal-300">
                      {centralT(activeLang, "urw2.domain_question" as never, "What is this user being created for?")} *
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(["business", "shipping"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setOperationalDomain(d);
                            if (d === "business") setClearingAgentId("");
                            if (!DOMAIN_ROLES[d].includes(role)) setRole(DOMAIN_ROLES[d][DOMAIN_ROLES[d].length - 1]);
                          }}
                          className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                            operationalDomain === d
                              ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {d === "business" ? (
                            <>
                              <Building2 className="h-4 w-4" />
                              <span>{centralT(activeLang, "urw2.domain_business" as never, "Business")}</span>
                            </>
                          ) : (
                            <>
                              <Globe2 className="h-4 w-4" />
                              <span>{centralT(activeLang, "urw2.domain_shipping" as never, "Shipping Line & Clearing Agent")}</span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-teal-700/90 dark:text-teal-400/90">
                      {operationalDomain === "business"
                        ? centralT(activeLang, "urw2.domain_business_desc" as never, "Business users access General Ledger, Purchase, Sales, Banking, Cash Counter, and Branch Accounts.")
                        : centralT(activeLang, "urw2.domain_shipping_desc" as never, "Shipping Line & Clearing Agent users access Port Clearance, Container Tracking, Customs Operations, and Shipping Records.")}
                    </p>
                  </div>

                  {/* Informational callout confirming authoritative single-source */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      {centralT(
                        activeLang,
                        "urw2.authoritative_notice" as never,
                        "Personal identity, contact numbers, residential address, and KYC documents are linked directly from the Employee Master shown on the left. To correct personal details, use 'Edit Employee Record' without losing your wizard progress."
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 2: Role & Branch Access Scope */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* 1. Geographic & Branch Scopes */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span>{centralT(activeLang, "urw2.branch_scope_heading" as never, "1. Country, City & Branch Assignment")}</span>
                    </Label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SearchSelect
                        label={loadingCountries ? `${tr("country")} (...)` : tr("country")}
                        value={countryId}
                        placeholder={centralT(activeLang, "urw2.select_country" as never, "Select country")}
                        disabled={loadingCountries || role === "super_admin"}
                        options={countryOptions}
                        onValueChange={setCountryId}
                      />

                      <SearchSelect
                        label={tr("branchType")}
                        value={branchType}
                        placeholder={centralT(activeLang, "urw2.select_branch_type" as never, "Select branch type")}
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
                          placeholder={centralT(activeLang, "urw2.select_main_branch" as never, "Select main branch")}
                          options={mainBranches.map((b) => ({
                            value: b.id,
                            label: `${b.name} (${b.code})`,
                            keywords: b.name
                          }))}
                          disabled={!countryId || role === "super_admin"}
                          onValueChange={setCountryBranchId}
                        />
                      ) : (
                        <SearchSelect
                          label={tr("assignedBranch")}
                          value={cityBranchId}
                          placeholder={centralT(activeLang, "urw2.select_city_branch" as never, "Select city branch")}
                          options={cityBranches.map((b) => ({
                            value: b.id,
                            label: `${b.city_name || b.cityName || ""} - ${b.name} (${b.code})`,
                            keywords: `${b.name} ${b.city_name || b.cityName || ""}`
                          }))}
                          disabled={!countryId || role === "super_admin"}
                          onValueChange={setCityBranchId}
                        />
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{th("Branch Code & Scope")}</Label>
                        <Input
                          value={`${branchCode || "MAIN"} (${effectiveCurrency})`}
                          readOnly
                          className="bg-slate-100 dark:bg-slate-900 font-mono font-bold h-9 text-xs text-emerald-600 dark:text-emerald-400 border-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. User Category Selection: Admin vs Normal vs Shipping Line */}
                  <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/20 p-3.5 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-teal-600" />
                      <span>{centralT(activeLang, "urw2.user_type_heading" as never, "2. User Category & Authority Tier (ایڈمن یا عام یوزر)")}</span>
                    </Label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Option 1: Admin User */}
                      <button
                        type="button"
                        onClick={() => {
                          setOperationalDomain("business");
                          setClearingAgentId("");
                          if (branchType === "main") setRole("main_branch_admin");
                          else setRole("city_branch_admin");
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          (role === "city_branch_admin" || role === "main_branch_admin" || role === "country_admin" || role === "super_admin") && operationalDomain === "business"
                            ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                            : "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          <span>Admin User</span>
                        </div>
                        <p className={`text-[10px] mt-1 line-clamp-2 ${
                          (role === "city_branch_admin" || role === "main_branch_admin" || role === "country_admin" || role === "super_admin") && operationalDomain === "business"
                            ? "text-teal-100"
                            : "text-slate-500"
                        }`}>
                          Branch & City Administrator with management and approval authority.
                        </p>
                      </button>

                      {/* Option 2: Normal Operational Staff */}
                      <button
                        type="button"
                        onClick={() => {
                          setOperationalDomain("business");
                          setClearingAgentId("");
                          if (role !== "staff_user" && role !== "cashier" && role !== "accountant" && role !== "auditor_viewer") {
                            setRole("staff_user");
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          (role === "staff_user" || role === "cashier" || role === "accountant" || role === "auditor_viewer" || role === "country_user") && operationalDomain === "business"
                            ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                            : "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <Users className="h-4 w-4 shrink-0" />
                          <span>Normal Staff User</span>
                        </div>
                        <p className={`text-[10px] mt-1 line-clamp-2 ${
                          (role === "staff_user" || role === "cashier" || role === "accountant" || role === "auditor_viewer" || role === "country_user") && operationalDomain === "business"
                            ? "text-teal-100"
                            : "text-slate-500"
                        }`}>
                          Daily transactional operations, cash register, sales, and accounting.
                        </p>
                      </button>

                      {/* Option 3: Shipping Line / Clearing Agent */}
                      <button
                        type="button"
                        onClick={() => {
                          setOperationalDomain("shipping");
                          setRole("agent_user");
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          operationalDomain === "shipping" || role === "agent_user"
                            ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                            : "border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <Globe2 className="h-4 w-4 shrink-0" />
                          <span>Shipping / Agent User</span>
                        </div>
                        <p className={`text-[10px] mt-1 line-clamp-2 ${
                          operationalDomain === "shipping" || role === "agent_user"
                            ? "text-teal-100"
                            : "text-slate-500"
                        }`}>
                          Port clearance, container tracking, customs documentation & bills.
                        </p>
                      </button>
                    </div>

                    {/* Specific Designation Picker for Normal Staff */}
                    {(role === "staff_user" || role === "cashier" || role === "accountant" || role === "auditor_viewer") && operationalDomain === "business" && (
                      <div className="pt-2 border-t border-teal-200/60 dark:border-teal-900/60 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-teal-900 dark:text-teal-300">Staff Role Designation:</span>
                        {[
                          ["staff_user", "General Staff / Entry"],
                          ["cashier", "Cashier / Cash Counter"],
                          ["accountant", "Accountant / Ledger"],
                          ["auditor_viewer", "Auditor / View-Only"]
                        ].map(([rVal, rLbl]) => (
                          <button
                            key={rVal}
                            type="button"
                            onClick={() => setRole(rVal as EnterpriseRole)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                              role === rVal
                                ? "bg-teal-700 text-white shadow-2xs"
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {rLbl}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clearing Agent Picker (for shipping domain) */}
                    {operationalDomain === "shipping" && (
                      <div className="pt-2 border-t border-teal-200/60 dark:border-teal-900/60 space-y-1">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {centralT(activeLang, "urw2.clearing_agent" as never, "Clearing Agent Record *")}
                        </Label>
                        <ClearingAgentPicker
                          value={clearingAgentId}
                          onValueChange={(v: string) => setClearingAgentId(v)}
                          placeholder={centralT(activeLang, "urw2.select_clearing_agent" as never, "Select clearing agent")}
                        />
                      </div>
                    )}
                  </div>

                  {/* Collapsible Fine-Grained Role Select */}
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                      <span>{tr("role")} (Detailed System Privilege)</span>
                      <span className="font-mono text-emerald-600 font-bold">{role}</span>
                    </Label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as EnterpriseRole)}
                      className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 outline-none focus:border-teal-500"
                    >
                      {roleOptions
                        .filter((r) => DOMAIN_ROLES[operationalDomain].includes(r.value))
                        .map((r) => (
                          <option key={r.value} value={r.value}>
                            {centralT(activeLang, r.labelKey as never, r.label)} — {centralT(activeLang, r.helpKey as never, r.help)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 3: Login Credentials & Mobile Access */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Primary Login Email Address */}
                  <div className="space-y-1.5 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-wide text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-blue-600" />
                        <span>{centralT(activeLang, "urw2.login_email_required" as never, "Login Email Address (لاگ ان ای میل ایڈریس) *")}</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          const codeClean = (userCode || makeAutoUserCode()).toLowerCase().replace(/[^a-z0-9]/g, "");
                          const userClean = (loginUsername || firstName || fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "");
                          setPersonalEmail(`${userClean}.${codeClean}@dgt.llc`);
                        }}
                        className="text-[10.5px] font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>{centralT(activeLang, "urw2.autogen_email" as never, "+ Auto-Generate @dgt.llc Email")}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={personalEmail}
                        onChange={(e) => setPersonalEmail(e.target.value)}
                        placeholder="e.g. user@dgt.llc or user@gmail.com"
                        className="h-9 pl-8 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-blue-700/90 dark:text-blue-400">
                      {centralT(
                        activeLang,
                        "urw2.login_email_hint" as never,
                        "CRITICAL: This email address will be required along with your password when logging into the ERP system at /auth/login."
                      )}
                    </p>
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{tr("username")}</Label>
                      <span className="text-[10.5px] font-mono text-emerald-600 font-bold">User Code: {userCode}</span>
                    </div>
                    <Input
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder={th("e.g. muhammad.ali")}
                      className="h-9 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{editUserId ? th("New Password (Optional)") : th("Account Password *")}</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={editUserId ? th("Leave blank to keep unchanged") : centralT(activeLang, "edm.pw_hint" as never, "At least 8 characters")}
                          className="h-9 text-xs pr-8 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">{editUserId ? th("Confirm New Password") : th("Confirm Password *")}</Label>
                        {password && confirmPassword && (
                          <span className={`text-[10px] font-bold ${password === confirmPassword ? "text-emerald-600" : "text-rose-600"}`}>
                            {password === confirmPassword ? "✓ Match" : "✗ Mismatch"}
                          </span>
                        )}
                      </div>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={centralT(activeLang, "edm.pw_reenter" as never, "Re-enter password")}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Mobile Access Profile Selection */}
                  <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 dark:border-indigo-900 dark:bg-indigo-950/20">
                    <Label className="text-xs font-black uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                      {centralT(activeLang, "urw2.mobile_profile_label" as never, "Mobile Access Profile")}
                    </Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        ["standard", "urw2.mobile_profile_standard", "Standard ERP Access"],
                        ["mobile_cash_ledger", "urw2.mobile_profile_cash", "Brother User (Cash & Ledger)"],
                        ["mobile_field", "urw2.mobile_profile_field", "Munshi / Field User"],
                      ] as const).map(([v, key, fallback]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setMobileProfile(v)}
                          className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition text-left ${
                            mobileProfile === v
                              ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {centralT(activeLang, key as never, fallback)}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-indigo-700/90 dark:text-indigo-400/90">
                      {mobileProfile === "mobile_cash_ledger"
                        ? centralT(
                            activeLang,
                            "urw2.mobile_profile_cash_hint" as never,
                            "Brother User: opens dedicated mobile interface for daily cash receipts, payments, and cash book / ledger / journal viewing. Scoped to assigned branch."
                          )
                        : mobileProfile === "mobile_field"
                        ? centralT(
                            activeLang,
                            "urw2.mobile_profile_field_hint" as never,
                            "Munshi / Field User: opens operational mobile forms for port loading, container checks, and assigned job forms."
                          )
                        : centralT(
                            activeLang,
                            "urw2.mobile_profile_standard_hint" as never,
                            "Standard ERP Access: full responsive desktop and tablet interface with assigned role permissions."
                          )}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 4: Review & Complete + MANUALLY ASSIGNABLE PERMISSION MATRIX */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Summary of Steps 1-3 */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100 border-b pb-1 flex items-center justify-between">
                      <span>{centralT(activeLang, "urw2.summary_title" as never, "User & Master Profile Summary")}</span>
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">{userCode}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-slate-500">{th("Full Name")}:</span>{" "}
                        <strong className="text-slate-900 dark:text-slate-100">{fullName || "-"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Username")}:</span>{" "}
                        <strong className="text-emerald-600 font-mono">{loginUsername || userCode}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{centralT(activeLang, "urw2.login_email" as never, "Login Email")}:</span>{" "}
                        <strong className="text-blue-700 dark:text-blue-300 font-mono font-bold">{personalEmail || `${(userCode || 'user').toLowerCase().replace(/[^a-z0-9]/g, "")}@dgt.llc`}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Designation")}:</span> <strong>{designation}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Department")}:</span> <strong>{department}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Domain")}:</span>{" "}
                        <strong>{operationalDomain === "shipping" ? "Shipping Line & Clearing Agent" : "Business"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Country Scope")}:</span>{" "}
                        <strong>{selectedCountry?.name || "Global Scope"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Assigned Branch")}:</span>{" "}
                        <strong>{branchCode || selectedMainBranch?.name || "Main Branch"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">{th("Mobile Profile")}:</span>{" "}
                        <strong className="text-indigo-600 font-bold">
                          {mobileProfile === "mobile_cash_ledger"
                            ? "Brother User (Cash & Ledger)"
                            : mobileProfile === "mobile_field"
                            ? "Munshi / Field User"
                            : "Standard ERP"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Approval & Authority Routing Confirmation */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/30 flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                        <span>Approval & Authority Hierarchy (منظوری و سائن آف)</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold dark:bg-blue-900 dark:text-blue-200">
                          {role.includes("admin") ? "Administrative Authority" : "Standard Operations"}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700/90 dark:text-blue-400">
                        {role === "super_admin" || role === "country_admin"
                          ? "This user record has executive authority and will be activated directly across centralized ERP ledgers."
                          : role.includes("branch_admin")
                          ? "Branch Admin account: Upon creation, it is verified under branch scope and routed to Country Admin & Super Admin for authorization."
                          : "Branch Operational User: Created under branch operational ledger with assigned form permissions and transaction limits."}
                      </p>
                    </div>
                  </div>

                  {/* MANUALLY ASSIGNABLE FORM/MODULE PERMISSIONS MATRIX */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>{centralT(activeLang, "urw2.perm_matrix_title" as never, "Interactive Form / Module Permission Matrix")}</span>
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
                          {centralT(activeLang, "urw2.select_all" as never, "Select All")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(selectedPermissionCategory, false)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300"
                        >
                          {centralT(activeLang, "urw2.deselect_all" as never, "Deselect All")}
                        </button>
                      </div>
                    </div>

                    {/* Matrix Table */}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-[11px]">
                      <div className="max-h-[280px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">
                            <tr>
                              <th className="p-2 pl-3">Module / Form</th>
                              <th className="p-2 text-center">View</th>
                              <th className="p-2 text-center">Create</th>
                              <th className="p-2 text-center">Edit</th>
                              <th className="p-2 text-center">Delete</th>
                              <th className="p-2 text-center">Post</th>
                              <th className="p-2 text-center pr-3">Print</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {filteredModuleCapabilities.map((mod) => (
                              <tr key={mod.moduleKey} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                <td className="p-2 pl-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {mod.moduleName}
                                  <span className="block text-[9px] font-normal text-slate-400">{mod.category}</span>
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={mod.canView}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canView")}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={mod.canCreate}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canCreate")}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={mod.canEdit}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canEdit")}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={mod.canDelete}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canDelete")}
                                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={mod.canPostApprove}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canPostApprove")}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="p-2 text-center pr-3">
                                  <input
                                    type="checkbox"
                                    checked={mod.canPrintExport}
                                    onChange={() => handleToggleCapability(mod.moduleKey, "canPrintExport")}
                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Footer Navigation Buttons */}
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
                        <span>{centralT(activeLang, "edm.view_profile_report" as never, "View Profile Report")}</span>
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
      </div>

      {showEmployeeModal ? (
        <SimpleModal
          title={tr("newEmployeeModalTitle")}
          onClose={() => setShowEmployeeModal(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeForm
            onSave={async (newEmployeeId) => {
              setShowEmployeeModal(false);
              const freshList = await fetchMasterProfiles();
              if (newEmployeeId && freshList.some((e: any) => e.id === newEmployeeId)) {
                setSelectedEmployeeId(newEmployeeId);
              }
            }}
            onCancel={() => setShowEmployeeModal(false)}
          />
        </SimpleModal>
      ) : null}

      {editEmployeeId ? (
        <SimpleModal
          title={centralT(activeLang, "urw2.edit_employee_record" as never, "Edit Employee Master Record")}
          onClose={() => setEditEmployeeId(null)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeForm
            employeeId={editEmployeeId}
            onSave={async (savedId) => {
              setEditEmployeeId(null);
              const freshList = await fetchMasterProfiles();
              if (savedId && freshList.some((e: any) => e.id === savedId)) {
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

export function EmployeeDetailModal({
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
  const s = useErpScreen("edm");
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
    const certHtml = `
      <!DOCTYPE html>
      <html lang="${s.lang}" dir="${s.dir}">
        <head>
          <title>${s.t("report_sheet_title", "Employee Record Sheet")} - ${code}</title>
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
              <div class="company">${s.t("company_name", "DGT ERP SYSTEM")}</div>
              <div class="title">${s.t("official_profile", "OFFICIAL EMPLOYEE MASTER PROFILE")}</div>
            </div>
            <div style="text-align: ${s.isRtl ? "left" : "right"};">
              <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${code}</div>
              <div style="font-size: 12px; color: #64748b;">${s.t("status", "Status")}: <strong>${status}</strong></div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">${s.t("employee_details", "Employee Details")}</div>
              <div class="row"><span class="label">${s.t("full_name", "Full Name")}:</span><span class="val">${empName}</span></div>
              <div class="row"><span class="label">${s.t("designation", "Designation")}:</span><span class="val">${designation}</span></div>
              <div class="row"><span class="label">${s.t("department", "Department")}:</span><span class="val">${department}</span></div>
              <div class="row"><span class="label">${s.t("joining_date", "Joining Date")}:</span><span class="val">${joiningDate}</span></div>
              <div class="row"><span class="label">${s.t("basic_salary", "Basic Salary")}:</span><span class="val">${currency} ${Number(basicSalary).toLocaleString()}</span></div>
            </div>

            <div class="card">
              <div class="card-title">${s.t("contact_branch_info", "Contact & Branch Info")}</div>
              <div class="row"><span class="label">${s.t("mobile_phone", "Mobile Phone")}:</span><span class="val">${phone}</span></div>
              <div class="row"><span class="label">${s.t("email_address", "Email Address")}:</span><span class="val">${email}</span></div>
              <div class="row"><span class="label">${s.t("branch", "Branch")}:</span><span class="val">${emp.country_branch?.name || emp.city_branch?.name || "Main Office"}</span></div>
              <div class="row"><span class="label">${s.t("country", "Country")}:</span><span class="val">${emp.country?.name || "Global"}</span></div>
              <div class="row"><span class="label">${s.t("address", "Address")}:</span><span class="val">${address}</span></div>
            </div>
          </div>

          <div class="footer">
            ${s.t("generated_on", "Generated on")} ${new Date().toLocaleString()} | ${s.t("company_name", "DGT ERP SYSTEM")}
          </div>
        </body>
      </html>
    `;
    import("@/lib/store/print-store").then(({ printStore }) => {
      printStore.openPrint(certHtml, `${s.t("report_sheet_title", "Employee Record Sheet")} - ${code}`);
    });
  };

  return (
    <SimpleModal
      title={`${s.t("master_report_title", "Employee Master Report")} - ${code}`}
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
                {s.t("code", "Code")}: <strong className="text-white">{code}</strong> | {s.t("designation", "Designation")}: <strong className="text-white">{designation}</strong>
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
              <span>{s.t("edit_form", "Edit Form")}</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrintCertificate}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-1.5 shadow-md"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{s.t("print_record", "Print Record")}</span>
            </Button>
          </div>
        </div>

        {/* Detailed Grid Info */}
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>{s.t("employment_information", "Employment Information")}</span>
            </h4>
            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("department", "Department")}:</span>
                <span className="font-semibold">{department}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("joining_date", "Joining Date")}:</span>
                <span className="font-semibold">{joiningDate}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("employment_status", "Employment Status")}:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{s.t("net_basic_salary", "Net Basic Salary")}:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {currency} {Number(basicSalary).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>{s.t("contact_branch_details", "Contact & Branch Details")}</span>
            </h4>
            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("mobile_phone", "Mobile Phone")}:</span>
                <span className="font-mono font-semibold">{phone}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("email_address", "Email Address")}:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{email}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-slate-500">{s.t("assigned_branch", "Assigned Branch")}:</span>
                <span className="font-semibold">{emp.country_branch?.name || emp.city_branch?.name || "Main Office"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{s.t("address", "Address")}:</span>
                <span className="font-medium truncate max-w-[180px]">{address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}
