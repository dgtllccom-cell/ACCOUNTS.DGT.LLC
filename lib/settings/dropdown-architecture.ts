export const dropdownSources = [
  "management_parameters",
  "countries",
  "states_provinces",
  "cities",
  "areas_locations",
  "payment_methods",
  "languages",
  "erp_role_templates"
] as const;

export const dependentDropdownFlows = [
  ["country", "state_province", "city", "area_location"],
  ["country", "country_main_branch", "city_branch"],
  ["module", "report_definition"],
  ["role", "permission_group"]
] as const;

export type DropdownSource = (typeof dropdownSources)[number];

export type DropdownConfig = {
  source: DropdownSource;
  parameterCode?: string;
  countryId?: string;
  parentValueId?: string;
  allowCreate?: boolean;
  languageCode?: string;
};

export const dropdownFallbackOrder = ["user_language", "english", "original_text"] as const;

