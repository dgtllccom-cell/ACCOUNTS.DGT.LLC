"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { getLedgerStatement, listLedgerReportLedgers, type LedgerLookupRow, type LedgerStatementLine } from "@/features/reports/ledger-report/ledger-report-api";
import { Loader2 } from "lucide-react";

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
};

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}

export function UnifiedDetailedLedgerView() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    setPortalNode(document.getElementById("erp-page-actions-slot"));
    
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((info: SessionInfo) => {
        if (active) {
          setSessionInfo(info);
          setIsSuperAdmin(info?.roles?.includes("super_admin") || false);
        }
      })
      .catch(console.error);
    return () => { active = false; };
  }, []);

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  
  // Extra Unified Filters (Country / Branch / User)
  const [filterType, setFilterType] = useState<"none" | "country" | "branch" | "user">("none");
  const [filterValue, setFilterValue] = useState("");
  
  // Data
  const [header, setHeader] = useState<LedgerLookupRow | null>(null);
  const [lines, setLines] = useState<LedgerStatementLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [ledgerOptions, setLedgerOptions] = useState<SearchSelectOption[]>([]);
  const [searchingLedgers, setSearchingLedgers] = useState(false);

  // Exchange Rate (only relevant for super admin, but kept in state)
  const [exchangeRate, setExchangeRate] = useState<number>(278.50);

  // Search ledgers for dropdown
  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      setSearchingLedgers(true);
      try {
        const scope = isSuperAdmin ? "super_admin" : "country";
        const res = await listLedgerReportLedgers({ reportScope: scope as any, limit: 100 });
        if (active && res?.ledgers) {
          const grouped = new Map<string, { label: string; ids: string[] }>();
          for (const row of res.ledgers) {
            const key = row.accountId || row.accountCode || row.ledgerCode;
            if (!grouped.has(key)) {
              grouped.set(key, {
                label: `${row.accountCode || row.ledgerCode} - ${row.accountName || row.ledgerName} (${row.ledgerCurrency})`,
                ids: []
              });
            }
            grouped.get(key)!.ids.push(row.ledgerId);
          }
          const options = Array.from(grouped.values()).map(g => ({
            value: g.ids.join(","),
            label: g.label
          }));
          setLedgerOptions(options);
        }
      } catch (e) {
        console.error("Failed to load ledgers", e);
      } finally {
        if (active) setSearchingLedgers(false);
      }
    };
    fetchOptions();
    return () => { active = false; };
  }, [isSuperAdmin]);

  const loadStatement = async () => {
    if (!selectedLedgerId) return;
    setLoading(true);
    try {
      const res = await getLedgerStatement({
        ledgerId: selectedLedgerId.split(","),
        fromDate,
        toDate,
        limit: 1000
      });
      if (res.found) {
        setHeader(res.header);
        setLines(res.lines || []);
      }
    } catch (e) {
      console.error("Failed to load statement", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    loadStatement();
  };

  const handleReset = () => {
    setSelectedLedgerId(null);
    setHeader(null);
    setLines([]);
    setExchangeRate(278.50);
    setFilterType("none");
    setFilterValue("");
  };

  const filterDropdownOptions = useMemo(() => {
    if (filterType === "none" || !lines) return [];
    let values = new Set<string>();
    lines.forEach(line => {
      if (filterType === "user" && line.createdByName) values.add(line.createdByName);
      if (filterType === "branch" && line.branchName) values.add(line.branchName);
      if (filterType === "country" && header?.countryName) values.add(header.countryName);
    });
    return Array.from(values).sort().map(v => ({ label: v, value: v }));
  }, [filterType, lines, header]);

  const calculatedTotals = useMemo(() => {
    let sumDr = 0;
    let sumCr = 0;
    let sumDrPkr = 0;
    let sumCrPkr = 0;
    let running = 0;

    const filteredLines = lines.filter(line => {
      if (filterType === "none" || !filterValue) return true;
      if (filterType === "user") return line.createdByName === filterValue;
      if (filterType === "branch") return line.branchName === filterValue;
      if (filterType === "country") return header?.countryName === filterValue;
      return true;
    });

    const mappedLines = filteredLines.map(line => {
      sumDr += line.debit || 0;
      sumCr += line.credit || 0;
      running += (line.debit || 0) - (line.credit || 0);

      const drPkr = (line.debit || 0) * exchangeRate;
      const crPkr = (line.credit || 0) * exchangeRate;

      sumDrPkr += drPkr;
      sumCrPkr += crPkr;

      return {
        ...line,
        runningBalance: running,
        drPkr,
        crPkr
      };
    });

    return {
      lines: mappedLines,
      sumDr,
      sumCr,
      sumDrPkr,
      sumCrPkr,
      running
    };
  }, [lines, exchangeRate, filterType, filterValue, header]);

  return (
    <div className="p-4 bg-[#f7f8fb] min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .report-section h5 { margin-bottom:6px; font-weight:600; font-size:13px; color:#111827; border-bottom:2px solid #dee2e6; padding-bottom:4px; }
        .report-row { display:flex; flex-wrap:wrap; justify-content:space-between; margin-bottom:10px; gap: 10px; }
        .report-col { flex:1; min-width:200px; background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .kv { display:flex; gap:4px; align-items:center; margin:4px 0; }
        .kv .k { min-width:110px; font-size:11.5px; color:#6b7280; font-weight: 500; }
        .kv .v { font-size:12px; font-weight:600; color:#111827; word-break: break-word; }
        .entry-table th, .entry-table td { font-size:11px; padding:6px 8px; border: 1px solid #dee2e6; }
        .entry-table thead th { background:#212529; color:#fff; text-align:center; white-space: nowrap; }
        .entry-table tbody tr:nth-child(even) { background-color: #f8f9fa; }
      `}} />

      {/* Top Filters Bar Portal */}
      {portalNode && createPortal(
        <div className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-lg border border-slate-200 shadow-sm">
          <div className="w-[200px]">
            <SearchSelect
              label=""
              options={ledgerOptions}
              value={selectedLedgerId ?? ""}
              onValueChange={(v: string) => setSelectedLedgerId(v)}
              placeholder="Search Account No..."
            />
          </div>
          
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
            <span className="text-[10px] text-slate-500 font-semibold px-1">From</span>
            <Input type="date" className="h-6 w-[105px] text-xs border-0 shadow-none bg-transparent p-0 focus-visible:ring-0" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span className="text-[10px] text-slate-500 font-semibold px-1 border-l border-slate-200 ml-1 pl-2">To</span>
            <Input type="date" className="h-6 w-[105px] text-xs border-0 shadow-none bg-transparent p-0 focus-visible:ring-0" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          <div className="w-[150px] flex gap-1">
            <div className="flex-1">
              <select 
                className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={filterType}
                onChange={e => {
                  setFilterType(e.target.value as any);
                  setFilterValue("");
                }}
              >
                <option value="none">Filter By</option>
                <option value="country">Country</option>
                <option value="branch">Branch</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
          {filterType !== "none" && (
            <div className="w-[140px]">
              <SearchSelect
                label=""
                options={filterDropdownOptions}
                value={filterValue}
                onValueChange={(v: string) => setFilterValue(v)}
                placeholder={`Select ${filterType}...`}
              />
            </div>
          )}

          <div className="flex gap-1 ml-1">
            <Button size="sm" onClick={handleApply} disabled={loading} className="text-[10px] h-7 px-3">
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="text-[10px] h-7 px-2">Reset</Button>
          </div>
        </div>,
        portalNode
      )}

      {/* Top Row Details (4 Boxes now) */}
      <div className="report-row report-section">
        <div className="report-col">
          <h5>Account Details</h5>
          <div className="kv"><div className="k">A/c Name:</div><div className="v">{header?.accountName || header?.ledgerName || "-"}</div></div>
          <div className="kv"><div className="k">A/c Number:</div><div className="v">{header?.accountCode || header?.ledgerCode || "-"}</div></div>
          <div className="kv"><div className="k">Category:</div><div className="v">{header?.accountKind || "-"}</div></div>
          <div className="kv"><div className="k">Type:</div><div className="v">{header?.normalBalance || "-"}</div></div>
          <div className="kv"><div className="k">Currency:</div><div className="v">{header?.ledgerCurrency || "-"}</div></div>
        </div>

        <div className="report-col">
          <h5>Company Details</h5>
          <div className="kv"><div className="k">Company Name:</div><div className="v">{header?.companyName || "Damaan General Trading LLC"}</div></div>
          <div className="kv"><div className="k">City:</div><div className="v">{header?.cityName || "-"}</div></div>
          <div className="kv"><div className="k">State:</div><div className="v">{header?.stateName || "-"}</div></div>
          <div className="kv"><div className="k">Address:</div><div className="v">{header?.address || "-"}</div></div>
        </div>

        <div className="report-col">
          <h5>Branch & Session Details</h5>
          <div className="kv"><div className="k">Branch Name:</div><div className="v">{header?.cityBranchName || header?.countryBranchName || "-"}</div></div>
          <div className="kv"><div className="k">Country:</div><div className="v">{header?.countryName || "-"}</div></div>
          <div className="kv"><div className="k">User Name:</div><div className="v">{sessionInfo?.user?.fullName || "Admin"}</div></div>
          <div className="kv"><div className="k">Login Date:</div><div className="v">{new Date().toLocaleDateString()}</div></div>
        </div>

        <div className="report-col">
          <h5>Ledger Summary</h5>
          <div className="kv"><div className="k">Entries:</div><div className="v">{lines.length}</div></div>
          <div className="kv"><div className="k">Dr:</div><div className="v text-rose-600">{fmt(calculatedTotals.sumDr)}</div></div>
          <div className="kv"><div className="k">Cr:</div><div className="v text-emerald-600">{fmt(calculatedTotals.sumCr)}</div></div>
          <div className="kv"><div className="k">Balance:</div><div className={`v ${calculatedTotals.running < 0 ? 'text-rose-600' : calculatedTotals.running > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{fmt(calculatedTotals.running)}</div></div>
          
          {isSuperAdmin && (
            <div className="kv">
              <div className="k">Exchange Rate:</div>
              <div className="v text-blue-600 flex items-center gap-1">
                1 USD =
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={exchangeRate} 
                  onChange={(e) => setExchangeRate(Number(e.target.value) || 0)}
                  className="h-7 w-24 text-xs inline-flex px-1" 
                />
                PKR
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Ledger Entries */}
      <div className="mt-4 bg-white p-3 border border-slate-200 rounded-md shadow-sm overflow-x-auto report-section">
        <h5 className="mb-3">Ledger Entries</h5>
        <table className="w-full text-left border-collapse entry-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Serial</th>
              <th>Name</th>
              <th>No.</th>
              <th>Details</th>
              <th>Dr.</th>
              <th>Cr.</th>
              <th>Total</th>
              {isSuperAdmin && (
                <>
                  <th>Ex. Rate</th>
                  <th>Dr. (PKR)</th>
                  <th>Cr. (PKR)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {calculatedTotals.lines.map((line, idx) => (
              <tr key={idx}>
                <td className="whitespace-nowrap">{line.entryDate?.split('T')[0] || "-"}</td>
                <td className="whitespace-nowrap">{line.branchSerialNo || line.countrySerialNo || line.superAdminSerialNo || "-"}</td>
                <td className="whitespace-nowrap"><a href="#" className="text-blue-600 hover:underline">{line.createdByName || "-"}</a></td>
                <td className="whitespace-nowrap">{line.referenceNo || "-"}</td>
                <td>{line.description || "-"}</td>
                <td className="text-right text-rose-700 font-medium">{line.debit ? fmt(line.debit) : "0"}</td>
                <td className="text-right text-emerald-700 font-medium">{line.credit ? fmt(line.credit) : "0"}</td>
                <td className={`text-right font-bold ${line.runningBalance < 0 ? 'text-rose-700' : line.runningBalance > 0 ? 'text-emerald-700' : ''}`}>
                  {fmt(line.runningBalance)}
                </td>
                {isSuperAdmin && (
                  <>
                    <td className="text-center">{exchangeRate.toFixed(2)}</td>
                    <td className="text-right text-blue-700 font-medium">{line.debit ? fmt(line.drPkr) : "0.00"}</td>
                    <td className="text-right text-amber-600 font-medium">{line.credit ? fmt(line.crPkr) : "0.00"}</td>
                  </>
                )}
              </tr>
            ))}
            {calculatedTotals.lines.length === 0 && !loading && (
              <tr>
                <td colSpan={isSuperAdmin ? 11 : 8} className="text-center py-6 text-slate-500">No entries found. Select an account and apply filters.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={isSuperAdmin ? 11 : 8} className="text-center py-6 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading data...</td>
              </tr>
            )}
          </tbody>
          {calculatedTotals.lines.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={5} className="text-right">Totals</td>
                <td className="text-right text-rose-700">{fmt(calculatedTotals.sumDr)}</td>
                <td className="text-right text-emerald-700">{fmt(calculatedTotals.sumCr)}</td>
                <td className={`text-right ${calculatedTotals.running < 0 ? 'text-rose-700' : calculatedTotals.running > 0 ? 'text-emerald-700' : ''}`}>{fmt(calculatedTotals.running)}</td>
                {isSuperAdmin && (
                  <>
                    <td className="text-center">—</td>
                    <td className="text-right text-blue-700">{fmt(calculatedTotals.sumDrPkr)}</td>
                    <td className="text-right text-amber-600">{fmt(calculatedTotals.sumCrPkr)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
