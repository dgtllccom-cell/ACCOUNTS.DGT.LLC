/**
 * Clearing Truck Registration → Master Profile (A4) config.
 *
 * Pure function `(record, branding, lang) => MasterProfileConfig` for the single reusable engine
 * (lib/reports/open-master-profile-report-window.ts) — the same branding, RTL, A4 pagination, header/footer
 * and PDF behaviour as every other master profile in the ERP.
 *
 * The record carries values that are ALREADY in the language on screen (names transliterated, choices translated, dates
 * formatted); this builder only arranges them. Empty values are dropped (`pushRow`) — nothing is invented or defaulted.
 */

import type { MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import { brandingConfig, compact, makeT, metaCells, pushRow, section, type Lang } from "./shared";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";

type Row = Record<string, string | null | undefined>;

export type TruckProfileRecord = {
  truckNumber: string;
  statusLabel?: string;
  registrationDate?: string;
  branchName?: string;
  /** http(s) / data: / root-relative URL of the driver photo (shown in the report banner). */
  driverPhotoUrl?: string | null;
  owner?: Row;
  company?: Row;
  truck?: Row;
  transporter?: Row;
  driver?: Row;
  remarks?: string;
  /** record id shown in the footer (serial) */
  reportId?: string;
};

const stripNumbering = (s: string) => s.replace(/^\s*\d+\.\s*/, "").trim();

export function buildTruckProfileConfig(r: TruckProfileRecord, branding: DocumentBranding, lang: Lang): MasterProfileConfig {
  const tt = makeT(lang);
  const o = r.owner ?? {};
  const c = r.company ?? {};
  const k = r.truck ?? {};
  const tp = r.transporter ?? {};
  const d = r.driver ?? {};

  const sections = compact([
    section(stripNumbering(tt("trk.section_owner", "Owner Details")), (rows) => {
      pushRow(rows, tt("trk.w_registration_no", "Registration No."), o.regNo);
      pushRow(rows, tt("trk.w_owner_type", "Owner Type"), o.type);
      pushRow(rows, tt("trk.w_full_name", "Full Name"), o.fullName);
      pushRow(rows, tt("trk.w_father_s_name", "Father's Name"), o.fatherName);
      pushRow(rows, tt("trk.w_cnic_id_no", "CNIC / ID No."), o.cnic);
      pushRow(rows, tt("trk.w_nationality", "Nationality"), o.nationality);
      pushRow(rows, tt("trk.w_mobile_number", "Mobile Number"), o.mobile);
      pushRow(rows, tt("trk.w_whatsapp_number", "WhatsApp Number"), o.whatsapp);
      pushRow(rows, tt("trk.w_email_address", "Email Address"), o.email);
      pushRow(rows, tt("trk.w_country", "Country"), o.country);
      pushRow(rows, tt("trk.w_state_province", "State / Province"), o.state);
      pushRow(rows, tt("trk.w_city", "City"), o.city);
      pushRow(rows, tt("trk.w_final_address", "Final Address"), o.address);
    }),
    section(stripNumbering(tt("trk.w_company_information", "Company Information")), (rows) => {
      pushRow(rows, tt("trk.w_company_name", "Company Name"), c.name);
      pushRow(rows, tt("trk.w_business_name", "Business Name"), c.businessName);
      pushRow(rows, tt("trk.w_registration_no", "Registration No."), c.regNo);
      pushRow(rows, tt("trk.w_ntn_tax_no", "NTN / Tax No."), c.ntn);
      pushRow(rows, tt("trk.w_license_no", "License No."), c.licenseNo);
      pushRow(rows, tt("trk.w_business_type", "Business Type"), c.businessType);
      pushRow(rows, tt("trk.w_country", "Country"), c.country);
      pushRow(rows, tt("trk.w_state_province", "State / Province"), c.state);
      pushRow(rows, tt("trk.w_city", "City"), c.city);
      pushRow(rows, tt("trk.w_final_address", "Final Address"), c.address);
      pushRow(rows, tt("trk.w_phone_number", "Phone Number"), c.phone);
      pushRow(rows, tt("trk.w_whatsapp_number", "WhatsApp Number"), c.whatsapp);
      pushRow(rows, tt("trk.w_email_address", "Email Address"), c.email);
      pushRow(rows, tt("trk.w_registration_date", "Registration Date"), c.regDate);
    }),
    section(stripNumbering(tt("trk.section_truck_details", "Truck Details")), (rows) => {
      pushRow(rows, tt("trk.w_truck_registration_no", "Truck Registration No."), k.truckNumber ?? r.truckNumber);
      pushRow(rows, tt("trk.w_truck_type", "Truck Type"), k.type);
      pushRow(rows, tt("trk.w_truck_name_nickname", "Truck Name / Nickname"), k.name);
      pushRow(rows, tt("trk.w_make_brand", "Make / Brand"), k.make);
      pushRow(rows, tt("trk.w_model", "Model"), k.model);
      pushRow(rows, tt("trk.w_year", "Year"), k.year);
      pushRow(rows, tt("trk.w_color", "Color"), k.color);
      pushRow(rows, tt("trk.w_fuel_type", "Fuel Type"), k.fuel);
      pushRow(rows, tt("trk.w_capacity_tons", "Capacity (Tons)"), k.capacity);
    }),
    section(tt("trk.w_registration_compliance", "Registration & Compliance"), (rows) => {
      pushRow(rows, tt("trk.w_chassis_no", "Chassis No."), k.chassis);
      pushRow(rows, tt("trk.w_engine_no", "Engine No."), k.engine);
      pushRow(rows, tt("trk.w_registration_no", "Registration No."), k.regNo);
      pushRow(rows, tt("trk.w_registration_expiry", "Registration Expiry"), k.regExpiry);
      pushRow(rows, tt("trk.w_insurance_provider", "Insurance Provider"), k.insuranceProvider);
      pushRow(rows, tt("trk.w_insurance_expiry", "Insurance Expiry"), k.insuranceExpiry);
      pushRow(rows, tt("trk.w_fitness_technical_expiry", "Fitness / Technical Expiry"), k.fitnessExpiry);
    }),
    section(stripNumbering(tt("trk.section_transporter", "Transporter Details")), (rows) => {
      pushRow(rows, tt("trk.transporter_name_label", "Transporter Name"), tp.name);
      pushRow(rows, tt("trk.transporter_code_label", "Transporter Code"), tp.code);
      pushRow(rows, tt("trk.w_mobile_number", "Mobile Number"), tp.mobile);
      pushRow(rows, tt("trk.w_whatsapp_number", "WhatsApp Number"), tp.whatsapp);
      pushRow(rows, tt("trk.w_final_address", "Final Address"), tp.address);
    }),
    section(stripNumbering(tt("trk.section_driver", "Driver Details")), (rows) => {
      pushRow(rows, tt("trk.w_driver_type", "Driver Type"), d.kind);
      pushRow(rows, tt("trk.w_driver_registration_no", "Driver Registration No."), d.regNo);
      pushRow(rows, tt("trk.w_full_name", "Full Name"), d.fullName);
      pushRow(rows, tt("trk.w_father_s_name", "Father's Name"), d.fatherName);
      pushRow(rows, tt("trk.w_date_of_birth", "Date of Birth"), d.dob);
      pushRow(rows, tt("trk.w_cnic_id_no", "CNIC / ID No."), d.cnic);
      pushRow(rows, tt("trk.w_nationality", "Nationality"), d.nationality);
      pushRow(rows, tt("trk.w_marital_status", "Marital Status"), d.marital);
      pushRow(rows, tt("trk.w_mobile_number", "Mobile Number"), d.mobile);
      pushRow(rows, tt("trk.w_whatsapp_number", "WhatsApp Number"), d.whatsapp);
      pushRow(rows, tt("trk.w_email_address", "Email Address"), d.email);
      pushRow(rows, tt("trk.w_country", "Country"), d.country);
      pushRow(rows, tt("trk.w_state_province", "State / Province"), d.state);
      pushRow(rows, tt("trk.w_city", "City"), d.city);
      pushRow(rows, tt("trk.w_final_address", "Final Address"), d.address);
    }),
    section(tt("trk.w_driving_license", "Driving License"), (rows) => {
      pushRow(rows, tt("trk.w_license_number", "License Number"), d.licenseNo);
      pushRow(rows, tt("trk.w_license_type", "License Type"), d.licenseType);
      pushRow(rows, tt("trk.w_issue_date", "Issue Date"), d.issueDate);
      pushRow(rows, tt("trk.w_expiry_date", "Expiry Date"), d.expiryDate);
      pushRow(rows, tt("trk.w_issuing_authority", "Issuing Authority"), d.authority);
    }),
  ]);

  return {
    lang,
    title: tt("trk.registered_truck_title", "Clearing Truck Registration"),
    subtitle: tt("trk.w_transport_registration_profile", "Transport Registration Profile"),
    overviewLabel: tt("trk.w_transport_registration_profile", "Transport Registration Profile"),
    name: r.truckNumber,
    status: r.statusLabel,
    meta: metaCells([
      [tt("trk.col_truck_no", "Truck No."), r.truckNumber],
      [tt("trk.w_registration_date", "Registration Date"), r.registrationDate],
      [tt("trk.w_status", "Status"), r.statusLabel],
      [tt("trk.col_branch", "Branch"), r.branchName],
    ]),
    sections,
    photoUrl: r.driverPhotoUrl ?? undefined,
    reportIdPrefix: "TRUCK",
    reportIdValue: r.reportId || r.truckNumber,
    remarksTitle: r.remarks ? tt("trk.remarks", "Remarks") : undefined,
    remarksBody: r.remarks || undefined,
    ...brandingConfig(branding),
  };
}
