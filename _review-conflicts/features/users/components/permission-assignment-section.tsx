"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, ChevronDown } from "lucide-react";
import {
  getPermissionKeysForTemplate,
  groupPermissionCatalog,
  permissionTemplates,
  type PermissionDefinition,
  type PermissionLevel
} from "@/lib/permissions/catalog";
import { cn } from "@/lib/utils";

type PermissionAssignmentSectionProps = {
  title?: string;
  level: PermissionLevel;
  template: string;
  selected: string[];
  onTemplateChange: (template: string) => void;
  onSelectedChange: (permissions: string[]) => void;
  parentPermissions?: string[];
  required?: boolean;
  note?: string;
};

/** Map raw group names to UI-friendly names, icons, and accent colors. */
const GROUP_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  "Dashboard":                                        { label: "Dashboard",               icon: "📊", color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200 dark:border-blue-900/60" },
  "Branch":                                           { label: "Branch Management",        icon: "🏢", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-900/60" },
  "New Entry / Users":                                { label: "Users & Accounts",         icon: "👥", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-900/60" },
  "Accounts":                                         { label: "Finance & Accounts",       icon: "💰", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900/60" },
  "Ledgers":                                          { label: "Ledgers",                  icon: "📒", color: "text-teal-700 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-950/30",   border: "border-teal-200 dark:border-teal-900/60" },
  "Journal / Daily Payment Entry":                    { label: "Daily Payments",           icon: "💳", color: "text-cyan-700 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-950/30",   border: "border-cyan-200 dark:border-cyan-900/60" },
  "Journal / Roznamcha":                              { label: "Roznamcha / Journal",      icon: "📋", color: "text-sky-700 dark:text-sky-400",      bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-200 dark:border-sky-900/60" },
  "Shipping Line / Clearing Agent / Shipping Line":   { label: "Shipping Lines",           icon: "🚢", color: "text-slate-700 dark:text-slate-400",  bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-700" },
  "Shipping Line / Clearing Agent / Clearing Agent":  { label: "Clearing Agents",          icon: "🏭", color: "text-zinc-700 dark:text-zinc-400",    bg: "bg-zinc-50 dark:bg-zinc-900/40",   border: "border-zinc-200 dark:border-zinc-700" },
  "Sales":                                            { label: "Sales",                    icon: "📈", color: "text-green-700 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-900/60" },
  "Purchase":                                         { label: "Purchase",                 icon: "🛒", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-900/60" },
  "Inventory":                                        { label: "Inventory & Stock",        icon: "📦", color: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900/60" },
  "HR / Payroll":                                     { label: "HR & Payroll",             icon: "👔", color: "text-pink-700 dark:text-pink-400",    bg: "bg-pink-50 dark:bg-pink-950/30",   border: "border-pink-200 dark:border-pink-900/60" },
  "Reports":                                          { label: "Reports & Export",         icon: "📄", color: "text-rose-700 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-950/30",   border: "border-rose-200 dark:border-rose-900/60" },
  "Messages":                                         { label: "Messages & Alerts",        icon: "💬", color: "text-fuchsia-700 dark:text-fuchsia-400", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", border: "border-fuchsia-200 dark:border-fuchsia-900/60" },
  "Settings":                                         { label: "Settings & Admin",         icon: "⚙️", color: "text-gray-700 dark:text-gray-400",    bg: "bg-gray-50 dark:bg-gray-900/40",   border: "border-gray-200 dark:border-gray-700" },
};

function getGroupMeta(group: string) {
  return GROUP_META[group] ?? {
    label: group,
    icon: "🔐",
    color: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    border: "border-slate-200 dark:border-slate-700"
  };
}

export function PermissionAssignmentSection({
  title = "Roles & Permissions",
  level,
  template,
  selected,
  onTemplateChange,
  onSelectedChange,
  parentPermissions,
  required = false,
  note
}: PermissionAssignmentSectionProps) {
  const [query, setQuery] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  const grouped = useMemo(() => groupPermissionCatalog(), []);
  const availableTemplates = useMemo(
    () => permissionTemplates.filter((item) => item.level === level || item.level === "user"),
    [level]
  );
  const allowedByParent = useMemo(() => new Set(parentPermissions ?? []), [parentPermissions]);
  const hasParentLimit = Boolean(parentPermissions?.length);

  const filteredGroups = useMemo<Record<string, PermissionDefinition[]>>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return Object.fromEntries(
      Object.entries(grouped)
        .map(([group, perms]) => [
          group,
          perms.filter((p) =>
            [group, p.label, p.description, p.key].join(" ").toLowerCase().includes(q)
          )
        ])
        .filter(([, perms]) => perms.length)
    ) as Record<string, PermissionDefinition[]>;
  }, [grouped, query]);

  const allowedPermissionKeys = useMemo(() => {
    const keys = Object.values(grouped).flatMap((perms) => perms.map((p) => p.key));
    return hasParentLimit ? keys.filter((k) => allowedByParent.has(k)) : keys;
  }, [allowedByParent, grouped, hasParentLimit]);

  const selectedAllowedCount = selected.filter((k) => allowedPermissionKeys.includes(k)).length;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function setTemplate(nextTemplate: string) {
    onTemplateChange(nextTemplate);
    const nextPerms = getPermissionKeysForTemplate(nextTemplate);
    onSelectedChange(hasParentLimit ? nextPerms.filter((k) => allowedByParent.has(k)) : nextPerms);
  }

  function togglePermission(key: string) {
    if (hasParentLimit && !allowedByParent.has(key)) return;
    const next = selectedSet.has(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    onSelectedChange(next);
  }

  function toggleGroup(group: string) {
    setClosedGroups((cur) => cur.includes(group) ? cur.filter((g) => g !== group) : [...cur, group]);
  }

  function toggleGroupPermissions(permKeys: string[]) {
    const allowed = hasParentLimit ? permKeys.filter((k) => allowedByParent.has(k)) : permKeys;
    const allSel = allowed.every((k) => selectedSet.has(k));
    const next = allSel
      ? selected.filter((k) => !allowed.includes(k))
      : [...new Set([...selected, ...allowed])];
    onSelectedChange(next);
  }

  function selectAllAllowed() {
    onSelectedChange([...new Set([...selected, ...allowedPermissionKeys])]);
  }

  function clearAllSelected() {
    onSelectedChange([]);
  }

  const groupEntries = Object.entries(filteredGroups);
  const totalSelected = selected.length;
  const totalAllowed = allowedPermissionKeys.length;

  return (
    <div className="space-y-4">

      {/* ── Top Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Template picker */}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Permission Template {required ? <span className="text-rose-500">*</span> : null}
          </label>
          <select
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">Select template…</option>
            {availableTemplates.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>

        {/* Stats + global actions */}
        <div className="flex flex-wrap items-center gap-2 pt-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {selectedAllowedCount} / {totalAllowed} selected
          </span>
          <button
            type="button"
            onClick={selectAllAllowed}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 transition-colors"
          >
            ✓ Select All
          </button>
          <button
            type="button"
            onClick={clearAllSelected}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 transition-colors"
          >
            ✕ Clear All
          </button>
        </div>
      </div>

      {/* Note */}
      {note && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          ⚠ {note}
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search permissions, modules, or actions…"
        />
      </div>

      {/* ── Permission Groups ────────────────────────────────────── */}
      <div className="space-y-2">
        {groupEntries.map(([group, perms]) => {
          const meta = getGroupMeta(group);
          const permKeys = perms.map((p) => p.key);
          const allowed = hasParentLimit ? permKeys.filter((k) => allowedByParent.has(k)) : permKeys;
          const selCount = allowed.filter((k) => selectedSet.has(k)).length;
          const allSel = allowed.length > 0 && selCount === allowed.length;
          const someSel = selCount > 0 && !allSel;
          const isOpen = !closedGroups.includes(group) || Boolean(query.trim());

          return (
            <div key={group} className={cn("overflow-hidden rounded-xl border shadow-sm", meta.border)}>

              {/* Category Header */}
              <div
                className={cn(
                  "flex cursor-pointer items-center justify-between px-4 py-2.5 select-none",
                  meta.bg
                )}
                onClick={() => toggleGroup(group)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base leading-none flex-shrink-0">{meta.icon}</span>
                  <div className="min-w-0">
                    <span className={cn("text-[11px] font-black uppercase tracking-wider", meta.color)}>
                      {meta.label}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">
                      {selCount}/{allowed.length}
                    </span>
                    {someSel && (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 align-middle" />
                    )}
                    {allSel && (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Category Select/Clear toggle */}
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border transition-colors",
                      allSel
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    )}
                    onClick={(e) => { e.stopPropagation(); toggleGroupPermissions(permKeys); }}
                  >
                    {allSel ? "Clear" : "Select All"}
                  </button>
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")}
                  />
                </div>
              </div>

              {/* Permission Items Grid */}
              {isOpen && (
                <div className="grid gap-1 border-t border-slate-100 p-2.5 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-3">
                  {perms.map((perm) => {
                    const disabled = hasParentLimit && !allowedByParent.has(perm.key);
                    const checked = selectedSet.has(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={cn(
                          "group flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-all",
                          checked
                            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30"
                            : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-transparent dark:hover:border-slate-600 dark:hover:bg-slate-900/30",
                          disabled && "cursor-not-allowed opacity-40"
                        )}
                      >
                        {/* Custom checkbox */}
                        <div className="relative mt-0.5 flex-shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => togglePermission(perm.key)}
                          />
                          <div className={cn(
                            "h-4 w-4 rounded border-2 transition-colors flex items-center justify-center",
                            checked
                              ? "border-indigo-500 bg-indigo-500"
                              : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900",
                            disabled && "border-slate-200"
                          )}>
                            {checked && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Label & description */}
                        <div className="min-w-0 flex-1">
                          <span className={cn(
                            "block text-[11px] font-bold leading-tight",
                            checked ? "text-indigo-900 dark:text-indigo-200" : "text-slate-800 dark:text-slate-200",
                            disabled && "text-slate-400"
                          )}>
                            {perm.label}
                          </span>
                          <span className="mt-0.5 block text-[9px] leading-tight text-slate-400 dark:text-slate-500 line-clamp-2">
                            {perm.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {groupEntries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
            No permissions match your search.
          </div>
        )}
      </div>

      {/* ── Selection Summary Footer ─────────────────────────────── */}
      {totalSelected > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
              ✓ {totalSelected} Permission{totalSelected !== 1 ? "s" : ""} Selected
            </span>
            <button
              type="button"
              onClick={clearAllSelected}
              className="text-[9px] font-semibold text-rose-500 hover:text-rose-700 dark:text-rose-400"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selected.slice(0, 20).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePermission(key)}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-800 hover:bg-rose-100 hover:border-rose-200 hover:text-rose-700 transition-colors dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {key}
                <span className="opacity-60">×</span>
              </button>
            ))}
            {selected.length > 20 && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                +{selected.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
