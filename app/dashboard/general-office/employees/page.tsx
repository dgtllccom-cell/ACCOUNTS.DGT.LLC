"use client";

import React, { Suspense } from "react";
import { GeneralOfficeDashboardView } from "@/features/general-office/components/general-office-dashboard-view-clean";

export default function GeneralOfficeEmployeePage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading General Office Management...</div>}>
        <GeneralOfficeDashboardView />
      </Suspense>
    </div>
  );
}
