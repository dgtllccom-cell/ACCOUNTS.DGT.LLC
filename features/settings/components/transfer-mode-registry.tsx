"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Loader2, PencilLine, Trash2, ArrowLeftRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import {
  listTransferModes,
  createTransferMode,
  updateTransferMode,
  deleteTransferMode,
  type TransferMode,
} from "@/features/settings/transfer-mode-api";

export function TransferModeRegistry() {
  const lang = useActiveLanguage();
  const [modes, setModes] = useState<TransferMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal states for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<TransferMode | null>(null);
  const [formName, setFormName] = useState("");
  const [formRefLabel, setFormRefLabel] = useState("Transaction Reference");
  const [formPlaceholder, setFormPlaceholder] = useState("Reference / number");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await listTransferModes({ includeInactive: true });
      setModes(data);
    } catch (err) {
      console.error("Failed to load transfer modes:", err);
      setModes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingMode(null);
    setFormName("");
    setFormRefLabel("Transaction Reference");
    setFormPlaceholder("Reference / number");
    setFormSortOrder(modes.length + 1);
    setFormActive(true);
    setModalOpen(true);
  };

  const openEditModal = (mode: TransferMode) => {
    setEditingMode(mode);
    setFormName(mode.name);
    setFormRefLabel(mode.reference_label || "Transaction Reference");
    setFormPlaceholder(mode.reference_placeholder || "Reference / number");
    setFormSortOrder(mode.sort_order || 0);
    setFormActive(mode.is_active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) return;

    setSaving(true);
    try {
      if (editingMode) {
        await updateTransferMode(editingMode.id, {
          name: cleanName,
          referenceLabel: formRefLabel.trim() || "Transaction Reference",
          referencePlaceholder: formPlaceholder.trim() || "Reference / number",
          sortOrder: Number(formSortOrder) || 0,
          isActive: formActive,
        });
      } else {
        await createTransferMode({
          name: cleanName,
          referenceLabel: formRefLabel.trim() || "Transaction Reference",
          referencePlaceholder: formPlaceholder.trim() || "Reference / number",
          sortOrder: Number(formSortOrder) || 0,
          isActive: formActive,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this transfer mode?")) return;
    setDeletingId(id);
    try {
      await deleteTransferMode(id);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return modes.filter((m) => {
      const matchQ = !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && m.is_active) ||
        (statusFilter === "inactive" && !m.is_active);
      return matchQ && matchStatus;
    });
  }, [modes, searchQuery, statusFilter]);

  const summary = useMemo(() => {
    const total = modes.length;
    const active = modes.filter((m) => m.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [modes]);

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" />
              <span>{t(lang, "setmenu.t_transfer_modes", "Transfer Mode Master")}</span>
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {t(lang, "setmenu.d_transfer_modes", "Central master for payment and transfer modes, transaction reference labels, and placeholders.")}
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            className="w-full shrink-0 justify-center bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:w-auto font-bold text-xs gap-1.5 h-8.5 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            <span>{t(lang, "td.add_transfer_mode", "Add Transfer Mode")}</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {/* Controls Bar */}
          <div className="flex gap-2.5 flex-wrap items-center">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder={t(lang, "common.search", "Search...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8.5 text-xs bg-white dark:bg-slate-950 rounded-xl"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">{t(lang, "acct.status_all", "All Status")}</option>
              <option value="active">{t(lang, "acct.active_only", "Active Only")}</option>
              <option value="inactive">{t(lang, "acct.inactive_only", "Inactive Only")}</option>
            </select>
          </div>

          {/* KPI Summary Tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-2.5 rounded-xl">
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">TOTAL</div>
              <div className="text-base font-black text-blue-900 dark:text-blue-200 mt-0.5">{summary.total}</div>
            </div>
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-2.5 rounded-xl">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">ACTIVE</div>
              <div className="text-base font-black text-emerald-900 dark:text-emerald-200 mt-0.5">{summary.active}</div>
            </div>
            <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-2.5 rounded-xl">
              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">INACTIVE</div>
              <div className="text-base font-black text-rose-900 dark:text-rose-200 mt-0.5">{summary.inactive}</div>
            </div>
            <div className="hidden sm:block bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">FILTERED</div>
              <div className="text-base font-black text-slate-800 dark:text-slate-200 mt-0.5">{filtered.length}</div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs text-slate-500">Loading transfer modes...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-500">No transfer modes found</p>
                <Button onClick={openCreateModal} className="h-7 text-xs bg-blue-600 text-white font-bold rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add First Mode
                </Button>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <Th className="p-2.5 w-10 text-center">#</Th>
                    <Th className="p-2.5">Mode Name</Th>
                    <Th className="p-2.5">Code</Th>
                    <Th className="p-2.5">Reference Label</Th>
                    <Th className="p-2.5">Reference Placeholder</Th>
                    <Th className="p-2.5 w-16 text-center">Order</Th>
                    <Th className="p-2.5 w-20 text-center">Status</Th>
                    <Th className="p-2.5 w-20 text-center">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filtered.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="truncate">{item.name}</span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.code}</td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">{item.reference_label}</td>
                      <td className="p-2.5 text-slate-500 text-[11px] italic">{item.reference_placeholder}</td>
                      <td className="p-2.5 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.sort_order}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold inline-block",
                            item.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex gap-1 justify-center items-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title={t(lang, "td.edit_mode", "Edit Transfer Mode")}
                            className="p-1 rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
                          >
                            <PencilLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            title={t(lang, "common.delete", "Delete")}
                            className="p-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal: Add or Edit Transfer Mode */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                <span>{editingMode ? "Edit Transfer Mode" : "New Transfer Mode"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Mode Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Bank Transfer, Mobile Wallet, GPay"
                  className="h-8.5 text-xs bg-white dark:bg-slate-950 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Dynamic Reference Label <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={formRefLabel}
                  onChange={(e) => setFormRefLabel(e.target.value)}
                  placeholder="e.g. Transaction Reference, Cheque Number, Mobile Number"
                  className="h-8.5 text-xs bg-white dark:bg-slate-950 rounded-xl"
                />
                <span className="text-[10px] text-slate-400 block">
                  This label is displayed on transaction forms when this mode is selected
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Reference Placeholder
                </label>
                <Input
                  value={formPlaceholder}
                  onChange={(e) => setFormPlaceholder(e.target.value)}
                  placeholder="e.g. Enter cheque number, Reference / number"
                  className="h-8.5 text-xs bg-white dark:bg-slate-950 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Sort Order
                  </label>
                  <Input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value))}
                    className="h-8.5 text-xs bg-white dark:bg-slate-950 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    Status
                  </label>
                  <select
                    value={formActive ? "true" : "false"}
                    onChange={(e) => setFormActive(e.target.value === "true")}
                    className="w-full h-8.5 px-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-xs font-semibold"
                  >
                    <option value="true">{t(lang, "god.active", "Active")}</option>
                    <option value="false">{t(lang, "god.inactive", "Inactive")}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  className="h-8 px-4 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  {saving ? "Saving..." : editingMode ? "Update Mode" : "Create Mode"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
