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
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

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
  const { lang, dir } = useActiveLanguage();

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
      {/* ── 1. Breadcrumbs ── */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="hover:text-slate-800 transition cursor-pointer">Home</span>
        <span>/</span>
        <span className="hover:text-slate-800 transition cursor-pointer">General Office</span>
        <span>/</span>
        <span className="hover:text-slate-800 transition cursor-pointer">Employees</span>
        <span>/</span>
        <span className="text-slate-900 font-bold dark:text-slate-200">Register Employee</span>
      </nav>

      {/* ── 2. Top Title & Actions Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Register Employee
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Manage all company employees across branches and departments
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setIsRegisterOpen(true)}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Register New Employee</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="h-10 px-3.5 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition gap-1.5"
          >
            <UploadCloud className="h-4 w-4 text-slate-500" />
            <span>Import</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsReportModalOpen(true)}
            className="h-10 px-3.5 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition gap-1.5"
          >
            <span>More Actions</span>
            <span className="text-[10px]">▼</span>
          </Button>
        </div>
      </div>

      {/* ── 3. Six Vibrant Pastel KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Employees */}
        <div className="p-4 rounded-2xl bg-[#f5f3ff] border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Employees</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block">All Countries</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50 flex items-center justify-center text-purple-600 dark:text-purple-300 shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Active Employees */}
        <div className="p-4 rounded-2xl bg-[#ecfdf5] border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Active Employees</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.active}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block">Currently Working</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-2xs">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* On Leave */}
        <div className="p-4 rounded-2xl bg-[#fffbeb] border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">On Leave</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.onLeave}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block">This Month</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-300 shadow-2xs">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Inactive Employees */}
        <div className="p-4 rounded-2xl bg-[#fff1f2] border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Inactive Employees</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.inactive}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block">Resigned / Inactive</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center text-rose-600 dark:text-rose-300 shadow-2xs">
            <UserX className="h-5 w-5" />
          </div>
        </div>

        {/* Departments */}
        <div className="p-4 rounded-2xl bg-[#f5f3ff] border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Departments</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.departments}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block">All Branches</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shadow-2xs">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Branches */}
        <div className="p-4 rounded-2xl bg-[#eff6ff] border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 flex items-center justify-between shadow-2xs hover:shadow-md transition">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Branches</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.branches}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 block truncate">Active Locations</span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-300 shadow-2xs">
            <Building2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── 4. All Employee Report Banner ── */}
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              All Employee Report
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Complete employee report with full details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-center text-xs overflow-x-auto pb-1 md:pb-0">
          <div>
            <span className="text-base font-black text-slate-900 dark:text-white block">54</span>
            <span className="text-[10px] font-bold text-slate-500">Total Employees</span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <span className="text-base font-black text-emerald-600 block">48</span>
            <span className="text-[10px] font-bold text-slate-500">Active</span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <span className="text-base font-black text-amber-600 block">3</span>
            <span className="text-[10px] font-bold text-slate-500">On Leave</span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <span className="text-base font-black text-rose-600 block">3</span>
            <span className="text-[10px] font-bold text-slate-500">Inactive</span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <span className="text-base font-black text-purple-600 block">8</span>
            <span className="text-[10px] font-bold text-slate-500">Departments</span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <span className="text-base font-black text-blue-600 block">5</span>
            <span className="text-[10px] font-bold text-slate-500">Branches</span>
          </div>
        </div>

        <Button
          onClick={() => setIsReportModalOpen(true)}
          className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 shrink-0 gap-1.5"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>View Full Report</span>
        </Button>
      </div>

      {/* ── 5. Advanced Filter Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, department, position, mobile..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Department Filter */}
        <select
          value={selectedDepartment}
          onChange={e => setSelectedDepartment(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
        >
          <option value="All">All Departments</option>
          <option value="Accounts">Accounts</option>
          <option value="HR">HR</option>
          <option value="Purchase">Purchase</option>
          <option value="Sales">Sales</option>
          <option value="Logistics">Logistics</option>
          <option value="i-Documents">i-Documents</option>
          <option value="Inventory">Inventory</option>
          <option value="Admin">Admin</option>
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="On Leave">On Leave</option>
          <option value="Inactive">Inactive</option>
        </select>

        {/* Branch Filter */}
        <select
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
        >
          <option value="All">All Branches</option>
          <option value="Karachi Main">Karachi Main</option>
          <option value="Lahore Branch">Lahore Branch</option>
          <option value="Islamabad">Islamabad</option>
          <option value="Dubai Office">Dubai Office</option>
          <option value="Peshawar">Peshawar</option>
          <option value="Quetta Main">Quetta Main</option>
          <option value="Chaman Border">Chaman Border</option>
        </select>

        {/* Country Filter */}
        <select
          value={selectedCountry}
          onChange={e => setSelectedCountry(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
        >
          <option value="All">All Countries</option>
          <option value="Pakistan">Pakistan</option>
          <option value="United Arab Emirates">United Arab Emirates</option>
          <option value="Afghanistan">Afghanistan</option>
          <option value="India">India</option>
        </select>

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchQuery("");
            setSelectedDepartment("All");
            setSelectedStatus("All");
            setSelectedBranch("All");
            setSelectedCountry("All");
          }}
          className="h-9 px-3 text-xs font-bold text-slate-500 hover:text-slate-800 gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </Button>
      </div>

      {/* ── 6. Employees List Table Card ── */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Table Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Employees List
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Manage and view all registered employees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csvContent =
                  "data:text/csv;charset=utf-8," +
                  ["ID,Name,Department,Position,Branch,Mobile,Status,JoinDate"]
                    .concat(
                      employees.map(
                        e => `${e.empCode},${e.name},${e.department},${e.position},${e.branch},${e.mobile},${e.status},${e.joinDate}`
                      )
                    )
                    .join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "employees-list.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </Button>

            <Button
              size="sm"
              className="h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filter</span>
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
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Position</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Join Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading employees from database...</span>
                  </td>
                </tr>
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No employees matching filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp, idx) => {
                  const isChecked = selectedIds.has(emp.id);
                  const isMobileOpen = activeMobilePopover === emp.id;
                  const isActionOpen = activeActionMenu === emp.id;

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

                      {/* Department */}
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                        {emp.department}
                      </td>

                      {/* Position */}
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                        {emp.position}
                      </td>

                      {/* Branch */}
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                        {emp.branch}
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

                      {/* Status */}
                      <td className="py-3.5 px-3">
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

                      {/* Join Date */}
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {emp.joinDate}
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

        {/* Table Bottom Pagination Bar */}
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

          <div className="flex items-center gap-2">
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

            {/* Page Size Dropdown */}
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
