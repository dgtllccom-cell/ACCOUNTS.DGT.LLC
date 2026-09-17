'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, EyeOff, RotateCcw, CheckCircle, AlertCircle, Trash2, Lock } from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';

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

  useEffect(() => {
    fetchMailboxes();
  }, []);

  async function fetchMailboxes() {
    try {
      const res = await fetch('/api/erp/mail-management/mailboxes', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch mailboxes');
      const data = await res.json();
      setMailboxes(data.data?.mailboxes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
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

      setTestResult(data.data?.connectionStatus);
      handleCloseForm();
      await fetchMailboxes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTestingConnection(false);
    }
  }

  return (
    <div dir={s.dir} className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{s.t('title', 'DGT Mail Management')}</h1>
          <p className="text-sm text-slate-500">{s.t('subtitle', 'Secure mailbox administration')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          {s.t('add_mailbox', 'Add Mailbox')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {testResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {s.t('connection_test_passed', 'Connection test passed')}
        </div>
      )}

      {showForm && (
        <div className="border rounded-lg p-6 bg-slate-50">
          <h2 className="text-lg font-bold mb-4">
            {editingId ? s.t('edit_mailbox', 'Edit Mailbox Credentials') : s.t('add_mailbox', 'Add Mailbox')}
          </h2>
          <form onSubmit={handleSaveMailbox} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('email_address', 'Email Address')}
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingId}
                  value={formData.emailAddress}
                  onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                  placeholder="user@dgt.llc"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('display_name', 'Display Name')}
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder={s.t('display_name_ph', 'User Name')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  <Lock className="w-3 h-3 inline mr-1" />
                  {s.t('imap_password', 'IMAP Password')}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword['imap'] ? 'text' : 'password'}
                    required
                    value={formData.imapPassword}
                    onChange={(e) => setFormData({ ...formData, imapPassword: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, imap: !showPassword['imap'] })}
                    className="p-2 hover:bg-slate-200 rounded"
                  >
                    {showPassword['imap'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  <Lock className="w-3 h-3 inline mr-1" />
                  {s.t('smtp_password', 'SMTP Password')}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword['smtp'] ? 'text' : 'password'}
                    required
                    value={formData.smtpPassword}
                    onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword({ ...showPassword, smtp: !showPassword['smtp'] })}
                    className="p-2 hover:bg-slate-200 rounded"
                  >
                    {showPassword['smtp'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('storage_quota', 'Storage Quota (MB)')}
                </label>
                <input
                  type="number"
                  value={formData.storageQuotaMb}
                  onChange={(e) => setFormData({ ...formData, storageQuotaMb: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  {s.t('plan_type', 'Plan Type')}
                </label>
                <select
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="free">{s.t('plan_free', 'Free')}</option>
                  <option value="pro">{s.t('plan_pro', 'Pro')}</option>
                  <option value="business">{s.t('plan_business', 'Business')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={testingConnection}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {testingConnection ? 'Testing...' : (editingId ? 'Update & Test Connection' : 'Save & Test Connection')}
              </button>
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
              >
                {s.t('cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">{s.t('loading', 'Loading mailboxes...')}</div>
      ) : (
        <div className="grid gap-4">
          {mailboxes.map((mb) => (
            <div key={mb.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{mb.email_address}</h3>
                  <p className="text-sm text-slate-500">{mb.display_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1">
                      {mb.last_connection_status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      {mb.last_connection_status}
                    </span>
                    <span>{mb.storage_used_mb}/{mb.storage_quota_mb} MB</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                      {mb.plan_type}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditMailbox(mb)}
                    title={s.t('edit_credentials', 'Edit credentials')}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${mb.email_address}?`)) {
                        // TODO: Add delete handler
                      }
                    }}
                    title={s.t('delete', 'Delete')}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
