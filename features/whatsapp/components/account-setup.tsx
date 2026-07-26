"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Wifi, WifiOff, Shield } from "lucide-react";
import type { WhatsAppAccount } from "../types";
import { deleteWhatsAppAccount } from "../api";

type Props = {
  accounts: WhatsAppAccount[];
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (account: WhatsAppAccount) => void;
};

const SCOPE_LABEL: Record<string, string> = {
  super_admin: "Global (Super Admin)",
  country: "Country Level",
  country_branch: "Country Branch",
  city_branch: "City Branch"
};

function ScopeTag({ scope }: { scope: string }) {
  const colors: Record<string, string> = {
    super_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    country: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    country_branch: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    city_branch: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[scope] ?? ""}`}>
      {SCOPE_LABEL[scope] ?? scope}
    </span>
  );
}

export function AccountSetup({ accounts, onRefresh, onAdd, onEdit }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Disconnect this WhatsApp account? Existing conversations will be preserved.")) return;
    setDeletingId(id);
    try {
      await deleteWhatsAppAccount(id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to disconnect account");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Connected WhatsApp Accounts</h2>
          <p className="text-xs text-muted-foreground">Manage WhatsApp Business numbers linked to this ERP</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#20ba59] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Connect Account
        </button>
      </div>

      {/* Official API notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/40 dark:bg-blue-900/20">
        <Shield className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" />
        <div className="text-xs">
          <p className="font-semibold text-blue-800 dark:text-blue-300">Official WhatsApp Business Platform</p>
          <p className="mt-0.5 text-blue-700 dark:text-blue-400">
            This ERP uses the official Meta WhatsApp Cloud API. Numbers are verified through Meta's Business Manager and will never be blocked.
          </p>
        </div>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Wifi className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No WhatsApp accounts connected</p>
            <p className="mt-1 text-xs text-muted-foreground">Connect your first WhatsApp Business number to start messaging</p>
          </div>
          <button
            onClick={onAdd}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#20ba59] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect WhatsApp Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Status indicator */}
                <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${account.isActive ? "bg-[#25D366]/15" : "bg-muted"}`}>
                  {account.isActive
                    ? <Wifi className="h-4 w-4 text-[#25D366]" />
                    : <WifiOff className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{account.displayName}</p>
                    {account.isDefault && (
                      <span className="rounded-full bg-[#25D366]/10 px-1.5 py-px text-[9px] font-medium text-[#25D366]">Default</span>
                    )}
                    {!account.isActive && (
                      <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground">Inactive</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{account.phoneNumber}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ScopeTag scope={account.scope} />
                    {account.country && (
                      <span className="text-[10px] text-muted-foreground">{account.country.name}</span>
                    )}
                    {account.cityBranch && (
                      <span className="text-[10px] text-muted-foreground">{account.cityBranch.cityName} — {account.cityBranch.name}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    Phone ID: {account.phoneNumberId}
                    {account.webhookRegistered && " · Webhook ✓"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(account)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  title="Disconnect"
                >
                  {deletingId === account.id
                    ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
