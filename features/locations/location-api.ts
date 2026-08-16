"use client";

import { apiGet } from "@/lib/api/client";

export type LocationCountry = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  phone_code: string | null;
  is_active: boolean;
};

export type LocationState = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type LocationDistrict = {
  id: string;
  country_id: string;
  state_province_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type LocationCity = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  name: string;
  code: string | null;
  zip_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

export type LocationArea = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string;
  name: string;
  code: string | null;
  postal_code: string | null;
  phone_area_code: string | null;
  is_active: boolean;
};

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache for location reference data

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && item.expiresAt > Date.now()) {
    return item.data as T;
  }
  cache.delete(key);
  return null;
}

function setCached(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateLocationCache() {
  cache.clear();
}

export async function listCountries(params?: { q?: string }) {
  const qp = new URLSearchParams();
  if (params?.q) qp.set("q", params.q);
  const cacheKey = `countries:${qp.toString()}`;
  const cached = getCached<LocationCountry[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<{ countries: LocationCountry[] }>(`/api/erp/locations/countries?${qp.toString()}`);
  const countries = res.countries ?? [];
  setCached(cacheKey, countries);
  return countries;
}

export async function listStates(params: { countryId: string; q?: string }) {
  if (!params.countryId) return [];
  const qp = new URLSearchParams({ countryId: params.countryId });
  if (params.q) qp.set("q", params.q);
  const cacheKey = `states:${qp.toString()}`;
  const cached = getCached<LocationState[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<{ states: LocationState[] }>(`/api/erp/locations/states?${qp.toString()}`);
  const states = res.states ?? [];
  setCached(cacheKey, states);
  return states;
}

export async function listDistricts(params: { countryId?: string; stateProvinceId?: string; q?: string }) {
  if (!params.countryId && !params.stateProvinceId) return [];
  const qp = new URLSearchParams();
  if (params.countryId) qp.set("countryId", params.countryId);
  if (params.stateProvinceId) qp.set("stateProvinceId", params.stateProvinceId);
  if (params.q) qp.set("q", params.q);
  const cacheKey = `districts:${qp.toString()}`;
  const cached = getCached<LocationDistrict[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<{ districts: LocationDistrict[] }>(`/api/erp/locations/districts?${qp.toString()}`);
  const districts = res.districts ?? [];
  setCached(cacheKey, districts);
  return districts;
}

export async function listCities(params: { countryId: string; stateProvinceId?: string | null; districtId?: string | null; q?: string }) {
  if (!params.countryId) return [];
  const qp = new URLSearchParams({ countryId: params.countryId });
  if (params.stateProvinceId) qp.set("stateProvinceId", params.stateProvinceId);
  if (params.districtId) qp.set("districtId", params.districtId);
  if (params.q) qp.set("q", params.q);
  const cacheKey = `cities:${qp.toString()}`;
  const cached = getCached<LocationCity[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<{ cities: LocationCity[] }>(`/api/erp/locations/cities?${qp.toString()}`);
  const cities = res.cities ?? [];
  setCached(cacheKey, cities);
  return cities;
}

export async function listAreas(params: { cityId: string; q?: string }) {
  if (!params.cityId) return [];
  const qp = new URLSearchParams({ cityId: params.cityId });
  if (params.q) qp.set("q", params.q);
  const cacheKey = `areas:${qp.toString()}`;
  const cached = getCached<LocationArea[]>(cacheKey);
  if (cached) return cached;

  const res = await apiGet<{ areas: LocationArea[] }>(`/api/erp/locations/areas?${qp.toString()}`);
  const areas = res.areas ?? [];
  setCached(cacheKey, areas);
  return areas;
}
