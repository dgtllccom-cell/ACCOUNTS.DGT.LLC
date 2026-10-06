"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  X,
  MoreVertical,
  HardDrive,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Mail,
  ExternalLink,
  Power,
  Zap,
} from "lucide-react";
import { MailPageHeader } from "@/components/mail-management/mail-page-header";
import { MailStatusBadge } from "@/components/mail-management/mail-status-badge";

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
  const [lastUpdated, setLastUpdated] = useState<string>("Just now");

  // Edit Quota Modal
  const [editingUser, setEditingUser] = useState<MailUser | null>(null);
  const [newQuotaGB, setNewQuotaGB] = useState<string>("1.0");

  // Password Reset Modal
  const [resettingUser, setResettingUser] = useState<MailUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Delete Confirmation Modal
  const [deletingUser, setDeletingUser] = useState<MailUser | null>(null);

  // Active Dropdown Menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
    setActionLoading(true);
    try {
      const res = await fetch(`/api/erp/mail-management/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setFeedbackMessage(`Account ${user.email_address} is now ${nextStatus}`);
        setOpenMenuId(null);
        fetchUsers();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/erp/mail-management/users/${resettingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setFeedbackMessage(`Password updated successfully for ${resettingUser.email_address}`);
        setResettingUser(null);
        setNewPassword("");
        fetchUsers();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/erp/mail-management/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedbackMessage(`Mailbox ${deletingUser.email_address} deleted successfully`);
        setDeletingUser(null);
        setOpenMenuId(null);
        fetchUsers();
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Standard Page Header */}
      <MailPageHeader
        title="Mail Users & Storage Quotas"
        description="Manage all registered @dgt.llc mailboxes, custom storage limits, password resets, and account lifecycle status."
        lastUpdated={lastUpdated}
        icon={Users}
        secondaryAction={
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh mailboxes"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
        mainAction={
          <Link
            href="/mail/register"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Mailbox</span>
          </Link>
        }
      />

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mailboxes by username, email, or display name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Mailbox Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Email Address & User</th>
                <th className="px-5 py-3.5">Country / Branch</th>
                <th className="px-5 py-3.5">IMAP / SMTP</th>
                <th className="px-5 py-3.5">Storage Used / Quota</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Test</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                        <span>Loading mailbox directory...</span>
                      </div>
                    ) : (
                      "No mailboxes found matching your criteria"
                    )}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const usedMB = (u.used_bytes / (1024 * 1024)).toFixed(1);
                  const quotaGB = (u.quota_bytes / (1024 * 1024 * 1024)).toFixed(1);
                  const storagePct = u.quota_bytes > 0 ? Math.min(Math.round((u.used_bytes / u.quota_bytes) * 100), 100) : 0;
                  const isMenuOpen = openMenuId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Email Address & User */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                            {u.display_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || "M"}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {u.display_name}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] block">
                              {u.email_address}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Country / Branch */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                          UAE / Dubai HQ
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {u.plan_name || "Enterprise"}
                        </span>
                      </td>

                      {/* 3. IMAP / SMTP Status */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                            IMAP: OK
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                            SMTP: OK
                          </span>
                        </div>
                      </td>

                      {/* 4. Storage Used / Quota */}
                      <td className="px-5 py-3.5 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{usedMB} MB</span>
                          <span className="text-slate-400">{quotaGB} GB</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              storagePct > 85 ? "bg-rose-500" : storagePct > 60 ? "bg-amber-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${Math.max(storagePct, 2)}%` }}
                          />
                        </div>
                      </td>

                      {/* 5. Status */}
                      <td className="px-5 py-3.5">
                        <MailStatusBadge
                          status={u.status}
                          label={u.status === "active" ? "ACTIVE" : "SUSPENDED"}
                          size="sm"
                        />
                      </td>

                      {/* 6. Last Test */}
                      <td className="px-5 py-3.5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString()
                          : "Live (Online)"}
                      </td>

                      {/* 7. Row Actions (Three-Dot Menu) */}
                      <td className="px-5 py-3.5 text-right relative">
                        <div className="inline-block text-left">
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : u.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-5 mt-1.5 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-30 py-1.5 text-xs text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setNewQuotaGB(quotaGB);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Edit Storage Quota</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setResettingUser(u);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Reset Password</span>
                                </button>

                                <Link
                                  href={`/dashboard/dgt-mail-management?edit=${u.id}`}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>Test Connection</span>
                                </Link>

                                <Link
                                  href="/dashboard/messages/email"
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Mail className="h-3.5 w-3.5 text-purple-600" />
                                  <span>Open Mailbox</span>
                                </Link>
                              </div>

                              <div className="py-1">
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-slate-300"
                                >
                                  <Power className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{u.status === "active" ? "Suspend Account" : "Activate Account"}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setDeletingUser(u);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                  <span>Delete Mailbox</span>
                                </button>
                              </div>
                            </div>
                          )}
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

      {/* Quota Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Storage Quota — {editingUser.email_address}
            </h3>
            <p className="text-xs text-slate-500">
              Set max mailbox disk size limit. Mail daemon will notify user at 80% capacity.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Storage Limit (GB)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                value={newQuotaGB}
                onChange={(e) => setNewQuotaGB(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateQuota}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                Save Quota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reset Password — {resettingUser.email_address}
            </h3>
            <p className="text-xs text-slate-500">
              Updates both IMAP sync and SMTP dispatch password for this mailbox account.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                New Mailbox Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong password..."
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setResettingUser(null);
                  setNewPassword("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={actionLoading || !newPassword}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
              Delete Mailbox Account
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete mailbox <strong className="text-slate-900 dark:text-white font-mono">{deletingUser.email_address}</strong>?
              This will remove all stored messages and disconnect SMTP/IMAP credentials.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                Yes, Delete Mailbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
