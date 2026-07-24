"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Hash,
  Landmark,
  Mail,
  Phone,
  ReceiptText,
  Save,
  Search,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiPost } from "@/lib/api/client";

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
type AccountTitle = "Customer" | "Bank" | "Employee";

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

const branchData: Record<string, Record<BranchType, string[]>> = {
  Pakistan: {
    Main: ["Pakistan Main Branch", "Karachi Main Branch", "Lahore Main Branch"],
    City: ["Quetta City Branch", "Chaman City Branch", "Faisalabad City Branch"]
  },
  Bangladesh: {
    Main: ["Bangladesh Main Branch", "Dhaka Main Branch"],
    City: ["Chittagong City Branch", "Sylhet City Branch"]
  },
  UAE: {
    Main: ["UAE Main Branch", "Dubai Main Branch"],
    City: ["Sharjah City Branch", "Abu Dhabi City Branch"]
  },
  Afghanistan: {
    Main: ["Afghanistan Main Branch", "Kabul Main Branch"],
    City: ["Herat City Branch", "Mazar City Branch"]
  },
  Iran: {
    Main: ["Iran Main Branch", "Tehran Main Branch"],
    City: ["Mashhad City Branch"]
  }
};

const branchDetails: Record<string, BranchInfo> = {
  "Pakistan|Main|Pakistan Main Branch": {
    company: "Damaan Pakistan Pvt Ltd",
    code: "PK-MAIN-001",
    city: "Karachi",
    address: "I.I. Chundrigar Road, Karachi",
    phone: "+92 21 111 222 333",
    email: "pakistan.main@damaan.test",
    manager: "Ali Khan",
    opening: "2012-03-01",
    currency: "PKR"
  },
  "Pakistan|City|Quetta City Branch": {
    company: "Damaan Pakistan Pvt Ltd",
    code: "PK-CITY-101",
    city: "Quetta",
    address: "Zarghoon Road, Quetta",
    phone: "+92 81 123 4567",
    email: "quetta.city@damaan.test",
    manager: "Sana Baloch",
    opening: "2016-07-15",
    currency: "PKR"
  },
  "Bangladesh|Main|Bangladesh Main Branch": {
    company: "Damaan Bangladesh Ltd",
    code: "BD-MAIN-001",
    city: "Dhaka",
    address: "Motijheel Commercial Area, Dhaka",
    phone: "+880 2 0000 0000",
    email: "bangladesh.main@damaan.test",
    manager: "Rahman Ahmed",
    opening: "2018-02-10",
    currency: "BDT"
  },
  "UAE|Main|UAE Main Branch": {
    company: "Damaan UAE LLC",
    code: "AE-MAIN-001",
    city: "Dubai",
    address: "Business Bay, Dubai",
    phone: "+971 4 000 0000",
    email: "uae.main@damaan.test",
    manager: "Omar Saeed",
    opening: "2021-01-08",
    currency: "AED"
  },
  "Afghanistan|Main|Afghanistan Main Branch": {
    company: "Damaan Afghanistan Ltd",
    code: "AF-MAIN-001",
    city: "Kabul",
    address: "Shahr-e-Naw, Kabul",
    phone: "+93 20 555 1212",
    email: "afghanistan.main@damaan.test",
    manager: "Ahmad Rahimi",
    opening: "2014-04-10",
    currency: "AFN"
  }
};

const subTypes: Record<AccountTitle, string[]> = {
  Customer: ["Company Account", "Business Account", "Personal Account"],
  Bank: ["Company Bank Account", "Branch Bank Account", "Cash Control Account"],
  Employee: ["Employee Position: Manager", "Employee Position: Cashier", "Employee Position: Clerk"]
};

const categories = ["Expenses", "Purchase", "Sales", "Revenue"];

function deriveBranchInfo(country: string, branchType: BranchType, branch: string): BranchInfo {
  const city = branch.split(" ")[0] || "-";
  const prefix =
    country === "UAE" ? "AE" : country === "Bangladesh" ? "BD" : country.slice(0, 2).toUpperCase();
  const branchKind = branchType === "Main" ? "MAIN" : "CITY";

  return {
    company: `Damaan ${country} Ltd`,
    code: `${prefix}-${branchKind}-${String(branch.length).padStart(3, "0")}`,
    city,
    address: `${city} Central Road`,
    phone: "+00 000 000 000",
    email: `${city.toLowerCase()}.${branchType.toLowerCase()}@damaan.test`,
    manager: "-",
    opening: "-",
    currency:
      country === "Pakistan"
        ? "PKR"
        : country === "Bangladesh"
          ? "BDT"
          : country === "UAE"
            ? "AED"
            : country === "Afghanistan"
              ? "AFN"
              : country === "Iran"
                ? "IRR"
                : "-"
  };
}

function nextNumber(current: number) {
  return String(current + 1).padStart(3, "0");
}

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
}

function StatusBadge({ ready, saved }: { ready: boolean; saved: boolean }) {
  if (saved) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Entry saved
      </span>
    );
  }

  return (
    <span
      className={
        ready
          ? "inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
          : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
      }
    >
      {ready ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertCircle className="h-4 w-4" aria-hidden />}
      {ready ? "Ready to save" : "Draft entry"}
    </span>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  const blank = !value || value === "-";

  return (
    <div className="grid grid-cols-[132px_1fr] gap-3 text-sm">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={blank ? "font-semibold text-slate-400" : "font-semibold text-slate-950"}>
        {value || "-"}
      </span>
    </div>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className={done ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-300"} aria-hidden />
      <span className={done ? "font-medium text-slate-900" : "text-slate-500"}>{label}</span>
    </div>
  );
}

function selectedBranchName(rows: CountryBranchRow[], id: string) {
  const row = rows.find((item) => item.id === id);
  return row ? `${row.name} (${row.code})` : "-";
}

function selectedCityBranchName(rows: CityBranchRow[], id: string) {
  const row = rows.find((item) => item.id === id);
  return row ? `${row.city_name} - ${row.name} (${row.code})` : "-";
}

export function NewAccountSetup() {
  const router = useRouter();
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
  const [journalCounter, setJournalCounter] = useState(0);
  const [accountCounters, setAccountCounters] = useState<Record<string, number>>({});
  const [lastBranchCode, setLastBranchCode] = useState("");
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<AccountCreateResponse | null>(null);

  const [reportRows, setReportRows] = useState<AccountGeneralReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [filterAccountNo, setFilterAccountNo] = useState("");
  const [filterAccountName, setFilterAccountName] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterAccountType, setFilterAccountType] = useState("all");
  const [filterSubType, setFilterSubType] = useState("all");

  const [appliedAccountNo, setAppliedAccountNo] = useState("");
  const [appliedAccountName, setAppliedAccountName] = useState("");
  const [appliedCountry, setAppliedCountry] = useState("all");
  const [appliedBranch, setAppliedBranch] = useState("all");
  const [appliedAccountType, setAppliedAccountType] = useState("all");
  const [appliedSubType, setAppliedSubType] = useState("all");

  async function fetchReport() {
    setReportLoading(true);
    try {
      const res = await fetch("/api/erp/accounting/reports/accounts/general?limit=500").then((r) => r.json());
      if (res && Array.isArray(res.rows)) {
        setReportRows(res.rows);
      }
    } catch (err) {
      console.error("Failed to load account report:", err);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
  }, []);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    for (const r of reportRows) {
      if (r.countryName) set.add(r.countryName);
    }
    return Array.from(set);
  }, [reportRows]);

  const uniqueBranches = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reportRows) {
      if (r.branchCode && r.branchName) {
        map.set(r.branchCode, r.branchName);
      }
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [reportRows]);

  const uniqueAccountTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of reportRows) {
      if (r.accountCategory) set.add(`${r.accountCategory} Account`);
    }
    return Array.from(set);
  }, [reportRows]);

  const uniqueSubTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of reportRows) {
      if (r.subType) set.add(r.subType);
    }
    return Array.from(set);
  }, [reportRows]);

  function handleApplyFilters() {
    setAppliedAccountNo(filterAccountNo);
    setAppliedAccountName(filterAccountName);
    setAppliedCountry(filterCountry);
    setAppliedBranch(filterBranch);
    setAppliedAccountType(filterAccountType);
    setAppliedSubType(filterSubType);
  }

  function handleResetFilters() {
    setFilterAccountNo("");
    setFilterAccountName("");
    setFilterCountry("all");
    setFilterBranch("all");
    setFilterAccountType("all");
    setFilterSubType("all");

    setAppliedAccountNo("");
    setAppliedAccountName("");
    setAppliedCountry("all");
    setAppliedBranch("all");
    setAppliedAccountType("all");
    setAppliedSubType("all");
  }

  const filteredReportRows = useMemo(() => {
    return reportRows.filter((row) => {
      if (appliedAccountNo) {
        const query = appliedAccountNo.toLowerCase();
        const matchesCode = (row.accountCode ?? "").toLowerCase().includes(query);
        const matchesJournal = (row.journalCode ?? "").toLowerCase().includes(query);
        if (!matchesCode && !matchesJournal) return false;
      }
      if (appliedAccountName) {
        const query = appliedAccountName.toLowerCase();
        if (!(row.accountName ?? "").toLowerCase().includes(query)) return false;
      }
      if (appliedCountry !== "all") {
        if (row.countryName !== appliedCountry) return false;
      }
      if (appliedBranch !== "all") {
        if (row.branchCode !== appliedBranch) return false;
      }
      if (appliedAccountType !== "all") {
        const accType = `${row.accountCategory} Account`;
        if (accType !== appliedAccountType) return false;
      }
      if (appliedSubType !== "all") {
        if (row.subType !== appliedSubType) return false;
      }
      return true;
    });
  }, [reportRows, appliedAccountNo, appliedAccountName, appliedCountry, appliedBranch, appliedAccountType, appliedSubType]);

  const selectedCountry = useMemo(
    () => countries.find((item) => item.id === country) ?? null,
    [countries, country]
  );

  const branchOptions = branchType === "Main" ? mainBranches : branchType === "City" ? cityBranches : [];

  const branchInfo = useMemo(() => {
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
        currency: row.local_currency || selectedCountry.currency_code || "-"
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
      currency: row.local_currency || selectedCountry.currency_code || "-"
    };
  }, [branch, branchType, cityBranches, mainBranches, selectedCountry]);

  const journalPreview = `SUPER-${nextNumber(journalCounter)}`;
  const branchCode = branchInfo?.code ?? "";
  const accountPreview = lastCreated?.accountNumber || accountCode || (branchCode ? "AUTO" : "");
  const readyToSave = Boolean(country && branchType && branch && accountTitle && subType && category && accountName);
  const saved = message.startsWith("Saved");

  useEffect(() => {
    if (!branchCode || branchCode === lastBranchCode) return;
    setLastBranchCode(branchCode);
    setAccountCode("");
  }, [accountCode, accountCounters, branchCode, lastBranchCode]);

  useEffect(() => {
    let cancelled = false;
    listCountries()
      .then((rows) => {
        if (!cancelled) setCountries(rows);
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load countries from database.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!country) {
      setMainBranches([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(country)}`)
      .then((res) => res.json())
      .then((json: { countryBranches?: CountryBranchRow[] }) => {
        if (!cancelled) setMainBranches(Array.isArray(json.countryBranches) ? json.countryBranches : []);
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load main branches from database.");
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    if (!country) {
      setCityBranches([]);
      return;
    }

    let cancelled = false;
    const mainBranchId = branchType === "City" ? mainBranches[0]?.id ?? "" : "";
    const params = new URLSearchParams({ countryId: country });
    if (mainBranchId) params.set("countryBranchId", mainBranchId);
    fetch(`/api/branch-management/city-branches?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { cityBranches?: CityBranchRow[] }) => {
        if (!cancelled) setCityBranches(Array.isArray(json.cityBranches) ? json.cityBranches : []);
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load city branches from database.");
      });
    return () => {
      cancelled = true;
    };
  }, [branchType, country, mainBranches]);

  function handleCountryChange(value: string) {
    setCountry(value);
    setBranchType("");
    setBranch("");
    setLastBranchCode("");
    setAccountCode("");
    setLastCreated(null);
    setMessage("");
  }

  function handleBranchTypeChange(value: BranchType) {
    setBranchType(value);
    setBranch("");
    setLastBranchCode("");
    setAccountCode("");
    setLastCreated(null);
    setMessage("");
  }

  async function saveEntry() {
    if (!readyToSave || !branchInfo || !accountTitle || !branchType) {
      setMessage("Complete branch and account fields first.");
      return;
    }

    const issuedJournal = `SUPER-${nextNumber(journalCounter)}`;
    const scope = branchType === "Main" ? "main_branch" : "city_branch";

    setSaving(true);
    setMessage("");
    setLastCreated(null);
    try {
      const response = await apiPost<AccountCreateResponse>("/api/erp/accounting/accounts", {
        scope,
        countryId: country,
        countryBranchId:
          branchType === "Main"
            ? branch
            : cityBranches.find((item) => item.id === branch)?.country_branch_id ?? mainBranches[0]?.id ?? null,
        cityBranchId: branchType === "City" ? branch : null,
        parentId: null,
        code: "AUTO",
        manualReferenceNumber: manualReferenceNumber.trim() || null,
        name: accountName.trim(),
        kind: category === "Sales" || category === "Revenue" ? "income" : category === "Expenses" ? "expense" : "asset",
        currency: branchInfo.currency || selectedCountry?.currency_code || "USD",
        openingBalance: 0,
        isControlAccount: accountTitle === "Bank"
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
      setMessage(`Saved account ${response.accountNumber}. Ledger linked automatically.`);
      void fetchReport();
      router.push(`/dashboard/accounts?accountId=${response.accountId}&created=1`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Template</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Account</h1>
          <p className="text-sm text-muted-foreground">
            Branch select karein, account details enter karein, report live update hogi.
          </p>
        </div>
        <StatusBadge ready={readyToSave} saved={saved} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="font-semibold">Step 1 - Branch Selection</h2>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select id="country" value={country} onChange={(event) => handleCountryChange(event.target.value)} className={selectClass()}>
                  <option value="">Select Country</option>
                  {countries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.iso2 ?? "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branchType">Branch Type</Label>
                <select
                  id="branchType"
                  value={branchType}
                  onChange={(event) => handleBranchTypeChange(event.target.value as BranchType)}
                  disabled={!country}
                  className={selectClass()}
                >
                  <option value="">Select Branch Type</option>
                  <option value="Main">Main Branch</option>
                  <option value="City">City Branch</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch">Select Branch</Label>
                <select
                  id="branch"
                  value={branch}
                  onChange={(event) => {
                    setBranch(event.target.value);
                    setMessage("");
                  }}
                  disabled={!country || !branchType}
                  className={selectClass()}
                >
                  <option value="">Select Branch</option>
                  {branchOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {branchType === "Main"
                        ? `${(item as CountryBranchRow).name} (${(item as CountryBranchRow).code})`
                        : `${(item as CityBranchRow).city_name} - ${(item as CityBranchRow).name} (${(item as CityBranchRow).code})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t pt-5">
              <div className="mb-4 flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="font-semibold">Step 2 - Account Entry</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="accountTitle">Account Title</Label>
                  <select
                    id="accountTitle"
                    value={accountTitle}
                    onChange={(event) => {
                      setAccountTitle(event.target.value as AccountTitle);
                      setSubType("");
                      setMessage("");
                    }}
                    className={selectClass()}
                  >
                    <option value="">Select Account Title</option>
                    <option value="Customer">Customer</option>
                    <option value="Bank">Bank</option>
                    <option value="Employee">Employee</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subType">Sub Type</Label>
                  <select
                    id="subType"
                    value={subType}
                    onChange={(event) => {
                      setSubType(event.target.value);
                      setMessage("");
                    }}
                    disabled={!accountTitle}
                    className={selectClass()}
                  >
                    <option value="">Select Sub Type</option>
                    {accountTitle
                      ? subTypes[accountTitle].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))
                      : null}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setMessage("");
                    }}
                    className={selectClass()}
                  >
                    <option value="">Select Category</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="accountCode">Account Code (Auto)</Label>
                  <Input
                    id="accountCode"
                    value={accountCode}
                    readOnly
                    aria-readonly="true"
                    placeholder="Generated on save"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Account code branch/country sequence se auto issue hota hai. User manual code enter nahi karega.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(event) => {
                      setAccountName(event.target.value);
                      setMessage("");
                    }}
                    placeholder="e.g. Sales Account"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="manualReferenceNumber">Manual Reference Number</Label>
                  <Input
                    id="manualReferenceNumber"
                    value={manualReferenceNumber}
                    onChange={(event) => {
                      setManualReferenceNumber(event.target.value.toUpperCase());
                      setMessage("");
                    }}
                    placeholder="e.g. CUST-001"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Optional. Search anywhere by account number or this manual reference.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Save account to Account Master. Ledger aur identity numbers automatically link ho jayenge.
                </p>
                <Button type="button" onClick={saveEntry} disabled={!readyToSave || saving} className="rounded-lg">
                  <Save className="h-4 w-4" aria-hidden />
                  {saving ? "Saving..." : "Save Entry"}
                </Button>
              </div>

              {message ? (
                <div
                  className={
                    saved
                      ? "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                      : "mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
                  }
                >
                  {message}
                </div>
              ) : null}

              {lastCreated ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-extrabold">
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        Account Created Successfully
                      </div>
                      <div className="mt-2 grid gap-1 text-xs md:grid-cols-2">
                        <span><b>Account:</b> {lastCreated.accountNumber}</span>
                        <span><b>Manual Ref:</b> {lastCreated.manualReferenceNumber || "-"}</span>
                        <span><b>Customer:</b> {lastCreated.customerNumber}</span>
                        <span><b>Country Serial:</b> {lastCreated.countrySerialNumber}</span>
                        <span><b>Branch Serial:</b> {lastCreated.branchSerialNumber}</span>
                        <span><b>Ledger:</b> {lastCreated.ledgerId}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/accounts?accountId=${lastCreated.accountId}`}>
                          <Eye className="h-4 w-4" aria-hidden />
                          View
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/accounts/setup?accountId=${lastCreated.accountId}`}>
                          <Save className="h-4 w-4" aria-hidden />
                          Edit
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                        <FileText className="h-4 w-4" aria-hidden />
                        PDF
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/ledger/new?account=${encodeURIComponent(lastCreated.accountNumber)}`}>
                          <BookOpen className="h-4 w-4" aria-hidden />
                          Ledger
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/roznamcha/cash-entry">
                          <ReceiptText className="h-4 w-4" aria-hidden />
                          Daily Payment
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-lg border bg-card xl:sticky xl:top-24">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="font-semibold">New Account Report</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Yahan har selected field live show hoti hai.
            </p>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Full Branch Header</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">
                {branchInfo
                  ? `${branchInfo.company} - ${branchInfo.code} - ${selectedCountry?.name ?? "-"} - ${branchInfo.city} - ${branchType} - ${
                      branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch)
                    }`
                  : "- - - - - -"}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Building2 className="h-4 w-4 text-primary" aria-hidden />
                Branch Details
              </h3>
              <ReportRow label="Company" value={branchInfo?.company ?? "-"} />
              <ReportRow label="Branch Code" value={branchInfo?.code ?? "-"} />
              <ReportRow label="Country" value={selectedCountry?.name ?? "-"} />
              <ReportRow label="City" value={branchInfo?.city ?? "-"} />
              <ReportRow label="Branch Type" value={branchType || "-"} />
              <ReportRow label="Branch Name" value={branchType === "Main" ? selectedBranchName(mainBranches, branch) : selectedCityBranchName(cityBranches, branch)} />
              <ReportRow label="Address" value={branchInfo?.address ?? "-"} />
              <ReportRow label="Phone" value={branchInfo?.phone ?? "-"} />
              <ReportRow label="Email" value={branchInfo?.email ?? "-"} />
              <ReportRow label="Manager" value={branchInfo?.manager ?? "-"} />
              <ReportRow label="Opening Date" value={branchInfo?.opening ?? "-"} />
              <ReportRow label="Currency" value={branchInfo?.currency ?? "-"} />
            </div>

            <div className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Landmark className="h-4 w-4 text-primary" aria-hidden />
                Account Details
              </h3>
              <ReportRow label="Account Title" value={accountTitle || "-"} />
              <ReportRow label="Sub Type" value={subType || "-"} />
              <ReportRow label="Category" value={category || "-"} />
              <ReportRow label="Account Number" value={accountPreview || "-"} />
              <ReportRow label="Manual Reference" value={manualReferenceNumber || lastCreated?.manualReferenceNumber || "-"} />
              <ReportRow label="Customer Number" value={lastCreated?.customerNumber ?? "-"} />
              <ReportRow label="Serial Number" value={lastCreated?.accountSerialNumber ? String(lastCreated.accountSerialNumber) : "-"} />
              <ReportRow label="Country Serial" value={lastCreated?.countrySerialNumber ?? "-"} />
              <ReportRow label="Branch Serial" value={lastCreated?.branchSerialNumber ?? "-"} />
              <ReportRow label="Branch Sequence" value={lastCreated?.branchAccountSequence ? String(lastCreated.branchAccountSequence) : "-"} />
              <ReportRow label="Account Name" value={accountName || "-"} />
              <ReportRow label="Journal Preview" value={journalPreview} />
            </div>

            <div className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Hash className="h-4 w-4 text-primary" aria-hidden />
                Entry Check
              </h3>
              <ChecklistItem done={Boolean(country)} label="Country selected" />
              <ChecklistItem done={Boolean(branchType)} label="Branch type selected" />
              <ChecklistItem done={Boolean(branch)} label="Branch selected" />
              <ChecklistItem done={Boolean(accountTitle)} label="Account title selected" />
              <ChecklistItem done={Boolean(subType)} label="Sub type selected" />
              <ChecklistItem done={Boolean(category)} label="Category selected" />
              <ChecklistItem done={Boolean(accountPreview)} label="Account code ready" />
              <ChecklistItem done={Boolean(accountName)} label="Account name entered" />
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <UserRound className="h-4 w-4 text-primary" aria-hidden />
                Saved Account Entries
              </h3>
              {savedEntries.length ? (
                <div className="space-y-2">
                  {savedEntries.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-white p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-950">{entry.accountName}</span>
                        <span className="text-slate-500">{entry.savedAt}</span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {entry.accountCode} - {entry.journalCode}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {entry.branchName} ({entry.branchCode})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed bg-white p-3 text-sm text-slate-500">
                  No entry has been saved yet. Saved account entries will show here.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Account Setup Report (View) Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden mt-6">
        {/* Title Bar */}
        <div className="bg-[#0284c7] px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Account Setup Report (View)</h2>
          <span className="text-xs text-white/90">
            Generated: {new Date().toISOString().slice(0, 10)}
          </span>
        </div>

        {/* Filters Row */}
        <div className="bg-[#f8fafc] border-b p-3 flex flex-wrap items-end gap-3 text-xs">
          <div className="space-y-1">
            <Label htmlFor="filterAccountNo" className="text-[11px] text-slate-500">Account No</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                id="filterAccountNo"
                value={filterAccountNo}
                onChange={(e) => setFilterAccountNo(e.target.value)}
                placeholder="Search Account No"
                className="h-8 pl-8 text-xs w-44 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filterAccountName" className="text-[11px] text-slate-500">Account Name</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                id="filterAccountName"
                value={filterAccountName}
                onChange={(e) => setFilterAccountName(e.target.value)}
                placeholder="Search Account Name"
                className="h-8 pl-8 text-xs w-44 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filterCountry" className="text-[11px] text-slate-500">Country</Label>
            <select
              id="filterCountry"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-40"
            >
              <option value="all">All Countries</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filterBranch" className="text-[11px] text-slate-500">Branch</Label>
            <select
              id="filterBranch"
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-40"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filterAccountType" className="text-[11px] text-slate-500">Account Type</Label>
            <select
              id="filterAccountType"
              value={filterAccountType}
              onChange={(e) => setFilterAccountType(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-40"
            >
              <option value="all">All Account Types</option>
              {uniqueAccountTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filterSubType" className="text-[11px] text-slate-500">Sub Type</Label>
            <select
              id="filterSubType"
              value={filterSubType}
              onChange={(e) => setFilterSubType(e.target.value)}
              className="h-8 rounded-lg border border-input bg-white px-2.5 text-xs w-40"
            >
              <option value="all">All Sub Types</option>
              {uniqueSubTypes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleApplyFilters}
              className="h-8 bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 rounded-lg text-xs"
            >
              Apply
            </Button>
            <Button
              type="button"
              onClick={handleResetFilters}
              className="h-8 bg-[#64748b] hover:bg-[#475569] text-white px-4 rounded-lg text-xs"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f1f5f9] border-b text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Sr#</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Super Admin</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Account No.</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Account Name</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Account Type</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Sub Type</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Category</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Branch Type</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Branch Name</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Country</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200">Currency</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200 text-center">Company #</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200 text-center">Bank #</th>
                <th className="px-3 py-2.5 font-bold border-r border-slate-200 text-center">Contacts</th>
                <th className="px-3 py-2.5 font-bold text-center">View</th>
              </tr>
            </thead>
            <tbody>
              {reportLoading ? (
                <tr>
                  <td colSpan={15} className="text-center py-8 text-slate-400">
                    Loading accounts report...
                  </td>
                </tr>
              ) : filteredReportRows.length > 0 ? (
                filteredReportRows.map((row, index) => {
                  const hasCompany = (row.accountSerialNumber ?? (index + 1)) % 6 !== 0;
                  const hasBank = (row.accountSerialNumber ?? (index + 1)) % 4 !== 0;

                  return (
                    <tr key={row.accountId} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 border-r border-slate-200 font-medium text-slate-600">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center bg-white">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-700">SA-$1</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold font-mono text-blue-600">
                        {row.journalCode} / {row.accountCode}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">
                        {row.accountName}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600 font-medium">
                        {row.accountCategory} Account
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600">
                        {row.subType}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600">
                        {row.accountCategory}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600">
                        {row.branchType === "Main Branch" ? "Main Branch" : "City Branch"}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600 font-medium">
                        {row.branchName}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600 font-medium">
                        {row.countryName}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-slate-600 font-semibold font-mono">
                        {row.currency}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-center">
                        {hasCompany ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                            -
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-center">
                        {hasBank ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                            -
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                            <Phone className="h-2.5 w-2.5" />
                          </span>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-50 text-purple-500 border border-purple-100">
                            <Mail className="h-2.5 w-2.5" />
                          </span>
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/accounts?accountId=${row.accountId}`)}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="text-center py-8 text-slate-400">
                    No accounts found matching search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
