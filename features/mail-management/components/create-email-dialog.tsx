'use client';

import { useState } from 'react';
import { Lock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';

interface CreateEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (emailAddress: string, mailboxId: string) => void;
  suggestedEmail?: string;
  branchId?: string;
  userId?: string;
}

export function CreateEmailDialog({
  isOpen,
  onClose,
  onComplete,
  suggestedEmail = '',
  branchId,
  userId,
}: CreateEmailDialogProps) {
  const s = useErpScreen('mail_management');
  const [emailAddress, setEmailAddress] = useState(suggestedEmail);
  const [displayName, setDisplayName] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/erp/mail-management/auto-provision', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAddress,
          displayName,
          imapPassword,
          smtpPassword,
          branchId,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create email');

      setResult({ type: 'success', message: 'Email created and tested successfully!' });
      setTimeout(() => {
        onComplete(emailAddress, data.data?.mailbox?.id);
        onClose();
        setEmailAddress('');
        setDisplayName('');
        setImapPassword('');
        setSmtpPassword('');
      }, 1500);
    } catch (err: any) {
      setResult({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{s.t('create_email', 'Create DGT Email Account')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            result.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
          }`}>
            {result.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {result.message}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{s.t('email_address', 'Email Address')}</label>
            <input
              type="email"
              required
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="branch@dgt.llc"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">{s.t('display_name', 'Display Name')}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={s.t('display_name_ph', 'Display Name')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {s.t('imap_password', 'IMAP Password')}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={imapPassword}
              onChange={(e) => setImapPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {s.t('smtp_password', 'SMTP Password')}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded"
            />
            {s.t('show_passwords', 'Show passwords')}
          </label>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {loading ? 'Creating...' : 'Create & Test'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-400"
            >
              {s.t('cancel', 'Cancel')}
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
          {s.t('email_will_be_tested', 'Email will be tested for IMAP & SMTP before saving')}
        </p>
      </div>
    </div>
  );
}
