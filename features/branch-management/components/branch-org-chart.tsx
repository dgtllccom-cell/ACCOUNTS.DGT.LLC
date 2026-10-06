"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Globe2,
  Building2,
  MapPin,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  UserCog,
  Briefcase
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type Employee = {
  id: string;
  name: string;
  designation: string | null;
  employeeCode: string | null;
  managerName: string | null;
};

type Department = {
  name: string;
  employees: Employee[];
};

type CityBranchNode = {
  id: string;
  name: string;
  code: string;
  cityName: string | null;
  status: string | null;
  employeeCount: number;
  departments: Department[];
};

type BranchNode = {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
  status: string | null;
  employeeCount: number;
  cityBranchCount: number;
  departments: Department[];
  cityBranches: CityBranchNode[];
};

type CountryNode = {
  id: string;
  name: string;
  iso2: string | null;
  currencyCode: string | null;
  employeeCount: number;
  branchCount: number;
  departments: Department[];
  branches: BranchNode[];
};

type OrgChartResponse = {
  countries: CountryNode[];
  unassigned: { employeeCount: number; departments: Department[] };
};

/** Compact chip shown collapsed; click anywhere on the row to expand/collapse. */
function NodeChip({
  icon: Icon,
  title,
  subtitle,
  countLabel,
  expanded,
  onToggle,
  tone
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string | null;
  countLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  tone: "country" | "branch" | "city" | "dept";
}) {
  const tones = {
    country: "border-indigo-200 bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/30",
    branch: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30",
    city: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
    dept: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
  } as const;
  const iconTones = {
    country: "bg-indigo-600",
    branch: "bg-blue-600",
    city: "bg-emerald-600",
    dept: "bg-slate-500"
  } as const;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start shadow-sm transition-all hover:shadow-md ${tones[tone]} ${expanded ? "ring-1 ring-primary/30" : ""}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${iconTones[tone]}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</span>
        ) : null}
      </span>
      {countLabel ? (
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
          {countLabel}
        </span>
      ) : null}
      {expanded ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden />
      )}
    </button>
  );
}

function DepartmentBlock({ dept }: { dept: Department }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-start"
      >
        <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">{dept.name}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {dept.employees.length}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180" />}
      </button>
      {open && dept.employees.length > 0 && (
        <div className="space-y-1 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
          {dept.employees.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {emp.name.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{emp.name}</span>
                {emp.designation ? (
                  <span className="block truncate text-[10px] text-slate-400">{emp.designation}</span>
                ) : null}
              </span>
              {emp.managerName ? (
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400" title={emp.managerName}>
                  <UserCog className="h-3 w-3" /> {emp.managerName}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentsAndEmployees({ departments, lang }: { departments: Department[]; lang: string }) {
  const totalEmployees = departments.reduce((sum, d) => sum + d.employees.length, 0);
  if (totalEmployees === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800">
        {t(lang, "orgchart.no_employees", "No employees assigned yet.")}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {departments.map((dept) => (
        <DepartmentBlock key={dept.name} dept={dept} />
      ))}
    </div>
  );
}

function CityBranchNodeView({ node, lang }: { node: CityBranchNode; lang: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <NodeChip
        icon={MapPin}
        title={node.name}
        subtitle={[node.cityName, node.code].filter(Boolean).join(" · ")}
        countLabel={`${node.employeeCount} ${t(lang, "orgchart.staff", "staff")}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        tone="city"
      />
      {expanded && (
        <div className="ms-4 mt-2 border-s-2 border-emerald-100 ps-4 dark:border-emerald-900/40">
          <DepartmentsAndEmployees departments={node.departments} lang={lang} />
        </div>
      )}
    </div>
  );
}

function BranchNodeView({ node, lang }: { node: BranchNode; lang: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <NodeChip
        icon={Building2}
        title={node.name}
        subtitle={`${node.code}${node.isMain ? ` · ${t(lang, "orgchart.main_branch", "Main Branch")}` : ""}`}
        countLabel={`${node.employeeCount} ${t(lang, "orgchart.staff", "staff")}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        tone="branch"
      />
      {expanded && (
        <div className="ms-4 mt-2 space-y-3 border-s-2 border-blue-100 ps-4 dark:border-blue-900/40">
          {node.departments.some((d) => d.employees.length > 0) && (
            <DepartmentsAndEmployees departments={node.departments} lang={lang} />
          )}
          {node.cityBranches.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t(lang, "orgchart.city_locations", "City / Location Branches")}
              </p>
              {node.cityBranches.map((cb) => (
                <CityBranchNodeView key={cb.id} node={cb} lang={lang} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function UnassignedNodeView({ departments, count, lang }: { departments: Department[]; count: number; lang: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <NodeChip
        icon={Users}
        title={t(lang, "orgchart.unassigned", "Unassigned Employees")}
        subtitle={t(lang, "orgchart.unassigned_hint", "Not yet linked to a country or branch")}
        countLabel={`${count} ${t(lang, "orgchart.staff", "staff")}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        tone="dept"
      />
      {expanded && (
        <div className="ms-4 mt-2 border-s-2 border-slate-100 ps-4 dark:border-slate-800">
          <DepartmentsAndEmployees departments={departments} lang={lang} />
        </div>
      )}
    </div>
  );
}

function CountryNodeView({ node, lang, defaultExpanded }: { node: CountryNode; lang: string; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div>
      <NodeChip
        icon={Globe2}
        title={node.name}
        subtitle={[node.iso2, node.currencyCode].filter(Boolean).join(" · ")}
        countLabel={`${node.branchCount} ${t(lang, "orgchart.branches", "branches")} · ${node.employeeCount} ${t(lang, "orgchart.staff", "staff")}`}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        tone="country"
      />
      {expanded && (
        <div className="ms-4 mt-2 space-y-2 border-s-2 border-indigo-100 ps-4 dark:border-indigo-900/40">
          {node.departments.some((d) => d.employees.length > 0) && (
            <DepartmentsAndEmployees departments={node.departments} lang={lang} />
          )}
          {node.branches.length > 0 ? (
            node.branches.map((b) => <BranchNodeView key={b.id} node={b} lang={lang} />)
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800">
              {t(lang, "orgchart.no_branches", "No branches created yet for this country.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BranchOrgChart() {
  const lang = useActiveLanguage();
  const [data, setData] = useState<OrgChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<OrgChartResponse>("/api/branch-management/org-chart");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organization chart.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    if (!data) return { countries: 0, branches: 0, cityBranches: 0, employees: 0 };
    let branches = 0;
    let cityBranches = 0;
    let employees = data.unassigned.employeeCount;
    for (const c of data.countries) {
      branches += c.branches.length;
      employees += c.employeeCount;
      for (const b of c.branches) cityBranches += b.cityBranches.length;
    }
    return { countries: data.countries.length, branches, cityBranches, employees };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            {t(lang, "orgchart.title", "Branch Organization Chart")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(lang, "orgchart.subtitle", "Live structure generated automatically from Country, Branch, City Branch, and Employee records — click any node to expand.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {t(lang, "common.refresh", "Refresh")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t(lang, "orgchart.stat_countries", "Countries"), value: totals.countries, icon: Globe2 },
          { label: t(lang, "orgchart.stat_branches", "Main Branches"), value: totals.branches, icon: Building2 },
          { label: t(lang, "orgchart.stat_city_branches", "City Branches"), value: totals.cityBranches, icon: MapPin },
          { label: t(lang, "orgchart.stat_employees", "Employees"), value: totals.employees, icon: Users }
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{s.label}</span>
            </div>
            <p className="mt-1.5 text-xl font-black text-slate-900 dark:text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t(lang, "orgchart.loading", "Loading organization chart...")}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-bold text-rose-600">{t(lang, "orgchart.error", "Could not load the organization chart.")}</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : !data || data.countries.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {t(lang, "orgchart.no_countries", "No countries have been created yet.")}
          </p>
        ) : (
          <div className="space-y-3">
            {data.countries.map((c, idx) => (
              <CountryNodeView key={c.id} node={c} lang={lang} defaultExpanded={idx === 0 && data.countries.length <= 2} />
            ))}
            {data.unassigned.employeeCount > 0 && (
              <UnassignedNodeView
                departments={data.unassigned.departments}
                count={data.unassigned.employeeCount}
                lang={lang}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
