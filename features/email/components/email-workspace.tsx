'use client';

import { useState, useMemo, useEffect } from 'react';
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
  count: number;
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
  { id: 'all', email: 'all@dgt.llc', branchName: 'All Branches (Consolidated)', country: 'Global', scope: 'super_admin', count: 125 },
  { id: 'chaman', email: 'chaman@dgt.llc', branchName: 'Chaman Branch', country: 'Pakistan', scope: 'city_branch', count: 18 },
  { id: 'quetta', email: 'quetta@dgt.llc', branchName: 'Quetta Branch', country: 'Pakistan', scope: 'city_branch', count: 12 },
  { id: 'dubai', email: 'dubai@dgt.llc', branchName: 'Dubai Branch', country: 'United Arab Emirates', scope: 'city_branch', count: 34 },
  { id: 'kandahar', email: 'kandahar@dgt.llc', branchName: 'Kandahar Branch', country: 'Afghanistan', scope: 'city_branch', count: 5 },
  { id: 'dgtllc', email: 'dgtllc@dgt.llc', branchName: 'DGT Head Office', country: 'Global', scope: 'super_admin', count: 56 }
];

const INITIAL_EMAILS: EmailItem[] = [
  {
    id: 'msg-1',
    senderName: 'John Doe',
    senderEmail: 'john@customer.com',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'Shipment Documents - Urgent',
    preview: 'Please find the attached BL and invoice for your reference...',
    date: '10:24 AM',
    fullDate: '10:24 AM Sep 16, 2026',
    isRead: false,
    isStarred: true,
    hasAttachment: true,
    folder: 'inbox',
    avatarInitials: 'JD',
    avatarBg: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300',
    body: `Dear Team,

Please find the attached BL and invoice for your reference.
Kindly confirm once you receive the documents.

Best regards,
John Doe
Global Trading Co.`,
    attachments: [
      { name: 'BL_123456.pdf', size: '245 KB', type: 'pdf' },
      { name: 'Invoice_7890.xlsx', size: '128 KB', type: 'excel' }
    ]
  },
  {
    id: 'msg-2',
    senderName: 'Sarah Connor',
    senderEmail: 'sarah@skynet-logistics.com',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'Re: Quotation Request',
    preview: 'Thank you for the updated quotation. We would like to proceed with...',
    date: '09:15 AM',
    fullDate: '09:15 AM Sep 16, 2026',
    isRead: true,
    isStarred: true,
    hasAttachment: false,
    folder: 'inbox',
    avatarInitials: 'SC',
    avatarBg: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300',
    body: `Hi Team,

Thank you for the updated quotation. We would like to proceed with the 4x 40ft HC containers from Jebel Ali to Karachi port.

Please advise the transit time and earliest booking schedule.

Regards,
Sarah Connor`,
  },
  {
    id: 'msg-3',
    senderName: 'Rahim Ahmad',
    senderEmail: 'rahim@ahmadbrothers.pk',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'Payment Confirmation',
    preview: 'We have received the payment. Thanks! Receipt will follow shortly.',
    date: 'Yesterday',
    fullDate: '04:45 PM Sep 15, 2026',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    folder: 'inbox',
    avatarInitials: 'RA',
    avatarBg: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    body: `Assalam-o-Alaikum,

We have received the payment for invoice #INV-2026-981.
The original cash roznamcha voucher and official stamped receipt will be sent via clearing agent.

Thank you,
Rahim Ahmad`,
  },
  {
    id: 'msg-4',
    senderName: 'Ahmed Khan',
    senderEmail: 'ahmed@karachitransit.com',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'New Order - Containers',
    preview: 'Please arrange the containers as discussed during our call yesterday...',
    date: 'Yesterday',
    fullDate: '02:10 PM Sep 15, 2026',
    isRead: true,
    isStarred: true,
    hasAttachment: true,
    folder: 'inbox',
    avatarInitials: 'AK',
    avatarBg: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    body: `Dear Management,

Please arrange the 2x refrigerated containers for Chaman border transit by tomorrow morning.
Drivers have been assigned and vehicle registration details are attached.

Thanks,
Ahmed Khan`,
    attachments: [
      { name: 'Vehicle_List_Chaman.pdf', size: '180 KB', type: 'pdf' }
    ]
  },
  {
    id: 'msg-5',
    senderName: 'Logistics Group',
    senderEmail: 'dispatch@dgt.llc',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'Vessel ETA Update',
    preview: 'The vessel ETA has been changed to September 18th due to weather...',
    date: 'Sep 14',
    fullDate: '11:30 AM Sep 14, 2026',
    isRead: true,
    isStarred: true,
    hasAttachment: true,
    folder: 'inbox',
    avatarInitials: 'LG',
    avatarBg: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
    body: `Team Alert,

The vessel MSC AURELIA carrying batch #PK-CHM-902 has updated ETA to September 18 at Karachi QICT port.
Please alert the customs clearing team in Quetta and Chaman accordingly.

Logistics Operations Desk`,
    attachments: [
      { name: 'Port_Schedule_QICT.pdf', size: '310 KB', type: 'pdf' }
    ]
  },
  {
    id: 'msg-6',
    senderName: 'Muhammad Tariq',
    senderEmail: 'tariq.customs@clearing.dgt.llc',
    recipientEmail: 'chaman@dgt.llc',
    subject: 'Customs Clearance',
    preview: 'Documents are approved. Release order is expected by 3 PM.',
    date: 'Sep 14',
    fullDate: '09:00 AM Sep 14, 2026',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    folder: 'inbox',
    avatarInitials: 'MT',
    avatarBg: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    body: `Respected Asmatullah Sahib,

Customs examination for transit GD #54109 is finished with zero objections.
Expected gate-out release by 3:00 PM today. Trucks will depart towards Chaman border tonight.

Muhammad Tariq
Clearing Incharge`,
  },
  {
    id: 'msg-7',
    senderName: 'Fatima Shipping',
    senderEmail: 'ops@fatimashipping.ae',
    recipientEmail: 'dubai@dgt.llc',
    subject: 'Container Release',
    preview: 'Container has been released from port. Delivery order issued.',
    date: 'Sep 13',
    fullDate: '03:15 PM Sep 13, 2026',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    folder: 'inbox',
    avatarInitials: 'FS',
    avatarBg: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300',
    body: `Hello Dubai Branch,

Please find confirmation that delivery orders for 5x units under BL #DGT-AE-8834 are approved at Jebel Ali Gate 4.

Warm regards,
Fatima Shipping Agency`,
  },
  {
    id: 'msg-8',
    senderName: 'Zahir Zaman',
    senderEmail: 'zahir@kandahar-traders.af',
    recipientEmail: 'kandahar@dgt.llc',
    subject: 'Meeting Schedule',
    preview: 'Can we schedule a meeting next week to discuss seasonal fruit export contracts?',
    date: 'Sep 13',
    fullDate: '11:10 AM Sep 13, 2026',
    isRead: true,
    isStarred: false,
    hasAttachment: false,
    folder: 'inbox',
    avatarInitials: 'ZZ',
    avatarBg: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
    body: `Dear Kandahar Branch Team,

We would like to meet next Tuesday at our office to finalize the export transport contracts for fresh pomegranate shipments.

Please confirm availability.

Zahir Zaman`,
  }
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
      // Filter by session country or demo Pakistan / UAE
      return ALL_MAILBOXES.filter(m => m.id !== 'all' && (m.country === 'Pakistan' || m.id === 'dgtllc'));
    }
    // Branch user: strict single branch
    return ALL_MAILBOXES.filter(m => m.id === 'chaman');
  }, [isSuperAdmin, isCountryAdmin]);

  // Selected Mailbox state
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('chaman');

  // Active folder tab
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'important' | 'trash'>('inbox');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Selected email messages
  const [emails, setEmails] = useState<EmailItem[]>(INITIAL_EMAILS);
  const [selectedEmailId, setSelectedEmailId] = useState<string>('msg-1');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);

  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeFrom, setComposeFrom] = useState('chaman@dgt.llc');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState(false);

  // Inline Quick Reply state
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [replyExpanded, setReplyExpanded] = useState(false);

  // Sync selected mailbox with available list
  useEffect(() => {
    if (!availableMailboxes.some(m => m.id === selectedMailboxId)) {
      setSelectedMailboxId(availableMailboxes[0]?.id || 'chaman');
    }
  }, [availableMailboxes, selectedMailboxId]);

  // Filtered emails based on Mailbox, Folder & Search
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // Mailbox filter (if not 'all')
      if (selectedMailboxId !== 'all') {
        const mb = ALL_MAILBOXES.find(m => m.id === selectedMailboxId);
        if (mb && email.recipientEmail !== mb.email && !email.senderEmail.includes(mb.id)) {
          // Allow message if recipient or sender matches mailbox
          if (email.recipientEmail !== mb.email) return false;
        }
      }

      // Folder filter
      if (activeFolder === 'starred') {
        if (!email.isStarred) return false;
      } else if (email.folder !== activeFolder && activeFolder !== 'inbox') {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          email.senderName.toLowerCase().includes(q) ||
          email.subject.toLowerCase().includes(q) ||
          email.preview.toLowerCase().includes(q) ||
          email.body.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [emails, selectedMailboxId, activeFolder, searchQuery]);

  // Active email object
  const activeEmail = useMemo(() => {
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
  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject) return;

    setIsSending(true);
    try {
      // Simulate real send + append to state
      await new Promise(r => setTimeout(r, 600));

      const newEmail: EmailItem = {
        id: `msg-${Date.now()}`,
        senderName: session?.fullName || 'Asmatullah (Super Admin)',
        senderEmail: composeFrom,
        recipientEmail: composeTo,
        subject: composeSubject,
        preview: composeBody.slice(0, 80) + '...',
        date: 'Just now',
        fullDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
        isRead: true,
        isStarred: false,
        hasAttachment: false,
        folder: 'sent',
        avatarInitials: 'AA',
        avatarBg: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
        body: composeBody
      };

      setEmails(prev => [newEmail, ...prev]);
      setComposeSuccess(true);
      setTimeout(() => {
        setComposeSuccess(false);
        setShowCompose(false);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
      }, 1000);
    } catch {
      // Handle error
    } finally {
      setIsSending(false);
    }
  };

  // Send Inline Quick Reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !activeEmail) return;
    setIsReplying(true);
    await new Promise(r => setTimeout(r, 500));

    const replyEmail: EmailItem = {
      id: `msg-${Date.now()}`,
      senderName: session?.fullName || 'Asmatullah (Super Admin)',
      senderEmail: activeEmail.recipientEmail,
      recipientEmail: activeEmail.senderEmail,
      subject: `Re: ${activeEmail.subject.replace(/^Re:\s*/i, '')}`,
      preview: replyText.slice(0, 80) + '...',
      date: 'Just now',
      fullDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
      isRead: true,
      isStarred: false,
      hasAttachment: false,
      folder: 'sent',
      avatarInitials: 'AA',
      avatarBg: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
      body: replyText
    };

    setEmails(prev => [replyEmail, ...prev]);
    setReplyText('');
    setReplyExpanded(false);
    setIsReplying(false);
  };

  const currentMailbox = ALL_MAILBOXES.find(m => m.id === selectedMailboxId) || ALL_MAILBOXES[1];

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 flex flex-col gap-5">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER SECTION & METRICS BAR                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Left Title & Branch Select */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {s.t('email_title', 'Email')}
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
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {s.t('email_subtitle', 'Manage your business emails across all branches')}
            </p>
          </div>

          {/* Select Mailbox / Branch Dropdown with Red Pointer Badge */}
          <div className="relative">
            {/* Red Tooltip / Pointer Badge */}
            <div className="absolute -top-3.5 left-6 z-10 flex flex-col items-center pointer-events-none">
              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm tracking-wide animate-pulse">
                Select Branch Email
              </span>
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-red-600"></div>
            </div>

            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Select Mailbox / Branch
            </label>

            <div className="relative">
              <select
                value={selectedMailboxId}
                onChange={e => setSelectedMailboxId(e.target.value)}
                disabled={isBranchUser}
                className="w-72 md:w-80 pl-9 pr-8 py-2 text-xs md:text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white shadow-sm hover:border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer transition-all"
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

        {/* Metric Cards Row */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {/* Total */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-sm">
            <div className="text-lg font-bold text-slate-900 dark:text-white">125</div>
            <div className="text-[11px] font-medium text-slate-500">Total</div>
          </div>

          {/* Unread */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-sm flex flex-col items-center">
            <Mail className="w-4 h-4 text-red-500 mb-0.5" />
            <div className="text-xs font-bold text-red-600">Unread (18)</div>
          </div>

          {/* Sent */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-sm">
            <div className="text-lg font-bold text-emerald-600">92</div>
            <div className="text-[11px] font-medium text-slate-500">Sent</div>
          </div>

          {/* Starred */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[70px] shadow-sm">
            <div className="text-lg font-bold text-teal-600">74</div>
            <div className="text-[11px] font-medium text-slate-500">Starred</div>
          </div>

          {/* Replied */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2 text-center min-w-[70px] shadow-sm flex flex-col items-center">
            <CornerUpLeft className="w-4 h-4 text-blue-500 mb-0.5" />
            <div className="text-[11px] font-medium text-slate-500">Replied</div>
          </div>

          {/* Pending */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2 text-center min-w-[70px] shadow-sm flex flex-col items-center">
            <Clock className="w-4 h-4 text-amber-500 mb-0.5" />
            <div className="text-[11px] font-medium text-slate-500">Pending</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN 3-COLUMN EMAIL WORKSPACE                                          */}
      {/* ========================================================================= */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[700px]">
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
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                18
              </span>
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
              <span className="text-slate-400 text-xs">92</span>
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
              <span className="text-slate-400 text-xs">5</span>
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
              <span className="text-slate-400 text-xs">12</span>
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
              <span className="text-slate-400 text-xs">38</span>
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
              <span className="text-slate-400 text-xs">7</span>
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
              <span className="text-slate-400 text-xs">3</span>
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
                .filter(m => m.id !== 'all')
                .map(mb => {
                  const isSelected = selectedMailboxId === mb.id;
                  return (
                    <button
                      key={mb.id}
                      onClick={() => setSelectedMailboxId(mb.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-900/50 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Mail className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-red-600' : 'text-slate-400'}`} />
                        <span className="truncate">{mb.email}</span>
                      </div>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-red-500 text-white' : 'text-slate-400'}`}>
                        {mb.count}
                      </span>
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
                title="Select All"
              >
                {selectedEmailIds.length > 0 && selectedEmailIds.length === filteredEmails.length ? (
                  <CheckSquare className="w-4 h-4 text-red-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => {}}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                title="Refresh"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="relative">
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium">
                  <span>More</span>
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
            {filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{s.t('no_emails_found', 'No emails in this mailbox folder')}</p>
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
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => setReplyExpanded(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    <span>Reply All</span>
                  </button>
                  <button
                    onClick={() => setShowCompose(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete</span>
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
                      <span>Download All</span>
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
                        Click to reply or forward...
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
                          placeholder="Type your response here..."
                          className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500/20"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setReplyExpanded(false)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSendReply}
                            disabled={isReplying || !replyText.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            <SendHorizontal className="w-3.5 h-3.5" />
                            <span>{isReplying ? 'Sending...' : 'Send Reply'}</span>
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
      {/* 3. BOTTOM RED BANNER (EXACTLY AS IN MOCKUP)                              */}
      {/* ========================================================================= */}
      <div className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white py-3 px-6 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center text-xs md:text-sm font-bold tracking-wide">
        <span>Modern ERP Email System for All Branches</span>
        <span className="hidden sm:inline opacity-60">|</span>
        <span>Multi-Language</span>
        <span className="hidden sm:inline opacity-60">|</span>
        <span>Role-Based Access</span>
        <span className="hidden sm:inline opacity-60">|</span>
        <span>Professional Design</span>
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
                <label className="text-xs font-bold text-slate-500 w-12 text-right">Subject:</label>
                <input
                  type="text"
                  required
                  placeholder="Enter email subject..."
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
                  placeholder="Write your email message here..."
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
                  title="Attach File"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Sending...' : 'Send Message'}</span>
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
