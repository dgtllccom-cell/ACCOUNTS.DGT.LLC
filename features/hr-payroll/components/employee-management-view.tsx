"use client";

import { useEffect, useState } from "react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { EmployeeForm } from "./employee-form";
import { AdvanceLoanModal } from "./advance-loan-modal";
import { EmployeeLedgerPanel } from "./employee-ledger-panel";
import { PayrollReportsView } from "./payroll-reports-view";

export function EmployeeManagementView() {
  const [activeTab, setActiveTab] = useState<"master" | "payroll">("master");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState<any | null>(null);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<any | null>(null);

  async function loadEmployees() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (category) qp.set("category", category);
      if (status) qp.set("status", status);

      const res = await apiGet<{ employees: any[] }>(`/api/erp/hr-payroll/employees?${qp.toString()}`);
      setEmployees(res.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "master") {
      loadEmployees().catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search, category, status]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this employee record?")) return;
    try {
      await apiDelete(`/api/erp/hr-payroll/employees/${id}`);
      loadEmployees().catch(() => null);
    } catch (err: any) {
      alert("Error deleting employee: " + err.message);
    }
  }

  return (
    <div className="space-y-6 min-h-screen pb-16">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl border border-slate-800 p-6 md:p-8 shadow-md">
        <div className="relative z-10 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">Master Setup — Employee Management</h2>
            <p className="text-slate-300 text-xs md:text-sm font-medium max-w-xl">
              Register employees, structure categories (Manager, Staff, Employee, Other), define currency allowances, and map accounts with General Ledger (GL) integrations.
            </p>
          </div>
          {activeTab === "master" && (
            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setShowFormModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm px-6 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2"
            >
              <span className="text-lg font-black">+</span> Register New Employee
            </Button>
          )}
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Mode Tabs Switcher */}
      <div className="flex border border-slate-200 dark:border-slate-800 gap-1 p-1 bg-slate-100 dark:bg-slate-950 max-w-md rounded-2xl">
        <button
          onClick={() => setActiveTab("master")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "master"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Employees Master Setup
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "payroll"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Payroll Register & Reports
        </button>
      </div>

      {activeTab === "master" ? (
        <div className="space-y-6">
          
          {/* Filters Row */}
          <div className="bg-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center shadow-sm">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Employee Code, Person Name, Passport..."
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <div className="w-[180px]">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="">All Categories</option>
                <option value="Manager">Manager</option>
                <option value="Normal Staff">Normal Staff</option>
                <option value="Employee">Employee</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="w-[150px]">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Master Employee Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm">
            <table className="min-w-full text-xs text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Emp Code</th>
                  <th className="px-6 py-3.5">Employee / Person Name</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Designation / Department</th>
                  <th className="px-6 py-3.5">Joining Date</th>
                  <th className="px-6 py-3.5">Net Payroll</th>
                  <th className="px-6 py-3.5">Deductions (Adv/Loan)</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-medium">Loading registered employees...</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">No employees registered yet. Click "Register New Employee" to register.</td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">{emp.employee_code}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{emp.person?.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{emp.person?.mobile || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded font-semibold text-[10px] uppercase">
                          {emp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{emp.designation || "-"}</div>
                        <div className="text-[11px] text-slate-500">{emp.department || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{emp.joining_date || "-"}</td>
                      <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {emp.net_salary?.toLocaleString()} {emp.salary_currency}
                      </td>
                      <td className="px-6 py-4 text-red-600 dark:text-red-400 font-semibold font-mono">
                        -{((emp.advance_deduction || 0) + (emp.loan_deduction || 0))?.toLocaleString()} /mo
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.status === "Active" 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" 
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setShowFormModal(true);
                          }}
                          className="h-7 text-xs px-2.5"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEmployeeForLoan(emp)}
                          className="h-7 text-xs px-2.5"
                        >
                          Loan/Adv
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEmployeeForHistory(emp)}
                          className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400"
                        >
                          Ledger
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(emp.id)}
                          className="h-7 text-xs px-2.5 text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PayrollReportsView />
      )}

      {/* Forms Modal */}
      {showFormModal && (
        <SimpleModal
          title={selectedEmployeeId ? "Edit Employee Profile Setup" : "Register New Employee Profile"}
          onClose={() => setShowFormModal(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeForm
            employeeId={selectedEmployeeId}
            onSave={() => {
              setShowFormModal(false);
              loadEmployees().catch(() => null);
            }}
            onCancel={() => setShowFormModal(false)}
          />
        </SimpleModal>
      )}

      {/* Loan/Advance Modal */}
      {selectedEmployeeForLoan && (
        <SimpleModal
          title="Issue Salary Advance / Loan"
          onClose={() => setSelectedEmployeeForLoan(null)}
          className="max-w-3xl w-[95vw]"
        >
          <AdvanceLoanModal
            employee={selectedEmployeeForLoan}
            onClose={() => setSelectedEmployeeForLoan(null)}
            onSuccess={() => {
              setSelectedEmployeeForLoan(null);
              loadEmployees().catch(() => null);
            }}
          />
        </SimpleModal>
      )}

      {/* History Ledger Modal */}
      {selectedEmployeeForHistory && (
        <SimpleModal
          title={`Employee Statement Recovery History — ${selectedEmployeeForHistory?.person?.customer_name}`}
          onClose={() => setSelectedEmployeeForHistory(null)}
          className="max-w-5xl w-[95vw]"
        >
          <EmployeeLedgerPanel
            employee={selectedEmployeeForHistory}
            onClose={() => setSelectedEmployeeForHistory(null)}
          />
        </SimpleModal>
      )}
    </div>
  );
}
