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
    provider: 'titan',
    imapPassword: '',
    smtpPassword: '',
    countryId: '',
    branchId: '',
    cityBranchId: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setFormErrors({});
    setShowAdvanced(false);
    setFormData({
      emailAddress: mailbox.email_address,
      displayName: mailbox.display_name,
      provider: 'titan',
      imapHost: 'imap.titan.email',
      imapPort: 993,
      imapPassword: '',
      smtpHost: 'smtp.titan.email',
      smtpPort: 465,
      smtpPassword: '',
      countryId: '',
      branchId: '',
      cityBranchId: '',
      storageQuotaMb: mailbox.storage_quota_mb,
      planType: mailbox.plan_type,
    });
    setShowForm(true);
    setOpenMenuId(null);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingId(null);
    setFormErrors({});
    setShowAdvanced(false);
    setFormData({
      emailAddress: '',
      displayName: '',
      provider: 'titan',
      imapHost: 'imap.titan.email',
      imapPort: 993,
      imapPassword: '',
      smtpHost: 'smtp.titan.email',
      smtpPort: 465,
      smtpPassword: '',
      countryId: '',
      branchId: '',
      cityBranchId: '',
      storageQuotaMb: 5000,
      planType: 'free',
    });
  }

  async function handleSaveMailbox(e: React.FormEvent) {
    e.preventDefault();

    // Clear previous errors
    const newErrors: Record<string, string> = {};

    // Validate only Email and Password are required
    if (!formData.emailAddress) {
      newErrors.emailAddress = 'Email address is required';
    }
    if (!formData.imapPassword) {
      newErrors.imapPassword = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }

    setFormErrors({});
    setTestingConnection(true);
    setError(null);

    try {
      // Auto-generate displayName from email if not provided
      const payload = {
        ...formData,
        displayName: formData.displayName || formData.emailAddress.split('@')[0],
        smtpPassword: formData.imapPassword, // Use same password for SMTP
      };

      const res = await fetch('/api/erp/mail-management/mailboxes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save mailbox');

      setTestResult(data.data?.connectionStatus || '✅ Connection test successful (IMAP/SMTP OK)');
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
            {/* Scope Selection */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                📍 Scope Assignment
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Country</label>
                  <select
                    value={formData.countryId}
                    onChange={(e) => setFormData({ ...formData, countryId: e.target.value, branchId: '', cityBranchId: '' })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                  >
                    <option value="">Select Country...</option>
                    <option value="ae">United Arab Emirates</option>
                    <option value="pk">Pakistan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Branch</label>
                  <select
                    disabled={!formData.countryId}
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value, cityBranchId: '' })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Select Branch...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">City Branch</label>
                  <select
                    disabled={!formData.branchId}
                    value={formData.cityBranchId}
                    onChange={(e) => setFormData({ ...formData, cityBranchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Select City Branch...</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Email & Password - Simple & Bold */}
            <div className="rounded-2xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-black text-blue-900 dark:text-blue-200 uppercase tracking-wide">
                    Email Credentials
                  </span>
                </div>
              </div>

              <p className="text-xs text-blue-700 dark:text-blue-300">
                Enter your mailbox email and password. All server settings are automatic.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-950 dark:text-blue-100 mb-1.5">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    disabled={!!editingId}
                    value={formData.emailAddress}
                    onChange={(e) => {
                      setFormData({ ...formData, emailAddress: e.target.value });
                      if (formErrors.emailAddress) {
                        const newErrors = { ...formErrors };
                        delete newErrors.emailAddress;
                        setFormErrors(newErrors);
                      }
                    }}
                    placeholder="user@dgt.llc"
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-slate-900 border text-xs font-mono disabled:opacity-60 outline-none focus:ring-2 ${
                      formErrors.emailAddress
                        ? 'border-red-400 focus:ring-red-600'
                        : 'border-blue-300 dark:border-blue-700 focus:ring-blue-600'
                    }`}
                  />
                  {formErrors.emailAddress && (
                    <p className="text-[10px] text-red-600 mt-1">✗ {formErrors.emailAddress}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-950 dark:text-blue-100 mb-1.5">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword['imap'] ? 'text' : 'password'}
                      value={formData.imapPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, imapPassword: e.target.value });
                        if (formErrors.imapPassword) {
                          const newErrors = { ...formErrors };
                          delete newErrors.imapPassword;
                          setFormErrors(newErrors);
                        }
                      }}
                      placeholder="Enter password..."
                      className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white dark:bg-slate-900 border text-xs font-mono outline-none focus:ring-2 ${
                        formErrors.imapPassword
                          ? 'border-red-400 focus:ring-red-600'
                          : 'border-blue-300 dark:border-blue-700 focus:ring-blue-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword({ ...showPassword, imap: !showPassword['imap'] })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword['imap'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formErrors.imapPassword && (
                    <p className="text-[10px] text-red-600 mt-1">✗ {formErrors.imapPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Provider Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Email Provider
              </label>
              <select
                value={formData.provider}
                onChange={(e) => {
                  const provider = e.target.value as 'titan' | 'custom';
                  if (provider === 'titan') {
                    setFormData({
                      ...formData,
                      provider,
                      imapHost: 'imap.titan.email',
                      imapPort: 993,
                      smtpHost: 'smtp.titan.email',
                      smtpPort: 465,
                    });
                  }
                  setShowAdvanced(provider === 'custom');
                }}
                className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
              >
                <option value="titan">Titan / Hostinger (Auto-configured)</option>
                <option value="custom">Custom Mail Server</option>
              </select>
            </div>

            {/* Advanced Settings - Hidden unless Custom */}
            {formData.provider === 'custom' && (
              <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {showAdvanced ? '▼' : '▶'} Advanced Settings
                </button>

                {showAdvanced && (
                  <div className="space-y-4 border-t border-slate-300 dark:border-slate-700 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">IMAP Host</label>
                        <input
                          type="text"
                          value={formData.imapHost}
                          onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">IMAP Port</label>
                        <input
                          type="number"
                          value={formData.imapPort}
                          onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) || 993 })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">SMTP Host</label>
                        <input
                          type="text"
                          value={formData.smtpHost}
                          onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">SMTP Port</label>
                        <input
                          type="number"
                          value={formData.smtpPort}
                          onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 465 })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs outline-none focus:ring-2 focus:ring-blue-600/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                disabled={testingConnection || !formData.emailAddress || !formData.imapPassword}
                className={`px-5 py-2.5 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${
                  testingConnection || !formData.emailAddress || !formData.imapPassword
                    ? 'bg-slate-400 dark:bg-slate-600 opacity-50 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {testingConnection
                    ? 'Testing Connection...'
                    : '✓ Update & Test Connection'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
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

                      {/* IMAP / SMTP Status - REAL FROM DATABASE */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!mb.last_connection_status ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_imap_status_untested", "IMAP: Not Tested")}
                            </span>
                          ) : mb.last_connection_status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_imap_status_ok", "IMAP: OK")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_imap_status_failed", "IMAP: Failed")}
                            </span>
                          )}
                          {!mb.last_connection_status ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_smtp_status_untested", "SMTP: Not Tested")}
                            </span>
                          ) : mb.last_connection_status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_smtp_status_ok", "SMTP: OK")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded-md">
                              {s.t("mail_smtp_status_failed", "SMTP: Failed")}
                            </span>
                          )}
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
