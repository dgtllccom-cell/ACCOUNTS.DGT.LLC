"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { printStore } from "@/lib/store/print-store";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Building2, Search, Eye, PencilLine, Printer, Trash2, Users, UserCheck, UserMinus, Plus, Mail, MessageSquare, MoreHorizontal, Phone, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CustomerProfile } from "./customer-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";
import { apiGet, apiDelete } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLabel } from "./translations";

type CustomerRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  city_id: string | null;
  area_location_id: string | null;
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function CustomerList({ lang }: { lang: SupportedLanguage }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // State to track which row action menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClose = () => setOpenMenuId(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  // Fetch all customers from DB
  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Query limit=250 to get a large set for stats & registry calculation
      const res = await apiGet<{ customers: CustomerRow[] }>("/api/erp/customers?limit=250");
      setCustomers(res.customers ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  // Parse custom metadata for each customer
  const parsedCustomers = useMemo(() => {
    return customers.map((c) => {
      let meta = {
        customerType: c.company_name ? "Business" : "Male",
        firstName: c.customer_name.split(" ")[0] || c.customer_name,
        lastName: c.customer_name.split(" ").slice(1).join(" ") || "",
        fatherName: c.contact_person || "",
        customerAccountNumber: "",
        country: "",
        stateProvince: "",
        city: "",
        cityCode: "-",
        contacts: [] as Array<{ type: string; value: string }>,
        documents: [] as Array<{ type: string; number: string; upload: string }>,
        status: "Active",
        remarks: c.notes || ""
      };

      if (c.notes) {
        try {
          const parsed = JSON.parse(c.notes);
          if (parsed && typeof parsed === "object") {
            meta = { ...meta, ...parsed };
          }
        } catch {
          // Keep default parsed details
        }
      }

      // Backwards compatibility fallbacks
      if (!meta.contacts || !meta.contacts.length) {
        const fallback = [];
        if (c.mobile) fallback.push({ type: "Mobile", value: c.mobile });
        if (c.whatsapp) fallback.push({ type: "WhatsApp", value: c.whatsapp });
        if (c.email) fallback.push({ type: "Email", value: c.email });
        if (fallback.length === 0) fallback.push({ type: "Mobile", value: "" });
        meta.contacts = fallback;
      }

      if (!meta.documents || !meta.documents.length) {
        meta.documents = [
          {
            type: (meta as any).documentType || "CNIC",
            number: (meta as any).documentNumber || "-",
            upload: (meta as any).documentUpload || ""
          }
        ];
      }

      // Explicitly compute customer account code derived from ID
      meta.customerAccountNumber = "CUST-" + c.id.slice(0, 6).toUpperCase();

      return {
        ...c,
        meta
      };
    });
  }, [customers]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = parsedCustomers.length;
    const active = parsedCustomers.filter((c) => c.meta.status === "Active").length;
    const inactive = total - active;
    const business = parsedCustomers.filter((c) => c.meta.customerType === "Business").length;
    const individual = total - business;

    return { total, active, inactive, business, individual };
  }, [parsedCustomers]);

  // Filter & Search
  const filteredCustomers = useMemo(() => {
    let list = parsedCustomers;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(q) ||
          c.meta.customerAccountNumber.toLowerCase().includes(q) ||
          (c.mobile && c.mobile.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.meta.status.toLowerCase() === statusFilter.toLowerCase());
    }

    return list;
  }, [searchQuery, statusFilter, parsedCustomers]);

  // Delete Action
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;
    try {
      await apiDelete(`/api/erp/customers/${id}`);
      void loadCustomers();
    } catch (e: any) {
      alert(e.message || "Failed to delete customer.");
    }
  };

  // Custom A4 printable window generator
  const handlePrint = (c: typeof parsedCustomers[0]) => {
    const contactsHtml = c.meta.contacts
      .map(
        (cn) => `
        <div class="field">
          <div class="label">${cn.type}</div>
          <div class="value">${cn.value || "-"}</div>
        </div>
      `
      )
      .join("");

    const docsHtml = c.meta.documents
      .map(
        (d) => `
        <div class="field">
          <div class="label">${d.type}</div>
          <div class="value">${d.number || "-"} ${d.upload ? `(${d.upload})` : ""}</div>
        </div>
      `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Customer Profile - ${c.customer_name}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              line-height: 1.5;
              font-size: 13px;
              background-color: #f8fafc;
            }
            .certificate-container {
              border: 1px solid #e2e8f0;
              padding: 30px;
              border-radius: 12px;
              background-color: #ffffff;
              max-width: 800px;
              margin: 20px auto;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
            }
            .header {
              border-bottom: 2px solid #0f766e;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              color: #0f766e;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-top: 3px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              color: #0f766e;
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .grid {
              display: grid;
              grid-template-cols: repeat(2, 1fr);
              gap: 20px;
            }
            .field {
              margin-bottom: 8px;
            }
            .label {
              font-size: 9px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.05em;
            }
            .value {
              font-size: 13px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 1px;
            }
            @media print {
              body {
                background: none;
                margin: 0;
              }
              .certificate-container {
                border: none;
                padding: 0;
                box-shadow: none;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="header">
              <h1 class="title">${c.customer_name}</h1>
              <div class="subtitle">Official Customer Profile Certificate</div>
            </div>
            
            <div class="grid">
              <div class="section">
                <div class="section-title">Personal Information</div>
                <div class="field">
                  <div class="label">Customer Account Code</div>
                  <div class="value">${c.meta.customerAccountNumber}</div>
                </div>
                <div class="field">
                  <div class="label">Customer Type</div>
                  <div class="value">${c.meta.customerType}</div>
                </div>
                <div class="field">
                  <div class="label">Full Name</div>
                  <div class="value">${c.customer_name}</div>
                </div>
                <div class="field">
                  <div class="label">Father Name / Representative</div>
                  <div class="value">${c.meta.fatherName || "-"}</div>
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Location Information</div>
                <div class="field">
                  <div class="label">Full Address</div>
                  <div class="value">${c.address || "-"}</div>
                </div>
                <div class="field">
                  <div class="label">Zip / City Code</div>
                  <div class="value">${c.meta.cityCode || "-"}</div>
                </div>
                <div class="field">
                  <div class="label">Country / State / City</div>
                  <div class="value">${[c.meta.city, c.meta.stateProvince, c.meta.country].filter(Boolean).join(", ") || "-"}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Contact Information</div>
              <div class="grid" style="grid-template-cols: repeat(3, 1fr);">
                ${contactsHtml || '<div class="value">No contacts registered.</div>'}
              </div>
            </div>

            <div class="section">
              <div class="section-title">Document Information</div>
              <div class="grid" style="grid-template-cols: repeat(3, 1fr);">
                ${docsHtml || '<div class="value">No documents registered.</div>'}
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
    printStore.openPrint(html, `Customer Profile - ${c.customer_name}`);
  };

  const isRtl = lang !== "en";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">Settings / Management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {getLabel("customersTitle", lang)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {getLabel("createOrUpdateCustomerSub", lang)}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push("/dashboard/settings/customers/setup" as Route)}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm h-10 px-4 rounded-lg text-xs"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Stats Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{getLabel("totalCustomers", lang)}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-800">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{getLabel("activeCustomers", lang)}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-teal-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg text-teal-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{getLabel("inactiveCustomers", lang)}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-rose-600">{stats.inactive}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <UserMinus className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{getLabel("businessCustomers", lang)}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-amber-600">{stats.business}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{getLabel("individualCustomers", lang)}</p>
              <p className="mt-1.5 text-2xl font-extrabold text-indigo-600">{stats.individual}</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="rounded-xl border shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b px-5 py-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">Customer List Directory</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Use actions to view, edit, print profiles, or review history.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className={`absolute ${isRtl ? "right-3" : "left-3"} top-2.5 h-4 w-4 text-muted-foreground`} />
                <Input
                  placeholder={getLabel("searchPlaceholder", lang)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isRtl ? "pr-9" : "pl-9"} h-9 text-xs bg-white text-slate-900 border-slate-200 focus:border-teal-500`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              >
                <option value="all">{getLabel("allStatuses", lang)}</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">{getLabel("customerCode", lang)}</th>
                  <th className="px-5 py-3.5">{getLabel("customerName", lang)}</th>
                  <th className="px-5 py-3.5">{getLabel("customerType", lang)}</th>
                  <th className="px-5 py-3.5">{getLabel("country", lang)}</th>
                  <th className="px-5 py-3.5">State / Province</th>
                  <th className="px-5 py-3.5">{getLabel("city", lang)}</th>
                  <th className="px-5 py-3.5">Contacts</th>
                  <th className="px-5 py-3.5">Documents</th>
                  <th className="px-5 py-3.5">{getLabel("status", lang)}</th>
                  <th className="px-5 py-3.5">{getLabel("createdDate", lang)}</th>
                  <th className="px-5 py-3.5 text-center">{getLabel("actions", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-5 py-10 text-center text-slate-500 font-medium italic">
                      Loading Customer Registry Directory...
                    </td>
                  </tr>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c, i) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">
                        {c.meta.customerAccountNumber}
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        {c.customer_name}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{c.meta.customerType}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {c.meta.country || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {c.meta.stateProvince || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {c.meta.city || "-"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        <div className="group relative flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 items-center">
                            {c.meta.contacts.map((cn, idx) => {
                              if (cn.type === "Email") {
                                return (
                                  <a
                                    key={idx}
                                    href={`mailto:${cn.value}`}
                                    title={`Email: ${cn.value}`}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              if (cn.type === "WhatsApp") {
                                const cleanNo = cn.value.replace(/[^0-9]/g, "");
                                return (
                                  <a
                                    key={idx}
                                    href={`https://wa.me/${cleanNo}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`WhatsApp: ${cn.value}`}
                                    className="p-1 hover:bg-slate-100 rounded text-teal-500 hover:text-teal-600 transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </a>
                                );
                              }
                              return (
                                <a
                                  key={idx}
                                  href={`tel:${cn.value}`}
                                  title={`Phone: ${cn.value}`}
                                  className="p-1 hover:bg-slate-100 rounded text-blue-500 hover:text-blue-600 transition-colors"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              );
                            })}
                          </div>
                          {/* Hover Tooltip listing all contacts */}
                          <div className="pointer-events-none absolute bottom-full mb-1 left-0 w-48 rounded-lg bg-slate-900 p-2.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 z-50 shadow-md">
                            <p className="font-bold border-b border-slate-700 pb-1 mb-1.5 text-teal-400">All Contacts</p>
                            {c.meta.contacts.map((cn, idx) => (
                              <div key={idx} className="flex justify-between font-mono py-0.5">
                                <span>{cn.type}:</span>
                                <span>{cn.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <DocumentAttachmentIcon entityType="customers" entityId={c.id} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            c.meta.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {c.meta.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono font-medium">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <UnifiedActionMenu
                            onView={() => setSelectedCustomerId(c.id)}
                            onEdit={() => router.push(`/dashboard/settings/customers/setup?customerId=${c.id}` as Route)}
                            onPrint={() => handlePrint(c)}
                            onDelete={() => void handleDelete(c.id, c.customer_name)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-5 py-10 text-center text-slate-500 font-medium italic">
                      No customers found in directory registry matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DetailDrawer
        isOpen={selectedCustomerId !== null}
        onClose={() => setSelectedCustomerId(null)}
        title="Customer Profile Details"
        subtitle="Enterprise record and contact verification"
      >
        {selectedCustomerId && (
          <CustomerProfile
            lang={lang}
            customerId={selectedCustomerId}
            isDrawer
          />
        )}
      </DetailDrawer>
    </div>
  );
}
