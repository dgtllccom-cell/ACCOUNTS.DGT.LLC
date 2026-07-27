"use client";

import { useState } from "react";
import {
  DigitalDockPremiumSidebar,
  DigitalDockPremiumSidebarWithDrawer,
} from "@/components/layout/digital-dock-premium-sidebar";

// Temporary design preview — /ui-preview/sidebar
// Standalone (outside the dashboard shell) so the new Premium Sidebar can be
// reviewed on its own. It does NOT replace or touch the current ERP sidebar.
export default function SidebarPreviewPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Fixed sidebar — desktop & tablet (xl and up) */}
      <aside className="hidden h-screen w-[280px] shrink-0 border-r border-slate-200 bg-white xl:block">
        <DigitalDockPremiumSidebar />
      </aside>

      {/* Review / content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          {/* Mobile drawer trigger (hidden on xl) */}
          <div className="xl:hidden">
            <DigitalDockPremiumSidebarWithDrawer open={open} onOpenChange={setOpen} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">Premium Sidebar — Design Preview</div>
            <div className="text-[11px] text-slate-500">/ui-preview/sidebar · design-only · not wired into the ERP</div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-base font-bold text-slate-900">Review checklist</h1>
            <ul className="mt-3 space-y-1.5 text-[13px] text-slate-600">
              <li>• Overall look &amp; feel, colors and typography</li>
              <li>• Icons and menu spacing</li>
              <li>• Expand / collapse animation (click a group, e.g. Accounting, Purchase)</li>
              <li>• "New Form Entry" section (Quick Create group, marked NEW)</li>
              <li>• Search box (type to filter the menu)</li>
              <li>• Favourites &amp; Recent quick lists</li>
            </ul>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
            <strong>Responsiveness test:</strong> resize the browser (or open on phone/tablet).
            On wide screens (xl+) the sidebar is fixed on the left. On smaller screens it hides,
            and the <span className="font-mono">☰</span> button in the top bar opens the mobile drawer.
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 text-[12px] text-slate-500">
            This is a preview only. The live ERP navigation is unchanged. After your approval,
            it can be wired to the real nav tree, i18n labels, permissions and routing.
          </div>
        </div>
      </div>
    </div>
  );
}
