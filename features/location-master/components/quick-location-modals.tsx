"use client";

import { useEffect, useState } from "react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { MapPin, Building2, Shield, DoorOpen, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Quick Location Modal (erp_locations) ─────────────────────────────────────
export type QuickLocationModalProps = {
  open: boolean;
  onClose: () => void;
  countryId?: string | null;
  transportMode?: string | null;
  onSaved: (location: { id: string; name: string; location_type: string }) => void;
};

export function QuickLocationModal({
  open,
  onClose,
  countryId,
  transportMode,
  onSaved
}: QuickLocationModalProps) {
  const lang = useActiveLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [locationType, setLocationType] = useState<string>("land_border");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setErrorMsg(null);
      // Pre-select location type according to transport mode
      if (transportMode === "by_sea") {
        setLocationType("seaport");
      } else if (transportMode === "by_air") {
        setLocationType("airport");
      } else if (transportMode === "by_rail") {
        setLocationType("railway_terminal");
      } else {
        setLocationType("land_border");
      }
    }
  }, [open, transportMode]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t(lang, "locmaster.name_required", "Location name is required"));
      return;
    }
    if (!countryId) {
      setErrorMsg(t(lang, "locmaster.country_required", "Please select a country first"));
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/erp/location-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId,
          locationType,
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || t(lang, "locmaster.save_failed", "Failed to save location"));
      }

      const created = json?.data?.location;
      if (created) {
        onSaved({ id: created.id, name: created.name, location_type: created.location_type });
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleModal
      title={
        transportMode === "by_sea"
          ? t(lang, "locmaster.new_port_title", "Add New Sea Port — Shared Master")
          : t(lang, "locmaster.new_border_title", "Add New Border / Location — Shared Master")
      }
      onClose={onClose}
      className="max-w-md w-full"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.type_lbl", "Location Type")} *
          </label>
          <select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="land_border">🛂 {t(lang, "locmaster.type_land_border", "Land Border")}</option>
            <option value="seaport">🚢 {t(lang, "locmaster.type_seaport", "Sea Port")}</option>
            <option value="inland_depot">📦 {t(lang, "locmaster.type_inland_depot", "Inland Depot / Dry Port")}</option>
            <option value="warehouse">🏢 {t(lang, "locmaster.type_warehouse", "Warehouse / Hub")}</option>
            <option value="cross_stuffing">🔄 {t(lang, "locmaster.type_cross_stuffing", "Cross-Stuffing Yard")}</option>
            <option value="free_zone">🌐 {t(lang, "locmaster.type_free_zone", "Free Zone")}</option>
            <option value="airport">✈️ {t(lang, "locmaster.type_airport", "Airport")}</option>
            <option value="railway_terminal">🚆 {t(lang, "locmaster.type_railway_terminal", "Railway Terminal")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.name_lbl", "Complete Location Name")} *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              locationType === "seaport"
                ? "e.g. Karachi Port (KPT) or Jebel Ali Port"
                : "e.g. Chaman Border Terminal"
            }
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="text-[11px] text-slate-400">
            {t(lang, "locmaster.name_sub", "Saved name will appear in Settings and all ERP order forms.")}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.code_lbl", "Location Code / Abbreviation")}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CHM or KPT"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono uppercase text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {t(lang, "common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{t(lang, "locmaster.save_profile", "Save Profile")}</span>
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}

// ── Quick Gate / Terminal Modal (erp_location_terminals) ───────────────────────
export type QuickGateModalProps = {
  open: boolean;
  onClose: () => void;
  locationId?: string | null;
  locationName?: string | null;
  onSaved: (gate: { id: string; name: string }) => void;
};

export function QuickGateModal({
  open,
  onClose,
  locationId,
  locationName,
  onSaved
}: QuickGateModalProps) {
  const lang = useActiveLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [terminalType, setTerminalType] = useState<string>("gate");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDescription("");
      setTerminalType("gate");
      setErrorMsg(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t(lang, "locmaster.gate_name_required", "Gate / Terminal name is required"));
      return;
    }
    if (!locationId) {
      setErrorMsg(t(lang, "locmaster.select_location_first", "Please select a location first"));
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/erp/location-terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          terminalType,
          description: description.trim() || undefined
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || t(lang, "locmaster.save_gate_failed", "Failed to save gate"));
      }

      const created = json?.data?.terminal;
      if (created) {
        onSaved({ id: created.id, name: created.name });
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleModal
      title={t(lang, "locmaster.new_gate_title", "Add New Gate / Terminal — Shared Master")}
      onClose={onClose}
      className="max-w-md w-full"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {locationName && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/30 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <DoorOpen className="h-4 w-4 shrink-0" />
            <span>
              <strong>{t(lang, "locmaster.linked_to", "Linked Location:")}</strong> {locationName}
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.terminal_type_lbl", "Type")} *
          </label>
          <select
            value={terminalType}
            onChange={(e) => setTerminalType(e.target.value)}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="gate">🚪 {t(lang, "locmaster.type_gate", "Customs Gate / Entry Gate")}</option>
            <option value="terminal">🏢 {t(lang, "locmaster.type_terminal", "Cargo Terminal")}</option>
            <option value="berth">⚓ {t(lang, "locmaster.type_berth", "Port Berth")}</option>
            <option value="warehouse_bay">📦 {t(lang, "locmaster.type_warehouse_bay", "Warehouse Bay")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.gate_name_lbl", "Gate / Terminal Name")} *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Customs Gate 1 (Inbound)"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.code_lbl", "Code / Identifier")}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. G-01"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono uppercase text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {t(lang, "common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{t(lang, "locmaster.save_gate", "Save Gate")}</span>
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}

// ── Quick Customs Office Modal (erp_customs_treatments) ───────────────────────
export type QuickCustomsOfficeModalProps = {
  open: boolean;
  onClose: () => void;
  countryId?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  onSaved: (office: { id: string; office_name: string; office_code: string | null }) => void;
};

export function QuickCustomsOfficeModal({
  open,
  onClose,
  countryId,
  locationId,
  locationName,
  onSaved
}: QuickCustomsOfficeModalProps) {
  const lang = useActiveLanguage();
  const [officeName, setOfficeName] = useState("");
  const [officeCode, setOfficeCode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOfficeName("");
      setOfficeCode("");
      setDescription("");
      setErrorMsg(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!officeName.trim()) {
      setErrorMsg(t(lang, "locmaster.office_name_required", "Customs office name is required"));
      return;
    }
    if (!countryId) {
      setErrorMsg(t(lang, "locmaster.select_country_first", "Please select a country first"));
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/erp/customs-treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId,
          locationId: locationId && !locationId.startsWith("city:") ? locationId : undefined,
          officeName: officeName.trim(),
          officeCode: officeCode.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
          allowedMovements: ["import", "export", "transit", "re_export"]
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || t(lang, "locmaster.save_office_failed", "Failed to save customs office"));
      }

      const created = json?.data?.office;
      if (created) {
        onSaved({ id: created.id, office_name: created.office_name, office_code: created.office_code });
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleModal
      title={t(lang, "locmaster.new_customs_title", "Add New Customs Office — Shared Master")}
      onClose={onClose}
      className="max-w-md w-full"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40 text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {locationName && (
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-2.5 dark:border-sky-900/40 dark:bg-sky-950/30 text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0" />
            <span>
              <strong>{t(lang, "locmaster.linked_to", "Linked Location:")}</strong> {locationName}
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.office_name_lbl", "Customs Office Name")} *
          </label>
          <input
            type="text"
            required
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            placeholder="e.g. Chaman Customs House / Dry Port Customs"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "locmaster.office_code_lbl", "Office Code / Station Code")}
          </label>
          <input
            type="text"
            value={officeCode}
            onChange={(e) => setOfficeCode(e.target.value)}
            placeholder="e.g. PK-CHM-01"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono uppercase text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {t(lang, "common.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={loading || !officeName.trim()}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{t(lang, "locmaster.save_office", "Save Office")}</span>
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}
