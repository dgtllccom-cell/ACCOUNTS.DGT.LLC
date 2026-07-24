import { z } from "zod";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  uuidSchema.nullable().optional()
);
const currencySchema = z.string().trim().length(3).transform((value) => value.toUpperCase());
const optionalIsoSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .optional();

const contactRowSchema = z.object({
  type: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(255)
});

const documentRowSchema = z.object({
  type: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255).optional()
});

const permissionKeySchema = z.string().trim().min(3).max(120);
const permissionTemplateSchema = z.string().trim().min(1).max(120).optional();

export const createCountrySchema = z.object({
  name: z.string().trim().min(2, "Country name is required"),
  iso2: optionalIsoSchema,
  iso3: optionalIsoSchema,
  currencyCode: currencySchema,
  parentBusinessGroupId: optionalUuidSchema,
  companyName: z.string().trim().min(2).max(200).optional(),
  companyLogoUrl: z.string().trim().max(1000).optional(),
  companyAddress: z.string().trim().max(1000).optional(),
  contactInformation: z.record(z.string(), z.unknown()).optional(),
  registrationNumber: z.string().trim().max(120).optional(),
  taxInformation: z.record(z.string(), z.unknown()).optional(),
  bankingInformation: z.record(z.string(), z.unknown()).optional(),
  emailInformation: z.record(z.string(), z.unknown()).optional(),
  officialEmail: z.string().trim().email("Official email is required").max(255),
  adminEmail: z.string().trim().email("Admin email is required").max(255),
  whatsappNumber: z.string().trim().max(50).optional(),
  emailDomain: z.string().trim().max(120).optional(),
  emailServerSettings: z.record(z.string(), z.unknown()).optional(),
  websiteInformation: z.record(z.string(), z.unknown()).optional()
});

export const createCountryBranchSchema = z.object({
  countryId: uuidSchema,
  name: z.string().trim().min(2, "Main branch name is required"),
  code: z.string().trim().min(2, "Main branch code is required").transform((value) => value.toUpperCase()),
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email("Branch email is required").max(255),
  whatsappNumber: z.string().trim().max(50).optional(),
  companyId: optionalUuidSchema,
  ownerName: z.string().trim().max(120).optional(),
  contacts: z.array(contactRowSchema).max(50).optional(),
  documents: z.array(documentRowSchema).max(50).optional(),
  permissionTemplate: permissionTemplateSchema,
  permissionGrants: z.array(permissionKeySchema).min(1, "At least one permission is required").max(100)
});

export const createCityBranchSchema = z.object({
  countryId: uuidSchema,
  countryBranchId: uuidSchema,
  cityName: z.string().trim().min(2, "City name is required").optional(),
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  areaLocationId: optionalUuidSchema,
  name: z.string().trim().min(2, "Branch name is required"),
  code: z.string().trim().min(2, "Branch code is required").transform((value) => value.toUpperCase()),
  currencyCode: currencySchema,
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email("Branch email is required").max(255),
  whatsappNumber: z.string().trim().max(50).optional(),
  companyId: optionalUuidSchema,
  ownerName: z.string().trim().max(120).optional(),
  contacts: z.array(contactRowSchema).max(50).optional(),
  documents: z.array(documentRowSchema).max(50).optional(),
  permissionTemplate: permissionTemplateSchema,
  permissionGrants: z.array(permissionKeySchema).min(1, "At least one permission is required").max(100),
  emailPrefix: z.string().trim().max(100).optional(),
  emailServerSettings: z.object({
    mailServerName: z.string().trim().max(100).optional(),
    localIp: z.string().trim().max(50).optional(),
    publicIp: z.string().trim().max(50).optional(),
    smtpHost: z.string().trim().max(255).optional(),
    smtpPort: z.preprocess((val) => (val === "" || val === undefined ? null : Number(val)), z.number().nullable().optional()),
    imapHost: z.string().trim().max(255).optional(),
    imapPort: z.preprocess((val) => (val === "" || val === undefined ? null : Number(val)), z.number().nullable().optional()),
    sslSecure: z.boolean().optional(),
    smtpUser: z.string().trim().max(255).optional(),
    smtpPass: z.string().trim().max(255).optional()
  }).optional(),
  whatsappConfig: z.object({
    whatsappNumber: z.string().trim().max(50).optional(),
    wabaId: z.string().trim().max(100).optional(),
    phoneNumberId: z.string().trim().max(100).optional(),
    accessToken: z.string().trim().max(1000).optional(),
    isActive: z.boolean().optional()
  }).optional()
}).refine((value) => Boolean(value.cityId || value.cityName), {
  message: "City is required",
  path: ["cityId"]
});

export const createSuperAdminBranchSchema = z.object({
  companyId: uuidSchema,
  name: z.string().trim().min(2, "Branch name is required"),
  code: z.string().trim().min(2, "Branch code is required").transform((value) => value.toUpperCase()),
  countryId: optionalUuidSchema,
  stateProvinceId: optionalUuidSchema,
  districtId: optionalUuidSchema,
  cityId: optionalUuidSchema,
  currencyCode: currencySchema.optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email("Email is required").max(255),
  whatsappNumber: z.string().trim().max(50).optional(),
  ownerName: z.string().trim().max(120).optional(),
  contacts: z.array(contactRowSchema).max(50).optional(),
  documents: z.array(documentRowSchema).max(50).optional()
});

export type CreateCountryInput = z.infer<typeof createCountrySchema>;
export type CreateCountryBranchInput = z.infer<typeof createCountryBranchSchema>;
export type CreateCityBranchInput = z.infer<typeof createCityBranchSchema>;
export type CreateSuperAdminBranchInput = z.infer<typeof createSuperAdminBranchSchema>;
