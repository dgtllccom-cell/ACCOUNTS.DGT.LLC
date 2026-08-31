"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  PlusCircle,
  RefreshCw,
  Printer,
  Building2,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from "lucide-react";

type CapitalSummary = {
  total_opening_capital?: number;
  total_additional_investment?: number;
  total_capital_returned?: number;
  total_owner_drawings?: number;
  total_annual_pl?: number;
};

type CountryBreakdown = {
  country_id: string;
  country_name: string;
  currency_code: string;
  opening_investment: number;
  additional_investment: number;
  capital_returned: number;
  net_investment: number;
  income_total: number;
  expense_total: number;
  annual_profit_loss: number;
  closing_position: number;
};

type CapitalEntry = {
  id: string;
  account_type: string;
  country_name?: string;
  description?: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  global_reference_id?: string;
  created_at: string;
  posted_by_name?: string;
};

export default function SuperAdminInvestmentsPage() {
  const language = useActiveLanguage();
  const t = (k: string) => translateHeader(language, k);

  const [summary, setSummary] = useState<CapitalSummary>({});
  const [countries, setCountries] = useState<CountryBreakdown[]>([]);
  const [recentEntries, setRecentEntries] = useState<CapitalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [accountType, setAccountType] = useState<string>("opening_capital");
  const [countryId, setCountryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/super-admin/accounting");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || {});
        setCountries(data.countryBreakdowns || []);
        setRecentEntries(data.recentEntries || []);
      }
    } catch (e) {
      console.warn("Failed to fetch super admin accounting data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!amount || Number(amount) <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid amount." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/erp/super-admin/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          countryId: countryId || null,
          description,
          amount: Number(amount),
          currency,
          exchangeRate: Number(exchangeRate || 1),
          referenceNo,
          narration,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to post capital entry");

      setFeedback({ type: "success", message: `Capital entry (${data.globalReferenceId}) posted successfully!` });
      setAmount("");
      setDescription("");
      setReferenceNo("");
      setNarration("");
      fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Posting failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculateCountry = async (cId: string) => {
    try {
      const res = await fetch("/api/erp/super-admin/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId: cId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.warn("Recalculation error", e);
    }
  };

  const netCapital =
    Number(summary.total_opening_capital || 0) +
    Number(summary.total_additional_investment || 0) -
    Number(summary.total_capital_returned || 0) -
    Number(summary.total_owner_drawings || 0);

  const handlePrintInvestmentLedger = () => {
    openUniversalPrintReport({
      title: "Country Investment Ledger Report",
      reportType: "register",
      scope: { company: "General Brand", scopeLevel: "Super Admin Protected" },
      columns: [
        { key: "country_name", label: t("COUNTRY"), width: "16%" },
        { key: "opening_investment", label: t("OPENING CAPITAL"), align: "right", width: "12%" },
        { key: "additional_investment", label: t("ADDITIONAL INVESTMENT"), align: "right", width: "12%" },
        { key: "capital_returned", label: t("CAPITAL RETURNED"), align: "right", width: "12%" },
        { key: "net_investment", label: t("NET INVESTMENT"), align: "right", width: "12%" },
        { key: "income_total", label: t("INCOME"), align: "right", width: "12%" },
        { key: "expense_total", label: t("EXPENSES"), align: "right", width: "12%" },
        { key: "closing_position", label: t("CLOSING POSITION"), align: "right", width: "12%" },
      ],
      rows: countries.map((c) => ({
        ...c,
        opening_investment: Number(c.opening_investment).toFixed(2),
        additional_investment: Number(c.additional_investment).toFixed(2),
        capital_returned: Number(c.capital_returned).toFixed(2),
        net_investment: Number(c.net_investment).toFixed(2),
        income_total: Number(c.income_total).toFixed(2),
        expense_total: Number(c.expense_total).toFixed(2),
        closing_position: Number(c.closing_position).toFixed(2),
      })),
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {t("SUPER ADMIN ACCOUNTING")} &amp; {t("COUNTRY INVESTMENT LEDGER")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Protected capital, equity movements, and country investment ledger strictly isolated from operating P&L")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("REFRESH")}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintInvestmentLedger}>
            <Printer className="h-4 w-4 mr-1" />
            {t("PRINT REPORT")}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {feedback.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t("OPENING CAPITAL")}</span>
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-foreground">
              ${Number(summary.total_opening_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t("ADDITIONAL INVESTMENT")}</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-600">
              +${Number(summary.total_additional_investment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t("CAPITAL RETURNED")}</span>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-amber-600">
              -${Number(summary.total_capital_returned || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t("OWNER DRAWINGS")}</span>
              <Wallet className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold text-rose-600">
              -${Number(summary.total_owner_drawings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-primary/5">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t("NET CAPITAL")}</span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold text-primary">
              ${netCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capital Entry Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              {t("RECORD CAPITAL MOVEMENT")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePostEntry} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("ACCOUNT TYPE")} *</Label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  required
                >
                  <option value="opening_capital">{t("OPENING CAPITAL")}</option>
                  <option value="additional_investment">{t("ADDITIONAL INVESTMENT")}</option>
                  <option value="capital_returned">{t("CAPITAL RETURNED")}</option>
                  <option value="owner_drawings">{t("OWNER DRAWINGS")}</option>
                  <option value="annual_profit_loss">{t("ANNUAL PROFIT / LOSS")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("COUNTRY")} (Optional - Global if blank)</Label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">-- Global / All Countries --</option>
                  {countries.map((c) => (
                    <option key={c.country_id} value={c.country_id}>
                      {c.country_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>{t("AMOUNT")} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("CURRENCY")}</Label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("EXCHANGE RATE")} (to USD)</Label>
                <Input
                  type="number"
                  step="0.00000001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("REF NO.")}</Label>
                <Input
                  placeholder="Doc / Bank Ref #"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("DESCRIPTION / PARTICULARS")}</Label>
                <Input
                  placeholder="Notes, resolution details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t("LOADING...") : t("SAVE")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Country Investment Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {t("COUNTRY INVESTMENT LEDGER")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-muted/50 border-y border-border">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-semibold">{t("COUNTRY")}</th>
                    <th className="py-2.5 px-3 text-right font-semibold">{t("NET INVESTMENT")}</th>
                    <th className="py-2.5 px-3 text-right font-semibold">{t("INCOME")}</th>
                    <th className="py-2.5 px-3 text-right font-semibold">{t("EXPENSES")}</th>
                    <th className="py-2.5 px-3 text-right font-semibold">{t("CLOSING POSITION")}</th>
                    <th className="py-2.5 px-3 text-center font-semibold">{t("ACTIONS")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        {t("NO LEDGER TRANSACTIONS FOUND FOR THE SELECTED PERIOD.")}
                      </td>
                    </tr>
                  ) : (
                    countries.map((c) => (
                      <tr key={c.country_id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium">{c.country_name}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          ${Number(c.net_investment).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                          ${Number(c.income_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600 font-medium">
                          ${Number(c.expense_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-primary">
                          ${Number(c.closing_position).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleRecalculateCountry(c.country_id)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Recalc
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Capital Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("AUDIT TRAIL")} - Recent Capital Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-muted/50 border-y border-border">
                <tr>
                  <th className="py-2.5 px-4 text-left font-semibold">Ref</th>
                  <th className="py-2.5 px-4 text-left font-semibold">{t("ENTRY TYPE")}</th>
                  <th className="py-2.5 px-4 text-left font-semibold">{t("COUNTRY")}</th>
                  <th className="py-2.5 px-4 text-right font-semibold">{t("AMOUNT")}</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Base (USD)</th>
                  <th className="py-2.5 px-4 text-left font-semibold">{t("DESCRIPTION / PARTICULARS")}</th>
                  <th className="py-2.5 px-4 text-left font-semibold">{t("USER / OPERATOR")}</th>
                  <th className="py-2.5 px-4 text-left font-semibold">{t("DATE")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      No capital movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentEntries.map((re) => (
                    <tr key={re.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-mono font-medium">{re.global_reference_id || "-"}</td>
                      <td className="py-2.5 px-4 capitalize font-semibold">{re.account_type.replace(/_/g, " ")}</td>
                      <td className="py-2.5 px-4">{re.country_name || "Global"}</td>
                      <td className="py-2.5 px-4 text-right font-semibold">
                        {Number(re.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {re.currency}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-primary">
                        ${Number(re.base_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{re.description || "-"}</td>
                      <td className="py-2.5 px-4">{re.posted_by_name || "—"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {new Date(re.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
