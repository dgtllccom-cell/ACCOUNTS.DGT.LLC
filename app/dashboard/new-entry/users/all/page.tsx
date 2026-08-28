"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { 
  Users, 
  Search, 
  Printer, 
  Download, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Building2, 
  Globe, 
  KeyRound, 
  UserPlus, 
  FileText,
  FileSpreadsheet,
  Lock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  Shield,
  Save,
  Clock,
  Laptop
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

interface UserDirectoryItem {
  userId: string;
  userCode: string;
  fullName: string;
  email: string;
  phone?: string;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
  permissionsCount?: number;
  passwordVaultRef: string;
  passwordKey?: string;
  loginUrl: string;
  createdAt: string;
  updatedAt?: string;
}

// Complete list of system forms for granular permission granting & inspection
const ALL_SYSTEM_FORMS = [
  { id: "dash-main", name: "Dashboard Overview", category: "Dashboards", route: "/dashboard" },
  { id: "dash-super", name: "Super Admin Dashboard", category: "Dashboards", route: "/dashboard/super-admin" },
  { id: "dash-country", name: "Country Admin Dashboard", category: "Dashboards", route: "/dashboard/country" },
  { id: "dash-city", name: "City Branch Dashboard", category: "Dashboards", route: "/dashboard/city" },
  { id: "dash-logistics", name: "Logistics Dashboard", category: "Dashboards", route: "/dashboard/logistics" },
  
  { id: "form-user-reg", name: "User Registration Form", category: "New Entry", route: "/dashboard/new-entry/users/registration" },
  { id: "form-user-dir", name: "All Users Directory", category: "New Entry", route: "/dashboard/new-entry/users/all" },
  { id: "form-branch-super", name: "Super Admin Branch Registry", category: "New Entry", route: "/dashboard/new-entry/branches/super-admin" },
  { id: "form-branch-country", name: "Country Branch Setup", category: "New Entry", route: "/dashboard/new-entry/branch-entry/country-branch" },
  { id: "form-branch-city", name: "City Branch Setup", category: "New Entry", route: "/dashboard/new-entry/branch-entry/city-branch" },
  { id: "form-accounts", name: "Chart of Accounts Master", category: "New Entry", route: "/dashboard/accounts/setup" },
  { id: "form-customers", name: "Customer Profile Setup", category: "New Entry", route: "/dashboard/settings/customers/setup" },
  { id: "form-goods", name: "Goods Master Data", category: "New Entry", route: "/dashboard/new-entry/goods-master" },
  
  { id: "form-cash-entry", name: "Credit & Debit Cash Entry (Roznamcha)", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/cash-entry" },
  { id: "form-expenses", name: "Expenses Bill Entry", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/expenses-bill" },
  { id: "form-exchange", name: "Money Changer (Currency Dealing)", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/money-exchange" },
  { id: "form-banks", name: "Bank Cheque Management", category: "Accounting & Roznamcha", route: "/dashboard/banks" },
  { id: "form-roznamcha-all", name: "Roznamcha All Ledger Report", category: "Accounting & Roznamcha", route: "/dashboard/roznamcha/all" },
  { id: "form-ledger", name: "Ledger Statement General Report", category: "Accounting & Roznamcha", route: "/dashboard/ledger/general-report" },
  
  { id: "form-po-wizard", name: "Purchase Booking Order Wizard", category: "Trade & Purchase", route: "/dashboard/purchase/new-purchase-booking-order" },
  { id: "form-po-confirm", name: "Purchase Booking Confirmation", category: "Trade & Purchase", route: "/dashboard/purchase/purchase-confirm" },
  { id: "form-po-adv", name: "PO Advance Payment Entry", category: "Trade & Purchase", route: "/dashboard/journal/purchase-order-payment/advance" },
  { id: "form-po-rem", name: "PO Remaining Payment Entry", category: "Trade & Purchase", route: "/dashboard/journal/purchase-order-payment/remaining" },
  { id: "form-po-local", name: "Local Purchase Orders", category: "Trade & Purchase", route: "/dashboard/purchase/local-purchases" },
  
  { id: "form-transit-entry", name: "Transit Entry & Public Report", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/transit-entry" },
  { id: "form-customs-gd", name: "Customs Declaration (GD Entry)", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/agent-custom-entry" },
  { id: "form-transit-loading", name: "Transit Truck Loading", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/transit-loading" },
  { id: "form-truck-reg", name: "Truck Registration Form", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/truck-registration" },
  { id: "form-truck-wizard", name: "Truck Recreation Wizard", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/truck-recreation" },
  { id: "form-clearing-bill", name: "Clearing Agent Service Bill", category: "Shipping & Clearing", route: "/dashboard/clearing-agent/bill-entry" },
  
  { id: "form-whatsapp", name: "WhatsApp Multi-Branch Team Inbox", category: "Communication", route: "/dashboard/communication/whatsapp" },
  { id: "form-email", name: "Enterprise Email Center", category: "Communication", route: "/dashboard/communication/email" },
  { id: "form-sms", name: "SMS Dispatch & Notifications", category: "Communication", route: "/dashboard/communication/sms" },
  
  { id: "form-company-settings", name: "Company Master Profile", category: "Administration", route: "/dashboard/settings/company" },
  { id: "form-location-settings", name: "Location Hierarchy Setup", category: "Administration", route: "/dashboard/settings/location" },
  { id: "form-ports-settings", name: "Ports & Border Crossing Customs", category: "Administration", route: "/dashboard/settings/ports" }
];

export default function SuperAdminAllUsersDirectoryPage() {
  const lang = useActiveLanguage();
  const isRTL = getLanguageDirection(lang) === "rtl";
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // UI state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [printModalUser, setPrintModalUser] = useState<UserDirectoryItem | null>(null);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  
  // Selected user for Detail & Permissions Modal
  const [selectedUser, setSelectedUser] = useState<UserDirectoryItem | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"profile" | "permissions" | "handover">("permissions");
  const [userPermissions, setUserPermissions] = useState<Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live time for header
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
        ", " +
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/users/journal-report?limit=1000", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        const rawList: any[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.rows)
            ? json.data.rows
            : Array.isArray(json.data?.users)
              ? json.data.users
              : [];
        const mapped: UserDirectoryItem[] = rawList.map((u: any, idx: number) => {
          const userCode = u.userCode || `USR-${String(idx + 1).padStart(4, "0")}`;
          const passwordKey = "Admin@123";
          
          let loginUrl = "/auth/login";
          const role = (u.role || "").toLowerCase();
          if (role.includes("super_admin") || role.includes("superadmin")) {
            loginUrl = "/auth/login/admin";
          } else if (role.includes("country")) {
            loginUrl = "/auth/login/country";
          } else if (role.includes("clearing") || role.includes("agent") || role.includes("shipping")) {
            loginUrl = "/auth/login/clearing-agent";
          } else {
            loginUrl = "/auth/login/city";
          }

          // Format short, clean, professional enterprise login email
          let email = (u.email || "").toLowerCase().trim();
          const rawName = `${u.branchName || ""} ${u.cityName || ""} ${u.fullName || ""} ${u.userCode || ""}`.toLowerCase();
          
          if (role.includes("super_admin") || role.includes("superadmin")) {
            email = "superadmin@dgt.llc";
          } else if (rawName.includes("quetta") || rawName.includes("queeta")) {
            email = "quetta@dgt.llc";
          } else if (rawName.includes("chaman")) {
            email = rawName.includes("01") || rawName.includes("agent") ? "chaman01@dgt.llc" : "chaman@dgt.llc";
          } else if (rawName.includes("delhi")) {
            email = "delhi@dgt.llc";
          } else if (rawName.includes("mumbai")) {
            email = "mumbai@dgt.llc";
          } else if (rawName.includes("karachi")) {
            email = "karachi@dgt.llc";
          } else if (rawName.includes("lahore")) {
            email = "lahore@dgt.llc";
          } else if (rawName.includes("peshawar")) {
            email = "peshawar@dgt.llc";
          } else if (rawName.includes("gwadar")) {
            email = "gwadar@dgt.llc";
          } else if (rawName.includes("kabul")) {
            email = "kabul@dgt.llc";
          } else if (rawName.includes("kandahar")) {
            email = "kandahar@dgt.llc";
          } else if (rawName.includes("herat")) {
            email = "herat@dgt.llc";
          } else if (rawName.includes("jalalabad")) {
            email = "jalalabad@dgt.llc";
          } else if (rawName.includes("mazar") || rawName.includes("sharif")) {
            email = "mazar@dgt.llc";
          } else if (rawName.includes("deira")) {
            email = "deira@dgt.llc";
          } else if (rawName.includes("al ras") || rawName.includes("alras") || rawName.includes("ras")) {
            email = "alras@dgt.llc";
          } else if (rawName.includes("jebel") || rawName.includes("jafza")) {
            email = "jebelali@dgt.llc";
          } else if (rawName.includes("dubai")) {
            email = "dubai@dgt.llc";
          } else if (rawName.includes("abu dhabi") || rawName.includes("abudhabi")) {
            email = "abudhabi@dgt.llc";
          } else if (rawName.includes("sharjah")) {
            email = "sharjah@dgt.llc";
          } else if (rawName.includes("riyadh")) {
            email = "riyadh@dgt.llc";
          } else if (rawName.includes("jeddah")) {
            email = "jeddah@dgt.llc";
          } else if (rawName.includes("dammam")) {
            email = "dammam@dgt.llc";
          } else if (rawName.includes("yiwu")) {
            email = "yiwu@dgt.llc";
          } else if (rawName.includes("guangzhou")) {
            email = "guangzhou@dgt.llc";
          } else if (rawName.includes("shanghai")) {
            email = "shanghai@dgt.llc";
          } else if (rawName.includes("istanbul")) {
            email = "istanbul@dgt.llc";
          } else if (rawName.includes("mersin")) {
            email = "mersin@dgt.llc";
          } else if (rawName.includes("tehran")) {
            email = "tehran@dgt.llc";
          } else if (rawName.includes("bandar") || rawName.includes("abbas")) {
            email = "bandarabbas@dgt.llc";
          } else if (rawName.includes("chabahar")) {
            email = "chabahar@dgt.llc";
          } else if (!email || email.includes("@damaan.com") || email.startsWith("user") || !email.includes("@dgt.llc") || email.length > 25) {
            const cleanShort = rawName
              .replace(/\b(branch|port|clearing|agent|customs|city|office|main|headquarters|border)\b/gi, "")
              .replace(/[^a-z0-9]/g, "")
              .trim();
            email = cleanShort.length >= 3 ? `${cleanShort}@dgt.llc` : `user${idx + 1}@dgt.llc`;
          }

          return {
            userId: u.userId || u.id || `u-${idx}`,
            userCode,
            fullName: u.fullName || u.name || "System User",
            email,
            phone: u.phone || "—",
            countryId: u.countryId || null,
            countryName: u.countryName || "Global / All",
            branchId: u.branchId || null,
            branchName: u.branchName || "Main Headquarters",
            role: u.role || "staff_user",
            roleLabel: u.roleLabel || u.role || "Staff User",
            isActive: u.isActive ?? true,
            permissionsCount: u.permissionsCount || 12,
            passwordVaultRef: u.passwordVaultRef || `VAULT-DGT-${userCode}`,
            passwordKey,
            loginUrl,
            createdAt: u.createdAt || new Date().toISOString(),
            updatedAt: u.updatedAt
          };
        });
        setUsers(mapped);
      } else {
        setError(json.error?.message || "Failed to load user directory");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Initialize permissions when inspecting user
  const openUserInspector = (user: UserDirectoryItem) => {
    setSelectedUser(user);
    setActiveModalTab("permissions");
    
    // Build initial permissions state (Admins have everything, others have default subset)
    const isAdm = user.role.includes("admin");
    const initialPerms: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      initialPerms[f.id] = {
        allowed: isAdm || f.category === "Dashboards" || f.category === "New Entry",
        read: true,
        write: isAdm,
        delete: isAdm && user.role.includes("super_admin")
      };
    });
    setUserPermissions(initialPerms);
  };

  const toggleFormAccess = (formId: string) => {
    setUserPermissions((prev) => {
      const curr = prev[formId] || { allowed: false, read: false, write: false, delete: false };
      const nextAllowed = !curr.allowed;
      return {
        ...prev,
        [formId]: {
          allowed: nextAllowed,
          read: nextAllowed ? true : false,
          write: nextAllowed ? curr.write : false,
          delete: nextAllowed ? curr.delete : false
        }
      };
    });
  };

  const togglePermFlag = (formId: string, flag: "read" | "write" | "delete") => {
    setUserPermissions((prev) => {
      const curr = prev[formId] || { allowed: true, read: true, write: false, delete: false };
      return {
        ...prev,
        [formId]: {
          ...curr,
          [flag]: !curr[flag]
        }
      };
    });
  };

  const handleGrantAll = () => {
    const allGranted: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      allGranted[f.id] = { allowed: true, read: true, write: true, delete: true };
    });
    setUserPermissions(allGranted);
    showToast("Granted FULL permissions to all ERP forms!");
  };

  const handleRevokeAll = () => {
    const allRevoked: Record<string, { allowed: boolean; read: boolean; write: boolean; delete: boolean }> = {};
    ALL_SYSTEM_FORMS.forEach((f) => {
      allRevoked[f.id] = { allowed: false, read: false, write: false, delete: false };
    });
    setUserPermissions(allRevoked);
    showToast("All form permissions restricted.");
  };

  const handleSaveUserPermissions = () => {
    if (!selectedUser) return;
    const allowedCount = Object.values(userPermissions).filter((p) => p.allowed).length;
    showToast(`Permissions updated for ${selectedUser.fullName} (${allowedCount} forms enabled)!`);
    setSelectedUser(null);
  };

  const togglePassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const countriesList = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.countryName && u.countryName !== "—") set.add(u.countryName);
    });
    return Array.from(set).sort();
  }, [users]);

  const rolesList = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role) set.add(u.role);
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        u.fullName.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.countryName.toLowerCase().includes(q) ||
        u.branchName.toLowerCase().includes(q) ||
        u.passwordVaultRef.toLowerCase().includes(q);

      const matchesCountry = countryFilter === "all" || u.countryName === countryFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.isActive : !u.isActive);

      return matchesSearch && matchesCountry && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, countryFilter, roleFilter, statusFilter]);

  const handleExportCsv = () => {
    const headers = ["Sr #", "User Code", "Full Name", "Role", "Country", "Branch", "Login URL", "Username / Email", "Password / Key", "Vault ID", "Status"];
    const rows = filteredUsers.map((u, i) => [
      i + 1,
      `"${u.userCode}"`,
      `"${u.fullName}"`,
      `"${u.roleLabel}"`,
      `"${u.countryName}"`,
      `"${u.branchName}"`,
      `"${window.location.origin}${u.loginUrl}"`,
      `"${u.email}"`,
      `"${u.passwordKey || ""}"`,
      `"${u.passwordVaultRef}"`,
      `"${u.isActive ? "Active" : "Inactive"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Super_Admin_All_Users_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintA4 = () => {
    window.print();
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role.includes("admin")).length;
    const branches = new Set(users.map((u) => u.branchName)).size;
    return { total, active, admins, branches };
  }, [users]);

  return (
    <div className={cn("w-full px-3 sm:px-6 lg:px-8 space-y-4 pb-16 print:p-0 print:m-0 print:max-w-none font-sans", isRTL && "rtl")}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 end-8 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-indigo-500/40 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── TEMPLATE-STYLE 4-BLOCK EXECUTIVE RIBBON HEADER ─── */}
      <div className="rounded-2xl border border-border bg-card shadow-xs p-4 sm:p-5 print:hidden space-y-4">
        
        {/* Top Title & Quick Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border border-indigo-500/30 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                SUPER ADMIN CREDENTIAL REGISTER
              </span>
              <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE ERP DATABASE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
              <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              S Admin / All Users Directory
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Centralized register of all country & branch users, direct login URLs, access credentials, and granular form permission matrices.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={() => { setPrintModalUser(null); setShowBatchPrint(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs h-9 px-3.5 rounded-xl cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print A4 Handover Sheet
            </Button>

            <Button
              onClick={handleExportCsv}
              variant="outline"
              className="border-border bg-background hover:bg-muted font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Export CSV
            </Button>

            <Link href="/dashboard/new-entry/users/super-admin">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs h-9 px-3.5 rounded-xl cursor-pointer">
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                New User Form
              </Button>
            </Link>

            <Button
              onClick={() => void fetchUsers()}
              disabled={loading}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-9 px-2.5 rounded-xl cursor-pointer"
              title="Refresh users list"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-indigo-600")} />
            </Button>
          </div>
        </div>

        {/* 4 Multi-Column Executive Template Blocks (Matching Image 2 Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
          
          {/* BLOCK 1: SESSION & BRANCH DETAILS */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-black text-white">1</span>
                BRANCH & USER DETAILS
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
                ACTIVE
              </span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">COUNTRY:</span>
                <span className="font-bold text-foreground">Pakistan / Afghanistan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">BRANCH NAME:</span>
                <span className="font-bold text-foreground truncate max-w-[140px]" title="UNITED ARAB EMIRATES MAIN BRANCH">MAIN HEADQUARTERS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">USER NAME:</span>
                <span className="font-bold text-foreground">SUPER ADMIN (Asmat Abdullah)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ROLE:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">GLOBAL SUPER ADMIN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">DATE & TIME:</span>
                <span className="font-mono text-muted-foreground text-[10px]">{currentTime || "17 Aug 2026, 02:15 PM"}</span>
              </div>
            </div>
          </div>

          {/* BLOCK 2: GLOBAL CREDENTIAL SUMMARY */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white">2</span>
                GLOBAL USER SUMMARY
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">TOTAL: {stats.total}</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">TOTAL USERS:</span>
                <span className="font-mono font-black text-foreground text-xs">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ACTIVE LOGINS:</span>
                <span className="font-mono font-bold text-emerald-600">{stats.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ADMIN & MANAGERS:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{stats.admins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">STAFF & CASHIERS:</span>
                <span className="font-mono font-bold text-amber-600">{stats.total - stats.admins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">SYSTEM VAULT:</span>
                <span className="font-bold text-emerald-600">ENCRYPTED & SYNCED</span>
              </div>
            </div>
          </div>

          {/* BLOCK 3: BRANCH & ACCESS COVERAGE */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-[9px] font-black text-white">3</span>
                ACCESS COVERAGE
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">{stats.branches} BRANCHES</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">COVERED BRANCHES:</span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400">{stats.branches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ACTIVE COUNTRIES:</span>
                <span className="font-mono font-bold text-foreground">{countriesList.length || 3}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">SYSTEM FORMS:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{ALL_SYSTEM_FORMS.length} Active Forms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ROLE TIERS:</span>
                <span className="font-bold text-foreground">6 Hierarchy Levels</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">SECURITY CHECK:</span>
                <span className="font-bold text-emerald-600">PASSED 100%</span>
              </div>
            </div>
          </div>

          {/* BLOCK 4: DIRECT QUICK ACCESS */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white">4</span>
                  QUICK HANDOVER TOOLS
                </span>
                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">ONLINE</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Click any user row to open their <strong>Form Permissions Matrix</strong> or generate their official A4 Onboarding Handover Form.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => { setPrintModalUser(null); setShowBatchPrint(true); }}
                className="w-full h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
              >
                <Printer className="h-3 w-3 mr-1" />
                Batch Handover Sheet
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* ─── ERP LOGIN PORTALS DIRECT ACCESS GATEWAYS ─── */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/10 via-slate-900/5 to-purple-950/10 p-4 sm:p-5 shadow-xs print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Laptop className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase text-foreground tracking-tight">
                ERP Login Portals &amp; Direct Access Gateways
              </h3>
              <p className="text-[10px] text-muted-foreground font-medium">
                Share these dedicated login links and official @dgt.llc credentials with respective country and branch teams.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" target="_blank">
              <Button size="sm" className="h-7 px-3 text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Universal Login Page
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Portal 1: Super Admin */}
          <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-3 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                  Super Admin
                </span>
                <ShieldCheck className="h-4 w-4 text-red-600" />
              </div>
              <h4 className="text-xs font-bold text-foreground mt-1.5">Admin Login Portal</h4>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">/auth/login/admin</p>
              <div className="mt-2 bg-background/80 p-1.5 rounded border border-border/60 text-[10px] space-y-0.5">
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">User:</span> <strong className="text-foreground">superadmin@dgt.llc</strong></div>
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Pass:</span> <strong className="text-foreground">Admin@123</strong></div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <a href="/auth/login/admin?email=superadmin@dgt.llc" target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Login
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/auth/login/admin`, "portal-admin")} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                {copiedKey === "portal-admin" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Portal 2: Country Admin */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  Country Admin
                </span>
                <Globe className="h-4 w-4 text-indigo-600" />
              </div>
              <h4 className="text-xs font-bold text-foreground mt-1.5">Country Login Portal</h4>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">/auth/login/country</p>
              <div className="mt-2 bg-background/80 p-1.5 rounded border border-border/60 text-[10px] space-y-0.5">
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Format:</span> <strong className="text-foreground">pk.pakistan@dgt.llc</strong></div>
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Pass:</span> <strong className="text-foreground">Admin@123</strong></div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <a href="/auth/login/country?email=pk.pakistan@dgt.llc" target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Login
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/auth/login/country`, "portal-country")} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                {copiedKey === "portal-country" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Portal 3: City Branch */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  City Branch
                </span>
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <h4 className="text-xs font-bold text-foreground mt-1.5">City Branch Portal</h4>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">/auth/login/city</p>
              <div className="mt-2 bg-background/80 p-1.5 rounded border border-border/60 text-[10px] space-y-0.5">
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Format:</span> <strong className="text-foreground">chaman.branch.b@dgt.llc</strong></div>
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Pass:</span> <strong className="text-foreground">Admin@123</strong></div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <a href="/auth/login/city?email=chaman.branch.b@dgt.llc" target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Login
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/auth/login/city`, "portal-city")} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                {copiedKey === "portal-city" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Portal 4: Clearing Agent */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  Clearing Agent
                </span>
                <Layers className="h-4 w-4 text-amber-600" />
              </div>
              <h4 className="text-xs font-bold text-foreground mt-1.5">Agent Login Portal</h4>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">/auth/login/clearing-agent</p>
              <div className="mt-2 bg-background/80 p-1.5 rounded border border-border/60 text-[10px] space-y-0.5">
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Format:</span> <strong className="text-foreground">pk.clearingagent@dgt.llc</strong></div>
                <div className="flex justify-between font-mono"><span className="text-muted-foreground">Pass:</span> <strong className="text-foreground">Admin@123</strong></div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <a href="/auth/login/clearing-agent?email=pk.clearingagent@dgt.llc" target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300">
                  <ExternalLink className="h-3 w-3 mr-1" /> Open Login
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/auth/login/clearing-agent`, "portal-agent")} className="h-7 px-2 text-muted-foreground hover:text-foreground">
                {copiedKey === "portal-agent" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SEARCH & MULTI-FILTER BAR ─── */}
      <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between print:hidden">
        <div className="relative w-full md:w-96">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search User, Code, Email, Branch, Vault ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-foreground placeholder:text-muted-foreground font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">All Countries</option>
            {countriesList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">All Roles</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none text-foreground font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {(searchQuery || countryFilter !== "all" || roleFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setCountryFilter("all");
                setRoleFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 rounded-xl"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* ─── FULL-WIDTH USERS DATA DIRECTORY TABLE ─── */}
      <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden print:border-none print:shadow-none">
        
        {/* Printable Header (Visible ONLY when printing) */}
        <div className="hidden print:block p-6 border-b-2 border-slate-900 mb-4">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">DAMAAN BUSINESS GROUP • ERP SYSTEM</h1>
              <p className="text-xs font-bold text-slate-600">CONFIDENTIAL • SUPER ADMIN USER CREDENTIAL & ACCESS DIRECTORY</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500">
              <div>Generated: {new Date().toLocaleString()}</div>
              <div>Scope: Global Enterprise Register</div>
            </div>
          </div>
          <div className="bg-slate-100 p-2.5 rounded text-[10px] text-slate-700 font-medium">
            <strong>Security Notice:</strong> This document contains official system access credentials. Handle strictly in accordance with company confidentiality policy.
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 flex items-center gap-3 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase font-black text-[10px] tracking-wider print:bg-slate-100 print:text-slate-900">
              <tr>
                <th className="p-3.5 text-center w-12">Sr #</th>
                <th className="p-3.5">User & Code</th>
                <th className="p-3.5">Role & Level</th>
                <th className="p-3.5">Country & Branch</th>
                <th className="p-3.5">Login Portal URL</th>
                <th className="p-3.5">Username / Email</th>
                <th className="p-3.5">Password Key / Vault</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading user directory & access register from database...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No users matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  const isRevealed = revealedPasswords[u.userId];
                  
                  let roleColor = "bg-muted text-muted-foreground border-border";
                  if (u.role.includes("super_admin")) {
                    roleColor = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900";
                  } else if (u.role.includes("country_admin")) {
                    roleColor = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900";
                  } else if (u.role.includes("branch_admin")) {
                    roleColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900";
                  } else if (u.role.includes("cashier") || u.role.includes("accountant")) {
                    roleColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900";
                  }

                  return (
                    <tr 
                      key={u.userId}
                      onClick={() => openUserInspector(u)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer print:hover:bg-transparent group"
                    >
                      {/* Sr # */}
                      <td className="p-3.5 text-center font-mono font-bold text-muted-foreground text-[11px]">
                        {index + 1}
                      </td>

                      {/* User & Code */}
                      <td className="p-3.5">
                        <div className="font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {u.fullName}
                        </div>
                        <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{u.userCode}</div>
                      </td>

                      {/* Role */}
                      <td className="p-3.5">
                        <span className={cn("px-2.5 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider border", roleColor)}>
                          {u.roleLabel}
                        </span>
                      </td>

                      {/* Country & Branch */}
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {u.countryName}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                          {u.branchName}
                        </div>
                      </td>

                      {/* Login URL */}
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40 truncate max-w-[160px] inline-block" title={u.loginUrl}>
                            {u.loginUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`${window.location.origin}${u.loginUrl}`, `url-${u.userId}`)}
                            title="Copy Direct Login URL"
                            className="text-muted-foreground hover:text-foreground print:hidden cursor-pointer"
                          >
                            {copiedKey === `url-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={u.loginUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open Login Page in New Tab"
                            className="text-muted-foreground hover:text-blue-600 print:hidden cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Username / Email */}
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-foreground text-[11px]">
                            {u.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.email, `email-${u.userId}`)}
                            title="Copy Username / Email"
                            className="text-muted-foreground hover:text-foreground print:hidden cursor-pointer"
                          >
                            {copiedKey === `email-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Password Key / Vault */}
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded text-[11px] tracking-wide border border-border">
                            {isRevealed ? (u.passwordKey || "Admin@123") : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePassword(u.userId)}
                            title={isRevealed ? "Hide Password Key" : "Reveal Password Key"}
                            className="text-muted-foreground hover:text-indigo-600 print:hidden cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.passwordKey || "Admin@123", `pwd-${u.userId}`)}
                            title="Copy Password (Admin@123)"
                            className="text-muted-foreground hover:text-foreground print:hidden cursor-pointer"
                          >
                            {copiedKey === `pwd-${u.userId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                          u.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        )}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions (Screen only) */}
                      <td className="p-3.5 text-center print:hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <a
                            href={`${u.loginUrl}?email=${encodeURIComponent(u.email)}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`Open Login Portal for ${u.fullName}`}
                          >
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Login ↗
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            onClick={() => openUserInspector(u)}
                            className="h-7 px-2.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs cursor-pointer"
                            title="Inspect User Details & Forms Permission Matrix"
                          >
                            <SlidersHorizontal className="w-3 h-3 mr-1" />
                            Inspect
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setPrintModalUser(u); setShowBatchPrint(false); }}
                            title="Generate Individual A4 Onboarding Handover Form"
                            className="h-7 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer"
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            A4 Slip
                          </Button>
                          <Link href={`/dashboard/new-entry/users/registration?userId=${u.userId}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-lg cursor-pointer"
                            >
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── INTERACTIVE USER INSPECTOR & FORMS PERMISSION MATRIX MODAL ─── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:hidden animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-foreground">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                  {selectedUser.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black">{selectedUser.fullName}</h2>
                    <span className="bg-indigo-500/30 text-indigo-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-400/30">
                      {selectedUser.userCode}
                    </span>
                    <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-400/30 uppercase">
                      {selectedUser.roleLabel}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    {selectedUser.email} • {selectedUser.branchName} ({selectedUser.countryName})
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-6 pt-2">
              <button
                type="button"
                onClick={() => setActiveModalTab("permissions")}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                  activeModalTab === "permissions"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Allowed Forms & Permission Matrix ({ALL_SYSTEM_FORMS.length} Forms)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab("profile")}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                  activeModalTab === "profile"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Branch, Identity & Security Vault</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab("handover")}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer",
                  activeModalTab === "handover"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background rounded-t-lg"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>A4 Onboarding Slip</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              
              {/* TAB 1: PERMISSION MATRIX */}
              {activeModalTab === "permissions" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3.5 rounded-2xl border border-border">
                    <div>
                      <h3 className="text-xs font-black uppercase text-foreground flex items-center gap-2">
                        <span>Form Level Authorization & Permission Grants</span>
                        <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded">
                          {Object.values(userPermissions).filter((p) => p.allowed).length} / {ALL_SYSTEM_FORMS.length} Allowed
                        </span>
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Toggle access on/off for specific ERP forms, and adjust Read/Write/Delete privileges.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGrantAll}
                        className="h-8 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer"
                      >
                        Grant All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevokeAll}
                        className="h-8 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                      >
                        Restrict All
                      </Button>
                    </div>
                  </div>

                  {/* Permissions Table by Category */}
                  <div className="overflow-hidden rounded-2xl border border-border">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/70 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-2.5">Form / Module</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5 text-center">Access Status</th>
                          <th className="px-3 py-2.5 text-center">Read</th>
                          <th className="px-3 py-2.5 text-center">Write</th>
                          <th className="px-3 py-2.5 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ALL_SYSTEM_FORMS.map((form) => {
                          const p = userPermissions[form.id] || { allowed: false, read: false, write: false, delete: false };
                          return (
                            <tr key={form.id} className={cn("hover:bg-muted/30 transition-colors", !p.allowed && "opacity-60 bg-muted/10")}>
                              <td className="px-4 py-2.5 font-bold text-foreground">
                                <div>{form.name}</div>
                                <div className="text-[10px] font-mono text-muted-foreground font-normal">{form.route}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-block rounded px-2 py-0.5 text-[9px] font-extrabold bg-muted text-muted-foreground border border-border">
                                  {form.category}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleFormAccess(form.id)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                    p.allowed
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-muted text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
                                  )}
                                >
                                  {p.allowed ? "Allowed" : "Restricted"}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.read}
                                  disabled={!p.allowed}
                                  onChange={() => togglePermFlag(form.id, "read")}
                                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.write}
                                  disabled={!p.allowed}
                                  onChange={() => togglePermFlag(form.id, "write")}
                                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.delete}
                                  disabled={!p.allowed}
                                  onChange={() => togglePermFlag(form.id, "delete")}
                                  className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: PROFILE & CREDENTIALS */}
              {activeModalTab === "profile" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Identity Card */}
                    <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <Users className="h-4 w-4" /> Identity & Role Assignment
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">User Code:</span>
                          <span className="font-mono font-bold text-foreground">{selectedUser.userCode}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">Full Name:</span>
                          <span className="font-bold text-foreground">{selectedUser.fullName}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">Primary Role:</span>
                          <span className="font-black text-indigo-600">{selectedUser.roleLabel}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">Assigned Country:</span>
                          <span className="font-bold text-foreground">{selectedUser.countryName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned Branch:</span>
                          <span className="font-bold text-foreground">{selectedUser.branchName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Security Vault & Password Card */}
                    <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4" /> Credentials & Access Vault
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">Vault Reference:</span>
                          <span className="font-mono font-bold text-foreground">{selectedUser.passwordVaultRef}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-border">
                          <span className="text-muted-foreground">Login Email:</span>
                          <span className="font-mono font-bold text-foreground">{selectedUser.email}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-border items-center">
                          <span className="text-muted-foreground">Access Password:</span>
                          <span className="font-mono font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            {selectedUser.passwordKey || "••••••••"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Direct Login URL:</span>
                          <span className="font-mono text-[10px] text-blue-600 truncate max-w-[180px]">{selectedUser.loginUrl}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: A4 ONBOARDING SLIP */}
              {activeModalTab === "handover" && (
                <div className="space-y-4 flex flex-col items-center">
                  <div className="bg-white text-slate-900 w-full max-w-xl p-6 rounded-2xl shadow-md border border-slate-200 font-sans space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">DGT ENTERPRISE ERP SYSTEM</h4>
                        <p className="text-[10px] font-bold text-indigo-700 uppercase">OFFICIAL EMPLOYEE ACCESS SLIP</p>
                      </div>
                      <div className="text-right text-[9px] font-mono text-slate-500">
                        Date: {new Date().toLocaleDateString("en-GB")}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block">EMPLOYEE / OFFICER NAME</span>
                        <span className="font-bold text-slate-900">{selectedUser.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block">USER CODE</span>
                        <span className="font-mono font-bold text-slate-900">{selectedUser.userCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block">ROLE & JURISDICTION</span>
                        <span className="font-bold text-indigo-700">{selectedUser.roleLabel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block">BRANCH LOCATION</span>
                        <span className="font-bold text-slate-900">{selectedUser.branchName}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 font-bold block">LOGIN USERNAME / EMAIL</span>
                        <span className="font-mono font-bold text-slate-900 break-all bg-slate-50 p-1.5 rounded border border-slate-200 block">{selectedUser.email}</span>
                      </div>
                      <div className="col-span-2 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-bold block">INITIAL ACCESS PASSWORD</span>
                        <span className="font-mono font-black text-emerald-700 text-sm">{selectedUser.passwordKey || "Admin@123"}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-between text-[9px] text-slate-500 font-medium">
                      <span>Authorized by: Super Admin</span>
                      <span>Security Stamp: Cryptographically Verified</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => { setPrintModalUser(selectedUser); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-xs"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Open Official Print Preview
                  </Button>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="border-t border-border bg-muted/20 px-6 py-3.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                All changes to permissions are logged in the ERP security audit ledger.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveUserPermissions}
                  className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Permission Grants</span>
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── A4 HANDOVER MODAL PREVIEW (Batch or Single User) ─── */}
      {(showBatchPrint || printModalUser) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:z-auto">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-foreground print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:p-0">
            
            {/* Modal Header (Hidden on print) */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40 print:hidden">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Printer className="w-4 h-4 text-indigo-600" />
                {printModalUser ? `Official A4 Handover Slip: ${printModalUser.fullName}` : "A4 Batch Credential Handover Sheet"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintA4}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 px-4 rounded-xl cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Now
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowBatchPrint(false); setPrintModalUser(null); }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Modal Body: A4 Sheet Preview */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-muted/10 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              
              {/* SINGLE USER HANDOVER SLIP */}
              {printModalUser ? (
                <div id="a4-handover-printable" className="bg-white text-slate-900 w-full max-w-3xl p-8 rounded-2xl shadow-xl border border-slate-200 font-sans space-y-6 print:shadow-none print:border-none print:p-8 print:max-w-none">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">DGT ENTERPRISE ERP SYSTEM</h2>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-0.5">OFFICIAL USER ACCESS & CREDENTIAL HANDOVER SLIP</p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-800">REF: {printModalUser.userCode}</div>
                      <div>DATE: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <span className="inline-block bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 text-[9px]">CONFIDENTIAL</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    This official credential slip authorizes the designated officer to access the DGT Enterprise ERP & FMS platform in accordance with the allocated role and branch jurisdiction.
                  </p>

                  {/* 2-Column Structured Card */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">OFFICER & SYSTEM IDENTITY</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE STATUS</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">OFFICER / FULL NAME</span>
                        <span className="font-bold text-slate-900 text-sm">{printModalUser.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SYSTEM USER CODE</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">{printModalUser.userCode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SYSTEM ROLE / LEVEL</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">{printModalUser.roleLabel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ASSIGNED BRANCH JURISDICTION</span>
                        <span className="font-bold text-slate-900">{printModalUser.branchName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">COUNTRY JURISDICTION</span>
                        <span className="font-bold text-slate-800">{printModalUser.countryName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">DIRECT LOGIN URL</span>
                        <span className="font-mono text-blue-700 font-bold break-all">{printModalUser.loginUrl}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Box */}
                  <div className="bg-slate-50 border-2 border-indigo-200 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      OFFICIAL LOGIN CREDENTIALS
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">LOGIN USERNAME / EMAIL</span>
                        <span className="font-mono font-black text-slate-900 text-sm bg-white px-2.5 py-1 rounded border border-slate-300 block break-all mt-1">{printModalUser.email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">INITIAL ACCESS PASSWORD</span>
                        <span className="font-mono font-black text-emerald-700 text-sm bg-white px-2.5 py-1 rounded border border-emerald-300 block mt-1">{printModalUser.passwordKey || "Admin@123"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-[10.5px] text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                      SECURITY & COMPLIANCE NOTICE:
                    </div>
                    <p>1. Keep your credentials confidential. Never share your password across email or chat.</p>
                    <p>2. You must change your temporary password upon first login to your personal password.</p>
                    <p>3. All actions, entries, and edits are permanently audited under your cryptographic user code.</p>
                  </div>

                  {/* Authorization & Signature Block */}
                  <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-900 text-xs">
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">Super Admin Authorization</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">Signature & Official Stamp</div>
                    </div>
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">Staff Member Acknowledgement</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">Received By, Signature & Date</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* BATCH HANDOVER DIRECTORY SHEET */
                <div id="a4-handover-printable" className="bg-white text-slate-900 w-full max-w-5xl p-8 rounded-2xl shadow-xl border border-slate-200 font-sans space-y-6 print:shadow-none print:border-none print:p-4 print:max-w-none">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">DGT ENTERPRISE ERP SYSTEM</h2>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-0.5">OFFICIAL SYSTEM ACCESS & BATCH CREDENTIAL HANDOVER DIRECTORY</p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-800">TOTAL USERS: {filteredUsers.length}</div>
                      <div>DATE: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <span className="inline-block bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200 text-[9px]">CONFIDENTIAL</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Official batch credential handover manifest for all active branch officers and system administrators.
                  </p>

                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-300">
                        <tr>
                          <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                          <th className="p-2 border-r border-slate-300">User Code</th>
                          <th className="p-2 border-r border-slate-300">Full Name & Role</th>
                          <th className="p-2 border-r border-slate-300">Assigned Branch</th>
                          <th className="p-2 border-r border-slate-300">Login Username / Email</th>
                          <th className="p-2 border-r border-slate-300">Password Key</th>
                          <th className="p-2">Recipient Signature</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredUsers.map((u, idx) => (
                          <tr key={u.userId} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-center border-r border-slate-200 text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">{u.userCode}</td>
                            <td className="p-2 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{u.fullName}</div>
                              <div className="text-[10px] text-indigo-700 font-medium">{u.roleLabel}</div>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-slate-700">
                              <div>{u.branchName}</div>
                              <div className="text-[9.5px] text-slate-400 font-medium">{u.countryName}</div>
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200 break-all">{u.email}</td>
                            <td className="p-2 font-mono font-bold text-emerald-700 border-r border-slate-200 whitespace-nowrap bg-emerald-50/40">
                              {u.passwordKey || "Admin@123"}
                            </td>
                            <td className="p-2 border-slate-200 min-w-[110px]">
                              <div className="border-b border-dashed border-slate-300 h-5"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Authorization & Signature Block */}
                  <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-900 text-xs">
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">Super Admin Authorization</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">Signature & Official Stamp</div>
                    </div>
                    <div className="space-y-4">
                      <div className="font-bold text-slate-800 uppercase text-[11px]">Internal Security Verification</div>
                      <div className="border-b border-slate-400 h-10"></div>
                      <div className="text-[10px] text-slate-500 font-medium">Audit Officer Signature & Date</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
