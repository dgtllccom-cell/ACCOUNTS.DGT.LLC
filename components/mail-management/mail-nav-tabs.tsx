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
} from "lucide-react";
import { cn } from "@/lib/utils";

export const MAIL_NAV_TABS = [
  {
    label: "Mail Overview",
    href: "/dashboard/mail-management",
    icon: Mail,
    exact: true,
  },
  {
    label: "Mailboxes & Quotas",
    href: "/dashboard/mail-management/users",
    icon: Users,
  },
  {
    label: "Mailbox Credentials",
    href: "/dashboard/dgt-mail-management",
    icon: KeyRound,
  },
  {
    label: "Server Health & DNS",
    href: "/dashboard/mail-management/monitoring",
    icon: ShieldCheck,
  },
  {
    label: "Email Workspace",
    href: "/dashboard/messages/email",
    icon: Inbox,
  },
];

export function MailNavTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1", className)}>
      {MAIL_NAV_TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname?.startsWith(tab.href + "/");
        const TabIcon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shadow-2xs",
              isActive
                ? "bg-blue-600 text-white border-blue-600 shadow-blue-500/20 shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <TabIcon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-slate-400")} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
