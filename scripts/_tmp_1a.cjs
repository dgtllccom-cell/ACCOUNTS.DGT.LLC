const fs = require("fs");
const F = "features/clearing-agent/components/customer-order-management-view.tsx";
let s = fs.readFileSync(F, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
function rep(a, b) {
  const p = s.split(a);
  if (p.length !== 2) { console.error((p.length === 1 ? "MISSING: " : "AMBIGUOUS(" + (p.length - 1) + "): ") + a.slice(0, 110)); process.exitCode = 1; return; }
  s = p.join(b);
}

// types / form / fetch
rep('type ClearanceType = "import" | "export" | "transit";', 'type ClearanceType = "import" | "export" | "transit" | "re_export";');
rep('type MovementType = "import" | "export" | "transit" | "up_transit" | "down_transit" | "domestic";', 'type MovementType = "import" | "export" | "re_export" | "transit" | "up_transit" | "down_transit" | "domestic";');
rep('type PortRow = { id: string; port_name: string };', 'type PortRow = { id: string; port_name: string; country_id?: string | null; transport_type?: string | null };');
rep('  movement_type: "import" as MovementType,', '  movement_type: "import" as MovementType,\n  import_scenario: "collect_from_origin" as "collect_from_origin" | "arrived_at_entry",');
rep('      movement_type: (order.movement_type || "import") as MovementType,', '      movement_type: (order.movement_type || "import") as MovementType,\n      import_scenario: (o.import_scenario === "arrived_at_entry" ? "arrived_at_entry" : "collect_from_origin") as "collect_from_origin" | "arrived_at_entry",');
rep('timed("/api/erp/ports")', 'timed("/api/erp/ports?forOrder=1")');

// helpers
rep('  const fb: Record<string, string> = { import: "Import", export: "Export", up_transit: "Up Transit", down_transit: "Down Transit", transit: "Transit", domestic: "Domestic" };', '  const fb: Record<string, string> = { import: "Import", export: "Export", re_export: "Re-export", up_transit: "Up Transit", down_transit: "Down Transit", transit: "Transit", domestic: "Domestic" };');
rep('  if (m === "export") return comT(lang, "mv_flow_export", "Local → Foreign");', '  if (m === "export") return comT(lang, "mv_flow_export", "Local → Foreign");\n  if (m === "re_export") return comT(lang, "mv_flow_re_export", "Foreign → Foreign");');
rep('function loadingSourceLabel(', `/** Customs wording follows the customs operation — an import is never labelled "In-Transit". */
function customsStageLabel(lang: string, movement: string | null | undefined): string {
  const m = String(movement || "import").toLowerCase();
  if (m === "export") return comT(lang, "export_clearance_badge", "Export Clearance");
  if (m === "re_export") return comT(lang, "reexport_clearance_badge", "Re-export Clearance");
  if (m.includes("transit")) return comT(lang, "cust_badge_transit", "Transit Customs");
  return comT(lang, "import_clearance_badge", "Import Clearance");
}

/** Port-master transport kind a route point must have for a given transport mode. */
function portKindForMode(mode: string | null | undefined): string {
  const m = String(mode || "");
  return m === "by_road" ? "road" : m === "by_air" ? "air" : m === "by_sea" ? "sea" : "";
}

/** "Port" for Sea, "Border / loading point" for Road, "Airport" for Air, "Rail terminal" for Train. */
function locationRoleLabel(lang: string, role: "loading" | "entry" | "exit" | "discharge", mode: string | null | undefined): string {
  const kind = String(mode || "by_sea").replace("by_", "") || "sea";
  const fb: Record<string, Record<string, string>> = {
    loading: { sea: "Port of Loading", road: "Loading Point / Border", air: "Airport of Departure", rail: "Loading Rail Terminal" },
    entry: { sea: "Entry Seaport", road: "Entry Border", air: "Entry Airport", rail: "Entry Rail Terminal" },
    exit: { sea: "Exit Port", road: "Exit Border", air: "Exit Airport", rail: "Exit Rail Terminal" },
    discharge: { sea: "Port of Discharge", road: "Discharge Point / Border", air: "Airport of Arrival", rail: "Discharge Rail Terminal" }
  };
  const k = fb[role][kind] ? kind : "sea";
  return comT(lang, \`loc_\${role}_\${k}\`, fb[role][k]);
}

function loadingSourceLabel(`);

// movement select: add Re-export
rep('<option value="down_transit">{tt("mv_opt_down_transit", "Down Transit (Inland → Border Exit)")}</option>', '<option value="down_transit">{tt("mv_opt_down_transit", "Down Transit (Inland → Border Exit)")}</option>\n                <option value="re_export">{tt("mv_opt_re_export", "Re-export (Foreign Goods → Foreign Destination)")}</option>');

// Step1: location helpers
rep('  return (\n    <div className="space-y-4 animate-in fade-in duration-150">\n      {/* Dynamic 1A / 1B / 1C Sub-step Navigator */}', `  // Locations offered in a dropdown: ONLY those of the chosen country and of the chosen transport
  // mode (sea ports for Sea, border points for Road, airports for Air). The value already saved on the
  // order stays selectable even if it falls outside the filter, so reopening never loses data.
  const portsFor = (countryId: string, keepId?: string): PortRow[] => {
    const kind = portKindForMode(formData.transport_mode);
    let list = ports.filter((p) => (!countryId || p.country_id === countryId) && (!kind || !p.transport_type || p.transport_type === kind));
    if (keepId && !list.some((p) => p.id === keepId)) {
      const kept = ports.find((p) => p.id === keepId);
      if (kept) list = [kept, ...list];
    }
    return list;
  };
  const locLabel = (role: "loading" | "entry" | "exit" | "discharge") => locationRoleLabel(lang, role, formData.transport_mode);
  const arrivedAtEntry = formData.movement_type === "import" && formData.import_scenario === "arrived_at_entry";

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Dynamic 1A / 1B / 1C Sub-step Navigator */}`);

// six port lists, in file order
const mapRe = '                    {ports.map((p) => (';
const replacements = [
  'portsFor(formData.loading_country_id, formData.loading_port_id)',
  'portsFor(formData.receiving_country_id, formData.entry_border_port_id)',
  'portsFor(formData.loading_country_id, formData.exit_border_port_id || formData.loading_port_id)',
  'portsFor(formData.receiving_country_id, formData.destination_port_id)',
  'portsFor("", formData.entry_border_port_id)',
  'portsFor("", formData.exit_border_port_id)'
];
{
  const parts = s.split(mapRe);
  if (parts.length !== 7) { console.error("ports.map count", parts.length - 1); process.exit(1); }
  let out = parts[0];
  for (let i = 0; i < 6; i++) out += `                    {${replacements[i]}.map((p) => (` + parts[i + 1];
  s = out;
}

// labels
rep('{tt("foreign_port_of_loading", "Port of Loading")}', '{locLabel("loading")}');
rep('{tt("exit_border_port_loading", "Exit Border / Port of Loading")} *', '{locLabel("exit")} *');
rep('{tt("foreign_port_discharge_city", "Discharge Port / Destination City")}', '{locLabel("discharge")}');
s = s.split('{tt("entry_sea_port_border", "Entry Sea Port / Border Point")} *').join('{locLabel("entry")} *');
for (const k of ["select_port_of_loading", "select_entry_port_border", "select_exit_port_border", "select_port_discharge"]) {
  s = s.replace(new RegExp('tt\\("' + k + '", "[^"]*"\\)', "g"), 'tt("loc_select_generic", "Select location")');
}

// import scenario selector + arrived behaviour
rep(`              {/* Row 1: Foreign Origin Country & Port of Loading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">`, `              {/* Import scenario: collect from the foreign origin, or clear goods that already arrived */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("import_scenario_label", "Import Scenario")} *
                </label>
                <select
                  value={formData.import_scenario}
                  onChange={(e) => setFormData((c) => ({ ...c, import_scenario: e.target.value as "collect_from_origin" | "arrived_at_entry" }))}
                  className={selectClass}
                >
                  <option value="collect_from_origin">{tt("import_scn_origin", "Collect goods from the foreign origin and arrange the journey")}</option>
                  <option value="arrived_at_entry">{tt("import_scn_arrived", "Goods already arrived at the entry border / port — clear and arrange onward delivery")}</option>
                </select>
              </div>

              {/* Row 1: Foreign Origin Country & Port of Loading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">`);
rep(`                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {locLabel("loading")}`, `                <div className={arrivedAtEntry ? "hidden" : ""}>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {locLabel("loading")}`);
rep('{tt("expected_border_entry_date", "Expected Border Entry Date")}', '{arrivedAtEntry ? tt("arrived_on_date", "Arrival Date at Entry") : tt("expected_border_entry_date", "Expected Border Entry Date")}');

// export block also serves re-export
rep('          {formData.movement_type === "export" && (', '          {(formData.movement_type === "export" || formData.movement_type === "re_export") && (');
rep('<span>{tt("export_movement_route", "Export Movement & Location Setup")}</span>', '<span>{formData.movement_type === "re_export" ? tt("reexport_movement_route", "Re-export Movement & Location Setup") : tt("export_movement_route", "Export Movement & Location Setup")}</span>');
rep('{tt("export_clearance_badge", "Export Clearance")}', '{formData.movement_type === "re_export" ? tt("reexport_clearance_badge", "Re-export Clearance") : tt("export_clearance_badge", "Export Clearance")}');

// Live Report: customs wording follows the movement — never "In-Transit" for an import
rep('                          {tt("in_transit", "In-Transit")}\n', '                          {customsStageLabel(lang, formData.movement_type)}\n');
rep('{formData.customs_clearance_office || tt("in_transit_customs_fallback", "In-Transit Customs")}', '{formData.customs_clearance_office || customsStageLabel(lang, formData.movement_type)}');
rep('{formData.route_name || tt("bonded_highway_fallback", "Bonded Highway")}', '{formData.route_name || (String(formData.movement_type).includes("transit") ? tt("bonded_highway_fallback", "Bonded Highway") : tt("direct_route_short", "Direct Route"))}');

// legs summary card before the Vehicle & Fleet report
rep('                {/* 2. Vehicle & Fleet Report Card */}', `                {/* Route legs: one line per leg — mode, from → to, handler / partner account, road truck */}
                {(formData.legs || []).length > 0 && (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      <Route className="h-4 w-4 text-sky-600" />
                      <span>{tt("route_legs_summary", "Route Legs")} ({(formData.legs || []).length})</span>
                    </div>
                    <ol className="space-y-1.5">
                      {(formData.legs || []).map((leg: any, i: number) => (
                        <li key={leg.id || i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                          <span className="font-mono font-black text-slate-400">{leg.legNo ?? i + 1}.</span>
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800">{transportModeLabel(lang, leg.transportMode)}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {leg.fromLocationText || leg.fromCountryName || "—"} {isRtl ? "←" : "→"} {leg.toLocationText || leg.toCountryName || "—"}
                          </span>
                          <span className="text-slate-500">
                            {leg.handlerType === "external_partner"
                              ? \`\${tt("leg_handler_partner_short", "Partner")}: \${leg.partnerName || "—"}\${leg.partnerAccountNumber ? \` [\${leg.partnerAccountNumber}]\` : ""}\`
                              : tt("leg_handler_branch_short", "Our branch")}
                          </span>
                          {leg.transportMode === "by_road" && leg.truckNumber && !isTruckPlaceholder(leg.truckNumber) ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" dir="ltr">🚛 {leg.truckNumber}</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* 2. Vehicle & Fleet Report Card */}`);
fs.writeFileSync(F, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("done");
