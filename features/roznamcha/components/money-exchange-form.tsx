"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, FileText, Settings2, Building2, Eye, Printer, Loader2, ArrowRightLeft } from "lucide-react";
import { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type MoneyExchangeEntry = {
  id?: string;
  serial_no: string;
  branch_id: string;
  entry_date: string;
  transaction_type: string;
  account_no: string;
  qty_currency: string;
  ex_currency: string;
  operation: string;
  rate: number;
  quantity: number;
  final_amount: number;
  receipt_name: string;
  received_from: string;
  mobile: string;
  details: string;
  profit_base_currency: number;
  created_at?: string;
};

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
  scopes: any;
};

export function MoneyExchangeForm({ lang: _initialLang }: { lang: SupportedLanguage }) {
  // The server-rendered `lang` prop only reflects the language at the moment of the
  // initial page load — it never updates on a client-side language switch without a
  // full navigation. useActiveLanguage() tracks the live selector reactively instead.
  const lang = useActiveLanguage();
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Locations states
  const [purchaseCountryId, setPurchaseCountryId] = useState("");
  const [receivedCountryId, setReceivedCountryId] = useState("");
  const [purchaseCities, setPurchaseCities] = useState<any[]>([]);
  const [receivedCities, setReceivedCities] = useState<any[]>([]);

  // Scoping & context
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchCurrency, setBranchCurrency] = useState("PKR");
  const [entrySerial, setEntrySerial] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Loading states
  const [saving, setSaving] = useState(false);
  const [loadingBills, setLoadingBills] = useState(false);
  const [recentBills, setRecentBills] = useState<MoneyExchangeEntry[]>([]);

  // Form states
  const [transactionType, setTransactionType] = useState<"Purchase"|"Sale">("Purchase");
  const [receivedType, setReceivedType] = useState("Name");
  const [purchaseCountry, setPurchaseCountry] = useState("");
  const [purchaseCity, setPurchaseCity] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [receivedCountry, setReceivedCountry] = useState("");
  const [receivedCity, setReceivedCity] = useState("");
  const [receivedOfficeName, setReceivedOfficeName] = useState("");
  const [receivedOfficeNumberType, setReceivedOfficeNumberType] = useState("Mobile");
  const [receivedOfficeNumberValue, setReceivedOfficeNumberValue] = useState("");
  
  const [qtyCurrency, setQtyCurrency] = useState("");
  const [exCurrency, setExCurrency] = useState("");
  const [operation, setOperation] = useState<"multiply"|"divide">("multiply");
  const [rate, setRate] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [finalAmount, setFinalAmount] = useState<number>(0);
  
  const [receiptName, setReceiptName] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [profit, setProfit] = useState<number | null>(null);

  // Filter
  const [searchQtyCur, setSearchQtyCur] = useState("");
  const [searchExCur, setSearchExCur] = useState("");

  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
  }, []);

  // Fetch Session & Initial Data
  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<any>("/api/erp/auth/session"),
      apiGet<any>("/api/erp/locations/countries"),
      apiGet<any>("/api/branch-management/city-branches")
    ]).then(([sess, cRes, bRes]) => {
      if (!active) return;
      setSessionInfo(sess);
      setCountries(cRes?.countries || cRes?.data || []);
      
      const branchesList = bRes?.cityBranches || bRes?.entries || bRes?.data || [];
      setBranches(branchesList);
      
      // Default to user's branch if possible
      let defaultBranchId = sess?.scopes?.cityBranchIds?.[0] || sess?.scopes?.countryBranchIds?.[0] || "";
      if (!defaultBranchId && !sess?.scopes?.isSuperAdmin) {
        defaultBranchId = branchesList?.[0]?.id || "";
      }
      if (!defaultBranchId && branchesList?.length === 1) {
        defaultBranchId = branchesList[0].id;
      }
      setSelectedBranch(defaultBranchId);
      if (defaultBranchId) {
        const br = branchesList?.find((x: any) => x.id === defaultBranchId);
        if (br) {
          setSelectedCountry(br.country_id);
          setBranchCurrency(br.currency_code || "PKR");
        } else if (sess?.scopes?.countryIds?.[0]) {
          setSelectedCountry(sess.scopes.countryIds[0]);
        }
      } else if (sess?.scopes?.countryIds?.[0]) {
        setSelectedCountry(sess.scopes.countryIds[0]);
      }
    }).catch(console.error);
    return () => { active = false; };
  }, []);



  useEffect(() => {
    // Generate Serial when branch changes
    if (selectedBranch) {
      const brCode = branches.find(b => b.id === selectedBranch)?.code || "BR";
      const random = String(Math.floor(Math.random() * 9000) + 1000);
      const period = entryDate.replace(/-/g, "").slice(0, 6);
      setEntrySerial(`${brCode}-EX-${period}-${random}`);
    }
  }, [selectedBranch, entryDate, branches]);

  const fetchRecentBills = async () => {
    if (!selectedBranch) return;
    try {
      setLoadingBills(true);
      const res = await apiGet<any>(`/api/erp/money-exchange?branchId=${selectedBranch}`);
      if (res && res.entries) {
        setRecentBills(res.entries);
      }
    } catch (err) {
      console.error("Failed to fetch recent entries", err);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchRecentBills();
  }, [selectedBranch]);

  // Calculations
  useEffect(() => {
    const r = Number(rate) || 0;
    const q = Number(quantity) || 0;
    if (r > 0 && q > 0) {
      const f = operation === "divide" ? q / r : q * r;
      setFinalAmount(f);
    } else {
      setFinalAmount(0);
    }
  }, [rate, quantity, operation]);

  // Save Entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return alert("Please select a valid Branch.");
    if (!entrySerial) return alert("Serial number not generated.");
    if (!qtyCurrency || !exCurrency || finalAmount <= 0) return alert("Please complete formula fields properly.");
    
    setSaving(true);
    try {
      const payload = {
        serialNo: entrySerial,
        branchId: selectedBranch,
        entryDate,
        transactionType,
        qtyCurrency,
        exCurrency,
        operation,
        rate: Number(rate),
        quantity: Number(quantity),
        finalAmount,
        receiptName: receiptName.trim() || null,
        receivedFrom: receivedFrom.trim() || null,
        mobile: mobile.trim() || null,
        details: details.trim() || null,
        profitBaseCurrency: profit || 0,
        receivedType: receivedType || null,
        purchaseCountry: purchaseCountry.trim() || null,
        purchaseCity: purchaseCity.trim() || null,
        purchasedFrom: purchasedFrom.trim() || null,
        receivedCountry: receivedCountry.trim() || null,
        receivedCity: receivedCity.trim() || null,
        receivedOfficeName: receivedOfficeName.trim() || null,
        receivedOfficeNumbers: receivedOfficeNumberValue.trim() ? `${receivedOfficeNumberType}: ${receivedOfficeNumberValue.trim()}` : null
      };
      
      await apiPost("/api/erp/money-exchange", payload);
      alert("Exchange entry saved successfully!");
      
      // Reset form but keep location states (makes repeated entries easier)
      setRate("");
      setQuantity("");
      setReceiptName("");
      setReceivedFrom("");
      setMobile("");
      setDetails("");
      setPurchasedFrom("");
      setReceivedOfficeName("");
      setReceivedOfficeNumberValue("");
      
      // refresh table
      fetchRecentBills();
    } catch (err: any) {
      alert(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  const filteredBills = useMemo(() => {
    return recentBills.filter(b => 
      b.qty_currency.toLowerCase().includes(searchQtyCur.toLowerCase()) &&
      b.ex_currency.toLowerCase().includes(searchExCur.toLowerCase())
    );
  }, [recentBills, searchQtyCur, searchExCur]);

  return (
    <div className="container mx-auto p-4 max-w-[1600px]">
      {portalNode && createPortal(
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mr-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            {tr("money_exchange.page_title", "Money Changer")}
          </h1>
        </div>,
        portalNode
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT FORM */}
        <div className="lg:col-span-7 space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <Card className="shadow-sm border-t-4 border-t-indigo-500">
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-600 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {tr("money_exchange.section1_title", "1. Branch & Session Details")}</span>
                  <span className="bg-white px-2 py-0.5 rounded border text-[10px] font-mono text-slate-500">{entrySerial || "Pending..."}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs pb-1 border-b">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.branch_label", "Branch")}</span>
                    <select className="border-0 bg-transparent text-right font-bold text-slate-700 p-0 focus:ring-0 cursor-pointer" value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)}>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.base_currency_label", "Base Currency")}</span>
                    <span className="font-bold text-slate-700">{branchCurrency}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs pb-1 border-b">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.user_label", "User")}</span>
                    <span className="font-bold text-slate-700">{sessionInfo?.user?.fullName || "Admin"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b">
                    <span className="text-slate-500 font-medium">{tr("money_exchange.date_label", "Date")}</span>
                    <input type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} className="border-0 bg-transparent text-right font-bold text-slate-700 p-0 h-4 focus:ring-0 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-t-4 border-t-amber-400">
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs uppercase font-bold text-slate-600 flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> {tr("money_exchange.section2_title", "2. Exchange Entry (Simple Formula)")}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">

                <div className="flex gap-4 items-end">
                  <div className="w-48 space-y-1">
                    <Label className="text-xs font-bold text-slate-600">{tr("money_exchange.transaction_type_label", "Transaction Type")}</Label>
                    <select className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-bold" value={transactionType} onChange={e=>setTransactionType(e.target.value as any)}>
                      <option value="Purchase">Purchase</option>
                      <option value="Sale">Sale</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px]">{tr("money_exchange.qty_cur_label", "Qty Cur.")}</Label>
                    <select className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={qtyCurrency} onChange={e=>setQtyCurrency(e.target.value)}>
                      <option value="">--</option>
                      <option value="AED">AED</option>
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="AFN">AFN</option>
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px]">{tr("money_exchange.ex_cur_label", "Ex. Cur.")}</Label>
                    <select className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={exCurrency} onChange={e=>setExCurrency(e.target.value)}>
                      <option value="">--</option>
                      <option value="AED">AED</option>
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="AFN">AFN</option>
                    </select>
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-[10px]">{tr("money_exchange.op_label", "Op")}</Label>
                    <select className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={operation} onChange={e=>setOperation(e.target.value as any)}>
                      <option value="multiply">×</option>
                      <option value="divide">÷</option>
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px]">{tr("money_exchange.rate_label", "Rate")}</Label>
                    <Input type="number" step="0.000001" className="h-7 text-xs px-2" value={rate} onChange={e=>setRate(e.target.value ? Number(e.target.value) : "")} />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px]">{tr("money_exchange.quantity_label", "Quantity")}</Label>
                    <Input type="number" step="0.01" className="h-7 text-xs px-2" value={quantity} onChange={e=>setQuantity(e.target.value ? Number(e.target.value) : "")} />
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-[10px] font-bold text-indigo-600">{tr("money_exchange.final_amount_label", "Final Amount")}</Label>
                    <Input readOnly value={finalAmount > 0 ? finalAmount.toFixed(2) : ""} className="h-7 text-xs font-mono font-bold bg-slate-50" />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t mt-3">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase">{tr("money_exchange.received_details_title", "Received Details")}</h4>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.recv_type_label", "Recv. Type")}</Label>
                      <select className="flex h-7 w-full rounded border border-input bg-background px-1.5 text-xs" value={receivedType} onChange={e=>setReceivedType(e.target.value)}>
                        <option value="Name">Name</option>
                        <option value="Agent">Agent</option>
                        <option value="Bank">Bank</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.name_label", "Name")}</Label>
                      <Input className="h-7 text-xs px-1.5" value={receiptName} onChange={e=>setReceiptName(e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.mobile_whatsapp_label", "Mobile/WhatsApp")}</Label>
                      <Input className="h-7 text-xs px-1.5" value={mobile} onChange={e=>setMobile(e.target.value)} />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.details_label", "Details")}</Label>
                      <Input className="h-7 text-xs px-1.5" value={details} onChange={e=>setDetails(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.purchase_country_label", "Purchase Country")}</Label>
                      <select className="flex h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                        value={purchaseCountryId}
                        onChange={e => {
                          setPurchaseCountryId(e.target.value);
                          if(e.target.value) {
                            const opt = e.target.options[e.target.selectedIndex];
                            setPurchaseCountry(opt.text);
                          } else {
                            setPurchaseCountry("");
                          }
                          setPurchaseCity(""); // reset
                        }}>
                        <option value="">--</option>
                        {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.purchase_city_label", "Purchase City")}</Label>
                      <Input className="h-7 text-xs px-1.5" placeholder={tr("money_exchange.type_city_placeholder", "Type city...")} value={purchaseCity} onChange={e=>setPurchaseCity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.purchased_from_label", "Purchased From")}</Label>
                      <Input className="h-7 text-xs px-1.5" value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.recv_country_label", "Recv. Country")}</Label>
                      <select className="flex h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                        value={receivedCountryId}
                        onChange={e => {
                          setReceivedCountryId(e.target.value);
                          if(e.target.value) {
                            const opt = e.target.options[e.target.selectedIndex];
                            setReceivedCountry(opt.text);
                          } else {
                            setReceivedCountry("");
                          }
                          setReceivedCity(""); // reset
                        }}>
                        <option value="">--</option>
                        {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.recv_city_label", "Recv. City")}</Label>
                      <Input className="h-7 text-xs px-1.5" placeholder={tr("money_exchange.type_city_placeholder", "Type city...")} value={receivedCity} onChange={e=>setReceivedCity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.recv_office_name_label", "Recv. Office Name")}</Label>
                      <Input className="h-7 text-xs px-1.5" value={receivedOfficeName} onChange={e=>setReceivedOfficeName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase">{tr("money_exchange.office_number_label", "Office Number")}</Label>
                      <div className="flex gap-1">
                        <select className="w-1/3 h-7 text-[10px] rounded border bg-background px-1" value={receivedOfficeNumberType} onChange={e=>setReceivedOfficeNumberType(e.target.value)}>
                          <option value="Mobile">Mobile</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Office 1">Office 1</option>
                          <option value="Office 2">Office 2</option>
                        </select>
                        <Input className="flex-1 h-7 text-xs px-1.5" placeholder={tr("money_exchange.number_placeholder", "Number...")} value={receivedOfficeNumberValue} onChange={e=>setReceivedOfficeNumberValue(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
              <div className="p-3 bg-slate-50 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={()=> { /* Could reset form */ }} disabled={saving}>{tr("money_exchange.clear_button", "Clear")}</Button>
                <Button type="submit" size="sm" disabled={saving} className="font-bold px-6 shadow-md">
                  {saving ? tr("money_exchange.saving_label", "Saving...") : tr("money_exchange.save_button", "Save Exchange Entry")}
                </Button>
              </div>
            </Card>
          </form>
        </div>

        {/* RIGHT REPORT/TABLE */}
        <div className="lg:col-span-5">
          <Card className="shadow-sm overflow-hidden sticky top-6">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b space-y-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>{tr("money_exchange.exchange_report_title", "Exchange Report")}</span>
                <span className="text-xs font-normal text-slate-500">{tr("money_exchange.recent_entries_label", "Recent entries")}</span>
              </CardTitle>
              <div className="flex gap-2">
                <Input placeholder={tr("money_exchange.search_qty_cur_placeholder", "Search Qty Cur...")} className="h-7 text-[11px] w-full" value={searchQtyCur} onChange={e=>setSearchQtyCur(e.target.value)} />
                <Input placeholder={tr("money_exchange.search_ex_cur_placeholder", "Search Ex Cur...")} className="h-7 text-[11px] w-full" value={searchExCur} onChange={e=>setSearchExCur(e.target.value)} />
              </div>
            </CardHeader>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-100 text-[10px] uppercase text-slate-500 sticky top-0 z-10">
                  <tr>
                    <Th className="px-2 py-2 font-semibold">{tr("money_exchange.type_date_header", "Type/Date")}</Th>
                    <Th className="px-2 py-2 font-semibold">{tr("money_exchange.currencies_header", "Currencies")}</Th>
                    <Th className="px-2 py-2 font-semibold text-right">{tr("money_exchange.final_header", "Final")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {loadingBills ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                  ) : filteredBills.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500">{tr("money_exchange.no_entries_found", "No recent entries found.")}</td></tr>
                  ) : (
                    filteredBills.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-2 py-2">
                          <div className={`inline-block px-1 rounded-[3px] text-[9px] font-bold mb-0.5 ${b.transaction_type === 'Purchase' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {b.transaction_type.toUpperCase()}
                          </div>
                          <div className="text-slate-500 text-[10px]">{b.entry_date}</div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-semibold text-slate-700">{b.qty_currency} &rarr; {b.ex_currency}</div>
                          <div className="text-[10px] text-slate-500">{tr("money_exchange.rate_label_short", "Rate")}: {b.rate} | {tr("money_exchange.qty_label_short", "Qty")}: {b.quantity}</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="font-bold text-slate-800 text-xs">{b.final_amount.toFixed(2)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
