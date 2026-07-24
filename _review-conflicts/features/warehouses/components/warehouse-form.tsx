"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Globe,
  Warehouse,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { createWarehouse, type WarehouseRecord } from "@/features/warehouses/warehouse-api";

const WAREHOUSE_TYPES = [
  "Normal Storage",
  "Cold Store",
  "Bonded Warehouse",
  "Automated Warehouse",
  "Distribution Center",
  "Fulfillment Center"
];

const STATUS_OPTIONS = ["Active", "Inactive", "Under Maintenance", "Closed"];

type WarehouseFormState = {
  warehouseName: string;
  ownerName: string;
  warehouseType: string;
  countryId: string;
  stateProvinceId: string;
  districtId: string;
  cityId: string;
  areaId: string;
  fullAddress: string;
  contracts: Array<{ type: string; value: string }>;
  status: string;
};

const emptyForm: WarehouseFormState = {
  warehouseName: "",
  ownerName: "",
  warehouseType: "Normal Storage",
  countryId: "",
  stateProvinceId: "",
  districtId: "",
  cityId: "",
  areaId: "",
  fullAddress: "",
  contracts: [{ type: "Contract Number", value: "" }],
  status: "Active",
};

export type WarehouseFormProps = {
  mode?: "standalone" | "embedded";
  onSave?: (warehouseId: string, warehouse: WarehouseRecord) => void;
  onCancel?: () => void;
};

export function WarehouseForm({
  mode = "standalone",
  onSave,
  onCancel
}: WarehouseFormProps) {
  const [form, setForm] = useState<WarehouseFormState>(emptyForm);
  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    districtId: "",
    cityId: "",
    areaId: ""
  });
  
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [savedWarehouse, setSavedWarehouse] = useState<WarehouseRecord | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function set(field: keyof WarehouseFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleLocationChange(next: LocationHierarchyValue, meta: LocationHierarchyMeta) {
    setLocation(next);
    setForm((prev) => {
      const newContracts = [...prev.contracts];
      if (meta.country?.phone_code) {
        const phoneIdx = newContracts.findIndex((c) => c.type === "Phone Number" || c.type === "Mobile");
        if (phoneIdx === -1 && newContracts[0].value === "") {
           newContracts[0] = { type: "Phone Number", value: meta.country.phone_code + " " };
        } else if (phoneIdx >= 0 && !newContracts[phoneIdx].value.trim()) {
           newContracts[phoneIdx].value = meta.country.phone_code + " ";
        }
      }
      return {
        ...prev,
        countryId: next.countryId,
        stateProvinceId: next.stateProvinceId,
        districtId: next.districtId || "",
        cityId: next.cityId,
        areaId: next.areaId || "",
        contracts: newContracts
      };
    });
  }

  const isReady = form.warehouseName && form.warehouseType && form.status;

  async function handleSave() {
    if (!isReady) {
      setMessage({ type: "error", text: "Please fill all required fields marked with *" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const warehouseId = await createWarehouse({
        warehouse_name: form.warehouseName,
        owner_name: form.ownerName || "",
        warehouse_type: form.warehouseType,
        country_id: form.countryId || null,
        state_province_id: form.stateProvinceId || null,
        district_id: form.districtId || null,
        city_id: form.cityId || null,
        area_id: form.areaId || null,
        full_address: form.fullAddress || null,
        contact_number: JSON.stringify(form.contracts),
        status: form.status,
      });

      const saved: WarehouseRecord = {
        id: warehouseId,
        warehouse_name: form.warehouseName,
        owner_name: form.ownerName,
        warehouse_type: form.warehouseType,
        country_id: form.countryId || null,
        state_province_id: form.stateProvinceId || null,
        district_id: form.districtId || null,
        city_id: form.cityId || null,
        area_id: form.areaId || null,
        full_address: form.fullAddress || null,
        contact_number: JSON.stringify(form.contracts),
        status: form.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSavedWarehouse(saved);
      setMessage({ type: "success", text: `Warehouse "${form.warehouseName}" saved successfully!` });
      onSave?.(warehouseId, saved);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message ?? "Failed to save warehouse." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(emptyForm);
    setLocation({ countryId: "", stateProvinceId: "", districtId: "", cityId: "", areaId: "" });
    setSavedWarehouse(null);
    setMessage(null);
    setCurrentStep(1);
  }

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className={mode === "standalone" ? "space-y-6" : "space-y-4"}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
            <Warehouse className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
              {mode === "standalone" ? "Settings / Master Forms" : "Warehouse Master Form"}
            </p>
            <h1 className={mode === "standalone" ? "mt-0.5 text-2xl font-bold tracking-tight" : "text-lg font-bold"}>
              Customer Warehouse
            </h1>
            {mode === "standalone" && (
              <p className="text-sm text-muted-foreground">
                Register warehouses or storage facilities connected with the company
              </p>
            )}
          </div>
        </div>
        <span
          className={
            isReady
              ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200"
              : "inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200"
          }
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {isReady ? "Ready to Save" : "Draft"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-semibold text-slate-500 mb-2">
        {[
          { id: 1, label: "1. Warehouse Details" },
          { id: 2, label: "2. Location & Contact" },
          { id: 3, label: "3. Review & Save" },
        ].map((s) => {
          const active = currentStep === s.id;
          const completed = currentStep > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as any)}
              className={`flex items-center gap-2 border rounded-lg p-2.5 text-left transition-all ${
                active
                  ? "border-indigo-500 bg-indigo-500/5 text-indigo-600 font-bold shadow-sm"
                  : completed
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 font-bold"
                  : "border-slate-100 bg-slate-50/50 text-slate-400"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-indigo-600 text-white" : completed ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">

          {/* Step 1: Warehouse Details */}
          {currentStep === 1 && (
            <section className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b pb-3">
                <Warehouse className="h-4 w-4 text-indigo-600" aria-hidden />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Warehouse Details</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Warehouse Name *</Label>
                  <Input
                    value={form.warehouseName}
                    onChange={(e) => set("warehouseName", e.target.value)}
                    placeholder="Enter warehouse name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Owner Name</Label>
                  <Input
                    value={form.ownerName}
                    onChange={(e) => set("ownerName", e.target.value)}
                    placeholder="e.g. Damaan Group"
                  />
                  <p className="text-[10px] text-muted-foreground">Name of the company or person that owns the warehouse.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Warehouse Type *</Label>
                  <select
                    value={form.warehouseType}
                    onChange={(e) => set("warehouseType", e.target.value)}
                    className={selectClass}
                  >
                    {WAREHOUSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Status *</Label>
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={selectClass}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: Location & Contact */}
          {currentStep === 2 && (
            <section className="space-y-5 rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b pb-3">
                <Globe className="h-4 w-4 text-indigo-600" aria-hidden />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Location & Contact</h2>
              </div>

              <LocationHierarchySelect
                value={location}
                onChange={handleLocationChange}
                showDistrict={false}
                showArea={true}
              />

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Address</Label>
                <Input
                  value={form.fullAddress}
                  onChange={(e) => set("fullAddress", e.target.value)}
                  placeholder="Enter full address or street"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4.5 w-4.5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-800 text-sm">Contacts & Contracts</h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm(p => ({ ...p, contracts: [...p.contracts, { type: "Contract Number", value: "" }] }))}
                    className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2.5 rounded-md font-semibold"
                  >
                    + Add Contract/Contact
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.contracts.map((contact, idx) => {
                    const isCustom = !["Contract Number", "Phone Number", "Email Address", "Landline"].includes(contact.type);
                    return (
                      <div key={idx} className="flex gap-2 items-end">
                        <div className="w-1/3 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">Type</Label>
                          <select
                            value={isCustom ? "Custom" : contact.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...form.contracts];
                              updated[idx].type = val === "Custom" ? "Custom: " : val;
                              setForm(p => ({ ...p, contracts: updated }));
                            }}
                            className={selectClass + " h-9 text-xs px-2"}
                          >
                            <option value="Contract Number">Contract Number</option>
                            <option value="Phone Number">Phone Number</option>
                            <option value="Email Address">Email Address</option>
                            <option value="Landline">Landline</option>
                            <option value="Custom">+ Custom Type</option>
                          </select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-500">Value</Label>
                          <Input
                            value={contact.value}
                            onChange={(e) => {
                              const updated = [...form.contracts];
                              updated[idx].value = e.target.value;
                              setForm(p => ({ ...p, contracts: updated }));
                            }}
                            placeholder={
                              contact.type === "Email Address"
                                ? "email@example.com"
                                : contact.type === "Phone Number"
                                ? "+971 50 1234567"
                                : "Reference / ID / Number"
                            }
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                        {form.contracts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = form.contracts.filter((_, i) => i !== idx);
                              setForm(p => ({ ...p, contracts: updated }));
                            }}
                            className="h-9 w-9 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center shrink-0"
                          >
                            <CheckCircle2 className="h-4 w-4 hidden" /> {/* dummy icon */}
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Review & Save */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-800">Review & Save</p>
              <p className="text-xs text-muted-foreground">
                Please review the warehouse details on the right panel. Once confirmed, you can save the warehouse record.
              </p>
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={
                message.type === "success"
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                  : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              }
            >
              {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((Math.max(1, currentStep - 1)) as any)}
              disabled={currentStep === 1}
              className="border-slate-200 text-slate-700 font-medium h-10 px-4"
            >
              Back
            </Button>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel ?? handleReset}
                className="h-10 px-4"
              >
                Cancel
              </Button>
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((Math.min(3, currentStep + 1)) as any)}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm h-10 px-8 gap-2"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isReady}
                  className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition gap-2 shadow-sm font-medium h-10 px-5"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  {saving ? "Saving..." : "Save Warehouse"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Warehouse Preview */}
        <aside className="h-fit rounded-lg border bg-card p-5 shadow-sm xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-indigo-600" aria-hidden />
              <h2 className="font-semibold text-sm">Warehouse Preview</h2>
            </div>
            <div>
              {savedWarehouse ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Saved Record
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Live Draft
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {savedWarehouse && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-center mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-emerald-700 font-semibold text-xs">Saved Successfully</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Warehouse Name</p>
              <p className="font-bold text-sm mt-0.5 text-slate-900">{savedWarehouse ? savedWarehouse.warehouse_name : form.warehouseName || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Owner Name</p>
              <p className="font-semibold mt-0.5 text-slate-800">{savedWarehouse ? savedWarehouse.owner_name : form.ownerName || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Type</p>
              <p className="font-semibold mt-0.5 text-slate-900">{savedWarehouse ? savedWarehouse.warehouse_type : form.warehouseType || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Contacts / Contracts</p>
              <div className="mt-1 space-y-1">
                {(savedWarehouse ? JSON.parse(savedWarehouse.contact_number || "[]") : form.contracts).map((c: any, i: number) => (
                  c.value ? (
                    <div key={i} className="flex justify-between items-center text-slate-800">
                      <span className="text-[10px] text-slate-500 font-medium">{c.type}</span>
                      <span className="font-mono">{c.value}</span>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
            
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-bold ${savedWarehouse ? (savedWarehouse.status === "Active" ? "text-emerald-600" : "text-amber-600") : (form.status === "Active" ? "text-emerald-600" : "text-amber-600")}`}>
                {savedWarehouse ? savedWarehouse.status : form.status}
              </span>
            </div>

            {savedWarehouse && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={handleReset}
              >
                + Add Another Warehouse
              </Button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
