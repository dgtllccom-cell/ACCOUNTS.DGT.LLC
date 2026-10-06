"use client";

/**
 * Temporary visual marker for screens/sections added or changed by the Dynamic
 * Location & Route Management build, so the owner can find and review them
 * quickly. Precedent: commits 1978322 / b6a2346 (Employee KYC review marker,
 * added then removed after approval).
 *
 * TO REMOVE AFTER APPROVAL: delete every <ReviewMarker>/<ReviewBadge> usage
 * across the location-master/route-templates screens and the marked blocks in
 * customer-order-management-view.tsx / bl-entry-view.tsx, then delete this file.
 */

import type { ReactNode } from "react";

export function ReviewMarker({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-rose-400 p-2 dark:border-rose-600">
      <span className="absolute -top-3 start-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Inline badge variant for a small changed block (not a whole screen). */
export function ReviewBadge({ label = "NEW / CHANGED" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-400 bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
      {label}
    </span>
  );
}
