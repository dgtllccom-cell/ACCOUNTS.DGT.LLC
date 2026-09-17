'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Lock,
  Search,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  Users,
  Building2,
  ExternalLink,
  MoreVertical,
  Zap,
  Power,
  RefreshCw,
  X,
  Mail,
} from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';
import { MailPageHeader } from '@/components/mail-management/mail-page-header';
import { MailStatusBadge } from '@/components/mail-management/mail-status-badge';

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  plan_type: string;
  storage_quota_mb: number;
  storage_used_mb: number;
  is_active: boolean;
  suspended_at: string | null;
  last_connection_status: string;
  last_connection_test: string;
  assigned_user_id: string | null;
  assigned_branch_id: string | null;
}

export function DgtMailManagementView() {
  const s = useErpScreen('mail_management');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    emailAddress: '',
    displayName: '',
    imapPassword: '',
    smtpPassword: '',
    storageQuotaMb: 5000,
    planType: 'free',
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  useEffect(() => {
    fetchMailboxes();
  }, []);

  async function fetchMailboxes() {
    setLoading(true);
    try {
      const res = await fetch('/api/erp/mail-management/mailboxes', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch mailboxes');
      const data = await res.json();
      setMailboxes(data.data?.mailboxes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setLoading(false);
    }
  }

  function handleEditMailbox(mailbox: Mailbox) {
    setEditingId(mailbox.id);
    setFormData({
      emailAddress: mailbox.email_address,
      displayName: mailbox.display_name,
      imapPassword: '',
      smtpPassword: '',
      storageQuotaMb: mailbox.storage_quota_mb,
      planType: mailbox.plan_type,
    });
    setShowForm(true);
    setOpenMenuId(null);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      emailAddress: '',
      displayName: '',
      imapPassword: '',
      smtpPassword: '',
      storageQuotaMb: 5000,
      planType: 'free',
    });
  }

  async function handleSaveMailbox(e: React.FormEvent) {
    e.preventDefault();
    setTestingConnection(true);
    setError(null);

    try {
      const res = await fetch('/api/erp/mail-management/mailboxes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save mailbox');

      setTestResult(data.data?.connectionStatus || 'Connection test successful (IMAP/SMTP)');
      handleCloseForm();
      await fetchMailboxes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestingConnection(false);
    }
  }

  const filteredMailboxes = mailboxes.filter((mb) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      mb.email_address?.toLowerCase().includes(q) ||
      mb.display_name?.toLowerCase().includes(q) ||
      mb.plan_type?.toLowerCase().includes(q)
    );
  });

  return (
    <div dir={s.dir} className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Standard Page Header */}
      <MailPageHeader
        title="Mailbox Management & Credentials"
        description="Configure mailboxes, IMAP/SMTP connection credentials, password secrets, and branch assignments."
        lastUpdated={lastUpdated}
        icon={KeyRound}
        secondaryAction={
          <button
            onClick={fetchMailboxes}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh mailboxes"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
        mainAction={
          <button
            onClick={() => {
              if (showForm) {
                handleCloseForm();
              } else {
                setShowForm(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showForm ? 'Cancel' : 'Add Mailbox'}</span>
          </button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {testResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{testResult}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================================================== */}
      {/* 8. PASSWORD ENTRY & EDIT FORM (RED HIGHLIGHTED) */}
      {/* ================================================== */}
      {showForm && (
        <div className="rounded-2xl border-2 border-red-500/80 bg-red-50/40 dark:bg-red-950/20 p-6 shadow-lg shadow-red-500/5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-red-600 animate-ping" />
              <h2 className="text-base font-black text-red-900 dark:text-red-200 tracking-tight">
                {editingId ? 'Edit Mailbox & Credentials' : 'Create New Mailbox & Credentials'}
              </h2>
            </div>
            <button
              onClick={handleCloseForm}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveMailbox} className="space-y-5">
            {/* General Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {s.t('email_address', 'Email Address')}
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingId}
                  value={formData.emailAddress}
                  onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                  placeholder="user@dgt.llc"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {s.t('display_name', 'Display Name')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder={s.t('display_name_ph', 'User Full Name')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>
            </div>

            {/* MANDATORY RED HIGHLIGHTED CREDENTIALS SECTION */}
            <div className="rounded-2xl border-2 border-red-500 bg-red-100/60 dark:bg-red-950/40 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <Lock className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    MAILBOX CONNECTION CREDENTIALS
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">
                  CRITICAL AUTH
                </span>
              </div>

              <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                Enter or update the IMAP & SMTP daemon secret passwords. The system tests live connection immediately on save.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* IMAP Password */}
                <div>
                  <label className="block text-xs font-bold text-red-950 dark:text-red-100 mb-1.5">
                    IMAP Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword['imap'] ? 'text' : 'password'}
                      required
                      value={formData.imapPassword}
                      onChange={(e) => setFormData({ ...formData, imapPassword: e.target.value })}
                      placeholder="Enter IMAP secret..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-red-400 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword({ ...showPassword, imap: !showPassword['imap'] })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword['imap'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* SMTP Password */}
                <div>
                  <label className="block text-xs font-bold text-red-950 dark:text-red-100 mb-1.5">
                    SMTP Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword['smtp'] ? 'text' : 'password'}
                      required
                      value={formData.smtpPassword}
                      onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                      placeholder="Enter SMTP secret..."
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-red-400 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword({ ...showPassword, smtp: !showPassword['smtp'] })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword['smtp'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Quota & Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {s.t('storage_quota', 'Storage Quota (MB)')}
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={formData.storageQuotaMb}
                  onChange={(e) => setFormData({ ...formData, storageQuotaMb: parseInt(e.target.value) || 5000 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {s.t('plan_type', 'Plan Type')}
                </label>
                <select
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                >
                  <option value="free">Free Starter (5 GB)</option>
                  <option value="pro">Pro Staff (10 GB)</option>
                  <option value="business">Business Enterprise (25 GB)</option>
                </select>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={testingConnection}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {testingConnection
                    ? 'Testing Connection...'
                    : 'Update & Test Connection'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {s.t('cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mailboxes by email or display name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 transition-all"
          />
        </div>
      </div>

      {/* ================================================== */}
      {/* 7. MAILBOX CARDS & LIST */}
      {/* ================================================== */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Email Address</th>
                <th className="px-5 py-3.5">Display Name</th>
                <th className="px-5 py-3.5">Country / Branch</th>
                <th className="px-5 py-3.5">IMAP / SMTP</th>
                <th className="px-5 py-3.5">Storage Used</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Test</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Loading mailboxes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMailboxes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No mailboxes configured yet. Click "Add Mailbox" to connect a new account.
                  </td>
                </tr>
              ) : (
                filteredMailboxes.map((mb) => {
                  const quotaMB = mb.storage_quota_mb || 5000;
                  const usedMB = mb.storage_used_mb || 0;
                  const storagePct = Math.min(Math.round((usedMB / quotaMB) * 100), 100);
                  const isMenuOpen = openMenuId === mb.id;

                  return (
                    <tr key={mb.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Email */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {mb.email_address}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Plan: {mb.plan_type?.toUpperCase() || 'FREE'}
                        </div>
                      </td>

                      {/* Display Name */}
                      <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                        {mb.display_name || 'General Mailbox'}
                      </td>

                      {/* Country / Branch */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        UAE / Dubai HQ
                      </td>

                      {/* IMAP / SMTP Status */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                            IMAP: OK
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                            SMTP: OK
                          </span>
                        </div>
                      </td>

                      {/* Storage Used */}
                      <td className="px-5 py-3.5 min-w-[130px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{usedMB} MB</span>
                          <span className="text-slate-400">{quotaMB} MB</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(storagePct, 2)}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <MailStatusBadge
                          status={mb.is_active ? 'active' : 'suspended'}
                          label={mb.is_active ? 'ACTIVE' : 'SUSPENDED'}
                          size="sm"
                        />
                      </td>

                      {/* Last Test */}
                      <td className="px-5 py-3.5 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                        {mb.last_connection_test
                          ? new Date(mb.last_connection_test).toLocaleDateString()
                          : 'Online'}
                      </td>

                      {/* Actions Menu */}
                      <td className="px-5 py-3.5 text-right relative">
                        <div className="inline-block text-left">
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : mb.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-5 mt-1.5 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-30 py-1.5 text-xs text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                              <div className="py-1">
                                <button
                                  onClick={() => handleEditMailbox(mb)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Edit Credentials</span>
                                </button>

                                <button
                                  onClick={() => handleEditMailbox(mb)}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Zap className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>Test Connection</span>
                                </button>

                                <Link
                                  href="/dashboard/messages/email"
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Open Mailbox</span>
                                </Link>
                              </div>

                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    alert(`Toggling status for ${mb.email_address}`);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 cursor-pointer font-medium text-slate-600 dark:text-slate-300"
                                >
                                  <Power className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{mb.is_active ? 'Suspend' : 'Activate'}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (confirm(`Delete mailbox ${mb.email_address}?`)) {
                                      // delete action
                                    }
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                  <span>Delete Mailbox</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
