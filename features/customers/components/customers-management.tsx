"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api/client";
import {
  LocationHierarchySelect,
  type LocationHierarchyMeta,
  type LocationHierarchyValue
} from "@/features/locations/components/location-hierarchy-select";
import { ContactNumberInput } from "@/components/ui/contact-number-input";

type CustomerRow = {
  id: string;
  customer_name: string;
  company_name: string | null;
  mobile: string | null;
  email: string | null;
  created_at: string;
};

function pillClassName() {
  return "inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-slate-700 dark:text-slate-200";
}

export function CustomersManagement() {
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [location, setLocation] = useState<LocationHierarchyValue>({
    countryId: "",
    stateProvinceId: "",
    cityId: "",
    areaId: ""
  });
  const [locationMeta, setLocationMeta] = useState<LocationHierarchyMeta>({
    country: null,
    state: null,
    city: null,
    area: null
  });

  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const previewLocation = useMemo(() => {
    const parts = [
      locationMeta.area?.name,
      locationMeta.city?.name,
      locationMeta.state?.name,
      locationMeta.country?.name
    ].filter(Boolean);
    return parts.length ? parts.join(" \u00b7 ") : "-";
  }, [locationMeta]);

  const canSave = Boolean(location.countryId && customerName.trim().length >= 2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setBanner(null);
      try {
        const qp = new URLSearchParams();
        const q = search.trim();
        if (q) qp.set("q", q);
        if (location.countryId) qp.set("countryId", location.countryId);
        qp.set("limit", "20");

        const data = await apiGet<{ customers: CustomerRow[] }>(`/api/erp/customers?${qp.toString()}`);
        if (!cancelled) setCustomers(data.customers ?? []);
      } catch (e: any) {
        if (!cancelled) setBanner({ tone: "err", text: e.message || "Failed to load customers" });
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, location.countryId]);

  async function onSave() {
    setBanner(null);
    if (!canSave) {
      setBanner({ tone: "err", text: "Select a country and enter Customer Name (min 2 chars)." });
      return;
    }

    setSaving(true);
    try {
      await apiPost<{ customerId: string }>(`/api/erp/customers`, {
        countryId: location.countryId,
        countryBranchId: null,
        cityBranchId: null,
        stateProvinceId: location.stateProvinceId || null,
        cityId: location.cityId || null,
        areaLocationId: location.areaId || null,
        customerName: customerName.trim(),
        companyName: companyName.trim() || null,
        contactPerson: contactPerson.trim() || null,
        mobile: mobile.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        originalLanguage: "en",
        contacts: [],
        registrations: []
      });

      setCustomerName("");
      setCompanyName("");
      setContactPerson("");
      setMobile("");
      setWhatsapp("");
      setEmail("");
      setAddress("");
      setNotes("");
      setBanner({ tone: "ok", text: "Customer saved." });

      // refresh list
      setSearch((s) => s);
    } catch (e: any) {
      setBanner({ tone: "err", text: e.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Centralized Customer master-data. Location is selected from Location Setup and reused everywhere.
          </p>
        </div>
        <span className={pillClassName()}>
          <b>Status:</b> <span>{canSave ? "Ready" : "Draft"}</span>
        </span>
      </div>

      {banner ? (
        <div
          className={
            banner.tone === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
              : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>New Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <LocationHierarchySelect
                value={location}
                onChange={(next, meta) => {
                  setLocation(next);
                  setLocationMeta(meta);
                }}
                showArea
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name (optional)" />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact person (optional)" />
              </div>
              <div className="space-y-2">
                <ContactNumberInput
                  label="Mobile"
                  countryId={location.countryId || null}
                  contactTypeKey="mobile"
                  value={mobile}
                  onValueChange={setMobile}
                  placeholder="3001234567"
                />
              </div>
              <div className="space-y-2">
                <ContactNumberInput
                  label="WhatsApp"
                  countryId={location.countryId || null}
                  contactTypeKey="whatsapp"
                  value={whatsapp}
                  onValueChange={setWhatsapp}
                  placeholder="3001234567"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={onSave} disabled={!canSave || saving}>
                <Save className="h-4 w-4" aria-hidden />
                {saving ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Live Preview</CardTitle>
                <span className={pillClassName()}>
                  <b>Zip:</b> <span>{locationMeta.city?.zip_code ?? "-"}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" aria-hidden />
                  <b>{customerName || "Customer Name"}</b>
                </div>
                <div>
                  <b>Company:</b> <span className="text-muted-foreground">{companyName || "-"}</span>
                </div>
                <div>
                  <b>Location:</b> <span className="text-muted-foreground">{previewLocation}</span>
                </div>
                <div>
                  <b>Mobile:</b> <span className="text-muted-foreground">{mobile || "-"}</span>
                </div>
                <div>
                  <b>Email:</b> <span className="text-muted-foreground">{email || "-"}</span>
                </div>
                <div>
                  <b>Address:</b> <span className="text-muted-foreground">{address || "-"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Recent Customers</CardTitle>
                <div className="relative w-[180px]">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 pl-8" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingList ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : customers.length ? (
                <div className="space-y-2">
                  {customers.slice(0, 10).map((c) => (
                    <div key={c.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate">{c.customer_name}</b>
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {(c.company_name || "-") + " \u00b7 " + (c.mobile || c.email || "-")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No customers found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
