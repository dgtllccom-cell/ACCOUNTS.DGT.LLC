"use client";

import { useEffect, useState } from "react";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import type { MasterParameterCategory } from "@/lib/services/master-parameters-service";

export type MasterLocationSelectProps = {
  category?: MasterParameterCategory;
  countryId?: string | null;
  countryIso2?: string | null;
  countryName?: string | null;
  placeholder?: string;
  value?: string;
  onChange: (officialName: string, option?: SearchableSelectOption) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Reusable Master Parameters Location Select Component
 *
 * Enforces single source of truth selection for all Locations, Seaports, Dry Ports,
 * Airports, Border Crossings, Free Zones, and Industrial Zones across the ERP.
 * Automatically filters by country and displays complete official names only.
 */
export function MasterLocationSelect({
  category,
  countryId,
  countryIso2,
  countryName,
  placeholder = "Select Location / Port...",
  value,
  onChange,
  disabled = false,
  className
}: MasterLocationSelectProps) {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (countryId) params.set("countryId", countryId);
        if (countryIso2) params.set("countryIso2", countryIso2);
        if (countryName) params.set("countryName", countryName);

        const res = await fetch(`/api/erp/master-data/locations?${params.toString()}`);
        const data = await res.json();

        if (isMounted && data.ok && Array.isArray(data.data?.locations)) {
          const mappedOptions: SearchableSelectOption[] = data.data.locations.map((loc: any) => ({
            id: loc.id,
            label: loc.official_name,
            sublabel: `${loc.country_name} (${loc.category.replace("_", " ").toUpperCase()})`,
            raw: loc
          }));
          setOptions(mappedOptions);
        }
      } catch {
        // Handle network error
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOptions();

    return () => {
      isMounted = false;
    };
  }, [category, countryId, countryIso2, countryName]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={(selectedVal, selectedOption) => {
        onChange(selectedOption?.label || selectedVal, selectedOption);
      }}
      placeholder={loading ? "Loading Master Locations..." : placeholder}
      disabled={disabled || loading}
      className={className}
    />
  );
}
