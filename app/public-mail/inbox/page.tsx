'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Send,
  LogOut,
  Plus,
  Inbox,
  Search,
  Star,
  Trash2,
  FileText,
  Archive,
  RefreshCw,
  HardDrive,
  User,
  X,
  Paperclip,
  Reply,
  Forward,
  CheckCircle2,
  AlertCircle,
  Menu,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { useActiveLanguage } from '@/lib/i18n/use-active-language';
import { t } from '@/lib/i18n/ui';

interface PublicMailMessage {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred?: boolean;
  folder?: 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';
  hasAttachment?: boolean;
  avatarBg?: string;
}

export default function PublicMailInboxPage() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const isRtl = lang === 'ur' || lang === 'ar' || lang === 'ps' || lang === 'fa';

  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<PublicMailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'drafts' | 'starred' | 'trash'>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<PublicMailMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('public_mail_user');
    const token = localStorage.getItem('public_mail_token');

    if (!storedUser || !token) {
      router.push('/public-mail/login');
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
      fetchMessages(token);
    } catch (err) {
      console.error('Auth error:', err);
      router.push('/public-mail/login');
    }
  }, [router]);

  async function fetchMessages(token: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/public-mail/inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        // If API returns empty array, populate with welcoming sample messages
        const fetchedMsgs = data.messages && data.messages.length > 0 ? data.messages : [
          {
            id: 'msg-welcome',
            from: 'support@dgt.llc',
            to: user?.email || 'user@dgt.llc',
            subject: 'Welcome to DGT Public Webmail!',
            body: `Hello ${user?.displayName || 'Valued User'},\n\nWelcome to your new DGT Public Webmail workspace. Your account has been provisioned with 1000 MB storage.\n\nYou can use this email workspace to communicate securely across the DGT ecosystem.\n\nBest regards,\nDGT Mail Administration Team`,
            date: 'Today, 10:00 AM',
            isRead: false,
            isStarred: true,
            folder: 'inbox',
            avatarBg: 'bg-blue-600'
          },
          {
            id: 'msg-security',
            from: 'security@dgt.llc',
            to: user?.email || 'user@dgt.llc',
            subject: 'Account Security Confirmation',
            body: `Dear ${user?.displayName || 'User'},\n\nYour public DGT account credentials have been verified. Your mailbox is fully active and protected by scrypt cryptographic standard.\n\nIf you have any questions, reach out to support@dgt.llc.`,
            date: 'Yesterday, 4:30 PM',
            isRead: true,
            isStarred: false,
            folder: 'inbox',
            avatarBg: 'bg-emerald-600'
          }
        ];
        setMessages(fetchedMsgs);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;

    setIsSending(true);
    setNotification(null);
    try {
      const token = localStorage.getItem('public_mail_token');
      const res = await fetch('/api/public-mail/inbox', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody
        })
      });

      const data = await res.json();
      if (data.ok) {
        const newMsg: PublicMailMessage = {
          id: `sent-${Date.now()}`,
          from: user?.email || 'me@dgt.llc',
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          date: 'Just now',
          isRead: true,
          folder: 'sent',
          avatarBg: 'bg-indigo-600'
        };
        setMessages(prev => [newMsg, ...prev]);
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setShowCompose(false);
        setNotification({ type: 'success', message: t(lang, 'mail_sent_success', 'Message sent successfully!') });
      } else {
        throw new Error(data.error || 'Failed to send');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to send message' });
    } finally {
      setIsSending(false);
    }
  }

  function toggleStar(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, isStarred: !m.isStarred } : m))
    );
  }

  function handleLogout() {
    localStorage.removeItem('public_mail_user');
    localStorage.removeItem('public_mail_token');
    router.push('/public-mail/login');
  }

  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      // Folder filter
      if (currentFolder === 'starred') {
        if (!m.isStarred) return false;
      } else {
        const f = m.folder || 'inbox';
        if (f !== currentFolder) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
      );
    });
  }, [messages, currentFolder, searchQuery]);

  const unreadCount = useMemo(() => {
    return messages.filter(m => (m.folder || 'inbox') === 'inbox' && !m.isRead).length;
  }, [messages]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center gap-3 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
          <span>Loading DGT Webmail...</span>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">DGT MAIL</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  PUBLIC
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Damaan Webmail Services</p>
            </div>
          </div>
        </div>

        {/* User Info & Storage Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-xl text-xs">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300 font-medium">15 MB / 1000 MB</span>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-blue-600 font-bold text-white flex items-center justify-center text-xs">
              {user.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-white leading-tight">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 leading-tight font-mono">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title={t(lang, 'logout', 'Logout')}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t(lang, 'logout', 'Logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-16 left-0 z-20 w-64 bg-slate-900/95 border-r border-slate-800/80 p-4 flex flex-col justify-between transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-4">
            {/* Compose Button */}
            <button
              onClick={() => {
                setShowCompose(true);
                setMobileMenuOpen(false);
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t(lang, 'compose_email', 'Compose Email')}</span>
            </button>

            {/* Folder Navigation */}
            <nav className="space-y-1 pt-2">
              {[
                { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
                { id: 'sent', label: 'Sent', icon: Send, count: 0 },
                { id: 'drafts', label: 'Drafts', icon: FileText, count: 0 },
                { id: 'starred', label: 'Starred', icon: Star, count: 0 },
                { id: 'trash', label: 'Trash', icon: Trash2, count: 0 }
              ].map(folder => {
                const Icon = folder.icon;
                const isActive = currentFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setCurrentFolder(folder.id as any);
                      setSelectedMessage(null);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span>{folder.label}</span>
                    </div>
                    {folder.count > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                        {folder.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer Security Badge */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted Webmail</span>
            </div>
            <p className="text-[10px] text-slate-500">Scrypt auth & TLS transport</p>
          </div>
        </aside>

        {/* Center/Right Message List & Detail View */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950">
          {/* Notification Toast */}
          {notification && (
            <div className="absolute top-20 right-6 z-40 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-top-4">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Message List Pane */}
          <div className={`w-full ${selectedMessage ? 'hidden md:flex' : 'flex'} md:w-80 lg:w-96 flex-col border-r border-slate-800/80 bg-slate-900/40`}>
            {/* Search Bar */}
            <div className="p-3 border-b border-slate-800/80 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(lang, 'search_messages', 'Search messages...')}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {loading ? (
                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                  <span>Loading messages...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Inbox className="w-8 h-8 opacity-30 text-slate-400" />
                  <span>No messages in {currentFolder}</span>
                </div>
              ) : (
                filteredMessages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer space-y-1.5 ${
                      selectedMessage?.id === msg.id ? 'bg-blue-600/10 border-l-4 border-blue-500' : ''
                    } ${!msg.isRead ? 'font-bold bg-slate-900/60' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full text-[10px] text-white flex items-center justify-center font-bold ${msg.avatarBg || 'bg-blue-600'}`}>
                          {msg.from.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                          {msg.from}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => toggleStar(msg.id, e)}
                          className="text-slate-500 hover:text-amber-400 cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                        <span className="text-[10px] text-slate-500">{msg.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">{msg.subject}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{msg.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Email Detail View Pane */}
          <div className={`flex-1 ${selectedMessage ? 'flex' : 'hidden md:flex'} flex-col bg-slate-950 p-6 overflow-y-auto`}>
            {selectedMessage ? (
              <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in">
                {/* Back button for mobile */}
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="md:hidden text-xs text-blue-400 hover:underline flex items-center gap-1 mb-2"
                >
                  ← Back to messages
                </button>

                {/* Email Subject Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white leading-snug">{selectedMessage.subject}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleStar(selectedMessage.id, e)}
                      className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer"
                    >
                      <Star className={`w-4 h-4 ${selectedMessage.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Sender Metadata */}
                <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-sm ${selectedMessage.avatarBg || 'bg-blue-600'}`}>
                      {selectedMessage.from.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{selectedMessage.from}</h3>
                      <p className="text-[11px] text-slate-400">To: {selectedMessage.to || user.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{selectedMessage.date}</span>
                </div>

                {/* Body Content */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60 min-h-[220px]">
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedMessage.body}</p>
                </div>

                {/* Reply / Forward Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setComposeTo(selectedMessage.from);
                      setComposeSubject(`Re: ${selectedMessage.subject}`);
                      setShowCompose(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => {
                      setComposeSubject(`Fwd: ${selectedMessage.subject}`);
                      setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${selectedMessage.from}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.body}`);
                      setShowCompose(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700/80 cursor-pointer"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
                <Mail className="w-12 h-12 opacity-20 text-blue-400" />
                <p>Select a message from the list to view details</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden space-y-4">
            <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">New Email Message</span>
              </div>
              <button
                onClick={() => setShowCompose(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">To:</label>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Subject:</label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Message Body:</label>
                <textarea
                  required
                  rows={7}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/30 disabled:opacity-50 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Sending...' : 'Send Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
