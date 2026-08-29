"use client";

/**
 * One entry point for every Master Profile print/PDF: resolve dynamic branding
 * for the record's entity/country/branch, build the config via the per-entity
 * builder, and hand it to the single reusable engine.
 */

import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import type { Lang } from "./shared";
import { buildAccountProfileConfig, type AccountProfileRecord } from "./build-account-profile";
import { buildCompanyProfileConfig, type CompanyProfileRecord } from "./build-company-profile";
import { buildCustomerProfileConfig, type CustomerProfileRecord } from "./build-customer-profile";
import { buildEmployeeProfileConfig, type EmployeeProfileRecord } from "./build-employee-profile";

export type MasterProfileEntity = "account" | "company" | "customer" | "employee";

type OpenArgs =
  | { entity: "account"; record: AccountProfileRecord; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "company"; record: CompanyProfileRecord; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "customer"; record: CustomerProfileRecord; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "employee"; record: EmployeeProfileRecord; scope?: BrandingScope; lang: Lang; autoPrint?: boolean };

export async function openMasterProfile(args: OpenArgs): Promise<void> {
  const scope: BrandingScope = args.scope ?? {};
  const branding = await resolveDocumentBranding(scope, args.lang);

  let config;
  switch (args.entity) {
    case "account":
      config = buildAccountProfileConfig(args.record, branding, args.lang);
      break;
    case "company":
      config = buildCompanyProfileConfig(args.record, branding, args.lang);
      break;
    case "customer":
      config = buildCustomerProfileConfig(args.record, branding, args.lang);
      break;
    case "employee":
      config = buildEmployeeProfileConfig(args.record, branding, args.lang);
      break;
  }
  config.autoPrint = args.autoPrint ?? false;
  openMasterProfileReportWindow(config);
}
