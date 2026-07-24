"use client";

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { AccountSetup } from "@/features/whatsapp/components/account-setup";
import { fetchWhatsAppAccounts, createWhatsAppAccount } from "@/features/whatsapp/api";
import type { WhatsAppAccount } from "@/features/whatsapp/types";

type ConnectFormData = {
  scope: string;
  displayName: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
};

function ConnectAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (data: ConnectFormData) => Promise<void> }) {
  const [form, setForm] = useState<ConnectFormData>({
    scope: "city_branch",
    displayName: "",
    phoneNumber: "",
    phoneNumberId: "",
    wabaId: "",
    accessToken: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof ConnectFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Connect WhatsApp Business Account</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            You'll need your Meta WhatsApp Cloud API credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          {/* Scope */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-foreground">Account Scope</label>
            <select
              value={form.scope}
              onChange={(e) => update("scope", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            >
              <option value="city_branch">City Branch</option>
              <option value="country_branch">Country Branch</option>
              <option value="country">Country</option>
              <option value="super_admin">Global (Super Admin)</option>
            </select>
          </div>

          {[
            { field: "displayName", label: "Display Name", placeholder: "e.g. Dubai Branch WhatsApp" },
            { field: "phoneNumber", label: "Phone Number (E.164)", placeholder: "+971501234567" },
            { field: "phoneNumberId", label: "Phone Number ID (from Meta)", placeholder: "1234567890" },
            { field: "wabaId", label: "WhatsApp Business Account ID", placeholder: "1234567890" },
            { field: "accessToken", label: "Permanent System User Access Token", placeholder: "EAA..." }
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="mb-1 block text-[11px] font-medium text-foreground">{label}</label>
              <input
                type={field === "accessToken" ? "password" : "text"}
                value={form[field as keyof ConnectFormData]}
                onChange={(e) => update(field as keyof ConnectFormData, e.target.value)}
                placeholder={placeholder}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
              />
            </div>
          ))}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white hover:bg-[#20ba59] transition-colors disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Connect Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WhatsAppSetupPage() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchWhatsAppAccounts();
      setAccounts(data);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  async function handleConnect(data: ConnectFormData) {
    await createWhatsAppAccount(data);
    await loadAccounts();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/messages/whatsapp"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Inbox
      </Link>

      <div>
        <h1 className="text-lg font-bold text-foreground">WhatsApp Account Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect and manage WhatsApp Business numbers for each country and branch.
          Uses the official Meta WhatsApp Cloud API — numbers are safe from being blocked.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AccountSetup
          accounts={accounts}
          onRefresh={loadAccounts}
          onAdd={() => setShowModal(true)}
          onEdit={(account) => {
            /* TODO: open edit modal */
            console.log("Edit:", account.id);
          }}
        />
      )}

      {showModal && (
        <ConnectAccountModal
          onClose={() => setShowModal(false)}
          onSave={handleConnect}
        />
      )}
    </div>
  );
}
