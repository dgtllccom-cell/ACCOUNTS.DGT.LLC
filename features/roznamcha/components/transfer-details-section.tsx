"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Plus, Paperclip, Check } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

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
  extraBanks?: string[];
  className?: string;
  showAttachment?: boolean;
  lang?: SupportedLanguage;
}

const DEFAULT_BANKS = [
  "Emirates NBD",
  "First Abu Dhabi Bank (FAB)",
  "ADCB",
  "Mashreq",
  "Dubai Islamic Bank",
];

const DEFAULT_MODES = [
  "Bank Transfer",
  "Mobile Transfer",
  "GPay / Google Pay",
  "Cheque Transfer",
  "Mobile Wallet",
  "Other Transfer",
];

export function TransferDetailsSection({
  bankName,
  onBankNameChange,
  transferMode,
  onTransferModeChange,
  transactionReference,
  onTransactionReferenceChange,
  attachmentFile,
  onAttachmentChange,
  extraBanks = [],
  className = "",
  showAttachment = false,
  lang = "en",
}: TransferDetailsSectionProps) {
  // Dropdown open states
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  // Inline "New" form states
  const [showNewBankForm, setShowNewBankForm] = useState(false);
  const [newBankInput, setNewBankInput] = useState("");
  const [showNewModeForm, setShowNewModeForm] = useState(false);
  const [newModeInput, setNewModeInput] = useState("");

  // Stored custom items
  const [customBanks, setCustomBanks] = useState<string[]>([]);
  const [customModes, setCustomModes] = useState<string[]>([]);

  // Refs for click outside
  const bankFieldRef = useRef<HTMLDivElement>(null);
  const modeFieldRef = useRef<HTMLDivElement>(null);
  const newBankInputRef = useRef<HTMLInputElement>(null);
  const newModeInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedBanks = JSON.parse(localStorage.getItem("dgt_transfer_bank") || "[]");
      if (Array.isArray(savedBanks)) {
        setCustomBanks(savedBanks.filter((x): x is string => typeof x === "string" && Boolean(x.trim())));
      }
    } catch {
      // ignore
    }
    try {
      const savedModes = JSON.parse(localStorage.getItem("dgt_transfer_mode") || "[]");
      if (Array.isArray(savedModes)) {
        setCustomModes(savedModes.filter((x): x is string => typeof x === "string" && Boolean(x.trim())));
      }
    } catch {
      // ignore
    }
  }, []);

  // Combined options
  const bankOptions = useMemo(() => {
    const combined = [...DEFAULT_BANKS, ...extraBanks, ...customBanks];
    return Array.from(new Set(combined.map((b) => b.trim()))).filter(Boolean);
  }, [extraBanks, customBanks]);

  const modeOptions = useMemo(() => {
    const combined = [...DEFAULT_MODES, ...customModes];
    return Array.from(new Set(combined.map((m) => m.trim()))).filter(Boolean);
  }, [customModes]);

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

  // Dynamic reference label and placeholder based on transferMode
  const { refLabel, refPlaceholder, refHint } = useMemo(() => {
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
  }, [transferMode, lang]);

  // Add new Bank Name
  const handleAddNewBank = () => {
    const trimmed = newBankInput.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      newBankInputRef.current?.focus();
      return;
    }
    const match = bankOptions.find((b) => b.toLowerCase() === trimmed.toLowerCase());
    const finalName = match || trimmed;

    if (!match) {
      const next = Array.from(new Set([...customBanks, finalName]));
      setCustomBanks(next);
      try {
        localStorage.setItem("dgt_transfer_bank", JSON.stringify(next));
      } catch {
        // ignore
      }
    }

    onBankNameChange(finalName);
    setNewBankInput("");
    setShowNewBankForm(false);
    setBankMenuOpen(false);
  };

  // Add new Transfer Mode
  const handleAddNewMode = () => {
    const trimmed = newModeInput.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      newModeInputRef.current?.focus();
      return;
    }
    const match = modeOptions.find((m) => m.toLowerCase() === trimmed.toLowerCase());
    const finalMode = match || trimmed;

    if (!match) {
      const next = Array.from(new Set([...customModes, finalMode]));
      setCustomModes(next);
      try {
        localStorage.setItem("dgt_transfer_mode", JSON.stringify(next));
      } catch {
        // ignore
      }
    }

    onTransferModeChange(finalMode);
    setNewModeInput("");
    setShowNewModeForm(false);
    setModeMenuOpen(false);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Three compact fields in a row */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-start">
        {/* Field 1: Bank Name */}
        <div ref={bankFieldRef} className="w-full sm:flex-[1.2] relative">
          <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {t(lang, "td.bank_name", "Bank Name")}
          </label>
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
              {bankName || t(lang, "td.select_bank", "Select bank")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform" />
          </button>

          {/* Dropdown Menu */}
          {bankMenuOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="max-h-[215px] overflow-y-auto p-1.5 space-y-0.5">
                {bankOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onBankNameChange(opt);
                      setBankMenuOpen(false);
                      setShowNewBankForm(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition flex items-center justify-between ${
                      bankName === opt
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {bankName === opt && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />}
                  </button>
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
                    value={newBankInput}
                    onChange={(e) => setNewBankInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewBank();
                      }
                    }}
                    placeholder={t(lang, "td.enter_bank_name", "Enter bank name")}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddNewBank}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer transition"
                    >
                      {t(lang, "td.add_name", "Add Name")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBankForm(false);
                        setNewBankInput("");
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
          <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {t(lang, "td.transfer_mode", "Transfer Mode")} <span className="text-red-500">*</span>
          </label>
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
              {transferMode || t(lang, "td.select_mode", "Select mode")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform" />
          </button>

          {/* Dropdown Menu */}
          {modeMenuOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="max-h-[215px] overflow-y-auto p-1.5 space-y-0.5">
                {modeOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onTransferModeChange(opt);
                      setModeMenuOpen(false);
                      setShowNewModeForm(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition flex items-center justify-between ${
                      transferMode === opt
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {transferMode === opt && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />}
                  </button>
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
                    value={newModeInput}
                    onChange={(e) => setNewModeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewMode();
                      }
                    }}
                    placeholder={t(lang, "td.enter_transfer_mode", "Enter transfer mode")}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddNewMode}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer transition"
                    >
                      {t(lang, "td.add_mode", "Add Mode")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewModeForm(false);
                        setNewModeInput("");
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

        {/* Field 3: Transaction Reference * */}
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
    </div>
  );
}
