"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mail,
  Users,
  ShieldCheck,
  KeyRound,
  Inbox,
  Clock,
  LucideIcon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MailNavTabs } from "./mail-nav-tabs";

export interface MailPageHeaderProps {
  title: string;
  description: string;
  lastUpdated?: string;
  lastHealthCheck?: string;
  icon?: LucideIcon;
  mainAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function MailPageHeader({
  title,
  description,
  lastUpdated,
  lastHealthCheck,
  icon: Icon = Mail,
  mainAction,
  secondaryAction,
  className,
}: MailPageHeaderProps) {
  const pathname = usePathname();

  const timestampDisplay = lastHealthCheck || lastUpdated || "Just now";

  return (
    <div className={cn("space-y-4 pb-2 border-b border-slate-200 dark:border-slate-800", className)}>
      {/* Top Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Title + Subtitle + Timestamp */}
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 mt-0.5">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                DGT Mail Enterprise
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {description}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>Last Updated / Health Check:</span>
                <strong className="font-semibold text-slate-600 dark:text-slate-300">
                  {timestampDisplay}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Main Action Buttons */}
        {(mainAction || secondaryAction) && (
          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
            {secondaryAction}
            {mainAction}
          </div>
        )}
      </div>

      {/* Segmented Sub-Navigation Bar */}
      <MailNavTabs />
    </div>
  );
}
