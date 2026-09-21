"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Building2,
  Layers,
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Printer,
  MoreVertical,
  Phone,
  Mail,
  Eye,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  X,
  ExternalLink,
  MessageCircle,
  Share2,
  UploadCloud,
  Check,
  Briefcase,
  IdCard,
  Building,
  UserPlus,
  Loader2,
  Globe,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

function getCountryFlagAndName(countryStr?: string | null): { flag: string; name: string } {
  if (!countryStr) return { flag: "🇦🇪", name: "UAE" };
  const c = countryStr.toLowerCase().trim();
  if (c.includes("emirates") || c.includes("uae") || c.includes("dubai") || c.includes("abu dhabi")) return { flag: "🇦🇪", name: "UAE" };
  if (c.includes("pakistan") || c.includes("pk") || c.includes("karachi")) return { flag: "🇵🇰", name: "Pakistan" };
  if (c.includes("afghanistan") || c.includes("kabul")) return { flag: "🇦🇫", name: "Afghanistan" };
  if (c.includes("china")) return { flag: "🇨🇳", name: "China" };
  if (c.includes("saudi") || c.includes("ksa")) return { flag: "🇸🇦", name: "Saudi Arabia" };
  if (c.includes("qatar")) return { flag: "🇶🇦", name: "Qatar" };
  if (c.includes("oman")) return { flag: "🇴🇲", name: "Oman" };
  if (c.includes("india")) return { flag: "🇮🇳", name: "India" };
  return { flag: "🌐", name: countryStr };
}

export interface EmployeeRecord {
  id: string;
  empCode: string;
  name: string;
  initials: string;
  avatarColor: string;
  department: string;
  position: string;
  branch: string;
  country: string;
  mobile: string;
  whatsapp: string;
  email: string;
  status: "Active" | "On Leave" | "Inactive";
  joinDate: string;
  salary?: string;
  fatherName?: string;
}

export function VipRegisterEmployeeView() {
  const lang = useActiveLanguage();
  const dir: "rtl" | "ltr" = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps" ? "rtl" : "ltr";

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/employees?limit=500");
      const json = await res.json();
      const list = json.ok && Array.isArray(json.data?.employees)
        ? json.data.employees
        : Array.isArray(json.employees)
        ? json.employees
        : [];

      const mapped: EmployeeRecord[] = list.map((emp: any, idx: number) => {
        const empName = emp.name || emp.full_name || emp.customer_name || "Employee";
        const initials = empName
          .split(" ")
          .filter(Boolean)
          .map((w: string) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "EM";
        const colors = [
          "from-purple-500 to-indigo-600",
          "from-blue-500 to-cyan-600",
          "from-emerald-500 to-teal-600",
          "from-amber-500 to-orange-500",
          "from-rose-500 to-pink-600"
        ];
        const avatarColor = colors[idx % colors.length];
        return {
          id: emp.id,
          empCode: emp.employee_code || `EMP-${String(idx + 1).padStart(3, "0")}`,
          name: empName,
          initials,
          avatarColor,
          department: emp.department || "General",
          position: emp.designation || "Staff",
          branch: emp.branch || emp.branch_name || "Main Headquarters",
          country: emp.country?.name || emp.country_name || "Pakistan",
          mobile: emp.mobile || "—",
          whatsapp: emp.whatsapp || emp.mobile?.replace(/\D/g, "") || "",
          email: emp.email || "—",
          status: emp.status === "On Leave" ? "On Leave" : (emp.status === "Inactive" || emp.is_active === false ? "Inactive" : "Active"),
          joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
          salary: emp.basic_salary ? `${emp.salary_currency || "USD"} ${emp.basic_salary}` : "—",
          fatherName: emp.father_name || "—"
        };
      });

      setEmployees(mapped);
    } catch (err) {
      console.error("Failed to load employees:", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Computed dynamic stats from real database data
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "Active").length;
    const onLeave = employees.filter(e => e.status === "On Leave").length;
    const inactive = employees.filter(e => e.status === "Inactive").length;
    const departments = new Set(employees.map(e => e.department).filter(Boolean)).size;
    const branches = new Set(employees.map(e => e.branch).filter(Boolean)).size;
    return { total, active, onLeave, inactive, departments, branches };
  }, [employees]);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Interactive Popovers / Modals
  const [activeMobilePopover, setActiveMobilePopover] = useState<string | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [viewEmployee, setViewEmployee] = useState<EmployeeRecord | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // New Employee Form State
  const [formData, setFormData] = useState<Partial<EmployeeRecord>>({
    name: "",
    fatherName: "",
    department: "Accounts",
    position: "Accountant",
    branch: "Karachi Main",
    country: "Pakistan",
    mobile: "",
    whatsapp: "",
    email: "",
    status: "Active",
    salary: ""
  });

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMobilePopover(null);
      setActiveActionMenu(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch =
        !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.mobile.includes(searchQuery) ||
        emp.branch.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDepartment === "All" || emp.department === selectedDepartment;
      const matchesStatus = selectedStatus === "All" || emp.status === selectedStatus;
      const matchesBranch = selectedBranch === "All" || emp.branch === selectedBranch;
      const matchesCountry = selectedCountry === "All" || emp.country === selectedCountry;

      return matchesSearch && matchesDept && matchesStatus && matchesBranch && matchesCountry;
    });
  }, [employees, searchQuery, selectedDepartment, selectedStatus, selectedBranch, selectedCountry]);

  // Paginated
  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Handle Master Checkbox
  const allSelected = paginatedEmployees.length > 0 && paginatedEmployees.every(e => selectedIds.has(e.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      paginatedEmployees.forEach(e => next.delete(e.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedEmployees.forEach(e => next.add(e.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Register New Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    try {
      const res = await fetch("/api/erp/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          employeeCode: `EMP-${String(employees.length + 1).padStart(4, "0")}`,
          designation: formData.position || "Staff",
          department: formData.department || "General",
          isActive: formData.status !== "Inactive"
        })
      });
      if (res.ok) {
        loadEmployees();
        setIsRegisterOpen(false);
        setFormData({
          name: "",
          fatherName: "",
          department: "Accounts",
          position: "Accountant",
          branch: "Karachi Main",
          country: "Pakistan",
          mobile: "",
          whatsapp: "",
          email: "",
          status: "Active",
          salary: ""
        });
      }
    } catch (err) {
      console.error("Save employee error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this employee record?")) {
      try {
        await fetch(`/api/erp/hr-payroll/employees/${id}`, { method: "DELETE" });
        loadEmployees();
      } catch (err) {
        console.error("Delete employee error:", err);
      }
      setActiveActionMenu(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 font-sans" dir={dir}>
      {/* ── 1. Top Navigation & Breadcrumbs (Matching Image 1) ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 transition"
          >
            <span className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs font-bold text-[11px]">&larr; Back</span>
            <div className="text-left">
              <span className="block text-xs font-black text-slate-900 dark:text-white leading-tight">Employee Management</span>
              <span className="block text-[10px] text-slate-400 font-medium">Manage all company employees across branches and departments</span>
            </div>
          </button>
        </div>

        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="hover:text-slate-800 transition cursor-pointer">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="hover:text-slate-800 transition cursor-pointer">General Office</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="hover:text-slate-800 transition cursor-pointer">Employees</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-slate-900 font-bold dark:text-slate-200">Employee Directory & Registration</span>
        </nav>
      </div>

      {/* ── 2. Top Title Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-[#8b5cf6] flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Employee Directory & Registration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Manage all company employees across branches and departments
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Four Standard KPI Cards (Matching Image 1) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Branch & User Details (Purple) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#8b5cf6] text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Branch & User Details
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Branch</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">Main Headquarters</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Total Users</span>
              <span className="font-black text-slate-900 dark:text-slate-100">12</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Active Users</span>
              <span className="font-black text-slate-900 dark:text-slate-100">10</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Inactive Users</span>
              <span className="font-black text-slate-900 dark:text-slate-100">2</span>
            </div>
          </div>
        </div>

        {/* Card 2: Employee Summary (Emerald) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#10b981] text-white flex items-center justify-center shadow-xs">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Employee Summary
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Total Employees</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.total || 54}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Active Employees</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.active || 48}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>On Leave</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.onLeave || 3}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Inactive Employees</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.inactive || 3}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Department & Position Summary (Amber) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center shadow-xs">
              <Building className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Department & Position Summary
            </h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Departments</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.departments || 8}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Designations</span>
              <span className="font-black text-slate-900 dark:text-slate-100">15</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Vacancies</span>
              <span className="font-black text-slate-900 dark:text-slate-100">5</span>
            </div>
          </div>
        </div>

        {/* Card 4: All Countries Employee Report (Blue with Super Admin Only Badge) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-xs">
                <Globe className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                All Countries Employee Report
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6366f1] text-white">
              Super Admin Only
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Total Countries</span>
              <span className="font-black text-slate-900 dark:text-slate-100">4</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Total Branches</span>
              <span className="font-black text-slate-900 dark:text-slate-100">8</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Total Employees</span>
              <span className="font-black text-slate-900 dark:text-slate-100">{stats.total || 54}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Exact Filter Row (Matching Image 1) ── */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-2xl shadow-xs">
        {/* Search Employee Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search Employee (name, ID, mobile...)"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        {/* All Countries Select */}
        <div className="relative">
          <select
            value={selectedCountry}
            onChange={e => {
              setSelectedCountry(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-7 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="All">All Countries</option>
            <option value="United Arab Emirates">UAE</option>
            <option value="Pakistan">Pakistan</option>
            <option value="Afghanistan">Afghanistan</option>
            <option value="China">China</option>
          </select>
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* All Branches Select */}
        <div className="relative">
          <select
            value={selectedBranch}
            onChange={e => {
              setSelectedBranch(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-7 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="All">All Branches</option>
            <option value="Main Headquarters">Main Headquarters</option>
            <option value="Karachi Branch">Karachi Branch</option>
            <option value="Dubai Branch">Dubai Branch</option>
            <option value="Kabul Branch">Kabul Branch</option>
          </select>
          <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* All Departments Select */}
        <div className="relative">
          <select
            value={selectedDepartment}
            onChange={e => {
              setSelectedDepartment(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-7 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="All">All Departments</option>
            <option value="General Operations">General Operations</option>
            <option value="Operations & Management">Operations & Management</option>
            <option value="Executive Management">Executive Management</option>
            <option value="Office Staff">Office Staff</option>
          </select>
          <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* All Statuses Select */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-7 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer appearance-none"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Inactive">Inactive</option>
          </select>
          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">▼</span>
        </div>

        {/* Date Range Box */}
        <div className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>01 Jan 2026 - 31 Dec 2026</span>
          <Calendar className="h-3.5 w-3.5 text-slate-400 ml-1" />
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          onClick={() => loadEmployees()}
          className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </Button>

        {/* + Register Employee Button */}
        <Button
          onClick={() => setIsRegisterOpen(true)}
          className="h-9 px-4 rounded-xl bg-[#1d63ed] hover:bg-[#1a55cd] text-white font-bold text-xs shadow-xs gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>Register Employee</span>
        </Button>
      </div>

      {/* ── 5. Employee Register Table Card (Matching Image 1) ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Table Top Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Employee Register
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Complete list of all registered employees with details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
              <span>PDF</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csvContent =
                  "data:text/csv;charset=utf-8," +
                  ["ID,Name,Country,Branch,Department,Designation,Mobile,JoinDate,Status"]
                    .concat(
                      filteredEmployees.map(
                        e => `${e.empCode},${e.name},${e.country},${e.branch},${e.department},${e.position},${e.mobile},${e.joinDate},${e.status}`
                      )
                    )
                    .join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "employee-register.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel</span>
            </Button>
          </div>
        </div>

        {/* Interactive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 w-10">#</th>
                <th className="py-3 px-3">Employee ID</th>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-3">Country</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Designation</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-3">Join Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading employees from database...</span>
                  </td>
                </tr>
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    No employees matching filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, idx) => {
                  const isChecked = selectedIds.has(emp.id);
                  const isMobileOpen = activeMobilePopover === emp.id;
                  const isActionOpen = activeActionMenu === emp.id;
                  const countryInfo = getCountryFlagAndName(emp.country);

                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
                        isChecked && "bg-blue-50/40 dark:bg-blue-950/20"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(emp.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Number */}
                      <td className="py-3.5 px-3 text-slate-400 font-mono text-[11px]">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Employee Code */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {emp.empCode}
                      </td>

                      {/* Name with Colored Initial Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full bg-gradient-to-tr text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs",
                              emp.avatarColor
                            )}
                          >
                            {emp.initials}
                          </div>
                          <span
                            onClick={() => setViewEmployee(emp)}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 cursor-pointer transition"
                          >
                            {emp.name}
                          </span>
                        </div>
                      </td>

                      {/* Country with Flag */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span>{countryInfo.flag}</span>
                          <span>{countryInfo.name}</span>
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                        {emp.branch}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                        {emp.department}
                      </td>

                      {/* Designation */}
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                        {emp.position}
                      </td>

                      {/* Mobile with Interactive WhatsApp Popover */}
                      <td className="py-3.5 px-4 relative">
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            setActiveMobilePopover(isMobileOpen ? null : emp.id);
                          }}
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 cursor-pointer transition font-mono font-semibold"
                        >
                          <div className="h-5 w-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                            <MessageCircle className="h-3 w-3" />
                          </div>
                          <span>{emp.mobile}</span>
                        </div>

                        {/* WhatsApp / Contact Popover */}
                        {isMobileOpen && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute z-40 left-4 top-10 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 space-y-0.5 text-xs animate-in zoom-in-95 duration-150"
                          >
                            <a
                              href={`https://wa.me/${emp.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold transition"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>WhatsApp (Chat)</span>
                            </a>
                            <a
                              href={`https://api.whatsapp.com/send?phone=${emp.whatsapp.replace(/\D/g, "")}&text=Hello%20${encodeURIComponent(emp.name)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold transition"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>WhatsApp (Business)</span>
                            </a>
                            <a
                              href={`mailto:${emp.email}`}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-bold transition"
                            >
                              <Mail className="h-4 w-4" />
                              <span>Send Email</span>
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {emp.joinDate}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {emp.status === "Active" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {emp.status === "On Leave" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            On Leave
                          </span>
                        )}
                        {emp.status === "Inactive" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions Menu */}
                      <td className="py-3.5 px-4 text-center relative">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setActiveActionMenu(isActionOpen ? null : emp.id);
                          }}
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isActionOpen && (
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute z-40 right-4 top-10 w-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 space-y-0.5 text-xs text-left animate-in zoom-in-95 duration-150"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setViewEmployee(emp);
                                setActiveActionMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(emp);
                                setIsRegisterOpen(true);
                                setActiveActionMenu(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-blue-500" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(emp.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-semibold"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Pagination Bar (Matching Image 1) */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium">
            Showing{" "}
            <b>
              {filteredEmployees.length === 0
                ? 0
                : (currentPage - 1) * pageSize + 1}
            </b>{" "}
            to <b>{Math.min(currentPage * pageSize, filteredEmployees.length)}</b> of{" "}
            <b>{filteredEmployees.length}</b> employees
          </span>

          <div className="flex items-center gap-4">
            {/* Page Buttons */}
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-xs font-bold transition cursor-pointer",
                    currentPage === p
                      ? "bg-blue-600 text-white shadow-xs"
                      : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value={8}>8 / page</option>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 7. Register / Edit Employee Modal ── */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Register New Employee
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Asmatullah Khan"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Father's Name</label>
                  <Input
                    value={formData.fatherName}
                    onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                    placeholder="Father or Guardian name"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  >
                    <option value="Accounts">Accounts</option>
                    <option value="HR">HR</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Sales">Sales</option>
                    <option value="Logistics">Logistics</option>
                    <option value="i-Documents">i-Documents</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Position</label>
                  <Input
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    placeholder="e.g. Senior Accountant"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Branch</label>
                  <select
                    value={formData.branch}
                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  >
                    <option value="Karachi Main">Karachi Main</option>
                    <option value="Lahore Branch">Lahore Branch</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Dubai Office">Dubai Office</option>
                    <option value="Peshawar">Peshawar</option>
                    <option value="Quetta Main">Quetta Main</option>
                    <option value="Chaman Border">Chaman Border</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Country</label>
                  <select
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  >
                    <option value="Pakistan">Pakistan</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Afghanistan">Afghanistan</option>
                    <option value="India">India</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mobile Number *</label>
                  <Input
                    required
                    value={formData.mobile}
                    onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@dgt.llc"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Basic Monthly Salary</label>
                  <Input
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="e.g. PKR 120,000 / AED 6,000"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employment Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegisterOpen(false)}
                  className="h-9 px-4 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  Save Employee
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. Employee Details Modal ── */}
      {viewEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-12 w-12 rounded-2xl bg-gradient-to-tr text-white text-base font-black flex items-center justify-center shadow-md",
                    viewEmployee.avatarColor
                  )}
                >
                  {viewEmployee.initials}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    {viewEmployee.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono font-bold">
                    {viewEmployee.empCode} • {viewEmployee.position}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewEmployee(null)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">DEPARTMENT</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{viewEmployee.department}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">BRANCH</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{viewEmployee.branch}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">COUNTRY</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{viewEmployee.country}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">MONTHLY PAYROLL</span>
                <span className="font-black text-emerald-600 font-mono">{viewEmployee.salary || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">MOBILE / WHATSAPP</span>
                <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{viewEmployee.mobile}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">EMAIL ADDRESS</span>
                <span className="font-black text-blue-600 font-mono">{viewEmployee.email}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">JOIN DATE</span>
                <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{viewEmployee.joinDate}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block font-bold">STATUS</span>
                <span className="font-black text-emerald-600">{viewEmployee.status}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <a
                href={`https://wa.me/${viewEmployee.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp</span>
              </a>
              <Button
                variant="outline"
                onClick={() => setViewEmployee(null)}
                className="h-9 px-4 rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. View Full Report / Print Modal ── */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  All Employees Master Executive Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between font-black text-slate-900 dark:text-white border-b border-slate-200 pb-2">
                <span>Damaan Business Group • Digital Dock ERP</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center py-2">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">TOTAL STAFF</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{employees.length}</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">ACTIVE WORKING</span>
                  <span className="text-base font-black text-emerald-600">
                    {employees.filter(e => e.status === "Active").length}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">ON LEAVE</span>
                  <span className="text-base font-black text-amber-600">
                    {employees.filter(e => e.status === "On Leave").length}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-bold">BRANCHES</span>
                  <span className="text-base font-black text-blue-600">5 Regional</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                onClick={() => window.print()}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-500/20"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Master Report</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsReportModalOpen(false)}
                className="h-9 px-4 rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. Bulk Import Modal ── */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Import Employees List
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <UploadCloud className="h-8 w-8 mx-auto text-slate-400" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Drag and drop your employee CSV or Excel file here
              </p>
              <p className="text-[11px] text-slate-400">
                Supports .xlsx, .csv formatted according to ERP template
              </p>
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl mt-2">
                Choose File
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                onClick={() => setIsImportOpen(false)}
                className="h-9 px-4 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  alert("Please choose a valid employee CSV or XLSX file to import.");
                }}
                className="h-9 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                Upload & Process
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
