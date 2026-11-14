/**
 * Saved-record detail for one City Branch, as returned by
 * GET /api/branch-management/city-branches?id=<id>&detail=1.
 * Pure normalizers only: no fetching and no React here.
 */
import type { LocationArea, LocationCity, LocationCountry, LocationDistrict, LocationState } from "@/features/locations/location-api";
import type { LocationHierarchyMeta } from "@/features/locations/components/location-hierarchy-select";

export type CityBranchLocationNames = {
  countryName: string;
  countryIso2: string;
  countryIso3: string;
  countryCurrency: string;
  countryPhoneCode: string;
  stateName: string;
  districtName: string;
  cityName: string;
  cityCode: string;
  cityZip: string;
  areaName: string;
  areaPostal: string;
};

export type CityBranchLinkedUser = {
  assignmentId: string;
  userId: string;
  userName: string;
  userCode: string;
  role: string;
  operationalDomain: string;
  accessProfile: string;
  isActive: boolean;
};

export type CityBranchLinkedDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type CityBranchDetail = {
  location: CityBranchLocationNames;
  linkedUsers: CityBranchLinkedUser[];
  linkedDocuments: CityBranchLinkedDocument[];
  createdByName: string;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function normalizeCityBranchDetail(raw: unknown): CityBranchDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const loc = asRecord(r.location);
  return {
    location: {
      countryName: text(loc.countryName),
      countryIso2: text(loc.countryIso2),
      countryIso3: text(loc.countryIso3),
      countryCurrency: text(loc.countryCurrency).toUpperCase(),
      countryPhoneCode: text(loc.countryPhoneCode),
      stateName: text(loc.stateName),
      districtName: text(loc.districtName),
      cityName: text(loc.cityName),
      cityCode: text(loc.cityCode),
      cityZip: text(loc.cityZip),
      areaName: text(loc.areaName),
      areaPostal: text(loc.areaPostal)
    },
    linkedUsers: asList(r.linkedUsers).map((u) => ({
      assignmentId: text(u.assignmentId),
      userId: text(u.userId),
      userName: text(u.userName),
      userCode: text(u.userCode),
      role: text(u.role),
      operationalDomain: text(u.operationalDomain) || "business",
      accessProfile: text(u.accessProfile),
      isActive: u.isActive !== false
    })),
    linkedDocuments: asList(r.linkedDocuments).map((d) => ({
      id: text(d.id),
      name: text(d.name),
      mimeType: text(d.mimeType),
      sizeBytes: typeof d.sizeBytes === "number" ? d.sizeBytes : d.sizeBytes ? Number(d.sizeBytes) : null,
      createdAt: text(d.createdAt)
    })),
    createdByName: text(r.createdByName)
  };
}

/** Short document type label from the MIME type, falling back to the file extension. */
export function documentTypeLabel(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("spreadsheetml")) return "XLSX";
  if (mime.includes("wordprocessingml")) return "DOCX";
  if (mime.includes("jpeg")) return "JPG";
  if (mime.includes("png")) return "PNG";
  if (mime.includes("webp")) return "WEBP";
  if (mime.includes("zip")) return "ZIP";
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toUpperCase() : "FILE";
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Builds the location meta used by the location picker and the report from the names saved for the
 * branch's own location ids. Fields that the saved record does not have stay null.
 */
export function locationMetaFromSaved(
  ids: { countryId: string; stateProvinceId: string; districtId: string; cityId: string; areaId: string },
  location: CityBranchLocationNames
): LocationHierarchyMeta {
  const country = location.countryName
    ? ({
        id: ids.countryId,
        name: location.countryName,
        iso2: location.countryIso2 || null,
        iso3: location.countryIso3 || null,
        currency_code: location.countryCurrency,
        default_language_code: null,
        phone_code: location.countryPhoneCode || null,
        is_active: true
      } satisfies LocationCountry)
    : null;
  const state = location.stateName
    ? ({
        id: ids.stateProvinceId,
        country_id: ids.countryId,
        name: location.stateName,
        code: null,
        postal_code: null,
        phone_area_code: null,
        is_active: true
      } satisfies LocationState)
    : null;
  const district = location.districtName
    ? ({
        id: ids.districtId,
        country_id: ids.countryId,
        state_province_id: ids.stateProvinceId,
        name: location.districtName,
        code: null,
        postal_code: null,
        phone_area_code: null,
        is_active: true
      } satisfies LocationDistrict)
    : null;
  const city = location.cityName
    ? ({
        id: ids.cityId,
        country_id: ids.countryId,
        state_province_id: ids.stateProvinceId || null,
        district_id: ids.districtId || null,
        name: location.cityName,
        code: location.cityCode || null,
        zip_code: location.cityZip || null,
        phone_area_code: null,
        is_active: true
      } satisfies LocationCity)
    : null;
  const area = location.areaName
    ? ({
        id: ids.areaId,
        country_id: ids.countryId,
        state_province_id: ids.stateProvinceId || null,
        district_id: ids.districtId || null,
        city_id: ids.cityId,
        name: location.areaName,
        code: null,
        postal_code: location.areaPostal || null,
        phone_area_code: null,
        is_active: true
      } satisfies LocationArea)
    : null;
  return { country, state, district, city, area };
}
