"use client";

import React, { useEffect, useState } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  ClipboardList, 
  FileText, 
  Globe, 
  LayoutDashboard, 
  Lock, 
  Save, 
  ShieldCheck, 
  Ship, 
  Sliders, 
  SlidersHorizontal, 
  Sparkles, 
  Truck, 
  Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TargetRoleKey = "super_admin" | "country_admin" | "branch_admin" | "agent_user";

type RoleScopeDefinition = {
  key: TargetRoleKey;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
};

const roleScopes: RoleScopeDefinition[] = [
  { key: "super_admin", title: "Super Admin", subtitle: "Full system master access & global controls", icon: ShieldCheck, badge: "Master System" },
  { key: "country_admin", title: "Country Admin", subtitle: "National & regional branch management scope", icon: Globe, badge: "Country Scope" },
  { key: "branch_admin", title: "City & Branch Admin", subtitle: "Branch level accounts, cash entry & staff", icon: Users, badge: "Branch Scope" },
  { key: "agent_user", title: "Shipping & Clearing Agent", subtitle: "Shipments, BL tracking & agent custom entries", icon: Ship, badge: "Logistics Scope" }
];

type ModuleItem = {
  key: string;
  label: string;
  category: "dashboards" | "shipping_clearing" | "finance_operations" | "reports";
  enabled: boolean;
  alertText: string;
};

type AllotmentState = Record<TargetRoleKey, Record<string, { enabled: boolean; alertText: string }>>;

const defaultModuleList = [
  // Dashboards
  { key: "dash_super_admin", label: "Super Admin Dashboard (/dashboard/super-admin)", category: "dashboards" },
  { key: "dash_country", label: "Country Admin Dashboard (/dashboard/country)", category: "dashboards" },
  { key: "dash_city", label: "City & Branch Dashboard (/dashboard/city)", category: "dashboards" },
  { key: "dash_logistics", label: "Shipping & Clearing Dashboard (/dashboard/logistics)", category: "dashboards" },

  // Shipping & Clearing Forms
  { key: "form_shipment_details", label: "Shipment Details & Tracking Matrix (/dashboard/shipping-line/shipment-details)", category: "shipping_clearing" },
  { key: "form_shipment_report", label: "Shipment Report (/dashboard/shipping-line/shipment-report)", category: "shipping_clearing" },
  { key: "form_shipping_agent_entry", label: "Shipping Agent Entry (/dashboard/shipping-line/agent-entry)", category: "shipping_clearing" },
  { key: "form_agent_custom_entry", label: "Agent Custom Entry (/dashboard/clearing-agent/agent-custom-entry)", category: "shipping_clearing" },
  { key: "form_bill_entry", label: "Bill Entry (/dashboard/clearing-agent/bill-entry)", category: "shipping_clearing" },
  { key: "form_payment_bill_entry", label: "Payment Bill Entry (/dashboard/clearing-agent/payment-bill-entry)", category: "shipping_clearing" },

  // Financial & Operations Forms
  { key: "form_purchase_new_booking", label: "New Purchase Booking Order (/dashboard/purchase/new-purchase-booking-order)", category: "finance_operations" },
  { key: "form_purchase_container_loading", label: "Container Loading Records (/dashboard/purchase/purchase-loading-records)", category: "finance_operations" },
  { key: "form_sales_booking", label: "New Sales Booking Order (/dashboard/sales/new-sales-booking-order)", category: "finance_operations" },
  { key: "form_cash_entry", label: "Roznamcha Cash Entry (/dashboard/roznamcha/cash-entry)", category: "finance_operations" },
  { key: "form_expenses_bill", label: "Expenses Bill Entry (/dashboard/roznamcha/expenses-bill)", category: "finance_operations" },
  { key: "form_user_registration", label: "User Registration & Role Form (/dashboard/new-entry/users/registration)", category: "finance_operations" },

  // Reports
  { key: "report_general_hub", label: "Enterprise Reporting Hub (/dashboard/reports)", category: "reports" },
  { key: "report_print_pdf", label: "A4 PDF Print Reports Hub (/dashboard/print-reports)", category: "reports" }
];

export default function DashboardSettingsPage() {
  const [selectedRole, setSelectedRole] = useState<TargetRoleKey>("country_admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [allotments, setAllotments] = useState<AllotmentState>({
    super_admin: {},
    country_admin: {},
    branch_admin: {},
    agent_user: {}
  });

  // Initialize state with default enabled settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/erp/admin/dashboard-settings");
        const json = await res.json();
        
        let loadedAllotments = json?.data?.allotments;

        // Fallback to local storage if API database isn't ready
        if (!loadedAllotments) {
          const raw = localStorage.getItem("erp_dashboard_allotments_v2");
          if (raw) {
            try { loadedAllotments = JSON.parse(raw); } catch {}
          }
        }

        const initialState: AllotmentState = {
          super_admin: {},
          country_admin: {},
          branch_admin: {},
          agent_user: {}
        };

        roleScopes.forEach((scope) => {
          initialState[scope.key] = {};
          defaultModuleList.forEach((mod) => {
            const saved = loadedAllotments?.[scope.key]?.[mod.key];
            
            // Default rules: super_admin has all enabled
            let isDefaultEnabled = true;
            if (scope.key === "agent_user" && mod.category !== "shipping_clearing" && mod.key !== "dash_logistics") {
              isDefaultEnabled = false;
            }
            if (scope.key === "branch_admin" && (mod.key === "dash_super_admin" || mod.key === "dash_country")) {
              isDefaultEnabled = false;
            }

            initialState[scope.key][mod.key] = {
              enabled: saved?.enabled ?? isDefaultEnabled,
              alertText: saved?.alertText ?? ""
            };
          });
        });

        setAllotments(initialState);
      } catch (err: any) {
        console.error("Dashboard settings fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function toggleModule(roleKey: TargetRoleKey, modKey: string) {
    setAllotments((prev) => {
      const roleConfig = prev[roleKey] || {};
      const current = roleConfig[modKey] || { enabled: true, alertText: "" };
      const updated = {
        ...prev,
        [roleKey]: {
          ...roleConfig,
          [modKey]: { ...current, enabled: !current.enabled }
        }
      };
      localStorage.setItem("erp_dashboard_allotments_v2", JSON.stringify(updated));
      return updated;
    });
  }

  function updateAlertText(roleKey: TargetRoleKey, modKey: string, alertText: string) {
    setAllotments((prev) => {
      const roleConfig = prev[roleKey] || {};
      const current = roleConfig[modKey] || { enabled: true, alertText: "" };
      const updated = {
        ...prev,
        [roleKey]: {
          ...roleConfig,
          [modKey]: { ...current, alertText }
        }
      };
      localStorage.setItem("erp_dashboard_allotments_v2", JSON.stringify(updated));
      return updated;
    });
  }

  async function handleSaveSettings() {
    setSaving(true);
    setMessage("");
    try {
      localStorage.setItem("erp_dashboard_allotments_v2", JSON.stringify(allotments));
      
      const res = await fetch("/api/erp/admin/dashboard-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allotments })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.message ?? "Unable to save to database server");
      }

      setMessage("✅ Dashboard & Module Allotment Settings saved successfully!");
    } catch (err: any) {
      setMessage("⚠️ Settings saved locally! Note: " + (err.message || "Saved to client storage."));
    } finally {
      setSaving(false);
    }
  }

  const categoryLabels = {
    dashboards: { label: "Dashboards & Overview Hubs", icon: LayoutDashboard, color: "text-blue-600 dark:text-blue-400" },
    shipping_clearing: { label: "Shipping Line & Clearing Agent Forms", icon: Ship, color: "text-cyan-600 dark:text-cyan-400" },
    finance_operations: { label: "Financial & Operational Entry Forms", icon: ClipboardList, color: "text-emerald-600 dark:text-emerald-400" },
    reports: { label: "Reports & PDF Analytics", icon: FileText, color: "text-purple-600 dark:text-purple-400" }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 text-foreground p-4 lg:p-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              Super Admin Settings & Controls
            </p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Dashboard System & Module Manager
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            Control dashboard allotment, enable/disable specific screens and forms, and configure custom alert notices per role level.
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-6 h-11 rounded-xl shadow-md transition-all hover:shadow-lg shrink-0"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving Allotments..." : "Save Allotment Matrix"}
        </Button>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-sm",
          message.startsWith("✅")
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
        )}>
          <span>{message}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      )}

      {/* Role Scope Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleScopes.map((scope) => {
          const Icon = scope.icon;
          const isSelected = selectedRole === scope.key;
          return (
            <button
              key={scope.key}
              type="button"
              onClick={() => setSelectedRole(scope.key)}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group shadow-sm",
                isSelected
                  ? "bg-cyan-500/10 border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-md"
                  : "bg-card hover:bg-muted/40 border-border/60"
              )}
            >
              {isSelected && <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500" />}
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl border border-border/50 bg-muted/30", isSelected ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 text-muted-foreground">
                  {scope.badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground">{scope.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{scope.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Main Module Controls Matrix */}
      <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Module Allotment & Screen Controls for:{" "}
              <span className="text-cyan-600 dark:text-cyan-400">{roleScopes.find((r) => r.key === selectedRole)?.title}</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Toggle screen visibility or input custom alert messages shown when access is restricted.
            </CardDescription>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            Role: <span className="font-mono text-foreground uppercase">{selectedRole}</span>
          </span>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {(["dashboards", "shipping_clearing", "finance_operations", "reports"] as const).map((catKey) => {
            const catMeta = categoryLabels[catKey];
            const CatIcon = catMeta.icon;
            const catModules = defaultModuleList.filter((m) => m.category === catKey);

            return (
              <div key={catKey} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <CatIcon className={cn("h-4 w-4", catMeta.color)} />
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">{catMeta.label}</h3>
                  <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                    {catModules.filter((m) => allotments[selectedRole]?.[m.key]?.enabled !== false).length} / {catModules.length} Enabled
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catModules.map((mod) => {
                    const currentConfig = allotments[selectedRole]?.[mod.key] || { enabled: true, alertText: "" };
                    const isEnabled = currentConfig.enabled;

                    return (
                      <div
                        key={mod.key}
                        className={cn(
                          "p-4 rounded-xl border transition-all space-y-3",
                          isEnabled
                            ? "bg-card border-border/60 hover:border-border"
                            : "bg-muted/20 border-border/40 opacity-80"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-foreground block">{mod.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">Key: {mod.key}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleModule(selectedRole, mod.key)}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              isEnabled ? "bg-cyan-600" : "bg-muted-foreground/30"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                                isEnabled ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>

                        {!isEnabled && (
                          <div className="pt-2 border-t border-border/40 space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Custom Restriction Notice / Alert Text
                            </Label>
                            <Input
                              value={currentConfig.alertText || ""}
                              onChange={(e) => updateAlertText(selectedRole, mod.key, e.target.value)}
                              placeholder="e.g. Access to this form is restricted by Super Admin."
                              className="h-8 text-xs bg-background border-border/60 rounded-lg text-foreground placeholder:text-muted-foreground"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-4 border-t border-border/60">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-8 h-11 rounded-xl shadow-md transition-all"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving Allotment Matrix..." : "Save Allotments"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
