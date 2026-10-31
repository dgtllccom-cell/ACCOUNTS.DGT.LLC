"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Plus, Paperclip, Check, Pencil, X, Loader2 } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import {
  listTransferModes,
  createTransferMode,
  updateTransferMode,
  type TransferMode,
} from "@/features/settings/transfer-mode-api";

export interface BankItem {
  id: string;
  bank_name: string;
  bank_code?: string | null;
  branch_name?: string | null;
  swift_code?: string | null;
  full_address?: string | null;
  country_id?: string | null;
  is_active?: boolean;
}

interface TransferDetailsSectionProps {
  bankName: string;
  onBankNameChange: (name: string) => void;
  transferMode: string;
  onTransferModeChange: (mode: string) => void;
  transactionReference: string;
  onTransactionReferenceChange: (ref: string) => void;
  attachmentFile?: File | null;
  onAttachmentChange?: (file: File | null) => void;
  countryIso?: string;
  countryId?: string;
  extraBanks?: string[];
  className?: string;
  showAttachment?: boolean;
  lang?: SupportedLanguage;
}

export function TransferDetailsSection({
  bankName,
  onBankNameChange,
  transferMode,
  onTransferModeChange,
  transactionReference,
  onTransactionReferenceChange,
  attachmentFile,
  onAttachmentChange,
  countryId,
  extraBanks = [],
  className = "",
  showAttachment = false,
  lang = "en",
}: TransferDetailsSectionProps) {
  // DB-loaded states
  const [banksList, setBanksList] = useState<BankItem[]>([]);
  const [modesList, setModesList] = useState<TransferMode[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingModes, setLoadingModes] = useState(false);

  // Dropdown open states
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  // Inline "New" form states
  const [showNewBankForm, setShowNewBankForm] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankCode, setNewBankCode] = useState("");
  const [newBankBranch, setNewBankBranch] = useState("");
  const [newBankSwift, setNewBankSwift] = useState("");
  const [newBankAddress, setNewBankAddress] = useState("");
  const [creatingBank, setCreatingBank] = useState(false);

  const [showNewModeForm, setShowNewModeForm] = useState(false);
  const [newModeName, setNewModeName] = useState("");
  const [newModeRefLabel, setNewModeRefLabel] = useState("");
  const [newModePlaceholder, setNewModePlaceholder] = useState("");
  const [creatingMode, setCreatingMode] = useState(false);

  // Modal edit states
  const [editingBank, setEditingBank] = useState<BankItem | null>(null);
  const [editBankName, setEditBankName] = useState("");
  const [editBankCode, setEditBankCode] = useState("");
  const [editBankBranch, setEditBankBranch] = useState("");
  const [editBankSwift, setEditBankSwift] = useState("");
  const [editBankAddress, setEditBankAddress] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  const [editingMode, setEditingMode] = useState<TransferMode | null>(null);
  const [editModeName, setEditModeName] = useState("");
  const [editModeRefLabel, setEditModeRefLabel] = useState("");
  const [editModePlaceholder, setEditModePlaceholder] = useState("");
  const [savingMode, setSavingMode] = useState(false);

  // Error/notice feedback
  const [actionError, setActionError] = useState<string | null>(null);

  // Refs for click outside
  const bankFieldRef = useRef<HTMLDivElement>(null);
  const modeFieldRef = useRef<HTMLDivElement>(null);
  const newBankInputRef = useRef<HTMLInputElement>(null);
  const newModeInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Banks from DB Master
  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const qp = new URLSearchParams();
      qp.set("limit", "500");
      qp.set("status", "Active");
      if (countryId) qp.set("countryId", countryId);
      const res: any = await apiGet(`/api/erp/banks?${qp.toString()}`);
      const list = Array.isArray(res?.banks) ? res.banks : Array.isArray(res) ? res : [];
      setBanksList(list);
    } catch (err) {
      console.error("Failed to fetch banks from master:", err);
    } finally {
      setLoadingBanks(false);
    }
  };

  // 2. Fetch Transfer Modes from DB Master
  const fetchModes = async () => {
    setLoadingModes(true);
    try {
      const modes = await listTransferModes();
      setModesList(modes || []);
    } catch (err) {
      console.error("Failed to fetch transfer modes from master:", err);
    } finally {
      setLoadingModes(false);
    }
  };

  useEffect(() => {
    fetchBanks();
    fetchModes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Combined options: Database-backed + extraBanks prop
  const bankOptions = useMemo(() => {
    const list: { id?: string; name: string; record?: BankItem }[] = [];
    const seen = new Set<string>();

    for (const b of banksList) {
      const trimmed = b.bank_name.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push({ id: b.id, name: trimmed, record: b });
      }
    }

    for (const name of extraBanks) {
      const trimmed = name.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push({ name: trimmed });
      }
    }

    if (bankName && !seen.has(bankName.trim().toLowerCase())) {
      list.push({ name: bankName.trim() });
    }

    return list;
  }, [banksList, extraBanks, bankName]);

  const modeOptions = useMemo(() => {
    const list: { id?: string; name: string; record?: TransferMode }[] = [];
    const seen = new Set<string>();

    for (const m of modesList) {
      const trimmed = m.name.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push({ id: m.id, name: trimmed, record: m });
      }
    }

    if (transferMode && !seen.has(transferMode.trim().toLowerCase())) {
      list.push({ name: transferMode.trim() });
    }

    return list;
  }, [modesList, transferMode]);

  // Click outside to close menus
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bankFieldRef.current && !bankFieldRef.current.contains(e.target as Node)) {
        setBankMenuOpen(false);
        setShowNewBankForm(false);
      }
      if (modeFieldRef.current && !modeFieldRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
        setShowNewModeForm(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setBankMenuOpen(false);
        setShowNewBankForm(false);
        setModeMenuOpen(false);
        setShowNewModeForm(false);
        setEditingBank(null);
        setEditingMode(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Auto focus inline inputs when opened
  useEffect(() => {
    if (showNewBankForm) {
      setTimeout(() => newBankInputRef.current?.focus(), 50);
    }
  }, [showNewBankForm]);

  useEffect(() => {
    if (showNewModeForm) {
      setTimeout(() => newModeInputRef.current?.focus(), 50);
    }
  }, [showNewModeForm]);

  // Active Transfer Mode from DB
  const activeModeRecord = useMemo(() => {
    const v = (transferMode || "").trim().toLowerCase();
    return modesList.find((m) => m.name.trim().toLowerCase() === v) ?? null;
  }, [transferMode, modesList]);

  // Active Bank from DB
  const activeBankRecord = useMemo(() => {
    const v = (bankName || "").trim().toLowerCase();
    return banksList.find((b) => b.bank_name.trim().toLowerCase() === v) ?? null;
  }, [bankName, banksList]);

  // Dynamic reference label and placeholder driven by database Transfer Mode
  const { refLabel, refPlaceholder, refHint } = useMemo(() => {
    if (activeModeRecord?.reference_label) {
      return {
        refLabel: `${activeModeRecord.reference_label} *`,
        refPlaceholder: activeModeRecord.reference_placeholder || t(lang, "td.ref_placeholder", "Reference / number"),
        refHint: activeModeRecord.name,
      };
    }

    const v = (transferMode || "").toLowerCase();
    if (v.includes("cheque") || v.includes("check")) {
      return {
        refLabel: "Cheque Number *",
        refPlaceholder: "Enter cheque number",
        refHint: transferMode,
      };
    }
    if (v.includes("gpay") || v.includes("google pay") || v.includes("upi")) {
      return {
        refLabel: "GPay Number / UPI ID *",
        refPlaceholder: "Enter GPay number or UPI ID",
        refHint: transferMode,
      };
    }
    if (v.includes("mobile") || v.includes("wallet")) {
      return {
        refLabel: "Mobile Number / Transfer ID *",
        refPlaceholder: "Enter mobile number or transfer ID",
        refHint: transferMode,
      };
    }
    return {
      refLabel: `${t(lang, "td.txn_ref", "Transaction Reference")} *`,
      refPlaceholder: t(lang, "td.ref_placeholder", "Reference / number"),
      refHint: transferMode || t(lang, "td.ref_hint", "Auto label by mode"),
    };
  }, [activeModeRecord, transferMode, lang]);

  // 1. Add new Bank to PostgreSQL via API
  const handleAddNewBank = async () => {
    const trimmed = newBankName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      newBankInputRef.current?.focus();
      return;
    }
    setActionError(null);
    setCreatingBank(true);
    try {
      const payload: any = {
        bankName: trimmed,
        bankCode: newBankCode.trim() || undefined,
        branchName: newBankBranch.trim() || undefined,
        swiftCode: newBankSwift.trim() || undefined,
        fullAddress: newBankAddress.trim() || undefined,
        countryId: countryId || undefined,
        isActive: true,
      };
      const res: any = await apiPost("/api/erp/banks", payload);
      const created = res?.bank || res;
      await fetchBanks();
      onBankNameChange(created?.bank_name || trimmed);
      setNewBankName("");
      setNewBankCode("");
      setNewBankBranch("");
      setNewBankSwift("");
      setNewBankAddress("");
      setShowNewBankForm(false);
      setBankMenuOpen(false);
    } catch (err: any) {
      console.error("Failed to create bank:", err);
      setActionError(err.message || "Failed to create bank");
    } finally {
      setCreatingBank(false);
    }
  };

  // 2. Open Edit Bank Modal
  const handleOpenEditBank = (bank: BankItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingBank(bank);
    setEditBankName(bank.bank_name || "");
    setEditBankCode(bank.bank_code || "");
    setEditBankBranch(bank.branch_name || "");
    setEditBankSwift(bank.swift_code || "");
    setEditBankAddress(bank.full_address || "");
    setActionError(null);
    setBankMenuOpen(false);
  };

  // 3. Save Bank Edit to PostgreSQL via API
  const handleSaveBankEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !editBankName.trim()) return;
    setSavingBank(true);
    setActionError(null);
    try {
      const payload: any = {
        bankName: editBankName.trim(),
        bankCode: editBankCode.trim() || null,
        branchName: editBankBranch.trim() || null,
        swiftCode: editBankSwift.trim() || null,
        fullAddress: editBankAddress.trim() || null,
      };
      await apiPut(`/api/erp/banks/${editingBank.id}`, payload);
      await fetchBanks();
      if (bankName === editingBank.bank_name) {
        onBankNameChange(editBankName.trim());
      }
      setEditingBank(null);
    } catch (err: any) {
      console.error("Failed to update bank:", err);
      setActionError(err.message || "Failed to update bank");
    } finally {
      setSavingBank(false);
    }
  };

  // 4. Add new Transfer Mode to PostgreSQL via API
  const handleAddNewMode = async () => {
    const trimmed = newModeName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      newModeInputRef.current?.focus();
      return;
    }
    setActionError(null);
    setCreatingMode(true);
    try {
      const created = await createTransferMode({
        name: trimmed,
        referenceLabel: newModeRefLabel.trim() || "Transaction Reference",
        referencePlaceholder: newModePlaceholder.trim() || "Reference / number",
        isActive: true,
      });
      await fetchModes();
      onTransferModeChange(created?.name || trimmed);
      setNewModeName("");
      setNewModeRefLabel("");
      setNewModePlaceholder("");
      setShowNewModeForm(false);
      setModeMenuOpen(false);
    } catch (err: any) {
      console.error("Failed to create transfer mode:", err);
      setActionError(err.message || "Failed to create transfer mode");
    } finally {
      setCreatingMode(false);
    }
  };

  // 5. Open Edit Transfer Mode Modal
  const handleOpenEditMode = (mode: TransferMode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingMode(mode);
    setEditModeName(mode.name || "");
    setEditModeRefLabel(mode.reference_label || "Transaction Reference");
    setEditModePlaceholder(mode.reference_placeholder || "Reference / number");
    setActionError(null);
    setModeMenuOpen(false);
  };

  // 6. Save Transfer Mode Edit to PostgreSQL via API
  const handleSaveModeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMode || !editModeName.trim()) return;
    setSavingMode(true);
    setActionError(null);
    try {
      await updateTransferMode(editingMode.id, {
        name: editModeName.trim(),
        referenceLabel: editModeRefLabel.trim() || "Transaction Reference",
        referencePlaceholder: editModePlaceholder.trim() || "Reference / number",
      });
      await fetchModes();
      if (transferMode === editingMode.name) {
        onTransferModeChange(editModeName.trim());
      }
      setEditingMode(null);
    } catch (err: any) {
      console.error("Failed to update transfer mode:", err);
      setActionError(err.message || "Failed to update transfer mode");
    } finally {
      setSavingMode(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Error Notice */}
      {actionError && (
        <div className="p-2 text-xs rounded-lg bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-0.5 hover:bg-red-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Three compact fields in a row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-start">
        {/* Field 1: Bank Name */}
        <div ref={bankFieldRef} className="w-full sm:flex-[1.2] relative">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
              {t(lang, "td.bank_name", "Bank Name")}
            </label>
            {activeBankRecord && (
              <button
                type="button"
                onClick={(e) => handleOpenEditBank(activeBankRecord, e)}
                title={t(lang, "td.edit_bank", "Edit Bank")}
                className="p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={bankMenuOpen}
            onClick={() => {
              setBankMenuOpen((prev) => !prev);
              setModeMenuOpen(false);
            }}
            className="w-full h-8.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl px-2.5 text-[11px] text-slate-800 dark:text-slate-200 flex items-center justify-between gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          >
            <span className={`truncate text-left font-medium ${!bankName ? "text-slate-400 dark:text-slate-500 font-normal" : "text-slate-900 dark:text-white font-semibold"}`}>
              {loadingBanks ? "Loading banks..." : bankName || t(lang, "td.select_bank", "Select bank")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform" />
          </button>

          {/* Dropdown Menu */}
          {bankMenuOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="max-h-[215px] overflow-y-auto p-1.5 space-y-0.5">
                {bankOptions.map((opt) => (
                  <div
                    key={opt.name}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition flex items-center justify-between group ${
                      bankName === opt.name
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onBankNameChange(opt.name);
                        setBankMenuOpen(false);
                        setShowNewBankForm(false);
                      }}
                      className="flex-1 text-left truncate flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="truncate">{opt.name}</span>
                      {opt.record?.branch_name && (
                        <span className="text-[10px] text-slate-400 font-normal truncate">
                          ({opt.record.branch_name})
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {opt.record && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditBank(opt.record!, e)}
                          title={t(lang, "td.edit_bank", "Edit Bank")}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition opacity-70 group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {bankName === opt.name && (
                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Bank Name Trigger */}
              {!showNewBankForm ? (
                <button
                  type="button"
                  onClick={() => setShowNewBankForm(true)}
                  className="w-full text-left px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-blue-50/70 hover:bg-blue-100/90 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t(lang, "td.new_bank_name", "New Bank Name")}</span>
                </button>
              ) : (
                <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-2">
                  <input
                    ref={newBankInputRef}
                    type="text"
                    maxLength={90}
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder={t(lang, "td.enter_bank_name", "Enter bank name")}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-slate-900 dark:text-white"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      maxLength={30}
                      value={newBankCode}
                      onChange={(e) => setNewBankCode(e.target.value)}
                      placeholder={t(lang, "td.bank_code", "Bank Code")}
                      className="h-7 px-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      maxLength={60}
                      value={newBankBranch}
                      onChange={(e) => setNewBankBranch(e.target.value)}
                      placeholder={t(lang, "td.branch_name", "Branch Name")}
                      className="h-7 px-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={creatingBank}
                      onClick={handleAddNewBank}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {creatingBank && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{t(lang, "td.add_name", "Add Name")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBankForm(false);
                        setNewBankName("");
                        setNewBankCode("");
                        setNewBankBranch("");
                      }}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg cursor-pointer transition"
                    >
                      {t(lang, "td.cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 min-h-[14px] leading-tight">
            {t(lang, "td.bank_hint", "Select an existing bank or add a new one")}
          </div>
        </div>

        {/* Field 2: Transfer Mode * */}
        <div ref={modeFieldRef} className="w-full sm:flex-[0.8] relative">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
              {t(lang, "td.transfer_mode", "Transfer Mode")} <span className="text-red-500">*</span>
            </label>
            {activeModeRecord && (
              <button
                type="button"
                onClick={(e) => handleOpenEditMode(activeModeRecord, e)}
                title={t(lang, "td.edit_mode", "Edit Transfer Mode")}
                className="p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-expanded={modeMenuOpen}
            onClick={() => {
              setModeMenuOpen((prev) => !prev);
              setBankMenuOpen(false);
            }}
            className="w-full h-8.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl px-2.5 text-[11px] text-slate-800 dark:text-slate-200 flex items-center justify-between gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          >
            <span className={`truncate text-left font-medium ${!transferMode ? "text-slate-400 dark:text-slate-500 font-normal" : "text-slate-900 dark:text-white font-semibold"}`}>
              {loadingModes ? "Loading modes..." : transferMode || t(lang, "td.select_mode", "Select mode")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform" />
          </button>

          {/* Dropdown Menu */}
          {modeMenuOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="max-h-[215px] overflow-y-auto p-1.5 space-y-0.5">
                {modeOptions.map((opt) => (
                  <div
                    key={opt.name}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition flex items-center justify-between group ${
                      transferMode === opt.name
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onTransferModeChange(opt.name);
                        setModeMenuOpen(false);
                        setShowNewModeForm(false);
                      }}
                      className="flex-1 text-left truncate cursor-pointer"
                    >
                      <span className="truncate">{opt.name}</span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {opt.record && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditMode(opt.record!, e)}
                          title={t(lang, "td.edit_mode", "Edit Transfer Mode")}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition opacity-70 group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {transferMode === opt.name && (
                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Transfer Mode Trigger */}
              {!showNewModeForm ? (
                <button
                  type="button"
                  onClick={() => setShowNewModeForm(true)}
                  className="w-full text-left px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-blue-50/70 hover:bg-blue-100/90 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t(lang, "td.new_transfer_mode", "New Transfer Mode")}</span>
                </button>
              ) : (
                <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-2">
                  <input
                    ref={newModeInputRef}
                    type="text"
                    maxLength={90}
                    value={newModeName}
                    onChange={(e) => setNewModeName(e.target.value)}
                    placeholder={t(lang, "td.enter_transfer_mode", "Enter transfer mode")}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-slate-900 dark:text-white"
                  />
                  <div className="space-y-1">
                    <input
                      type="text"
                      maxLength={60}
                      value={newModeRefLabel}
                      onChange={(e) => setNewModeRefLabel(e.target.value)}
                      placeholder={t(lang, "td.reference_label", "Reference Field Label")}
                      className="w-full h-7 px-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      maxLength={60}
                      value={newModePlaceholder}
                      onChange={(e) => setNewModePlaceholder(e.target.value)}
                      placeholder={t(lang, "td.reference_placeholder", "Reference Field Placeholder")}
                      className="w-full h-7 px-2 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={creatingMode}
                      onClick={handleAddNewMode}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {creatingMode && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{t(lang, "td.add_mode", "Add Mode")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewModeForm(false);
                        setNewModeName("");
                        setNewModeRefLabel("");
                        setNewModePlaceholder("");
                      }}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg cursor-pointer transition"
                    >
                      {t(lang, "td.cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 min-h-[14px] leading-tight">
            {t(lang, "td.mode_hint", "Select transfer type")}
          </div>
        </div>

        {/* Field 3: Dynamic Transaction Reference * */}
        <div className="w-full sm:flex-[0.8] relative">
          <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {refLabel}
          </label>
          <input
            type="text"
            value={transactionReference}
            onChange={(e) => onTransactionReferenceChange(e.target.value)}
            placeholder={refPlaceholder}
            className="w-full h-8.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl px-2.5 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
          />
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 min-h-[14px] leading-tight truncate">
            {refHint}
          </div>
        </div>
      </div>

      {/* Optional Attachment File Row */}
      {showAttachment && onAttachmentChange && (
        <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
            {t(lang, "cj.mTransferAdvice", "Transfer Advice Upload")}
          </label>
          <label className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[11px] font-bold cursor-pointer transition">
            <Paperclip className="h-3 w-3" />
            <span>{attachmentFile ? attachmentFile.name.slice(0, 16) : t(lang, "cj.mAttach", "Attach File")}</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                onAttachmentChange(file);
              }}
            />
          </label>
        </div>
      )}

      {/* Edit Bank Modal Dialog */}
      {editingBank && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" />
                {t(lang, "td.edit_bank", "Edit Bank")}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBank(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankEdit} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "td.bank_name", "Bank Name")} *
                </label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "td.bank_code", "Bank Code")}
                  </label>
                  <input
                    type="text"
                    value={editBankCode}
                    onChange={(e) => setEditBankCode(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "td.branch_name", "Branch Name")}
                  </label>
                  <input
                    type="text"
                    value={editBankBranch}
                    onChange={(e) => setEditBankBranch(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "td.swift_bic", "SWIFT / BIC")}
                  </label>
                  <input
                    type="text"
                    value={editBankSwift}
                    onChange={(e) => setEditBankSwift(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t(lang, "td.address", "Bank Address")}
                  </label>
                  <input
                    type="text"
                    value={editBankAddress}
                    onChange={(e) => setEditBankAddress(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBank(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  {t(lang, "td.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingBank && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingBank ? t(lang, "td.saving", "Saving...") : t(lang, "td.save_changes", "Save Changes")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transfer Mode Modal Dialog */}
      {editingMode && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" />
                {t(lang, "td.edit_mode", "Edit Transfer Mode")}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMode(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModeEdit} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "td.transfer_mode", "Transfer Mode")} *
                </label>
                <input
                  type="text"
                  required
                  value={editModeName}
                  onChange={(e) => setEditModeName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "td.reference_label", "Reference Field Label")} *
                </label>
                <input
                  type="text"
                  required
                  value={editModeRefLabel}
                  onChange={(e) => setEditModeRefLabel(e.target.value)}
                  placeholder="e.g. Transaction Reference, Cheque Number, Mobile Number"
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t(lang, "td.reference_placeholder", "Reference Field Placeholder")}
                </label>
                <input
                  type="text"
                  value={editModePlaceholder}
                  onChange={(e) => setEditModePlaceholder(e.target.value)}
                  placeholder="e.g. Enter reference / number"
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  {t(lang, "td.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingMode}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingMode && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingMode ? t(lang, "td.saving", "Saving...") : t(lang, "td.save_changes", "Save Changes")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
