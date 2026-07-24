"use client";

import { useState, useEffect } from "react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { Loader2, CheckCircle2 } from "lucide-react";
import { date as formatDate, money } from "@/lib/utils/format";

export function PaymentEditModal({
  open,
  onOpenChange,
  payment,
  row,
  session,
  ledgers,
  baseCurrency,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: any;
  row: any;
  session: any;
  ledgers: any[];
  baseCurrency: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  
  // States matching payment data
  const [entryDate, setEntryDate] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<number | string>(1);
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState("");
  const [debitLedgerId, setDebitLedgerId] = useState("");
  const [creditLedgerId, setCreditLedgerId] = useState("");
  const [kind, setKind] = useState("advance");

  // Role based selection for Branches
  const [countryId, setCountryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Derived state
  const isSuperAdmin = session?.roles?.includes("SUPER_ADMIN") || session?.roles?.includes("SYSTEM_ADMIN");
  const isCountryAdmin = session?.roles?.includes("COUNTRY_ADMIN") || session?.roles?.includes("COUNTRY_MANAGER");
  const isBranchAdmin = !isSuperAdmin && !isCountryAdmin;

  useEffect(() => {
    if (open && payment) {
      setEntryDate(payment.entry_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
      setAmount(payment.amount || "");
      setCurrencyCode(payment.currency_code || "USD");
      setExchangeRate(payment.exchange_rate || 1);
      setReferenceNo(payment.reference_no || "");
      setNarration(payment.narration || "");
      setDebitLedgerId(payment.debit_ledger_id || "");
      setCreditLedgerId(payment.credit_ledger_id || "");
      setKind(payment.kind || "advance");
    }
  }, [open, payment]);

  useEffect(() => {
    async function loadData() {
      if (isSuperAdmin) {
        const cRes = await fetch("/api/branch-management/countries");
        if (cRes.ok) {
          const cData = await cRes.json();
          setCountries(cData.countries || []);
        }
      }
      if (isSuperAdmin || isCountryAdmin) {
        const bRes = await fetch("/api/branch-management/city-branches?limit=1000");
        if (bRes.ok) {
          const bData = await bRes.json();
          setBranches(bData.cityBranches || []);
        }
      }
    }
    if (open) loadData();
  }, [open, isSuperAdmin, isCountryAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("Please enter a valid amount");
    if (!debitLedgerId || !creditLedgerId) return alert("Please select both debit and credit ledgers");
    if (debitLedgerId === creditLedgerId) return alert("Debit and Credit ledgers cannot be the same");

    setLoading(true);
    try {
      const response = await fetch(`/api/erp/purchases/orders/${row.id}/payments/${payment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          entryDate,
          amount: Number(amount),
          currencyCode,
          exchangeRate: Number(exchangeRate),
          debitLedgerId,
          creditLedgerId,
          referenceNo,
          narration
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to update payment");
      }

      alert("Payment updated successfully.");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const ledgerOptions = ledgers.map(l => ({
    value: l.id || l.ledgerId,
    label: `${l.code || l.accountCode || l.ledgerCode} - ${l.name || l.accountName || l.ledgerName}`
  }));

  if (!open) return null;

  return (
    <SimpleModal 
      title="Edit Payment Journal Entry" 
      onClose={() => onOpenChange(false)}
      className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
        
        <div className="col-span-2 grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold uppercase text-slate-500">Country</Label>
            {isSuperAdmin ? (
              <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none">
                <option value="">Select Country</option>
                {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <Input value={row?.form_data?.form?.countryName || "Assigned Country"} disabled className="bg-slate-100 font-semibold text-sm h-9" />
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold uppercase text-slate-500">Branch</Label>
            {isSuperAdmin || isCountryAdmin ? (
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none">
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <Input value={row?.form_data?.form?.branchName || "Assigned Branch"} disabled className="bg-slate-100 font-semibold text-sm h-9" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Date <span className="text-red-500">*</span></Label>
          <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required className="h-9 text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Payment Type</Label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} disabled className="h-9 w-full rounded-md border border-input bg-slate-50 px-3 text-sm outline-none">
            <option value="advance">Advance Payment</option>
            <option value="remaining">Remaining / Full Payment</option>
            <option value="credit">Credit / Settlement</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 col-span-2">
          <Label className="text-xs font-bold uppercase text-indigo-600">Debit Ledger (Supplier Payable) <span className="text-red-500">*</span></Label>
          <SearchSelect options={ledgerOptions} value={debitLedgerId} onChange={setDebitLedgerId} placeholder="Search ledger..." />
        </div>

        <div className="flex flex-col gap-1.5 col-span-2">
          <Label className="text-xs font-bold uppercase text-violet-600">Credit Ledger (Payment Source) <span className="text-red-500">*</span></Label>
          <SearchSelect options={ledgerOptions} value={creditLedgerId} onChange={setCreditLedgerId} placeholder="Search ledger..." />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Amount <span className="text-red-500">*</span></Label>
          <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="h-9 text-sm font-bold" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Currency & Rate</Label>
          <div className="flex gap-2">
            <Input value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} className="w-20 font-bold h-9 text-sm" />
            <div className="flex flex-col w-full relative">
               <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="h-9 text-sm font-semibold" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Reference / Cheque No.</Label>
          <Input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Ref / Slip / Chq" className="h-9 text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold uppercase text-slate-500">Remarks / Narration</Label>
          <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Enter details..." className="h-9 text-sm" />
        </div>

        <div className="col-span-2 flex justify-end gap-3 mt-4 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}
