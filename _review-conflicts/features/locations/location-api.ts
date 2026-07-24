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

export async function listCountries(params?: { q?: string }) {
  const qp = new URLSearchParams();
  if (params?.q) qp.set("q", params.q);
  const res = await apiGet<{ countries: LocationCountry[] }>(`/api/erp/locations/countries?${qp.toString()}`);
  return res.countries ?? [];
}

export async function listStates(params: { countryId: string; q?: string }) {
  const qp = new URLSearchParams({ countryId: params.countryId });
  if (params.q) qp.set("q", params.q);
  const res = await apiGet<{ states: LocationState[] }>(`/api/erp/locations/states?${qp.toString()}`);
  return res.states ?? [];
}

export async function listDistricts(params: { stateProvinceId: string; q?: string }) {
  const qp = new URLSearchParams({ stateProvinceId: params.stateProvinceId });
  if (params.q) qp.set("q", params.q);
  const res = await apiGet<{ districts: LocationDistrict[] }>(`/api/erp/locations/districts?${qp.toString()}`);
  return res.districts ?? [];
}

export async function listCities(params: { countryId: string; stateProvinceId?: string | null; districtId?: string | null; q?: string }) {
  const qp = new URLSearchParams({ countryId: params.countryId });
  if (params.stateProvinceId) qp.set("stateProvinceId", params.stateProvinceId);
  if (params.districtId) qp.set("districtId", params.districtId);
  if (params.q) qp.set("q", params.q);
  const res = await apiGet<{ cities: LocationCity[] }>(`/api/erp/locations/cities?${qp.toString()}`);
  return res.cities ?? [];
}

export async function listAreas(params: { cityId: string; q?: string }) {
  const qp = new URLSearchParams({ cityId: params.cityId });
  if (params.q) qp.set("q", params.q);
  const res = await apiGet<{ areas: LocationArea[] }>(`/api/erp/locations/areas?${qp.toString()}`);
  return res.areas ?? [];
}
