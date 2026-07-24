"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type SessionResponse = { user: { id: string; email: string | null; fullName: string | null }; roles: string[]; scopes: { countryIds: string[]; countryBranchIds: string[]; cityBranchIds: string[]; isSuperAdmin: boolean } };
type TableMeta = { name: string; label: string; scope: boolean };
type CountryRow = { id: string; name: string; currency_code?: string | null };
type MainBranchRow = { id: string; country_id: string; name: string; code: string; is_main?: boolean };
type CityBranchRow = { id: string; country_id: string; country_branch_id: string; name: string; city_name?: string; code: string };
type DataResponse = { table: string; label: string; rows: Record<string, unknown>[]; columns: string[]; limit: number };

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataPageClient({ lang: _lang }: { lang: SupportedLanguage }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState("enterprise_accounts");
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [branches, setBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = Boolean(session?.scopes.isSuperAdmin);
  const tableMeta = useMemo(() => tables.find((table) => table.name === selectedTable) ?? null, [selectedTable, tables]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionRes, tableRes, countryRes] = await Promise.all([
          apiGet<SessionResponse>("/api/erp/auth/session"),
          apiGet<{ tables: TableMeta[] }>("/api/erp/data/tables"),
          apiGet<{ countries: CountryRow[] }>("/api/erp/locations/countries?all=true&limit=500")
        ]);
        if (cancelled) return;
        setSession(sessionRes);
        setTables(tableRes.tables || []);
        setCountries(countryRes.countries || []);
        if (!sessionRes.scopes.isSuperAdmin && sessionRes.scopes.countryIds[0]) setCountryId(sessionRes.scopes.countryIds[0]);
        if (!sessionRes.scopes.isSuperAdmin && sessionRes.scopes.countryBranchIds.length === 1) setCountryBranchId(sessionRes.scopes.countryBranchIds[0]);
        if (!sessionRes.scopes.isSuperAdmin && sessionRes.scopes.cityBranchIds.length === 1) setCityBranchId(sessionRes.scopes.cityBranchIds[0]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Data Page.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBranches([]);
    setCityBranches([]);
    if (!countryId) return;
    (async () => {
      try {
        const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setBranches(Array.isArray(json.countryBranches) ? json.countryBranches : []);
      } catch {
        if (!cancelled) setBranches([]);
      }
    })();
    return () => { cancelled = true; };
  }, [countryId]);

  useEffect(() => {
    let cancelled = false;
    setCityBranches([]);
    if (!countryId || !countryBranchId) return;
    (async () => {
      try {
        const res = await fetch(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(countryBranchId)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setCityBranches(Array.isArray(json.cityBranches) ? json.cityBranches : []);
      } catch {
        if (!cancelled) setCityBranches([]);
      }
    })();
    return () => { cancelled = true; };
  }, [countryId, countryBranchId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ table: selectedTable, limit: "200" });
      if (q.trim()) params.set("q", q.trim());
      if (countryId) params.set("countryId", countryId);
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      if (cityBranchId) params.set("cityBranchId", cityBranchId);
      setData(await apiGet<DataResponse>(`/api/erp/data/table?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tables.length) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, countryId, countryBranchId, cityBranchId]);

  const columns = data?.columns || [];
  const rows = data?.rows || [];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Database className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-bold text-foreground">ERP Data Page</h1><p className="text-xs text-muted-foreground">Live database tables with country, branch, account and transaction visibility.</p></div>
        </div>
        <Button onClick={loadData} disabled={loading} size="sm"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Table<select className="h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>{tables.map((table) => <option key={table.name} value={table.name}>{table.label}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Country<select className="h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground" value={countryId} disabled={!isSuperAdmin && Boolean(session?.scopes.countryIds.length)} onChange={(e) => { setCountryId(e.target.value); setCountryBranchId(""); setCityBranchId(""); }}><option value="">All Countries</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Branch<select className="h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground" value={countryBranchId} onChange={(e) => { setCountryBranchId(e.target.value); setCityBranchId(""); }}><option value="">All Branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">City Branch<select className="h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground" value={cityBranchId} onChange={(e) => setCityBranchId(e.target.value)}><option value="">All City Branches</option>{cityBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name || branch.city_name} ({branch.code})</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground xl:col-span-2">Search<div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadData(); }} placeholder="Account no, name, manual code, PO, SO, serial..." /></div></label>
        </CardContent>
      </Card>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</div>}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3"><div><CardTitle className="text-sm">{data?.label || tableMeta?.label || "Table"}</CardTitle><p className="text-xs text-muted-foreground">Showing {rows.length} live rows from {selectedTable}</p></div></CardHeader>
        <CardContent className="overflow-auto px-0">
          <table className="min-w-full border-y text-xs">
            <thead className="sticky top-0 bg-muted/80 text-muted-foreground"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap border-r px-3 py-2 text-left font-bold uppercase">{column}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={Math.max(columns.length, 1)}>Loading live database rows...</td></tr> : rows.length ? rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b hover:bg-muted/40">{columns.map((column) => <td key={column} className="max-w-[260px] truncate border-r px-3 py-2 align-top text-foreground" title={valueText(row[column])}>{valueText(row[column])}</td>)}</tr>) : <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={Math.max(columns.length, 1)}>No records found for this table and scope.</td></tr>}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}