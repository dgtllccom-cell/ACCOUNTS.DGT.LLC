"use client";

import React from "react";
import { Building2, FileText, Mail, MapPin, Pencil, Phone, Tag, X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { accountAvatarStyleFor } from "@/components/ui/search-select";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { SavedText } from "@/components/i18n/saved-text";

export interface CustomerAccountCardProps {
  account: {
    id?: string;
    name?: string | null;
    code?: string | null;
    companyName?: string | null;
    category?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    country?: string | null;
    city?: string | null;
    branch?: string | null;
    status?: string | null;
    currency?: string | null;
    balance?: number | string | null;
    initials?: string | null;
  };
  onEdit?: () => void;
  onClear?: () => void;
  className?: string;
  selected?: boolean;
  clearLabel?: string;
  editLabel?: string;
}

function getInitials(name?: string | null) {
  if (!name || !name.trim()) return "AC";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function CustomerAccountCard({
  account,
  onEdit,
  onClear,
  className,
  selected = false,
  clearLabel,
  editLabel
}: CustomerAccountCardProps) {
  const lang = useActiveLanguage();
  const clearTitle = clearLabel || t(lang, "common.clear", "Clear");
  const editTitle = editLabel || t(lang, "common.edit", "Edit");
  const name = account?.name || "-";
  const initials = account?.initials || getInitials(name);
  const avatarStyle = accountAvatarStyleFor(name);
  const statusRaw = account?.status || "Active";
  const isActive = statusRaw.toLowerCase() === "active";
  // the status is a value ("Active" / "Inactive"): shown in the selected language
  const statusLabel = isActive ? t(lang, "common.active", "Active") : statusRaw.toLowerCase() === "inactive" ? t(lang, "common.inactive", "Inactive") : statusRaw;
  const address = account?.address || [account?.branch, account?.city, account?.country].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "relative flex items-start gap-3.5 p-3.5 rounded-xl border transition-all text-left w-full shadow-2xs",
        selected
          ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 shadow-xs"
          : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800",
        className
      )}
    >
      {/* Left Avatar Badge */}
      <div
        className={cn(
          "h-12 w-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm tracking-wide shadow-2xs border border-black/5 dark:border-white/10",
          avatarStyle.bg,
          avatarStyle.text
        )}
      >
        {initials}
      </div>

      {/* Main Details Body */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Status Badge + Actions */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 truncate" title={name} data-testid="customer-account-card-name">
            <SavedText value={name} lang={lang} kind="name" />
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide",
                isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
              )}
            >
              {statusLabel}
            </span>

            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="p-1 rounded-lg border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                title={editTitle}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}

            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="p-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                title={clearTitle}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Document / Account No | Company Name / Category */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-1">
          {account?.code && (
            <span className="inline-flex items-center gap-1 font-mono font-medium text-blue-600 dark:text-blue-400">
              <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>{account.code}</span>
            </span>
          )}
          {account?.code && (account?.companyName || account?.category) && (
            <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
          )}
          {account?.companyName && (
            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-normal truncate">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{account.companyName}</span>
            </span>
          )}
          {account?.category && !account?.companyName && (
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-normal truncate">
              <Tag className="h-3 w-3 text-slate-400 shrink-0" />
              <span>{account.category}</span>
            </span>
          )}
        </div>

        {/* Row 3: Mobile / Phone | Email */}
        {(account?.phone || account?.email) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400 mt-1">
            {account?.phone && (
              <span className="inline-flex items-center gap-1 font-normal">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span dir="ltr">{account.phone}</span>
              </span>
            )}
            {account?.phone && account?.email && (
              <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
            )}
            {account?.email && (
              <span className="inline-flex items-center gap-1 font-normal truncate">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{account.email}</span>
              </span>
            )}
          </div>
        )}

        {/* Row 4: Address / Location */}
        {address && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <SavedText value={address} lang={lang} className="truncate" />
          </div>
        )}

        {/* Optional Row 5: Currency / Balance */}
        {account?.balance !== undefined && account?.balance !== null && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <Wallet className="h-3 w-3" />
            <span>{t(lang, "lgr.balance", "Balance")}:</span>
            <span>
              {typeof account.balance === "number" ? account.balance.toLocaleString() : account.balance} {account.currency || ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
