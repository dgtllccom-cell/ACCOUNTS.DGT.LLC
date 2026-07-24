"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleModal } from "@/components/ui/simple-modal";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { supportedLanguages } from "@/lib/i18n/languages";

type CountryRow = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  is_active: boolean;
};

type StateRow = { id: string; country_id: string; name: string; code: string | null; is_active: boolean };
type CityRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  name: string;
  code: string | null;
  zip_code: string | null;
  is_active: boolean;
};
type AreaRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message || `Request failed: ${res.status}`);
  return (json?.data ?? json) as T;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message || `Request failed: ${res.status}`);
  return (json?.data ?? json) as T;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function pillClassName() {
  return "inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-slate-700 dark:text-slate-200";
}

export function LocationSetup({ lang = "en" }: { lang?: SupportedLanguage }) {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [countryId, setCountryId] = useState<string>("");

  const [states, setStates] = useState<StateRow[]>([]);
  const [stateId, setStateId] = useState<string>("");

  const [cities, setCities] = useState<CityRow[]>([]);
  const [cityId, setCityId] = useState<string>("");

  const [areas, setAreas] = useState<AreaRow[]>([]);

  const [modal, setModal] = useState<null | "country" | "state" | "city" | "area">(null);

  // New Country form
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryIso2, setNewCountryIso2] = useState("");
  const [newCountryIso3, setNewCountryIso3] = useState("");
  const [newCountryCurrency, setNewCountryCurrency] = useState("USD");
  const [newCountryLang, setNewCountryLang] = useState<SupportedLanguage>("en");

  // New State form
  const [newStateName, setNewStateName] = useState("");
  const [newStateCode, setNewStateCode] = useState("");

  // New City form
  const [newCityName, setNewCityName] = useState("");
  const [newCityCode, setNewCityCode] = useState("");
  const [newCityZip, setNewCityZip] = useState("");

  // New Area form
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCode, setNewAreaCode] = useState("");

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedState = useMemo(() => states.find((s) => s.id === stateId) ?? null, [states, stateId]);
  const selectedCity = useMemo(() => cities.find((c) => c.id === cityId) ?? null, [cities, cityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qp = new URLSearchParams();
        const q = normalizeText(countrySearch);
        if (q) qp.set("q", q);
        const data = await apiGet<{ countries: CountryRow[] }>(`/api/erp/locations/countries?${qp.toString()}`);
        if (cancelled) return;
        setCountries(data.countries ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setBanner({ tone: "err", text: e.message || "Failed to load countries" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countrySearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStates([]);
      setStateId("");
      setCities([]);
      setCityId("");
      setAreas([]);
      if (!countryId) return;
      try {
        const qp = new URLSearchParams({ countryId });
        const data = await apiGet<{ states: StateRow[] }>(`/api/erp/locations/states?${qp.toString()}`);
        if (cancelled) return;
        setStates(data.states ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setBanner({ tone: "err", text: e.message || "Failed to load states" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCities([]);
      setCityId("");
      setAreas([]);
      if (!countryId || !stateId) return;
      try {
        const qp = new URLSearchParams({ countryId, stateProvinceId: stateId });
        const data = await apiGet<{ cities: CityRow[] }>(`/api/erp/locations/cities?${qp.toString()}`);
        if (cancelled) return;
        setCities(data.cities ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setBanner({ tone: "err", text: e.message || "Failed to load cities" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId, stateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAreas([]);
      if (!cityId) return;
      try {
        const qp = new URLSearchParams({ cityId });
        const data = await apiGet<{ areas: AreaRow[] }>(`/api/erp/locations/areas?${qp.toString()}`);
        if (cancelled) return;
        setAreas(data.areas ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setBanner({ tone: "err", text: e.message || "Failed to load areas" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  async function addCountry() {
    const name = normalizeText(newCountryName);
    if (!name) return;
    setBanner(null);
    const country = await apiPost<{ country: CountryRow }>("/api/erp/locations/countries", {
      name,
      iso2: newCountryIso2 || null,
      iso3: newCountryIso3 || null,
      currencyCode: newCountryCurrency,
      defaultLanguageCode: newCountryLang
    });

    setCountries((current) => [...current, country.country].sort((a, b) => a.name.localeCompare(b.name)));
    setCountryId(country.country.id);
    setModal(null);
    setNewCountryName("");
    setNewCountryIso2("");
    setNewCountryIso3("");
    setNewCountryCurrency("USD");
    setNewCountryLang("en");
    setBanner({ tone: "ok", text: "Country saved." });
  }

  async function addState() {
    if (!countryId) return;
    const name = normalizeText(newStateName);
    if (!name) return;
    setBanner(null);
    const res = await apiPost<{ state: StateRow }>("/api/erp/locations/states", {
      countryId,
      name,
      code: newStateCode || null
    });
    setStates((current) =>
      [res.state, ...current.filter((state) => state.id !== res.state.id)].sort((a, b) => a.name.localeCompare(b.name))
    );
    setStateId(res.state.id);
    setModal(null);
    setNewStateName("");
    setNewStateCode("");
    setBanner({ tone: "ok", text: "State saved." });
  }

  async function addCity() {
    if (!countryId || !stateId) return;
    const name = normalizeText(newCityName);
    if (!name) return;
    setBanner(null);
    const res = await apiPost<{ city: CityRow }>("/api/erp/locations/cities", {
      countryId,
      stateProvinceId: stateId,
      name,
      code: newCityCode || null,
      zipCode: newCityZip || null
    });
    setCities((current) =>
      [res.city, ...current.filter((city) => city.id !== res.city.id)].sort((a, b) => a.name.localeCompare(b.name))
    );
    setCityId(res.city.id);
    setModal(null);
    setNewCityName("");
    setNewCityCode("");
    setNewCityZip("");
    setBanner({ tone: "ok", text: "City saved." });
  }

  async function addArea() {
    if (!countryId || !cityId) return;
    const name = normalizeText(newAreaName);
    if (!name) return;
    setBanner(null);
    const res = await apiPost<{ area: AreaRow }>("/api/erp/locations/areas", {
      countryId,
      stateProvinceId: stateId || null,
      cityId,
      name,
      code: newAreaCode || null
    });
    setAreas((current) => [...current, res.area].sort((a, b) => a.name.localeCompare(b.name)));
    setModal(null);
    setNewAreaName("");
    setNewAreaCode("");
    setBanner({ tone: "ok", text: "Area saved." });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Location Management</h1>
          <p className="text-sm text-muted-foreground">
            Centralized Country → State/Province → City → Area master data. Create once, reuse everywhere.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setModal("country")}>
            <Plus className="h-4 w-4" aria-hidden /> Add Country
          </Button>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" aria-hidden />
                <CardTitle>Directory</CardTitle>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search countries..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : countries.length ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {countries.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCountryId(c.id)}
                    className={
                      c.id === countryId
                        ? "rounded-lg border bg-muted px-4 py-3 text-left"
                        : "rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/60"
                    }
                  >
                    <p className="text-sm font-bold text-slate-950">{c.name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">
                      {(c.iso3 || c.iso2 || "CTR").toUpperCase()} - {c.currency_code}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No countries found.</p>
            )}

            <div className="mt-5 grid gap-4 rounded-lg border bg-muted/20 p-4 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Selected Country</p>
                <p className="mt-1 font-semibold">{selectedCountry?.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Currency</p>
                <p className="mt-1 font-semibold">{selectedCountry?.currency_code || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Default Language</p>
                <p className="mt-1 font-semibold">{selectedCountry?.default_language_code || "en"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden />
                  <CardTitle>Hierarchy</CardTitle>
                </div>
                <span className={pillClassName()}>
                  <b>Country:</b> <span>{selectedCountry?.name || "-"}</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>State / Province</Label>
                  <Button type="button" variant="outline" size="sm" className="h-8" disabled={!countryId} onClick={() => setModal("state")}>
                    <Plus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
                <select
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  disabled={!countryId}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                >
                  <option value="">Select state</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>City</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!countryId || !stateId}
                    onClick={() => setModal("city")}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  disabled={!countryId || !stateId}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.zip_code ? `(${c.zip_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Area / Location</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!countryId || !cityId}
                    onClick={() => setModal("area")}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add
                  </Button>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  {areas.length ? (
                    <ul className="ms-4 list-disc">
                      {areas.slice(0, 10).map((a) => (
                        <li key={a.id}>
                          {a.name}
                          {a.code ? ` (${a.code})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No areas for this city.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
                Selected: {selectedCountry?.name || "-"} → {selectedState?.name || "-"} → {selectedCity?.name || "-"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {modal === "country" ? (
        <SimpleModal title="Add Country" onClose={() => setModal(null)} className="max-w-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Country Name</Label>
              <Input value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)} placeholder="Pakistan" />
            </div>
            <div className="space-y-2">
              <Label>ISO2</Label>
              <Input value={newCountryIso2} onChange={(e) => setNewCountryIso2(e.target.value)} placeholder="PK" />
            </div>
            <div className="space-y-2">
              <Label>ISO3</Label>
              <Input value={newCountryIso3} onChange={(e) => setNewCountryIso3(e.target.value)} placeholder="PAK" />
            </div>
            <div className="space-y-2">
              <Label>Currency Code</Label>
              <Input value={newCountryCurrency} onChange={(e) => setNewCountryCurrency(e.target.value)} placeholder="PKR" />
            </div>
            <div className="space-y-2">
              <Label>Default Language</Label>
              <select
                value={newCountryLang}
                onChange={(e) => setNewCountryLang(e.target.value as SupportedLanguage)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              >
                {supportedLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.englishName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={addCountry} disabled={!newCountryName.trim() || !newCountryCurrency.trim()}>
              Save
            </Button>
          </div>
        </SimpleModal>
      ) : null}

      {modal === "state" ? (
        <SimpleModal title="Add State / Province" onClose={() => setModal(null)} className="max-w-lg">
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={selectedCountry?.name || ""} readOnly className="bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label>State / Province Name</Label>
            <Input value={newStateName} onChange={(e) => setNewStateName(e.target.value)} placeholder="Balochistan" />
          </div>
          <div className="space-y-2">
            <Label>State Code (optional)</Label>
            <Input value={newStateCode} onChange={(e) => setNewStateCode(e.target.value)} placeholder="BAL" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={addState} disabled={!newStateName.trim()}>
              Save
            </Button>
          </div>
        </SimpleModal>
      ) : null}

      {modal === "city" ? (
        <SimpleModal title="Add City" onClose={() => setModal(null)} className="max-w-lg">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={selectedCountry?.name || ""} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={selectedState?.name || ""} readOnly className="bg-muted/50" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>City Name</Label>
            <Input value={newCityName} onChange={(e) => setNewCityName(e.target.value)} placeholder="Chaman" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>City Code (optional)</Label>
              <Input value={newCityCode} onChange={(e) => setNewCityCode(e.target.value)} placeholder="CHM" />
            </div>
            <div className="space-y-2">
              <Label>Zip / Postal Code (optional)</Label>
              <Input value={newCityZip} onChange={(e) => setNewCityZip(e.target.value)} placeholder="86000" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={addCity} disabled={!newCityName.trim()}>
              Save
            </Button>
          </div>
        </SimpleModal>
      ) : null}

      {modal === "area" ? (
        <SimpleModal title="Add Area / Location" onClose={() => setModal(null)} className="max-w-lg">
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={selectedCity?.name || ""} readOnly className="bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label>Area / Location Name</Label>
            <Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Main Bazaar" />
          </div>
          <div className="space-y-2">
            <Label>Area Code (optional)</Label>
            <Input value={newAreaCode} onChange={(e) => setNewAreaCode(e.target.value)} placeholder="MBZ" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={addArea} disabled={!newAreaName.trim()}>
              Save
            </Button>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}
