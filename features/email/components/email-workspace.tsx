'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Mail,
  Send,
  Inbox,
  Archive,
  Trash2,
  Star,
  Plus,
  ChevronDown,
  CheckSquare,
  Square,
  RotateCw,
  MoreHorizontal,
  Search,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  FileText,
  Download,
  Clock,
  Building2,
  Shield,
  User,
  X,
  CornerUpLeft,
  CheckCheck,
  SendHorizontal,
  FileSpreadsheet
} from 'lucide-react';
import { useErpScreen } from '@/lib/i18n/use-erp-screen';
import type { ErpSession } from '@/lib/auth/session';

export interface EmailWorkspaceProps {
  session?: ErpSession | null;
}

interface MailboxAccount {
  id: string;
  email: string;
  branchName: string;
  country: string;
  scope: 'super_admin' | 'country_admin' | 'city_branch';
}

interface EmailItem {
  id: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  date: string;
  fullDate: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'important' | 'trash';
  avatarInitials: string;
  avatarBg: string;
  body: string;
  attachments?: { name: string; size: string; type: 'pdf' | 'excel' | 'doc' }[];
}

const ALL_MAILBOXES: MailboxAccount[] = [
  { id: 'dubai', email: 'dubai@dgt.llc', branchName: 'Dubai Branch', country: 'United Arab Emirates', scope: 'city_branch' },
  { id: 'chaman', email: 'chaman@dgt.llc', branchName: 'Chaman Branch', country: 'Pakistan', scope: 'city_branch' },
  { id: 'quetta', email: 'quetta@dgt.llc', branchName: 'Quetta Branch', country: 'Pakistan', scope: 'city_branch' },
  { id: 'kandahar', email: 'kandahar@dgt.llc', branchName: 'Kandahar Branch', country: 'Afghanistan', scope: 'city_branch' },
  { id: 'dgtllc', email: 'dgtllc@dgt.llc', branchName: 'DGT Head Office', country: 'Global', scope: 'super_admin' }
];


export function EmailWorkspace({ session }: EmailWorkspaceProps) {
  const s = useErpScreen('email_system');

  // Role detection:
  // Super Admin: sees all mailboxes across all countries & branches
  // Country Admin: scoped to their specific country branches
  // City Branch: locked strictly to their assigned single branch
  const isSuperAdmin = session?.isSuperAdmin ?? true;
  const isCountryAdmin = !isSuperAdmin && (session?.roles?.some(r => r.includes('country')) ?? false);
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  // Filter allowed mailboxes based on role
  const availableMailboxes = useMemo(() => {
    if (isSuperAdmin) {
      return ALL_MAILBOXES;
    }
    if (isCountryAdmin) {
      return ALL_MAILBOXES.filter(m => m.country === 'Pakistan' || m.id === 'dgtllc');
    }
    // Branch user: strict single branch
    return ALL_MAILBOXES.filter(m => m.id === 'chaman');
  }, [isSuperAdmin, isCountryAdmin]);

  // Selected Mailbox state - default to Dubai
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('dubai');

  // Active folder tab
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'important' | 'trash'>('inbox');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Selected email messages (Real IMAP data only)
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Load real emails from IMAP when mailbox or folder changes
  const fetchRealEmails = useCallback(async () => {
    if (!selectedMailboxId) {
      setEmails([]);
      setSelectedEmailId(null);
      return;
    }

    try {
      setLoadingEmails(true);
      setEmailError(null);

      const mailbox = ALL_MAILBOXES.find(m => m.id === selectedMailboxId);
      if (!mailbox) {
        setEmails([]);
        setSelectedEmailId(null);
        return;
      }

      const response = await fetch(
        `/api/erp/email/${selectedMailboxId}/fetch?folder=${activeFolder}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 403) {
          setEmailError('Access denied to this mailbox');
        } else if (response.status === 400) {
          setEmailError('IMAP credentials not configured');
        } else {
          setEmailError(`Server error (${response.status})`);
        }
        setEmails([]);
        setSelectedEmailId(null);
        return;
      }

      const data = await response.json();

      if (!data.messages || !Array.isArray(data.messages)) {
        setEmails([]);
        setSelectedEmailId(null);
        return;
      }

      const transformed: EmailItem[] = data.messages.map((msg: any, idx: number) => {
        const fromEmail = msg.from || 'unknown@dgt.llc';
        const fromName = msg.fromName || fromEmail.split('@')[0] || 'Sender';
        const initials = (fromName.substring(0, 2) || 'EM').toUpperCase();

        const bgColors = [
          'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300',
          'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300',
          'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
          'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
          'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300',
          'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
        ];

        return {
          id: String(msg.id),
          senderName: fromName.charAt(0).toUpperCase() + fromName.slice(1),
          senderEmail: fromEmail,
          recipientEmail: msg.to || mailbox.email,
          subject: msg.subject || '(No Subject)',
          preview: msg.preview || (msg.body ? msg.body.substring(0, 100) : '') || '...',
          date: msg.date ? new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
          fullDate: msg.date ? new Date(msg.date).toLocaleString() : 'Recent',
          isRead: msg.isRead !== false,
          isStarred: msg.isStarred || false,
          hasAttachment: Boolean(msg.attachments && msg.attachments.length > 0),
          folder: activeFolder,
          avatarInitials: initials,
          avatarBg: bgColors[idx % bgColors.length],
          body: msg.body || msg.preview || '(Empty message body)',
          attachments: msg.attachments?.map((att: any) => ({
            name: att.name || 'attachment',
            size: att.size ? `${(att.size / 1024).toFixed(1)} KB` : '',
            type: att.type || 'file'
          }))
        };
      });

      setEmails(transformed);
      setSelectedEmailId(transformed[0]?.id || null);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setEmailError(err instanceof Error ? err.message : 'Failed to connect to mailbox');
      setEmails([]);
      setSelectedEmailId(null);
    } finally {
      setLoadingEmails(false);
    }
  }, [selectedMailboxId, activeFolder]);

  useEffect(() => {
    fetchRealEmails();
  }, [fetchRealEmails]);

  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeFrom, setComposeFrom] = useState('dubai@dgt.llc');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState(false);

  // Keep composeFrom in sync with selected mailbox
  useEffect(() => {
    const mb = ALL_MAILBOXES.find(m => m.id === selectedMailboxId);
    if (mb) setComposeFrom(mb.email);
  }, [selectedMailboxId]);

  // Inline Quick Reply state
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replyExpanded, setReplyExpanded] = useState(false);

  // Sync selected mailbox with available list
  useEffect(() => {
    if (!availableMailboxes.some(m => m.id === selectedMailboxId)) {
      setSelectedMailboxId(availableMailboxes[0]?.id || 'dubai');
    }
  }, [availableMailboxes, selectedMailboxId]);

  // Filtered emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const q = searchQuery.toLowerCase();
    return emails.filter(email =>
      email.senderName.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.preview.toLowerCase().includes(q) ||
      email.body.toLowerCase().includes(q)
    );
  }, [emails, searchQuery]);

  // Dynamic counts for header and folder badges
  const unreadCount = useMemo(() => emails.filter(e => !e.isRead).length, [emails]);
  const starredCount = useMemo(() => emails.filter(e => e.isStarred).length, [emails]);
  const attachmentCount = useMemo(() => emails.filter(e => e.hasAttachment).length, [emails]);

  // Active email object
  const activeEmail = useMemo(() => {
    if (!emails.length) return null;
    return emails.find(e => e.id === selectedEmailId) || filteredEmails[0] || null;
  }, [emails, selectedEmailId, filteredEmails]);


  // Toggle Star handler
  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev =>
      prev.map(item => (item.id === id ? { ...item, isStarred: !item.isStarred } : item))
    );
  };

  // Select all checkbox handler
  const handleSelectAll = () => {
    if (selectedEmailIds.length === filteredEmails.length) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(filteredEmails.map(e => e.id));
    }
  };

  // Toggle single item checkbox
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmailIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Send Compose Email
  // Send Compose Email via real API
  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/erp/email/${selectedMailboxId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          text: composeBody,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${composeBody.replace(/\n/g, '<br/>')}</div>`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send email');
      }

      setComposeSuccess(true);
      setTimeout(() => {
        setComposeSuccess(false);
        setShowCompose(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        fetchRealEmails();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Error sending email. Please check configuration.');
    } finally {
      setIsSending(false);
    }
  };

  // Send Inline Quick Reply via real API
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeEmail) return;
    setIsReplying(true);
    try {
      await fetch(`/api/erp/email/${selectedMailboxId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeEmail.senderEmail,
          subject: activeEmail.subject.startsWith('Re:') ? activeEmail.subject : `Re: ${activeEmail.subject}`,
          text: replyText,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${replyText.replace(/\n/g, '<br/>')}</div>`
        })
      });

      setReplyText('');
      setReplyExpanded(false);
      fetchRealEmails();
    } catch (err) {
      console.error('Quick reply error:', err);
    } finally {
      setIsReplying(false);
    }
  };

  const currentMailbox = ALL_MAILBOXES.find(m => m.id === selectedMailboxId) || ALL_MAILBOXES[0];

  return (
    <div dir={s.dir} className="bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-5 flex flex-col gap-4">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER SECTION & DYNAMIC METRICS BAR                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left Title & Branch Select */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {s.t('email_title', 'Email Workspace')}
              </h1>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
                  <Shield className="w-3 h-3 text-red-600" />
                  Super Admin
                </span>
              )}
              {isCountryAdmin && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                  <Building2 className="w-3 h-3 text-blue-600" />
                  Country Admin
                </span>
              )}
              {isBranchUser && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                  <User className="w-3 h-3 text-emerald-600" />
                  Branch Scope
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {s.t('email_subtitle', 'Live multi-branch business email accounts (Titan IMAP/SMTP)')}
            </p>
          </div>

          {/* Select Mailbox / Branch Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Mailbox:
            </label>
            <div className="relative">
              <select
                value={selectedMailboxId}
                onChange={e => setSelectedMailboxId(e.target.value)}
                disabled={isBranchUser}
                className="w-64 sm:w-72 pl-9 pr-8 py-2 text-xs md:text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs hover:border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer transition-all"
              >
                {availableMailboxes.map(mb => (
                  <option key={mb.id} value={mb.id}>
                    {mb.branchName} ({mb.email})
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Dynamic Metric Cards Row */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {/* Total */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-xs">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{emails.length}</div>
            <div className="text-[11px] font-medium text-slate-500">Total</div>
          </div>

          {/* Unread */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-xs flex flex-col items-center">
            <Mail className="w-4 h-4 text-red-500 mb-0.5" />
            <div className="text-xs font-bold text-red-600">Unread ({unreadCount})</div>
          </div>

          {/* Starred */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-xs">
            <div className="text-lg font-bold text-teal-600">{starredCount}</div>
            <div className="text-[11px] font-medium text-slate-500">Starred</div>
          </div>

          {/* Files / Attachments */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-xs">
            <div className="text-lg font-bold text-blue-600">{attachmentCount}</div>
            <div className="text-[11px] font-medium text-slate-500">Files</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN 3-COLUMN EMAIL WORKSPACE                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[700px]">
        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 1: NAVIGATION & MAILBOXES LIST (WIDTH: 260px)                    */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 p-4 flex flex-col gap-4 bg-slate-50/40 dark:bg-slate-900/50">
          {/* Prominent Compose Email Button */}
          <button
            onClick={() => setShowCompose(true)}
            className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-red-600/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{s.t('compose_email', '+ Compose Email')}</span>
          </button>

          {/* Folders List */}
          <div className="space-y-1">
            {/* Inbox */}
            <button
              onClick={() => setActiveFolder('inbox')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'inbox'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4" />
                <span>{s.t('inbox', 'Inbox')}</span>
              </div>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Sent */}
            <button
              onClick={() => setActiveFolder('sent')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'sent'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4" />
                <span>{s.t('sent', 'Sent')}</span>
              </div>
            </button>

            {/* Drafts */}
            <button
              onClick={() => setActiveFolder('drafts')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'drafts'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>{s.t('drafts', 'Drafts')}</span>
              </div>
            </button>

            {/* Starred */}
            <button
              onClick={() => setActiveFolder('starred')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'starred'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4 text-amber-500" />
                <span>{s.t('starred', 'Starred')}</span>
              </div>
              {starredCount > 0 && (
                <span className="text-amber-500 text-xs font-bold">{starredCount}</span>
              )}
            </button>

            {/* Archive */}
            <button
              onClick={() => setActiveFolder('archive')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'archive'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Archive className="w-4 h-4" />
                <span>{s.t('archive', 'Archive')}</span>
              </div>
            </button>

            {/* Important */}
            <button
              onClick={() => setActiveFolder('important')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'important'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-indigo-500" />
                <span>{s.t('important', 'Important')}</span>
              </div>
            </button>

            {/* Trash */}
            <button
              onClick={() => setActiveFolder('trash')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeFolder === 'trash'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4" />
                <span>{s.t('trash', 'Trash')}</span>
              </div>
            </button>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

          {/* Mailboxes Section (Role-Based Filtered) */}
          <div className="flex-1">
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 tracking-wider uppercase px-2 mb-2 flex items-center justify-between">
              <span>{s.t('mailboxes', 'Mailboxes')}</span>
              <span className="text-[10px] text-slate-400 lowercase">{availableMailboxes.length} active</span>
            </div>

            <div className="space-y-1">
              {availableMailboxes
                .map(mb => {
                  const isSelected = selectedMailboxId === mb.id;
                  return (
                    <button
                      key={mb.id}
                      onClick={() => setSelectedMailboxId(mb.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-900/50 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Mail className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                        <span className="truncate">{mb.email}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-red-500 ring-2 ring-red-200' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 2: EMAIL LIST PANEL (WIDTH: 360px - 400px)                       */}
        {/* ----------------------------------------------------------------------- */}
        <div className="w-full md:w-[380px] lg:w-[420px] border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 flex flex-col">
          {/* Toolbar */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/20 dark:bg-slate-900/20">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSelectAll}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                title={s.t('select_all', 'Select All')}
              >
                {selectedEmailIds.length > 0 && selectedEmailIds.length === filteredEmails.length ? (
                  <CheckSquare className="w-4 h-4 text-red-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => fetchRealEmails()}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                title={s.t('refresh', 'Refresh')}
              >
                <RotateCw className={`w-4 h-4 ${loadingEmails ? 'animate-spin text-red-600' : ''}`} />
              </button>
              <div className="relative">
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium">
                  <span>{s.t('more', 'More')}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Search Emails Input */}
            <div className="relative flex-1 max-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder={s.t('search_emails', 'Search emails...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-red-500/30"
              />
            </div>
          </div>

          {/* Scrollable Email List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingEmails ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <RotateCw className="w-6 h-6 mx-auto mb-2 text-red-600 animate-spin" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">{s.t('connecting_mail', 'Connecting to mail server...')}</p>
                <p className="text-[11px] text-slate-400 mt-1">Fetching live emails for {currentMailbox.email}</p>
              </div>
            ) : emailError ? (
              <div className="p-8 text-center text-xs flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600 mb-2">
                  <Mail className="w-5 h-5" />
                </div>
                <p className="font-bold text-red-600 dark:text-red-400">{emailError}</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                  Unable to load emails for {currentMailbox.email}.
                </p>
                <button
                  onClick={() => fetchRealEmails()}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{s.t('retry', 'Retry')}</span>
                </button>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {searchQuery.trim() ? 'No matching emails found' : 'No emails in this mailbox folder'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Folder is empty for {currentMailbox.email}
                </p>
              </div>
            ) : (
              filteredEmails.map(item => {
                const isSelected = activeEmail?.id === item.id;
                const isChecked = selectedEmailIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEmailId(item.id)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50/70 dark:bg-red-950/25 border-l-4 border-l-red-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={e => handleToggleSelect(item.id, e)}
                      className="pt-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Circular Avatar with Initials */}
                    <div
                      className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border ${item.avatarBg}`}
                    >
                      {item.avatarInitials}
                    </div>

                    {/* Middle Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${item.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white font-extrabold'}`}>
                          {item.senderName}
                        </span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">
                          {item.date}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mb-0.5">
                        {item.subject}
                      </div>

                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {item.preview}
                      </div>
                    </div>

                    {/* Right Attachment & Star */}
                    <div className="flex flex-col items-end gap-2 pt-0.5 flex-shrink-0">
                      {item.hasAttachment && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <button
                        onClick={e => handleToggleStar(item.id, e)}
                        className="text-slate-300 hover:text-amber-500 transition-colors"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            item.isStarred ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 3: EMAIL DETAIL / READING PANE                                  */}
        {/* ----------------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
          {activeEmail ? (
            <div className="flex-1 flex flex-col p-5 md:p-6">
              {/* Top Action Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReplyExpanded(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>{s.t('reply', 'Reply')}</span>
                  </button>
                  <button
                    onClick={() => setReplyExpanded(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    <span>{s.t('reply_all', 'Reply All')}</span>
                  </button>
                  <button
                    onClick={() => setShowCompose(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    <span>{s.t('forward', 'Forward')}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Archive className="w-3.5 h-3.5" />
                    <span>{s.t('archive', 'Archive')}</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>{s.t('delete', 'Delete')}</span>
                  </button>
                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Email Subject Heading with Star */}
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeEmail.subject}
                </h2>
                <button onClick={e => handleToggleStar(activeEmail.id, e)}>
                  <Star
                    className={`w-4 h-4 ${
                      activeEmail.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              </div>

              {/* Sender Details Header */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${activeEmail.avatarBg}`}
                  >
                    {activeEmail.avatarInitials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeEmail.senderName}
                      </span>
                      <span className="text-xs text-slate-400">
                        &lt;{activeEmail.senderEmail}&gt;
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      To: <span className="font-semibold text-slate-700 dark:text-slate-300">{activeEmail.recipientEmail}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium">
                    {activeEmail.fullDate}
                  </div>
                </div>
              </div>

              {/* Formatted Email Body */}
              <div className="prose dark:prose-invert text-xs md:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line mb-8 font-normal">
                {activeEmail.body}
              </div>

              {/* Attachments Section */}
              {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                <div className="mb-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {activeEmail.attachments.length} Attachments
                    </span>
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                      <Download className="w-3.5 h-3.5" />
                      <span>{s.t('download_all', 'Download All')}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {activeEmail.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                          {att.type === 'excel' ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {att.name}
                          </div>
                          <div className="text-[10px] text-slate-400">{att.size}</div>
                        </div>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline Quick Reply Box */}
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    AA
                  </div>
                  <div className="flex-1">
                    {!replyExpanded ? (
                      <div
                        onClick={() => setReplyExpanded(true)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 cursor-pointer hover:border-slate-300 transition-colors"
                      >
                        {s.t('click_to_reply', 'Click to reply or forward...')}
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                        <div className="text-xs text-slate-500 font-medium">
                          Replying to <span className="font-bold text-slate-700 dark:text-slate-300">{activeEmail.senderEmail}</span>
                        </div>
                        <textarea
                          rows={4}
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder={s.t('type_response', 'Type your response here...')}
                          className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500/20"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setReplyExpanded(false)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                          >
                            {s.t('cancel', 'Cancel')}
                          </button>
                          <button
                            onClick={handleSendReply}
                            disabled={isReplying || !replyText.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            <SendHorizontal className="w-3.5 h-3.5" />
                            <span>{isReplying ? s.t('sending', 'Sending...') : s.t('send_reply', 'Send Reply')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
              <Mail className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Select an email to view full conversation</p>
            </div>
          )}
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 4. COMPOSE NEW EMAIL MODAL                                                */}
      {/* ========================================================================= */}
      {showCompose && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  New Message — {currentMailbox.branchName}
                </h3>
              </div>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compose Form */}
            <form onSubmit={handleSendCompose} className="p-6 space-y-4 overflow-y-auto flex-1">
              {composeSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <CheckCheck className="w-4 h-4" />
                  Email sent successfully via {composeFrom}!
                </div>
              )}

              {/* From / Send As */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 w-12 text-right">From:</label>
                <select
                  value={composeFrom}
                  onChange={e => setComposeFrom(e.target.value)}
                  disabled={isBranchUser}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  {availableMailboxes
                    .filter(m => m.id !== 'all')
                    .map(mb => (
                      <option key={mb.id} value={mb.email}>
                        {mb.branchName} &lt;{mb.email}&gt;
                      </option>
                    ))}
                </select>
              </div>

              {/* To */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 w-12 text-right">To:</label>
                <input
                  type="email"
                  required
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-medium focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              {/* Subject */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 w-12 text-right">{s.t('subject', 'Subject')}:</label>
                <input
                  type="text"
                  required
                  placeholder={s.t('enter_subject', 'Enter email subject...')}
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-medium focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              {/* Body */}
              <div>
                <textarea
                  rows={8}
                  required
                  placeholder={s.t('write_message', 'Write your email message here...')}
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  className="w-full p-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 font-normal focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 dark:border-slate-700"
                  title={s.t('attach_file', 'Attach File')}
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                  >
                    {s.t('discard', 'Discard')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? s.t('sending', 'Sending...') : s.t('send_message', 'Send Message')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
