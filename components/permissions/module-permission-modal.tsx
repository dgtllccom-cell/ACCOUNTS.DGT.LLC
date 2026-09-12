"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Edit3,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  Loader2,
  Lock,
  Globe,
  Building2,
  Save
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export interface ModulePermissionModalProps {
  initialModuleKey?: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface UserAccessRow {
  userId: string;
  userCode: string;
  fullName: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  countryName: string;
  branchName: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ModuleSpec {
  key: string;
  name: string;
  category: string;
  editPerms: string[];
  deletePerms: string[];
  viewPerms: string[];
}

export function ModulePermissionModal({
  initialModuleKey = "purchase_booking",
  onClose,
  onSaved
}: ModulePermissionModalProps) {
  const lang = useActiveLanguage() || "en";
  const [moduleKey, setModuleKey] = useState<string>(initialModuleKey);
  const [moduleSpec, setModuleSpec] = useState<ModuleSpec | null>(null);
  const [modulesList, setModulesList] = useState<Array<{ key: string; name: string; category: string }>>([]);
  const [users, setUsers] = useState<UserAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load module access data
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/erp/permissions/module-access?moduleKey=${encodeURIComponent(moduleKey)}`);
        const json = await res.json();
        if (!cancelled && res.ok && json.data) {
          setModuleSpec(json.data.module);
          setModulesList(json.data.modulesList || []);
          setUsers(json.data.users || []);
        }
      } catch (err: any) {
        if (!cancelled) setMessage({ type: "error", text: err?.message || "Failed to load permissions" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.userCode.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.countryName.toLowerCase().includes(q) ||
        u.branchName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const toggleEdit = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.userId === userId && !u.isSuperAdmin ? { ...u, canEdit: !u.canEdit } : u))
    );
  };

  const toggleDelete = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.userId === userId && !u.isSuperAdmin ? { ...u, canDelete: !u.canDelete } : u))
    );
  };

  const handleBulkEdit = (grant: boolean) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.isSuperAdmin) return u;
        const matchesFilter = filteredUsers.some((fu) => fu.userId === u.userId);
        return matchesFilter ? { ...u, canEdit: grant } : u;
      })
    );
  };

  const handleBulkDelete = (grant: boolean) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.isSuperAdmin) return u;
        const matchesFilter = filteredUsers.some((fu) => fu.userId === u.userId);
        return matchesFilter ? { ...u, canDelete: grant } : u;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const assignments = users.map((u) => ({
        userId: u.userId,
        canEdit: u.canEdit,
        canDelete: u.canDelete
      }));

      const res = await fetch("/api/erp/permissions/module-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey,
          assignments
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to save permissions.");
      }

      setMessage({
        type: "success",
        text: `Permissions for "${moduleSpec?.name || moduleKey}" updated and synchronized across nodes!`
      });
      if (onSaved) onSaved();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimpleModal
      title="Module Access Control: Who can Edit / Delete"
      onClose={onClose}
      className="max-w-5xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden"
    >
      <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Header Ribbon */}
        <div className="bg-slate-900 text-white p-4 sm:px-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold tracking-tight">
                Permission Allocation: {moduleSpec?.name || "Select Module"}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Super Admin Control: Select which users are permitted to Edit and Delete records in this specific module.
            </p>
          </div>

          {/* Module Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Module:</span>
            <select
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {modulesList.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name} ({m.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3 text-xs font-semibold flex items-center justify-between border-b ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="p-0.5 hover:opacity-75">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Action Controls & Filters */}
        <div className="p-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter users by name, role, country, branch..."
                className="h-8.5 pl-8 text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Bulk Action Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[11px] font-semibold">
              <span className="text-slate-500 px-1 text-[10px] uppercase font-bold">Edit:</span>
              <button
                type="button"
                onClick={() => handleBulkEdit(true)}
                className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500 shadow-2xs font-bold"
              >
                Allow All
              </button>
              <button
                type="button"
                onClick={() => handleBulkEdit(false)}
                className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300"
              >
                Revoke All
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[11px] font-semibold">
              <span className="text-slate-500 px-1 text-[10px] uppercase font-bold">Delete:</span>
              <button
                type="button"
                onClick={() => handleBulkDelete(true)}
                className="px-2 py-0.5 bg-rose-600 text-white rounded hover:bg-rose-500 shadow-2xs font-bold"
              >
                Allow All
              </button>
              <button
                type="button"
                onClick={() => handleBulkDelete(false)}
                className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300"
              >
                Revoke All
              </button>
            </div>
          </div>
        </div>

        {/* User Table Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400 text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span>Loading user permission matrix...</span>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">User & Credentials</th>
                    <th className="p-3">Role / Level</th>
                    <th className="p-3">Country & Branch Scope</th>
                    <th className="p-3 text-center w-36 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300">
                      Who Can Edit?
                    </th>
                    <th className="p-3 text-center w-36 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300">
                      Who Can Delete?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* User Info */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{u.fullName}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {u.userCode} • {u.email || "No email"}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold ${
                            u.isSuperAdmin
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                              : u.role.includes("admin")
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {u.isSuperAdmin && <Shield className="h-3 w-3" />}
                          {u.role.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>

                      {/* Country & Branch Scope */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          <Globe className="h-3 w-3 text-slate-400" />
                          <span>{u.countryName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Building2 className="h-2.5 w-2.5 text-slate-400" />
                          <span>{u.branchName}</span>
                        </div>
                      </td>

                      {/* Who Can Edit? */}
                      <td className="p-3 text-center bg-blue-50/20 dark:bg-blue-950/10">
                        {u.isSuperAdmin ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            Super Admin (Always)
                          </span>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={u.canEdit}
                              onChange={() => toggleEdit(u.userId)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span className={`text-[11px] font-bold ${u.canEdit ? "text-blue-700 dark:text-blue-300" : "text-slate-400"}`}>
                              {u.canEdit ? "Edit Allowed" : "No Edit"}
                            </span>
                          </label>
                        )}
                      </td>

                      {/* Who Can Delete? */}
                      <td className="p-3 text-center bg-rose-50/20 dark:bg-rose-950/10">
                        {u.isSuperAdmin ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            Super Admin (Always)
                          </span>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={u.canDelete}
                              onChange={() => toggleDelete(u.userId)}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                            />
                            <span className={`text-[11px] font-bold ${u.canDelete ? "text-rose-700 dark:text-rose-300" : "text-slate-400"}`}>
                              {u.canDelete ? "Delete Allowed" : "No Delete"}
                            </span>
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                        No users found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500">
            Changes are saved directly to PostgreSQL `user_permission_sets` and take effect on next request.
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Module Permissions</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}
