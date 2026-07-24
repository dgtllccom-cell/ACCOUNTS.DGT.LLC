"use client";

import { useEffect, useState } from "react";
import {
  Anchor,
  Truck,
  Plane,
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Globe,
  Loader2,
  Ship,
  MapPin,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";

export type PortRecord = {
  id: string;
  port_name: string;
  country_id: string | null;
  port_code: string | null;
  transport_type: "sea" | "road" | "air";
  is_active: boolean;
  country?: {
    id: string;
    name: string;
  } | null;
};

export type CountryRecord = {
  id: string;
  name: string;
};

export type PortMasterClientProps = {
  type: "loading" | "received";
  title: string;
  description: string;
  apiEndpoint: string;
};

export function PortMasterClient({
  type,
  title,
  description,
  apiEndpoint
}: PortMasterClientProps) {
  // Data States
  const [ports, setPorts] = useState<PortRecord[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter/Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sea" | "road" | "air">("all");

  // Form Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPort, setEditingPort] = useState<PortRecord | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCountryId, setFormCountryId] = useState("");
  const [formTransportType, setFormTransportType] = useState<"sea" | "road" | "air">("sea");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch ports and countries in parallel
        const [portsData, countriesData] = await Promise.all([
          apiGet<{ ports: PortRecord[] }>(`${apiEndpoint}?all=true`),
          apiGet<CountryRecord[]>("/api/erp/locations/countries?all=true")
        ]);

        setPorts(portsData.ports || []);
        // Handle potential different response shapes of countries
        const resolvedCountries = Array.isArray(countriesData)
          ? countriesData
          : (countriesData as any).countries || [];
        setCountries(resolvedCountries);
      } catch (err: any) {
        setError(err.message || "Failed to load master data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [apiEndpoint]);

  // Open modal for Create
  function handleOpenCreate() {
    setEditingPort(null);
    setFormName("");
    setFormCode("");
    setFormCountryId("");
    setFormTransportType("sea");
    setFormIsActive(true);
    setFormError(null);
    setModalOpen(true);
  }

  // Open modal for Edit
  function handleOpenEdit(port: PortRecord) {
    setEditingPort(port);
    setFormName(port.port_name);
    setFormCode(port.port_code || "");
    setFormCountryId(port.country_id || "");
    setFormTransportType(port.transport_type);
    setFormIsActive(port.is_active);
    setFormError(null);
    setModalOpen(true);
  }

  // Handle Save (Create / Update)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Port/Point name is required");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      portName: formName.trim(),
      countryId: formCountryId || null,
      portCode: formCode.trim() || null,
      transportType: formTransportType,
      isActive: formIsActive
    };

    try {
      if (editingPort) {
        // Update
        await apiPatch(`${apiEndpoint}/${editingPort.id}`, payload);
        
        setPorts((prev) =>
          prev.map((p) =>
            p.id === editingPort.id
              ? {
                  ...p,
                  port_name: payload.portName,
                  country_id: payload.countryId,
                  port_code: payload.portCode,
                  transport_type: payload.transportType,
                  is_active: payload.isActive,
                  country: countries.find((c) => c.id === payload.countryId) || null
                }
              : p
          )
        );
      } else {
        // Create
        const res = await apiPost<{ portId: string }>(apiEndpoint, payload);
        const newPort: PortRecord = {
          id: res.portId,
          port_name: payload.portName,
          country_id: payload.countryId,
          port_code: payload.portCode,
          transport_type: payload.transportType,
          is_active: payload.isActive,
          country: countries.find((c) => c.id === payload.countryId) || null
        };
        setPorts((prev) => [newPort, ...prev]);
      }

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete (Soft Delete)
  async function handleDelete(port: PortRecord) {
    if (!confirm(`Are you sure you want to delete "${port.port_name}"?`)) {
      return;
    }

    try {
      await apiDelete(`${apiEndpoint}/${port.id}`);
      setPorts((prev) => prev.filter((p) => p.id !== port.id));
    } catch (err: any) {
      alert(err.message || "Failed to delete record.");
    }
  }

  // Filtered list computed on client side
  const filteredPorts = ports.filter((port) => {
    const matchesSearch =
      port.port_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (port.port_code && port.port_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (port.country?.name && port.country.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === "all" || port.transport_type === filterType;

    return matchesSearch && matchesType;
  });

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  function getTransportIcon(mode: "sea" | "road" | "air") {
    switch (mode) {
      case "sea":
        return <Anchor className="h-4 w-4" />;
      case "road":
        return <Truck className="h-4 w-4" />;
      case "air":
        return <Plane className="h-4 w-4" />;
    }
  }

  function getTransportLabel(mode: "sea" | "road" | "air") {
    switch (mode) {
      case "sea":
        return "Sea Port";
      case "road":
        return "Road Border";
      case "air":
        return "Airport";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Settings / Master Forms
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Port / Boundary
        </Button>
      </div>

      {/* Main Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Filters & Table Card */}
      <div className="rounded-lg border bg-card shadow-sm">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, country..."
              className="pl-9"
            />
          </div>
          
          <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 p-1">
            <button
              onClick={() => setFilterType("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                filterType === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setFilterType("sea")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                filterType === "sea" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Anchor className="h-3.5 w-3.5" />
              Sea Port
            </button>
            <button
              onClick={() => setFilterType("road")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                filterType === "road" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              Road Border
            </button>
            <button
              onClick={() => setFilterType("air")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                filterType === "air" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plane className="h-3.5 w-3.5" />
              Airport
            </button>
          </div>
        </div>

        {/* Data Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70 mb-3" />
            <p className="text-sm font-semibold">Loading ports master records...</p>
          </div>
        ) : filteredPorts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="mb-3 rounded-lg border-2 border-dashed p-6">
              <Anchor className="h-8 w-8 mx-auto text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold">No records found</p>
            <p className="text-xs mt-1">Try resetting filters or add a new record to get started.</p>
          </div>
        ) : (
          /* Responsive Table */
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Name / Label</th>
                  <th className="px-5 py-3">Transport Mode</th>
                  <th className="px-5 py-3">Country</th>
                  <th className="px-5 py-3">Port Code</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPorts.map((port) => (
                  <tr key={port.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {port.port_name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 border px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {getTransportIcon(port.transport_type)}
                        {getTransportLabel(port.transport_type)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {port.country ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          {port.country.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {port.port_code || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          port.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {port.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(port)}
                          className="h-8 w-8 p-0"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(port)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <SimpleModal
          title={editingPort ? `Edit ${getTransportLabel(formTransportType)}` : `Create New Port/Bound`}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Port/Bound Name */}
            <div className="space-y-1.5">
              <Label htmlFor="portName" className="text-xs font-bold uppercase tracking-wider">
                Name / Label *
              </Label>
              <Input
                id="portName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Karachi Port, Taftan Border, Heathrow Airport"
                autoFocus
              />
            </div>

            {/* Transport Mode */}
            <div className="space-y-1.5">
              <Label htmlFor="transportType" className="text-xs font-bold uppercase tracking-wider">
                Transport Mode / Type
              </Label>
              <select
                id="transportType"
                value={formTransportType}
                onChange={(e) => setFormTransportType(e.target.value as any)}
                className={selectClass}
              >
                <option value="sea">Sea (Sea Port)</option>
                <option value="road">Road (Border Crossing / Checkpoint)</option>
                <option value="air">Air (Airport)</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Country Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs font-bold uppercase tracking-wider">
                  Country
                </Label>
                <select
                  id="country"
                  value={formCountryId}
                  onChange={(e) => setFormCountryId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select Country (Optional)</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Port Code */}
              <div className="space-y-1.5">
                <Label htmlFor="portCode" className="text-xs font-bold uppercase tracking-wider">
                  Port Code / Abbreviation
                </Label>
                <Input
                  id="portCode"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. KHI, LHR, TFN"
                />
              </div>
            </div>

            {/* Is Active Checkbox */}
            <div className="flex items-center gap-2 pt-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isActive" className="text-xs font-semibold select-none cursor-pointer">
                This record is Active and available for selection
              </Label>
            </div>

            {/* Modal Error */}
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                {formError}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formName.trim()}>
                {saving ? "Saving..." : editingPort ? "Save Changes" : "Create Record"}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}
