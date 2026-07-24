"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SalaryTransferModal } from "./salary-transfer-modal";

export function PayrollReportsView() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [records, setRecords] = useState<any[]>([]);

  // Filter values
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [countryId, setCountryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");

  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Modal triggers
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Load select filters
  useEffect(() => {
    async function loadFilters() {
      try {
        const countriesRes = await apiGet<{ countries: any[] }>("/api/erp/locations/countries");
        setCountries(countriesRes.countries || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadFilters();
  }, []);

  // Load branches
  useEffect(() => {
    if (!countryId) {
      setBranches([]);
      setBranchId("");
      return;
    }
    async function loadBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { branches: any[] } }>(`/api/erp/locations/branches/main?countryId=${countryId}`);
        if (res.ok && res.data?.branches) {
          setBranches(res.data.branches);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, [countryId]);

  // Load records
  async function loadRecords() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (month) qp.set("month", month);
      if (countryId) qp.set("countryId", countryId);
      if (branchId) qp.set("branchId", branchId);
      if (status) qp.set("status", status);

      const res = await apiGet<{ records: any[] }>(`/api/erp/hr-payroll/salaries-due?${qp.toString()}`);
      setRecords(res.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, countryId, branchId, status]);

  // Generate monthly register
  async function handleGenerateRegister() {
    setGenerating(true);
    try {
      const res = await apiPost<any>("/api/erp/hr-payroll/salaries-due", {
        salaryMonth: month,
        countryId: countryId || null,
        countryBranchId: branchId || null
      });
      alert(res.message || "Salary due register generated.");
      loadRecords().catch(() => null);
    } catch (err: any) {
      alert("Error generating register: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Exports
  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    if (records.length === 0) return;
    const headers = ["Employee Code", "Person Name", "Month", "Basic Salary", "Allowances", "Deductions", "Advance Recovery", "Loan Recovery", "Net Paid", "Status"];
    const rows = records.map((r) => [
      r.employee?.employee_code || "",
      r.employee?.person?.customer_name || "",
      r.salary_month,
      r.basic_salary,
      r.allowances,
      r.deductions,
      r.advance_recovery,
      r.loan_recovery,
      r.net_salary,
      r.status
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payroll_register_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Compute aggregated totals
  const totalBasic = records.reduce((sum, r) => sum + Number(r.basic_salary || 0), 0);
  const totalAllowances = records.reduce((sum, r) => sum + Number(r.allowances || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + Number(r.deductions || 0) + Number(r.advance_recovery || 0) + Number(r.loan_recovery || 0), 0);
  const totalNet = records.reduce((sum, r) => sum + Number(r.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Filters header bar */}
      <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Payroll Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Country Scope</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Branch Scope</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!countryId}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Payment Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Due">Due</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            onClick={handleGenerateRegister}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            {generating ? "Generating..." : "🔄 Generate Due Register"}
          </Button>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="bg-transparent border-slate-800 text-slate-350 hover:bg-slate-950 text-sm px-4"
          >
            Print
          </Button>

          <Button
            onClick={handleExportCsv}
            disabled={records.length === 0}
            variant="outline"
            className="bg-transparent border-slate-800 text-slate-350 hover:bg-slate-950 text-sm px-4"
          >
            Excel CSV
          </Button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Basic payroll</span>
          <span className="text-lg font-black text-white">{totalBasic.toLocaleString()} USD</span>
        </div>
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Total allowances</span>
          <span className="text-lg font-black text-emerald-400">+{totalAllowances.toLocaleString()} USD</span>
        </div>
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider mb-1">Recoveries & Deds</span>
          <span className="text-lg font-black text-red-400">-{totalDeductions.toLocaleString()} USD</span>
        </div>
        <div className="bg-slate-950 border border-indigo-950 p-4 rounded-xl bg-indigo-950/20">
          <span className="text-xs text-indigo-400 font-bold block uppercase tracking-wider mb-1">Net payable payroll</span>
          <span className="text-lg font-black text-white">{totalNet.toLocaleString()} USD</span>
        </div>
      </div>

      {/* Register List */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20">
        <table className="min-w-full text-sm text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-450 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Employee Code</th>
              <th className="px-6 py-4">Name / Designation</th>
              <th className="px-6 py-4">Month</th>
              <th className="px-6 py-4">Basic</th>
              <th className="px-6 py-4">Allowances</th>
              <th className="px-6 py-4">Recoveries (Adv/Loan)</th>
              <th className="px-6 py-4">General Deductions</th>
              <th className="px-6 py-4">Net Payroll</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium">Loading register details...</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-500">No records found. Click "Generate Due Register" to accrue this month's register.</td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/30">
                  <td className="px-6 py-4 font-mono font-bold text-white">{r.employee?.employee_code}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{r.employee?.person?.customer_name}</div>
                    <div className="text-xs text-slate-450">{r.employee?.designation} • {r.employee?.category}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{r.salary_month}</td>
                  <td className="px-6 py-4">{r.basic_salary?.toLocaleString()} {r.currency}</td>
                  <td className="px-6 py-4 text-emerald-400">+{r.allowances?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-red-400">-{((r.advance_recovery || 0) + (r.loan_recovery || 0))?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-red-400">-{r.deductions?.toLocaleString()}</td>
                  <td className="px-6 py-4 font-black text-white">{r.net_salary?.toLocaleString()} {r.currency}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      r.status === "Paid" 
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                        : "bg-amber-950 text-amber-400 border border-amber-900"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {r.status === "Due" ? (
                      <Button
                        onClick={() => setSelectedRecord(r)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg"
                      >
                        Transfer Salary
                      </Button>
                    ) : (
                      <span className="text-slate-500 text-xs font-medium">✓ Transferred</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Salary Transfer Modal */}
      {selectedRecord && (
        <SimpleModal
          title="Confirm Salary Transfer & GL Postings"
          onClose={() => setSelectedRecord(null)}
          className="max-w-2xl w-[95vw]"
        >
          <SalaryTransferModal
            dueRecord={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onSuccess={() => {
              setSelectedRecord(null);
              loadRecords().catch(() => null);
            }}
          />
        </SimpleModal>
      )}

    </div>
  );
}
