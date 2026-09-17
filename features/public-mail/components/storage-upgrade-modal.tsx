"use client";

import { useState } from "react";
import { Check, Database, HardDrive, ShieldCheck, Sparkles, X } from "lucide-react";

interface StorageUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId: string;
  onUpgradeSuccess: (newPlanId: string, newQuotaBytes: number) => void;
}

export function StorageUpgradeModal({
  isOpen,
  onClose,
  currentPlanId,
  onUpgradeSuccess,
}: StorageUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>("pro_10gb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const plans = [
    {
      id: "free_1gb",
      name: "Free Starter",
      quota: "1.0 GB",
      price: "$0.00",
      period: "forever",
      description: "Standard personal mailbox for personal & social verification",
      features: [
        "1.0 GB Cloud NVMe Storage",
        "25 MB Attachment Limit",
        "Instant OTP & Verification Code Extraction",
        "Standard Webmail & IMAP Access",
      ],
      highlight: false,
    },
    {
      id: "pro_10gb",
      name: "Pro Personal",
      quota: "10.0 GB",
      price: "$2.99",
      period: "per month",
      description: "Ideal for power users, large attachments & document storage",
      features: [
        "10.0 GB High-Speed NVMe Storage",
        "50 MB Large Attachment Limit",
        "High Priority Inbound Processing",
        "Advanced Anti-Spam & Phishing Shield",
        "Zero Inactivity Deletion",
      ],
      highlight: true,
    },
    {
      id: "business_50gb",
      name: "Business Ultra",
      quota: "50.0 GB",
      price: "$7.99",
      period: "per month",
      description: "Maximum capacity for enterprise correspondence & heavy media",
      features: [
        "50.0 GB Massive Cloud Storage",
        "100 MB Mega Attachment Support",
        "Custom Mail Aliases & Forwarding",
        "Zero Rate-Limit Delays",
        "VIP Priority Support & Daily Archival",
      ],
      highlight: false,
    },
  ];

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/storage/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upgrade failed");
      }
      onUpgradeSuccess(data.planId, data.quotaBytes);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HardDrive className="h-6 w-6 text-blue-200" />
              <h2 className="text-xl font-bold tracking-tight">Expand Your DGT Mail Storage</h2>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              Select an upgraded storage tier to never run out of space for critical emails and attachments.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isSelected = selectedPlan === p.id;
              const isCurrent = currentPlanId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`cursor-pointer relative flex flex-col rounded-xl border p-5 transition-all ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-600/30 bg-blue-50/40 dark:bg-blue-950/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-0.5 text-[11px] font-semibold text-white shadow">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{p.price}</span>
                    <span className="text-xs text-slate-500">/{p.period}</span>
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <Database className="h-3.5 w-3.5" />
                    <span>{p.quota} Storage</span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>

                  <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />

                  <ul className="space-y-2 text-xs flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {isCurrent ? "Active Plan" : isSelected ? "Select Plan" : "Choose"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Instant activation &bull; Cancel or downgrade anytime &bull; SSL Secured</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={loading || selectedPlan === currentPlanId}
              onClick={handleUpgrade}
              className="px-5 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow"
            >
              {loading ? (
                <span>Activating...</span>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Confirm Plan Activation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
