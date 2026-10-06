/**
 * Professional A4 Employee Registration Certificate / Profile print.
 * Reusable: call printEmployeeCertificate(emp, company?) from any employee view.
 * No external libraries. QR uses a public image endpoint (renders in the print
 * window); if it fails to load the box simply stays empty.
 */
export type EmployeeCertificate = {
  employeeId?: string | null;
  name?: string | null;
  photoUrl?: string | null;
  cnicPassport?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDate?: string | null;
  employmentType?: string | null;
  status?: string | null;
  nationality?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  emergencyContact?: string | null;
  salary?: string | null;
  reportingManager?: string | null;
  serials?: { superAdmin?: string | null; country?: string | null; branch?: string | null; entry?: string | null };
};

type Company = {
  name?: string;
  logoUrl?: string | null;
  stampUrl?: string | null;
  certificateHeader?: string | null;
  hrManagerName?: string | null;
  address?: string | null;
  country?: string | null;
  branch?: string | null;
};

const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function printEmployeeCertificate(emp: EmployeeCertificate, company: Company = {}) {
  const now = new Date();
  const companyName = company.name || company.country || "Company";
  const qrData = encodeURIComponent(`EMP:${emp.employeeId ?? ""}|${emp.name ?? ""}|${emp.cnicPassport ?? ""}`);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;
  const photo = emp.photoUrl
    ? `<img src="${esc(emp.photoUrl)}" alt="photo" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="nophoto">PHOTO</div>`;

  const row = (label: string, value: any) => `<tr><th>${esc(label)}</th><td>${esc(value) || "&mdash;"}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Employee Certificate — ${esc(emp.name)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color:#111; margin:0; }
    .sheet { border:3px double #1e3a8a; padding:18px 22px; position:relative; min-height:265mm; }
    .watermark { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.05; font-size:120px; font-weight:900; color:#1e3a8a; z-index:0; transform:rotate(-18deg); }
    .content { position:relative; z-index:1; }
    .hdr { display:flex; align-items:center; gap:14px; border-bottom:2px solid #1e3a8a; padding-bottom:10px; }
    .hdr .logo { width:60px; height:60px; object-fit:contain; }
    .hdr .logo-fallback { width:60px;height:60px;border:2px solid #1e3a8a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#1e3a8a;font-size:11px; }
    .hdr h1 { margin:0; font-size:20px; color:#1e3a8a; }
    .hdr .sub { font-size:11px; color:#555; }
    .title { text-align:center; margin:14px 0 6px; }
    .title h2 { margin:0; font-size:18px; letter-spacing:1px; color:#0f172a; text-transform:uppercase; }
    .title .line { width:120px; height:3px; background:#1e3a8a; margin:6px auto 0; }
    .top { display:flex; gap:16px; margin-top:14px; }
    .photo { width:120px; height:150px; border:2px solid #1e3a8a; border-radius:6px; overflow:hidden; flex-shrink:0; display:flex;align-items:center;justify-content:center; }
    .nophoto { color:#94a3b8; font-weight:800; font-size:12px; }
    .idbox { flex:1; }
    .idbox .empid { font-size:22px; font-weight:900; color:#1e3a8a; }
    .idbox .empname { font-size:18px; font-weight:800; margin-top:2px; }
    .qr { text-align:center; }
    .qr img { width:110px; height:110px; }
    .qr .cap { font-size:9px; color:#777; }
    table.kv { width:100%; border-collapse:collapse; margin-top:14px; font-size:12px; }
    table.kv th, table.kv td { border:1px solid #cbd5e1; padding:6px 9px; text-align:left; vertical-align:top; }
    table.kv th { background:#eef2ff; width:26%; font-weight:700; }
    .serials { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; font-size:10px; color:#334155; }
    .serials span { border:1px solid #cbd5e1; border-radius:4px; padding:2px 8px; }
    .declaration { margin-top:14px; font-size:11px; color:#334155; border:1px solid #e2e8f0; background:#f8fafc; padding:8px 10px; border-radius:6px; }
    .signs { display:flex; justify-content:space-between; margin-top:34px; gap:16px; }
    .sign { flex:1; text-align:center; font-size:11px; }
    .sign .l { border-top:1px solid #334155; margin-top:36px; padding-top:4px; }
    .stamp { width:120px;height:120px;border:2px dashed #94a3b8;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;text-align:center; }
    .ftr { margin-top:16px; border-top:1px solid #e2e8f0; padding-top:6px; font-size:9px; color:#888; display:flex; justify-content:space-between; }
  </style></head>
  <body>
    <div class="sheet">
      <div class="watermark">${esc(companyName)}</div>
      <div class="content">
        <div class="hdr">
          ${company.logoUrl ? `<img class="logo" src="${esc(company.logoUrl)}" />` : `<div class="logo-fallback">DD ERP</div>`}
          <div>
            <h1>${esc(companyName)}</h1>
            <div class="sub">${esc(company.country || "")}${company.branch ? " — " + esc(company.branch) : ""} &middot; Human Resources Department</div>
            ${company.address ? `<div class="sub">${esc(company.address)}</div>` : ""}
            ${company.certificateHeader ? `<div class="sub">${esc(company.certificateHeader)}</div>` : ""}
          </div>
        </div>

        <div class="title"><h2>Employee Registration Certificate</h2><div class="line"></div></div>

        <div class="top">
          <div class="photo">${photo}</div>
          <div class="idbox">
            <div class="empid">${esc(emp.employeeId) || "—"}</div>
            <div class="empname">${esc(emp.name) || "—"}</div>
            <div class="serials">
              ${emp.serials?.superAdmin ? `<span>Global: ${esc(emp.serials.superAdmin)}</span>` : ""}
              ${emp.serials?.country ? `<span>Country: ${esc(emp.serials.country)}</span>` : ""}
              ${emp.serials?.branch ? `<span>Branch: ${esc(emp.serials.branch)}</span>` : ""}
              ${emp.serials?.entry ? `<span>Entry: ${esc(emp.serials.entry)}</span>` : ""}
            </div>
          </div>
          <div class="qr"><img src="${qrSrc}" alt="QR" /><div class="cap">Scan to verify</div></div>
        </div>

        <table class="kv"><tbody>
          ${row("CNIC / Passport", emp.cnicPassport)}
          ${row("Department", emp.department)}
          ${row("Designation", emp.designation)}
          ${row("Date of Joining", emp.joiningDate)}
          ${row("Employee Type", emp.employmentType)}
          ${row("Status", emp.status)}
          ${row("Nationality", emp.nationality)}
          ${row("Mobile Number", emp.mobile)}
          ${row("Email", emp.email)}
          ${row("Emergency Contact", emp.emergencyContact)}
          ${row("Reporting Manager", emp.reportingManager)}
          ${row("Salary", emp.salary)}
          ${row("Address", emp.address)}
        </tbody></table>

        <div class="declaration">
          <strong>Declaration:</strong> This certifies that the above-named person is a registered employee of ${esc(companyName)}.
          The details recorded herein are true to the records maintained by the Human Resources Department as of the date of issue.
        </div>

        <div class="signs">
          <div class="sign"><div class="l">Employee Signature</div></div>
          <div class="sign">${company.hrManagerName ? `<div style="font-weight:700;">${esc(company.hrManagerName)}</div>` : ""}<div class="l">HR / Admin Signature</div></div>
          <div class="sign">${company.stampUrl ? `<img src="${esc(company.stampUrl)}" alt="stamp" style="width:120px;height:120px;object-fit:contain;" />` : `<div class="stamp">Company<br/>Stamp</div>`}</div>
        </div>

        <div class="ftr">
          <span>Issued: ${now.toLocaleString()}</span>
          <span>${esc(companyName)} — Official Employee Certificate</span>
        </div>
      </div>
    </div>
  </body></html>`;

  // Route into the shared PdfPreviewModal (Print / Save-as-PDF / orientation /
  // Email / WhatsApp) instead of a hand-rolled popup + auto window.print().
  void import("@/lib/store/print-store").then(({ printStore }) => {
    printStore.openPrint(html, `Employee Certificate — ${emp.name ?? ""}`.trim());
  });
}
