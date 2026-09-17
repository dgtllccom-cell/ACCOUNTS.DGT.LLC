"use client";

import { useState } from "react";
import {
  ExternalLink,
  LogOut,
  Mail,
  Search,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import type { PublicMailUser } from "@/lib/public-mail/webmail-service";

interface MailNavbarProps {
  user: PublicMailUser;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLogout: () => void;
  onOpenUpgrade: () => void;
}

export function MailNavbar({
  user,
  searchQuery,
  onSearchChange,
  onLogout,
  onOpenUpgrade,
}: MailNavbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-4 z-20 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              DGT<span className="text-blue-600">.LLC</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              MAIL
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block -mt-0.5">Cloud Mail Platform</span>
        </div>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail, senders, subjects, or verification codes..."
            className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* User Controls & Profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenUpgrade}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-900"
        >
          <span>Upgrade Quota</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {user.display_name[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                  {user.display_name[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user.display_name}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 truncate">{user.email_address}</p>
                </div>
              </div>

              <div className="py-2 space-y-1 text-xs">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span>DGT ERP Control Hub</span>
                  <ExternalLink className="h-3 w-3 ml-auto text-slate-400" />
                </Link>

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenUpgrade();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Settings className="h-4 w-4 text-slate-500" />
                  <span>Storage & Plans</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-xs font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
