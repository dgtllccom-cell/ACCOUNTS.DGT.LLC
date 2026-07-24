"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
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
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiPost, apiPatch } from "@/lib/api/client";
import { CustomerPicker } from "@/features/customers/components/customer-picker";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { BankPicker } from "@/features/banks/components/bank-picker";
import { WarehousePicker } from "@/features/warehouses/components/warehouse-picker";
import { fetchWarehouses } from "@/features/warehouses/warehouse-api";
import { rtlLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";
import { AccountLiveReportPanel } from "./account-live-report-panel";
import { openAccountA4ReportWindow } from "@/lib/reports/open-account-a4-report-window";

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

type AccountTitle = "Customer" | "Company" | "Bank" | "Employee" | "Personal";

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
  Customer: ["Business Account", "Personal Account"],
  Company: ["Trading Company", "Supplier Company", "Service Provider", "Logistics Company"],
  Bank: ["Personal Bank", "Company Bank"],
  Employee: ["Employee Position: Manager", "Employee Position: Cashier", "Employee Position: Clerk"],
  Personal: []
};

const categories = ["P/S", "B/C", "B/P", "EX", "S"];

function nextNumber(current: number) {
  return String(current + 1).padStart(3, "0");
}

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
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
  const key = value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
  const label = getLabel(key, lang);
  return label === key ? value : label;
}
export function NewAccountSetup({ lang: propLang, initialAccountId }: { lang?: SupportedLanguage; initialAccountId?: string }) {
  const router = useRouter();

  const lang = useMemo(() => {
    if (propLang) return propLang;
    if (typeof document !== "undefined") {
      const docLang = document.documentElement.lang as SupportedLanguage;
      return ["en", "ar", "ur", "fa", "ps"].includes(docLang) ? docLang : "en";
    }
    return "en";
  }, [propLang]);

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
  const [branchType, setBranchType] = useState<BranchType | "">("");
  const [branch, setBranch] = useState("");
  const [accountTitle, setAccountTitle] = useState<AccountTitle | "">("");
  const [subType, setSubType] = useState("");
  const [category, setCategory] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [manualReferenceNumber, setManualReferenceNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [contacts, setContacts] = useState<Array<{ type: string; value: string }>>([{ type: "Mobile", value: "" }]);
  const [journalCounter, setJournalCounter] = useState(0);
  const [lastBranchCode, setLastBranchCode] = useState("");
  const [simulateCityAdmin, setSimulateCityAdmin] = useState(false);
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<AccountCreateResponse | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [actionsPortal, setActionsPortal] = useState<HTMLElement | null>(null);

  // Dynamic active steps list based on accountTitle, category and subType
  const activeSteps = useMemo(() => {
    const steps: number[] = [1];
    const isExpense = category === "EX";
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
            const bt = acc.scope === "main_branch" ? "Main" : acc.scope === "city_branch" ? "City" : "";
            setBranchType(bt);
            setBranch(acc.scope === "main_branch" ? acc.country_branch_id || "" : acc.scope === "city_branch" ? acc.city_branch_id || "" : "");
            
            // Determine accountTitle and linked master records
            if (acc.customer_id) {
              setAccountTitle("Customer");
              setLinkedCustomerId(acc.customer_id);
              fetch(`/api/erp/customers/${acc.customer_id}`)
                .then((r) => r.json())
                .then((json) => {
                  const name = json?.customer?.customer_name ?? json?.data?.customer_name ?? "";
                  if (!cancelled) setLinkedCustomerName(name);
                })
                .catch(() => null);
            } else if (acc.company_id) {
              setAccountTitle("Company");
              setLinkedCompanyId(acc.company_id);
              fetch(`/api/erp/companies/${acc.company_id}`)
                .then((r) => r.json())
                .then((json) => {
                  const name = json?.company?.name ?? json?.company?.legal_name ?? "";
                  if (!cancelled) setLinkedCompanyName(name);
                })
                .catch(() => null);
            } else if (acc.bank_id) {
              setAccountTitle("Bank");
              setLinkedBankId(acc.bank_id);
              fetch(`/api/erp/banks/${acc.bank_id}`)
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
            if (acc.is_control_account) {
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
        setMessage("Failed to load account details.");
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

  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [companyDetail, setCompanyDetail] = useState<any>(null);
  const [bankDetail, setBankDetail] = useState<any>(null);
  const [warehouseDetail, setWarehouseDetail] = useState<any>(null);

  // Fetch full customer details when linkedCustomerId changes
  useEffect(() => {
    if (!linkedCustomerId) { setCustomerDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/customers/${linkedCustomerId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && (json?.data || json?.customer)) setCustomerDetail(json.data ?? json.customer);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [linkedCustomerId]);

  // Fetch company details when linkedCompanyId changes
  useEffect(() => {
    if (!linkedCompanyId) { setCompanyDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/companies/${linkedCompanyId}`)
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
  }, [linkedCompanyId]);

  // Fetch bank details when linkedBankId changes
  useEffect(() => {
    if (!linkedBankId) { setBankDetail(null); return; }
    let cancelled = false;
    fetch(`/api/erp/banks/${linkedBankId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.ok && (json?.data?.bank || json?.bank)) setBankDetail(json.data?.bank ?? json.bank);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [linkedBankId]);

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

  // Load countries
  useEffect(() => {
    let cancelled = false;
    listCountries()
      .then((rows) => { if (!cancelled) setCountries(rows); })
      .catch(() => { if (!cancelled) setMessage("Could not load countries."); });
    return () => { cancelled = true; };
  }, []);

  // Load Main Branches
  useEffect(() => {
    if (!country) { setMainBranches([]); return; }
    let cancelled = false;
    fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(country)}`)
      .then((res) => res.json())
      .then((json: { countryBranches?: CountryBranchRow[] }) => {
        if (!cancelled) setMainBranches(Array.isArray(json.countryBranches) ? json.countryBranches : []);
      })
      .catch(() => { if (!cancelled) setMessage("Could not load main branches."); });
    return () => { cancelled = true; };
  }, [country]);

  // Load City Branches
  useEffect(() => {
    if (!country) { setCityBranches([]); return; }
    let cancelled = false;
    const mainBranchId = branchType === "City" ? mainBranches[0]?.id ?? "" : "";
    const params = new URLSearchParams({ countryId: country });
    if (mainBranchId) params.set("countryBranchId", mainBranchId);
    fetch(`/api/branch-management/city-branches?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { cityBranches?: CityBranchRow[] }) => {
        if (!cancelled) setCityBranches(Array.isArray(json.cityBranches) ? json.cityBranches : []);
      })
      .catch(() => { if (!cancelled) setMessage("Could not load city branches."); });
    return () => { cancelled = true; };
  }, [branchType, country, mainBranches]);

  const selectedCountry = useMemo(() => countries.find((item) => item.id === country) ?? null, [countries, country]);
  const branchOptions = branchType === "Main" ? mainBranches : branchType === "City" ? cityBranches : [];

  const branchInfo = useMemo<BranchInfo | null>(() => {
    if (!selectedCountry || !branchType || !branch) return null;
    if (branchType === "Main") {
      const row = mainBranches.find((item) => item.id === branch);
      if (!row) return null;
      return {
        company: `Damaan ${selectedCountry.name}`,
        code: row.code,
        city: selectedCountry.name,
        address: "-",
        phone: "-",
        email: "-",
        manager: "-",
        opening: "-",
        currency: row.local_currency || selectedCountry.currency_code || "USD"
      };
    }
    const row = cityBranches.find((item) => item.id === branch);
    if (!row) return null;
    return {
      company: `Damaan ${selectedCountry.name}`,
      code: row.code,
      city: row.city_name,
      address: "-",
      phone: "-",
      email: "-",
      manager: "-",
      opening: "-",
      currency: row.local_currency || selectedCountry.currency_code || "USD"
    };
  }, [branch, branchType, cityBranches, mainBranches, selectedCountry]);

  const branchCode = branchInfo?.code ?? "";
  const isEditMode = Boolean(initialAccountId);
  const accountPreview = lastCreated?.accountNumber || accountCode || (branchCode ? "AUTO" : "");
  const readyToSave = Boolean(country && branchType && branch && accountTitle && subType && category && accountName);
  const saved = message.startsWith("Saved");

  useEffect(() => {
    if (!branchCode || branchCode === lastBranchCode) return;
    setLastBranchCode(branchCode);
    // In edit mode, do NOT reset the loaded account code when branch info resolves
    if (!initialAccountId) {
      setAccountCode("");
    }
  }, [branchCode, lastBranchCode, initialAccountId]);

  function handleCountryChange(value: string) {
    setCountry(value); setBranchType(""); setBranch(""); setLastBranchCode(""); setAccountCode(""); setLastCreated(null); setMessage("");
  }

  function handleBranchTypeChange(value: BranchType) {
    setBranchType(value); setBranch(""); setLastBranchCode(""); setAccountCode(""); setLastCreated(null); setMessage("");
  }

  // Create and save account on Step 6
  async function saveEntry() {
    if (!readyToSave || !branchInfo || !accountTitle || !branchType) {
      setMessage("Account details are incomplete. Please review steps.");
      return;
    }
    const issuedJournal = `SUPER-${nextNumber(journalCounter)}`;
    const scope = branchType === "Main" ? "main_branch" : "city_branch";
    setSaving(true); setMessage(""); setLastCreated(null);
    try {
      if (initialAccountId) {
        // Edit mode!
        await apiPatch<any>(`/api/erp/accounting/accounts/${initialAccountId}`, {
          scope,
          countryId: country,
          countryBranchId:
            branchType === "Main"
              ? branch
              : cityBranches.find((item) => item.id === branch)?.country_branch_id ?? mainBranches[0]?.id ?? null,
          cityBranchId: branchType === "City" ? branch : null,
          parentId: null,
          customerId: linkedCustomerId,
          companyId: linkedCompanyId,
          bankId: linkedBankId,
          code: accountCode || undefined,  // omit code if empty so PATCH doesn't fail min(2) validation
          manualReferenceNumber: manualReferenceNumber.trim() || null,
          name: accountName.trim(),
          kind: category === "P/S" ? "income" : category === "EX" ? "expense" : "asset",
          currency: branchInfo.currency || selectedCountry?.currency_code || "USD",
          isControlAccount: accountTitle === "Bank",
          contacts
        });
        if (typeof window !== "undefined" && linkedWarehouseId) {
          try {
            const whData = JSON.stringify({ id: linkedWarehouseId, detail: warehouseDetail });
            if (initialAccountId) localStorage.setItem(`account_warehouse_${initialAccountId}`, whData);
            if (accountCode) localStorage.setItem(`account_warehouse_${accountCode}`, whData);
          } catch (e) {}
        }
        setMessage(`Updated account details successfully.`);
        void fetchReport();
        setTimeout(() => {
          router.push(`/dashboard/accounts?accountId=${initialAccountId}`);
        }, 1500);
      } else {
        // Create mode!
        const response = await apiPost<AccountCreateResponse>("/api/erp/accounting/accounts", {
          scope,
          countryId: country,
          countryBranchId:
            branchType === "Main"
              ? branch
              : cityBranches.find((item) => item.id === branch)?.country_branch_id ?? mainBranches[0]?.id ?? null,
          cityBranchId: branchType === "City" ? branch : null,
          parentId: null,
          customerId: linkedCustomerId,
          companyId: linkedCompanyId,
          bankId: linkedBankId,
          code: "AUTO",
          manualReferenceNumber: manualReferenceNumber.trim() || null,
          name: accountName.trim(),
          kind: category === "P/S" ? "income" : category === "EX" ? "expense" : "asset",
          currency: branchInfo.currency || selectedCountry?.currency_code || "USD",
          openingBalance: 0,
          status: "active",
          isControlAccount: accountTitle === "Bank",
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
            branchName: branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch),
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
        setMessage(`Saved account ${response.accountNumber}.`);
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
      title: "Account Profile Report",
      subtitle: "Account Profile Summary",
      autoPrint,
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
        selectedCountryName: selectedCountry?.name,
        selectedCountryCode: (selectedCountry?.iso2 || selectedCountry?.iso3 || undefined),
        selectedBranchName: branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch),
        selectedBranchCode: branchInfo?.code,
        createdBy: "Super Admin"
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
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounts/setup-report")} className="h-7 gap-1.5 rounded-lg px-2 text-[10px] font-bold">
              <ClipboardList className="h-3.5 w-3.5 text-slate-500" /> {getLabel("liveReport", lang)}
            </Button>
            <Button variant="default" size="sm" onClick={() => router.push("/dashboard/accounts")} className="h-7 gap-1.5 rounded-lg px-2 text-[10px] font-bold">
              <BookOpen className="h-3.5 w-3.5" /> {getLabel("accountSummary", lang)}
            </Button>
          </>,
          actionsPortal
        )}
      </div>

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Step View */}
        <div className="lg:col-span-4 space-y-6">
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

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">{getLabel("country", lang)} *</Label>
                  <select id="country" value={country} onChange={(event) => handleCountryChange(event.target.value)} className={selectClass()}>
                    <option value="">{getLabel("selectCountry", lang)}</option>
                    {countries.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.iso2 ?? "-"})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchType">{getLabel("branchType", lang)} *</Label>
                  <select id="branchType" value={branchType} onChange={(event) => handleBranchTypeChange(event.target.value as BranchType)} disabled={!country} className={selectClass()}>
                    <option value="">{getLabel("selectBranchType", lang)}</option>
                    <option value="Main">{getLabel("mainBranch", lang)}</option>
                    <option value="City">{getLabel("cityBranch", lang)}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="branch">{getLabel("selectBranch", lang)} *</Label>
                  <select id="branch" value={branch} onChange={(event) => { setBranch(event.target.value); setMessage(""); }} disabled={!country || !branchType} className={selectClass()}>
                    <option value="">{getLabel("selectBranch", lang)}</option>
                    {branchOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {branchType === "Main"
                          ? `${(item as CountryBranchRow).name} (${(item as CountryBranchRow).code})`
                          : `${(item as CityBranchRow).city_name} - ${(item as CityBranchRow).name} (${(item as CityBranchRow).code})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountTitle">{getLabel("accountTitle", lang)} *</Label>
                  <select id="accountTitle" value={accountTitle} onChange={(event) => { setAccountTitle(event.target.value as AccountTitle); setSubType(""); }} className={selectClass()}>
                    <option value="">{getLabel("selectAccountTitle", lang)}</option>
                    <option value="Customer">{getLabel("customerAccount", lang)}</option>
                    <option value="Bank">{getLabel("bankAccount", lang)}</option>
                    <option value="Personal">{getLabel("personal", lang)}</option>
                    <option value="Company">{getLabel("company", lang)}</option>
                    <option value="Employee">{getLabel("employee", lang)}</option>
                  </select>
                </div>
              </div>

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
                  <Label htmlFor="category">{getLabel("category", lang)} *</Label>
                  <select id="category" value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass()}>
                    <option value="">{getLabel("selectCategory", lang)}</option>
                    {categories.map((item) => (<option key={item} value={item}>{localizedOption(item, lang)}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accountCode">{getLabel("accountCodeAuto", lang)}</Label>
                  <Input id="accountCode" value={accountCode || getLabel("generatedOnSave", lang)} readOnly className="bg-slate-50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualReferenceNumber">{getLabel("manualReference", lang)}</Label>
                  <Input id="manualReferenceNumber" value={manualReferenceNumber} onChange={(event) => setManualReferenceNumber(event.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase())} placeholder={getLabel("manualReferencePlaceholder", lang)} />
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
                                ? "+92 300 1234567"
                                : getLabel("contactNumber", lang)
                            }
                            className="h-9 text-xs font-mono"
                          />
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

              <div className="flex justify-end pt-4">
                <Button type="button" onClick={() => { if (country && branchType && branch && accountTitle && subType && category && accountName) { setCurrentStep(nextStep); } else { setMessage(getLabel("completeRequiredFields", lang)); } }} className="bg-primary text-white">
                  {getLabel("saveNext", lang)}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Customer Details â€” Master Form Picker */}
          {currentStep === 2 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">2</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 2: {getLabel("step2Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("customerPickerHelp", lang)}
              </p>

              {/* Master Form Picker â€” single source of truth */}
              <CustomerPicker
                label={getLabel("customerMaster", lang)}
                value={linkedCustomerId ?? ""}
                onValueChange={(id) => {
                  setLinkedCustomerId(id || null);
                  if (!id) { setLinkedCustomerName(""); return; }
                  // Populate account name from customer selection if not already set
                  fetch(`/api/erp/customers/${id}`)
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(prevStep)}>{getLabel("back", lang)}</Button>
                <Button type="button" onClick={() => setCurrentStep(nextStep)} className="bg-primary text-white">
                  {linkedCustomerId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Company Details â€” Master Form Picker */}
          {currentStep === 3 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">3</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 3: {getLabel("step3Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("companyPickerHelp", lang)}
              </p>

              {/* Master Form Picker â€” single source of truth */}
              <CompanyPicker
                label={getLabel("companyMaster", lang)}
                value={linkedCompanyId ?? ""}
                onValueChange={(id) => {
                  setLinkedCompanyId(id || null);
                  if (!id) { setLinkedCompanyName(""); return; }
                  fetch(`/api/erp/companies/${id}`)
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(prevStep)}>{getLabel("back", lang)}</Button>
                <Button type="button" onClick={() => setCurrentStep(nextStep)} className="bg-primary text-white">
                  {linkedCompanyId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Bank Details â€” Master Form Picker */}
          {currentStep === 4 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">4</span>
                <h2 className="text-sm font-bold text-slate-900">{getLabel("step", lang)} 4: {getLabel("step4Label", lang)}</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                {getLabel("bankPickerHelp", lang)}
              </p>

              {/* Master Form Picker â€” single source of truth */}
              <BankPicker
                label={getLabel("bankMaster", lang)}
                value={linkedBankId ?? ""}
                onValueChange={(id) => {
                  setLinkedBankId(id || null);
                  if (!id) { setLinkedBankName(""); return; }
                  fetch(`/api/erp/banks/${id}`)
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(prevStep)}>{getLabel("back", lang)}</Button>
                <Button type="button" onClick={() => setCurrentStep(nextStep)} className="bg-primary text-white">
                  {linkedBankId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(prevStep)}>{getLabel("back", lang)}</Button>
                <Button type="button" onClick={() => setCurrentStep(nextStep)} className="bg-primary text-white">
                  {linkedWarehouseId ? getLabel("saveNext", lang) : getLabel("skipNext", lang)}
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

              {/* Linked Masters Summary */}
              {(linkedCustomerId || linkedCompanyId || linkedBankId) && (
                <div className="rounded-lg border bg-slate-50/40 p-4 text-xs space-y-2">
                  <h3 className="font-bold text-slate-700 border-b pb-1">{getLabel("linkedMasterRecords", lang)}</h3>
                  {linkedCustomerId && <div><b>{getLabel("linkedCustomer", lang)}:</b> {linkedCustomerName} <span className="text-slate-400 font-mono">({linkedCustomerId})</span></div>}
                  {linkedCompanyId && <div><b>{getLabel("linkedCompany", lang)}:</b> {linkedCompanyName} <span className="text-slate-400 font-mono">({linkedCompanyId})</span></div>}
                  {linkedBankId && <div><b>{getLabel("linkedBank", lang)}:</b> {linkedBankName} <span className="text-slate-400 font-mono">({linkedBankId})</span></div>}
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(prevStep)}>{getLabel("back", lang)}</Button>
                {/* Save button has been moved to the bottom of the Live Report Panel */}
                <div className="text-xs text-slate-400 italic">{getLabel("reviewDetailsHint", lang)}</div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Right Side: High-fidelity Live Report Preview */}
        <div className="lg:col-span-8 h-fit lg:sticky lg:top-24 space-y-4">
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
            selectedCountryName={selectedCountry?.name}
            selectedCountryCode={selectedCountry?.iso2 || selectedCountry?.iso3 || undefined}
            selectedBranchName={branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch)}
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
            <div className="bg-white rounded-xl border border-slate-200 shadow p-5 mt-4 flex items-center justify-between sticky bottom-4 z-10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="simCity" checked={simulateCityAdmin} onChange={e => setSimulateCityAdmin(e.target.checked)} className="rounded border-slate-300 accent-primary" />
                  <label htmlFor="simCity" className="text-xs font-bold text-slate-600 cursor-pointer">{getLabel("simulateCityAdmin", lang)}</label>
                </div>
                {simulateCityAdmin && <p className="text-[10px] text-amber-600 font-semibold max-w-xs">{getLabel("pendingApprovalHint", lang)}</p>}
              </div>
              <Button type="button" size="default" onClick={saveEntry} disabled={!readyToSave || saving} className="bg-primary hover:bg-primary/90 text-white text-sm px-10 h-12 font-bold tracking-wider rounded-lg shadow-sm">
                {saving ? getLabel("saving", lang) : simulateCityAdmin ? getLabel("submitForApproval", lang) : initialAccountId ? getLabel("updateAccount", lang) : getLabel("createSaveAccount", lang)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Master Form modals are handled inline by CustomerPicker / CompanyPicker / BankPicker */}
    </div>
  );
}








