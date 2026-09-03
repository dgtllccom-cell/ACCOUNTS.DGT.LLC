"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Globe,
  Globe2,
  Handshake,
  Plus,
  RefreshCcw,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type CountryRecord = {
  id: string;
  name: string;
  iso2?: string | null;
  iso3?: string | null;
  currency_code: string;
  official_email?: string | null;
  admin_email?: string | null;
  whatsapp_number?: string | null;
  created_at?: string;
};

/** The registration / contract / document type registries each have their own
 *  dedicated, API-backed module. This page links to them instead of shipping a
 *  second (non-persistent) editor. */
function ManagedElsewhere({
  icon: Icon, title, tone, href, openLabel, desc
}: {
  icon: typeof FileCheck2; title: string; tone: string; href: Route; openLabel: string; desc: string;
}) {
  return (
    <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl">
      <CardContent className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tone)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Button asChild className="shrink-0 gap-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
          <Link href={href}>{openLabel} <ArrowUpRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ManagementSettingsPage() {
  const lang = useActiveLanguage();
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");

  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryIso2, setNewCountryIso2] = useState("");
  const [newCountryCurrency, setNewCountryCurrency] = useState("USD");
  const [newCountryOfficialEmail, setNewCountryOfficialEmail] = useState("");
  const [newCountryAdminEmail, setNewCountryAdminEmail] = useState("");
  const [addingCountry, setAddingCountry] = useState(false);

  async function fetchCountries() {
    setLoadingCountries(true);
    try {
      const res = await fetch("/api/branch-management/countries");
      const json = await res.json();
      if (res.ok && json.countries) setCountries(json.countries);
    } catch (err) {
      console.error("Failed to load countries:", err);
    } finally {
      setLoadingCountries(false);
    }
  }

  useEffect(() => { fetchCountries(); }, []);

  async function handleAddCountry(e: React.FormEvent) {
    e.preventDefault();
    if (!newCountryName.trim()) return;
    setAddingCountry(true);
    setMessage("");
    try {
      const res = await fetch("/api/branch-management/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCountryName.trim(),
          iso2: newCountryIso2.trim().toUpperCase() || "XX",
          iso3: newCountryIso2.trim().toUpperCase() + "X",
          currencyCode: newCountryCurrency.trim().toUpperCase() || "USD",
          officialEmail: newCountryOfficialEmail.trim().toLowerCase() || `info@${newCountryName.toLowerCase().replace(/\s+/g, "")}.com`,
          adminEmail: newCountryAdminEmail.trim().toLowerCase() || `admin@${newCountryName.toLowerCase().replace(/\s+/g, "")}.com`
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.error || t(lang, "mgmt.err_create_country", "Failed to create country"));
      setMessage("✅ " + t(lang, "mgmt.country_added", "Country added to master data."));
      setNewCountryName("");
      setNewCountryIso2("");
      setNewCountryOfficialEmail("");
      setNewCountryAdminEmail("");
      await fetchCountries();
    } catch (err: any) {
      setMessage("❌ " + (err.message || t(lang, "mgmt.err_add_country", "Failed to add country")));
    } finally {
      setAddingCountry(false);
    }
  }

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.iso2 || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.currency_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 text-foreground p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              {t(lang, "mgmt.eyebrow", "Settings & Master Data Management")}
            </p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            {t(lang, "mgmt.title", "Management Parameters & Live Data Hub")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            {t(lang, "mgmt.subtitle", "Live database registry for nations and cities. Registration, contract and document types are managed in their own dedicated modules.")}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button onClick={fetchCountries} disabled={loadingCountries} variant="outline" className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3 rounded-xl shadow-sm">
            <RefreshCcw className={cn("h-4 w-4 mr-2", loadingCountries ? "animate-spin text-cyan-600" : "")} />
            {t(lang, "mgmt.refresh", "Refresh Data")}
          </Button>
          <Link href="/dashboard/settings/location">
            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-9 px-4 rounded-xl shadow-sm text-xs">
              <Globe className="h-4 w-4 mr-1.5" /> {t(lang, "mgmt.location_topology", "Location Topology")}
            </Button>
          </Link>
        </div>
      </div>

      {message && (
        <div className={cn(
          "px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-sm",
          message.startsWith("✅")
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
        )}>
          <span>{message}</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      )}

      <Tabs defaultValue="countries" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/60 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="countries" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Globe2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> {t(lang, "mgmt.tab_countries", "Live Countries")} ({countries.length})
          </TabsTrigger>
          <TabsTrigger value="company_reg" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /> {t(lang, "mgmt.tab_company_reg", "Company Registration")}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Handshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t(lang, "mgmt.tab_contracts", "Contract Types")}
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" /> {t(lang, "mgmt.tab_documents", "Document Parameters")}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LIVE COUNTRIES (real, API-backed) */}
        <TabsContent value="countries" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
            <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-4">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> {t(lang, "mgmt.add_country_node", "Add New Country Node")}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">{t(lang, "mgmt.add_country_desc", "Register a country in the live database for accounts and branches.")}</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAddCountry} className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">{t(lang, "mgmt.country_name", "Country Name")}</Label>
                    <Input value={newCountryName} onChange={(e) => setNewCountryName(e.target.value)} placeholder="Pakistan, United Arab Emirates, Afghanistan" className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">{t(lang, "mgmt.iso_code", "ISO Code (2-letter)")}</Label>
                      <Input value={newCountryIso2} onChange={(e) => setNewCountryIso2(e.target.value)} placeholder="PK, AE, AF" className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono uppercase rounded-xl text-xs" maxLength={2} />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">{t(lang, "mgmt.currency_code", "Currency Code")}</Label>
                      <Input value={newCountryCurrency} onChange={(e) => setNewCountryCurrency(e.target.value)} placeholder="PKR, AED, AFN, USD" className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono uppercase rounded-xl text-xs" required />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">{t(lang, "mgmt.official_email", "Official Email")}</Label>
                    <Input type="email" value={newCountryOfficialEmail} onChange={(e) => setNewCountryOfficialEmail(e.target.value)} placeholder="info@example.dgt.llc" className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">{t(lang, "mgmt.admin_email", "Admin Email")}</Label>
                    <Input type="email" value={newCountryAdminEmail} onChange={(e) => setNewCountryAdminEmail(e.target.value)} placeholder="admin@example.dgt.llc" className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs" />
                  </div>
                  <Button type="submit" disabled={addingCountry} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold h-11 rounded-xl shadow-md transition-all mt-2">
                    {addingCountry ? t(lang, "mgmt.adding_country", "Adding Country...") : t(lang, "mgmt.add_country_btn", "Add Country to Master Data")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> {t(lang, "mgmt.countries_master", "Active Countries Master Database")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {t(lang, "mgmt.countries_master_desc", "All registered nation nodes connected with branch networks and ledgers.")}
                  </CardDescription>
                </div>
                <div className="relative w-48 md:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t(lang, "mgmt.search_country_ph", "Search country or currency...")} className="w-full bg-background border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-foreground placeholder:text-muted-foreground" />
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-foreground">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
                    <tr>
                      <Th className="px-5 py-3.5">{t(lang, "mgmt.col_country", "Country Name")}</Th>
                      <Th className="px-5 py-3.5">{t(lang, "mgmt.col_iso", "ISO")}</Th>
                      <Th className="px-5 py-3.5">{t(lang, "mgmt.col_currency", "Currency")}</Th>
                      <Th className="px-5 py-3.5">{t(lang, "mgmt.official_email", "Official Email")}</Th>
                      <Th className="px-5 py-3.5">{t(lang, "mgmt.col_status", "Status")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {loadingCountries ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-medium">{t(lang, "mgmt.loading_countries", "Loading live countries from database...")}</td></tr>
                    ) : filteredCountries.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">{t(lang, "mgmt.no_country_match", "No country records match your search.")}</td></tr>
                    ) : (
                      filteredCountries.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-foreground flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />{c.name}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">{c.iso2 || "-"}</td>
                          <td className="px-5 py-3.5 font-mono font-bold text-foreground">{c.currency_code}</td>
                          <td className="px-5 py-3.5 text-muted-foreground font-mono">{c.official_email || c.admin_email || "-"}</td>
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              {t(lang, "mgmt.active_node", "Active Node")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TABS 2-4: link to the real, API-backed registries */}
        <TabsContent value="company_reg">
          <ManagedElsewhere
            icon={FileCheck2}
            tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            title={t(lang, "nav.company_registration_type", "Company Registration Types")}
            desc={t(lang, "mgmt.managed_elsewhere_desc", "This parameter set has its own dedicated module with full create, edit and delete support. Open it to manage these records.")}
            href={"/dashboard/settings/company-registration-type" as Route}
            openLabel={t(lang, "mgmt.open_module", "Open Module")}
          />
        </TabsContent>
        <TabsContent value="contracts">
          <ManagedElsewhere
            icon={Handshake}
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            title={t(lang, "mgmt.tab_contracts", "Contract Types")}
            desc={t(lang, "mgmt.managed_elsewhere_desc", "This parameter set has its own dedicated module with full create, edit and delete support. Open it to manage these records.")}
            href={"/dashboard/settings/contract-type" as Route}
            openLabel={t(lang, "mgmt.open_module", "Open Module")}
          />
        </TabsContent>
        <TabsContent value="documents">
          <ManagedElsewhere
            icon={FileText}
            tone="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            title={t(lang, "mgmt.tab_documents", "Document Parameters")}
            desc={t(lang, "mgmt.managed_elsewhere_desc", "This parameter set has its own dedicated module with full create, edit and delete support. Open it to manage these records.")}
            href={"/dashboard/settings/document-type" as Route}
            openLabel={t(lang, "mgmt.open_module", "Open Module")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
