"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Mail,
  Megaphone,
  MessageCircle,
  Send,
  Settings,
  Users
} from "lucide-react";

type DashboardData = {
  sender?: {
    officeName?: string;
    fromName?: string;
    fromEmail?: string | null;
    whatsappNumber?: string | null;
    displayBranchName?: string;
    signatureText?: string;
    countryName?: string;
  };
  metrics?: Record<string, number>;
  recentMessages?: Array<Record<string, any>>;
};

type Props = {
  session: any;
};

const tabs = [
  { key: "activity", label: "Inbox & Activity", icon: Mail },
  { key: "crm", label: "CRM Leads", icon: Users },
  { key: "followups", label: "Follow-ups", icon: CalendarDays },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings }
];

function metricCards(metrics: Record<string, number> = {}) {
  return [
    { label: "Emails Sent", value: metrics.emailsSent ?? 0, icon: Mail, tone: "blue" },
    { label: "WhatsApp Sent", value: metrics.whatsappsSent ?? 0, icon: MessageCircle, tone: "green" },
    { label: "Open Leads", value: metrics.openLeads ?? 0, icon: Users, tone: "violet" },
    { label: "Due Follow-ups", value: metrics.dueFollowups ?? 0, icon: Clock, tone: "amber" },
    { label: "Campaigns", value: metrics.campaigns ?? 0, icon: Megaphone, tone: "cyan" },
    { label: "Failed Messages", value: metrics.failedMessages ?? 0, icon: AlertTriangle, tone: "red" }
  ];
}

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100"
  };
  return tones[tone] ?? tones.blue;
}

export function CommunicationCenterDashboard({ session }: Props) {
  const [activeTab, setActiveTab] = useState("activity");
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [messageForm, setMessageForm] = useState({
    channel: "email",
    to: "",
    subject: "",
    body: ""
  });
  const [leadForm, setLeadForm] = useState({
    leadName: "",
    companyName: "",
    email: "",
    whatsapp: "",
    notes: ""
  });
  const [notice, setNotice] = useState("");

  async function loadOverview() {
    setLoading(true);
    const response = await fetch("/api/erp/communication-center/overview", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? "Unable to load Communication Center");
    setData(json.data ?? json);
    setLoading(false);
  }

  useEffect(() => {
    loadOverview().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
  }, []);

  const sender = data.sender ?? {};
  const cards = useMemo(() => metricCards(data.metrics), [data.metrics]);

  async function submitMessage() {
    setNotice("");
    const response = await fetch("/api/erp/communication-center/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageForm)
    });
    const json = await response.json();
    if (!response.ok) {
      setNotice(json?.error?.message ?? "Message could not be saved");
      return;
    }
    setMessageForm({ channel: "email", to: "", subject: "", body: "" });
    setNotice("Communication logged successfully.");
    await loadOverview();
  }

  async function submitLead() {
    setNotice("");
    const response = await fetch("/api/erp/communication-center/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadForm)
    });
    const json = await response.json();
    if (!response.ok) {
      setNotice(json?.error?.message ?? "Lead could not be saved");
      return;
    }
    setLeadForm({ leadName: "", companyName: "", email: "", whatsapp: "", notes: "" });
    setNotice("CRM lead saved successfully.");
    await loadOverview();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 text-slate-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                <MessageCircle className="h-3.5 w-3.5" />
                New Separate Module
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Communication Center</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Central email, WhatsApp, CRM, follow-ups, campaigns and communication reports for multi-country ERP operations.
              </p>
            </div>
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:min-w-[420px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Active sender</span>
                <span className="font-semibold text-slate-950">{sender.fromName ?? "Not configured"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-blue-700">{sender.fromEmail ?? "Not configured"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">WhatsApp</span>
                <span className="font-medium text-emerald-700">{sender.whatsappNumber ?? "Not configured"}</span>
              </div>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">{notice}</div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${toneClass(card.tone)}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-slate-950">{loading ? "-" : card.value.toLocaleString()}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "activity" ? (
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-950">Recent Communications</h2>
                  <button type="button" onClick={loadOverview} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Refresh
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-900 text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-4 py-3">Channel</th>
                        <th className="px-4 py-3">Recipient</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Module</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(data.recentMessages ?? []).map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold capitalize">{row.channel}</td>
                          <td className="px-4 py-3">{row.recipient_to || "-"}</td>
                          <td className="px-4 py-3">{row.subject || "-"}</td>
                          <td className="px-4 py-3">{row.linked_module || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{row.delivery_status}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                      {!loading && !(data.recentMessages ?? []).length ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                            No communication records yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab !== "activity" ? (
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {[
                  ["CRM Pipeline", "Lead management, customer history, supplier follow-ups and task tracking."],
                  ["Calendar & Appointments", "Meeting schedules, reminders, due follow-ups and customer appointments."],
                  ["Marketing Campaigns", "Email and WhatsApp campaigns with branch and country segmentation."],
                  ["Communication Reports", "Sent messages, failed messages, delivery, read status, campaign and branch reports."]
                ].map(([title, description]) => (
                  <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {title}
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="grid gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-950">Compose / Log Communication</h2>
              </div>
              <div className="grid gap-3">
                <select
                  value={messageForm.channel}
                  onChange={(event) => setMessageForm((prev) => ({ ...prev, channel: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="internal">Internal Note</option>
                </select>
                <input
                  value={messageForm.to}
                  onChange={(event) => setMessageForm((prev) => ({ ...prev, to: event.target.value }))}
                  placeholder="To / WhatsApp number"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  value={messageForm.subject}
                  onChange={(event) => setMessageForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Subject"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <textarea
                  value={messageForm.body}
                  onChange={(event) => setMessageForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Message body"
                  rows={5}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button type="button" onClick={submitMessage} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                  Save Communication
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-600" />
                <h2 className="text-base font-bold text-slate-950">Quick CRM Lead</h2>
              </div>
              <div className="grid gap-3">
                <input value={leadForm.leadName} onChange={(event) => setLeadForm((prev) => ({ ...prev, leadName: event.target.value }))} placeholder="Lead name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <input value={leadForm.companyName} onChange={(event) => setLeadForm((prev) => ({ ...prev, companyName: event.target.value }))} placeholder="Company name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <input value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <input value={leadForm.whatsapp} onChange={(event) => setLeadForm((prev) => ({ ...prev, whatsapp: event.target.value }))} placeholder="WhatsApp" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <textarea value={leadForm.notes} onChange={(event) => setLeadForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Lead notes" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <button type="button" onClick={submitLead} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
                  Save Lead
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-600" />
                <h2 className="text-base font-bold text-slate-950">Sender Rules</h2>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Future ERP documents can call the Communication Service to auto-select the official country and branch sender without duplicating logic.
              </p>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                User: <span className="font-semibold text-slate-950">{session?.fullName ?? session?.email ?? "Current user"}</span>
                <br />
                Branch: <span className="font-semibold text-slate-950">{sender.displayBranchName ?? "Scope not selected"}</span>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
