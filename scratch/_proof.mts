import fs from "node:fs";
import { buildBranchProfileReportHtml } from "@/lib/reports/build-branch-profile-report";
import { getPermissionKeysForTemplate } from "@/lib/permissions/catalog";

const full = {
  branchName: "United Arab Emirates Main Branch", branchCode: "AE-MB-0001", branchType: "MAIN",
  branchStatus: "Active", serialNumber: "0001", currency: "AED",
  country: "United Arab Emirates", countryCode: "AE", stateProvince: "Dubai", district: "Bur Dubai",
  city: "Dubai", areaRegion: "Al Fahidi", zipCode: "00000",
  fullAddress: "Office 1204, Al Fahidi Business Tower, Khalid Bin Al Waleed Road, Bur Dubai, Dubai, United Arab Emirates",
  parentBranch: { name: "ACCOUNTS.DGT.LLC Headquarters", code: "SUPER-HQ-001" },
  establishedOn: "01 Jul 2026", taxRegNo: "100399999900003", ntnGstNo: "TRN-100399999900003",
  ownerName: "Haji Asmatullah", ownerCode: "OWN-0001", designation: "Country Admin", nationality: "Afghan",
  ownershipType: "Individual", ownershipPercent: "100%",
  ownerPhone: "+971 4 000 0000", ownerWhatsApp: "+971 50 000 0000", ownerEmail: "uae.branch@damaantrading.ae",
  ownerLandline: "+971 4 111 1111", ownerWebsite: "https://www.damaantrading.ae",
  companyName: "Damaan Trading Company LLC", companyCode: "CMP-AE-01", companyType: "Limited Liability Company",
  companyRegNo: "DED-1234567", companyIncDate: "12 Jan 2019", companyStatus: "Active",
  companyOfficeAddress: "Office 1204, Al Fahidi Business Tower, Bur Dubai, Dubai, United Arab Emirates",
  createdBy: "Super Admin", createdDate: "01 Jul 2026", updatedDate: "28 Aug 2026",
  allowedPermissions: getPermissionKeysForTemplate("country-standard"), permissionTemplate: "country-standard",
  remarks: null as any,
};
const minimal = { branchName: "Pakistan Main Branch", branchCode: "PK-MB-0007", branchType: "MAIN", branchStatus: "Active",
  serialNumber: "0007", currency: "PKR", country: "Pakistan", countryCode: "PK",
  parentBranch: { name: "ACCOUNTS.DGT.LLC Headquarters", code: "SUPER-HQ-001" },
  ownerName: "Muhammad Asmatullah", companyName: "Asmat & Brothers (Pvt) Ltd.", companyStatus: "Active",
  createdBy: "Super Admin", updatedDate: "28 Aug 2026",
  allowedPermissions: getPermissionKeysForTemplate("country-standard").slice(0, 9), permissionTemplate: "branch-basic" };

fs.writeFileSync("public/_print_preview/country-branch.html", buildBranchProfileReportHtml({ kind: "country", lang: "en", data: full }));
fs.writeFileSync("public/_print_preview/cb-minimal.html", buildBranchProfileReportHtml({ kind: "country", lang: "en", data: minimal }));
fs.writeFileSync("public/_print_preview/cb-urdu.html", buildBranchProfileReportHtml({ kind: "country", lang: "ur", data: full }));
fs.writeFileSync("public/_print_preview/cb-city.html", buildBranchProfileReportHtml({ kind: "city", lang: "en", data: { ...full, branchName: "Dubai City Branch", branchType: "CITY", branchCode: "AE-DXB-001" } }));
console.log("wrote 4 proof HTMLs (production builder path)");
