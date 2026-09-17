'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, LogOut, Plus, Inbox } from 'lucide-react';
import { useActiveLanguage } from '@/lib/i18n/use-active-language';
import { t } from '@/lib/i18n/ui';

interface Message {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
}

export default function PublicMailInboxPage() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // Check if user is logged in
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
    try {
      const res = await fetch('/api/public-mail/inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages || []);
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
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setShowCompose(false);
        // Refresh messages
        const token = localStorage.getItem('public_mail_token');
        if (token) fetchMessages(token);
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('public_mail_user');
    localStorage.removeItem('public_mail_token');
    router.push('/public-mail/login');
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">{user.displayName}</h1>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title={t(lang, 'logout', 'Logout')}
          >
            <LogOut className="w-4 h-4" />
            <span>{t(lang, 'logout', 'Logout')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Toolbar */}
          <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
            <button
              onClick={() => setShowCompose(!showCompose)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t(lang, 'compose', 'Compose')}</span>
            </button>
          </div>

          {/* Compose Form */}
          {showCompose && (
            <div className="border-b p-6 bg-slate-50">
              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t(lang, 'to', 'To:')}
                  </label>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t(lang, 'subject', 'Subject:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder={t(lang, 'email_subject', 'Email subject')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t(lang, 'message', 'Message:')}
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={t(lang, 'write_message', 'Write your message...')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    {t(lang, 'cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSending ? t(lang, 'sending', 'Sending...') : t(lang, 'send', 'Send')}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Messages List */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-block">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{t(lang, 'loading_messages', 'Loading messages...')}</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-block">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{t(lang, 'inbox_empty', 'Your inbox is empty')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-4 border rounded-lg hover:bg-slate-50 transition cursor-pointer">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{msg.from}</h3>
                        <p className="text-gray-700">{msg.subject}</p>
                        <p className="text-sm text-gray-500 mt-1">{msg.body.substring(0, 100)}...</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{msg.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
