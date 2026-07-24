"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

type AdvanceLoanModalProps = {
  employee: any;
  onClose: () => void;
  onSuccess: () => void;
};

type LedgerOption = {
  id: string;
  name: string;
  code: string;
  currency: string;
};

export function AdvanceLoanModal({ employee, onClose, onSuccess }: AdvanceLoanModalProps) {
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  
  const [type, setType] = useState("Salary Advance");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [recoveryMethod, setRecoveryMethod] = useState("Monthly Salary Deduction");
  const [monthlyDeduction, setMonthlyDeduction] = useState<number>(0);
  const [startMonth, setStartMonth] = useState("");
  const [remarks, setRemarks] = useState("");
  const [postToRoznamcha, setPostToRoznamcha] = useState(true);
  const [error, setError] = useState("");

  const personName = employee?.person?.customer_name || "";
  const code = employee?.employee_code || "";

  useEffect(() => {
    if (employee?.salary_currency) {
      setCurrency(employee.salary_currency);
    }
  }, [employee]);

  // Load cash/bank ledgers for payment source
  useEffect(() => {
    async function loadLedgers() {
      try {
        const res = await apiGet<{ ledgers: any[] }>("/api/erp/ledgers");
        setLedgers(res.ledgers || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadLedgers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!paymentAccountId) {
      setError("Please select a Cash/Bank payment ledger.");
      return;
    }
    if (!monthlyDeduction || monthlyDeduction <= 0) {
      setError("Please enter a valid monthly deduction rate.");
      return;
    }
    if (!startMonth) {
      setError("Please specify the recovery start month.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiPost<any>("/api/erp/hr-payroll/advances-loans", {
        employeeId: employee.id,
        type,
        amount,
        currency,
        paymentDate,
        paymentAccountId,
        recoveryMethod,
        monthlyDeduction,
        startMonth,
        remarks,
        postToRoznamcha
      });

      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to record advance/loan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-100 p-2">
      {error && (
        <div className="bg-red-950/60 border border-red-900 text-red-200 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex justify-between items-center mb-2">
        <div>
          <span className="text-xs text-slate-400 font-bold block">Employee</span>
          <span className="text-base font-bold text-white">{personName} ({code})</span>
        </div>
        <span className="text-xs text-slate-500 uppercase tracking-widest bg-slate-900 border border-slate-800 px-2 py-1 rounded">
          Target Currency: {currency}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Advance / Loan Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="Salary Advance">Salary Advance</option>
            <option value="Employee Loan">Employee Loan</option>
            <option value="Emergency Advance">Emergency Advance</option>
            <option value="Travel Advance">Travel Advance</option>
            <option value="Other Advance">Other Advance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Principal Amount</label>
          <input
            type="number"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="0.00"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Date Disbursed</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Payment Ledger Source</label>
          <select
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="">Select Cash/Bank Account</option>
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.currency})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Monthly Deduction Rate</label>
          <input
            type="number"
            value={monthlyDeduction || ""}
            onChange={(e) => setMonthlyDeduction(Number(e.target.value))}
            placeholder="e.g. 500"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-350 mb-1.5">Recovery Start Month</label>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-350 mb-1.5">Disbursement Remarks / Notes</label>
        <textarea
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Emergency advance approved by management..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
        />
      </div>

      <div className="flex items-center space-x-3 bg-slate-950 p-3.5 rounded-xl border border-slate-850">
        <input
          id="postToRoznamcha"
          type="checkbox"
          checked={postToRoznamcha}
          onChange={(e) => setPostToRoznamcha(e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-900 rounded focus:ring-indigo-500 focus:ring-2 focus:ring-offset-slate-900"
        />
        <label htmlFor="postToRoznamcha" className="text-sm font-medium text-slate-300 cursor-pointer">
          Automatically post double-entry disbursement to Roznamcha
        </label>
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
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
        >
          {loading ? "Recording..." : "Record Advance/Loan"}
        </Button>
      </div>

    </form>
  );
}
