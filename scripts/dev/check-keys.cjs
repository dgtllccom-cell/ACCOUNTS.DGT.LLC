const fs = require('fs');
const content = fs.readFileSync('lib/i18n/ui.ts', 'utf8');
const keys = [
  'trk.registered_truck_title', 'trk.module_subtitle', 'trk.new_chat_registration',
  'trk.section_branch_user', 'trk.section_truck_summary', 'trk.section_registration_summary',
  'trk.section_countries_report', 'common.country', 'common.branch_name', 'common.user_name',
  'trk.kpi_total_trucks', 'trk.kpi_active_trucks', 'trk.kpi_registered_owners', 'trk.kpi_assigned_drivers',
  'common.total_records', 'common.active', 'trk.badge_pending', 'common.inactive',
  'trk.col_truck_no', 'trk.col_truck_name', 'trk.col_model', 'trk.col_owner', 'trk.col_company',
  'trk.col_transporter', 'trk.col_driver', 'common.mobile', 'common.status', 'common.actions',
  'report.print', 'report.export_pdf', 'report.export_excel', 'common.columns',
  'trk.search_trucks_ph', 'common.all_branches', 'common.all_countries', 'trk.all_dates'
];
keys.forEach(k => {
  const has = content.includes('"' + k + '":');
  console.log(k, has ? 'YES' : 'NO');
});
