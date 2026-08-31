import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";
import { printStore } from "@/lib/store/print-store";

export type Company360ReportData = {
  company: {
    id?: string;
    accountNo?: string;
    name: string;
    legalName?: string | null;
    nameUrdu?: string | null;
    businessType?: string | null;
    natureOfBusiness?: string | null;
    registrationType?: string | null;
    licenseNumber?: string | null;
    baseCurrency?: string;
    countryName?: string | null;
    stateName?: string | null;
    cityName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    branchRules?: string | null;
    isBranchOperative?: boolean;
    mainBranchName?: string | null;
    cityBranchName?: string | null;
    superAdminSerial?: string | null;
    countrySerial?: string | null;
    branchSerial?: string | null;
    entrySerial?: string | null;
    companyCode?: string | null;
  };
  owner?: {
    id?: string;
    name: string;
    fatherName?: string | null;
    customerCode?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    email?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  manager?: {
    id?: string;
    name: string;
    fatherName?: string | null;
    customerCode?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    email?: string | null;
    country?: string | null;
    city?: string | null;
  } | null;
  sisterCompanies?: Array<{
    id?: string;
    name: string;
    businessType?: string | null;
    countryName?: string | null;
    cityName?: string | null;
    status?: string | null;
    licenseNumber?: string | null;
  }>;
  banks?: Array<{
    bankName: string;
    accountTitle?: string | null;
    accountNumber?: string | null;
    currency?: string | null;
    branchCode?: string | null;
  }>;
  lang?: string;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openCompany360Report(data: Company360ReportData) {
  if (typeof window === "undefined") return;

  const lang = (data.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const comp = data.company;
  const owner = data.owner;
  const manager = data.manager;
  const sisterComps = data.sisterCompanies || [];
  const banks = data.banks || [];

  const compNameEn = comp.name || "—";
  const compNameUrdu = comp.nameUrdu || transliterateProperNoun(compNameEn, "ur");
  const ownerName = owner?.name || "—";
  const ownerUrdu = transliterateProperNoun(ownerName, lang);
  const ownerFather = owner?.fatherName ? transliterateProperNoun(owner?.fatherName, lang) : "—";
  const managerName = manager?.name ? transliterateProperNoun(manager?.name, lang) : null;
  const managerFather = manager?.fatherName ? transliterateProperNoun(manager?.fatherName, lang) : "—";

  const sisterRows = sisterComps.length > 0
    ? sisterComps.map((s, idx) => `
      <tr>
        <td style="text-align:center; font-weight:bold; color:#64748b;">${idx + 1}</td>
        <td style="font-weight:bold; color:#0f172a;">${escapeHtml(localizeTerm(s.name, lang))}</td>
        <td style="font-family:monospace; font-size:10px;">${escapeHtml(s.businessType || "LLC")}</td>
        <td>${escapeHtml([s.cityName || "Dubai", s.countryName || "UAE"].filter(Boolean).join(" / "))}</td>
        <td style="text-align:center;"><span class="badge badge-success">${escapeHtml(s.status || "Active")}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:12px;">No sister companies registered yet.</td></tr>`;

  const bankRows = banks.length > 0
    ? banks.map((b, idx) => `
      <tr>
        <td style="text-align:center; font-weight:bold; color:#64748b;">${idx + 1}</td>
        <td style="font-weight:bold; color:#0f172a;">${escapeHtml(b.bankName)}</td>
        <td style="font-weight:600;">${escapeHtml(b.accountTitle || compNameEn)}</td>
        <td style="font-family:monospace; font-weight:bold; color:#2563eb;">${escapeHtml(b.accountNumber || "—")}</td>
        <td style="font-weight:bold;">${escapeHtml(b.currency || comp.baseCurrency || "USD")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:12px;">Corporate Master Bank (Default Operational Clearing)</td></tr>`;

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>360° Corporate Dossier - ${escapeHtml(compNameEn)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
      @page { size: A4 portrait; margin: 10mm; }
      html, body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
      body { font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
      html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
      .container { max-width: 210mm; margin: 20px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); padding: 16mm; box-sizing: border-box; }
      
      /* Top Bar */
      .top-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; }
      .brand-logo { display: flex; align-items: center; gap: 10px; }
      .logo-sq { width: 42px; height: 42px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 900; }
      .brand-title { font-size: 16px; font-weight: 900; color: #0f172a; }
      .brand-subtitle { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      .report-badge { text-align: right; font-size: 10px; font-weight: 700; color: #334155; line-height: 1.4; }
      .report-badge-pill { display: inline-block; background: #1e3a8a; color: #fff; padding: 3px 10px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 3px; }

      /* Dark Banner */
      .banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px; }
      .banner-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 10px; }
      .banner-title { font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.2px; }
      .banner-urdu { font-size: 14px; font-weight: 800; color: #93c5fd; margin-top: 2px; }
      .banner-status { background: #10b981; color: #fff; font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; }
      .banner-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
      .banner-item-label { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .banner-item-val { font-size: 12px; font-weight: 800; color: #f8fafc; margin-top: 2px; font-family: 'Inter', monospace; }

      /* Section Styling */
      .section-card { border: 1.5px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
      .section-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 7px 12px; font-size: 10px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.4px; display: flex; align-items: center; gap: 8px; }
      .section-num { background: #1e3a8a; color: #fff; width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 900; }
      
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
      .info-table { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
      .info-table td { padding: 5px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
      .info-table td.value { color: #0f172a; font-weight: 700; text-align: right; }
      html[dir="rtl"] .info-table td.value { text-align: left; }

      /* Data Tables */
      .data-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
      .data-table th { background: #f1f5f9; padding: 6px 9px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 8.5px; text-align: left; border-bottom: 1.5px solid #cbd5e1; }
      html[dir="rtl"] .data-table th { text-align: right; }
      .data-table td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; }
      .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8.5px; font-weight: 800; }
      .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .badge-primary { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }

      /* Signatures & Footer */
      .footer-sigs { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 14px; border-top: 1.5px dashed #cbd5e1; }
      .sig-box { width: 28%; text-align: center; font-size: 8.5px; font-weight: 700; color: #475569; }
      .sig-line { border-bottom: 1px solid #94a3b8; height: 32px; margin-bottom: 4px; }
      .seal-box { width: 34%; border: 2px dashed #94a3b8; border-radius: 8px; padding: 8px; text-align: center; font-size: 8px; font-weight: 800; color: #64748b; background: #f8fafc; }

      .audit-footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 7.5px; color: #94a3b8; font-weight: 700; display: flex; justify-content: space-between; }

      @media print {
        body { background: #fff; }
        .container { max-width: 100%; margin: 0; padding: 0; border: none; box-shadow: none; }
        .no-print { display: none !important; }
      }
    </style>
  </head>
  <body>
    <!-- Print Action Floating Bar -->
    <div class="no-print" style="position:fixed; top:12px; right:12px; z-index:999; display:flex; gap:8px;">
      <button onclick="window.print()" style="background:#2563eb; color:#fff; font-weight:bold; font-size:12px; padding:8px 16px; border:none; border-radius:8px; cursor:pointer; box-shadow:0 4px 12px rgba(37,99,235,0.3);">
        🖨️ ${tt("common.print", "Print / Save PDF")}
      </button>
      <button onclick="window.close()" style="background:#e2e8f0; color:#1e293b; font-weight:bold; font-size:12px; padding:8px 14px; border:none; border-radius:8px; cursor:pointer;">
        ✖ ${tt("common.close", "Close")}
      </button>
    </div>

    <div class="container">
      
      <!-- Top Header -->
      <div class="top-header">
        <div class="brand-logo">
          <div class="logo-sq">🏛️</div>
          <div>
            <div class="brand-title">${escapeHtml(comp.legalName || compNameEn)}</div>
            <div class="brand-subtitle">Corporate Registry &amp; 360° Comprehensive Stakeholder Dossier</div>
          </div>
        </div>
        <div class="report-badge">
          <div class="report-badge-pill">OFFICIAL 360° DOSSIER</div>
          <div><strong>Date:</strong> ${stampDate} ${stampTime}</div>
          <div><strong>Account No:</strong> <span style="font-family:monospace; font-weight:900; color:#1e3a8a;">${escapeHtml(comp.accountNo || "—")}</span></div>
        </div>
      </div>

      <!-- Dark Executive Overview Banner -->
      <div class="banner">
        <div class="banner-top">
          <div>
            <div class="banner-title">${escapeHtml(compNameEn)}</div>
            <div class="banner-urdu">${escapeHtml(compNameUrdu)}</div>
          </div>
          <div class="banner-status">OFFICIALLY REGISTERED • ACTIVE</div>
        </div>
        <div class="banner-grid">
          <div>
            <div class="banner-item-label">Legal Structure</div>
            <div class="banner-item-val">${escapeHtml(comp.businessType || "LLC")}</div>
          </div>
          <div>
            <div class="banner-item-label">Base Currency</div>
            <div class="banner-item-val">${escapeHtml(comp.baseCurrency || "USD")}</div>
          </div>
          <div>
            <div class="banner-item-label">Operational Mode</div>
            <div class="banner-item-val">${comp.isBranchOperative ? "Branch Operative" : "Owner Sister Entity"}</div>
          </div>
          <div>
            <div class="banner-item-label">Company Code / Serial</div>
            <div class="banner-item-val">${escapeHtml(comp.companyCode || comp.entrySerial || "CMP-0010")}</div>
          </div>
        </div>
      </div>

      <!-- Section 1 & Section 2: Owner & Manager Complete Details (A to Z) -->
      <div class="grid-2">
        <!-- Section 1: Complete Primary Owner Dossier -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-num">1</span>
            <span>Primary Owner / Stakeholder Profile (A-Z)</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">Full Legal Name:</td>
              <td class="value">${escapeHtml(ownerName)}</td>
            </tr>
            <tr>
              <td class="label">Localized Name:</td>
              <td class="value">${escapeHtml(ownerUrdu)}</td>
            </tr>
            <tr>
              <td class="label">Father's Name (S/O):</td>
              <td class="value">${escapeHtml(ownerFather)}</td>
            </tr>
            <tr>
              <td class="label">Customer Master Code:</td>
              <td class="value" style="font-family:monospace; color:#2563eb;">${escapeHtml(owner?.customerCode || "CUST-MASTER")}</td>
            </tr>
            <tr>
              <td class="label">Employee Link Code:</td>
              <td class="value" style="font-family:monospace;">${escapeHtml(owner?.employeeCode || "EMP-0010")}</td>
            </tr>
            <tr>
              <td class="label">Primary Mobile / WhatsApp:</td>
              <td class="value" style="font-family:monospace; color:#166534;" dir="ltr">${escapeHtml(owner?.phone || comp.phone || "—")}</td>
            </tr>
            <tr>
              <td class="label">Official Email:</td>
              <td class="value" style="font-family:monospace;" dir="ltr">${escapeHtml(owner?.email || comp.email || "—")}</td>
            </tr>
            <tr>
              <td class="label">Location / Domicile:</td>
              <td class="value">${escapeHtml([owner?.city || comp.cityName || "Dubai", owner?.country || comp.countryName || "UAE"].filter(Boolean).join(" / "))}</td>
            </tr>
          </table>
        </div>

        <!-- Section 2: Complete Company Manager Dossier -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-num">2</span>
            <span>Authorized Company Manager Details (A-Z)</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">Manager Legal Name:</td>
              <td class="value">${escapeHtml(managerName || ownerName)}</td>
            </tr>
            <tr>
              <td class="label">Father's Name (S/O):</td>
              <td class="value">${escapeHtml(managerFather || ownerFather)}</td>
            </tr>
            <tr>
              <td class="label">Manager Serial Code:</td>
              <td class="value" style="font-family:monospace; color:#2563eb;">${escapeHtml(manager?.customerCode || manager?.employeeCode || "MGR-001")}</td>
            </tr>
            <tr>
              <td class="label">Manager Contact Phone:</td>
              <td class="value" style="font-family:monospace;" dir="ltr">${escapeHtml(manager?.phone || owner?.phone || comp.phone || "—")}</td>
            </tr>
            <tr>
              <td class="label">Manager Email:</td>
              <td class="value" style="font-family:monospace;" dir="ltr">${escapeHtml(manager?.email || owner?.email || comp.email || "—")}</td>
            </tr>
            <tr>
              <td class="label">Management Role:</td>
              <td class="value">Executive Director / Managing Partner</td>
            </tr>
            <tr>
              <td class="label">Branch Representation:</td>
              <td class="value">${escapeHtml(comp.mainBranchName || "Main HQ")}</td>
            </tr>
            <tr>
              <td class="label">Signing Authority:</td>
              <td class="value" style="color:#166534;">Fully Authorized (Level-1)</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 3 & Section 4: Company Incorporation & Regulatory Licenses -->
      <div class="grid-2">
        <!-- Section 3: Incorporation & Corporate Profile -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-num">3</span>
            <span>Corporate Identity &amp; Incorporation Details</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">Official Company Name:</td>
              <td class="value">${escapeHtml(compNameEn)}</td>
            </tr>
            <tr>
              <td class="label">Legal Registered Name:</td>
              <td class="value">${escapeHtml(comp.legalName || compNameEn)}</td>
            </tr>
            <tr>
              <td class="label">Legal Corporate Structure:</td>
              <td class="value">${escapeHtml(comp.businessType || "LLC (Limited Liability Company)")}</td>
            </tr>
            <tr>
              <td class="label">Nature of Business:</td>
              <td class="value">${escapeHtml(comp.natureOfBusiness || "Trading & General Order Supplier")}</td>
            </tr>
            <tr>
              <td class="label">Accounting Base Currency:</td>
              <td class="value" style="font-weight:900; color:#1e3a8a;">${escapeHtml(comp.baseCurrency || "USD")}</td>
            </tr>
            <tr>
              <td class="label">Branch Network Scope:</td>
              <td class="value">${escapeHtml(comp.branchRules || "Multi Branch Allowed")}</td>
            </tr>
          </table>
        </div>

        <!-- Section 4: Regulatory Licenses & 4-Level Serials -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-num">4</span>
            <span>Regulatory Licenses &amp; 4-Level Serials</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">Registration Document Type:</td>
              <td class="value">${escapeHtml(comp.registrationType || "Trade License")}</td>
            </tr>
            <tr>
              <td class="label">License / Document Number:</td>
              <td class="value" style="font-family:monospace; font-weight:800;">${escapeHtml(comp.licenseNumber || "TL-889922-DXB")}</td>
            </tr>
            <tr>
              <td class="label">Super Admin Master Serial:</td>
              <td class="value" style="font-family:monospace;">${escapeHtml(comp.superAdminSerial || "SA-CMP-001")}</td>
            </tr>
            <tr>
              <td class="label">Country Master Serial:</td>
              <td class="value" style="font-family:monospace;">${escapeHtml(comp.countrySerial || "CT-UAE-001")}</td>
            </tr>
            <tr>
              <td class="label">Branch Level Serial:</td>
              <td class="value" style="font-family:monospace;">${escapeHtml(comp.branchSerial || "BR-DXB-001")}</td>
            </tr>
            <tr>
              <td class="label">Entry Sequence Code:</td>
              <td class="value" style="font-family:monospace; color:#2563eb;">${escapeHtml(comp.entrySerial || comp.companyCode || "CMP-001")}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 5: Geographic Location & Branch Affiliation -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-num">5</span>
          <span>Geographic Operations &amp; Registered Address</span>
        </div>
        <table class="info-table">
          <tr>
            <td class="label" style="width:25%;">Operating Country:</td>
            <td class="value" style="text-align:left; width:25%; font-weight:bold;">${escapeHtml(comp.countryName || "United Arab Emirates")}</td>
            <td class="label" style="width:25%;">Main HQ Branch:</td>
            <td class="value" style="text-align:left; width:25%; font-weight:bold;">${escapeHtml(comp.mainBranchName || "Main Headquarters")}</td>
          </tr>
          <tr>
            <td class="label">City / Territory:</td>
            <td class="value" style="text-align:left;">${escapeHtml(comp.cityName || "Dubai")}</td>
            <td class="label">City Branch Unit:</td>
            <td class="value" style="text-align:left;">${escapeHtml(comp.cityBranchName || "Deira Hub")}</td>
          </tr>
          <tr>
            <td class="label">Registered Physical Address:</td>
            <td class="value" colspan="3" style="text-align:left;">${escapeHtml(comp.address || "Shop / Office 14, Al Ras, Deira, Dubai, UAE")}</td>
          </tr>
        </table>
      </div>

      <!-- Section 6: Sister Companies Portfolio Under This Owner -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-num">6</span>
          <span>Sister Companies Portfolio Under This Owner (${sisterComps.length})</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th>Sister Company Name</th>
              <th>Legal Structure</th>
              <th>Registered Location</th>
              <th style="width:70px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${sisterRows}
          </tbody>
        </table>
      </div>

      <!-- Section 7: Linked Banking Channels -->
      <div class="section-card">
        <div class="section-header">
          <span class="section-num">7</span>
          <span>Linked Banking Channels &amp; Financial Settlement Accounts</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th>Bank Name</th>
              <th>Account Title</th>
              <th>IBAN / Account Number</th>
              <th style="width:60px;">Currency</th>
            </tr>
          </thead>
          <tbody>
            ${bankRows}
          </tbody>
        </table>
      </div>

      <!-- Signatures and Verification Seal -->
      <div class="footer-sigs">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div>PRIMARY OWNER / STAKEHOLDER</div>
          <div style="font-size:7.5px; color:#94a3b8;">${escapeHtml(ownerName)}</div>
        </div>

        <div class="seal-box">
          <div style="font-size:10px; font-weight:900; color:#1e3a8a; margin-bottom:2px;">${escapeHtml(comp.legalName || compNameEn)}</div>
          <div>★ OFFICIAL CORPORATE SEAL ★</div>
          <div style="font-family:monospace; font-size:7px; margin-top:2px;">VERIFIED ID: ${escapeHtml(comp.id ? comp.id.slice(0, 16) : "—")}</div>
        </div>

        <div class="sig-box">
          <div class="sig-line"></div>
          <div>AUTHORIZED ERP CONTROLLER</div>
          <div style="font-size:7.5px; color:#94a3b8;">Chief Operating Officer / Super Admin</div>
        </div>
      </div>

      <!-- Audit Footer -->
      <div class="audit-footer">
        <div>Generated by Digital Dock ERP Corporate Registry</div>
        <div>Report Ref: DOSSIER-${escapeHtml(comp.accountNo || comp.id?.slice(0, 8) || "—")}-${escapeHtml(comp.companyCode || "CMP")} • Page 1 of 1</div>
      </div>

    </div>

    <script>
      // Auto trigger print when loaded
      window.onload = function() {
        // optional auto print if desired
      };
    </script>
  </body>
</html>`;

  printStore.openPrint(html, `Company 360 Dossier - ${compNameEn}`);
}
