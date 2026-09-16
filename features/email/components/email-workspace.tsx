'use client';

import { useEffect, useState } from 'react';
import { Mail, Send, Inbox, Archive, Trash2, Star, Plus, ChevronDown } from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';

interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string;
  is_default: boolean;
  is_active: boolean;
}

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  preview: string;
  isRead: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archived' | 'starred';
}

export function EmailWorkspace() {
  const s = useErpScreen('email_workspace');
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'drafts' | 'trash' | 'archived' | 'starred'>('inbox');
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');

  // Load email accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/erp/email/accounts');
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || []);
          // Set default or first account
          const defaultAccount = data.accounts?.find((a: EmailAccount) => a.is_default);
          if (defaultAccount) {
            setSelectedAccountId(defaultAccount.id);
          } else if (data.accounts?.length > 0) {
            setSelectedAccountId(data.accounts[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load email accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Load messages for selected account and tab
  useEffect(() => {
    if (!selectedAccountId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/erp/email/${selectedAccountId}/fetch?folder=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        } else if (res.status === 403) {
          console.error('Access denied to this mailbox');
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    fetchMessages();
  }, [selectedAccountId, activeTab]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !composeTo) return;

    setComposeSending(true);
    setComposeError(null);

    try {
      const res = await fetch(`/api/erp/email/${selectedAccountId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          cc: composeCc || undefined,
          bcc: composeBcc || undefined
        })
      });

      if (res.ok) {
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setComposeCc('');
        setComposeBcc('');
        setShowCompose(false);
        // Refresh sent folder
        setActiveTab('sent');
      } else {
        const data = await res.json();
        setComposeError(data.error || s.t('send_failed', 'Failed to send email'));
      }
    } catch (error) {
      setComposeError(s.t('send_error', 'Network error'));
    } finally {
      setComposeSending(false);
    }
  };

  const tabs = [
    { id: 'inbox', label: s.t('inbox', 'Inbox'), icon: Inbox },
    { id: 'sent', label: s.t('sent', 'Sent'), icon: Send },
    { id: 'drafts', label: s.t('drafts', 'Drafts'), icon: Mail },
    { id: 'archived', label: s.t('archived', 'Archived'), icon: Archive },
    { id: 'trash', label: s.t('trash', 'Trash'), icon: Trash2 },
    { id: 'starred', label: s.t('starred', 'Starred'), icon: Star },
  ] as const;

  return (
    <div dir={s.dir} className="h-screen flex flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{s.t('title', 'Email')}</h1>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {s.t('compose', 'Compose')}
          </button>
        </div>

        {/* Mailbox Selector */}
        <div className="relative">
          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white appearance-none cursor-pointer"
          >
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.display_name} ({account.email_address})
                {account.is_default ? ' — Global / Super Admin' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-4 flex gap-2 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">
            {s.t('loading', 'Loading messages...')}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">
            {s.t('no_messages', 'No messages in this folder')}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {messages.map(msg => (
              <div
                key={msg.id}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer border-l-4 border-transparent hover:border-blue-600"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">{msg.from}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 truncate">{msg.subject}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-500 line-clamp-2">{msg.preview}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-xs text-slate-500">{msg.date}</div>
                    {!msg.isRead && (
                      <div className="mt-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{s.t('compose_new', 'Compose New Email')}</h2>
            {composeError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded">
                {composeError}
              </div>
            )}
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="text-sm font-medium">From:</label>
                <div className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                  {selectedAccount?.email_address}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">To:</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder={s.t('recipient', 'Recipient email')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  required
                  disabled={composeSending}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">CC:</label>
                <input
                  type="email"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder={s.t('cc', 'CC email (optional)')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  disabled={composeSending}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">BCC:</label>
                <input
                  type="email"
                  value={composeBcc}
                  onChange={(e) => setComposeBcc(e.target.value)}
                  placeholder={s.t('bcc', 'BCC email (optional)')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  disabled={composeSending}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Subject:</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder={s.t('subject', 'Email subject')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  required
                  disabled={composeSending}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Message:</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={s.t('message_body', 'Message body')}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                  required
                  disabled={composeSending}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                  disabled={composeSending}
                >
                  {s.t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={composeSending || !composeTo}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-slate-400"
                >
                  {composeSending ? s.t('sending', 'Sending...') : s.t('send', 'Send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
