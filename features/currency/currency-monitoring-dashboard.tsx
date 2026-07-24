"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Save, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api/client";

type CountryCurrencyRow = {
  countryId: string;
  countryName: string;
  countryCode: string;
  currency: string;
  latestBuyRate: number;
  latestSellRate: number;
  latestDebitRate: number;
  latestCreditRate: number;
  rateDate: string | null;
  rateUpdatedAt: string | null;
  localDebit: number;
  localCredit: number;
  localBalance: number;
  usdDebit: number;
  usdCredit: number;
  usdBalance: number;
  transactionCount: number;
};

type MonitoringResponse = {
  isSuperAdmin: boolean;
  message?: string;
  countries: CountryCurrencyRow[];
  totals: {
    localDebit: number;
    localCredit: number;
    localBalance: number;
    usdDebit: number;
    usdCredit: number;
    usdBalance: number;
    transactionCount: number;
  };
};

function money(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function CurrencyMonitoringDashboard() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(isoToday());
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [debitRate, setDebitRate] = useState("");
  const [creditRate, setCreditRate] = useState("");
  const [rateDate, setRateDate] = useState(isoToday());
  const [savingRate, setSavingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await apiGet<MonitoringResponse>(`/api/erp/currency/monitoring?${params.toString()}`);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Currency monitoring failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load branches when country changes
  useEffect(() => {
    if (!selectedCountryId) {
      setBranches([]);
      setSelectedBranchId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${encodeURIComponent(selectedCountryId)}`);
        if (!cancelled) {
          setBranches(response.countryBranches || []);
          setSelectedBranchId("");
        }
      } catch (err) {
        console.error("Failed to load country branches", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId]);

  // Load active rate inputs when country or branch changes
  useEffect(() => {
    if (!selectedCountryId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          countryId: selectedCountryId,
          currency: "USD"
        });
        if (selectedBranchId) {
          params.set("countryBranchId", selectedBranchId);
        }
        const res = await apiGet<any>(`/api/erp/currency/latest-rate?${params.toString()}`);
        if (!cancelled && res) {
          if (res.source === "daily_usd_rates") {
            setBuyRate(res.buyRate ? String(res.buyRate) : "");
            setSellRate(res.sellRate ? String(res.sellRate) : "");
            setDebitRate(res.debitRate ? String(res.debitRate) : "");
            setCreditRate(res.creditRate ? String(res.creditRate) : "");
            if (res.effectiveDate) setRateDate(res.effectiveDate);
          } else {
            // Find fallback country rate from static data if available
            const countries = data?.countries ?? [];
            const current = countries.find((country) => country.countryId === selectedCountryId);
            if (current && !selectedBranchId) {
              setBuyRate(current.latestBuyRate ? String(current.latestBuyRate) : "");
              setSellRate(current.latestSellRate ? String(current.latestSellRate) : "");
              setDebitRate(current.latestDebitRate ? String(current.latestDebitRate) : "");
              setCreditRate(current.latestCreditRate ? String(current.latestCreditRate) : "");
              if (current.rateDate) setRateDate(current.rateDate);
            } else {
              setBuyRate("");
              setSellRate("");
              setDebitRate("");
              setCreditRate("");
              setRateDate(isoToday());
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest rate", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, selectedBranchId, data?.countries]);

  async function saveRate() {
    if (!selectedCountryId) {
      setRateMessage("Select a country first.");
      return;
    }
    setSavingRate(true);
    setRateMessage(null);
    try {
      await apiPost("/api/erp/currency/latest-rate", {
        countryId: selectedCountryId,
        countryBranchId: selectedBranchId || null,
        rateDate,
        buyingRate: buyRate,
        sellingRate: sellRate,
        debitRate: debitRate || buyRate,
        creditRate: creditRate || sellRate
      });
      setRateMessage("Active currency rate saved successfully.");
      await load();
    } catch (err) {
      setRateMessage(err instanceof Error ? err.message : "Currency rate save failed.");
    } finally {
      setSavingRate(false);
    }
  }

  const totals = data?.totals ?? {
    localDebit: 0,
    localCredit: 0,
    localBalance: 0,
    usdDebit: 0,
    usdCredit: 0,
    usdBalance: 0,
    transactionCount: 0
  };

  const currencyGroups = useMemo(() => {
    const map = new Map<string, { currency: string; balance: number; usd: number; countries: number }>();
    for (const row of data?.countries ?? []) {
      const current = map.get(row.currency) ?? { currency: row.currency, balance: 0, usd: 0, countries: 0 };
      current.balance += row.localBalance;
      current.usd += row.usdBalance;
      current.countries += 1;
      map.set(row.currency, current);
    }
    return [...map.values()];
  }, [data?.countries]);

  if (data && !data.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-600" aria-hidden />
            <div>
              <h1 className="text-xl font-black">Currency Monitoring Dashboard</h1>
              <p className="text-sm text-muted-foreground">{data.message}</p>
            </div>
          </div>
        </section>
        <RatePanel
          countries={data.countries}
          selectedCountryId={selectedCountryId}
          onCountryChange={setSelectedCountryId}
          branches={branches}
          selectedBranchId={selectedBranchId}
          onBranchChange={setSelectedBranchId}
          rateDate={rateDate}
          onRateDateChange={setRateDate}
          buyRate={buyRate}
          sellRate={sellRate}
          debitRate={debitRate}
          creditRate={creditRate}
          onBuyRateChange={setBuyRate}
          onSellRateChange={setSellRate}
          onDebitRateChange={setDebitRate}
          onCreditRateChange={setCreditRate}
          saving={savingRate}
          message={rateMessage}
          onSave={() => void saveRate()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Super Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Currency Monitoring Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Monitor local currency transactions and saved transaction-time USD equivalents across all countries.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[150px_150px_auto]">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-xs font-bold" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-xs font-bold" />
            <Button className="h-9 gap-2 text-xs font-black" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              {loading ? "Loading" : "Refresh"}
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <RatePanel
        countries={data?.countries ?? []}
        selectedCountryId={selectedCountryId}
        onCountryChange={setSelectedCountryId}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        rateDate={rateDate}
        onRateDateChange={setRateDate}
        buyRate={buyRate}
        sellRate={sellRate}
        debitRate={debitRate}
        creditRate={creditRate}
        onBuyRateChange={setBuyRate}
        onSellRateChange={setSellRate}
        onDebitRateChange={setDebitRate}
        onCreditRateChange={setCreditRate}
        saving={savingRate}
        message={rateMessage}
        onSave={() => void saveRate()}
      />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Total Debit Local" value={money(totals.localDebit)} />
        <Metric label="Total Credit Local" value={money(totals.localCredit)} />
        <Metric label="Total Balance Local" value={money(totals.localBalance)} />
        <Metric label="Total Debit USD" value={`$${money(totals.usdDebit)}`} tone="blue" />
        <Metric label="Total Credit USD" value={`$${money(totals.usdCredit)}`} tone="blue" />
        <Metric label="Total Balance USD" value={`$${money(totals.usdBalance)}`} tone="green" />
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_0.65fr]">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-black">Country Currency Monitor</h2>
              <p className="text-xs text-muted-foreground">Old transactions keep their saved USD rate and USD amount.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2 text-right">Sales Rate</th>
                  <th className="px-3 py-2 text-right">Purchase Rate</th>
                  <th className="px-3 py-2 text-right">Credit Rate</th>
                  <th className="px-3 py-2 text-right">Debit Rate</th>
                  <th className="px-3 py-2 text-right">Local Debit</th>
                  <th className="px-3 py-2 text-right">Local Credit</th>
                  <th className="px-3 py-2 text-right">Local Balance</th>
                  <th className="px-3 py-2 text-right">USD Debit</th>
                  <th className="px-3 py-2 text-right">USD Credit</th>
                  <th className="px-3 py-2 text-right">USD Balance</th>
                  <th className="px-3 py-2 text-right">Entries</th>
                </tr>
              </thead>
              <tbody>
                {(data?.countries ?? []).map((row) => {
                  let dateStr = "-";
                  let timeStr = "-";
                  if (row.rateUpdatedAt) {
                    const d = new Date(row.rateUpdatedAt);
                    dateStr = d.toLocaleDateString();
                    timeStr = d.toLocaleTimeString();
                  } else if (row.rateDate) {
                    dateStr = new Date(row.rateDate).toLocaleDateString();
                  }
                  
                  return (
                  <tr key={row.countryId} className="border-t">
                    <td className="px-3 py-2 font-black">{row.countryName}</td>
                    <td className="px-3 py-2">{row.currency}</td>
                    <td className="px-3 py-2 text-xs">{dateStr}</td>
                    <td className="px-3 py-2 text-xs">{timeStr}</td>
                    <td className="px-3 py-2 text-right">{money(row.latestSellRate, 4)}</td>
                    <td className="px-3 py-2 text-right">{money(row.latestBuyRate, 4)}</td>
                    <td className="px-3 py-2 text-right">{money(row.latestCreditRate, 4)}</td>
                    <td className="px-3 py-2 text-right">{money(row.latestDebitRate, 4)}</td>
                    <td className="px-3 py-2 text-right">{money(row.localDebit)}</td>
                    <td className="px-3 py-2 text-right">{money(row.localCredit)}</td>
                    <td className="px-3 py-2 text-right font-bold">{money(row.localBalance)}</td>
                    <td className="px-3 py-2 text-right text-blue-700 dark:text-blue-300">${money(row.usdDebit)}</td>
                    <td className="px-3 py-2 text-right text-blue-700 dark:text-blue-300">${money(row.usdCredit)}</td>
                    <td className="px-3 py-2 text-right font-black text-emerald-700 dark:text-emerald-300">${money(row.usdBalance)}</td>
                    <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-black">Currency-wise Balances</h2>
          </div>
          <div className="space-y-2">
            {currencyGroups.map((row) => (
              <div key={row.currency} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black">{row.currency}</span>
                  <span className="text-xs text-muted-foreground">{row.countries} countries</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Local Balance</p>
                    <p className="font-black">{money(row.balance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">USD Balance</p>
                    <p className="font-black text-emerald-700 dark:text-emerald-300">${money(row.usd)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!currencyGroups.length ? <p className="text-sm text-muted-foreground">No currency activity found.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function RatePanel({
  countries,
  selectedCountryId,
  onCountryChange,
  branches = [],
  selectedBranchId = "",
  onBranchChange = () => {},
  rateDate,
  onRateDateChange,
  buyRate,
  sellRate,
  debitRate,
  creditRate,
  onBuyRateChange,
  onSellRateChange,
  onDebitRateChange,
  onCreditRateChange,
  saving,
  message,
  onSave
}: {
  countries: CountryCurrencyRow[];
  selectedCountryId: string;
  onCountryChange: (value: string) => void;
  branches?: any[];
  selectedBranchId?: string;
  onBranchChange?: (value: string) => void;
  rateDate: string;
  onRateDateChange: (value: string) => void;
  buyRate: string;
  sellRate: string;
  debitRate: string;
  creditRate: string;
  onBuyRateChange: (value: string) => void;
  onSellRateChange: (value: string) => void;
  onDebitRateChange: (value: string) => void;
  onCreditRateChange: (value: string) => void;
  saving: boolean;
  message: string | null;
  onSave: () => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Active Exchange Rate</p>
        <h2 className="text-lg font-black">Country USD Rate Entry</h2>
        <p className="text-xs text-muted-foreground">
          New transactions use the latest active rate. Posted transactions keep their saved rate and USD amount.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-8">
        <label className="grid gap-1 text-xs font-bold md:col-span-2">
          Country
          <select
            value={selectedCountryId}
            onChange={(event) => onCountryChange(event.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm font-bold"
          >
            {countries.map((country) => (
              <option key={country.countryId} value={country.countryId}>
                {country.countryName} ({country.currency})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold">
          Branch Scope
          <select
            value={selectedBranchId}
            onChange={(event) => onBranchChange(event.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-xs font-bold"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold">
          Effective Date
          <Input type="date" value={rateDate} onChange={(event) => onRateDateChange(event.target.value)} className="h-9 text-xs font-bold" />
        </label>
        <RateInput label="Buy Rate" value={buyRate} onChange={onBuyRateChange} />
        <RateInput label="Sell Rate" value={sellRate} onChange={onSellRateChange} />
        <RateInput label="Debit Rate" value={debitRate} onChange={onDebitRateChange} />
        <RateInput label="Credit Rate" value={creditRate} onChange={onCreditRateChange} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{message ?? "Rates are stored in production daily_usd_rates and snapshotted on posting."}</p>
        <Button className="h-9 gap-2 text-xs font-black" onClick={onSave} disabled={saving || !countries.length}>
          <Save className="h-4 w-4" aria-hidden />
          {saving ? "Saving" : "Save Active Rate"}
        </Button>
      </div>
    </section>
  );
}

function RateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-bold">
      {label}
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 text-xs font-bold"
      />
    </label>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "blue" | "green" }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={tone === "blue" ? "mt-2 text-xl font-black text-blue-700 dark:text-blue-300" : tone === "green" ? "mt-2 text-xl font-black text-emerald-700 dark:text-emerald-300" : "mt-2 text-xl font-black"}>
        {value}
      </p>
    </div>
  );
}
