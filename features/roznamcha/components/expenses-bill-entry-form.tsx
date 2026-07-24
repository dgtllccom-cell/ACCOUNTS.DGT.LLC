"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  FileText, Plus, Eye, Save, MapPin, Settings2, Building2, 
  Lock, Unlock, Calculator, BadgePercent, Trash2, Printer, 
  MoreHorizontal, ArrowRightLeft, CheckCircle2, LayoutDashboard, Edit, Search
} from "lucide-react";
import { SupportedLanguage } from "@/lib/i18n/languages";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ExpensesInvoicePrint } from "@/components/reports/expenses-invoice-print";
import { ExpensesInvoicePrintStyle2 } from "@/components/reports/expenses-invoice-print-style2";
import { apiGet, apiPost } from "@/lib/api/client";

type TaxCodeRow = {
  id: string;
  tax_code: string;
  tax_pct: number;
  country: string;
};

const ExpensesBillRow = ({ b, total, countryName, currencyCode, branchName, userName, onView, onTransfer, onEdit }: any) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 font-medium text-slate-700">{b.serial_no}</td>
      <td className="px-4 py-3 text-slate-600">{b.bill_date}</td>
      <td className="px-4 py-3 text-slate-600 font-medium">{countryName}</td>
      <td className="px-4 py-3 text-slate-600">{branchName}</td>
      <td className="px-4 py-3 text-slate-600">
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${b.bill_mode === 'attached' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {b.bill_mode} - {b.bill_title}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{userName}</td>
      <td className="px-4 py-3 text-right font-bold text-slate-800">
        {currencyCode && <span className="text-slate-400 font-normal mr-1 text-xs">{currencyCode}</span>}
        {total.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-center">
        {b.transferred_to_roznamcha ? (
          <div className="flex flex-col items-center justify-center text-emerald-600 font-medium">
            <span className="flex items-center gap-1 text-xs"><CheckCircle2 className="w-3.5 h-3.5"/> Transferred</span>
            <span className="text-[9px] text-slate-400 mt-0.5">{new Date(b.updated_at || b.created_at || Date.now()).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-500 mb-1">No Transfer</span>
            <Button size="sm" className="h-6 px-3 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200" onClick={onTransfer}>
              Transfer
            </Button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center relative">
        <div className="flex justify-center items-center gap-2" ref={ref}>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={onView} title="View Bill">
            <Eye className="h-4 w-4" />
          </Button>

          <div className="relative">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal className="h-4 w-4 text-slate-500" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border rounded-md shadow-lg z-50 overflow-hidden text-left text-sm py-1">
                <button className="flex w-full px-3 py-2 text-slate-700 hover:bg-slate-50 items-center gap-2" onClick={() => { onView(); setMenuOpen(false); }}>
                  <Eye className="w-4 h-4" /> View / Print
                </button>
                {!b.transferred_to_roznamcha && (
                  <>
                    <button className="flex w-full px-3 py-2 text-blue-600 hover:bg-slate-50 items-center gap-2" onClick={() => { onEdit(); setMenuOpen(false); }}>
                      <Edit className="w-4 h-4" /> Edit
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};

type RowEntry = {
  id: string;
  rowSerial: string;
  details: string;
  qty: number | "";
  unitPrice: number | "";
  amount: number;
  currency: string;
  operation: string;
  exchangeRate: number | "";
  finalAmount: number;
  taxOn: boolean;
  taxPct: number | "";
  taxAmt: number;
  grandAmount: number;
};

const RenderAccountDetail = ({ ledger, colorClass, borderColorClass }: { ledger: any, colorClass: string, borderColorClass: string }) => {
  if (!ledger) return null;
  const contacts = ledger.enterprise_accounts?.contacts;
  
  return (
    <div className={`bg-white border ${borderColorClass} rounded p-2 text-xs relative shadow-sm mb-2 group flex flex-col gap-1.5`}>
       <p className="font-bold text-slate-800 break-words border-b pb-1 border-slate-100">{ledger.name || "Unknown Ledger"}</p>
       <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[10px]">
         <span className="text-slate-500">ID:</span>
         <span className="font-mono text-slate-700 text-right">{ledger.id.substring(0,8).toUpperCase()}</span>
         
         {ledger.enterprise_accounts?.account_number && (
           <>
             <span className="text-slate-500">Account No:</span>
             <span className="font-mono text-slate-700 text-right">{ledger.enterprise_accounts.account_number}</span>
           </>
         )}

         {ledger.countries?.name && (
           <>
             <span className="text-slate-500">Country:</span>
             <span className="text-slate-700 text-right">{ledger.countries.name}</span>
           </>
         )}

         {ledger.city_branches?.name && (
           <>
             <span className="text-slate-500">Branch:</span>
             <span className="text-slate-700 text-right">{ledger.city_branches.name}</span>
           </>
         )}
         
         {ledger.currency && (
           <>
             <span className="text-slate-500">Currency:</span>
             <span className={`font-bold ${colorClass} text-right`}>{ledger.currency}</span>
           </>
         )}
       </div>
       
       {/* Contacts */}
       {contacts && Array.isArray(contacts) && contacts.length > 0 && (
         <div className="mt-1 pt-1 border-t border-slate-100 space-y-1">
           {contacts.map((c: any, i: number) => {
             if (typeof c === 'string') return <div key={i} className="text-[10px] text-right text-slate-700">{c}</div>;
             if (typeof c === 'object' && c !== null) {
               const type = c.type || c.contact_type || Object.keys(c)[0] || "Detail";
               const val = c.value || c.contact_value || Object.values(c)[0] || "";
               return (
                 <div key={i} className="flex justify-between text-[10px] items-start">
                   <span className="text-slate-500 capitalize">{String(type)}:</span>
                   <span className="text-slate-700 text-right break-all ml-2">{String(val)}</span>
                 </div>
               );
             }
             return null;
           })}
         </div>
       )}
    </div>
  );
};

export function ExpensesBillEntryForm({ lang }: { lang: SupportedLanguage }) {
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  type SessionInfo = {
    user: { id: string; email: string | null; fullName: string | null };
    roles: string[];
  };
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((info: SessionInfo) => {
        if (active) setSessionInfo(info);
      })
      .catch(console.error);

    apiGet<any>('/api/erp/locations/taxes').then(res => {
      setTaxes(res?.taxes || []);
    });

    // Fetch active ledgers for transfer dropdowns
    import("@/features/reports/ledger-report/ledger-report-api").then(({ listLedgerReportLedgers }) => {
      listLedgerReportLedgers({ reportScope: "super_admin", limit: 2000 }).then(res => {
        if (active) {
          const l = Array.isArray(res.ledgers) ? res.ledgers : [];
          setLedgers(l);
        }
      });
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
  }, []);

  // Header State
  const [headerLocked, setHeaderLocked] = useState(false);
  const [billSerial, setBillSerial] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billMode, setBillMode] = useState("new"); // "new" | "attached"
  const [billTitle, setBillTitle] = useState("purchase");
  const [referenceNo, setReferenceNo] = useState("");

  const detailsRef = useRef<HTMLInputElement>(null);

  // Locations State
  const [countries, setCountries] = useState<any[]>([]);
  const [mainBranches, setMainBranches] = useState<any[]>([]);
  const [cityBranches, setCityBranches] = useState<any[]>([]);

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedMainBranch, setSelectedMainBranch] = useState("");
  const [branch, setBranch] = useState(""); // City Branch ID
  const [branchCurrency, setBranchCurrency] = useState("AED");

  // Row Entry State
  const [details, setDetails] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("AED");
  const [operation, setOperation] = useState("*");
  const [exchangeRate, setExchangeRate] = useState<number | "">("");
  const [finalAmount, setFinalAmount] = useState(0);

  // Tax State
  const [taxOn, setTaxOn] = useState(false);
  const [taxPct, setTaxPct] = useState<number | "">("");
  const [taxAmt, setTaxAmt] = useState(0);
  const [grandAmount, setGrandAmount] = useState(0);

  const [taxes, setTaxes] = useState<TaxCodeRow[]>([]);
  const [newTaxOpen, setNewTaxOpen] = useState(false);
  const [newTaxForm, setNewTaxForm] = useState({ taxName: "", taxPct: "", countryName: "" });

  const fetchTaxes = async () => {
    try {
      const data = await apiGet<any>("/api/erp/master-data/taxes");
      setTaxes(data || []);
    } catch (err) {
      console.error("Failed to fetch taxes", err);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, []);

  const saveNewTax = async () => {
    if (!newTaxForm.taxName || !newTaxForm.taxPct || !newTaxForm.countryName) {
      alert("Please fill all tax fields");
      return;
    }
    
    try {
      const data = await apiPost<any>("/api/erp/master-data/taxes", {
        taxName: newTaxForm.taxName,
        taxPct: newTaxForm.taxPct,
        countryName: newTaxForm.countryName
      });
      
      await fetchTaxes();
      setTaxPct(data.taxPct);
      setNewTaxOpen(false);
      setNewTaxForm({ taxName: "", taxPct: "", countryName: "" });
    } catch (err: any) {
      alert(err.message || "Failed to save tax code");
    }
  };

  // Rows Data
  const [rows, setRows] = useState<RowEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [viewBill, setViewBill] = useState<any | null>(null);
  const [printStyle, setPrintStyle] = useState<1 | 2>(1);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // Transfer State
  const [transferBill, setTransferBill] = useState<any | null>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [debitLedgerId, setDebitLedgerId] = useState("");
  const [creditLedgerId, setCreditLedgerId] = useState("");
  const [formDebitLedgerId, setFormDebitLedgerId] = useState("");
  const [formCreditLedgerId, setFormCreditLedgerId] = useState("");
  const [isDebitSearchOpen, setIsDebitSearchOpen] = useState(false);
  const [isCreditSearchOpen, setIsCreditSearchOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGeneratePdf = (styleId: 1 | 2) => {
    if (rows.length === 0) {
      alert("Please add some rows to the bill first.");
      return;
    }
    setPrintStyle(styleId);
    
    setTimeout(async () => {
      try {
        if (!(window as any).html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const element = document.getElementById("pdf-print-container");
        if (!element) return;
        
        // Temporarily make it visible for html2canvas to capture
        const originalDisplay = element.style.display;
        element.style.display = "block";
        
        const opt = {
          margin: 0,
          filename: `Expense_Bill_${billSerial || "New"}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfUrl = await (window as any).html2pdf().set(opt).from(element).outputPdf('bloburl');
        element.style.display = originalDisplay;
        
        window.open(pdfUrl, '_blank');
      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Failed to generate PDF. Please try again.");
      }
    }, 100);
  };

  const handleGeneratePdfModal = (styleId: 1 | 2) => {
    if (!viewBill) return;
    setPrintStyle(styleId);
    
    setTimeout(async () => {
      try {
        if (!(window as any).html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const element = document.getElementById("pdf-print-container-modal");
        if (!element) return;
        
        const originalDisplay = element.style.display;
        element.style.display = "block";
        
        const opt = {
          margin: 0,
          filename: `Expense_Bill_${viewBill.serial_no || "View"}.pdf`,
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfUrl = await (window as any).html2pdf().set(opt).from(element).outputPdf('bloburl');
        element.style.display = originalDisplay;
        
        window.open(pdfUrl, '_blank');
      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Failed to generate PDF. Please try again.");
      }
    }, 100);
  };

  const fetchRecentBills = async () => {
    try {
      setLoadingBills(true);
      const res = await apiGet<any>("/api/erp/expenses");
      if (res && res.bills) {
        setRecentBills(res.bills);
      }
    } catch (err) {
      console.error("Failed to fetch recent bills", err);
    } finally {
      setLoadingBills(false);
    }
  };

  const filteredLedgers = useMemo(() => {
    if (!transferBill) return [];
    const countryId = transferBill.city_branches?.country_id;
    const branchId = transferBill.branch_id;
    return ledgers
      .filter(l => {
        // Must match branch if ledger has branch
        if (l.city_branch_id) return l.city_branch_id === branchId;
        // Must match country if ledger has country
        if (l.country_id) return l.country_id === countryId;
        return true;
      })
      .map(l => ({
        label: `${l.name} - ${l.currency || ""}`,
        value: l.id
      }));
  }, [ledgers, transferBill]);

  const handleTransfer = async () => {
    if (!debitLedgerId || !creditLedgerId) {
      alert("Please select both Debit and Credit ledgers");
      return;
    }
    if (debitLedgerId === creditLedgerId) {
      alert("Debit and Credit ledgers cannot be the same");
      return;
    }
    setTransferring(true);
    try {
      await apiPost("/api/erp/expenses/transfer", {
        billId: transferBill.id,
        debitLedgerId,
        creditLedgerId
      });
      alert("Successfully transferred to Roznamcha!");
      setTransferBill(null);
      setDebitLedgerId("");
      setCreditLedgerId("");
      fetchRecentBills();
    } catch (err: any) {
      alert(err.message || "Failed to transfer bill");
    } finally {
      setTransferring(false);
    }
  };

  const handleEditBill = (bill: any) => {
    if (bill.transferred_to_roznamcha) {
      alert("Cannot edit a bill that has already been transferred to Roznamcha.");
      return;
    }
    setEditingBillId(bill.id);
    setBillDate(bill.bill_date);
    setBillTitle(bill.bill_title);
    setReferenceNo(bill.reference_no || "");
    setFormDebitLedgerId(bill.debit_ledger_id || "");
    setFormCreditLedgerId(bill.credit_ledger_id || "");
    setBillMode(bill.bill_mode || "new");
    if (bill.city_branches) {
      setSelectedCountry(bill.city_branches.country_id);
      setSelectedMainBranch(bill.city_branches.country_branch_id || "");
      setBranch(bill.branch_id);
    } else {
      setBranch(bill.branch_id);
    }
    
    // Map lines
    if (bill.expenses_bill_lines) {
      setRows(bill.expenses_bill_lines.map((l: any) => ({
        id: crypto.randomUUID(),
        rowSerial: l.row_serial,
        details: l.details,
        qty: l.qty,
        unitPrice: l.unit_price,
        amount: l.amount,
        currency: l.currency,
        operation: l.operation,
        exchangeRate: l.exchange_rate,
        finalAmount: l.final_amount,
        taxOn: l.tax_on,
        taxPct: l.tax_pct,
        taxAmt: l.tax_amt,
        grandAmount: l.grand_amount
      })));
    }
    setViewMode("form");
  };

  useEffect(() => {
    if (viewMode === "list") {
      fetchRecentBills();
      setEditingBillId(null);
    }
  }, [viewMode]);

  // Fetch initial countries
  useEffect(() => {
    apiGet<any>("/api/erp/locations/countries")
      .then((res) => {
        const list = res?.countries || res?.data || [];
        setCountries(list);
        const cId = sessionInfo?.scopes?.countryIds?.[0];
        if (cId && !selectedCountry) {
          setSelectedCountry(cId);
        } else if (list.length === 1 && !selectedCountry) {
          setSelectedCountry(list[0].id);
        }
      })
      .catch(console.error);
  }, [sessionInfo]);

  // Fetch main branches when country changes
  useEffect(() => {
    if (selectedCountry) {
      apiGet<any>(`/api/branch-management/country-branches?countryId=${selectedCountry}`)
        .then((res) => {
          const list = res?.countryBranches || res?.entries || res?.data || [];
          setMainBranches(list);
          const mbId = sessionInfo?.scopes?.countryBranchIds?.[0];
          const assigned = mbId ? list.find((b: any) => b.id === mbId) : null;
          if (assigned) {
            setSelectedMainBranch(assigned.id);
          } else if (list.length === 1) {
            setSelectedMainBranch(list[0].id);
          } else if (!selectedMainBranch || !list.some((b: any) => b.id === selectedMainBranch)) {
            setSelectedMainBranch("");
          }
        })
        .catch(console.error);
    } else {
      setMainBranches([]);
      setSelectedMainBranch("");
    }
  }, [selectedCountry, sessionInfo]);

  // Fetch city branches when main branch changes
  useEffect(() => {
    if (selectedMainBranch) {
      apiGet<any>(`/api/branch-management/city-branches?countryBranchId=${selectedMainBranch}`)
        .then((res) => {
          const list = res?.cityBranches || res?.entries || res?.data || [];
          setCityBranches(list);
          const cbId = sessionInfo?.scopes?.cityBranchIds?.[0];
          const assigned = cbId ? list.find((b: any) => b.id === cbId) : null;
          if (assigned) {
            setBranch(assigned.id);
          } else if (list.length === 1 && !sessionInfo?.scopes?.isSuperAdmin) {
            setBranch(list[0].id);
          } else if (!branch || !list.some((b: any) => b.id === branch)) {
            setBranch("");
          }
        })
        .catch(console.error);
    } else {
      setCityBranches([]);
      setBranch("");
    }
  }, [selectedMainBranch]);

  // Update Currency when City Branch changes
  useEffect(() => {
    const cb = cityBranches.find(b => b.id === branch);
    if (cb && cb.local_currency) {
      setBranchCurrency(cb.local_currency);
    }
  }, [branch, cityBranches]);

  const generateNextSerial = (b: string, d: string) => {
    const br = cityBranches.find((x: any) => x.id === b);
    const prefix = br?.code || "BR";
    const period = d.replace(/-/g, "").slice(0, 6);
    const rand = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
    return `${prefix}-${period}-${rand}`;
  };

  // Effects
  useEffect(() => {
    if (!headerLocked) {
      setBillSerial(generateNextSerial(branch, billDate));
      setCurrency(branchCurrency);
    }
  }, [branch, billDate, headerLocked, branchCurrency]);

  useEffect(() => {
    const q = Number(qty) || 0;
    const u = Number(unitPrice) || 0;
    if (q > 0 || u > 0) {
      setAmount(q * u);
    }
  }, [qty, unitPrice]);

  useEffect(() => {
    let final = amount;
    if (currency !== branchCurrency) {
      const rate = Number(exchangeRate) || 0;
      if (rate > 0) {
        final = operation === "*" ? amount * rate : amount / rate;
      }
    }
    setFinalAmount(final);

    let tPct = 0, tAmt = 0, grand = final;
    if (taxOn) {
      tPct = Number(taxPct) || 0;
      tAmt = final * (tPct / 100);
      grand = final + tAmt;
    }
    setTaxAmt(tAmt);
    setGrandAmount(grand);
  }, [amount, currency, branchCurrency, operation, exchangeRate, taxOn, taxPct]);

  const showFx = currency !== branchCurrency;

  const toggleHeaderLock = () => {
    setHeaderLocked(!headerLocked);
    if (!headerLocked && !billSerial) {
      setBillSerial(generateNextSerial(branch, billDate));
    }
  };

  const addRow = () => {
    if (!headerLocked) {
      alert("Please Lock the Header first.");
      return;
    }
    if (billMode === "attached" && !referenceNo.trim()) {
      alert("Linked Reference No is required for attached bills.");
      return;
    }
    if (!details.trim()) {
      alert("Enter details for the bill.");
      return;
    }
    if (finalAmount <= 0) {
      alert("Final amount must be greater than 0. Check Qty, Unit Price and FX rate.");
      return;
    }
    if (taxOn && (taxPct === "" || isNaN(Number(taxPct)))) {
      alert("Enter a valid Tax %");
      return;
    }

    const newRow: RowEntry = {
      id: crypto.randomUUID(),
      rowSerial: rows.length + 1,
      serial: billSerial,
      branch,
      date: billDate,
      title: billMode === "attached" ? billTitle : "-",
      referenceNo: billMode === "attached" ? referenceNo : "-",
      details: details.trim(),
      qty: Number(qty),
      unitPrice: Number(unitPrice),
      amount,
      currency,
      operation: showFx ? operation : "",
      exchangeRate: showFx ? Number(exchangeRate) : 0,
      finalAmount,
      taxOn,
      taxPct: taxOn ? Number(taxPct) : 0,
      taxAmt,
      grandAmount
    };

    setRows([...rows, newRow]);

    // Reset Entry Form
    setDetails("");
    setQty("");
    setUnitPrice("");
    setAmount(0);
    setOperation("*");
    setTaxOn(false);
    setTaxPct("");
    
    // Focus details for next row
    setTimeout(() => {
      detailsRef.current?.focus();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRow();
    }
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleSaveToDatabase = async () => {
    if (!branch) {
      alert("Please select a City Branch first.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        header: {
          id: editingBillId || undefined,
          billSerial: "AUTO",
          branch,
          billDate,
          billMode,
          billTitle,
          referenceNo: referenceNo || undefined,
          debitLedgerId: formDebitLedgerId || undefined,
          creditLedgerId: formCreditLedgerId || undefined
        },
        entries: rows.map(r => ({
          rowSerial: r.rowSerial,
          details: r.details,
          qty: r.qty,
          unitPrice: r.unitPrice,
          amount: r.amount,
          currency: r.currency,
          operation: r.operation,
          exchangeRate: r.exchangeRate,
          finalAmount: r.finalAmount,
          taxOn: r.taxOn,
          taxPct: r.taxPct,
          taxAmt: r.taxAmt,
          grandAmount: r.grandAmount
        }))
      };
      const res = await apiPost("/api/erp/expenses", payload);
      alert(editingBillId ? "Expenses Bill updated successfully!" : "Expenses Bill saved successfully!");
      setRows([]);
      setBillTitle("");
      setReferenceNo("");
      setEditingBillId(null);
      fetchRecentBills();
      setViewMode("list");
    } catch (err: any) {
      alert(err.message || "Failed to save bill.");
    } finally {
      setSaving(false);
    }
  };

  const totalFinal = rows.reduce((sum, r) => sum + r.grandAmount, 0);

  const previewBill = useMemo(() => {
    return {
      serial_no: billSerial,
      bill_date: billDate,
      reference_no: referenceNo,
      bill_title: billTitle,
      transferred_to_roznamcha: false,
      profiles: { full_name: sessionInfo?.user?.fullName || "System Admin", id: sessionInfo?.user?.id || "SYS" },
      city_branches: { 
        name: cityBranches.find(b => b.id === branch)?.name || branch,
        countries: { 
          name: countries.find(c => c.id === selectedCountry)?.name || "Country", 
          currency_code: branchCurrency 
        }
      },
      expenses_bill_lines: rows.map(r => ({
        qty: r.qty,
        details: r.details,
        unit_price: r.unitPrice,
        tax_pct: r.taxPct,
        tax_amt: r.taxAmt,
        amount: r.amount,
        grand_amount: r.grandAmount
      })),
      debit_ledger_id: formDebitLedgerId,
      credit_ledger_id: formCreditLedgerId,
      debit_ledger_name: ledgers.find(l => l.id === formDebitLedgerId)?.name,
      credit_ledger_name: ledgers.find(l => l.id === formCreditLedgerId)?.name
    };
  }, [billSerial, billDate, referenceNo, billTitle, sessionInfo, cityBranches, branch, countries, selectedCountry, branchCurrency, rows, formDebitLedgerId, formCreditLedgerId, ledgers]);

  const formFilteredLedgers = useMemo(() => {
    return ledgers
      .filter(l => {
        if (l.city_branch_id) return l.city_branch_id === branch;
        if (l.country_id) return l.country_id === selectedCountry;
        return true;
      })
      .map(l => ({
        label: `${l.name} - ${l.currency || ""}`,
        value: l.id
      }));
  }, [ledgers, selectedCountry, branch]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-24 text-sm font-sans">
      <div id="pdf-print-container" className="hidden print:block">
        {printStyle === 1 ? (
          <ExpensesInvoicePrint bill={previewBill} />
        ) : (
          <ExpensesInvoicePrintStyle2 bill={previewBill} />
        )}
      </div>

      <div className="print:hidden">
      {/* Page Header Portal */}
      {portalNode && createPortal(
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mr-2">
            <FileText className="h-4 w-4 text-primary" />
            Expenses Bill
          </h1>
          {viewMode === "list" ? (
            <Button size="sm" onClick={() => setViewMode("form")} className="h-7 text-xs bg-primary hover:bg-primary/90 text-white shadow-sm">
              <Plus className="h-3 w-3 mr-1" /> New Bill
            </Button>
          ) : (
            <div className="flex gap-2 items-center" ref={headerMenuRef}>
              <Button size="sm" variant="outline" onClick={() => setViewMode("list")} className="h-7 text-xs shadow-sm">
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => setViewMode("list")}>
                <Eye className="h-3 w-3 mr-1" /> View History
              </Button>
              <div className="relative">
                <Button size="sm" variant="outline" className="h-7 px-2 shadow-sm bg-white" onClick={() => setHeaderMenuOpen(!headerMenuOpen)}>
                  Actions <MoreHorizontal className="h-4 w-4 text-slate-600 ml-1" />
                </Button>
                {headerMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border rounded-md shadow-lg z-50 overflow-hidden text-left text-sm py-1">
                    <button className="flex w-full px-3 py-2 text-slate-700 hover:bg-slate-50 items-center gap-2" onClick={() => { setHeaderMenuOpen(false); handleGeneratePdf(1); }}>
                      <Printer className="w-4 h-4" /> PDF / Print (Style 1)
                    </button>
                    <button className="flex w-full px-3 py-2 text-slate-700 hover:bg-slate-50 items-center gap-2" onClick={() => { setHeaderMenuOpen(false); handleGeneratePdf(2); }}>
                      <Printer className="w-4 h-4" /> PDF / Print (Style 2)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>,
        portalNode
      )}

      <div className={viewMode === "list" ? "hidden" : "space-y-4 mb-8"}>
          {/* TOP REPORTS ROW (5 Steps) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            
            {/* Report 1: Branch & Session Details */}
            <Card className="shadow-sm border-t-4 border-t-indigo-500 opacity-90 hover:opacity-100 transition-opacity">
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-600 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> 1. Branch & Session Details</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* User / Role Row */}
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">User</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">{sessionInfo?.user?.fullName || "superadmin"}</span>
                    <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                      {sessionInfo?.roles?.[0] ? sessionInfo.roles[0].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Super Admin"}
                    </span>
                  </div>
                </div>

                {/* Name Row */}
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Name</span>
                  <span className="font-semibold text-slate-700">{sessionInfo?.user?.fullName || "superadmin"}</span>
                </div>

                {/* Date Row */}
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Date</span>
                  <span className="font-semibold text-slate-700">{new Date().toLocaleDateString()}</span>
                </div>

                {/* Day Row */}
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Day</span>
                  <span className="font-semibold text-slate-700">{new Date().toLocaleDateString(undefined, { weekday: 'long' })}</span>
                </div>

                {/* Country Row */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Country</span>
                  <div className="relative inline-flex items-center group cursor-pointer">
                    <select 
                      className="appearance-none bg-transparent border-0 p-0 pr-5 font-bold text-slate-700 text-right focus:ring-0 cursor-pointer text-xs z-10 w-[140px]" 
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      disabled={headerLocked}
                    >
                      <option value="">Select...</option>
                      {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <MapPin className="w-3.5 h-3.5 text-blue-500 absolute right-0 pointer-events-none group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Main Branch Row */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Main Branch</span>
                  <div className="relative inline-flex items-center group cursor-pointer">
                    <select 
                      className="appearance-none bg-transparent border-0 p-0 pr-5 font-bold text-slate-700 text-right focus:ring-0 cursor-pointer text-xs z-10 w-[140px]" 
                      value={selectedMainBranch}
                      onChange={(e) => setSelectedMainBranch(e.target.value)}
                      disabled={headerLocked}
                    >
                      <option value="">Select...</option>
                      {mainBranches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <MapPin className="w-3.5 h-3.5 text-blue-500 absolute right-0 pointer-events-none group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* City Branch Row */}
                <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">City Branch</span>
                  <div className="relative inline-flex items-center group cursor-pointer">
                    <select 
                      className="appearance-none bg-transparent border-0 p-0 pr-5 font-bold text-slate-700 text-right focus:ring-0 cursor-pointer text-xs z-10 w-[140px]" 
                      disabled={headerLocked} 
                      value={branch} 
                      onChange={e=>setBranch(e.target.value)}
                    >
                      <option value="">Select...</option>
                      {cityBranches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <MapPin className="w-3.5 h-3.5 text-blue-500 absolute right-0 pointer-events-none group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Base Currency Row */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Base Currency</span>
                  <span className="font-bold text-slate-700">{branchCurrency}</span>
                </div>

                {/* Session Time */}
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-50">
                  <span className="text-slate-500 font-medium">Session Time</span>
                  <span className="font-semibold text-slate-700">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Report 2: Bill Info */}
            <Card className={`shadow-sm border-t-4 transition-colors duration-300 opacity-90 hover:opacity-100 ${headerLocked ? "border-t-emerald-500 bg-emerald-50/10" : "border-t-amber-400"}`}>
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-600 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> 2. Bill Info</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <select 
                    className="appearance-none bg-transparent font-bold text-slate-700 text-xs focus:ring-0 cursor-pointer w-[100px]"
                    value={`${billMode}-${billTitle}`}
                    onChange={(e) => {
                       const [mode, title] = e.target.value.split('-');
                       setBillMode(mode);
                       setBillTitle(title);
                    }}
                    disabled={headerLocked}
                  >
                    <option value="new-purchase">New Bill</option>
                    <option value="attached-purchase">Purchase</option>
                    <option value="attached-sale">Sale</option>
                  </select>
                  <Input placeholder="Search Bill No..." className="h-6 text-xs w-[130px] border-slate-200" disabled={headerLocked || billMode === 'new'} />
                </div>
                <div className="text-[10px] bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-600 italic">
                  Select bill type to attach references.
                </div>
                
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-500 font-medium">Bill Number</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-1 rounded">{billSerial}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Date</span>
                  <input type="date" className="border border-slate-200 rounded px-1 w-[110px] h-6 text-slate-700 bg-white" disabled={headerLocked} value={billDate} onChange={e=>setBillDate(e.target.value)} />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Super Admin Sr.</span>
                  <span className="font-semibold text-slate-600">SA-{billSerial.split('-')[1]}-{Math.floor(Math.random() * 900) + 100}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Country Sr.</span>
                  <span className="font-semibold text-slate-600">CT-{billSerial.split('-')[1]}-{Math.floor(Math.random() * 90) + 10}</span>
                </div>
              </CardContent>
            </Card>

            {/* Report 3: Debit Account */}
            <Card className={`shadow-sm border-t-4 transition-colors duration-300 opacity-90 hover:opacity-100 flex flex-col ${headerLocked ? "border-t-emerald-500 bg-emerald-50/10" : "border-t-blue-500"}`}>
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-blue-600 flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> 3. Debit Account</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-blue-600 hover:bg-blue-100" onClick={() => setIsDebitSearchOpen(!isDebitSearchOpen)} disabled={headerLocked}>
                    <Search className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex flex-col flex-1">
                <div className="space-y-2 flex-1 flex flex-col">
                  {isDebitSearchOpen ? (
                    <div className="w-full rounded border border-blue-200 bg-blue-50/50 p-1 mb-2">
                       <SearchableSelect 
                         value={formDebitLedgerId} 
                         onChange={(val) => { setFormDebitLedgerId(val); setIsDebitSearchOpen(false); }} 
                         options={formFilteredLedgers} 
                         placeholder="Search debit ledger..." 
                         className="text-xs" 
                         disabled={headerLocked} 
                       />
                    </div>
                  ) : formDebitLedgerId ? (
                    <RenderAccountDetail 
                      ledger={ledgers.find(l => l.id === formDebitLedgerId)} 
                      colorClass="text-blue-600" 
                      borderColorClass="border-blue-100" 
                    />
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-fit text-xs border-dashed border-blue-300 text-blue-600 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700 mb-2" 
                      onClick={() => !headerLocked && setIsDebitSearchOpen(true)} 
                      disabled={headerLocked}
                    >
                      <Search className="h-3.5 w-3.5 mr-1.5" /> Select Account
                    </Button>
                  )}

                  <div className="text-[10px] text-slate-500 bg-blue-50 p-1.5 rounded border border-blue-100 mt-auto">
                    This account will be debited for the expense amount.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report 4: Credit Account */}
            <Card className={`shadow-sm border-t-4 transition-colors duration-300 opacity-90 hover:opacity-100 flex flex-col ${headerLocked ? "border-t-emerald-500 bg-emerald-50/10" : "border-t-emerald-500"}`}>
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-emerald-600 flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> 4. Credit Account</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-emerald-600 hover:bg-emerald-100" onClick={() => setIsCreditSearchOpen(!isCreditSearchOpen)} disabled={headerLocked}>
                    <Search className="h-3 w-3" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex flex-col flex-1">
                <div className="space-y-2 flex-1 flex flex-col">
                  {isCreditSearchOpen ? (
                    <div className="w-full rounded border border-emerald-200 bg-emerald-50/50 p-1 mb-2">
                       <SearchableSelect 
                         value={formCreditLedgerId} 
                         onChange={(val) => { setFormCreditLedgerId(val); setIsCreditSearchOpen(false); }} 
                         options={formFilteredLedgers} 
                         placeholder="Search credit ledger..." 
                         className="text-xs" 
                         disabled={headerLocked} 
                       />
                    </div>
                  ) : formCreditLedgerId ? (
                    <RenderAccountDetail 
                      ledger={ledgers.find(l => l.id === formCreditLedgerId)} 
                      colorClass="text-emerald-600" 
                      borderColorClass="border-emerald-100" 
                    />
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-fit text-xs border-dashed border-emerald-300 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-700 mb-2" 
                      onClick={() => !headerLocked && setIsCreditSearchOpen(true)} 
                      disabled={headerLocked}
                    >
                      <Search className="h-3.5 w-3.5 mr-1.5" /> Select Account
                    </Button>
                  )}

                  <div className="text-[10px] text-slate-500 bg-emerald-50 p-1.5 rounded border border-emerald-100 mt-auto">
                    This account will be credited (e.g. Cash or Bank).
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report 5: Summary & Action */}
            <Card className={`shadow-sm border-t-4 transition-colors duration-300 opacity-90 hover:opacity-100 ${headerLocked ? "border-t-emerald-500 bg-emerald-50/10" : "border-t-amber-400"}`}>
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-600 flex justify-between items-center">
                  <span className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> 5. Summary</span>
                  <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">{billSerial.split("-")[2] || billSerial}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex flex-col h-full">
                {billMode === "attached" ? (
                  <div className="space-y-1 mb-2">
                    <Label className="text-[11px] font-bold text-slate-600">Reference No</Label>
                    <Input placeholder="e.g. P-2025-0078" className="h-7 text-xs border-primary/30" disabled={headerLocked} value={referenceNo} onChange={e=>setReferenceNo(e.target.value)}/>
                  </div>
                ) : (
                  <div className="space-y-1 mb-2">
                    <Label className="text-[11px] font-bold text-slate-600">Reference No</Label>
                    <Input placeholder="Optional reference..." className="h-7 text-xs border-primary/30" disabled={headerLocked} value={referenceNo} onChange={e=>setReferenceNo(e.target.value)}/>
                  </div>
                )}
                
                <div className="mt-auto pt-2 border-t border-slate-100">
                  <Button 
                    variant={headerLocked ? "outline" : "default"}
                    onClick={toggleHeaderLock}
                    size="sm"
                    className={`w-full h-7 text-xs shadow-sm ${headerLocked ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
                  >
                    {headerLocked ? <><Unlock className="h-3.5 w-3.5 mr-1" /> Unlock Header</> : <><Lock className="h-3.5 w-3.5 mr-1" /> Lock Header</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

      {/* ENTRY CARD */}
      <Card className={`shadow-sm transition-opacity duration-300 ${!headerLocked ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Add New Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            
            {/* Details */}
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Details</Label>
              <Input ref={detailsRef} value={details} onChange={e => setDetails(e.target.value)} onKeyDown={handleKeyDown} placeholder="Item or expense details..." />
            </div>

            {/* Qty & Unit Price */}
            <div className="w-20 space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input type="number" value={qty} onChange={e => setQty(e.target.value ? Number(e.target.value) : "")} onKeyDown={handleKeyDown} />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Unit Price</Label>
              <Input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value ? Number(e.target.value) : "")} onKeyDown={handleKeyDown} />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs text-slate-600 font-semibold">Amount</Label>
              <Input type="number" step="0.01" value={amount || ""} onChange={e => setAmount(Number(e.target.value) || 0)} onKeyDown={handleKeyDown} className="bg-white text-right font-mono" placeholder="0.00" />
            </div>

            {/* Currency & FX */}
            <div className="w-24 space-y-1">
              <Label className="text-xs">Currency</Label>
              <select 
                value={currency} 
                onChange={e => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="PKR">PKR</option>
                <option value="AFN">AFN</option>
              </select>
            </div>
            
            {showFx && (
              <>
                <div className="w-16 space-y-1">
                  <Label className="text-xs">Op</Label>
                  <select 
                    value={operation} 
                    onChange={e => setOperation(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="*">×</option>
                    <option value="/">÷</option>
                  </select>
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Ex. Rate</Label>
                  <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value ? Number(e.target.value) : "")} onKeyDown={handleKeyDown} />
                </div>
              </>
            )}

            <div className="w-32 space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Final Amount</Label>
              <Input readOnly value={finalAmount.toFixed(2)} className="bg-slate-100 text-right font-mono font-semibold" />
            </div>

            {/* TAX */}
            <div className="w-24 space-y-1">
              <Label className="text-xs">Apply Tax?</Label>
              <div className="flex bg-slate-100 p-0.5 rounded-md border">
                <button 
                  type="button"
                  className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${!taxOn ? "bg-white shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setTaxOn(false)}
                >
                  No
                </button>
                <button 
                  type="button"
                  className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${taxOn ? "bg-amber-100 text-amber-700 font-bold shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  onClick={() => setTaxOn(true)}
                >
                  Yes
                </button>
              </div>
            </div>

            {taxOn && (
              <>
                <div className="w-48 space-y-1 animate-in fade-in zoom-in duration-200">
                  <Label className="text-xs text-amber-600 font-bold">Tax Code</Label>
                  <div className="flex flex-col gap-1">
                    <select 
                      value={taxPct ? String(taxPct) : ""}
                      onChange={e => {
                        const selectedVal = e.target.value;
                        if (selectedVal === "NEW_TAX_CODE") {
                          setNewTaxOpen(true);
                          return;
                        }
                        if (!selectedVal) {
                          setTaxPct("");
                          return;
                        }
                        // since value is taxPct for now to match UI state without refactoring everything
                        setTaxPct(Number(selectedVal));
                      }}
                      className="flex h-9 w-full rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 font-semibold cursor-pointer"
                    >
                      <option value="">Select...</option>
                      {taxes.filter(t => selectedCountry === "UAE" ? t.country === "United Arab Emirates" : t.country === selectedCountry).map(t => (
                        <option key={t.id} value={t.tax_pct}>{t.tax_code} ({t.tax_pct}%)</option>
                      ))}
                      <option value="NEW_TAX_CODE" className="font-bold text-primary">+ Add New Tax</option>
                    </select>
                  </div>
                </div>
                <div className="w-28 space-y-1 animate-in fade-in zoom-in duration-200">
                  <Label className="text-xs text-slate-500">Tax Amt</Label>
                  <Input readOnly value={taxAmt.toFixed(2)} className="bg-slate-50 text-right font-mono" />
                </div>
              </>
            )}

            <div className="w-32 space-y-1">
              <Label className="text-xs font-black text-slate-800">Total (Incl. Tax)</Label>
              <Input readOnly value={grandAmount.toFixed(2)} onKeyDown={handleKeyDown} className="bg-primary/5 border-primary/20 text-right font-mono font-bold text-primary cursor-pointer focus:ring-2 focus:ring-primary" title="Press Enter to Add Row" />
            </div>

            {/* Submit */}
            <div className="ml-auto flex items-end pb-1">
              <Button type="button" onClick={addRow} className="bg-slate-800 hover:bg-slate-900 text-white shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* TABLE DATA */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
              <tr>
                <th className="px-3 py-3 font-semibold text-center w-10">No.</th>
                <th className="px-3 py-3 font-semibold">Details</th>
                <th className="px-3 py-3 font-semibold text-right">Qty</th>
                <th className="px-3 py-3 font-semibold text-right">Unit Price</th>
                <th className="px-3 py-3 font-semibold text-right">Amount</th>
                <th className="px-3 py-3 font-semibold text-center">Cur</th>
                <th className="px-3 py-3 font-semibold text-center">Op</th>
                <th className="px-3 py-3 font-semibold text-right">Rate</th>
                <th className="px-3 py-3 font-semibold text-right">Final</th>
                <th className="px-3 py-3 font-semibold text-right">Tax %</th>
                <th className="px-3 py-3 font-semibold text-right">Tax Amt</th>
                <th className="px-3 py-3 font-black text-slate-800 text-right bg-slate-100">Total</th>
                <th className="px-3 py-3 font-semibold text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                    <Calculator className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    No entries added yet. Lock the header and add rows.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 text-center font-bold text-slate-400">{r.rowSerial}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[150px] truncate" title={r.details}>{r.details}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center font-bold text-[11px]">{r.currency}</td>
                    <td className="px-3 py-2 text-center font-mono">{r.operation}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.exchangeRate > 0 ? r.exchangeRate.toFixed(4) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{r.finalAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.taxOn ? <span className="inline-flex items-center text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]"><BadgePercent className="w-3 h-3 mr-0.5"/> {r.taxPct}%</span> : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-600">{r.taxOn ? r.taxAmt.toFixed(2) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold bg-slate-50/50">{r.grandAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeRow(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-200">
              <tr>
                <td colSpan={11} className="px-4 py-3 text-right font-black text-slate-600">
                  GRAND TOTAL (Incl. Tax)
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-lg text-primary">
                  {totalFinal.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        {rows.length > 0 && (
          <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
            <Button onClick={handleSaveToDatabase} disabled={saving} className="px-8 font-bold shadow-md shadow-primary/20 ml-2">
              {saving ? "Saving Bill..." : "Save Expenses Bill"}
              {!saving && <Save className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        )}
      </Card>
      </div>
      
      {/* ALWAYS SHOW HISTORY LIST AT THE BOTTOM */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Recent Expenses Bills
        </h3>
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Serial</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Amount</th>
                  <th className="px-4 py-3 font-semibold text-center w-32">Transfer Status</th>
                  <th className="px-4 py-3 font-semibold text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingBills ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading bills...</td>
                  </tr>
                ) : recentBills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                      No recent bills found. Click "New Bill" to create one.
                    </td>
                  </tr>
                ) : (
                  recentBills.map((b: any) => {
                    const total = b.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
                    const countryName = b.city_branches?.countries?.name || "-";
                    const currencyCode = b.city_branches?.countries?.currency_code || "";
                    const branchName = b.city_branches?.name || b.branch_id;
                    const userName = b.profiles?.full_name || "Super Admin";

                    return (
                      <ExpensesBillRow 
                        key={b.id}
                        b={b}
                        total={total}
                        countryName={countryName}
                        currencyCode={currencyCode}
                        branchName={branchName}
                        userName={userName}
                        onView={() => setViewBill(b)}
                        onTransfer={() => setTransferBill(b)}
                        onEdit={() => handleEditBill(b)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      
      {/* New Tax Modal */}
      {newTaxOpen && (
      <SimpleModal onClose={() => setNewTaxOpen(false)} title="Add New Tax Code">
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Country</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={newTaxForm.countryName}
              onChange={e => setNewTaxForm({...newTaxForm, countryName: e.target.value})}
            >
              <option value="">Select Country...</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
              <option value="Pakistan">Pakistan</option>
              <option value="Afghanistan">Afghanistan</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Tax Name</Label>
            <Input placeholder="e.g. VAT, GST" value={newTaxForm.taxName} onChange={e => setNewTaxForm({...newTaxForm, taxName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Percentage (%)</Label>
            <Input type="number" step="0.01" placeholder="e.g. 5.0" value={newTaxForm.taxPct} onChange={e => setNewTaxForm({...newTaxForm, taxPct: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t mt-6">
            <Button variant="outline" onClick={() => setNewTaxOpen(false)}>Cancel</Button>
            <Button onClick={saveNewTax} className="font-bold">Save Tax Code</Button>
          </div>
        </div>
      </SimpleModal>
      )}

      {/* View/Print Bill Modal */}
      {viewBill && (
        <SimpleModal onClose={() => setViewBill(null)} title="View Expenses Bill" className="max-w-[1200px] w-[95vw] print:w-full print:max-w-none print:m-0 print:p-0">
          <div className="bg-slate-600 p-6 md:p-12 rounded-md overflow-y-auto max-h-[80vh] flex justify-center print:hidden shadow-inner overflow-x-auto">
            <div 
              className="bg-white shadow-2xl w-[210mm] min-h-[297mm] flex-shrink-0 origin-top"
              style={{ transform: 'scale(1.25)', marginBottom: '75mm' }}
            >
              <div className="w-full h-full">
                {printStyle === 1 ? (
                  <ExpensesInvoicePrint bill={viewBill} />
                ) : (
                  <ExpensesInvoicePrintStyle2 bill={viewBill} />
                )}
              </div>
            </div>
          </div>
          
          <div id="pdf-print-container-modal" className="hidden print:block">
            {printStyle === 1 ? (
              <ExpensesInvoicePrint bill={viewBill} />
            ) : (
              <ExpensesInvoicePrintStyle2 bill={viewBill} />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4 print:hidden">
            <Button variant="outline" onClick={() => setViewBill(null)}>Close</Button>
            <Button onClick={() => handleGeneratePdfModal(1)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Printer className="w-4 h-4 mr-2" /> PDF (Style 1)
            </Button>
            <Button onClick={() => handleGeneratePdfModal(2)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Printer className="w-4 h-4 mr-2" /> PDF (Style 2)
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* Transfer Bill Modal */}
      {transferBill && (
        <SimpleModal onClose={() => setTransferBill(null)} title="Transfer to Roznamcha" className="max-w-[1400px] w-[98vw] h-[95vh] print:w-full print:max-w-none print:m-0 print:p-0">
          <div className="flex flex-col lg:flex-row gap-6 h-full">
            
            {/* Left Side: A4 Preview */}
            <div className="w-full lg:w-[65%] bg-slate-600 p-6 md:p-8 rounded-xl overflow-y-auto max-h-[85vh] flex justify-center shadow-inner">
              <div 
                className="bg-white shadow-2xl w-[210mm] min-h-[297mm] flex-shrink-0 origin-top"
                style={{ transform: 'scale(1.1)', marginBottom: '35mm' }}
              >
                <div className="w-full h-full">
                  <ExpensesInvoicePrintStyle2 
                    bill={{
                      ...transferBill, 
                      debit_ledger_name: ledgers.find(l => l.id === debitLedgerId)?.name, 
                      credit_ledger_name: ledgers.find(l => l.id === creditLedgerId)?.name,
                      debit_ledger_id: debitLedgerId,
                      credit_ledger_id: creditLedgerId
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Right Side: Transfer Form */}
            <div className="w-full lg:w-[35%] flex flex-col pt-2 max-h-[85vh] overflow-y-auto pr-2 pb-4">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-5 shadow-sm">
                <h3 className="font-black text-lg text-slate-800 flex justify-between items-center">
                  <span>{transferBill.serial_no}</span>
                  <span className="text-primary font-mono">
                    {transferBill.city_branches?.countries?.currency_code}{" "}
                    {(transferBill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0).toFixed(2)}
                  </span>
                </h3>
                <p className="text-sm text-slate-500 mt-1">{transferBill.bill_title} - {transferBill.city_branches?.name}</p>
              </div>

              <div className="space-y-6 flex-1">
                <div className="space-y-2 p-4 border border-blue-100 bg-blue-50/50 rounded-lg relative shadow-sm">
                  <div className="absolute -top-3 left-4 bg-blue-100 text-blue-700 font-black text-xs px-2 py-0.5 rounded shadow-sm border border-blue-200">DR</div>
                  <Label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>Debit Account (Expense)</span>
                  </Label>
                  <SearchableSelect
                    value={debitLedgerId}
                    onChange={setDebitLedgerId}
                    options={filteredLedgers}
                    placeholder="Search & Select Debit Ledger..."
                    className="w-full"
                  />
                  <p className="text-[10px] text-blue-600/80 font-medium">This account will be debited (DR) for the expense.</p>
                </div>

                <div className="space-y-2 p-4 border border-emerald-100 bg-emerald-50/50 rounded-lg relative shadow-sm">
                  <div className="absolute -top-3 left-4 bg-emerald-100 text-emerald-700 font-black text-xs px-2 py-0.5 rounded shadow-sm border border-emerald-200">CR</div>
                  <Label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>Credit Account (Payment Source)</span>
                  </Label>
                  <SearchableSelect
                    value={creditLedgerId}
                    onChange={setCreditLedgerId}
                    options={filteredLedgers}
                    placeholder="Search & Select Credit Ledger..."
                    className="w-full"
                  />
                  <p className="text-[10px] text-emerald-600/80 font-medium">This account will be credited (CR) (e.g. Cash, Bank).</p>
                </div>

                <div className="mt-4 p-4 border border-slate-200 bg-white rounded-lg shadow-sm text-[11px] leading-relaxed relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  
                  <p className="text-slate-700 font-medium mb-3 pb-2 border-b border-slate-100">
                    This case entry will go to the business Roznamcha.<br />
                  </p>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
                    <div>
                      <span className="text-slate-500">Journal Serial:</span><br/>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded mt-0.5 inline-block">AUTO</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Transfer Serial:</span><br/>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded mt-0.5 inline-block">TR-{Math.floor(Math.random() * 90000) + 10000}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Country Serial:</span><br/>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded mt-0.5 inline-block">CT-{(transferBill.city_branches?.country_id || "CT0001").substring(0,6).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Branch Serial:</span><br/>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1 rounded mt-0.5 inline-block">BR-{(transferBill.branch_id || "BR0001").substring(0,6).toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 mt-2 bg-slate-50 p-2 rounded">
                    <p className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Transferred On:</span> 
                      <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                    </p>
                    <p className="flex justify-between items-center mt-1.5">
                      <span className="font-semibold text-slate-700">Action By User / یوزر کا نام:</span> 
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{sessionInfo?.user?.fullName || "System Admin"}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-auto">
                <Button variant="outline" onClick={() => setTransferBill(null)} disabled={transferring} className="px-6 shadow-sm">Cancel</Button>
                <Button onClick={handleTransfer} disabled={transferring || !debitLedgerId || !creditLedgerId} className="bg-primary hover:bg-primary/90 text-white font-bold px-8 shadow-md">
                  {transferring ? "Transferring..." : "Confirm Transfer"}
                </Button>
              </div>
            </div>
            
          </div>
        </SimpleModal>
      )}

      </div>
    </div>
  );
}
