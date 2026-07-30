"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  CheckCircle2, 
  ClipboardList, 
  FileCheck2, 
  FileText, 
  Filter, 
  Globe, 
  Globe2, 
  Handshake, 
  Layers, 
  Plus, 
  RefreshCcw, 
  Search, 
  ShieldCheck, 
  SlidersHorizontal, 
  Trash2, 
  Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

type GenericParameter = {
  id: string;
  title: string;
  category: "company_registration" | "contract" | "document" | "customer";
  code: string;
  description: string;
  status: "Active" | "Draft";
};

const initialRegistrationTypes: GenericParameter[] = [
  { id: "1", title: "National Tax Number (NTN)", code: "REG-NTN", category: "company_registration", description: "Tax identification requirement for commercial corporate entities.", status: "Active" },
  { id: "2", title: "Value Added Tax / GST", code: "REG-VAT", category: "company_registration", description: "Standard sales tax / VAT registration for trade and clearing.", status: "Active" },
  { id: "3", title: "Commercial Trade License", code: "REG-TRADE", category: "company_registration", description: "Municipal or economic department municipal trade permit.", status: "Active" },
  { id: "4", title: "Import / Export Clearance License", code: "REG-IMEX", category: "company_registration", description: "Customs authority import/export code and logistics permit.", status: "Active" },
  { id: "5", title: "Chamber of Commerce Certificate", code: "REG-COC", category: "company_registration", description: "Official chamber membership for cross-border trade operations.", status: "Active" }
];

const initialContractTypes: GenericParameter[] = [
  { id: "c1", title: "Purchase Order Supply SLA", code: "CNT-PURCHASE", category: "contract", description: "Long term supplier agreement for raw goods and container shipments.", status: "Active" },
  { id: "c2", title: "Sales Booking Agreement", code: "CNT-SALES", category: "contract", description: "Customer sales contract detailing payment terms, currency & delivery.", status: "Active" },
  { id: "c3", title: "Freight Forwarding Agreement", code: "CNT-FREIGHT", category: "contract", description: "Carrier shipping line freight forwarding contract.", status: "Active" },
  { id: "c4", title: "Customs Clearing Agent SLA", code: "CNT-CLEARING", category: "contract", description: "Port customs clearing and demurrage management contract.", status: "Active" }
];

const initialDocumentTypes: GenericParameter[] = [
  { id: "d1", title: "Bill of Lading (B/L) Record", code: "DOC-BL", category: "document", description: "Carrier shipping ocean bill of lading document.", status: "Active" },
  { id: "d2", title: "Commercial Invoice & Packing List", code: "DOC-INV", category: "document", description: "Supplier commercial invoice and itemized container packing list.", status: "Active" },
  { id: "d3", title: "Goods Declaration (GD) Customs Form", code: "DOC-GD", category: "document", description: "Official customs authority import/export entry declaration.", status: "Active" },
  { id: "d4", title: "National Passport / Identity Copy", code: "DOC-ID", category: "document", description: "Entity owner passport, CNIC or identity verification document.", status: "Active" }
];

export default function ManagementSettingsPage() {
  const [activeTab, setActiveTab] = useState("countries");
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");

  // New Country Form State
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryIso2, setNewCountryIso2] = useState("");
  const [newCountryCurrency, setNewCountryCurrency] = useState("USD");
  const [newCountryOfficialEmail, setNewCountryOfficialEmail] = useState("");
  const [newCountryAdminEmail, setNewCountryAdminEmail] = useState("");
  const [addingCountry, setAddingCountry] = useState(false);

  // Parameter State
  const [regTypes, setRegTypes] = useState<GenericParameter[]>(initialRegistrationTypes);
  const [contractTypes, setContractTypes] = useState<GenericParameter[]>(initialContractTypes);
  const [docTypes, setDocTypes] = useState<GenericParameter[]>(initialDocumentTypes);

  // New Parameter Form State
  const [newParamTitle, setNewParamTitle] = useState("");
  const [newParamCode, setNewParamCode] = useState("");
  const [newParamDesc, setNewParamDesc] = useState("");

  async function fetchCountries() {
    setLoadingCountries(true);
    try {
      const res = await fetch("/api/branch-management/countries");
      const json = await res.json();
      if (res.ok && json.countries) {
        setCountries(json.countries);
      }
    } catch (err: any) {
      console.error("Failed to load countries:", err);
    } finally {
      setLoadingCountries(false);
    }
  }

  useEffect(() => {
    fetchCountries();
  }, []);

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
      if (!res.ok) throw new Error(json.error?.message || json.error || "Failed to create country");

      setMessage(`✅ Country "${newCountryName}" added successfully to Management Master Database!`);
      setNewCountryName("");
      setNewCountryIso2("");
      setNewCountryOfficialEmail("");
      setNewCountryAdminEmail("");
      await fetchCountries();
    } catch (err: any) {
      setMessage("❌ " + (err.message || "Failed to add country"));
    } finally {
      setAddingCountry(false);
    }
  }

  function handleAddParameter(cat: "company_registration" | "contract" | "document") {
    if (!newParamTitle.trim()) return;
    const newItem: GenericParameter = {
      id: String(Date.now()),
      title: newParamTitle.trim(),
      code: newParamCode.trim().toUpperCase() || "PAR-" + Math.floor(Math.random() * 1000),
      description: newParamDesc.trim() || "Custom management parameter.",
      category: cat,
      status: "Active"
    };

    if (cat === "company_registration") setRegTypes([newItem, ...regTypes]);
    if (cat === "contract") setContractTypes([newItem, ...contractTypes]);
    if (cat === "document") setDocTypes([newItem, ...docTypes]);

    setNewParamTitle("");
    setNewParamCode("");
    setNewParamDesc("");
    setMessage(`✅ Added parameter "${newItem.title}" successfully!`);
  }

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.iso2 || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.currency_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 text-foreground p-4 lg:p-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              Settings & Master Data Management
            </p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Management Parameters & Live Data Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
            Live database registry for Nations, Cities, Company Registration Types, Contracts, and Document Parameters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={fetchCountries}
            disabled={loadingCountries}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3 rounded-xl shadow-sm"
          >
            <RefreshCcw className={cn("h-4 w-4 mr-2", loadingCountries ? "animate-spin text-cyan-600" : "")} />
            Refresh Data
          </Button>
          <Link href="/dashboard/settings/location">
            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-9 px-4 rounded-xl shadow-sm text-xs">
              <Globe className="h-4 w-4 mr-1.5" /> Location Topology
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

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="countries" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/60 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="countries" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Globe2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Live Countries ({countries.length})
          </TabsTrigger>
          <TabsTrigger value="company_reg" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Company Registration ({regTypes.length})
          </TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Handshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Contract Types ({contractTypes.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg text-xs font-bold px-4 py-2 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Document Parameters ({docTypes.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LIVE COUNTRIES & CITIES */}
        <TabsContent value="countries" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
            
            {/* Add Country Form Panel */}
            <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 px-5 py-4">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Add New Country Node
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Register country in live database for accounts & branches.</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAddCountry} className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Country Name</Label>
                    <Input
                      value={newCountryName}
                      onChange={(e) => setNewCountryName(e.target.value)}
                      placeholder="e.g. Pakistan, United Arab Emirates, Afghanistan"
                      className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">ISO Code (2-letter)</Label>
                      <Input
                        value={newCountryIso2}
                        onChange={(e) => setNewCountryIso2(e.target.value)}
                        placeholder="e.g. PK, AE, AF"
                        className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono uppercase rounded-xl text-xs"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Currency Code</Label>
                      <Input
                        value={newCountryCurrency}
                        onChange={(e) => setNewCountryCurrency(e.target.value)}
                        placeholder="e.g. PKR, AED, AFN, USD"
                        className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono uppercase rounded-xl text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">Official Email</Label>
                    <Input
                      type="email"
                      value={newCountryOfficialEmail}
                      onChange={(e) => setNewCountryOfficialEmail(e.target.value)}
                      placeholder="e.g. info@pakistan.dgt.llc"
                      className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">Admin Email</Label>
                    <Input
                      type="email"
                      value={newCountryAdminEmail}
                      onChange={(e) => setNewCountryAdminEmail(e.target.value)}
                      placeholder="e.g. admin@pakistan.dgt.llc"
                      className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={addingCountry}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold h-11 rounded-xl shadow-md transition-all mt-2"
                  >
                    {addingCountry ? "Adding Country..." : "Add Country to Master Data"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Live Country Directory Table */}
            <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Active Countries Master Database
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Showing all registered nation nodes connected with branch networks and ledgers.
                  </CardDescription>
                </div>

                <div className="relative w-48 md:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search country or currency..."
                    className="w-full bg-background border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-foreground">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
                    <tr>
                      <th className="px-5 py-3.5">Country Name</th>
                      <th className="px-5 py-3.5">ISO</th>
                      <th className="px-5 py-3.5">Currency</th>
                      <th className="px-5 py-3.5">Official Email</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {loadingCountries ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-medium">
                          Loading live countries from database...
                        </td>
                      </tr>
                    ) : filteredCountries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          No country records match search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredCountries.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-foreground flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {c.name}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {c.iso2 || "-"}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-foreground">
                            {c.currency_code}
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground font-mono">
                            {c.official_email || c.admin_email || "-"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Active Node
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

        {/* TAB 2: COMPANY REGISTRATION TYPES */}
        <TabsContent value="company_reg" className="space-y-6">
          <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Company Registration Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Parameters for legal tax registrations, NTN, GST, VAT, and trade licenses.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Add parameter input */}
              <div className="bg-muted/20 p-4 rounded-xl border border-border/60 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  value={newParamTitle}
                  onChange={(e) => setNewParamTitle(e.target.value)}
                  placeholder="Registration Type Title (e.g. STRN)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Input
                  value={newParamCode}
                  onChange={(e) => setNewParamCode(e.target.value)}
                  placeholder="Parameter Code (e.g. REG-STRN)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80 font-mono"
                />
                <Input
                  value={newParamDesc}
                  onChange={(e) => setNewParamDesc(e.target.value)}
                  placeholder="Description notes..."
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Button
                  onClick={() => handleAddParameter("company_registration")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 rounded-lg text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Registration Type
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {regTypes.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">{item.code}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{item.status}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CONTRACT TYPES */}
        <TabsContent value="contracts" className="space-y-6">
          <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Handshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Contract & Service Agreement Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Master parameters for vendor SLAs, sales agreements, and freight forwarding contracts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Add parameter input */}
              <div className="bg-muted/20 p-4 rounded-xl border border-border/60 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  value={newParamTitle}
                  onChange={(e) => setNewParamTitle(e.target.value)}
                  placeholder="Contract Type Title (e.g. Annual Service SLA)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Input
                  value={newParamCode}
                  onChange={(e) => setNewParamCode(e.target.value)}
                  placeholder="Code (e.g. CNT-ANNUAL)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80 font-mono"
                />
                <Input
                  value={newParamDesc}
                  onChange={(e) => setNewParamDesc(e.target.value)}
                  placeholder="Description..."
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Button
                  onClick={() => handleAddParameter("contract")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 rounded-lg text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Contract Type
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {contractTypes.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">{item.code}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{item.status}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DOCUMENT TYPES */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Document & Attachment Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Parameters for Bill of Lading, Invoices, GD forms, Passports & CNIC attachments.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Add parameter input */}
              <div className="bg-muted/20 p-4 rounded-xl border border-border/60 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  value={newParamTitle}
                  onChange={(e) => setNewParamTitle(e.target.value)}
                  placeholder="Document Title (e.g. Certificate of Origin)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Input
                  value={newParamCode}
                  onChange={(e) => setNewParamCode(e.target.value)}
                  placeholder="Code (e.g. DOC-COO)"
                  className="bg-background text-xs h-9 rounded-lg border-border/80 font-mono"
                />
                <Input
                  value={newParamDesc}
                  onChange={(e) => setNewParamDesc(e.target.value)}
                  placeholder="Description..."
                  className="bg-background text-xs h-9 rounded-lg border-border/80"
                />
                <Button
                  onClick={() => handleAddParameter("document")}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-9 rounded-lg text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Document Type
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {docTypes.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">{item.code}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{item.status}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
