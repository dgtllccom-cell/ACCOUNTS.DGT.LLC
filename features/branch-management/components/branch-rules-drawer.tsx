"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Globe,
  Building2,
  MapPin,
  Check,
  RotateCcw,
  Save,
  Loader2,
  ChevronRight,
  Filter,
  Search,
  Sliders,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERP_MODULE_DEFINITIONS } from "@/lib/permissions/rbac-matrix-builder";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

export type BranchRulesScope = {
  scopeType: "country" | "country_branch" | "city_branch";
  scopeId: string;
  scopeName: string;
  parentHierarchy: string[];
};

interface BranchRulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scope: BranchRulesScope | null;
  lang?: SupportedLanguage;
  onSaved?: () => void;
}

type ActionStatus = "inherited" | "custom" | "denied" | "none";

export function BranchRulesDrawer({
  isOpen,
  onClose,
  scope,
  lang = "en",
  onSaved
}: BranchRulesDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"modules" | "domains" | "denials">("modules");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [allowedDomains, setAllowedDomains] = useState<string[]>(["business"]);
  const [customPermissions, setCustomPermissions] = useState<Set<string>>(new Set());
  const [explicitlyDenied, setExplicitlyDenied] = useState<Set<string>>(new Set());
  const [inheritedPermissions, setInheritedPermissions] = useState<Set<string>>(new Set());
  const [inheritedDenied, setInheritedDenied] = useState<Set<string>>(new Set());

  // Load rules when scope opens
  useEffect(() => {
    if (!isOpen || !scope) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);

    async function fetchRules() {
      try {
        const res = await fetch(
          `/api/erp/branch-rules?scopeType=${encodeURIComponent(scope!.scopeType)}&scopeId=${encodeURIComponent(scope!.scopeId)}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(data.error || "Failed to load branch rules");
        }

        setAllowedDomains(data.allowedDomains || ["business"]);
        setCustomPermissions(new Set(data.customPermissions || []));
        setExplicitlyDenied(new Set(data.explicitlyDenied || []));
        setInheritedPermissions(new Set(data.inherited?.permissions || []));
        setInheritedDenied(new Set(data.inherited?.deniedPermissions || []));
      } catch (err: any) {
        if (!cancelled) {
          setMessage({ type: "error", text: err.message || "Failed to load rules" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchRules();
    return () => {
      cancelled = true;
    };
  }, [isOpen, scope]);

  // Compute status of a permission action
  function getActionStatus(perms: string[]): ActionStatus {
    if (!perms || perms.length === 0) return "none";
    const isDenied = perms.some(
      (p) => explicitlyDenied.has(p) || inheritedDenied.has(p) || explicitlyDenied.has(`${p.split(":")[0]}:*`)
    );
    if (isDenied) return "denied";

    const isCustom = perms.some(
      (p) => customPermissions.has(p) || customPermissions.has(`${p.split(":")[0]}:*`)
    );
    if (isCustom) return "custom";

    const hasInherited = perms.some(
      (p) => inheritedPermissions.has(p) || inheritedPermissions.has("*:*")
    );
    if (hasInherited) return "inherited";

    return "none";
  }

  // Toggle action permission through: Inherited -> Custom -> Denied -> Inherited
  function cycleActionPermission(perms: string[]) {
    if (!perms.length) return;
    const currentStatus = getActionStatus(perms);
    const nextCustom = new Set(customPermissions);
    const nextDenied = new Set(explicitlyDenied);

    if (currentStatus === "inherited") {
      // Switch to Denied
      perms.forEach((p) => {
        nextCustom.delete(p);
        nextDenied.add(p);
      });
    } else if (currentStatus === "denied") {
      // Switch to Custom Allowed
      perms.forEach((p) => {
        nextDenied.delete(p);
        nextCustom.add(p);
      });
    } else if (currentStatus === "custom") {
      // Switch back to Inherited (remove custom and denied)
      perms.forEach((p) => {
        nextCustom.delete(p);
        nextDenied.delete(p);
      });
    } else {
      // None -> Custom Grant
      perms.forEach((p) => {
        nextDenied.delete(p);
        nextCustom.add(p);
      });
    }

    setCustomPermissions(nextCustom);
    setExplicitlyDenied(nextDenied);
  }

  // Save changes
  async function handleSave() {
    if (!scope) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/erp/branch-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          allowedDomains,
          permissions: Array.from(customPermissions),
          deniedPermissions: Array.from(explicitlyDenied),
          moduleAccess: {}
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save branch rules");

      setMessage({ type: "success", text: "Branch rules and permissions saved successfully." });
      if (onSaved) onSaved();
      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save rules" });
    } finally {
      setSaving(false);
    }
  }

  // Reset all to inherited
  function handleResetAllToInherited() {
    setCustomPermissions(new Set());
    setExplicitlyDenied(new Set());
  }

  // Enable all in current category
  function handleEnableAllVisible() {
    const nextCustom = new Set(customPermissions);
    const nextDenied = new Set(explicitlyDenied);

    filteredModules.forEach((m) => {
      [...m.viewPerms, ...m.createPerms, ...m.editPerms, ...m.deletePerms, ...m.approvePerms, ...m.exportPerms].forEach((p) => {
        nextDenied.delete(p);
        nextCustom.add(p);
      });
    });

    setCustomPermissions(nextCustom);
    setExplicitlyDenied(nextDenied);
  }

  // Categories list
  const categories = ["All", "Finance & Accounting", "Trading & Inventory", "Logistics & Customs", "Administration, HR & System"];

  const filteredModules = useMemo(() => {
    return ERP_MODULE_DEFINITIONS.filter((mod) => {
      if (categoryFilter !== "All" && mod.category !== categoryFilter) return false;
      if (searchQuery.trim() && !mod.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, searchQuery]);

  if (!isOpen || !scope) return null;

  const ScopeIcon = scope.scopeType === "country" ? Globe : scope.scopeType === "country_branch" ? Building2 : MapPin;
  const scopeTypeLabel = scope.scopeType === "country" ? "Country" : scope.scopeType === "country_branch" ? "Main Branch" : "City Branch";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <ScopeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {scopeTypeLabel} Rules
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {scope.scopeName}
                </h2>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Super Admin</span>
                {scope.parentHierarchy.map((h, i) => (
                  <React.Fragment key={i}>
                    <ChevronRight className="h-3 w-3 text-slate-400" />
                    <span>{h}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sub-header Tabs & Quick Stats */}
        <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("modules")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === "modules"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Module & Form Permissions
            </button>
            <button
              onClick={() => setActiveTab("domains")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === "domains"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Domain Scope ({allowedDomains.length})
            </button>
            <button
              onClick={() => setActiveTab("denials")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === "denials"
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Explicit Denials ({explicitlyDenied.size})
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Inherited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Custom ({customPermissions.size})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Denied ({explicitlyDenied.size})</span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-50 border-b border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 border-b border-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-semibold">Loading scope rules and hierarchy permissions...</p>
            </div>
          ) : activeTab === "modules" ? (
            <>
              {/* Category & Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        categoryFilter === cat
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search modules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs rounded-lg"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetAllToInherited}
                    className="h-8 text-xs font-bold text-slate-700"
                    title="Revert all modules to parent inherited permissions"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Inherit All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnableAllVisible}
                    className="h-8 text-xs font-bold text-blue-600 hover:bg-blue-50"
                    title="Enable all actions for visible modules"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Grant All
                  </Button>
                </div>
              </div>

              {/* Module Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200">
                      <th className="p-3">Module Name</th>
                      <th className="p-2 text-center w-20">View</th>
                      <th className="p-2 text-center w-20">Create</th>
                      <th className="p-2 text-center w-20">Edit</th>
                      <th className="p-2 text-center w-20">Delete</th>
                      <th className="p-2 text-center w-20">Approve</th>
                      <th className="p-2 text-center w-20">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredModules.map((mod) => {
                      const actions: Array<{ label: string; perms: string[] }> = [
                        { label: "View", perms: mod.viewPerms },
                        { label: "Create", perms: mod.createPerms },
                        { label: "Edit", perms: mod.editPerms },
                        { label: "Delete", perms: mod.deletePerms },
                        { label: "Approve", perms: mod.approvePerms },
                        { label: "Export", perms: mod.exportPerms }
                      ];

                      return (
                        <tr
                          key={mod.key}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3">
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {mod.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {mod.category}
                            </div>
                          </td>

                          {actions.map((act) => {
                            const status = getActionStatus(act.perms);
                            const hasPerm = act.perms.length > 0;

                            if (!hasPerm) {
                              return (
                                <td key={act.label} className="p-2 text-center text-slate-300 dark:text-slate-700">
                                  -
                                </td>
                              );
                            }

                            return (
                              <td key={act.label} className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => cycleActionPermission(act.perms)}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                                    status === "inherited"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                      : status === "custom"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                      : status === "denied"
                                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                  }`}
                                  title={`Click to cycle: ${status.toUpperCase()} (Inherited -> Denied -> Custom -> Reset)`}
                                >
                                  {status === "inherited" && <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />}
                                  {status === "custom" && <Shield className="h-2.5 w-2.5 text-indigo-600" />}
                                  {status === "denied" && <ShieldX className="h-2.5 w-2.5 text-rose-600" />}
                                  <span className="capitalize">{status}</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : activeTab === "domains" ? (
            <div className="max-w-xl space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-600" />
                  Operational Domain Scope
                </h3>
                <p className="text-xs text-slate-500">
                  Control which operational domains are accessible from this branch level. Users assigned to this branch will only be able to operate within authorized domains.
                </p>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedDomains.includes("business")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedDomains([...allowedDomains, "business"]);
                        } else {
                          setAllowedDomains(allowedDomains.filter((d) => d !== "business"));
                        }
                      }}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Business & Trading Access
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Allows Purchases, Sales, Customer Accounts, Roznamcha Cash Books, General Ledgers.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedDomains.includes("shipping")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedDomains([...allowedDomains, "shipping"]);
                        } else {
                          setAllowedDomains(allowedDomains.filter((d) => d !== "shipping"));
                        }
                      }}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Shipping & Clearing Agent Access
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Allows Clearing Bills, Container Demurrage, Port/Customs Clearance, Shipping Lines.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-xl space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  Explicitly Denied Permissions
                </h3>
                <p className="text-xs text-slate-500">
                  Permissions listed here are explicitly blocked for this branch, overriding all role defaults and inherited grants.
                </p>

                {explicitlyDenied.size === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    No explicit denials set. This branch inherits all permissible role actions from parent levels.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(explicitlyDenied).map((perm) => (
                      <div
                        key={perm}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs"
                      >
                        <span className="font-mono font-bold">{perm}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(explicitlyDenied);
                            next.delete(perm);
                            setExplicitlyDenied(next);
                          }}
                          className="text-xs font-bold text-rose-600 hover:text-rose-900"
                        >
                          Remove Denial
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <span className="font-bold text-slate-700 dark:text-slate-300">{customPermissions.size}</span> custom grants,{" "}
            <span className="font-bold text-slate-700 dark:text-slate-300">{explicitlyDenied.size}</span> explicit denials.
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Rules...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Rules & Permissions</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
