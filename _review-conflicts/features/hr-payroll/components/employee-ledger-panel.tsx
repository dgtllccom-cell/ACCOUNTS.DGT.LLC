"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";

type EmployeeLedgerPanelProps = {
  employeeId: string;
};

export function EmployeeLedgerPanel({ employeeId }: EmployeeLedgerPanelProps) {
  const [loading, setLoading] = useState(false);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    if (!employeeId) return;

    async function loadLedgerData() {
      setLoading(true);
      try {
        const salariesRes = await apiGet<{ records: any[] }>(`/api/erp/hr-payroll/salaries-due?employeeId=${employeeId}`);
        setSalaries(salariesRes.records || []);

        const loansRes = await apiGet<{ records: any[] }>(`/api/erp/hr-payroll/advances-loans?employeeId=${employeeId}`);
        setLoans(loansRes.records || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLedgerData();
  }, [employeeId]);

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading payroll history...</div>;
  }

  return (
    <div className="space-y-8">
      
      {/* Table 1: Salary History */}
      <div>
        <h4 className="text-base font-bold text-white mb-3">Salary History & Payment Registry</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="min-w-full text-sm text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-3">Month</th>
                <th className="px-6 py-3">Basic</th>
                <th className="px-6 py-3">Allowances</th>
                <th className="px-6 py-3">Recoveries (Adv/Loan)</th>
                <th className="px-6 py-3">Net Paid</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Payment Date</th>
                <th className="px-6 py-3">Roznamcha Serials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">No salary records generated.</td>
                </tr>
              ) : (
                salaries.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-white">{s.salary_month}</td>
                    <td className="px-6 py-4">{s.basic_salary?.toLocaleString()} {s.currency}</td>
                    <td className="px-6 py-4">+{s.allowances?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-red-400">-{((s.advance_recovery || 0) + (s.loan_recovery || 0))?.toLocaleString()}</td>
                    <td className="px-6 py-4 font-black text-emerald-400">{s.net_salary?.toLocaleString()} {s.currency}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        s.status === "Paid" 
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                          : "bg-amber-950 text-amber-400 border border-amber-900"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-450">{s.paid_date || "-"}</td>
                    <td className="px-6 py-4 text-xs font-mono text-indigo-400">
                      <div>Accrual: {s.journal_entry_id ? "✅ Posted" : "-"}</div>
                      <div>Payment: {s.payment_journal_entry_id ? "✅ Transferred" : "-"}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Advances & Loans */}
      <div>
        <h4 className="text-base font-bold text-white mb-3">Salary Advances & Loans Recovery Ledger</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="min-w-full text-sm text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Date Issued</th>
                <th className="px-6 py-3">Principal Amount</th>
                <th className="px-6 py-3">Monthly Deduction</th>
                <th className="px-6 py-3">Remaining Balance</th>
                <th className="px-6 py-3">Start Month</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Ledger Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">No active advances or loans recorded.</td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-white">{l.type}</td>
                    <td className="px-6 py-4 text-slate-400">{l.payment_date}</td>
                    <td className="px-6 py-4 font-semibold">{l.amount?.toLocaleString()} {l.currency}</td>
                    <td className="px-6 py-4 text-red-400">-{l.monthly_deduction?.toLocaleString()} /mo</td>
                    <td className="px-6 py-4 font-black text-indigo-400">{l.remaining_balance?.toLocaleString()} {l.currency}</td>
                    <td className="px-6 py-4">{l.start_month || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        l.status === "Active" 
                          ? "bg-indigo-950 text-indigo-400 border border-indigo-900" 
                          : "bg-slate-900 text-slate-500 border border-slate-800"
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{l.payment_ledger?.code || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
