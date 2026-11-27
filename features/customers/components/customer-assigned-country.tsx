"use client";

import { AssignedCountrySelect } from "@/features/locations/components/assigned-country-select";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/** Operational choices must never be sourced from the physical address selector. */
export function CustomerAssignedCountry(props: {
  lang: SupportedLanguage;
  value: string;
  onChange: (id: string) => void;
  fixedCountryId?: string | null;
}) {
  return <AssignedCountrySelect {...props} />;
}
