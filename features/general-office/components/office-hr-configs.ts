import type { OfficeModuleConfig } from "./office-hr-module";

const ATTENDANCE_STATUS = [
  { value: "Present", labelKey: "god.att_present", labelFallback: "Present" },
  { value: "Absent", labelKey: "god.att_absent", labelFallback: "Absent" },
  { value: "Late", labelKey: "god.att_late", labelFallback: "Late" },
  { value: "Half Day", labelKey: "god.att_half", labelFallback: "Half Day" },
  { value: "On Leave", labelKey: "god.att_onleave", labelFallback: "On Leave" }
];
const LEAVE_STATUS = [
  { value: "Pending", labelKey: "god.leave_pending", labelFallback: "Pending" },
  { value: "Approved", labelKey: "god.leave_approved", labelFallback: "Approved" },
  { value: "Rejected", labelKey: "god.leave_rejected", labelFallback: "Rejected" }
];
const LEAVE_TYPES = [
  { value: "Annual", labelKey: "god.lt_annual", labelFallback: "Annual" },
  { value: "Sick", labelKey: "god.lt_sick", labelFallback: "Sick" },
  { value: "Casual", labelKey: "god.lt_casual", labelFallback: "Casual" },
  { value: "Unpaid", labelKey: "god.lt_unpaid", labelFallback: "Unpaid" },
  { value: "Other", labelKey: "god.lt_other", labelFallback: "Other" }
];
const ASSET_STATUS = [
  { value: "Available", labelKey: "god.as_available", labelFallback: "Available" },
  { value: "In Use", labelKey: "god.as_inuse", labelFallback: "In Use" },
  { value: "Under Repair", labelKey: "god.as_repair", labelFallback: "Under Repair" },
  { value: "Retired", labelKey: "god.as_retired", labelFallback: "Retired" }
];

export const ATTENDANCE_CONFIG: OfficeModuleConfig = {
  module: "attendance",
  endpoint: "/api/erp/general-office/attendance",
  listKey: "attendance",
  titleKey: "nav.attendance", titleFallback: "Attendance",
  descKey: "god.att_desc", descFallback: "Daily office attendance — check-in / check-out and work duration.",
  addKey: "god.att_add", addFallback: "Mark Attendance",
  statusOptions: ATTENDANCE_STATUS,
  fields: [
    { key: "employeeId", labelKey: "sae.entry_name", labelFallback: "Employee", type: "employee", required: true },
    { key: "attendanceDate", labelKey: "rozrep.date", labelFallback: "Date", type: "date", required: true, inTable: true },
    { key: "status", labelKey: "acct.status", labelFallback: "Status", type: "select", options: ATTENDANCE_STATUS, inTable: true },
    { key: "checkIn", labelKey: "god.att_in", labelFallback: "Time In", type: "time", inTable: true },
    { key: "checkOut", labelKey: "god.att_out", labelFallback: "Time Out", type: "time", inTable: true },
    { key: "workHours", labelKey: "god.att_hours", labelFallback: "Hours", type: "number", inTable: true },
    { key: "notes", labelKey: "sed.f_notes", labelFallback: "Notes", type: "text" }
  ]
};

export const LEAVE_CONFIG: OfficeModuleConfig = {
  module: "leave",
  endpoint: "/api/erp/general-office/leave",
  listKey: "leave",
  titleKey: "nav.leave_management", titleFallback: "Leave Management",
  descKey: "god.leave_desc", descFallback: "Employee leave requests, allocations and approvals.",
  addKey: "god.leave_add", addFallback: "Apply Leave",
  statusOptions: LEAVE_STATUS,
  fields: [
    { key: "employeeId", labelKey: "sae.entry_name", labelFallback: "Employee", type: "employee", required: true },
    { key: "leaveType", labelKey: "god.leave_type", labelFallback: "Leave Type", type: "select", options: LEAVE_TYPES, inTable: true },
    { key: "fromDate", labelKey: "god.from_date", labelFallback: "From", type: "date", required: true, inTable: true },
    { key: "toDate", labelKey: "god.to_date", labelFallback: "To", type: "date", required: true, inTable: true },
    { key: "status", labelKey: "acct.status", labelFallback: "Status", type: "select", options: LEAVE_STATUS, inTable: true, render: (r) => r.status },
    { key: "reason", labelKey: "god.leave_reason", labelFallback: "Reason", type: "text" }
  ]
};

export const ASSETS_CONFIG: OfficeModuleConfig = {
  module: "assets",
  endpoint: "/api/erp/general-office/assets",
  listKey: "assets",
  titleKey: "nav.office_assets", titleFallback: "Office Assets",
  descKey: "god.asset_desc", descFallback: "Company assets, assignment and status tracking.",
  addKey: "god.asset_add", addFallback: "Add Asset",
  statusOptions: ASSET_STATUS,
  fields: [
    { key: "assetName", labelKey: "god.asset_name", labelFallback: "Asset Name", type: "text", required: true, inTable: true },
    { key: "assetTag", labelKey: "god.asset_tag", labelFallback: "Asset Tag", type: "text", inTable: true },
    { key: "category", labelKey: "god.asset_category", labelFallback: "Category", type: "text", inTable: true },
    { key: "serialNumber", labelKey: "god.asset_serial", labelFallback: "Serial No.", type: "text", inTable: true },
    { key: "status", labelKey: "acct.status", labelFallback: "Status", type: "select", options: ASSET_STATUS, inTable: true },
    { key: "assignedEmployeeId", labelKey: "god.asset_assigned", labelFallback: "Assigned To", type: "employee" },
    { key: "purchaseDate", labelKey: "god.asset_purchase", labelFallback: "Purchase Date", type: "date" },
    { key: "assetValue", labelKey: "god.asset_value", labelFallback: "Value", type: "number" },
    { key: "currency", labelKey: "hr.f_currency", labelFallback: "Currency", type: "text" },
    { key: "notes", labelKey: "sed.f_notes", labelFallback: "Notes", type: "text" }
  ]
};
