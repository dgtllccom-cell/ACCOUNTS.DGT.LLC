"use client";

import React, { useState, useEffect } from "react";
import {
  Settings2,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  SlidersHorizontal,
  MoveUp,
  MoveDown,
  Shield,
  Layers,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

export type DashboardWidgetItem = {
  id: string;
  label: string;
  category?: string;
  defaultVisible?: boolean;
};

interface DashboardSettingsModalProps {
  storageKey: string;
  title: string;
  subtitle?: string;
  widgets: DashboardWidgetItem[];
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: (visibleMap: Record<string, boolean>, order: string[]) => void;
}

export function DashboardSettingsModal({
  storageKey,
  title,
  subtitle,
  widgets,
  isOpen,
  onClose,
  onSettingsChange
}: DashboardSettingsModalProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const defaultVisibleMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    widgets.forEach((w) => {
      map[w.id] = w.defaultVisible !== false;
    });
    return map;
  }, [widgets]);

  const defaultOrder = React.useMemo(() => widgets.map((w) => w.id), [widgets]);

  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>(defaultVisibleMap);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(defaultOrder);
  const [activeRoleView, setActiveRoleView] = useState<string>("super_admin");
  const [savedNotice, setSavedNotice] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.visibleMap) setVisibleMap({ ...defaultVisibleMap, ...parsed.visibleMap });
        if (parsed.widgetOrder && Array.isArray(parsed.widgetOrder)) {
          // ensure all current widgets are in order
          const combined = [
            ...parsed.widgetOrder.filter((id: string) => defaultOrder.includes(id)),
            ...defaultOrder.filter((id) => !parsed.widgetOrder.includes(id))
          ];
          setWidgetOrder(combined);
        }
      }
    } catch {
      // fallback to defaults
    }
  }, [storageKey, defaultVisibleMap, defaultOrder]);

  const handleToggle = (id: string) => {
    const updated = { ...visibleMap, [id]: !visibleMap[id] };
    setVisibleMap(updated);
    saveSettings(updated, widgetOrder);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newOrder = [...widgetOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setWidgetOrder(newOrder);
    saveSettings(visibleMap, newOrder);
  };

  const saveSettings = (map: Record<string, boolean>, order: string[]) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ visibleMap: map, widgetOrder: order, updatedAt: Date.now() })
      );
      if (onSettingsChange) onSettingsChange(map, order);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setVisibleMap(defaultVisibleMap);
    setWidgetOrder(defaultOrder);
    saveSettings(defaultVisibleMap, defaultOrder);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {title || t(lang, "dash.dashboard_settings", "Dashboard Settings")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {subtitle || "Show, hide, and rearrange dashboard cards and widgets."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role Configuration Preset Bar */}
        <div className="px-5 py-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100/60 dark:border-blue-900/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Role Visibility:
            </span>
          </div>
          <select
            value={activeRoleView}
            onChange={(e) => setActiveRoleView(e.target.value)}
            className="h-7 px-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="super_admin">Super Admin (All Visible)</option>
            <option value="country_admin">Country Admin Scope</option>
            <option value="branch_admin">Branch Admin Scope</option>
            <option value="staff_user">Staff / Restricted User</option>
          </select>
        </div>

        {/* Widgets List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {widgetOrder.map((id, index) => {
            const item = widgets.find((w) => w.id === id);
            if (!item) return null;
            const isVisible = visibleMap[id] !== false;

            return (
              <div
                key={id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all duration-150",
                  isVisible
                    ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                    : "bg-slate-50 dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(id)}
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                      isVisible
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                    )}
                  >
                    {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </p>
                    {item.category && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Up"
                  >
                    <MoveUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === widgetOrder.length - 1}
                    onClick={() => handleMove(index, "down")}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Down"
                  >
                    <MoveDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 animate-in fade-in duration-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            <Button
              type="button"
              onClick={onClose}
              className="h-8 px-4 text-xs font-bold bg-[#1d63ed] hover:bg-[#1a55cd] text-white rounded-xl shadow-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
