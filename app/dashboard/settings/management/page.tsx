import {
  Building2,
  ClipboardList,
  FileCheck2,
  FileText,
  Globe2,
  Handshake,
  SlidersHorizontal,
  Users
} from "lucide-react";

const managementParameters = [
  {
    title: "Company Registration Type",
    sourceFile: "Company Registration TypE.html",
    description: "Draft parameter for VAT, NTN, GST, trade license, and other company registration types.",
    icon: FileCheck2
  },
  {
    title: "Contract Type",
    sourceFile: "Contract Type.html",
    description: "Draft parameter for business, customer, vendor, shipment, and service contract types.",
    icon: Handshake
  },
  {
    title: "Country",
    sourceFile: "COUNTRY.html",
    description: "Draft parameter for country master data. This will connect with Location Setup.",
    icon: Globe2
  },
  {
    title: "Customer Details Form",
    sourceFile: "Customer Details Form.html",
    description: "Draft parameter for customer profile fields and customer setup workflow.",
    icon: Users
  },
  {
    title: "Document Type",
    sourceFile: "Document Type.html",
    description: "Draft parameter for passport, CNIC, ID copy, registration copy, and attachment types.",
    icon: FileText
  }
];

export default function ManagementSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Draft</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Management</h1>
          <p className="text-sm text-muted-foreground">
            Draft parameter area. These names are ready; forms and database actions will be attached next.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Draft
        </span>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Management Parameters</h2>
            <p className="text-sm text-muted-foreground">Parameter names only. Integration is pending.</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {managementParameters.map((item, index) => (
            <article key={item.title} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Parameter {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-950">{item.title}</h3>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  Draft
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">{item.description}</p>

              <div className="mt-4 rounded-lg border border-dashed bg-slate-50 p-3 text-xs">
                <p className="font-semibold uppercase text-slate-500">Source form</p>
                <p className="mt-1 font-mono text-slate-700">{item.sourceFile}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Next Attachment Step</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              When you give the next command, each draft parameter can be connected with its form,
              dropdowns, and later Supabase tables.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

