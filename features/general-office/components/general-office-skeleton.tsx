"use client";

import React from "react";
import { Loader2, Users } from "lucide-react";

export function EmployeeTableSkeleton() {
  return (
    <div className="space-y-4 w-full animate-pulse">
      {/* Search & Filter Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="h-9.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-80" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-9.5 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-9.5 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Table Container Skeleton */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 shadow-xs">
        {/* Table Header Bar */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-12 bg-blue-100 dark:bg-blue-950/60 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <div className="flex items-center gap-3 w-1/4">
                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 hidden sm:block" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28 hidden md:block" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 hidden md:block" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 hidden lg:block" />
              <div className="h-5 w-14 bg-emerald-100 dark:bg-emerald-950/60 rounded-full" />
              <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Table Footer Pagination Skeleton */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="flex gap-2">
            <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GeneralOfficeLoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse w-full">
      {/* Top Banner with live loading indicator */}
      <div className="flex items-center justify-between bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
            <div className="h-3 w-72 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-32 bg-blue-600/20 rounded-xl" />
        </div>
      </div>

      {/* Date toolbar skeleton */}
      <div className="h-11 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2 flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* 5 KPI Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-3"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-14 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 w-6 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-18 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-3 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table & Filter Toolbar Skeleton */}
      <EmployeeTableSkeleton />
    </div>
  );
}
