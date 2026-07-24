"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { printStore } from "@/lib/store/print-store";
import type { Route } from "next";
import { Building2, Plus, Search, Eye, PencilLine, Printer, Trash2, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyIncorporationData } from "./company-incorporation-form";

const initialCompanies: (CompanyIncorporationData & { id: string })[] = [
  {
    id: "co-1",
    ownerName: "John Doe",
    companyName: "Apex Trading LLC",
    businessName: "Apex Imports",
    country: "United States",
    state: "New York",
    city: "New York",
    zipCode: "10001",
    address: "5th Avenue, Manhattan, NY",
    contacts: [
      { id: "c-1", type: "Mobile Number", value: "+1-555-0199" },
      { id: "c-2", type: "Email Address", value: "info@apextrading.com" }
    ],
    registrations: [
      { id: "r-1", type: "GST No", value: "REG-9988221" }
    ],
    ownerIds: [
      { id: "o-1", type: "Passport No", value: "US9876543" }
    ]
  },
  {
    id: "co-2",
    ownerName: "Muhammad Ali",
    companyName: "Al-Noor Logistics",
    businessName: "Al-Noor Cargo",
    country: "Pakistan",
    state: "Punjab",
    city: "Lahore",
    zipCode: "54000",
    address: "Gulberg III, Lahore, Pakistan",
    contacts: [
      { id: "c-3", type: "Mobile Number", value: "+92-300-1234567" },
      { id: "c-4", type: "Email Address", value: "contact@alnoor.pk" }
    ],
    registrations: [
      { id: "r-2", type: "NTN No", value: "NTN-882233-1" }
    ],
    ownerIds: [
      { id: "o-2", type: "CNIC No", value: "35201-1234567-1" }
    ]
  }
];

export function CompanyRegistry() {
  const router = useRouter();
  const [savedCompanies, setSavedCompanies] = useState<(CompanyIncorporationData & { id: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingCompany, setViewingCompany] = useState<(CompanyIncorporationData & { id: string }) | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleOutsideClick() {
      setOpenMenuId(null);
    }
    if (openMenuId !== null) {
      window.addEventListener("click", handleOutsideClick);
      return () => {
        window.removeEventListener("click", handleOutsideClick);
      };
    }
  }, [openMenuId]);

  // Initialize from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem("incorporated_companies");
    if (stored) {
      try {
        setSavedCompanies(JSON.parse(stored));
      } catch {
        setSavedCompanies(initialCompanies);
      }
    } else {
      setSavedCompanies(initialCompanies);
      localStorage.setItem("incorporated_companies", JSON.stringify(initialCompanies));
    }
  }, []);

  const stats = useMemo(() => {
    const total = savedCompanies.length;
    const totalContacts = savedCompanies.reduce((acc, c) => acc + c.contacts.length, 0);
    const totalRegs = savedCompanies.reduce((acc, c) => acc + c.registrations.length, 0);
    return { total, totalContacts, totalRegs };
  }, [savedCompanies]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedCompanies;
    return savedCompanies.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.businessName.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [searchQuery, savedCompanies]);

  function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this company?")) return;
    const updated = savedCompanies.filter((c) => c.id !== id);
    setSavedCompanies(updated);
    localStorage.setItem("incorporated_companies", JSON.stringify(updated));
    if (viewingCompany?.id === id) {
      setViewingCompany(null);
    }
  }

  function handlePrint(c: CompanyIncorporationData & { id: string }) {
    const contactsHTML = c.contacts.length > 0
      ? `<ul>` + c.contacts.map((x) => `<li><strong>${x.type}</strong><span>${x.value}</span></li>`).join("") + `</ul>`
      : `<div style="font-size: 11px; font-style: italic; color: #94a3b8; text-align: center; margin-top: 10px;">No registered contact methods</div>`;

    const regsHTML = c.registrations.length > 0
      ? `<ul>` + c.registrations.map((x) => `<li><strong>${x.type}</strong><span>${x.value}</span></li>`).join("") + `</ul>`
      : `<div style="font-size: 11px; font-style: italic; color: #94a3b8; text-align: center; margin-top: 10px;">No registered tax credentials</div>`;

    const idsHTML = c.ownerIds.length > 0
      ? `<ul>` + c.ownerIds.map((x) => `<li><strong>${x.type}</strong><span>${x.value}</span></li>`).join("") + `</ul>`
      : `<div style="font-size: 11px; font-style: italic; color: #94a3b8; text-align: center; margin-top: 10px;">No verified owner identifiers</div>`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate of Incorporation - ${c.companyName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
            
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
              padding: 40px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .certificate-container {
              border: 4px double #1e3a8a;
              padding: 30px;
              position: relative;
              background-color: #fafaf9;
              min-height: calc(100vh - 80px);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            
            .certificate-inner-border {
              border: 1px solid #94a3b8;
              padding: 24px;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: 80px;
              font-weight: 800;
              color: rgba(226, 232, 240, 0.35);
              text-transform: uppercase;
              pointer-events: none;
              letter-spacing: 0.1em;
              white-space: nowrap;
              font-family: 'Cinzel', serif;
            }
            
            .header {
              text-align: center;
              margin-bottom: 25px;
            }
            
            .crest {
              display: inline-block;
              margin-bottom: 12px;
            }
            
            .org-title {
              font-family: 'Cinzel', serif;
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              margin: 0 0 8px 0;
            }
            
            .cert-title {
              font-family: 'Cinzel', serif;
              font-size: 26px;
              font-weight: 700;
              color: #1e3a8a;
              margin: 0;
              letter-spacing: 0.05em;
              line-height: 1.2;
            }
            
            .cert-subtitle {
              font-size: 11px;
              color: #475569;
              font-weight: 600;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              margin-top: 6px;
            }
            
            .statement {
              text-align: center;
              margin: 25px auto;
              max-width: 650px;
              font-size: 13.5px;
              color: #334155;
              line-height: 1.8;
            }
            
            .statement strong {
              color: #0f172a;
              font-weight: 700;
            }
            
            .company-highlight {
              font-family: 'Cinzel', serif;
              font-size: 22px;
              color: #0f172a;
              display: block;
              margin: 10px 0;
              font-weight: 700;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 8px;
            }
            
            .grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 20px;
              margin-top: 15px;
            }
            
            .card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }
            
            .card-title {
              font-size: 11px;
              font-weight: 700;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin-top: 0;
              margin-bottom: 10px;
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            .field {
              margin-bottom: 8px;
            }
            
            .field:last-child {
              margin-bottom: 0;
            }
            
            .label {
              font-size: 9px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.05em;
            }
            
            .value {
              font-size: 12px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 1px;
            }
            
            ul {
              list-style-type: none;
              padding: 0;
              margin: 0;
            }
            
            li {
              font-size: 11.5px;
              margin-bottom: 6px;
              display: flex;
              justify-content: space-between;
              border-bottom: 1px dashed #f1f5f9;
              padding-bottom: 4px;
            }
            
            li:last-child {
              margin-bottom: 0;
              border-bottom: none;
              padding-bottom: 0;
            }
            
            li strong {
              color: #475569;
              font-weight: 500;
            }
            
            li span {
              font-weight: 600;
              color: #0f172a;
              font-family: monospace;
            }
            
            .footer-controls {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 35px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
            }
            
            .seal-box {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            
            .seal {
              width: 70px;
              height: 70px;
              border: 2px solid #b45309;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              font-size: 7px;
              font-weight: 800;
              color: #b45309;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              position: relative;
              background-color: rgba(251, 191, 36, 0.05);
            }
            
            .seal-inner {
              width: 60px;
              height: 60px;
              border: 1px dashed #b45309;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 4px;
            }
            
            .seal-text {
              transform: rotate(-5deg);
            }
            
            .meta-info {
              font-size: 9px;
              color: #64748b;
              line-height: 1.4;
            }
            
            .signature-box {
              text-align: center;
              width: 150px;
            }
            
            .signature-line {
              border-bottom: 1.5px solid #0f172a;
              height: 25px;
              margin-bottom: 6px;
            }
            
            .signature-title {
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
            }
            
            @media print {
              body {
                padding: 0;
                background-color: transparent;
              }
              .certificate-container {
                min-height: 100vh;
                border-color: #1e3a8a !important;
              }
              @page {
                size: A4 portrait;
                margin: 12mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="certificate-inner-border">
              <div class="watermark">DAMAAN ERP</div>
              
              <div>
                <div class="header">
                  <div class="crest">
                    <svg viewBox="0 0 24 24" width="48" height="48" style="color: #1e3a8a; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin="round;">
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                      <line x1="9" y1="22" x2="9" y2="16"></line>
                      <line x1="15" y1="22" x2="15" y2="16"></line>
                      <line x1="9" y1="16" x2="15" y2="16"></line>
                      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M12 6h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"></path>
                    </svg>
                  </div>
                  <h2 class="org-title">Damaan Business Group ERP</h2>
                  <h1 class="cert-title">Certificate of Incorporation</h1>
                  <div class="cert-subtitle">Official Corporate Registry Record</div>
                </div>
                
                <div class="statement">
                  This document serves as formal confirmation that the business entity listed below is registered and active in the central management system. All details below correspond to the certified registry entries filed under official ownership.
                  <span class="company-highlight">${c.companyName}</span>
                  <strong>Jurisdiction:</strong> ${[c.city, c.state, c.country].filter(Boolean).join(", ") || "N/A"}
                </div>
                
                <div class="grid">
                  <div class="card">
                    <h3 class="card-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                      Entity Details
                    </h3>
                    <div class="field">
                      <div class="label">Legal Name</div>
                      <div class="value">${c.companyName}</div>
                    </div>
                    <div class="field">
                      <div class="label">Trade / Business Name</div>
                      <div class="value">${c.businessName || "-"}</div>
                    </div>
                    <div class="field">
                      <div class="label">Primary Owner / Director</div>
                      <div class="value">${c.ownerName}</div>
                    </div>
                  </div>
                  
                  <div class="card">
                    <h3 class="card-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      Registered Address
                    </h3>
                    <div class="field">
                      <div class="label">Physical Address</div>
                      <div class="value" style="font-size: 11px; font-weight: 500;">${c.address || "-"}</div>
                    </div>
                    <div class="field">
                      <div class="label">Postal / Zip Code</div>
                      <div class="value" style="font-family: monospace;">${c.zipCode || "-"}</div>
                    </div>
                    <div class="field">
                      <div class="label">Jurisdiction Region</div>
                      <div class="value">${[c.city, c.state, c.country].filter(Boolean).join(", ") || "-"}</div>
                    </div>
                  </div>
                  
                  <div class="card">
                    <h3 class="card-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      Contact Directory
                    </h3>
                    ${contactsHTML}
                  </div>
                  
                  <div class="card">
                    <h3 class="card-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Registrations & Tax
                    </h3>
                    ${regsHTML}
                  </div>
                </div>

                <div class="card" style="margin-top: 20px;">
                  <h3 class="card-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Owner Identification & Verification
                  </h3>
                  ${idsHTML}
                </div>
              </div>
              
              <div class="footer-controls">
                <div class="seal-box">
                  <div class="seal">
                    <div class="seal-inner">
                      <span class="seal-text">DAMAAN<br>OFFICIAL<br>SEAL</span>
                    </div>
                  </div>
                  <div class="meta-info">
                    <strong>Document ID:</strong> REG-${c.id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}<br>
                    <strong>Generated On:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Status:</strong> Active & Incorporated
                  </div>
                </div>
                
                <div class="signature-box">
                  <div class="signature-line"></div>
                  <div class="signature-title">Authorized Officer</div>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printStore.openPrint(html, `Certificate of Incorporation - ${c.companyName}`);
  }

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Company</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Company Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage incorporated business entities, registration numbers, contact directories, and owners.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push("/dashboard/settings/company-setup" as Route)}
          className="gap-2 self-start md:self-auto bg-primary text-white hover:bg-primary-dark font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Incorporate New Company
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Incorporated Companies</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contact Records</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{stats.totalContacts}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <Plus className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tax Registrations</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">{stats.totalRegs}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Printer className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="rounded-xl border shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">Incorporated Companies Registry</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Use the search box to find specific companies, and use actions to preview, edit, print or delete.</p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company registry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-white text-slate-900 border-slate-200 focus:border-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2">Company / Business</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2 text-center">Contacts</th>
                  <th className="px-4 py-2 text-center">Registrations</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCompanies.length > 0 ? (
                  filteredCompanies.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setViewingCompany(c)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        <div>{c.companyName}</div>
                        {c.businessName && <div className="text-[10px] text-muted-foreground mt-0.5 font-normal">{c.businessName}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 font-medium">{c.ownerName}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {[c.city, c.state, c.country].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-700">{c.contacts.length}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-slate-700">{c.registrations.length}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === c.id ? null : c.id);
                            }}
                            className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          {openMenuId === c.id && (
                            <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-100 bg-white shadow-xl z-20 py-1.5 animate-in fade-in-50 slide-in-from-top-2 duration-100 origin-top-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setViewingCompany(c);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                <span>View Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  router.push(`/dashboard/settings/company-setup?companyId=${c.id}` as Route);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <PencilLine className="h-3.5 w-3.5 text-blue-500" />
                                <span>Edit Profile</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handlePrint(c);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                              >
                                <Printer className="h-3.5 w-3.5 text-amber-500" />
                                <span>Print Certificate</span>
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleDelete(c.id);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                <span>Delete Company</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground italic">
                      No companies found matching search criteria. Click &quot;+ Incorporate New Company&quot; to register one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details View Modal */}
      {viewingCompany ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-2xl rounded-xl border bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-155">
            <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">
                    {viewingCompany.companyName}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Incorporation Profile Details</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setViewingCompany(null)}
                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Entity Details</h3>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2 text-xs border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Company Name:</span>
                      <span className="font-semibold text-slate-900">{viewingCompany.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Business Name:</span>
                      <span className="font-semibold text-slate-900">{viewingCompany.businessName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Owner Name:</span>
                      <span className="font-semibold text-slate-900">{viewingCompany.ownerName}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Location Details</h3>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2 text-xs border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Location:</span>
                      <span className="font-semibold text-slate-900">
                        {[viewingCompany.city, viewingCompany.state, viewingCompany.country].filter(Boolean).join(", ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Zip Code:</span>
                      <span className="font-semibold font-mono text-slate-900">{viewingCompany.zipCode || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Full Address:</span>
                      <span className="font-semibold text-slate-900 text-right max-w-[180px] truncate" title={viewingCompany.address}>{viewingCompany.address || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contacts List</h3>
                {viewingCompany.contacts.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {viewingCompany.contacts.map((x) => (
                      <div key={x.id} className="flex justify-between text-xs bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100">
                        <span className="text-slate-500 font-medium">{x.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{x.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">No contacts listed.</p>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Registrations</h3>
                {viewingCompany.registrations.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {viewingCompany.registrations.map((x) => (
                      <div key={x.id} className="flex justify-between text-xs bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100">
                        <span className="text-slate-500 font-medium">{x.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{x.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">No registrations listed.</p>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Owner Identification</h3>
                {viewingCompany.ownerIds.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {viewingCompany.ownerIds.map((x) => (
                      <div key={x.id} className="flex justify-between text-xs bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100">
                        <span className="text-slate-500 font-medium">{x.type}:</span>
                        <span className="font-semibold text-slate-800 font-mono">{x.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-1">No identifications listed.</p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePrint(viewingCompany)}
                  className="gap-2 h-9 text-xs border-slate-200"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-600" />
                  Print Details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setViewingCompany(null);
                    router.push(`/dashboard/settings/company-setup?companyId=${viewingCompany.id}` as Route);
                  }}
                  className="gap-2 h-9 text-xs border-slate-200"
                >
                  <PencilLine className="h-3.5 w-3.5 text-blue-600" />
                  Edit Profile
                </Button>
                <Button
                  type="button"
                  onClick={() => setViewingCompany(null)}
                  className="h-9 text-xs font-medium bg-slate-850 hover:bg-slate-900 text-white"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
