"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

type SalaryTransferModalProps = {
  dueRecord: any;
  onClose: () => void;
  onSuccess: () => void;
};

type LedgerOption = {
  id: string;
  name: string;
  code: string;
  currency: string;
};

export function SalaryTransferModal({ dueRecord, onClose, onSuccess }: SalaryTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  
  const [paymentLedgerId, setPaymentLedgerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const emp = dueRecord?.employee;
  const personName = emp?.person?.customer_name || "";
  const netSalary = Number(dueRecord?.net_salary || 0);

  // Load cash/bank ledgers
  useEffect(() => {
    async function loadLedgers() {
      try {
        const res = await apiGet<{ ledgers: any[] }>("/api/erp/ledgers");
        const activeLedgers = res.ledgers || [];
        setLedgers(activeLedgers);
        
        // Auto select cash or bank ledger from employee setup if available
        if (emp?.cash_account_id) {
          setPaymentLedgerId(emp.cash_account_id);
        } else if (emp?.bank_account_id) {
          setPaymentLedgerId(emp.bank_account_id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadLedgers();
  }, [emp]);

  // Load exchange rate based on paymentDate
  useEffect(() => {
    if (!dueRecord?.currency || dueRecord.currency === "USD") {
      setExchangeRate(1);
      return;
    }
    async function loadRate() {
      try {
        // Query daily USD rates endpoint or fallback
        const res = await apiGet<any>(`/api/erp/roznamcha?countryId=${dueRecord.country_id}&entryDate=${paymentDate}`);
        if (res.usdRate) {
          setExchangeRate(res.usdRate);
        }
      } catch {
        // Fallback
      }
    }
    loadRate();
  }, [paymentDate, dueRecord]);

  async function handleTransfer() {
    if (!paymentLedgerId) {
      setError("Please select a Cash/Bank payment account.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await apiPost<any>("/api/erp/hr-payroll/salaries-due/transfer", {
        dueRecordId: dueRecord.id,
        paymentLedgerId,
        paymentDate,
        exchangeRate,
        remarks
      });

      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during transfer.");
    } finally {
      setLoading(false);
    }
  }

  const convertedAmount = Math.round(netSalary * exchangeRate * 100) / 100;

  return (
    <div className="space-y-6 text-slate-100 p-2">
      {error && (
        <div className="bg-red-950/60 border border-red-900 text-red-200 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Summary Matrix */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-start border-b border-slate-900 pb-3">
          <div>
            <h4 className="text-lg font-black text-white">{personName}</h4>
            <span className="text-xs text-slate-400 font-semibold uppercase">{emp?.designation} • Code: {emp?.employee_code}</span>
          </div>
          <span className="px-3 py-1 bg-indigo-950 border border-indigo-900 rounded-lg text-indigo-400 text-xs font-bold uppercase">
            Month: {dueRecord?.salary_month}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Basic Rate:</span>
            <span className="font-semibold">{dueRecord?.basic_salary?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Allowances:</span>
            <span className="font-semibold text-emerald-400">+{dueRecord?.allowances?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Overtime:</span>
            <span className="font-semibold text-emerald-400">+{dueRecord?.overtime?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
          <div className="flex justify-between border-t border-slate-900 pt-2">
            <span className="text-slate-400">Deductions (Tax/Gen):</span>
            <span className="font-semibold text-red-400">-{dueRecord?.deductions?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Advance Recovery:</span>
            <span className="font-semibold text-red-400">-{dueRecord?.advance_recovery?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Loan Recovery:</span>
            <span className="font-semibold text-red-400">-{dueRecord?.loan_recovery?.toLocaleString()} {dueRecord?.currency}</span>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4 flex justify-between items-baseline">
          <span className="text-base font-bold text-white">Net Payable Salary:</span>
          <span className="text-2xl font-black text-emerald-400">{netSalary?.toLocaleString()} {dueRecord?.currency}</span>
        </div>
      </div>

      {/* Form Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Account (Cash/Bank)</label>
          <select
            value={paymentLedgerId}
            onChange={(e) => setPaymentLedgerId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select Cash/Bank Ledger</option>
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.currency})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Currency Conversion Detail */}
      {dueRecord?.currency !== "USD" && (
        <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Exchange Rate (USD to {dueRecord?.currency})</label>
            <input
              type="number"
              step="any"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Converted Payable Amount</label>
            <div className="text-base font-black text-white pt-1.5">
              {convertedAmount.toLocaleString()} {dueRecord?.currency}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Remarks / Transfer Memo</label>
        <textarea
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Bank transfer reference ID..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          className="bg-transparent border-slate-800 text-slate-400 hover:bg-slate-950"
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={loading}
          onClick={handleTransfer}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6"
        >
          {loading ? "Posting..." : "Confirm & Transfer Salary"}
        </Button>
      </div>

    </div>
  );
}
