"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Save,
  Printer,
  FileText,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  Loader2,
  Phone,
  X,
  Plus,
  Pencil,
  Globe2,
  Ship,
  CheckSquare,
  Square
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceFormFill } from "@/components/voice-form-fill";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiPost, apiPatch } from "@/lib/api/client";
import { CustomerPicker } from "@/features/customers/components/customer-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { WarehousePicker } from "@/features/warehouses/components/warehouse-picker";
import { fetchWarehouses } from "@/features/warehouses/warehouse-api";
import { rtlLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { localizeTerm } from "@/lib/i18n/transliteration";
import { getLabel } from "./translations";
import { AccountLiveReportPanel } from "./account-live-report-panel";
import { openAccountA4ReportWindow } from "@/lib/reports/open-account-a4-report-window";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { LoginScopeBanner } from "@/components/layout/login-scope-banner";
import { fetchBranding } from "@/lib/branding/client";

type BranchType = "Main" | "City";

type AccountGeneralReportRow = {
  accountId: string;
  accountCode: string;
  rawAccountCode?: string;
  customerNumber?: string;
  countrySerialNumber?: string;
  branchSerialNumber?: string;
  manualReferenceNumber?: string | null;
  accountName: string;
  journalCode: string;
  ledgerId: string | null;
  ledgerName: string | null;
  ledgerStatus: string;
  ledgerCurrency: string;
  branchType: string;
  branchName: string;
  mainBranchName?: string;
  cityBranchName?: string;
  branchCode: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  stateName: string;
  stateCode: string;
  cityId: string | null;
  cityName: string;
  cityCode: string;
  currency: string;
  accountCategory: string;
  subType: string;
  status: string;
  createdAt: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  currentBalance: number;
  linkedLedgerCount: number;
  journalActivityCount: number;
  latestJournalNo: string | null;
  latestActivityAt: string | null;
  companyName: string;
  companyCode: string;
  companyOwner: string;
  recentActivityLabel: string | null;
  recentActivityAt: string | null;
  accountSerialNumber?: number;
  branchAccountSequence?: number;
};

type AccountTitle = "Customer" | "Company" | "Bank" | "Employee" | "Personal" | "Expenses Account";

type BranchInfo = {
  company: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  opening: string;
  currency: string;
};

type SavedEntry = {
  id: string;
  journalCode: string;
  accountCode: string;
  manualReferenceNumber?: string | null;
  customerNumber?: string;
  accountName: string;
  branchName: string;
  branchCode: string;
  savedAt: string;
};

type CountryBranchRow = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  local_currency: string;
  is_main: boolean;
};

type CityBranchRow = {
  id: string;
  country_id: string;
  country_branch_id: string;
  city_name: string;
  name: string;
  code: string;
  local_currency: string;
};

type AccountCreateResponse = {
  accountId: string;
  ledgerId: string;
  accountCode: string;
  accountNumber: string;
  customerNumber: string;
  accountSerialNumber: number;
  countrySerialNumber: string;
  branchSerialNumber: string;
  manualReferenceNumber?: string | null;
  branchCode: string;
  branchAccountSequence: number;
};

const subTypes: Record<AccountTitle, string[]> = {
  Customer: ["Business Account", "Personal Account", "Inter-Country Trading Account", "Overseas Customer"],
  Company: [
    "Trading Company",
    "Supplier Company",
    "Service Provider",
    "Logistics Company",
    "Shipping Line Company",
    "Clearing Agent Agency",
    "Overseas Clearing Partner"
  ],
  Bank: ["Personal Bank", "Company Bank", "Inter-Country Central Holding Bank", "Exchange & Remittance Company"],
  Employee: ["Employee Position: Manager", "Employee Position: Cashier", "Employee Position: Clerk", "Field / Munshi Operator", "Port Operations Officer"],
  Personal: [],
  "Expenses Account": [
    "Office Expenses",
    "Operational Expenses",
    "Utility & Bills",
    "Rent & Lease",
    "Salaries & Wages",
    "Travel & Transport",
    "Marketing & Advertising",
    "Legal & Professional",
    "Maintenance & Repairs",
    "Miscellaneous Expenses",
    "Ocean & Air Freight",
    "Customs Clearance & Duties",
    "Port & Terminal Handling (THC)",
    "Container Demurrage & Detention",
    "Cross-Border Transit Charges"
  ]
};

const categories = ["P/S", "B/C", "B/P", "EX", "S"];

function nextNumber(current: number) {
  return String(current + 1).padStart(3, "0");
}

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// E.164-ish: optional +, 7–15 digits, allow spaces/dashes/parens for readability
const PHONE_RE = /^\+?[0-9][0-9\s()\-]{6,20}[0-9]$/;

/** Validate a single contact entry. Returns an error key or null. */
function contactErrorKey(type: string, value: string): string | null {
  const v = (value || "").trim();
  if (!v) return null; // empty rows are ignored, not errors
  if (type === "Email") return EMAIL_RE.test(v) ? null : "invalidEmail";
  if (type === "Mobile" || type === "WhatsApp" || type === "Landline" || type === "Office") {
    return PHONE_RE.test(v) ? null : "invalidPhone";
  }
  return null;
}

function selectedBranchName(rows: CountryBranchRow[], id: string) {
  const row = rows.find((item) => item.id === id);
  return row ? `${row.name} (${row.code})` : "-";
}

function selectedCityBranchName(rows: CityBranchRow[], id: string) {
  const row = rows.find((item) => item.id === id);
  return row ? `${row.city_name} - ${row.name} (${row.code})` : "-";
}

function localizedOption(value: string, lang: SupportedLanguage) {
  if (!value) return "";
  const key = value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
  const label = getLabel(key, lang);
  if (label !== key) return label;
  const res = autoTranslate5Languages(value);
  return res[lang] || value;
}
export function NewAccountSetup({
  lang: propLang,
  initialAccountId,
  initialCountryId,
  initialBranchType,
  initialBranchId,
}: {
  lang?: SupportedLanguage;
  initialAccountId?: string;
  initialCountryId?: string;
  initialBranchType?: "Main" | "City";
  initialBranchId?: string;
}) {
  const router = useRouter();

  // Reactive language: prefer the live client-selected language (localStorage-backed store,
  // the same source <Th> uses) over the server-rendered propLang hint, so BOTH static labels
  // AND database-backed master-data values (re-fetched with ?lang=) switch when the user
  // changes language. propLang is only the SSR fallback for the very first paint.
  const activeLang = useActiveLanguage();
  const lang = (activeLang || propLang || "en") as SupportedLanguage;

  const isRtl = useMemo(() => rtlLanguages.includes(lang), [lang]);

  // Live report states
  const [reportRows, setReportRows] = useState<AccountGeneralReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedReportAccountId, setSelectedReportAccountId] = useState("current");

  // Sidebar filter states
  const [sidebarFilter, setSidebarFilter] = useState("");
  const filteredSidebarRows = useMemo(() => {
    return reportRows.filter((r) => {
      const q = sidebarFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        (r.accountCode ?? "").toLowerCase().includes(q) ||
        (r.accountName ?? "").toLowerCase().includes(q) ||
        (r.accountCategory ?? "").toLowerCase().includes(q) ||
        (r.currency ?? "").toLowerCase().includes(q)
      );
    });
  }, [reportRows, sidebarFilter]);

  // Step state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Branch / Account form state (Step 1)
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [mainBranches, setMainBranches] = useState<CountryBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [country, setCountry] = useState("");
  const [operationalDomain, setOperationalDomain] = useState<"business" | "shipping">("business");
  const [ownershipLevel, setOwnershipLevel] = useState<"country" | "main_branch" | "city_branch">("main_branch");
  const [branchType, setBranchType] = useState<BranchType | "">("Main");
  const [branch, setBranch] = useState("");
  const [accountTitle, setAccountTitle] = useState<AccountTitle | "">("");
  const [subType, setSubType] = useState("");
  const [category, setCategory] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [dbCategories, setDbCategories] = useState<Array<{
    id: string;
    name: string;
    code: string;
    description?: string | null;
    operationalDomain?: string;
    isSystem?: boolean;
  }>>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<"add" | "edit">("add");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catFormName, setCatFormName] = useState("");
  const [catFormCode, setCatFormCode] = useState("");
  const [catFormDesc, setCatFormDesc] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [manualReferenceNumber, setManualReferenceNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [contacts, setContacts] = useState<Array<{ type: string; value: string }>>([{ type: "Mobile", value: "" }]);
  const [journalCounter, setJournalCounter] = useState(0);
  const [lastBranchCode, setLastBranchCode] = useState("");

  // Authenticated, server-resolved scope — the single source of truth for which
  // country / branch this user may create accounts in. The create API enforces
  // the same scope server-side (authorizeApiScope); this only pre-selects and
  // locks the UI so the two can never disagree.
  const erpScope = useErpScope();
  const [scopePrefilled, setScopePrefilled] = useState(false);
  const [brandCompanyName, setBrandCompanyName] = useState<string | null>(null);

  // Lock levels the user's scope fixes (edit mode keeps the loaded record's values).
  const countryLocked = !initialAccountId && !erpScope.isSuperAdmin && Boolean(erpScope.lockedCountryId);
  const branchLocked = !initialAccountId && !erpScope.isSuperAdmin && erpScope.mode === "city_branch" && Boolean(erpScope.lockedCityBranchId);
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<AccountCreateResponse | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [actionsPortal, setActionsPortal] = useState<HTMLElement | null>(null);

  // Dynamic active steps list based on accountTitle, category and subType
  const activeSteps = useMemo(() => {
    const steps: number[] = [1];
    const isExpense = category === "EX" || accountTitle === "Expenses Account";
    const isBank = accountTitle === "Bank";
    const isCompany = accountTitle === "Company" || (accountTitle === "Customer" && subType === "Business Account");
    const isPersonal = accountTitle === "Personal" || (accountTitle === "Customer" && subType !== "Business Account") || accountTitle === "Employee";

    if (isExpense) {
      steps.push(6);
    } else if (isBank) {
      steps.push(4, 6);
    } else if (isCompany) {
      steps.push(2, 3, 4, 5, 6);
    } else if (isPersonal) {
      steps.push(2, 6);
    } else {
      steps.push(2, 3, 4, 5, 6);
    }
    return steps;
  }, [category, accountTitle, subType]);

  const prevStep = useMemo(() => {
    const idx = activeSteps.indexOf(currentStep);
    return idx > 0 ? (activeSteps[idx - 1] as 1 | 2 | 3 | 4 | 5 | 6) : 1;
  }, [activeSteps, currentStep]);

  const nextStep = useMemo(() => {
    const idx = activeSteps.indexOf(currentStep);
    return idx !== -1 && idx < activeSteps.length - 1 ? (activeSteps[idx + 1] as 1 | 2 | 3 | 4 | 5 | 6) : 6;
  }, [activeSteps, currentStep]);

  // If currentStep becomes inactive because of dropdown change, reset to 1
  useEffect(() => {
    if (!activeSteps.includes(currentStep)) {
      setCurrentStep(1);
    }
  }, [activeSteps, currentStep]);


  useEffect(() => {
    setActionsPortal(document.getElementById("erp-page-actions-slot"));
  }, []);

  // Load account details for editing if initialAccountId is provided
  useEffect(() => {
    if (!initialAccountId) return;
    let cancelled = false;

    async function loadAccountDetails() {
      setLoadingAccount(true);
      setMessage("");
      try {
        const res = await fetch(`/api/erp/accounting/accounts/${initialAccountId}?language=${encodeURIComponent(lang)}`).then((r) => r.json());
        if (cancelled) return;
        if (res && res.ok && res.data) {
          const acc = res.data.account;
          if (acc) {
            setCountry(acc.country_id || "");
            if (acc.operational_domain === "shipping") {
              setOperationalDomain("shipping");
            } else {
              setOperationalDomain("business");
            }
            if (acc.scope === "country") {
              setOwnershipLevel("country");
              setBranchType("Main");
              setBranch("");
            } else if (acc.scope === "main_branch") {
              setOwnershipLevel("main_branch");
              setBranchType("Main");
              setBranch(acc.country_branch_id || "");
            } else {
              setOwnershipLevel("city_branch");
              setBranchType("City");
              setBranch(acc.city_branch_id || "");
            }
            
            // Determine accountTitle and linked master records
            if (acc.customer_id) {
              setAccountTitle("Customer");
              setLinkedCustomerId(acc.customer_id);
              fetch(`/api/erp/customers/${acc.customer_id}?lang=${lang}`)
                .then((r) => r.json())
                .then((json) => {
                  const name = json?.customer?.customer_name ?? json?.data?.customer_name ?? "";
                  if (!cancelled) setLinkedCustomerName(name);
                })
                .catch(() => null);
            } else if (acc.company_id) {
              setAccountTitle("Company");
              setLinkedCompanyId(acc.company_id);
              fetch(`/api/erp/companies/${acc.company_id}?lang=${lang}`)
                .then((r) => r.json())
                .then((json) => {
                  const name = json?.company?.name ?? json?.company?.legal_name ?? "";
                  if (!cancelled) setLinkedCompanyName(name);
                })
                .catch(() => null);
            } else if (acc.bank_id) {
              setAccountTitle("Bank");
              setLinkedBankId(acc.bank_id);
              fetch(`/api/erp/banks/${acc.bank_id}?lang=${lang}`)
                .then((r) => r.json())
                .then((json) => {
                  const name = json?.data?.bank?.bank_name ?? json?.bank?.bank_name ?? json?.bank_name ?? "";
                  if (!cancelled) setLinkedBankName(name);
                })
                .catch(() => null);
            } else {
              setAccountTitle("Personal");
            }

            // Determine category
            if (acc.category_id) {
              setSelectedCategoryId(acc.category_id);
            }
            if (acc.category) {
              setCategory(acc.category);
            } else if (acc.is_control_account) {
              setCategory("B/C");
            } else if (acc.kind === "expense") {
              setCategory("EX");
            } else if (acc.kind === "income") {
              setCategory("P/S");
            } else {
              setCategory("S");
            }

            setSubType(acc.is_control_account ? "Control Account" : "Normal Account");
            setAccountCode(acc.account_number || acc.code || "");
            setManualReferenceNumber(acc.manual_reference_number || "");
            setAccountName(acc.name || "");
            setContacts(Array.isArray(acc.contacts) && acc.contacts.length > 0 ? acc.contacts : [{ type: "Mobile", value: "" }]);

            if (acc.shipping_line_id) {
              setLinkedShippingLineId(acc.shipping_line_id);
              fetch(`/api/erp/shipping-lines/${acc.shipping_line_id}?lang=${lang}`)
                .then((r) => r.json())
                .then((json) => {
                  const shl = json?.data?.shippingLine || json?.shippingLine;
                  if (!cancelled && shl) {
                    setShippingLineDetail(shl);
                    setLinkedShippingLineName(shl.name || "");
                  }
                })
                .catch(() => null);
            }
            if (Array.isArray(acc.linked_countries) && acc.linked_countries.length > 0) {
              setLinkedCountries(acc.linked_countries);
            }

            if (typeof window !== "undefined") {
              const storedWhKey = localStorage.getItem(`account_warehouse_${acc.id}`) || localStorage.getItem(`account_warehouse_${acc.account_number || acc.code}`);
              if (storedWhKey) {
                try {
                  const parsedWh = JSON.parse(storedWhKey);
                  if (parsedWh?.id) {
                    setLinkedWarehouseId(parsedWh.id);
                    if (parsedWh.detail) setWarehouseDetail(parsedWh.detail);
                  }
                } catch (e) {}
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load account details:", err);
        setMessage(getLabel("failedLoadAccount", lang));
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    }

    loadAccountDetails();
    return () => {
      cancelled = true;
    };
  }, [initialAccountId, lang]);

  // Master record links â€” IDs come from Master Form pickers
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);
  const [linkedCustomerName, setLinkedCustomerName] = useState("");
  const [linkedCompanyId, setLinkedCompanyId] = useState<string | null>(null);
  const [linkedCompanyName, setLinkedCompanyName] = useState("");
  const [linkedBankId, setLinkedBankId] = useState<string | null>(null);
  const [linkedBankName, setLinkedBankName] = useState("");
  const [linkedWarehouseId, setLinkedWarehouseId] = useState<string | null>(null);
  const [linkedShippingLineId, setLinkedShippingLineId] = useState<string | null>(null);
  const [linkedShippingLineName, setLinkedShippingLineName] = useState("");
  const [shippingLinesList, setShippingLinesList] = useState<Array<{ id: string; name: string; shipping_line_code?: string; linked_countries?: string[] }>>([]);
  const [linkedCountries, setLinkedCountries] = useState<string[]>([]);

  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [companyDetail, setCompanyDetail] = useState<any>(null);
  const [bankDetail, setBankDetail] = useState<any>(null);
  const [warehouseDetail, setWarehouseDetail] = useState<any>(null);
  const [shippingLineDetail, setShippingLineDetail] = useState<any>(null);

  // Fetch full customer details when linkedCustomerId changes
  useEffect(() => {
    if (!linkedCustomerId) { setCustomerDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/customers/${linkedCustomerId}?lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && (json?.data || json?.customer)) setCustomerDetail(json.data ?? json.customer);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [linkedCustomerId, lang]);

  // Fetch company details when linkedCompanyId changes
  useEffect(() => {
    if (!linkedCompanyId) { setCompanyDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/companies/${linkedCompanyId}?lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        let comp = json?.data?.company || json?.company || {};
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("incorporated_companies");
          if (stored) {
            try {
              const list = JSON.parse(stored);
              const found = list.find((c: any) => c.id === linkedCompanyId);
              if (found) comp = { ...comp, ...found };
            } catch (e) {}
          }
        }
        if (json?.ok && (json?.data?.company || json?.company)) {
          setCompanyDetail(comp);
        } else if (comp.id) {
          setCompanyDetail(comp);
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("incorporated_companies");
          if (stored) {
            try {
              const list = JSON.parse(stored);
              const found = list.find((c: any) => c.id === linkedCompanyId);
              if (found && !cancelled) setCompanyDetail(found);
            } catch (e) {}
          }
        }
      });
    return () => { cancelled = true; };
  }, [linkedCompanyId, lang]);

  // Fetch bank details when linkedBankId changes
  useEffect(() => {
    if (!linkedBankId) { setBankDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/banks/${linkedBankId}?lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && (json?.data?.bank || json?.bank)) setBankDetail(json.data?.bank ?? json.bank);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [linkedBankId, lang]);

  // Fetch warehouse details when linkedWarehouseId changes
  useEffect(() => {
    if (!linkedWarehouseId) { setWarehouseDetail(null); return; }
    let cancelled = false;
    fetchWarehouses().then((list) => {
      if (cancelled) return;
      let found = list.find((w) => w.id === linkedWarehouseId);
      if (!found && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("erp_warehouses");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) found = parsed.find((w: any) => w.id === linkedWarehouseId);
          }
        } catch (e) {}
      }
      if (found) setWarehouseDetail(found);
    }).catch(() => null);
    return () => { cancelled = true; };
  }, [linkedWarehouseId]);

  // Fetch report records
  async function fetchReport() {
    setReportLoading(true);
    try {
      const res = await fetch("/api/erp/accounting/reports/accounts/general?limit=500").then((r) => r.json());
      if (res && res.ok && res.data && Array.isArray(res.data.rows)) setReportRows(res.data.rows);
    } catch (err) {
      console.error("Failed to load account report:", err);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => { fetchReport(); }, []);

  // Load countries (restricted strictly to countries with operating branches)
  useEffect(() => {
    let cancelled = false;
    listCountries({ withBranchesOnly: true })
      .then((rows) => {
        if (!cancelled) {
          setCountries(rows);
          // By default, initialize linked operating countries with all branch countries for full connectivity
          setLinkedCountries((prev) => (prev.length > 0 ? prev : rows.map((c) => c.id)));
        }
      })
      .catch(() => { if (!cancelled) setMessage(getLabel("couldNotLoadCountries", lang)); });
    return () => { cancelled = true; };
  }, []);

  // Fetch shipping lines list for master carrier linkage
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/erp/shipping-lines?limit=200&lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && Array.isArray(json?.data?.shippingLines)) {
          setShippingLinesList(json.data.shippingLines);
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [lang]);

  // Fetch shipping line details when linkedShippingLineId changes
  useEffect(() => {
    if (!linkedShippingLineId) {
      setShippingLineDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/erp/shipping-lines/${linkedShippingLineId}?lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const shl = json?.data?.shippingLine || json?.shippingLine;
        if (shl) {
          setShippingLineDetail(shl);
          setLinkedShippingLineName(shl.name || "");
          if (Array.isArray(shl.linked_countries) && shl.linked_countries.length > 0) {
            setLinkedCountries(shl.linked_countries);
          }
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [linkedShippingLineId, lang]);

  // Pre-select + lock country / branch from the authenticated scope or passed initial props (create mode only).
  useEffect(() => {
    if (initialAccountId || erpScope.loading || scopePrefilled) return;
    if (!erpScope.isSuperAdmin) {
      if (erpScope.lockedCountryId) setCountry(erpScope.lockedCountryId);
      if (erpScope.mode === "city_branch" && erpScope.lockedCityBranchId) {
        setBranchType("City");
        setBranch(erpScope.lockedCityBranchId);
      } else if (erpScope.mode === "main_branch" && erpScope.lockedCountryBranchId) {
        setBranchType("Main");
        setBranch(erpScope.lockedCountryBranchId);
      }
    } else {
      if (initialCountryId) setCountry(initialCountryId);
      if (initialBranchType) setBranchType(initialBranchType);
      if (initialBranchId) setBranch(initialBranchId);
    }
    setScopePrefilled(true);
  }, [initialAccountId, erpScope.loading, erpScope.isSuperAdmin, erpScope.mode, erpScope.lockedCountryId, erpScope.lockedCountryBranchId, erpScope.lockedCityBranchId, scopePrefilled, initialCountryId, initialBranchType, initialBranchId]);

  // Resolve the operating company for the selected country from the branding
  // master (country_company_profiles) — never a hard-coded "Damaan …".
  useEffect(() => {
    if (!country) { setBrandCompanyName(null); return; }
    let cancelled = false;
    fetchBranding(country)
      .then((b) => { if (!cancelled) setBrandCompanyName(b?.companyName || b?.legalName || null); })
      .catch(() => { if (!cancelled) setBrandCompanyName(null); });
    return () => { cancelled = true; };
  }, [country]);

  // Load Main Branches
  useEffect(() => {
    if (!country) { setMainBranches([]); return; }
    let cancelled = false;
    fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(country)}&operationalDomain=${operationalDomain}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          const list = json?.data?.branches || json?.branches || json?.countryBranches || [];
          setMainBranches(Array.isArray(list) ? list : []);
          if (list.length === 1 && (ownershipLevel === "main_branch" || branchType === "Main") && !branch) {
            setBranch(list[0].id);
          }
        }
      })
      .catch(() => { if (!cancelled) setMessage(getLabel("couldNotLoadMainBranches", lang)); });
    return () => { cancelled = true; };
  }, [country, branchType, ownershipLevel, branch, operationalDomain]);

  // Load City Branches
  useEffect(() => {
    if (!country) { setCityBranches([]); return; }
    let cancelled = false;
    const params = new URLSearchParams({ countryId: country, operationalDomain });
    fetch(`/api/erp/locations/branches/city?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          const list = json?.data?.cityBranches || json?.data?.branches || json?.cityBranches || [];
          setCityBranches(Array.isArray(list) ? list : []);
          if (list.length === 1 && (ownershipLevel === "city_branch" || branchType === "City") && !branch) {
            setBranch(list[0].id);
          }
        }
      })
      .catch(() => { if (!cancelled) setMessage(getLabel("couldNotLoadCityBranches", lang)); });
    return () => { cancelled = true; };
  }, [country, branchType, ownershipLevel, branch, operationalDomain]);

  // Load Categories from database
  async function loadCategories(domain = operationalDomain) {
    try {
      const res = await fetch(`/api/erp/account-categories?domain=${domain}&language=${encodeURIComponent(lang)}`).then((r) => r.json());
      if (res && res.ok && Array.isArray(res.categories)) {
        setDbCategories(res.categories);
      }
    } catch (err) {
      console.error("Failed to load account categories:", err);
    }
  }

  useEffect(() => {
    loadCategories(operationalDomain);
  }, [operationalDomain, lang]);

  function handleOpenAddCategory() {
    setCategoryModalMode("add");
    setEditingCategoryId(null);
    setCatFormName("");
    setCatFormCode("");
    setCatFormDesc("");
    setCatError("");
    setShowCategoryModal(true);
  }

  function handleOpenEditCategory() {
    const item = dbCategories.find((c) => c.name === category || c.id === selectedCategoryId);
    if (!item) return;
    setCategoryModalMode("edit");
    setEditingCategoryId(item.id);
    setCatFormName(item.name);
    setCatFormCode(item.code);
    setCatFormDesc(item.description || "");
    setCatError("");
    setShowCategoryModal(true);
  }

  async function handleSaveCategory() {
    if (!catFormName.trim() || !catFormCode.trim()) {
      setCatError("Category name and code are required.");
      return;
    }
    setCatSaving(true);
    setCatError("");
    try {
      if (categoryModalMode === "add") {
        const res = await fetch("/api/erp/account-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: catFormName.trim(),
            code: catFormCode.trim().toUpperCase(),
            description: catFormDesc.trim() || null,
            operationalDomain
          })
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error?.message || "Failed to create category");
        await loadCategories(operationalDomain);
        setCategory(res.category.name);
        setSelectedCategoryId(res.category.id);
        setShowCategoryModal(false);
      } else if (editingCategoryId) {
        const res = await fetch(`/api/erp/account-categories/${editingCategoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: catFormName.trim(),
            code: catFormCode.trim().toUpperCase(),
            description: catFormDesc.trim() || null,
            operationalDomain
          })
        }).then((r) => r.json());
        if (!res.ok) throw new Error(res.error?.message || "Failed to update category");
        await loadCategories(operationalDomain);
        setCategory(res.category.name);
        setSelectedCategoryId(res.category.id);
        setShowCategoryModal(false);
      }
    } catch (err: any) {
      setCatError(err.message || "Failed to save category");
    } finally {
      setCatSaving(false);
    }
  }

  const selectedCountry = useMemo(() => countries.find((item) => item.id === country) ?? null, [countries, country]);
  const canonicalCountryId = selectedCountry?.id ?? "";
  const branchOptionsRaw =
    ownershipLevel === "country"
      ? []
      : ownershipLevel === "main_branch" || branchType === "Main"
      ? mainBranches
      : cityBranches;

  // Filter branch options to the user's authorized branches (super admin = all).
  const branchOptions = useMemo(() => {
    if (erpScope.isSuperAdmin || initialAccountId) return branchOptionsRaw;
    if (branchType === "City" && erpScope.cityBranchIds.length > 0) {
      return branchOptionsRaw.filter((b) => erpScope.cityBranchIds.includes(b.id));
    }
    if (branchType === "Main" && erpScope.countryBranchIds.length > 0) {
      return branchOptionsRaw.filter((b) => erpScope.countryBranchIds.includes(b.id));
    }
    return branchOptionsRaw;
  }, [branchOptionsRaw, branchType, erpScope.isSuperAdmin, erpScope.cityBranchIds, erpScope.countryBranchIds, initialAccountId]);

  const branchInfo = useMemo<BranchInfo | null>(() => {
    if (!selectedCountry) return null;
    const company = brandCompanyName || selectedCountry.name;
    const fallbackCurrency = selectedCountry.currency_code || "USD";

    if (ownershipLevel === "country") {
      return {
        company,
        code: selectedCountry.iso2 || selectedCountry.iso3 || "CTR",
        city: selectedCountry.name,
        address: "-",
        phone: "-",
        email: "-",
        manager: "-",
        opening: "-",
        currency: fallbackCurrency
      };
    }

    if (!branch) return null;

    if (ownershipLevel === "main_branch" || branchType === "Main") {
      const row = mainBranches.find((item) => item.id === branch);
      // The branch list may still be loading or scope-filtered — when the id is
      // the user's own locked main branch, resolve from the session so the
      // Review screen is never blank.
      if (!row && branchLocked === false && erpScope.lockedCountryBranchId === branch) {
        return { company, code: "", city: erpScope.countryBranchName || selectedCountry.name, address: "-", phone: "-", email: "-", manager: "-", opening: "-", currency: fallbackCurrency };
      }
      if (!row) return null;
      return { company, code: row.code, city: selectedCountry.name, address: "-", phone: "-", email: "-", manager: "-", opening: "-", currency: row.local_currency || fallbackCurrency };
    }

    const row = cityBranches.find((item) => item.id === branch);
    if (!row && erpScope.lockedCityBranchId === branch) {
      return { company, code: "", city: erpScope.cityBranchName || selectedCountry.name, address: "-", phone: "-", email: "-", manager: "-", opening: "-", currency: fallbackCurrency };
    }
    if (!row) return null;
    return { company, code: row.code, city: row.city_name, address: "-", phone: "-", email: "-", manager: "-", opening: "-", currency: row.local_currency || fallbackCurrency };
  }, [branch, branchType, ownershipLevel, cityBranches, mainBranches, selectedCountry, brandCompanyName, branchLocked, erpScope.lockedCountryBranchId, erpScope.lockedCityBranchId, erpScope.countryBranchName, erpScope.cityBranchName]);

  const branchCode = branchInfo?.code ?? "";
  const isEditMode = Boolean(initialAccountId);
  
  const generatedPreviewCode = useMemo(() => {
    if (accountCode) return accountCode;
    const cCode = selectedCountry?.iso2 || (selectedCountry?.name?.slice(0, 2).toUpperCase()) || "GL";
    const bCode = branchInfo?.code ? branchInfo.code.replace(/[^A-Z0-9]/gi, "").slice(-4) : "001";
    const catCode = category ? (category.includes("P/S") ? "PS" : category.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase()) : "ACC";
    return `${cCode}-${bCode}-${catCode}`;
  }, [accountCode, selectedCountry, branchInfo, category]);

  const accountPreview = lastCreated?.accountNumber || accountCode || (branchCode ? generatedPreviewCode : "AUTO");
  const readyToSave = Boolean(
    country &&
    (ownershipLevel === "country" || branch) &&
    accountTitle &&
    subType &&
    category &&
    accountName
  );
  const saved = message?.startsWith("Saved") ?? false;

  useEffect(() => {
    if (!branchCode || branchCode === lastBranchCode) return;
    setLastBranchCode(branchCode);
    // In edit mode, do NOT reset the loaded account code when branch info resolves
    if (!initialAccountId) {
      setAccountCode("");
    }
  }, [branchCode, lastBranchCode, initialAccountId]);

  function handleCountryChange(value: string) {
    setCountry(value); setBranch(""); setLastBranchCode(""); setAccountCode(""); setLastCreated(null); setMessage("");
  }

  function handleBranchTypeChange(value: BranchType) {
    setBranchType(value); setBranch(""); setLastBranchCode(""); setAccountCode(""); setLastCreated(null); setMessage("");
  }

  // Create and save account on Step 6
  async function saveEntry() {
    if (saving) return; // guard against double-submit
    // Name the missing field instead of a generic "incomplete" — the mandate
    // explicitly forbids hiding the real problem behind "please review steps".
    const missing: string[] = [];
    if (!country) missing.push(getLabel("country", lang));
    if (ownershipLevel !== "country" && !branch) missing.push(getLabel("selectBranch", lang));
    if (!accountTitle) missing.push(getLabel("accountTitle", lang));
    const typeHasSubtypes = accountTitle && accountTitle !== "Personal" && (subTypes[accountTitle]?.length ?? 0) > 0;
    if ((typeHasSubtypes || accountTitle === "Personal") && !subType) missing.push(getLabel("subType", lang));
    if (!category) missing.push(getLabel("category", lang));
    if (!accountName.trim()) missing.push(getLabel("accountName", lang));
    if (missing.length > 0) {
      setMessage(`${getLabel("missingFieldsPrefix", lang)}: ${missing.join(", ")}`);
      return;
    }
    if (!branchInfo) {
      setMessage(getLabel("branchDataNotResolved", lang));
      return;
    }
    // Validate contacts (Mobile / WhatsApp / Email) before saving.
    const badContact = contacts
      .map((c) => ({ c, err: contactErrorKey(c.type, c.value) }))
      .find((x) => x.err);
    if (badContact) {
      setMessage(`${getLabel(badContact.err!, lang)} (${badContact.c.type})`);
      return;
    }
    const issuedJournal = `SUPER-${nextNumber(journalCounter)}`;
    const scope = ownershipLevel === "country" ? "country" : ownershipLevel === "main_branch" ? "main_branch" : "city_branch";
    const countryBranchId =
      ownershipLevel === "country"
        ? null
        : ownershipLevel === "main_branch"
        ? branch
        : cityBranches.find((item) => item.id === branch)?.country_branch_id ?? mainBranches[0]?.id ?? null;
    const cityBranchId = ownershipLevel === "city_branch" ? branch : null;
    setSaving(true); setMessage(""); setLastCreated(null);
    try {
      if (initialAccountId) {
        // Edit mode!
        await apiPatch<any>(`/api/erp/accounting/accounts/${initialAccountId}`, {
          scope,
          operationalDomain,
          countryId: country,
          countryBranchId,
          cityBranchId,
          parentId: null,
          customerId: linkedCustomerId,
          companyId: linkedCompanyId,
          bankId: linkedBankId,
          shippingLineId: linkedShippingLineId || null,
          linkedCountries: linkedCountries,
          code: accountCode || undefined,  // omit code if empty so PATCH doesn't fail min(2) validation
          manualReferenceNumber: manualReferenceNumber.trim() || null,
          name: accountName.trim(),
          kind: accountTitle === "Expenses Account" || category === "EX" ? "expense" : category === "P/S" ? "income" : "asset",
          currency: branchInfo.currency || selectedCountry?.currency_code || "USD",
          isControlAccount: accountTitle === "Bank",
          category,
          categoryId: selectedCategoryId || null,
          contacts
        });
        if (typeof window !== "undefined" && linkedWarehouseId) {
          try {
            const whData = JSON.stringify({ id: linkedWarehouseId, detail: warehouseDetail });
            if (initialAccountId) localStorage.setItem(`account_warehouse_${initialAccountId}`, whData);
            if (accountCode) localStorage.setItem(`account_warehouse_${accountCode}`, whData);
          } catch (e) {}
        }
        setMessage(getLabel("updatedAccountSuccess", lang));
        void fetchReport();
        setTimeout(() => {
          router.push(`/dashboard/accounts?accountId=${initialAccountId}`);
        }, 1500);
      } else {
        // Create mode!
        const response = await apiPost<AccountCreateResponse>("/api/erp/accounting/accounts", {
          scope,
          operationalDomain,
          countryId: country,
          countryBranchId,
          cityBranchId,
          parentId: null,
          customerId: linkedCustomerId,
          companyId: linkedCompanyId,
          bankId: linkedBankId,
          shippingLineId: linkedShippingLineId || null,
          linkedCountries: linkedCountries,
          code: "AUTO",
          manualReferenceNumber: manualReferenceNumber.trim() || null,
          name: accountName.trim(),
          kind: accountTitle === "Expenses Account" || category === "EX" ? "expense" : category === "P/S" ? "income" : "asset",
          currency: branchInfo.currency || selectedCountry?.currency_code || "USD",
          openingBalance: 0,
          status: "active",
          isControlAccount: accountTitle === "Bank",
          category,
          categoryId: selectedCategoryId || null,
          contacts
        });
        setLastCreated(response);
        setJournalCounter((current) => current + 1);
        setSavedEntries((current) => [
          {
            id: response.accountId,
            journalCode: issuedJournal,
            accountCode: response.accountNumber,
            manualReferenceNumber: response.manualReferenceNumber ?? null,
            customerNumber: response.customerNumber,
            accountName,
            branchName:
              ownershipLevel === "country"
                ? `${selectedCountry?.name || "Country"} (${getLabel("countryLevel", lang)})`
                : ownershipLevel === "main_branch" || branchType === "Main"
                ? selectedBranchName(mainBranches, branch)
                : selectedCityBranchName(cityBranches, branch),
            branchCode: response.branchCode,
            savedAt: new Date().toLocaleTimeString()
          },
          ...current
        ]);
        setAccountCode(response.accountNumber);
        if (typeof window !== "undefined" && linkedWarehouseId) {
          try {
            const whData = JSON.stringify({ id: linkedWarehouseId, detail: warehouseDetail });
            localStorage.setItem(`account_warehouse_${response.accountId}`, whData);
            localStorage.setItem(`account_warehouse_${response.accountNumber}`, whData);
          } catch (e) {}
        }
        setMessage(`${getLabel("savedAccountPrefix", lang)} ${response.accountNumber}`);
        void fetchReport();
        setTimeout(() => {
          router.push(`/dashboard/accounts?accountId=${response.accountId}&created=1`);
        }, 1500);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account save failed.");
    } finally {
      setSaving(false);
    }
  }

  function openReport(autoPrint: boolean) {
    openAccountA4ReportWindow({
      title: t(lang, "acct.report_title", "Account Profile Report"),
      subtitle: t(lang, "acct.report_subtitle", "Account Profile Summary"),
      autoPrint,
      lang,
      accountData: {
        accountName,
        accountCode: accountPreview,
        accountTitle,
        subType,
        category,
        manualReferenceNumber,
        currency: branchInfo?.currency || selectedCountry?.currency_code || "AED",
        status: saved ? "Active" : "In Progress",
        customerDetail,
        companyDetail,
        bankDetail,
        shippingLineName: shippingLineDetail?.name || linkedShippingLineName || undefined,
        linkedCountriesNames: linkedCountries.map((id) => countries.find((c) => c.id === id)?.name || id),
        selectedCountryName: selectedCountry?.name,
        selectedCountryCode: (selectedCountry?.iso2 || selectedCountry?.iso3 || undefined),
        selectedBranchName: branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch),
        selectedBranchCode: branchInfo?.code,
        createdBy: ""
      }
    });
  }

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{initialAccountId ? getLabel("editAccountSetup", lang) : getLabel("newAccountReport", lang)}</h1>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              {getLabel("draft", lang)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getLabel("headerSubtitle", lang)}
          </p>
        </div>
        
        {actionsPortal && createPortal(
          <>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounts/setup-report")} className="h-7 gap-1.5 rounded-lg border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <ClipboardList className="h-3.5 w-3.5 text-slate-500" /> {getLabel("liveReport", lang)}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounts")} className="h-7 gap-1.5 rounded-lg border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <BookOpen className="h-3.5 w-3.5 text-slate-500" /> {getLabel("accountSummary", lang)}
            </Button>
          </>,
          actionsPortal
        )}
      </div>

      {/* ── Mandatory Logged-in Scope banner (server-resolved, not frontend-selected) ── */}
      {!initialAccountId && <LoginScopeBanner scope={erpScope} />}

      {/* Voice — speak the account details; each proposed value is shown for review
          and correction before it fills the form. Nothing is submitted. */}
      {!initialAccountId && (
        <VoiceFormFill
          context="accounts"
          lang={lang}
          compact
          fieldLabels={{
            accountName: getLabel("accountName", lang),
            category: getLabel("category", lang),
            accountCode: getLabel("manualReference", lang),
          }}
          onApply={(f) => {
            // Never overwrite a value the user already typed.
            if (f.accountName && !accountName) setAccountName(String(f.accountName));
            if (f.category && !category) {
              const c = String(f.category).toLowerCase();
              if (c.includes("expense") || c.includes("cost")) setCategory("EX");
              else if (c.includes("income") || c.includes("revenue") || c.includes("sales")) setCategory("P/S");
              // Asset / Liability / Capital have no single category code here — left for
              // the user to choose on the form so nothing is guessed.
            }
          }}
        />
      )}

      {/* ── Steps Indicator Bar ────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500 md:grid-cols-${activeSteps.length}`}>
        {[
          { id: 1, label: getLabel("step1Label", lang) },
          { id: 2, label: getLabel("step2Label", lang) },
          { id: 3, label: getLabel("step3Label", lang) },
          { id: 4, label: getLabel("step4Label", lang) },
          { id: 5, label: getLabel("step5Label", lang) },
          { id: 6, label: getLabel("step6Label", lang) }
        ].filter((s) => activeSteps.includes(s.id)).map((s, idx) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                if (s.id === 1 || (s.id > 1 && country && branchType && branch)) {
                  setCurrentStep(s.id as any);
                }
              }}
              className={`flex items-center gap-2 border rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                active
                  ? "bg-primary text-white"
                  : completed
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}>
                {idx + 1}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{getLabel("step", lang)} {idx + 1}</span>
                <span className="truncate">{s.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* â”€â”€ Left Column Form + Right Column Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5 items-start" dir="ltr">
        {/* Left Side: Step View */}
        <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
          {loadingAccount ? (
            <div className="rounded-xl border border-slate-100 bg-white p-10 shadow-sm flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-slate-500">{getLabel("loadingAccountDetails", lang)}</p>
            </div>
          ) : (
            <>
          {/* Step 1: Account Info */}
          {currentStep === 1 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">1</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step1Label", lang)}</h2>
              </div>

              {/* ── Question 1A: Account Type ──────────────────────────────── */}
              <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accountTitle" className="text-xs font-bold text-slate-800">
                    {getLabel("questionAccountType", lang)} *
                  </Label>
                  <span className="text-[10px] text-slate-500 font-medium">{getLabel("selectAccountTitle", lang)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: "Customer", label: getLabel("customerAccount", lang) },
                      { id: "Company", label: getLabel("company", lang) },
                      { id: "Bank", label: getLabel("bankAccount", lang) },
                      { id: "Employee", label: getLabel("employee", lang) },
                      { id: "Personal", label: getLabel("personal", lang) },
                      { id: "Expenses Account", label: getLabel("expensesAccount", lang) }
                    ] as const
                  ).map((item) => {
                    const selected = accountTitle === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setAccountTitle(item.id);
                          setSubType("");
                          if (item.id === "Expenses Account" && !category) {
                            setCategory("EX");
                          }
                        }}
                        className={`flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Question 1B & 1C: Owning Operational Section & Ownership Level ── */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {/* Question 1B: Owning Operational Section */}
                <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/60">
                  <Label className="text-xs font-bold text-slate-800">
                    {getLabel("questionOperationalDomain", lang)} *
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOperationalDomain("business");
                        setBranch("");
                        void loadCategories("business");
                      }}
                      className={`flex items-center justify-start gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left ${
                        operationalDomain === "business"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      <span>{getLabel("businessDomain", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOperationalDomain("shipping");
                        setBranch("");
                        void loadCategories("shipping");
                      }}
                      className={`flex items-center justify-start gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left ${
                        operationalDomain === "shipping"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      <span>{getLabel("shippingDomain", lang)}</span>
                    </button>
                  </div>
                </div>

                {/* Question 1C: Ownership Level */}
                <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/60">
                  <Label className="text-xs font-bold text-slate-800">
                    {getLabel("questionOwnershipLevel", lang)} *
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOwnershipLevel("country");
                        setBranchType("Main");
                        setBranch("");
                      }}
                      className={`flex flex-col items-start justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left ${
                        ownershipLevel === "country"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                        <span className="font-bold">{getLabel("countryLevel", lang)}</span>
                      </div>
                      <span className={`text-[10px] font-normal leading-tight ${ownershipLevel === "country" ? "text-primary-foreground/90" : "text-slate-500"}`}>
                        {operationalDomain === "shipping"
                          ? getLabel("interCountryShippingDesc", lang)
                          : getLabel("interCountryTradeDesc", lang)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnershipLevel("main_branch");
                        setBranchType("Main");
                        setBranch("");
                      }}
                      className={`flex items-center justify-start gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left ${
                        ownershipLevel === "main_branch"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      <span>{getLabel("mainBranchLevel", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnershipLevel("city_branch");
                        setBranchType("City");
                        setBranch("");
                      }}
                      className={`flex items-center justify-start gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-left ${
                        ownershipLevel === "city_branch"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      <span>{getLabel("cityBranchLevel", lang)}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Country & Branch Pickers ───────────────────────────────── */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">{getLabel("country", lang)} *</Label>
                  <select
                    id="country"
                    value={country}
                    onChange={(event) => handleCountryChange(event.target.value)}
                    disabled={countryLocked}
                    className={selectClass()}
                  >
                    <option value="">{getLabel("selectCountry", lang)}</option>
                    {countries
                      .filter((item) => erpScope.isSuperAdmin || erpScope.countryIds.length === 0 || erpScope.countryIds.includes(item.id))
                      .map((item) => (
                        <option key={item.id} value={item.id}>{localizeTerm(item.name, lang)} ({item.iso2 ?? "-"})</option>
                      ))}
                  </select>
                  {countryLocked && (
                    <p className="text-[10px] font-semibold text-slate-500">{getLabel("scopeLockedCountry", lang)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  {ownershipLevel === "country" ? (
                    <div className="h-full flex flex-col justify-end">
                      <div className="rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-xs space-y-1.5 shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shrink-0">
                            {operationalDomain === "shipping" ? "⚓" : "🌐"}
                          </span>
                          <span className="font-bold text-blue-900 dark:text-blue-200">
                            {operationalDomain === "shipping"
                              ? `${selectedCountry?.name || getLabel("country", lang)} — ${getLabel("interCountryShippingDesc", lang)}`
                              : `${selectedCountry?.name || getLabel("country", lang)} — ${getLabel("interCountryTradeDesc", lang)}`}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                          {operationalDomain === "shipping"
                            ? getLabel("countryLevelShippingHint", lang)
                            : getLabel("countryLevelBusinessHint", lang)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor="branch">
                        {ownershipLevel === "main_branch"
                          ? `${getLabel("mainBranch", lang)} *`
                          : `${getLabel("cityBranch", lang)} *`}
                      </Label>
                      <select
                        id="branch"
                        value={branch}
                        onChange={(event) => { setBranch(event.target.value); setMessage(""); }}
                        disabled={!country || branchLocked}
                        className={selectClass()}
                      >
                        <option value="">{getLabel("selectBranch", lang)}</option>
                        {branchOptions.map((item) => {
                          const mainName = (item as CountryBranchRow).name;
                          const cityName = (item as CityBranchRow).city_name;
                          const branchName = (item as CityBranchRow).name;
                          const code = item.code;
                          return (
                            <option key={item.id} value={item.id}>
                              {ownershipLevel === "main_branch" || branchType === "Main"
                                ? `${localizeTerm(mainName, lang)} (${code})`
                                : `${localizeTerm(cityName, lang)} - ${localizeTerm(branchName, lang)} (${code})`}
                            </option>
                          );
                        })}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* ── Shipping Line Carrier Master Linkage (شپنگ لائن ماسٹر لنک) ── */}
              {(operationalDomain === "shipping" || subType === "Shipping Line Company" || accountTitle === "Company") && (
                <div className="space-y-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 p-4 border border-blue-200/70 dark:border-blue-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {getLabel("shippingLineCarrier", lang)}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t(lang, "acct.shipping_carrier_desc", "Connect this account directly to a registered Shipping Line carrier master record.")}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/new-entry/shipping-line")}
                      className="h-6 text-[10px] px-2 text-blue-700 hover:bg-blue-50 border-blue-300 dark:border-blue-700 dark:text-blue-300"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {getLabel("newShippingLine", lang)}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="shippingLinePicker" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {getLabel("selectShippingLine", lang)}
                      </Label>
                      <select
                        id="shippingLinePicker"
                        value={linkedShippingLineId || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLinkedShippingLineId(val || null);
                          if (val) {
                            const matched = shippingLinesList.find((s) => s.id === val);
                            if (matched) {
                              setLinkedShippingLineName(matched.name);
                              if (!accountName || accountName.toLowerCase().includes("shipping")) {
                                setAccountName(`${matched.name} (Shipping Line)`);
                              }
                              if (Array.isArray(matched.linked_countries) && matched.linked_countries.length > 0) {
                                setLinkedCountries(matched.linked_countries);
                              }
                            }
                          }
                        }}
                        className={selectClass()}
                      >
                        <option value="">-- {getLabel("selectShippingLine", lang)} --</option>
                        {shippingLinesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.shipping_line_code ? `(${s.shipping_line_code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {shippingLineDetail && (
                      <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 border border-blue-100 dark:border-blue-900 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{shippingLineDetail.name}</span>
                          {shippingLineDetail.shipping_line_code && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-semibold">
                              {shippingLineDetail.shipping_line_code}
                            </span>
                          )}
                        </div>
                        {shippingLineDetail.contact_person && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="text-slate-400">Contact:</span> {shippingLineDetail.contact_person}
                          </p>
                        )}
                        {(shippingLineDetail.phone || shippingLineDetail.email) && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {shippingLineDetail.phone} {shippingLineDetail.email ? `• ${shippingLineDetail.email}` : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Inter-Country Trading & Transactions Linkage (بین الملکی لین دین) ── */}
              <div className="space-y-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 p-4 border border-slate-200/70 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {getLabel("linkedCountriesTitle", lang)}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {getLabel("linkedCountriesSubtitle", lang)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                      {linkedCountries.length} / {countries.length} {t(lang, "acct.countries_linked", "Linked")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkedCountries(countries.map((c) => c.id))}
                      className="h-6 text-[10px] px-2 text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      {getLabel("selectAll", lang)}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkedCountries([])}
                      className="h-6 text-[10px] px-2 text-slate-600 hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:text-slate-300"
                    >
                      {getLabel("clearAll", lang)}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {countries.map((c) => {
                    const isSelected = linkedCountries.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLinkedCountries((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-100 shadow-xs ring-1 ring-emerald-400/30"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="block text-xs font-bold truncate">
                              {localizeTerm(c.name, lang)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {c.iso2 || "-"} {c.currency_code ? `• ${c.currency_code}` : ""}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Sub-Type & Category (Database-backed & Editable) ───────── */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="subType">{getLabel("subType", lang)} *</Label>
                  {accountTitle === "Personal" ? (
                    <Input
                      id="subType"
                      value={subType}
                      onChange={(event) => setSubType(event.target.value)}
                      placeholder={getLabel("whoDoesThisBelongTo", lang)}
                    />
                  ) : (
                    <select id="subType" value={subType} onChange={(event) => setSubType(event.target.value)} disabled={!accountTitle} className={selectClass()}>
                      <option value="">{getLabel("selectSubType", lang)}</option>
                      {accountTitle ? subTypes[accountTitle].map((item) => (<option key={item} value={item}>{localizedOption(item, lang)}</option>)) : null}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="category">{getLabel("category", lang)} *</Label>
                    <div className="flex items-center gap-2">
                      {category && dbCategories.some((c) => c.name === category || c.id === selectedCategoryId) && (
                        <button
                          type="button"
                          onClick={handleOpenEditCategory}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {getLabel("editCategory", lang)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenAddCategory}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        {getLabel("addCategory", lang)}
                      </button>
                    </div>
                  </div>
                  <select
                    id="category"
                    value={category}
                    onChange={(event) => {
                      const val = event.target.value;
                      if (val === "__ADD_NEW_CATEGORY__") {
                        handleOpenAddCategory();
                      } else {
                        setCategory(val);
                        const matched = dbCategories.find((c) => c.name === val || c.id === val);
                        if (matched) {
                          setSelectedCategoryId(matched.id);
                        } else {
                          setSelectedCategoryId("");
                        }
                      }
                    }}
                    className={selectClass()}
                  >
                    <option value="">{getLabel("selectCategory", lang)}</option>
                    {dbCategories.length > 0
                      ? dbCategories.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name} ({item.code})
                          </option>
                        ))
                      : categories.map((item) => (
                          <option key={item} value={item}>
                            {localizedOption(item, lang)}
                          </option>
                        ))}
                    <option value="__ADD_NEW_CATEGORY__">
                      + {t(lang, "acct.add_new_category_ellipsis", "Add New Category...")}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="accountCode">{getLabel("accountCodeAuto", lang)}</Label>
                    {branchInfo?.code ? (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        {branchInfo.code}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    id="accountCode"
                    value={accountCode || (branchInfo || selectedCountry ? generatedPreviewCode : getLabel("generatedOnSave", lang))}
                    readOnly
                    className="bg-blue-50/50 dark:bg-blue-950/30 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualReferenceNumber">{getLabel("manualReference", lang)}</Label>
                  <Input
                    id="manualReferenceNumber"
                    value={manualReferenceNumber}
                    onChange={(event) => setManualReferenceNumber(event.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase())}
                    placeholder={getLabel("manualReferencePlaceholder", lang)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">{getLabel("accountName", lang)} *</Label>
                <Input id="accountName" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder={getLabel("accountNamePlaceholder", lang)} />
              </div>

              {/* Contacts List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4.5 w-4.5 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">{getLabel("contacts", lang)}</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setContacts([...contacts, { type: "Mobile", value: "" }])}
                    className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 px-2.5 rounded-md font-semibold"
                  >
                    {getLabel("addContact", lang)}
                  </Button>
                </div>
                <div className="space-y-3">
                  {contacts.map((contact, idx) => {
                    const isCustom = !["Mobile", "WhatsApp", "Email", "Landline", "Office"].includes(contact.type);
                    return (
                      <div key={idx} className="flex gap-2 items-end">
                        <div className="w-1/3 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">{getLabel("type", lang)}</Label>
                          <select
                            value={isCustom ? "Custom" : contact.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...contacts];
                              updated[idx].type = val === "Custom" ? "Custom: " : val;
                              setContacts(updated);
                            }}
                            className={selectClass() + " h-9 text-xs px-2"}
                          >
                            <option value="Mobile">{getLabel("mobile", lang)}</option>
                            <option value="WhatsApp">{getLabel("whatsApp", lang)}</option>
                            <option value="Email">{getLabel("email", lang)}</option>
                            <option value="Landline">{getLabel("landline", lang)}</option>
                            <option value="Office">{getLabel("office", lang)}</option>
                            <option value="Custom">{getLabel("customType", lang)}</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">{getLabel("contactValue", lang)}</Label>
                          <Input
                            value={contact.value}
                            onChange={(e) => {
                              const updated = [...contacts];
                              updated[idx].value = e.target.value;
                              setContacts(updated);
                            }}
                            placeholder={
                              contact.type === "Email"
                                ? "email@example.com"
                                : contact.type === "WhatsApp"
                                ? "+00 000 0000000"
                                : getLabel("contactNumber", lang)
                            }
                            className={`h-9 text-xs font-mono ${contactErrorKey(contact.type, contact.value) ? "border-rose-400 focus-visible:ring-rose-400" : ""}`}
                          />
                          {contactErrorKey(contact.type, contact.value) && (
                            <p className="text-[10px] font-semibold text-rose-500">{getLabel(contactErrorKey(contact.type, contact.value)!, lang)}</p>
                          )}
                        </div>
                        {contacts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = contacts.filter((_, i) => i !== idx);
                              setContacts(updated);
                            }}
                            className="h-9 w-9 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  onClick={() => {
                    // Step 1 requires real selections — no silent auto-fill of
                    // Company / Trading Company / Sundry Debtors defaults.
                    const step1Missing: string[] = [];
                    if (!country) step1Missing.push(getLabel("country", lang));
                    if (!branchType) step1Missing.push(getLabel("branchType", lang));
                    if (!branch) step1Missing.push(getLabel("selectBranch", lang));
                    if (!accountTitle) step1Missing.push(getLabel("accountTitle", lang));
                    const needsSub = accountTitle && (accountTitle === "Personal" || (subTypes[accountTitle]?.length ?? 0) > 0);
                    if (needsSub && !subType) step1Missing.push(getLabel("subType", lang));
                    if (!category) step1Missing.push(getLabel("category", lang));
                    // Name is only required here for types that don't link a master
                    // record later (Personal / Expenses); the others inherit it from
                    // the linked customer/company/bank on the next step.
                    const linksMaster = ["Customer", "Company", "Bank", "Employee"].includes(accountTitle as string);
                    if (!linksMaster && !accountName.trim()) step1Missing.push(getLabel("accountName", lang));
                    if (step1Missing.length > 0) {
                      setMessage(`${getLabel("missingFieldsPrefix", lang)}: ${step1Missing.join(", ")}`);
                      return;
                    }
                    setMessage("");
                    setCurrentStep(nextStep);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm rounded-xl flex items-center gap-2 border border-blue-700/20 cursor-pointer disabled:opacity-50"
                >
                  <span>{getLabel("saveNext", lang) || "Save & Next"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Customer Details — Master Form Picker */}
          {currentStep === 2 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">2</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 2: {getLabel("step2Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("customerPickerHelp", lang)}
              </p>

              {/* Master Form Picker — single source of truth */}
              <CustomerPicker
                label={getLabel("customerMaster", lang)}
                value={linkedCustomerId ?? ""}
                countryId={canonicalCountryId || null}
                onValueChange={(id) => {
                  setLinkedCustomerId(id || null);
                  if (!id) { setLinkedCustomerName(""); return; }
                  // Populate account name from customer selection if not already set
                  fetch(`/api/erp/customers/${id}?lang=${lang}`)
                    .then((r) => r.json())
                    .then((json) => {
                      const name = json?.customer?.customer_name ?? json?.data?.customer_name ?? "";
                      setLinkedCustomerName(name);
                      if (!accountName && name) setAccountName(name);
                    })
                    .catch(() => null);
                }}
                placeholder={getLabel("searchExistingCustomers", lang)}
              />

              {linkedCustomerId && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs">
                  <span className="text-emerald-700 font-semibold">{getLabel("linked", lang)}:</span>
                  <span className="text-emerald-800">{linkedCustomerName || linkedCustomerId}</span>
                  <button
                    type="button"
                    className="ml-auto text-rose-600 hover:underline"
                    onClick={() => { setLinkedCustomerId(null); setLinkedCustomerName(""); }}
                  >
                    {getLabel("disconnect", lang)}
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prevStep)}
                  className="font-bold text-xs h-10 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {getLabel("back", lang)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep(nextStep)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm rounded-xl flex items-center gap-2 border border-blue-700/20 cursor-pointer"
                >
                  <span>{linkedCustomerId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Company Details — Master Form Picker */}
          {currentStep === 3 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">3</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 3: {getLabel("step3Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("companyPickerHelp", lang)}
              </p>

              {/* Master Form Picker — single source of truth */}
              <CompanyPicker
                label={getLabel("companyMaster", lang)}
                value={linkedCompanyId ?? ""}
                onValueChange={(id) => {
                  setLinkedCompanyId(id || null);
                  if (!id) { setLinkedCompanyName(""); return; }
                  fetch(`/api/erp/companies/${id}?lang=${lang}`)
                    .then((r) => r.json())
                    .then((json) => {
                      const name = json?.company?.name ?? json?.company?.legal_name ?? "";
                      setLinkedCompanyName(name);
                      if (!accountName && name) setAccountName(name);
                    })
                    .catch(() => null);
                }}
                placeholder={getLabel("searchExistingCompanies", lang)}
                createButtonPlacement="both"
              />

              {linkedCompanyId && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs">
                  <span className="text-emerald-700 font-semibold">{getLabel("linked", lang)}:</span>
                  <span className="text-emerald-800">{linkedCompanyName || linkedCompanyId}</span>
                  <button
                    type="button"
                    className="ml-auto text-rose-600 hover:underline"
                    onClick={() => { setLinkedCompanyId(null); setLinkedCompanyName(""); }}
                  >
                    {getLabel("disconnect", lang)}
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prevStep)}
                  className="font-bold text-xs h-10 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {getLabel("back", lang)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep(nextStep)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm rounded-xl flex items-center gap-2 border border-blue-700/20 cursor-pointer"
                >
                  <span>{linkedCompanyId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Bank Details — Master Form Picker */}
          {currentStep === 4 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">4</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 4: {getLabel("step4Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("bankPickerHelp", lang)}
              </p>

              {/* Master Form Picker — single source of truth */}
              <BankPicker
                label={getLabel("bankMaster", lang)}
                value={linkedBankId ?? ""}
                onValueChange={(id) => {
                  setLinkedBankId(id || null);
                  if (!id) { setLinkedBankName(""); return; }
                  fetch(`/api/erp/banks/${id}?lang=${lang}`)
                    .then((r) => r.json())
                    .then((json) => {
                      const name = json?.data?.bank?.bank_name ?? json?.bank?.bank_name ?? json?.bank_name ?? "";
                      setLinkedBankName(name);
                      if (!accountName && name) setAccountName(name);
                    })
                    .catch(() => null);
                }}
                placeholder={getLabel("searchExistingBanks", lang)}
              />

              {linkedBankId && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs">
                  <span className="text-emerald-700 font-semibold">{getLabel("linked", lang)}:</span>
                  <span className="text-emerald-800">{linkedBankName || linkedBankId}</span>
                  <button
                    type="button"
                    className="ml-auto text-rose-600 hover:underline"
                    onClick={() => { setLinkedBankId(null); setLinkedBankName(""); }}
                  >
                    {getLabel("disconnect", lang)}
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prevStep)}
                  className="font-bold text-xs h-10 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {getLabel("back", lang)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep(nextStep)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm rounded-xl flex items-center gap-2 border border-blue-700/20 cursor-pointer"
                >
                  <span>{linkedBankId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Warehouse Details */}
          {currentStep === 5 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">5</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 5: {getLabel("step5Label", lang)}</h2>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {getLabel("warehousePickerHelp", lang)}
                </p>

                <div className="max-w-md">
                  <WarehousePicker
                    label={getLabel("warehouseMaster", lang)}
                    value={linkedWarehouseId ?? ""}
                    onValueChange={(val) => setLinkedWarehouseId(val || null)}
                    onSelectRecord={(rec) => setWarehouseDetail(rec)}
                    placeholder={getLabel("searchExistingWarehouses", lang)}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prevStep)}
                  className="font-bold text-xs h-10 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {getLabel("back", lang)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep(nextStep)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 shadow-sm rounded-xl flex items-center gap-2 border border-blue-700/20 cursor-pointer"
                >
                  <span>{linkedWarehouseId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Review & Save */}
          {currentStep === 6 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">6</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 6: {getLabel("step6Label", lang)}</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 text-xs">
                <div className="rounded-lg border bg-slate-50/40 p-4 space-y-2">
                  <h3 className="font-bold text-slate-700 border-b pb-1">{getLabel("branchDetails", lang)}</h3>
                  <div><b>{getLabel("company", lang)}:</b> {branchInfo?.company || "-"}</div>
                  <div><b>{getLabel("branchName", lang)}:</b> {branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch)}</div>
                  <div><b>{getLabel("branchCode", lang)}:</b> {branchInfo?.code || "-"}</div>
                  <div><b>{getLabel("country", lang)}:</b> {selectedCountry?.name || "-"}</div>
                  <div><b>{getLabel("branchType", lang)}:</b> {branchType || "-"}</div>
                  <div><b>{getLabel("currency", lang)}:</b> {branchInfo?.currency || "-"}</div>
                </div>

                <div className="rounded-lg border bg-slate-50/40 p-4 space-y-2">
                  <h3 className="font-bold text-slate-700 border-b pb-1">{getLabel("accountInfo", lang)}</h3>
                  <div><b>{getLabel("accountTitle", lang)}:</b> {accountTitle || "-"}</div>
                  <div><b>{getLabel("subType", lang)}:</b> {subType || "-"}</div>
                  <div><b>{getLabel("category", lang)}:</b> {category || "-"}</div>
                  <div><b>{getLabel("accountCodeAuto", lang)}:</b> {accountCode || "AUTO"}</div>
                  <div><b>{getLabel("accountName", lang)}:</b> {accountName || "-"}</div>
                  <div><b>{getLabel("manualReference", lang)}:</b> {manualReferenceNumber || "-"}</div>
                </div>
              </div>

              {/* Linked Masters & Inter-Country Summary */}
              {(linkedCustomerId || linkedCompanyId || linkedBankId || linkedShippingLineId || linkedCountries.length > 0) && (
                <div className="rounded-lg border bg-slate-50/40 p-4 text-xs space-y-2">
                  <h3 className="font-bold text-slate-700 border-b pb-1">{getLabel("linkedMasterRecords", lang)}</h3>
                  {linkedCustomerId && <div><b>{getLabel("linkedCustomer", lang)}:</b> {linkedCustomerName} <span className="text-slate-400 font-mono">({linkedCustomerId})</span></div>}
                  {linkedCompanyId && <div><b>{getLabel("linkedCompany", lang)}:</b> {linkedCompanyName} <span className="text-slate-400 font-mono">({linkedCompanyId})</span></div>}
                  {linkedBankId && <div><b>{getLabel("linkedBank", lang)}:</b> {linkedBankName} <span className="text-slate-400 font-mono">({linkedBankId})</span></div>}
                  {linkedShippingLineId && (
                    <div>
                      <b>{getLabel("shippingLineCarrier", lang)}:</b> {shippingLineDetail?.name || linkedShippingLineName}
                      {shippingLineDetail?.shipping_line_code && (
                        <span className="text-slate-400 font-mono ml-1">({shippingLineDetail.shipping_line_code})</span>
                      )}
                    </div>
                  )}
                  {linkedCountries.length > 0 && (
                    <div className="pt-1">
                      <b className="block mb-1">{getLabel("linkedCountriesTitle", lang)}:</b>
                      <div className="flex flex-wrap gap-1">
                        {linkedCountries.map((cId) => {
                          const matched = countries.find((c) => c.id === cId);
                          return (
                            <span key={cId} className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                              {localizeTerm(matched?.name || cId, lang)} ({matched?.iso2 || "-"})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {message && (
                <div className={saved
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800"
                  : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800"
                }>
                  {message}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(prevStep)}
                  className="font-bold text-xs h-9 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  {getLabel("back", lang)}
                </Button>
                {/* Save button has been moved to the bottom of the Live Report Panel */}
                <div className="text-xs text-slate-400 italic">{getLabel("reviewDetailsHint", lang)}</div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Right Side: High-fidelity Live Report Preview */}
        <div className="h-fit lg:sticky lg:top-24 space-y-4" dir={isRtl ? "rtl" : "ltr"}>
          <AccountLiveReportPanel
            accountName={accountName}
            lang={lang}
            accountCode={accountPreview}
            accountTitle={accountTitle}
            subType={subType}
            category={category}
            manualReferenceNumber={manualReferenceNumber}
            currency={branchInfo?.currency || selectedCountry?.currency_code || "AED"}
            status={saved ? "Active" : "In Progress"}
            contacts={contacts}
            customerDetail={customerDetail}
            companyDetail={companyDetail}
            bankDetail={bankDetail}
            warehouseDetail={warehouseDetail}
            shippingLineDetail={shippingLineDetail}
            linkedCountries={linkedCountries}
            countriesList={countries}
            selectedCountryName={selectedCountry?.name}
            selectedCountryCode={selectedCountry?.iso2 || selectedCountry?.iso3 || undefined}
            selectedBranchName={ownershipLevel === "country" ? `${selectedCountry?.name || "Country"} (${getLabel("countryLevel", lang)})` : branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch)}
            selectedBranchCode={branchInfo?.code}
            onBack={() => router.push("/dashboard/accounts")}
            onPrint={() => openReport(true)}
            onPdf={() => openReport(false)}
            onExcel={() => {
              const rows = [
                ["Field", "Value"],
                ["Account Name", accountName || "-"],
                ["Account Code", accountPreview || "-"],
                ["Account Type", subType || category || "Expense"],
                ["Currency", branchInfo?.currency || selectedCountry?.currency_code || "AED"],
                ["Status", saved ? "Active" : "In Progress"]
              ];
              const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `account_${accountPreview || "draft"}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            onEmail={() => {
              const subject = encodeURIComponent("Account Profile Report");
              const body = encodeURIComponent(`Account Profile Report\nAccount Name: ${accountName}\nAccount Code: ${accountPreview}`);
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
            }}
            onWhatsApp={() => {
              const text = encodeURIComponent(`Account Profile: ${accountName} (${accountPreview})`);
              window.open(`https://wa.me/?text=${text}`, "_blank");
            }}
          />
          {currentStep === 6 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow p-5 mt-4 flex items-center justify-between sticky bottom-4 z-10 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
                <span>{getLabel("country", lang)}: <b className="text-slate-800 dark:text-slate-200">{selectedCountry?.name || "-"}</b></span>
                <span>{getLabel("branchName", lang)}: <b className="text-slate-800 dark:text-slate-200">{ownershipLevel === "country" ? getLabel("countryLevel", lang) : branchInfo?.city || (branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch))}</b></span>
              </div>
              <Button type="button" size="default" onClick={saveEntry} disabled={!readyToSave || saving} className="bg-primary hover:bg-primary/90 text-white text-sm px-10 h-12 font-bold tracking-wider rounded-lg shadow-sm">
                {saving ? getLabel("saving", lang) : initialAccountId ? getLabel("updateAccount", lang) : getLabel("createSaveAccount", lang)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Persistent Category Modal (Add / Edit with 5-language translation sync) ── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {categoryModalMode === "add" ? getLabel("addCategory", lang) : getLabel("editCategory", lang)}
              </h3>
              <button
                type="button"
                onClick={() => { setShowCategoryModal(false); setCatError(""); }}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {catError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {catError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="catName">{getLabel("categoryName", lang)} *</Label>
                <Input
                  id="catName"
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="e.g. Office Rent / Clearance Charges"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="catCode">{getLabel("categoryCode", lang)} *</Label>
                <Input
                  id="catCode"
                  value={catFormCode}
                  onChange={(e) => setCatFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RENT / CLR"
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="catDesc">{getLabel("categoryDescription", lang)}</Label>
                <Input
                  id="catDesc"
                  value={catFormDesc}
                  onChange={(e) => setCatFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-500">{getLabel("questionOperationalDomain", lang)}</Label>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {operationalDomain === "shipping" ? getLabel("shippingDomain", lang) : getLabel("businessDomain", lang)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowCategoryModal(false); setCatError(""); }}
                disabled={catSaving}
              >
                {getLabel("cancel", lang) || "Cancel"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCategory}
                disabled={catSaving}
                className="gap-1.5"
              >
                {catSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {getLabel("saveCategory", lang)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Master Form modals are handled inline by CustomerPicker / CompanyPicker / BankPicker */}
    </div>
  );
}








