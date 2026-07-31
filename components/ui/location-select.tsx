"use client";
/**
 * @deprecated Use `LocationHierarchySelect` — the canonical single-source
 * Location component (4-level Country->State->District->City + search + inline
 * New), already used across the ERP. This file is only a thin alias kept for
 * backward compatibility; it contains NO duplicate logic.
 */
export { LocationHierarchySelect as LocationSelect } from "@/features/locations/components/location-hierarchy-select";
export type { LocationHierarchyValue as LocationValue } from "@/features/locations/components/location-hierarchy-select";
