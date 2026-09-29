/**
 * Customer Order route validation — one rule set for the multi-leg route of the EXISTING
 * clearing_customer_orders / clearing_customer_order_legs model.
 *
 *  • Legs must connect: leg N arrives in the country leg N+1 departs from.
 *  • A road / rail leg between two countries needs a SHARED LAND BORDER (always enforced) and a
 *    named border crossing (customs point) — a warning while the leg is still planned, an error
 *    once it is dispatched (in transit / arrived / completed). Countries without a common border (e.g. Pakistan → Uzbekistan)
 *    are rejected and the shortest land path is suggested (Pakistan → Afghanistan → Uzbekistan).
 *  • Sea legs name their ports, air legs their airports / flight — reported as warnings.
 *
 * Border data: land borders (ISO 3166-1 alpha-2) for the Gulf, Middle East, South and Central
 * Asia corridors the business runs, plus their neighbours. A country pair with no data is a
 * warning ("border data not configured"), never a silent pass.
 */

export type RouteLeg = {
  legNo: number;
  fromIso2: string | null;
  toIso2: string | null;
  fromName?: string | null;
  toName?: string | null;
  transportMode: string | null; // by_road | by_rail | by_sea | by_air | …
  borderCrossing?: string | null; // customs point / border post
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  flightOrAwb?: string | null;
  status?: string | null; // leg status — a planned leg may still lack its crossing, a dispatched one may not
};

export type RouteIssue = {
  level: "error" | "warning";
  code: "route_gap" | "no_land_border" | "border_crossing_required" | "border_data_missing" | "country_missing" | "port_missing" | "airport_missing";
  legNo: number;
  message: string;
  from?: string; // country names for translated templates ({from} / {to})
  to?: string;
  suggestion?: string[]; // ISO2 path for no_land_border
};

const B: Record<string, string[]> = {
  AE: ["OM", "SA"], OM: ["AE", "SA", "YE"], SA: ["AE", "OM", "YE", "QA", "KW", "IQ", "JO", "BH"], QA: ["SA"], KW: ["SA", "IQ"], BH: ["SA"],
  YE: ["SA", "OM"], IQ: ["KW", "SA", "JO", "SY", "TR", "IR"], JO: ["SA", "IQ", "SY", "IL", "PS"], SY: ["TR", "IQ", "JO", "IL", "LB"], LB: ["SY", "IL"],
  IL: ["LB", "SY", "JO", "EG", "PS"], PS: ["IL", "JO", "EG"], EG: ["IL", "PS", "LY", "SD"],
  IR: ["IQ", "TR", "AM", "AZ", "TM", "AF", "PK"], TR: ["GR", "BG", "GE", "AM", "AZ", "IR", "IQ", "SY"],
  PK: ["IR", "AF", "CN", "IN"], AF: ["PK", "IR", "TM", "UZ", "TJ", "CN"], IN: ["PK", "CN", "NP", "BT", "BD", "MM"],
  CN: ["AF", "PK", "IN", "NP", "BT", "MM", "LA", "VN", "KP", "RU", "MN", "KZ", "KG", "TJ"],
  TJ: ["AF", "UZ", "KG", "CN"], UZ: ["AF", "TJ", "KG", "KZ", "TM"], TM: ["IR", "AF", "UZ", "KZ"], KZ: ["RU", "CN", "KG", "UZ", "TM"], KG: ["KZ", "UZ", "TJ", "CN"],
  AZ: ["RU", "GE", "AM", "IR", "TR"], AM: ["GE", "AZ", "IR", "TR"], GE: ["RU", "TR", "AM", "AZ"],
  RU: ["NO", "FI", "EE", "LV", "LT", "PL", "BY", "UA", "GE", "AZ", "KZ", "CN", "MN", "KP"], MN: ["RU", "CN"],
  NP: ["IN", "CN"], BT: ["IN", "CN"], BD: ["IN", "MM"], MM: ["IN", "BD", "CN", "LA", "TH"],
};

const LAND = new Set(["by_road", "by_rail", "road", "rail", "truck"]);

export function sharesLandBorder(a: string, b: string): boolean | null {
  const A = a.toUpperCase(), Bb = b.toUpperCase();
  if (A === Bb) return true;
  if (!B[A] && !B[Bb]) return null; // no data for either side
  return (B[A] ?? []).includes(Bb) || (B[Bb] ?? []).includes(A);
}

/** Shortest land path a → b (inclusive), or null. */
export function landPath(a: string, b: string): string[] | null {
  const start = a.toUpperCase(), goal = b.toUpperCase();
  const prev = new Map<string, string | null>([[start, null]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const n of B[cur] ?? []) if (!prev.has(n)) { prev.set(n, cur); q.push(n); }
  }
  if (!prev.has(goal)) return null;
  const path: string[] = [];
  for (let c: string | null = goal; c; c = prev.get(c) ?? null) path.unshift(c);
  return path;
}

export function validateRoute(legs: RouteLeg[], countryName: (iso2: string) => string = (x) => x): RouteIssue[] {
  const issues: RouteIssue[] = [];
  const sorted = [...legs].sort((x, y) => x.legNo - y.legNo);
  sorted.forEach((l, i) => {
    const name = (iso: string | null, n?: string | null) => n || (iso ? countryName(iso) : "?");
    const planned = !l.status || ["pending", "planned", "draft", "not_started"].includes(String(l.status).toLowerCase());
    if (!l.fromIso2 || !l.toIso2) {
      issues.push({ level: planned ? "warning" : "error", code: "country_missing", legNo: l.legNo, message: `Leg ${l.legNo}: choose the origin and destination country.` });
      return;
    }
    const next = sorted[i + 1];
    if (next && next.fromIso2 && l.toIso2.toUpperCase() !== next.fromIso2.toUpperCase()) {
      issues.push({ level: "error", code: "route_gap", legNo: next.legNo, from: name(l.toIso2, l.toName), to: name(next.fromIso2, next.fromName), message: `Leg ${next.legNo} starts in ${name(next.fromIso2, next.fromName)} but leg ${l.legNo} ends in ${name(l.toIso2, l.toName)} — the route has a gap.` });
    }
    const mode = (l.transportMode || "").toLowerCase();
    const crossBorder = l.fromIso2.toUpperCase() !== l.toIso2.toUpperCase();
    if (LAND.has(mode) && crossBorder) {
      const shares = sharesLandBorder(l.fromIso2, l.toIso2);
      if (shares === false) {
        const path = landPath(l.fromIso2, l.toIso2);
        issues.push({
          level: "error", code: "no_land_border", legNo: l.legNo, suggestion: path ?? undefined, from: name(l.fromIso2, l.fromName), to: name(l.toIso2, l.toName),
          message: `Leg ${l.legNo}: ${name(l.fromIso2, l.fromName)} and ${name(l.toIso2, l.toName)} do not share a land border — split it into legs through ${path ? path.slice(1, -1).map(countryName).join(" → ") : "a connecting country"}, or use sea / air.`,
        });
      } else if (shares === null) {
        issues.push({ level: "warning", code: "border_data_missing", legNo: l.legNo, from: name(l.fromIso2, l.fromName), to: name(l.toIso2, l.toName), message: `Leg ${l.legNo}: land-border data is not configured for ${name(l.fromIso2, l.fromName)} → ${name(l.toIso2, l.toName)}; confirm the crossing manually.` });
      }
      if (shares !== false && !(l.borderCrossing || "").trim()) {
        issues.push({ level: planned ? "warning" : "error", code: "border_crossing_required", legNo: l.legNo, from: name(l.fromIso2, l.fromName), to: name(l.toIso2, l.toName), message: `Leg ${l.legNo}: name the border crossing / customs point between ${name(l.fromIso2, l.fromName)} and ${name(l.toIso2, l.toName)}.` });
      }
    }
    if (mode === "by_sea" && !((l.portOfLoading || l.fromLocation) && (l.portOfDischarge || l.toLocation))) {
      issues.push({ level: "warning", code: "port_missing", legNo: l.legNo, message: `Leg ${l.legNo}: add the port of loading and port of discharge.` });
    }
    if (mode === "by_air" && !((l.fromLocation && l.toLocation) || l.flightOrAwb)) {
      issues.push({ level: "warning", code: "airport_missing", legNo: l.legNo, message: `Leg ${l.legNo}: add the departure / arrival airport or flight / AWB number.` });
    }
  });
  return issues;
}
