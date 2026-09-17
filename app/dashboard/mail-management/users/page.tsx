"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Database,
  Edit2,
  HardDrive,
  KeyRound,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { DashboardFrame } from "@/components/layout/dashboard-frame";

interface MailUser {
  id: string;
  username: string;
  domain: string;
  email_address: string;
  display_name: string;
  recovery_email: string | null;
  phone_number: string | null;
  plan_name: string;
  quota_bytes: number;
  used_bytes: number;
  usage_percent: number;
  status: "active" | "suspended" | "pending_verification";
  storage_warning_level: number;
  created_at: string;
  last_login_at: string | null;
}

export default function DgtMailUsersDirectoryPage() {
  const [users, setUsers] = useState<MailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Edit Quota Modal
  const [editingUser, setEditingUser] = useState<MailUser | null>(null);
  const [newQuotaGB, setNewQuotaGB] = useState<string>("1.0");

  // Password Reset Modal
  const [resettingUser, setResettingUser] = useState<MailUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/mail-management/users?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, statusFilter]);

  const handleUpdateQuota = async () => {
    if (!editingUser) return;
    setActionLoading(true);
    try {
      const quotaBytes = Math.round(parseFloat(newQuotaGB) * 1024 * 1024 * 1024);
      const res = await fetch(`/api/erp/mail-management/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quota_bytes: quotaBytes }),
      });
      if (res.ok) {
        setFeedbackMessage(`Updated storage quota for ${editingUser.email_address}`);
        setEditingUser(null);
        fetchUsers();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: MailUser) => {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    if (!confirm(`Are you sure you want to change status of ${user.email_address} to ${nextStatus.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/erp/mail-management/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setFeedbackMessage(`User status changed to ${nextStatus}`);
        fetchUsers();
      }
    } catch {
      // Ignored
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUser || newPassword.length < 6) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/erp/mail-management/users/${resettingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (res.ok) {
        setFeedbackMessage(`Password reset successfully for ${resettingUser.email_address}`);
        setResettingUser(null);
        setNewPassword("");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: MailUser) => {
    if (!confirm(`CRITICAL: Are you sure you want to permanently delete mailbox ${user.email_address}? All emails and attachments will be deleted.`)) return;

    try {
      const res = await fetch(`/api/erp/mail-management/users/${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedbackMessage(`Deleted user ${user.email_address}`);
        fetchUsers();
      }
    } catch {
      // Ignored
    }
  };

  return (
    <DashboardFrame>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/mail-management"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                DGT Mail Users Directory
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage all registered public mailboxes, storage limits, passwords, and account status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/mail/register"
              target="_blank"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Mailbox</span>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{feedbackMessage}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user by username, email, or display name..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">User & Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Storage Used / Quota</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No mail users found matching your query
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const usedMB = (u.used_bytes / (1024 * 1024)).toFixed(1);
                    const quotaGB = (u.quota_bytes / (1024 * 1024 * 1024)).toFixed(1);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {u.display_name[0]?.toUpperCase() || u.username[0]?.toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {u.display_name}
                              </span>
                              <span className="text-slate-500 font-mono text-[11px] block">
                                {u.email_address}
                              </span>
                              {u.recovery_email && (
                                <span className="text-slate-400 text-[10px] block">
                                  Recovery: {u.recovery_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {u.status === "active" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                              <ShieldCheck className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-800">
                              <ShieldAlert className="h-3 w-3" />
                              Suspended
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                          {u.plan_name || "Free Starter"}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-500">{usedMB} MB</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{quotaGB} GB</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  u.usage_percent >= 90
                                    ? "bg-rose-500"
                                    : u.usage_percent >= 80
                                    ? "bg-amber-500"
                                    : "bg-blue-600"
                                }`}
                                style={{ width: `${u.usage_percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Quota */}
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setNewQuotaGB((u.quota_bytes / (1024 * 1024 * 1024)).toString());
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                              title="Modify Storage Quota"
                            >
                              <HardDrive className="h-3.5 w-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => setResettingUser(u)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 hover:text-amber-600 transition-colors"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>

                            {/* Suspend / Activate */}
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors ${
                                u.status === "active" ? "hover:text-rose-600" : "hover:text-emerald-600"
                              }`}
                              title={u.status === "active" ? "Suspend Mailbox" : "Activate Mailbox"}
                            >
                              {u.status === "active" ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete Mailbox"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Quota Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <HardDrive className="h-4 w-4 text-blue-600" />
                  <span>Modify User Storage Quota</span>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  Assign custom storage limit for <strong>{editingUser.email_address}</strong>:
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Limit (Gigabytes):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="1000"
                    value={newQuotaGB}
                    onChange={(e) => setNewQuotaGB(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex gap-2">
                  {[1.0, 5.0, 10.0, 25.0, 50.0].map((gb) => (
                    <button
                      key={gb}
                      type="button"
                      onClick={() => setNewQuotaGB(gb.toString())}
                      className="flex-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold hover:bg-blue-50 hover:text-blue-600"
                    >
                      {gb} GB
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleUpdateQuota}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow"
                >
                  {actionLoading ? "Updating..." : "Save Quota"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resettingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  <span>Admin Password Reset</span>
                </div>
                <button onClick={() => setResettingUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  Set a new secure password for <strong>{resettingUser.email_address}</strong>:
                </p>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password:
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setResettingUser(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading || newPassword.length < 6}
                  onClick={handleResetPassword}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 shadow disabled:opacity-50"
                >
                  {actionLoading ? "Resetting..." : "Apply New Password"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardFrame>
  );
}
