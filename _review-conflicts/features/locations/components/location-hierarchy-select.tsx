"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api/client";
import {
  listAreas,
  listCities,
  listCountries,
  listStates,
  listDistricts,
  type LocationArea,
  type LocationCity,
  type LocationCountry,
  type LocationState,
  type LocationDistrict
} from "@/features/locations/location-api";

export type LocationHierarchyValue = {
  countryId: string;
  stateProvinceId: string;
  districtId: string;
  cityId: string;
  areaId?: string;
};

export type LocationHierarchyMeta = {
  country: LocationCountry | null;
  state: LocationState | null;
  district: LocationDistrict | null;
  city: LocationCity | null;
  area: LocationArea | null;
};

function toOptions<T extends { id: string; name: string }>(rows: T[]): SearchSelectOption[] {
  return rows.map((row) => {
    const anyRow = row as any;
    const keywords = [
      anyRow.code,
      anyRow.iso2,
      anyRow.iso3,
      anyRow.currency_code,
      anyRow.zip_code,
      anyRow.postal_code,
      anyRow.phone_code,
      anyRow.phone_area_code
    ]
      .filter(Boolean)
      .join(" ");
    return { value: row.id, label: row.name, keywords };
  });
}

export function LocationHierarchySelect({
  value,
  onChange,
  showArea = false,
  showCountry = true,
  showState = true,
  showDistrict = true,
  showCity = true,
  allowManageLink = true,
  disabled = false
}: {
  value: LocationHierarchyValue;
  onChange: (next: LocationHierarchyValue, meta: LocationHierarchyMeta) => void;
  showArea?: boolean;
  showCountry?: boolean;
  showState?: boolean;
  showDistrict?: boolean;
  showCity?: boolean;
  allowManageLink?: boolean;
  disabled?: boolean;
}) {
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [states, setStates] = useState<LocationState[]>([]);
  const [districts, setDistricts] = useState<LocationDistrict[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [areas, setAreas] = useState<LocationArea[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [openCreateType, setOpenCreateType] = useState<"country" | "state" | "district" | "city" | "area" | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === value.countryId) ?? null,
    [countries, value.countryId]
  );
  const selectedState = useMemo(
    () => states.find((s) => s.id === value.stateProvinceId) ?? null,
    [states, value.stateProvinceId]
  );
  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === value.districtId) ?? null,
    [districts, value.districtId]
  );
  const selectedCity = useMemo(
    () => cities.find((c) => c.id === value.cityId) ?? null,
    [cities, value.cityId]
  );
  const selectedArea = useMemo(
    () => (value.areaId ? areas.find((a) => a.id === value.areaId) ?? null : null),
    [areas, value.areaId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries();
        if (!cancelled) setCountries(rows);
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStates([]);
    setDistricts([]);
    setCities([]);
    setAreas([]);
    if (!value.countryId) return;

    (async () => {
      setLoadingStates(true);
      try {
        const rows = await listStates({ countryId: value.countryId });
        if (!cancelled) setStates(rows);
      } finally {
        if (!cancelled) setLoadingStates(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value.countryId]);

  useEffect(() => {
    let cancelled = false;
    setDistricts([]);
    setCities([]);
    setAreas([]);
    if (!value.stateProvinceId) return;

    (async () => {
      setLoadingDistricts(true);
      try {
        const rows = await listDistricts({ stateProvinceId: value.stateProvinceId });
        if (!cancelled) setDistricts(rows);
      } finally {
        if (!cancelled) setLoadingDistricts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value.stateProvinceId]);

  useEffect(() => {
    let cancelled = false;
    setCities([]);
    setAreas([]);
    if (!value.countryId) return;
    if (!value.stateProvinceId) return;

    (async () => {
      setLoadingCities(true);
      try {
        const rows = await listCities({
          countryId: value.countryId,
          stateProvinceId: value.stateProvinceId,
          districtId: value.districtId || null
        });
        if (!cancelled) setCities(rows);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value.countryId, value.stateProvinceId, value.districtId]);

  useEffect(() => {
    let cancelled = false;
    setAreas([]);
    if (!showArea) return;
    if (!value.cityId) return;

    (async () => {
      setLoadingAreas(true);
      try {
        const rows = await listAreas({ cityId: value.cityId });
        if (!cancelled) setAreas(rows);
      } finally {
        if (!cancelled) setLoadingAreas(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showArea, value.cityId]);

  const meta: LocationHierarchyMeta = {
    country: selectedCountry,
    state: selectedState,
    district: selectedDistrict,
    city: selectedCity,
    area: selectedArea
  };

  useEffect(() => {
    if (!value.countryId && !value.stateProvinceId && !value.districtId && !value.cityId && !value.areaId) return;
    onChange(value, meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, selectedState, selectedDistrict, selectedCity, selectedArea]);

  // Construct layouts based on shown columns
  const firstRowItems = [];
  if (showCountry) firstRowItems.push("country");
  if (showState) firstRowItems.push("state");
  if (showDistrict) firstRowItems.push("district");

  const secondRowItems = [];
  if (showCity) secondRowItems.push("city");
  if (showArea) secondRowItems.push("area");

  return (
    <div className="space-y-3">
      {firstRowItems.length > 0 ? (
        <div className={`grid gap-3 md:grid-cols-${firstRowItems.length}`}>
          {showCountry && (
            <div className="space-y-2">
              <SearchSelect
                label={loadingCountries ? "Country (Loading...)" : "Country"}
                value={value.countryId}
                placeholder="Select country"
                disabled={disabled || loadingCountries}
                options={toOptions(countries)}
                onValueChange={(countryId) => {
                  const next: LocationHierarchyValue = { countryId, stateProvinceId: "", districtId: "", cityId: "", areaId: "" };
                  onChange(next, {
                    country: countries.find((c) => c.id === countryId) ?? null,
                    state: null,
                    district: null,
                    city: null,
                    area: null
                  });
                }}
                createLabel="+ New Country"
                createButtonPlacement="both"
                onCreateNew={async () => setOpenCreateType("country")}
              />

              {allowManageLink ? (
                <div className="flex justify-end">
                  <Button asChild type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
                    <Link href="/dashboard/settings/location">
                      Manage Locations <ExternalLink className="ms-1 h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {showState && (
            <SearchSelect
              label={loadingStates ? "State / Province (Loading...)" : "State / Province"}
              value={value.stateProvinceId}
              placeholder={value.countryId ? "Select state" : "Select country first"}
              disabled={disabled || !value.countryId || loadingStates}
              options={toOptions(states)}
              onValueChange={(stateProvinceId) => {
                const next: LocationHierarchyValue = { ...value, stateProvinceId, districtId: "", cityId: "", areaId: "" };
                onChange(next, {
                  ...meta,
                  state: states.find((s) => s.id === stateProvinceId) ?? null,
                  district: null,
                  city: null,
                  area: null
                });
              }}
              createLabel="+ New State"
              createButtonPlacement="both"
              onCreateNew={async () => setOpenCreateType("state")}
            />
          )}

          {showDistrict && (
            <SearchSelect
              label={loadingDistricts ? "District / City (Loading...)" : "District / City"}
              value={value.districtId}
              placeholder={value.stateProvinceId ? "Select district / city" : "Select state first"}
              disabled={disabled || !value.stateProvinceId || loadingDistricts}
              options={toOptions(districts)}
              onValueChange={(districtId) => {
                const next: LocationHierarchyValue = { ...value, districtId, cityId: "", areaId: "" };
                onChange(next, {
                  ...meta,
                  district: districts.find((d) => d.id === districtId) ?? null,
                  city: null,
                  area: null
                });
              }}
              createLabel="+ New District / City"
              createButtonPlacement="both"
              onCreateNew={async () => setOpenCreateType("district")}
            />
          )}
        </div>
      ) : null}

      {secondRowItems.length > 0 ? (
        <div className={`grid gap-3 md:grid-cols-${secondRowItems.length}`}>
          {showCity && (
            <SearchSelect
              label={loadingCities ? "City (Loading...)" : "City"}
              value={value.cityId}
              placeholder={value.stateProvinceId ? "Select city" : "Select state first"}
              disabled={disabled || !value.countryId || !value.stateProvinceId || loadingCities}
              options={toOptions(cities)}
              onValueChange={(cityId) => {
                const next: LocationHierarchyValue = { ...value, cityId, areaId: "" };
                onChange(next, { ...meta, city: cities.find((c) => c.id === cityId) ?? null, area: null });
              }}
              createLabel="+ New City"
              createButtonPlacement="both"
              onCreateNew={async () => setOpenCreateType("city")}
            />
          )}

          {showArea && (
            <div className="space-y-1.5">
              <SearchSelect
                label={loadingAreas ? "Area / Town / Locality / Road (Loading...)" : "Area / Town / Locality / Road"}
                value={value.areaId ?? ""}
                placeholder={value.cityId ? "Select area, locality, road, or street" : "Select city first"}
                disabled={disabled || !value.cityId || loadingAreas}
                options={toOptions(areas)}
                onValueChange={(areaId) => {
                  const next: LocationHierarchyValue = { ...value, areaId };
                  onChange(next, { ...meta, area: areas.find((a) => a.id === areaId) ?? null });
                }}
                createLabel="+ New Area"
                createButtonPlacement="both"
                onCreateNew={async () => setOpenCreateType("area")}
              />
            </div>
          )}
        </div>
      ) : null}

      {openCreateType ? (
        <LocationQuickCreateModal
          type={openCreateType}
          countryId={value.countryId}
          stateProvinceId={value.stateProvinceId}
          districtId={value.districtId}
          cityId={value.cityId}
          onClose={() => setOpenCreateType(null)}
          onCreated={(newId, item) => {
            if (openCreateType === "country") {
              setCountries((cur) => {
                if (cur.some((c) => c.id === item.id)) return cur;
                return [item, ...cur];
              });
              const next: LocationHierarchyValue = { countryId: newId, stateProvinceId: "", districtId: "", cityId: "", areaId: "" };
              onChange(next, {
                country: item,
                state: null,
                district: null,
                city: null,
                area: null
              });
            } else if (openCreateType === "state") {
              setStates((cur) => {
                if (cur.some((s) => s.id === item.id)) return cur;
                return [item, ...cur];
              });
              const next: LocationHierarchyValue = { ...value, stateProvinceId: newId, districtId: "", cityId: "", areaId: "" };
              onChange(next, {
                ...meta,
                state: item,
                district: null,
                city: null,
                area: null
              });
            } else if (openCreateType === "district") {
              setDistricts((cur) => {
                if (cur.some((d) => d.id === item.id)) return cur;
                return [item, ...cur];
              });
              const next: LocationHierarchyValue = { ...value, districtId: newId, cityId: "", areaId: "" };
              onChange(next, {
                ...meta,
                district: item,
                city: null,
                area: null
              });
            } else if (openCreateType === "city") {
              setCities((cur) => {
                if (cur.some((c) => c.id === item.id)) return cur;
                return [item, ...cur];
              });
              const next: LocationHierarchyValue = { ...value, cityId: newId, areaId: "" };
              onChange(next, {
                ...meta,
                city: item,
                area: null
              });
            } else if (openCreateType === "area") {
              setAreas((cur) => {
                if (cur.some((a) => a.id === item.id)) return cur;
                return [item, ...cur];
              });
              const next: LocationHierarchyValue = { ...value, areaId: newId };
              onChange(next, { ...meta, area: item });
            }
            setOpenCreateType(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LocationQuickCreateModal({
  type,
  countryId,
  stateProvinceId,
  districtId,
  cityId,
  onClose,
  onCreated
}: {
  type: "country" | "state" | "district" | "city" | "area" | null;
  countryId?: string;
  stateProvinceId?: string;
  districtId?: string;
  cityId?: string;
  onClose: () => void;
  onCreated: (newId: string, item: any) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Country-specific fields
  const [iso2, setIso2] = useState("");

  // State/District/City/Area-specific fields
  const [code, setCode] = useState("");
  const [zipCode, setZipCode] = useState("");

  const typeLabel =
    type === "district" ? "District / City" :
    type === "area" ? "Area / Town / Locality / Road" :
    type ? type.charAt(0).toUpperCase() + type.slice(1) : "";

  const canSave = useMemo(() => {
    if (type === "country") {
      return Boolean(name.trim() && iso2.trim());
    }
    return Boolean(name.trim());
  }, [type, name, iso2]);

  async function handleSave() {
    if (!canSave || !type) return;
    setSaving(true);
    setError(null);
    try {
      if (type === "country") {
        const res = await apiPost<{ country: LocationCountry }>("/api/erp/locations/countries", {
          name: name.trim(),
          iso2: iso2.trim()
        });
        onCreated(res.country.id, res.country);
      } else if (type === "state") {
        const res = await apiPost<{ state: LocationState }>("/api/erp/locations/states", {
          countryId,
          name: name.trim(),
          code: code.trim() || null
        });
        onCreated(res.state.id, res.state);
      } else if (type === "district") {
        const res = await apiPost<{ district: LocationDistrict }>("/api/erp/locations/districts", {
          countryId,
          stateProvinceId,
          name: name.trim(),
          code: code.trim() || null
        });
        onCreated(res.district.id, res.district);
      } else if (type === "city") {
        const res = await apiPost<{ city: LocationCity }>("/api/erp/locations/cities", {
          countryId,
          stateProvinceId,
          districtId: districtId || null,
          name: name.trim(),
          code: code.trim() || null,
          zipCode: zipCode.trim() || null
        });
        onCreated(res.city.id, res.city);
      } else if (type === "area") {
        const res = await apiPost<{ area: LocationArea }>("/api/erp/locations/areas", {
          countryId,
          stateProvinceId: stateProvinceId || null,
          districtId: districtId || null,
          cityId,
          name: name.trim(),
          code: code.trim() || null,
          postalCode: zipCode.trim() || null
        });
        onCreated(res.area.id, res.area);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  const title = `New ${typeLabel}`;

  return (
    <SimpleModal title={title} onClose={onClose} className="max-w-md">
      {error ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{typeLabel} Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${typeLabel.toLowerCase()} name`}
          />
        </div>

        {type === "country" && (
          <div className="space-y-2">
            <Label>Country Code (ISO2) *</Label>
            <Input
              maxLength={2}
              value={iso2}
              onChange={(e) => setIso2(e.target.value.toUpperCase())}
              placeholder="e.g. PK"
            />
          </div>
        )}

        {(type === "state" || type === "district" || type === "city" || type === "area") && (
          <div className="space-y-2">
            <Label>{typeLabel} Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`Enter ${typeLabel.toLowerCase()} code (optional)`}
            />
          </div>
        )}

        {(type === "city" || type === "area") && (
          <div className="space-y-2">
            <Label>ZIP / Postal Code</Label>
            <Input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="e.g. 10001"
            />
            {type === "area" && (
              <p className="text-[10px] text-slate-500 leading-tight">
                This postal code will be linked to the new area and available for future use with this City + State.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !canSave}>
            <Plus className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

