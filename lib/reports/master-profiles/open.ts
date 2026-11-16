"use client";

/**
 * One entry point for every Master Profile print/PDF: resolve dynamic branding
 * for the record's entity/country/branch, build the config via the per-entity
 * builder, and hand it to the single reusable engine.
 *
 * `buildMasterProfileHtml` returns the same HTML the print uses, so a screen that previews a profile
 * (the Account View) shows exactly what will be printed.
 */

import { openMasterProfileReportWindow, buildMasterProfileReportHtml, type MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import { resolveDocumentBranding, type BrandingScope } from "@/lib/reports/resolve-document-branding";
import type { Lang } from "./shared";
import { buildAccountProfileConfig, type AccountProfileRecord } from "./build-account-profile";
import { buildAccountProfileCardConfig, type AccountProfileCardRecord } from "./build-account-profile-card";
import { buildCompanyProfileConfig, type CompanyProfileRecord } from "./build-company-profile";
import { buildCustomerProfileConfig, type CustomerProfileRecord } from "./build-customer-profile";
import { buildEmployeeProfileConfig, type EmployeeProfileRecord } from "./build-employee-profile";

export type MasterProfileEntity = "account" | "company" | "customer" | "employee";

type OpenArgs =
  | { entity: "account"; record: AccountProfileRecord; layout?: undefined; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "account"; record: AccountProfileCardRecord; layout: "profile_card"; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "company"; record: CompanyProfileRecord; layout?: undefined; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "customer"; record: CustomerProfileRecord; layout?: undefined; scope?: BrandingScope; lang: Lang; autoPrint?: boolean }
  | { entity: "employee"; record: EmployeeProfileRecord; layout?: undefined; scope?: BrandingScope; lang: Lang; autoPrint?: boolean };

async function resolveConfig(args: OpenArgs): Promise<MasterProfileConfig> {
  const scope: BrandingScope = args.scope ?? {};
  const branding = await resolveDocumentBranding(scope, args.lang);

  let config: MasterProfileConfig;
  switch (args.entity) {
    case "account":
      config = args.layout === "profile_card"
        ? buildAccountProfileCardConfig(args.record as AccountProfileCardRecord, branding, args.lang)
        : buildAccountProfileConfig(args.record as AccountProfileRecord, branding, args.lang);
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
  return config;
}

export async function openMasterProfile(args: OpenArgs): Promise<void> {
  const config = await resolveConfig(args);
  config.autoPrint = args.autoPrint ?? false;
  openMasterProfileReportWindow(config);
}

/** The exact HTML the print window receives (for the on-screen preview of the same layout). */
export async function buildMasterProfileHtml(args: OpenArgs): Promise<string> {
  const config = await resolveConfig(args);
  return buildMasterProfileReportHtml(config);
}
