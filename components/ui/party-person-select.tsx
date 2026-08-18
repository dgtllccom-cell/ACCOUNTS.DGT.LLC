"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiGet } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Search, User, Truck, Briefcase, Building, ShieldCheck, ChevronDown, Check, X, Loader2 } from "lucide-react";

export type PartyType =
  | "all"
  | "customer"
  | "employee"
  | "driver"
  | "truck_owner"
  | "clearing_agent"
  | "vendor"
  | "business";

export interface PersonRecord {
  id: string;
  partyType: PartyType;
  firstName?: string;
  lastName?: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  country?: string;
  city?: string;
}

interface PartyPersonSelectProps {
  label?: string;
  value?: string;
  partyType?: PartyType;
  onSelect: (person: PersonRecord | null) => void;
  placeholder?: string;
  className?: string;
  allowChangePartyType?: boolean;
}

const PARTY_TYPE_LABELS: Record<string, Record<SupportedLang, string>> = {
  all: { en: "All Parties", ur: "تمام فریقین", ar: "جميع الأطراف", fa: "همه اشخاص", ps: "ټول اړخونه" },
  customer: { en: "Customer / Client", ur: "گاہک / خریدار", ar: "العميل", fa: "مشتری", ps: "پیرودونکی" },
  employee: { en: "Employee / Staff", ur: "ملازم / عملہ", ar: "الموظف", fa: "کارمند", ps: "کارکوونکی" },
  driver: { en: "Truck Driver", ur: "ٹرک ڈرائیور", ar: "سائق الشاحنة", fa: "راننده لاری", ps: "موټر چلوونکی" },
  truck_owner: { en: "Truck Owner", ur: "ٹرک مالک", ar: "مالك الشاحنة", fa: "مالک موتر", ps: "موټر خاوند" },
  clearing_agent: { en: "Clearing / Custom Agent", ur: "کلیرنگ ایجنٹ", ar: "مخلص جمركي", fa: "مامور گمرک", ps: "ګمرکي استازی" },
  vendor: { en: "Supplier / Vendor", ur: "سپلائر / وینڈر", ar: "المورد", fa: "تامین کننده", ps: "عرضه کونکی" },
  business: { en: "Corporate / Business", ur: "کاروباری ادارہ", ar: "الشركة / المؤسسة", fa: "شرکت تجاری", ps: "سوداګریزه اداره" },
};

type SupportedLang = "en" | "ur" | "ar" | "fa" | "ps";

export function PartyPersonSelect({
  label,
  value,
  partyType: defaultPartyType = "all",
  onSelect,
  placeholder = "Search by First Name, Surname, or Code...",
  className,
  allowChangePartyType = true
}: PartyPersonSelectProps) {
  const language = (useActiveLanguage() as SupportedLang) || "en";
  const [selectedPartyType, setSelectedPartyType] = useState<PartyType>(defaultPartyType);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PersonRecord[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch results when search query or party type changes
  useEffect(() => {
    let active = true;
    async function fetchPersons() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (searchQuery) queryParams.set("q", searchQuery);
        if (selectedPartyType !== "all") queryParams.set("type", selectedPartyType);
        queryParams.set("limit", "20");

        // Query unified master search / lookup
        const res: any = await apiGet(
          `/api/erp/master-data/lookup?entity=${selectedPartyType === "employee" ? "employees" : "customers"}&q=${encodeURIComponent(searchQuery)}`
        ).catch(() => ({ items: [] }));

        if (!active) return;

        const rawList = res?.items || res?.data || res?.customers || res?.employees || [];
        const mapped: PersonRecord[] = rawList.map((item: any) => {
          const names = (item.name || item.customer_name || item.full_name || "").split(" ");
          const firstName = item.first_name || names[0] || "";
          const lastName = item.last_name || names.slice(1).join(" ") || "";

          return {
            id: String(item.id),
            partyType: (item.party_type || selectedPartyType === "all" ? "customer" : selectedPartyType) as PartyType,
            firstName,
            lastName,
            name: item.name || `${firstName} ${lastName}`.trim() || "Unnamed",
            code: item.customer_code || item.employee_code || item.code || "",
            phone: item.phone || item.mobile || "",
            email: item.email || "",
            companyName: item.company_name || item.business_name || "",
            country: item.country_name || item.country || ""
          };
        });

        // Filter across terms (e.g. "Ahmad Khan" or "Khan")
        const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const filtered = terms.length === 0 ? mapped : mapped.filter(p => {
          const fullSearch = `${p.name} ${p.firstName} ${p.lastName} ${p.code} ${p.companyName} ${p.phone}`.toLowerCase();
          return terms.every(term => fullSearch.includes(term));
        });

        setResults(filtered);
      } catch (err) {
        console.error("PartyPersonSelect search error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(fetchPersons, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedPartyType]);

  function handleSelect(person: PersonRecord) {
    setSelectedPerson(person);
    onSelect(person);
    setIsOpen(false);
  }

  function handleClear() {
    setSelectedPerson(null);
    onSelect(null);
    setSearchQuery("");
  }

  const getPartyIcon = (type: PartyType) => {
    switch (type) {
      case "driver":
      case "truck_owner":
        return <Truck className="w-4 h-4 text-amber-500" />;
      case "employee":
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case "clearing_agent":
        return <ShieldCheck className="w-4 h-4 text-indigo-500" />;
      case "business":
        return <Building className="w-4 h-4 text-purple-500" />;
      default:
        return <User className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className={cn("relative space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Trigger & Input Bar */}
      <div className="relative flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all shadow-sm">
        {/* Party Type Selector Prefix */}
        {allowChangePartyType && (
          <div className="border-r border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-l-lg flex items-center gap-1.5 shrink-0">
            {getPartyIcon(selectedPartyType)}
            <select
              value={selectedPartyType}
              onChange={(e) => setSelectedPartyType(e.target.value as PartyType)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 border-none outline-none cursor-pointer pr-1"
            >
              <option value="all">{PARTY_TYPE_LABELS.all[language] || "All Parties"}</option>
              <option value="customer">{PARTY_TYPE_LABELS.customer[language] || "Customer"}</option>
              <option value="employee">{PARTY_TYPE_LABELS.employee[language] || "Employee"}</option>
              <option value="driver">{PARTY_TYPE_LABELS.driver[language] || "Driver"}</option>
              <option value="truck_owner">{PARTY_TYPE_LABELS.truck_owner[language] || "Truck Owner"}</option>
              <option value="clearing_agent">{PARTY_TYPE_LABELS.clearing_agent[language] || "Clearing Agent"}</option>
              <option value="vendor">{PARTY_TYPE_LABELS.vendor[language] || "Vendor / Supplier"}</option>
              <option value="business">{PARTY_TYPE_LABELS.business[language] || "Business"}</option>
            </select>
          </div>
        )}

        {/* Selected Display or Search Input */}
        {selectedPerson ? (
          <div className="flex-1 flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                {selectedPerson.name}
              </span>
              {selectedPerson.code && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedPerson.code}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-500 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center px-3">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full py-2 text-sm bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-2" />
            ) : (
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-2"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && !selectedPerson && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in duration-100">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {loading ? "Searching..." : "No matching persons or entities found"}
            </div>
          ) : (
            results.map((person) => (
              <div
                key={person.id}
                onClick={() => handleSelect(person)}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    {getPartyIcon(person.partyType)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{person.name}</span>
                      {person.code && (
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {person.code}
                        </span>
                      )}
                    </div>
                    {(person.companyName || person.phone) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {[person.companyName, person.phone, person.country].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400">
                  Select
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
