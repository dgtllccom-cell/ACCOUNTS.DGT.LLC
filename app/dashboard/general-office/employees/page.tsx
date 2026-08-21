"use client";

import React, { Suspense } from "react";
import { GeneralOfficeDashboardView } from "@/features/general-office/components/general-office-dashboard-view-clean";
import { GeneralOfficeLoadingSkeleton } from "@/features/general-office/components/general-office-skeleton";

export default function GeneralOfficeEmployeePage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <Suspense fallback={<GeneralOfficeLoadingSkeleton />}>
        <GeneralOfficeDashboardView />
      </Suspense>
    </div>
  );
}

