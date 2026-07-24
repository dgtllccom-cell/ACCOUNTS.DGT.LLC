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
    <div className="space-y-6 text-slate-100 min-h-screen pb-16">
      
      {/* Premium Gradient Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-slate-800 p-8 shadow-2xl">
        <div className="relative z-10 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">Master Setup — Employee Management</h2>
            <p className="text-slate-400 text-sm font-medium max-w-xl">
              Register employees, structure categories (Manager, Staff, Employee, Other), define currency allowances, and map accounts with General Ledger (GL) integrations.
            </p>
          </div>
          {activeTab === "master" && (
            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setShowFormModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-indigo-950 transition-all flex items-center gap-2"
            >
              <span className="text-lg font-black">+</span> Register New Employee
            </Button>
          )}
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Mode Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-1 p-1 bg-slate-950/40 max-w-md rounded-2xl border border-slate-850">
        <button
          onClick={() => setActiveTab("master")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "master"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Employees Master Setup
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "payroll"
              ? "bg-slate-900 text-white shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Payroll Register & Reports
        </button>
      </div>

      {activeTab === "master" ? (
        <div className="space-y-6">
          
          {/* Filters Row */}
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Employee Code, Person Name, Passport..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="w-[180px]">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
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
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20">
            <table className="min-w-full text-sm text-left text-slate-350">
              <thead className="bg-slate-950 text-slate-450 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Emp Code</th>
                  <th className="px-6 py-4">Employee / Person Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Designation / Department</th>
                  <th className="px-6 py-4">Joining Date</th>
                  <th className="px-6 py-4">Net Payroll</th>
                  <th className="px-6 py-4">Deductions (Adv/Loan)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">Loading registered employees...</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">No employees registered yet. Click "Register New Employee" to register.</td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/30">
                      <td className="px-6 py-4 font-mono font-bold text-white">{emp.employee_code}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-white">{emp.person?.customer_name}</div>
                        <div className="text-xs text-slate-450">{emp.person?.mobile || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 rounded font-semibold text-xs uppercase">
                          {emp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">{emp.designation || "-"}</div>
                        <div className="text-xs text-slate-500">{emp.department || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{emp.joining_date || "-"}</td>
                      <td className="px-6 py-4 font-black text-indigo-400">
                        {emp.net_salary?.toLocaleString()} {emp.salary_currency}
                      </td>
                      <td className="px-6 py-4 text-red-400 font-semibold">
                        -{((emp.advance_deduction || 0) + (emp.loan_deduction || 0))?.toLocaleString()} /mo
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          emp.status === "Active" 
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                            : "bg-slate-900 text-slate-500 border border-slate-800"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setShowFormModal(true);
                          }}
                          className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-950 text-xs px-2 py-1 h-auto"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedEmployeeForLoan(emp)}
                          className="bg-transparent border-slate-800 text-slate-300 hover:bg-slate-950 text-xs px-2 py-1 h-auto"
                        >
                          Loan/Adv
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedEmployeeForHistory(emp)}
                          className="bg-transparent border-indigo-950 text-indigo-400 hover:bg-slate-950 text-xs px-2 py-1 h-auto"
                        >
                          Ledger
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(emp.id)}
                          className="bg-transparent border-red-950 text-red-500 hover:bg-red-950/20 text-xs px-2 py-1 h-auto"
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
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeLedgerPanel employeeId={selectedEmployeeForHistory.id} />
        </SimpleModal>
      )}

    </div>
  );
}
