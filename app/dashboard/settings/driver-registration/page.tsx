"use client";

import { useState } from "react";
import { UserCheck, Plus, Search, Trash2, Edit3 } from "lucide-react";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { cn } from "@/lib/utils";

interface DriverRecord {
  id: string;
  driverNameEn: string;
  driverNameUr?: string;
  driverNameAr?: string;
  licenseNo: string;
  licenseCategory: string;
  licenseExpiry: string;
  cnicPassport: string;
  mobileNumber: string;
  transportCompany: string;
  address: string;
  status: "Active" | "Inactive" | "Suspended";
  createdAt: string;
}

const INITIAL_DRIVERS: DriverRecord[] = [
  {
    id: "drv-001",
    driverNameEn: "Muhammad Gul",
    driverNameUr: "محمد گل",
    driverNameAr: "محمد جول",
    licenseNo: "DL-PKR-98421",
    licenseCategory: "HTV Heavy Trailer",
    licenseExpiry: "2028-06-30",
    cnicPassport: "54400-1234567-1",
    mobileNumber: "+92 301 8847291",
    transportCompany: "Damaan Goods Transport",
    address: "Killa Abdullah, Chaman, Balochistan",
    status: "Active",
    createdAt: "2024-02-15"
  },
  {
    id: "drv-002",
    driverNameEn: "Khan Mohammad",
    driverNameUr: "خان محمد",
    driverNameAr: "خان محمد",
    licenseNo: "DL-AF-7721",
    licenseCategory: "Heavy Transport",
    licenseExpiry: "2027-11-15",
    cnicPassport: "AF-Passport-884920",
    mobileNumber: "+93 700 994821",
    transportCompany: "Kandahar Goods Transport",
    address: "Spin Boldak, Kandahar, Afghanistan",
    status: "Active",
    createdAt: "2024-03-01"
  }
];

export default function DriverRegistrationPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>(INITIAL_DRIVERS);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [driverNameEn, setDriverNameEn] = useState("");
  const [driverNameUr, setDriverNameUr] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [licenseCategory, setLicenseCategory] = useState("HTV Heavy Trailer");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [cnicPassport, setCnicPassport] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [transportCompany, setTransportCompany] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Suspended">("Active");

  // Auto 5-language translation for name
  const handleNameChange = (enName: string) => {
    setDriverNameEn(enName);
    if (enName.trim().length >= 2) {
      const translated = autoTranslate5Languages(enName);
      setDriverNameUr(translated.ur);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverNameEn.trim() || !licenseNo.trim()) {
      alert("Please enter Driver Name and Driving License Number.");
      return;
    }

    if (editingId) {
      setDrivers(prev => prev.map(d => d.id === editingId ? {
        ...d,
        driverNameEn,
        driverNameUr,
        licenseNo,
        licenseCategory,
        licenseExpiry,
        cnicPassport,
        mobileNumber,
        transportCompany,
        address,
        status
      } : d));
    } else {
      const newRecord: DriverRecord = {
        id: `drv-${Date.now()}`,
        driverNameEn,
        driverNameUr,
        licenseNo,
        licenseCategory,
        licenseExpiry,
        cnicPassport,
        mobileNumber,
        transportCompany,
        address,
        status,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      setDrivers(prev => [newRecord, ...prev]);
    }

    resetForm();
    setShowModal(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setDriverNameEn("");
    setDriverNameUr("");
    setLicenseNo("");
    setLicenseCategory("HTV Heavy Trailer");
    setLicenseExpiry("");
    setCnicPassport("");
    setMobileNumber("");
    setTransportCompany("");
    setAddress("");
    setStatus("Active");
  };

  const handleEdit = (d: DriverRecord) => {
    setEditingId(d.id);
    setDriverNameEn(d.driverNameEn);
    setDriverNameUr(d.driverNameUr || "");
    setLicenseNo(d.licenseNo);
    setLicenseCategory(d.licenseCategory);
    setLicenseExpiry(d.licenseExpiry);
    setCnicPassport(d.cnicPassport);
    setMobileNumber(d.mobileNumber);
    setTransportCompany(d.transportCompany);
    setAddress(d.address);
    setStatus(d.status);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this driver registration record?")) {
      setDrivers(prev => prev.filter(d => d.id !== id));
    }
  };

  const filtered = drivers.filter(d => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      d.driverNameEn.toLowerCase().includes(term) ||
      (d.driverNameUr && d.driverNameUr.includes(term)) ||
      d.licenseNo.toLowerCase().includes(term) ||
      d.cnicPassport.toLowerCase().includes(term) ||
      d.mobileNumber.toLowerCase().includes(term) ||
      d.transportCompany.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-md">
            <UserCheck className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Truck Driver & Owner Registration Master
            </h1>
            <p className="text-xs font-medium text-indigo-100 mt-0.5">
              Master form for registering truck drivers, license credentials, and transport owner records
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-indigo-700 shadow-md transition hover:bg-indigo-50"
        >
          <Plus className="h-4 w-4" />
          Register New Driver
        </button>
      </div>

      {/* Main Table Card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search driver name, license, CNIC..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>

          <p className="text-xs font-bold text-slate-500">
            Total Drivers: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{filtered.length}</span>
          </p>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-slate-950 text-slate-500 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">#</th>
                <th className="px-5 py-3.5">Driver Name</th>
                <th className="px-5 py-3.5">License Number</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">CNIC / Passport</th>
                <th className="px-5 py-3.5">Mobile</th>
                <th className="px-5 py-3.5">Transport Company</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    No driver records found. Click &quot;Register New Driver&quot; to add one.
                  </td>
                </tr>
              ) : (
                filtered.map((d, index) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition">
                    <td className="px-5 py-3.5 text-slate-400 font-bold">{index + 1}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{d.driverNameEn}</p>
                      {d.driverNameUr && <p className="text-[10px] text-slate-400 font-normal">{d.driverNameUr}</p>}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{d.licenseNo}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{d.licenseCategory}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400">{d.cnicPassport || "—"}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">{d.mobileNumber || "—"}</td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{d.transportCompany || "—"}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={cn(
                        "inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        d.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" :
                        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                      )}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(d)}
                          className="p-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition dark:border-slate-700 dark:text-blue-400"
                          title="Edit Record"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition dark:border-slate-700 dark:text-rose-400"
                          title="Delete Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600" />
                {editingId ? "Edit Truck Driver Registration" : "Register New Truck Driver / Owner"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Driver Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverNameEn}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="e.g. Muhammad Gul"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Driver Name (Urdu Transliteration)
                  </label>
                  <input
                    type="text"
                    value={driverNameUr}
                    onChange={e => setDriverNameUr(e.target.value)}
                    placeholder="محمد گل"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Driving License Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={licenseNo}
                    onChange={e => setLicenseNo(e.target.value)}
                    placeholder="e.g. DL-PKR-98421"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    License Category
                  </label>
                  <select
                    value={licenseCategory}
                    onChange={e => setLicenseCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="HTV Heavy Trailer">HTV Heavy Trailer</option>
                    <option value="Heavy Transport">Heavy Transport (HTV)</option>
                    <option value="LTV Commercial">LTV Commercial Truck</option>
                    <option value="Container Vessel">Container Vessel / Truck</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CNIC / Passport Number
                  </label>
                  <input
                    type="text"
                    value={cnicPassport}
                    onChange={e => setCnicPassport(e.target.value)}
                    placeholder="54400-1234567-1"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Transport Company Name
                  </label>
                  <input
                    type="text"
                    value={transportCompany}
                    onChange={e => setTransportCompany(e.target.value)}
                    placeholder="e.g. Damaan Goods Transport"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    License Expiry Date
                  </label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={e => setLicenseExpiry(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Residential / Office Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Enter complete address..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-sm"
                >
                  Save Driver Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
