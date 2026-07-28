"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  FileCheck,
  Users,
  Building2,
  FileText,
  Lock,
  Globe2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DatabaseCleanupPage() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const handleGenerateBackup = async () => {
    setBackupLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-cleanup");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create database backup.");
      setBackupResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (confirmText !== "CLEANUP-PRODUCTION") {
      alert("Please type 'CLEANUP-PRODUCTION' to confirm operational data wipe.");
      return;
    }

    if (!confirm("Are you sure you want to delete all operational test data? A full database backup will be created automatically before deletion.")) {
      return;
    }

    setCleanupLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWipe: true })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to execute database cleanup.");
      setCleanupResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>Settings</span><span>›</span><span>System Maintenance</span><span>›</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200">Database Backup & Reset</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="h-7 w-7 text-blue-600" />
            Super Admin Database Backup & Controlled Cleanup Hub
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Safely back up full ERP database snapshot and reset operational test data for fresh production data entry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateBackup}
            disabled={backupLoading}
            className="h-10 text-xs font-bold gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
          >
            <Download className={`h-4 w-4 ${backupLoading ? "animate-spin" : ""}`} />
            Create Database Backup Now
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          ⚠️ Error: {error}
        </div>
      )}

      {/* Safety Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Preserved Master Data */}
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              1. Preserved Master Data (NOT Deleted)
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Location Masters (Countries, States, Cities, Areas)</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Document & Contract Types</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Company Registrations, Currencies & Packages</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Master Settings Forms & Configuration</li>
            </ul>
          </CardContent>
        </Card>

        {/* Card 2: Main Super Admin Preserved */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-black text-sm">
              <Lock className="h-5 w-5 text-blue-600" />
              2. User Access & Security (Preserved)
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Main Super Admin user account remains active</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Full access permissions preserved</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Super Admin Edit buttons active across Settings</li>
              <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> Non-Super-Admin test/demo users will be purged</li>
            </ul>
          </CardContent>
        </Card>

        {/* Card 3: Cleared Operational Transactions */}
        <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black text-sm">
              <Trash2 className="h-5 w-5 text-rose-600" />
              3. Operational Data Cleared (Purged)
            </div>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
              <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> Operational Branches (`city_branches`)</li>
              <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> Purchase & Sales Bookings / Orders</li>
              <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> Roznamcha, Journals, Ledgers & Accounts</li>
              <li className="flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-rose-500" /> Cash entries, Expenses & Stock logs</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Backup Status Output Box */}
      {backupResult && (
        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-slate-900 space-y-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-sm">
            <FileCheck className="h-5 w-5" /> Database Backup Created Successfully
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-mono space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div><strong>File Name:</strong> {backupResult.backupFileName}</div>
            <div><strong>File Size:</strong> {(backupResult.fileSizeBytes / 1024).toFixed(2)} KB</div>
            <div><strong>Path:</strong> {backupResult.backupFilePath}</div>
            <div><strong>Generated At:</strong> {backupResult.generatedAt}</div>
          </div>
        </div>
      )}

      {/* Cleanup Action Box */}
      <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-black text-base">
          <AlertTriangle className="h-6 w-6" /> Controlled ERP Operational Data Wipe
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          This operation will automatically generate a final pre-deletion backup and purge all test/demo purchases, sales, roznamcha, accounts, ledgers, and operational branches. Type <strong className="text-rose-600 font-mono">CLEANUP-PRODUCTION</strong> below to confirm.
        </p>

        <div className="flex flex-wrap items-center gap-3 max-w-md">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type CLEANUP-PRODUCTION"
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold font-mono text-slate-900 outline-none focus:border-rose-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
          <Button
            type="button"
            onClick={handleExecuteCleanup}
            disabled={cleanupLoading || confirmText !== "CLEANUP-PRODUCTION"}
            className="h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 rounded-xl shadow-sm gap-2"
          >
            <Trash2 className={`h-4 w-4 ${cleanupLoading ? "animate-spin" : ""}`} />
            Execute Operational Data Cleanup
          </Button>
        </div>
      </div>

      {/* Cleanup Results Output Box */}
      {cleanupResult && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-sm">
            <CheckCircle2 className="h-5 w-5" /> Operational Cleanup Finished Successfully
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-slate-900 dark:text-white mb-2 uppercase text-[10px]">Operational Tables Purged</div>
              {Object.entries(cleanupResult.operationalTablesCleared || {}).map(([tbl, cnt]) => (
                <div key={tbl} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-600 dark:text-slate-400">{tbl}:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{String(cnt)} cleared</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-slate-900 dark:text-white mb-2 uppercase text-[10px]">Master Tables Preserved</div>
              {Object.entries(cleanupResult.masterTablesPreserved || {}).map(([tbl, cnt]) => (
                <div key={tbl} className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-slate-600 dark:text-slate-400">{tbl}:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{String(cnt)} intact</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
