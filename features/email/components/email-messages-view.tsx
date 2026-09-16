'use client';

import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

interface EmailMessage {
  id: string;
  mailbox: string;
  from: string;
  subject: string;
  date: string;
  preview: string;
  isRead: boolean;
}

export function EmailMessagesView() {
  const s = useErpScreen("email_messages");
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMailbox, setSelectedMailbox] = useState("all");

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/erp/messages?type=email");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [selectedMailbox]);

  return (
    <section dir={s.dir} className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-blue-600" />
        <h1 className="text-3xl font-bold">{s.t("title", "Email Messages")}</h1>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-600">{s.t("loading", "Loading messages...")}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">{s.t("empty", "No messages found")}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className={`px-4 py-3 text-sm font-semibold text-${s.textStart}`}>{s.t("col_from", "From")}</th>
                <th className={`px-4 py-3 text-sm font-semibold text-${s.textStart}`}>{s.t("col_subject", "Subject")}</th>
                <th className={`px-4 py-3 text-sm font-semibold text-${s.textStart}`}>{s.t("col_date", "Date")}</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg.id} className="border-b hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm">{msg.from}</td>
                  <td className="px-4 py-3 text-sm">{msg.subject}</td>
                  <td className="px-4 py-3 text-sm">{msg.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
