"use client";

import { useEffect, useState } from "react";
import { DashboardFrame } from "@/components/layout/dashboard-frame";
import { Anchor, Truck, Plane, Navigation, Plus, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw, FileText } from "lucide-react";
import { Th } from "@/components/ui/translated-th";

type TransportMode = "by_sea" | "by_road" | "by_truck" | "by_air";
type MovementType = "import" | "transit" | "export";

export default function CustomerOrderPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    route_name: "",
    shipment_type: "FCL",
    transport_mode: "by_sea" as TransportMode,
    movement_type: "import" as MovementType,
    loading_country_id: "",
    loading_country_name: "",
    receiving_country_id: "",
    receiving_country_name: "",
    loading_port_id: "",
    loading_port_name: "",
    destination_port_id: "",
    destination_port_name: "",
    cargo_details: "",
    expected_loading_date: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [ordRes, custRes, ctyRes, portRes] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/customers"),
        fetch("/api/erp/locations/countries"),
        fetch("/api/erp/ports"),
      ]);

      const [ordData, custData, ctyData, portData] = await Promise.all([
        ordRes.json(),
        custRes.json(),
        ctyRes.json(),
        portRes.json(),
      ]);

      if (ordData.success) setOrders(ordData.data || []);
      if (custData.success) setCustomers(custData.data || []);
      if (ctyData.success) setCountries(ctyData.data || []);
      if (portData.success) setPorts(portData.data || []);
    } catch (err) {
      console.error("Error loading master data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    setFormData((prev) => ({
      ...prev,
      customer_id: customerId,
      customer_name: cust ? cust.customer_name || cust.company_name : "",
    }));
  };

  const handleLoadingCountryChange = (countryId: string) => {
    const c = countries.find((item) => item.id === countryId);
    setFormData((prev) => ({
      ...prev,
      loading_country_id: countryId,
      loading_country_name: c ? c.name : "",
    }));
  };

  const handleReceivingCountryChange = (countryId: string) => {
    const c = countries.find((item) => item.id === countryId);
    setFormData((prev) => ({
      ...prev,
      receiving_country_id: countryId,
      receiving_country_name: c ? c.name : "",
    }));
  };

  const handleLoadingPortChange = (portId: string) => {
    const p = ports.find((item) => item.id === portId);
    setFormData((prev) => ({
      ...prev,
      loading_port_id: portId,
      loading_port_name: p ? p.port_name : "",
    }));
  };

  const handleDestinationPortChange = (portId: string) => {
    const p = ports.find((item) => item.id === portId);
    setFormData((prev) => ({
      ...prev,
      destination_port_id: portId,
      destination_port_name: p ? p.port_name : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name) {
      alert("Please select or enter a Customer");
      return;
    }

    setSaving(true);
    setSuccessMessage("");
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSuccessMessage(`Order ${data.data.order_no} created successfully! (Stored in 5 Dedicated Language Tables)`);
      setFormData({
        customer_id: "",
        customer_name: "",
        route_name: "",
        shipment_type: "FCL",
        transport_mode: "by_sea",
        movement_type: "import",
        loading_country_id: "",
        loading_country_name: "",
        receiving_country_id: "",
        receiving_country_name: "",
        loading_port_id: "",
        loading_port_name: "",
        destination_port_id: "",
        destination_port_name: "",
        cargo_details: "",
        expected_loading_date: new Date().toISOString().split("T")[0],
        remarks: "",
      });
      fetchInitialData();
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardFrame title="Clearing Agent Customer Order" subtitle="Initial Order Entry for Clearing & Shipping Logistics">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-indigo-500/30">
                  Clearing Agent Step 1
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/30">
                  5-Language Architecture Sync
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Customer Order Form</h1>
              <p className="text-slate-400 text-sm">
                Register customer clearing orders to initiate transport workflow (By Sea, By Road, By Truck, By Air).
              </p>
            </div>
            <button
              onClick={fetchInitialData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Orders
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}

        {/* Customer Order Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Order Identification & Transport Selection
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Customer Selection *</label>
              {customers.length > 0 ? (
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select Registered Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name || c.company_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter Customer Name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              )}
            </div>

            {/* Transport Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Transport Mode *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "by_sea", label: "By Sea", icon: Anchor },
                  { key: "by_road", label: "By Road", icon: Navigation },
                  { key: "by_truck", label: "By Truck", icon: Truck },
                  { key: "by_air", label: "By Air", icon: Plane },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, transport_mode: key as TransportMode })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      formData.transport_mode === key
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Movement Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Movement Type *</label>
              <select
                value={formData.movement_type}
                onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as MovementType })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="import">Import Loading</option>
                <option value="transit">Transit Loading</option>
                <option value="export">Export Loading</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Shipment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Shipment Type</label>
              <select
                value={formData.shipment_type}
                onChange={(e) => setFormData({ ...formData, shipment_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="FCL">FCL (Full Container Load)</option>
                <option value="LCL">LCL (Less than Container)</option>
                <option value="Loose Cargo">Loose Cargo</option>
                <option value="Bulk Cargo">Bulk Cargo</option>
              </select>
            </div>

            {/* Route Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Route Selection</label>
              <input
                type="text"
                placeholder="e.g. Karachi to Kabul via Torkham"
                value={formData.route_name}
                onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Expected Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Expected Loading Date</label>
              <input
                type="date"
                value={formData.expected_loading_date}
                onChange={(e) => setFormData({ ...formData, expected_loading_date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Container / Cargo Details */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Container / Cargo Details</label>
              <input
                type="text"
                placeholder="e.g. 40ft High Cube Container"
                value={formData.cargo_details}
                onChange={(e) => setFormData({ ...formData, cargo_details: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Loading Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Loading Country</label>
              <select
                value={formData.loading_country_id}
                onChange={(e) => handleLoadingCountryChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Loading Country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Receiving Country */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Receiving Country</label>
              <select
                value={formData.receiving_country_id}
                onChange={(e) => handleReceivingCountryChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Receiving Country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading Port */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Loading Port</label>
              <select
                value={formData.loading_port_id}
                onChange={(e) => handleLoadingPortChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Loading Port</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.port_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Port */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Destination Port</label>
              <select
                value={formData.destination_port_id}
                onChange={(e) => handleDestinationPortChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Destination Port</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.port_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Remarks</label>
            <textarea
              rows={2}
              placeholder="Additional instructions or notes..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Customer Order (5 Languages Auto-Stored)
            </button>
          </div>
        </form>

        {/* Existing Customer Orders Register */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-white">Registered Customer Orders ({orders.length})</h2>
            <span className="text-xs text-slate-400">Ready for General Loading Workflow</span>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No customer orders created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <Th className="px-4 py-3">Order No</Th>
                    <Th className="px-4 py-3">Customer</Th>
                    <Th className="px-4 py-3">Transport Mode</Th>
                    <Th className="px-4 py-3">Type</Th>
                    <Th className="px-4 py-3">Route</Th>
                    <Th className="px-4 py-3">Status</Th>
                    <Th className="px-4 py-3 text-right">Created</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-indigo-400">{o.order_no}</td>
                      <td className="px-4 py-3 font-medium text-white">{o.customer_name}</td>
                      <td className="px-4 py-3 capitalize">
                        <span className="bg-slate-800 text-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          {o.transport_mode?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        <span className="text-xs font-medium text-slate-300">{o.movement_type} ({o.shipment_type})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{o.route_name || `${o.loading_country_name || "-"} → ${o.receiving_country_name || "-"}`}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            o.status === "pending"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardFrame>
  );
}
