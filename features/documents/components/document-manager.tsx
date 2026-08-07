"use client";

import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  Upload,
  Camera,
  Search,
  Download,
  Printer,
  Trash2,
  Edit,
  MoveRight,
  Eye,
  FileCheck,
  Building2,
  Globe,
  Plus,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

interface OfficeDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  country_id?: string;
  country_name?: string;
  country_branch_id?: string;
  main_branch_name?: string;
  city_branch_id?: string;
  city_branch_name?: string;
  module_type: string;
  category: string;
  tags?: string[];
  scanned_at?: string;
  created_by?: string;
  created_at: string;
}

const MODULE_FOLDERS = [
  "Purchase Documents",
  "Sales Documents",
  "Ledger Documents",
  "Contracts",
  "Invoices",
  "Packing Lists",
  "Bills of Lading",
  "Payment Documents",
  "Customs Documents",
  "Other Attachments"
];

export function DocumentManager() {
  const [countries, setCountries] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>("c1");
  const [selectedMainBranchId, setSelectedMainBranchId] = useState<string>("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [previewDoc, setPreviewDoc] = useState<OfficeDocument | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [editingDoc, setEditingDoc] = useState<OfficeDocument | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editModule, setEditModule] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Countries & Branches from Hierarchy API
  useEffect(() => {
    async function loadHierarchy() {
      try {
        const res = await apiGet<any>("/api/branch-management/general-report");
        if (res?.countries?.length) {
          setCountries(res.countries);
          if (res.countries[0]?.id) setSelectedCountryId(res.countries[0].id);
        }
      } catch (err) {
        console.error("Failed to load hierarchy:", err);
      }
    }
    loadHierarchy();
  }, []);

  // Fetch Documents
  async function fetchDocs() {
    setLoading(true);
    try {
      let url = `/api/documents?moduleType=${encodeURIComponent(selectedModule)}`;
      if (selectedCountryId) url += `&countryId=${encodeURIComponent(selectedCountryId)}`;
      if (selectedMainBranchId) url += `&mainBranchId=${encodeURIComponent(selectedMainBranchId)}`;
      if (selectedCityBranchId) url += `&cityBranchId=${encodeURIComponent(selectedCityBranchId)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await apiGet<{ documents: OfficeDocument[] }>(url);
      setDocuments(res?.documents ?? []);
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocs();
  }, [selectedCountryId, selectedMainBranchId, selectedCityBranchId, selectedModule, searchQuery]);

  // Upload Document Handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
      let docType = "pdf";
      if (["jpg", "jpeg", "png", "webp"].includes(extension)) docType = "image";
      if (["doc", "docx"].includes(extension)) docType = "word";
      if (["xls", "xlsx", "csv"].includes(extension)) docType = "excel";

      const payload = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        file_name: file.name,
        file_url: "/exports/DGT_Standard_Branch_Users.pdf", // Mock URL
        file_type: docType,
        file_size: file.size,
        country_id: selectedCountryId,
        country_branch_id: selectedMainBranchId || null,
        city_branch_id: selectedCityBranchId || null,
        module_type: selectedModule === "all" ? "Purchase Documents" : selectedModule,
        category: "Uploaded",
        tags: [extension.toUpperCase(), "Uploaded"],
        created_by: "User"
      };

      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await fetchDocs();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }

  // Direct Hardware Scanner Bridge Simulation
  async function handleDirectScan() {
    setIsScannerOpen(true);
    setScanStatus("Connecting to scanner hardware (TWAIN/W3C API)...");

    setTimeout(() => {
      setScanStatus("Scanning document page 1 of 1... High Resolution (300 DPI)");
    }, 1500);

    setTimeout(async () => {
      setScanStatus("Processing OCR & saving scanned PDF...");
      try {
        const scanPayload = {
          title: `Scanned Document #${Math.floor(1000 + Math.random() * 9000)}`,
          file_name: `SCANNED-${Date.now()}.pdf`,
          file_url: "/exports/DGT_Standard_Branch_Users.pdf",
          file_type: "pdf",
          file_size: 340000,
          country_id: selectedCountryId,
          country_branch_id: selectedMainBranchId || null,
          city_branch_id: selectedCityBranchId || null,
          module_type: selectedModule === "all" ? "Purchase Documents" : selectedModule,
          category: "Scanned",
          tags: ["Scanned", "PDF", "TWAIN"],
          created_by: "Scanner Hardware API"
        };

        await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scanPayload)
        });

        await fetchDocs();
      } catch (e) {
        console.error(e);
      } finally {
        setIsScannerOpen(false);
        setScanStatus("");
      }
    }, 3200);
  }

  // Delete document
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      await fetchDocs();
    } catch (err) {
      console.error(err);
    }
  }

  // Save edit/move
  async function handleSaveEdit() {
    if (!editingDoc) return;
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDoc.id,
          title: editTitle,
          module_type: editModule
        })
      });
      setEditingDoc(null);
      await fetchDocs();
    } catch (e) {
      console.error(e);
    }
  }

  const activeCountry = countries.find((c) => c.id === selectedCountryId);

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Document Management & Hardware Scanner</div>
          <h1 className="text-xl font-black text-slate-950 tracking-tight">Super Admin Document Storage Directory</h1>
          <p className="text-xs text-slate-500 font-medium">Automatic folder organization: Super Admin → Country → Branch → Module</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload File"}
          </button>

          <button
            onClick={handleDirectScan}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Camera className="h-4 w-4" />
            Start Direct Scan
          </button>
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Left Panel: Folder Navigation Tree */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b pb-2">
            Directory Hierarchy
          </div>

          {/* Super Admin Node */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-950">
              <Globe className="h-4 w-4 text-indigo-600" />
              Super Admin Storage
            </div>

            {/* Country List */}
            <div className="ml-3 pl-2 border-l border-slate-200 space-y-1.5 mt-2">
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Countries</div>
              {countries.length > 0 ? (
                countries.map((country) => (
                  <div key={country.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setSelectedCountryId(country.id);
                        setSelectedMainBranchId("");
                        setSelectedCityBranchId("");
                      }}
                      className={cn(
                        "w-full text-left flex items-center justify-between text-xs font-bold px-2 py-1 rounded-md transition",
                        selectedCountryId === country.id ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <span className="truncate">{country.name}</span>
                      <ChevronRight className={cn("h-3 w-3 transition", selectedCountryId === country.id && "rotate-90")} />
                    </button>

                    {/* Main Branches under selected country */}
                    {selectedCountryId === country.id && (
                      <div className="ml-2 pl-2 border-l border-slate-200 space-y-1 mt-1">
                        <div className="text-[8px] font-black uppercase text-slate-400">Main Branches</div>
                        {(country.mainBranches || []).map((mb: any) => (
                          <div key={mb.id} className="space-y-1">
                            <button
                              onClick={() => {
                                setSelectedMainBranchId(mb.id);
                                setSelectedCityBranchId("");
                              }}
                              className={cn(
                                "w-full text-left text-[11px] font-bold px-2 py-0.5 rounded transition flex items-center justify-between",
                                selectedMainBranchId === mb.id ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"
                              )}
                            >
                              <span className="truncate">{mb.name}</span>
                            </button>

                            {/* City Branches */}
                            {selectedMainBranchId === mb.id && (
                              <div className="ml-2 pl-2 border-l border-slate-200 space-y-1">
                                <div className="text-[8px] font-black uppercase text-slate-400">City Branches</div>
                                {(mb.cityBranches || []).map((cb: any) => (
                                  <button
                                    key={cb.id}
                                    onClick={() => setSelectedCityBranchId(cb.id)}
                                    className={cn(
                                      "w-full text-left text-[10px] font-semibold px-2 py-0.5 rounded transition",
                                      selectedCityBranchId === cb.id ? "bg-sky-600 text-white" : "hover:bg-slate-100 text-slate-500"
                                    )}
                                  >
                                    {cb.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 font-semibold py-2">Loading countries...</div>
              )}
            </div>
          </div>

          {/* Module Categories */}
          <div className="pt-2 border-t border-slate-200 space-y-1">
            <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2">Module Categories</div>
            <button
              onClick={() => setSelectedModule("all")}
              className={cn(
                "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition",
                selectedModule === "all" ? "bg-emerald-600 text-white" : "hover:bg-slate-100 text-slate-700"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              All Module Folders
            </button>
            {MODULE_FOLDERS.map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={cn(
                  "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition",
                  selectedModule === mod ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"
                )}
              >
                <span className="truncate">{mod}</span>
                {selectedModule === mod && <ChevronRight className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Workspace Panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filter Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents by title, tags, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchDocs}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {/* Active Folder Breadcrumb Indicator */}
          <div className="rounded-xl border border-slate-200 bg-indigo-50/50 p-2.5 text-xs font-bold text-slate-700 flex flex-wrap items-center gap-1.5">
            <span className="text-indigo-600 font-extrabold uppercase text-[10px]">Active Path:</span>
            <span>Super Admin</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>{activeCountry?.name || "Country"}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span>{selectedMainBranchId ? "Main Branch" : "All Branches"}</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs font-black">
              {selectedModule === "all" ? "All Modules" : selectedModule}
            </span>
          </div>

          {/* Documents Grid / Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading document repository...</div>
            ) : documents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider text-center">
                      <Th className="p-3 text-left">Document Title</Th>
                      <Th className="p-3">File Type</Th>
                      <Th className="p-3">Module Category</Th>
                      <Th className="p-3">Location</Th>
                      <Th className="p-3">Created By</Th>
                      <Th className="p-3">Date</Th>
                      <Th className="p-3">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 text-center font-medium">
                        <td className="p-3 text-left font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            {doc.file_type === "pdf" && <FileText className="h-4 w-4 text-rose-600 flex-shrink-0" />}
                            {doc.file_type === "image" && <ImageIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                            {doc.file_type === "word" && <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                            {doc.file_type === "excel" && <FileSpreadsheet className="h-4 w-4 text-emerald-700 flex-shrink-0" />}
                            <div>
                              <div>{doc.title}</div>
                              <div className="text-[9px] text-slate-400 font-mono">{doc.file_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 uppercase font-extrabold text-[10px]">
                          <span className="rounded bg-slate-100 px-2 py-0.5 border text-slate-700">{doc.file_type}</span>
                        </td>
                        <td className="p-3 font-semibold text-indigo-700">{doc.module_type}</td>
                        <td className="p-3 text-[10px]">
                          <div>{doc.country_name || "Pakistan"}</div>
                          <div className="text-slate-400 font-mono">{doc.main_branch_name || "Main Branch"}</div>
                        </td>
                        <td className="p-3 font-semibold">{doc.created_by || "Admin"}</td>
                        <td className="p-3 text-[10px] font-mono text-slate-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="rounded border border-indigo-200 bg-white p-1 text-indigo-600 hover:bg-indigo-50"
                              title="Preview Document"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={doc.file_url}
                              download
                              className="rounded border border-emerald-200 bg-white p-1 text-emerald-600 hover:bg-emerald-50"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                setEditingDoc(doc);
                                setEditTitle(doc.title);
                                setEditModule(doc.module_type);
                              }}
                              className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                              title="Rename / Move"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold space-y-2">
                <FolderOpen className="h-8 w-8 text-slate-300 mx-auto" />
                <div>No documents found in this directory folder.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direct Scanner Hardware Dialog */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Direct Scanner Integration</h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">{scanStatus}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Document Inspector / Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">{previewDoc.title}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{previewDoc.file_name} • {previewDoc.module_type}</p>
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 bg-slate-50 min-h-[300px] flex items-center justify-center text-center">
              <div className="space-y-3">
                <FileCheck className="h-12 w-12 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900">Document Ready for Viewer & Print</div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <a
                    href={previewDoc.file_url}
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Eye className="h-4 w-4" /> Open Full Screen
                  </a>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                  >
                    <Printer className="h-4 w-4" /> Print Document
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Move Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="font-bold text-base text-slate-900">Edit / Move Document</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Document Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Module Category</label>
                <select
                  value={editModule}
                  onChange={(e) => setEditModule(e.target.value)}
                  className="w-full rounded-xl border p-2 text-xs font-semibold mt-1 bg-white"
                >
                  {MODULE_FOLDERS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingDoc(null)}
                className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
