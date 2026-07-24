"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ArrowLeftRight,
  Building2,
  Check,
  ChevronRight,
  CircleDashed,
  Download,
  ExternalLink,
  FileDown,
  FilePlus2,
  Globe2,
  Inbox,
  Link2,
  Mail,
  MailOpen,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Reply,
  ReplyAll,
  Send,
  Settings2,
  ShieldAlert,
  Star,
  Trash2,
  Users,
  X,
  Search
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { ReportActionsMenu } from "@/components/reports/report-actions-menu";
import { ReportFilterMenu } from "@/components/reports/report-filter-menu";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { SimpleModal } from "@/components/ui/simple-modal";
import { cn } from "@/lib/utils";

type EmailFolder = "inbox" | "sent" | "draft" | "trash" | "spam" | "attachments" | "notifications";
type EmailChannel = "email" | "whatsapp" | "internal" | "notifications";

type EmailMessage = {
  id: string;
  folder: EmailFolder;
  channel: EmailChannel;
  provider: string;
  subject: string;
  preview: string;
  body: string;
  senderName: string;
  senderEmail: string | null;
  recipientSummary: string;
  ccSummary: string;
  companyId: string | null;
  companyName: string;
  branchId: string | null;
  branchName: string;
  branchType: string;
  createdAt: string;
  status: "draft" | "sent" | "received";
  isUnread: boolean;
  labels: string[];
  attachmentCount: number;
  linkedModule: string | null;
  linkedRoute: string | null;
  linkedDocumentNo: string | null;
  sourceTable: string;
  sourceId: string | null;
  action: string;
  companyFilterKey: string;
  branchFilterKey: string;
};

type EmailReportResponse = {
  channel: EmailChannel;
  summary: {
    totalMessages: number;
    inbox: number;
    sent: number;
    drafts: number;
    notifications: number;
    attachments: number;
    providers: number;
  };
  folders: Array<{ key: EmailFolder; label: string; count: number }>;
  filters: {
    companies: SearchSelectOption[];
    branches: SearchSelectOption[];
    providers: SearchSelectOption[];
    labels: SearchSelectOption[];
  };
  rows: EmailMessage[];
  generatedAt: string;
};

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesText(haystack: string, query: string) {
  if (!query) return true;
  return normalizeSearch(haystack).includes(normalizeSearch(query));
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function downloadText(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function emailToCsv(rows: EmailMessage[]) {
  const header = ["Folder", "Subject", "From", "Company", "Branch", "Date", "Status", "Labels", "Linked Module", "Linked Doc"];
  const csvRows = [header.join(",")];
  for (const row of rows) {
    csvRows.push(
      [
        row.folder,
        row.subject,
        row.senderName,
        row.companyName,
        row.branchName,
        row.createdAt,
        row.status,
        row.labels.join("; "),
        row.linkedModule ?? "",
        row.linkedDocumentNo ?? ""
      ]
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    );
  }
  return csvRows.join("\r\n");
}

function folderIcon(folder: EmailFolder) {
  switch (folder) {
    case "inbox":
      return Inbox;
    case "sent":
      return Send;
    case "draft":
      return Pencil;
    case "trash":
      return Trash2;
    case "spam":
      return ShieldAlert;
    case "attachments":
      return Paperclip;
    case "notifications":
      return MessageSquareText;
  }
}

const providerOptions = [
  { value: "email", label: "Outlook / Gmail / M365", keywords: "outlook gmail microsoft 365 email" },
  { value: "whatsapp", label: "WhatsApp", keywords: "whatsapp" },
  { value: "internal", label: "ERP Internal Messaging", keywords: "internal erp messaging" },
  { value: "notifications", label: "ERP Notifications", keywords: "notifications alerts" }
];

const folderLabels: Record<EmailFolder, string> = {
  inbox: "Inbox",
  sent: "Sent",
  draft: "Draft",
  trash: "Trash",
  spam: "Spam",
  attachments: "Attachments",
  notifications: "ERP Notifications"
};

const channelLabels: Record<EmailChannel, { title: string; subtitle: string }> = {
  email: { title: "Email Management", subtitle: "Global ERP email dashboard with company, country, and branch communication." },
  whatsapp: { title: "WhatsApp Management", subtitle: "ERP-connected chat and delivery communication." },
  internal: { title: "Internal Messaging", subtitle: "Internal ERP communication and workflow notes." },
  notifications: { title: "Notification Center", subtitle: "ERP alerts, approvals, and audit-driven notifications." }
};

export function EmailManagementWorkspace({ channel }: { channel: EmailChannel }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EmailReportResponse | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<EmailFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [provider, setProvider] = useState("all");
  const [label, setLabel] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFolder, setComposeFolder] = useState<"draft" | "sent">("sent");
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeProvider, setComposeProvider] = useState("ERP Internal Messaging");
  const [composeLabels, setComposeLabels] = useState("");
  const [composeModule, setComposeModule] = useState("");
  const [composeDocumentNo, setComposeDocumentNo] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<Array<{ filename: string; content: string; contentType?: string }>>([]);
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [composeCountryId, setComposeCountryId] = useState("");
  const [composeBranchId, setComposeBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const [compactList, setCompactList] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<EmailReportResponse>(`/api/erp/messages?channel=${channel}`);
      setData(res);
      
      // Auto-select first email if none is selected
      if (res.rows.length) {
        const firstInbox = res.rows.find((row) => row.folder === "inbox") ?? res.rows[0] ?? null;
        setSelectedId((current) => current ?? firstInbox?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email workspace");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    refreshWorkspace();
  }, [channel, refreshWorkspace]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((row) => {
      if (row.folder !== selectedFolder && selectedFolder !== "attachments") {
        if (selectedFolder === "inbox" && row.folder !== "inbox" && row.folder !== "notifications") return false;
        if (selectedFolder === "sent" && row.folder !== "sent") return false;
        if (selectedFolder === "draft" && row.folder !== "draft") return false;
        if (selectedFolder === "trash" && row.folder !== "trash") return false;
        if (selectedFolder === "spam" && row.folder !== "spam") return false;
        if (selectedFolder === "notifications" && row.folder !== "notifications") return false;
      }
      if (companyId !== "all" && row.companyFilterKey !== companyId) return false;
      if (branchId !== "all" && row.branchFilterKey !== branchId) return false;
      if (provider !== "all" && row.provider !== provider) return false;
      if (label !== "all" && !row.labels.includes(label)) return false;
      if (fromDate && row.createdAt.slice(0, 10) < fromDate) return false;
      if (toDate && row.createdAt.slice(0, 10) > toDate) return false;
      if (!query) return true;
      return matchesText(
        [row.subject, row.preview, row.body, row.senderName, row.recipientSummary, row.ccSummary, row.companyName, row.branchName, row.branchType, row.provider, row.linkedDocumentNo, row.labels.join(" ")]
          .filter(Boolean)
          .join(" "),
        query
      );
    });
  }, [branchId, companyId, data?.rows, fromDate, label, provider, query, selectedFolder, toDate]);

  useEffect(() => {
    if (!selectedId && filteredRows.length) setSelectedId(filteredRows[0]!.id);
    if (selectedId && !filteredRows.some((row) => row.id === selectedId)) {
      setSelectedId(filteredRows[0]?.id ?? null);
    }
  }, [filteredRows, selectedId]);

  const selected = useMemo(() => filteredRows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? null, [filteredRows, selectedId]);

  const summary = data?.summary ?? { totalMessages: 0, inbox: 0, sent: 0, drafts: 0, notifications: 0, attachments: 0, providers: 4 };

  function stripSendingEmail(emails: string, sendingEmail?: string) {
    if (!emails || emails === "-") return "";
    const cleanSend = sendingEmail?.toLowerCase().trim();
    return emails
      .split(",")
      .map(e => e.trim())
      .filter(e => {
        if (!e) return false;
        const match = e.match(/<([^>]+)>/);
        const addr = match ? match[1].toLowerCase().trim() : e.toLowerCase().trim();
        return (
          addr &&
          addr !== cleanSend &&
          addr !== "dgt.llc.com@gmail.com" &&
          addr !== "asmatandbrothers@gmail.com"
        );
      })
      .join(", ");
  }

  async function loadComposeConfig(
    linkedModule?: string,
    linkedDocumentNo?: string,
    branchId?: string,
    companyId?: string,
    countryId?: string
  ) {
    try {
      setConfigLoading(true);
      setConfigError(null);
      
      const queryParams = new URLSearchParams();
      if (linkedModule) queryParams.set("linkedModule", linkedModule);
      if (linkedDocumentNo) queryParams.set("linkedDocumentNo", linkedDocumentNo);
      if (branchId) queryParams.set("cityBranchId", branchId);
      if (countryId) queryParams.set("countryId", countryId);
      
      const res = await apiGet<any>(`/api/erp/email/config?${queryParams.toString()}`);
      if (res && res.config) {
        setEmailConfig(res.config);
        
        if (res.config.recipientEmail) {
          setComposeTo(res.config.recipientEmail);
        } else if (selected?.senderEmail && selected.senderEmail.includes("@")) {
          setComposeTo(selected.senderEmail);
        } else if (selected?.recipientSummary && selected.recipientSummary.includes("@") && selected.recipientSummary !== "-") {
          setComposeTo(selected.recipientSummary);
        } else {
          setComposeTo("");
        }

        if (selected?.ccSummary && selected.ccSummary !== "-") {
          setComposeCc(stripSendingEmail(selected.ccSummary, res.config.fromEmail));
        } else {
          setComposeCc("");
        }

        if (res.config.fromEmail) {
          setComposeProvider(res.config.fromEmail.includes("outlook") ? "Outlook" : "Gmail");
        }
      } else {
        setEmailConfig(null);
        const branchName = res?.scope?.cityBranchName || res?.scope?.countryBranchName || "Chaman Branch";
        const countryName = res?.scope?.countryName || "Pakistan";
        setConfigError(`No active official email account is configured for ${branchName} (${countryName}).`);
      }
    } catch (err: any) {
      console.error("Failed to load email config:", err);
      setConfigError(err.message || "Email configuration could not be loaded. Please configure an active SMTP account first.");
    } finally {
      setConfigLoading(false);
    }
  }

  function openCompose() {
    setComposeFolder("sent");
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeAttachments([]);
    setComposeModule(selected?.linkedModule ?? "");
    setComposeDocumentNo(selected?.linkedDocumentNo ?? "");
    setSelectedTemplate("");
    setPreviewMode(false);
    setComposeSubject(selected ? `Re: ${selected.subject}` : "");
    setComposeBody(selected ? `\n\n---\n${selected.body}` : "");
    setComposeProvider(selected?.provider ?? "ERP Internal Messaging");
    setComposeLabels(selected?.labels.join(", ") ?? "ERP, Email");
    setComposeCountryId(selected?.countryId ?? "");
    setComposeBranchId(selected?.branchType === "City Branch" ? selected.branchId ?? "" : "");
    setComposeOpen(true);
    loadComposeConfig(
      selected?.linkedModule ?? "",
      selected?.linkedDocumentNo ?? "",
      selected?.branchId ?? "",
      selected?.companyId ?? "",
      selected?.countryId ?? ""
    );
  }

  function openReplyAll() {
    setComposeFolder("sent");
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeAttachments([]);
    setComposeModule(selected?.linkedModule ?? "");
    setComposeDocumentNo(selected?.linkedDocumentNo ?? "");
    setSelectedTemplate("");
    setPreviewMode(false);
    setComposeSubject(selected ? `Re: ${selected.subject}` : "");
    setComposeBody(selected ? `\n\n---\n${selected.body}` : "");
    setComposeProvider(selected?.provider ?? "ERP Internal Messaging");
    setComposeLabels(selected?.labels.join(", ") ?? "ERP, Email");
    setComposeCountryId(selected?.countryId ?? "");
    setComposeBranchId(selected?.branchType === "City Branch" ? selected.branchId ?? "" : "");
    setComposeOpen(true);
    loadComposeConfig(
      selected?.linkedModule ?? "",
      selected?.linkedDocumentNo ?? "",
      selected?.branchId ?? "",
      selected?.companyId ?? "",
      selected?.countryId ?? ""
    );
  }

  function openForward() {
    setComposeFolder("sent");
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeAttachments([]);
    setComposeModule(selected?.linkedModule ?? "");
    setComposeDocumentNo(selected?.linkedDocumentNo ?? "");
    setSelectedTemplate("");
    setPreviewMode(false);
    setComposeSubject(selected ? `Fwd: ${selected.subject}` : "");
    setComposeBody(selected ? `\n\n--- Forwarded message ---\nFrom: ${selected.senderName}\nDate: ${formatDateTime(selected.createdAt)}\nSubject: ${selected.subject}\n\n${selected.body}` : "");
    setComposeProvider(selected?.provider ?? "ERP Internal Messaging");
    setComposeLabels(selected?.labels.join(", ") ?? "ERP, Email");
    setComposeCountryId(selected?.countryId ?? "");
    setComposeBranchId(selected?.branchType === "City Branch" ? selected.branchId ?? "" : "");
    setComposeOpen(true);
    loadComposeConfig(
      selected?.linkedModule ?? "",
      selected?.linkedDocumentNo ?? "",
      selected?.branchId ?? "",
      selected?.companyId ?? "",
      selected?.countryId ?? ""
    );
  }

  async function saveCompose(folder: "draft" | "sent") {
    if (folder === "sent") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validate = (str: string) => {
        const parts = str.split(",").map((e) => {
          const match = e.match(/<([^>]+)>/);
          return match ? match[1].trim() : e.trim();
        }).filter(Boolean);
        return parts.length > 0 && parts.every((email) => emailRegex.test(email));
      };

      if (!composeTo || !validate(composeTo)) {
        alert("Error: Recipient 'To' email address is invalid (e.g. name@domain.com).");
        return;
      }
      if (composeCc && !validate(composeCc)) {
        alert("Error: Recipient 'CC' email address is invalid.");
        return;
      }
      if (composeBcc && !validate(composeBcc)) {
        alert("Error: Recipient 'BCC' email address is invalid.");
        return;
      }
    }

    try {
      setSaving(true);
      await apiPost<{ id: string }>("/api/erp/messages", {
        channel,
        folder,
        provider: composeProvider,
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        subject: composeSubject,
        body: composeBody,
        companyId: selected?.companyId ?? null,
        countryId: null,
        countryBranchId: selected?.branchType === "Main Branch" ? selected.branchId : null,
        cityBranchId: selected?.branchType === "City Branch" ? selected.branchId : null,
        linkedRoute: selected?.linkedRoute ?? null,
        linkedModule: composeModule || selected?.linkedModule || null,
        linkedDocumentNo: composeDocumentNo || selected?.linkedDocumentNo || null,
        labels: composeLabels
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        attachments: composeAttachments
      });
      setComposeOpen(false);
      refreshWorkspace();
      setSelectedFolder(folder === "draft" ? "draft" : "sent");
    } catch (err: any) {
      alert(`Email Delivery Failed:\n${err.message || "Failed to deliver email message via SMTP."}`);
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target?.result as string;
        setComposeAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64Content,
            contentType: file.type
          }
        ]);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleRetry(messageId: string) {
    try {
      setRetrying(true);
      const res = await apiPost<{ success: boolean; message?: string }>(`/api/erp/messages/${messageId}/retry`, {});
      alert(res.message || "Email resent successfully!");
      refreshWorkspace();
    } catch (err: any) {
      alert(err.message || "Failed to retry email send.");
    } finally {
      setRetrying(false);
    }
  }

  function handleTemplateChange(templateKey: string) {
    setSelectedTemplate(templateKey);
    if (!templateKey) return;
    
    const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
      quotation: {
        subject: "Quotation Request",
        body: "Dear Customer,\n\nPlease find attached the quotation details as requested.\n\nShould you have any questions, feel free to contact us.\n\nBest Regards,\n"
      },
      invoice: {
        subject: "Sales Invoice",
        body: "Dear Customer,\n\nPlease find attached your Sales Invoice.\n\nThank you for choosing our services.\n\nBest Regards,\n"
      },
      purchase_order: {
        subject: "Purchase Order Request",
        body: "Dear Supplier,\n\nPlease find attached our official Purchase Order. Please confirm receipt and provide delivery timeline.\n\nBest Regards,\n"
      },
      payment_reminder: {
        subject: "Friendly Payment Reminder",
        body: "Dear Customer,\n\nThis is a friendly reminder regarding your outstanding invoice balance. Please review the attached statement.\n\nBest Regards,\n"
      },
      shipment_update: {
        subject: "Shipment Dispatched Update",
        body: "Dear Customer,\n\nWe are pleased to inform you that your shipment has been dispatched. Please review the attached shipping document details.\n\nBest Regards,\n"
      }
    };

    const tpl = EMAIL_TEMPLATES[templateKey];
    if (tpl) {
      setComposeSubject(tpl.subject);
      setComposeBody(tpl.body);
    }
  }

  async function handleTestConnection() {
    if (!emailConfig) return;
    const branchName = emailConfig.branchName || "Branch";
    try {
      setTestingConnection(true);
      await apiPost<{ success: boolean; message: string }>("/api/erp/messages/test-connection", {
        countryId: emailConfig.countryId,
        countryBranchId: emailConfig.branchId,
        cityBranchId: emailConfig.branchId
      });
      alert(`✅ ${branchName} email is ready to send.`);
    } catch (err: any) {
      alert(`❌ SMTP authentication failed.\nDetails: ${err.message || "Invalid credentials."}`);
    } finally {
      setTestingConnection(false);
    }
  }

  function printWorkspace() {
    window.print();
  }

  function exportCsv() {
    if (!filteredRows.length) return;
    downloadText(`email-workspace-${new Date().toISOString().slice(0, 10)}.csv`, emailToCsv(filteredRows), "text/csv;charset=utf-8");
  }

  function exportPdf() {
    window.print();
  }

  function openInErp() {
    if (selected?.linkedRoute) window.location.href = selected.linkedRoute;
  }

  function downloadAttachmentSummary() {
    if (!selected) return;
    const payload = {
      message: selected.subject,
      attachments: selected.attachmentCount,
      linkedModule: selected.linkedModule,
      linkedDocumentNo: selected.linkedDocumentNo
    };
    downloadText(`attachments-${selected.id}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function onSelectedFolder(folder: EmailFolder) {
    setSelectedFolder(folder);
    setSelectedId(null);
  }

  const isSendDisabled =
    saving ||
    configLoading ||
    !composeTo ||
    !composeTo.includes("@") ||
    !emailConfig ||
    !emailConfig.countryName ||
    !emailConfig.companyName ||
    !emailConfig.branchName ||
    !emailConfig.fromEmail ||
    !emailConfig.providerName ||
    !emailConfig.smtpHost ||
    !emailConfig.smtpPort ||
    !emailConfig.smtpUser ||
    !emailConfig.hasPassword;

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title={channelLabels[channel].title}
        subtitle={channelLabels[channel].subtitle}
        actions={
          <>
            <Button type="button" className="h-9 rounded-lg px-3" onClick={openCompose}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Compose
            </Button>
            <ReportActionsMenu disabled={loading} onPrint={printWorkspace} onPdf={exportPdf} onExcel={exportCsv} ariaLabel="Email workspace actions" />
            <ReportFilterMenu ariaLabel="Email workspace filters" disabled={loading}>
              <div className="border-b bg-muted/10 px-3 py-2 text-sm font-semibold">Email Filters</div>
              <div className="space-y-3 p-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Search</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input className="h-9 pl-9 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, sender, branch, label..." />
                  </div>
                </div>

                <SearchSelect
                  label="Company"
                  value={companyId}
                  options={[{ value: "all", label: "All Companies", keywords: "all companies" }, ...(data?.filters.companies ?? [])]}
                  placeholder="All companies"
                  onValueChange={setCompanyId}
                  disabled={loading}
                />

                <SearchSelect
                  label="Branch"
                  value={branchId}
                  options={[{ value: "all", label: "All Branches", keywords: "all branches" }, ...(data?.filters.branches ?? [])]}
                  placeholder="All branches"
                  onValueChange={setBranchId}
                  disabled={loading}
                />

                <SearchSelect
                  label="Provider"
                  value={provider}
                  options={[{ value: "all", label: "All Providers", keywords: "all providers" }, ...(data?.filters.providers ?? providerOptions)]}
                  placeholder="All providers"
                  onValueChange={setProvider}
                  disabled={loading}
                />

                <SearchSelect
                  label="Label"
                  value={label}
                  options={[{ value: "all", label: "All Labels", keywords: "all labels" }, ...(data?.filters.labels ?? [])]}
                  placeholder="All labels"
                  onValueChange={setLabel}
                  disabled={loading}
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">From Date</Label>
                    <Input type="date" className="h-9 text-xs" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">To Date</Label>
                    <Input type="date" className="h-9 text-xs" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    setQuery("");
                    setCompanyId("all");
                    setBranchId("all");
                    setProvider("all");
                    setLabel("all");
                    setFromDate("");
                    setToDate("");
                    setSelectedFolder("inbox");
                    setSelectedId(null);
                  }}>
                    Reset
                  </Button>
                </div>
              </div>
            </ReportFilterMenu>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={Inbox} label="Inbox" value={summary.inbox} />
        <MetricCard icon={Send} label="Sent" value={summary.sent} />
        <MetricCard icon={Pencil} label="Drafts" value={summary.drafts} />
        <MetricCard icon={MessageSquareText} label="ERP Notifications" value={summary.notifications} />
        <MetricCard icon={Paperclip} label="Attachments" value={summary.attachments} />
        <MetricCard icon={Globe2} label="Providers" value={summary.providers} />
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="border-blue-200/70 bg-blue-50/40 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">SMTP / Email</p>
                <h3 className="mt-1 text-sm font-black text-slate-950 dark:text-white">Outbound Mail Control</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-350">Messages are saved to ERP audit and email tables; SMTP provider can be connected per country/branch.</p>
              </div>
              <Mail className="h-5 w-5 text-blue-600" aria-hidden />
            </div>
            <button type="button" onClick={openCompose} className="mt-4 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300">
              Compose Email
            </button>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/70 bg-emerald-50/40 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">WhatsApp</p>
                <h3 className="mt-1 text-sm font-black text-slate-950 dark:text-white">Message Templates</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-350">WhatsApp communication uses the same ERP history and branch visibility rules.</p>
              </div>
              <MessageSquareText className="h-5 w-5 text-emerald-600" aria-hidden />
            </div>
            <button type="button" onClick={() => { setProvider("WhatsApp"); setComposeProvider("WhatsApp"); setComposeSubject("WhatsApp Customer Message"); setComposeBody("Dear Customer,\n\n"); setComposeOpen(true); }} className="mt-4 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300">
              New WhatsApp Message
            </button>
          </CardContent>
        </Card>
        <Card className="border-orange-200/70 bg-orange-50/40 shadow-sm dark:border-orange-900/60 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Templates</p>
                <h3 className="mt-1 text-sm font-black text-slate-950 dark:text-white">Professional Replies</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-350">Purchase, payment, stock alert, approval, and customer follow-up templates are ready for compose.</p>
              </div>
              <FilePlus2 className="h-5 w-5 text-orange-600" aria-hidden />
            </div>
            <button type="button" onClick={() => { setComposeSubject("ERP Notification"); setComposeBody("Dear Customer\\n\\nYour ERP record has been updated.\\n\\nRegards,"); setComposeLabels("ERP, Template"); setComposeOpen(true); }} className="mt-4 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:bg-slate-950 dark:text-orange-300">
              Use Template
            </button>
          </CardContent>
        </Card>
        <Card className="border-purple-200/70 bg-purple-50/40 shadow-sm dark:border-purple-900/60 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-700 dark:text-purple-300">Audit Trail</p>
                <h3 className="mt-1 text-sm font-black text-slate-950 dark:text-white">Communication History</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-350">Every sent/draft message stays linked with country, branch, user, module, and document history.</p>
              </div>
              <ShieldAlert className="h-5 w-5 text-purple-600" aria-hidden />
            </div>
            <div className="mt-4 rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-black text-purple-700 dark:border-purple-900 dark:bg-slate-950 dark:text-purple-300">
              {summary.totalMessages} logged records
            </div>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50/60">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1.2fr)_380px]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Folders</div>
              <p className="text-xs text-muted-foreground">Global communication and ERP notifications.</p>
            </div>
            <div className="space-y-1">
              {data?.folders.map((folder) => {
                const Icon = folderIcon(folder.key);
                const active = selectedFolder === folder.key;
                return (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => onSelectedFolder(folder.key)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      active ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:bg-muted/60"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" aria-hidden />
                      {folder.label}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{folder.count}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onSelectedFolder("dashboard")}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                  selectedFolder === "dashboard" ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:bg-muted/60"
                )}
              >
                <span className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4" aria-hidden />
                  Branch Settings
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground uppercase tracking-wider">Dashboard</span>
              </button>
            </div>

            <div className="border-t pt-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Labels</div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <div className="space-y-1">
                {(data?.filters.labels ?? []).slice(0, 8).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLabel(opt.value)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                  >
                    <span className="truncate">{opt.label}</span>
                    {label === opt.value ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedFolder === "dashboard" ? (
          <Card className="xl:col-span-2 border-slate-200/80 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Branch Email Status Dashboard</h3>
                <p className="text-xs text-muted-foreground mt-1">Monitor SMTP connectivity and outbound status across all active offices.</p>
              </div>
              
              <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                    <tr>
                      <th className="p-3 font-semibold">Country</th>
                      <th className="p-3 font-semibold">Branch</th>
                      <th className="p-3 font-semibold">Official Email</th>
                      <th className="p-3 font-semibold">SMTP Status</th>
                      <th className="p-3 font-semibold">Email Status</th>
                      <th className="p-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data as any)?.branchEmailsDashboardList?.map((row: any, idx: number) => {
                      const isReady = row.emailStatus.includes("Ready");
                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium text-foreground">{row.country}</td>
                          <td className="p-3 font-medium text-foreground">{row.branch}</td>
                          <td className="p-3 text-muted-foreground font-mono">{row.officialEmail}</td>
                          <td className="p-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px]",
                              row.smtpStatus.includes("Connected") ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/20" :
                              row.smtpStatus.includes("Incomplete") ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20" :
                              row.smtpStatus.includes("Failed") ? "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/20" :
                              "text-slate-500 bg-slate-50"
                            )}>
                              <span className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                row.smtpStatus.includes("Connected") ? "bg-green-500 animate-pulse" :
                                row.smtpStatus.includes("Incomplete") ? "bg-amber-500" :
                                row.smtpStatus.includes("Failed") ? "bg-red-500" : "bg-slate-400"
                              )} />
                              {row.smtpStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded font-bold text-[10px] inline-flex items-center",
                              isReady ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/20" : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/20"
                            )}>
                              {row.emailStatus}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={async () => {
                                try {
                                  await apiPost<{ success: boolean; message: string }>("/api/erp/messages/test-connection", {
                                    countryId: row.countryId,
                                    cityBranchId: row.branchId
                                  });
                                  alert(`✅ ${row.branch} email is ready to send.`);
                                } catch (err: any) {
                                  alert(`❌ SMTP authentication failed for ${row.branch}.\nDetails: ${err.message || "Invalid credentials."}`);
                                }
                              }}
                            >
                              Test SMTP
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="space-y-4 p-0">
                <div className="border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search emails, notifications, companies, branches..."
                        className="h-10 rounded-lg pl-9"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCompactList((value) => !value)}>
                      {compactList ? "Comfort" : "Compact"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={openCompose}>
                      <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                      New Message
                    </Button>
                  </div>
                </div>

                <div className="px-4">
                  <div className="grid gap-2 border-b py-3 sm:grid-cols-2 lg:grid-cols-4">
                    {providerOptions.map((option) => {
                      const active = provider === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProvider((current) => (current === option.value ? "all" : option.value))}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                            active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="truncate">{option.label}</span>
                          {active ? <Check className="h-4 w-4" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="divide-y overflow-hidden max-h-[760px]">
                  {loading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Loading email workspace...</div>
                  ) : filteredRows.length ? (
                    filteredRows.map((row) => {
                      const active = selected?.id === row.id;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 text-left transition hover:bg-muted/40",
                            compactList ? "py-2" : "py-3",
                            active ? "bg-muted/60" : ""
                          )}
                        >
                          <div className={cn("mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", row.isUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            <Mail className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground">{row.subject}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {row.senderName} - {row.companyName}
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</div>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{row.preview}</span>
                              {row.labels.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full border px-2 py-0.5 text-[11px]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          {row.attachmentCount ? <Paperclip className="mt-1 h-4 w-4 text-muted-foreground" aria-hidden /> : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">No email records found for the selected filters.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="space-y-4 p-4">
                {selected ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-lg font-semibold text-foreground">{selected.subject}</h2>
                          {selected.isUnread ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Unread</span> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{selected.senderName} - {selected.companyName} - {selected.branchName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={printWorkspace}>
                          <Printer className="h-4 w-4" aria-hidden />
                        </Button>
                        <EmailActionsMenu
                          onReply={openCompose}
                          onReplyAll={openReplyAll}
                          onForward={openForward}
                          onPrint={printWorkspace}
                          onDownload={downloadAttachmentSummary}
                          onOpenInErp={openInErp}
                          onLinkDocument={() => setComposeOpen(true)}
                          onCreatePurchaseOrder={() => (window.location.href = "/dashboard/purchase/purchase-order")}
                          onCreateInvoice={() => (window.location.href = "/dashboard/sales/sales-order")}
                          onCreatePayment={() => (window.location.href = "/dashboard/roznamcha/cash-entry")}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      {selected.status === "failed" && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-950/40 dark:bg-red-950/20">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-red-800 dark:text-red-300">Email Delivery Failed</div>
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Error: {selected.preview || "SMTP Authentication or Connection Failure"}</p>
                            </div>
                            <Button type="button" variant="destructive" size="sm" onClick={() => handleRetry(selected.id)} disabled={retrying}>
                              {retrying ? "Retrying..." : "Retry Send"}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-lg border bg-background p-4">
                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">Message</div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selected.body}</p>
                        </div>
                      </div>

                      {selected.attachmentCount ? (
                        <div className="rounded-lg border bg-background p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold text-foreground">Attachments ({selected.attachmentCount})</div>
                            <Button type="button" variant="outline" size="sm" onClick={downloadAttachmentSummary}>
                              <DownloadActionIcon className="mr-2 h-4 w-4" aria-hidden />
                              Download
                            </Button>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Array.from({ length: Math.max(1, Math.min(4, selected.attachmentCount)) }).map((_, index) => (
                              <div key={`${selected.id}-att-${index}`} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                                <Paperclip className="h-4 w-4 text-primary" aria-hidden />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">Attachment {index + 1}</div>
                                  <div className="text-xs text-muted-foreground">{selected.provider}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-lg border bg-background p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-foreground">Linked ERP Information</div>
                          <Button type="button" variant="outline" size="sm" onClick={openInErp} disabled={!selected.linkedRoute}>
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                            Open in ERP
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoBlock label="Module" value={selected.linkedModule ?? "ERP"} />
                          <InfoBlock label="Document No." value={selected.linkedDocumentNo ?? "-"} />
                          <InfoBlock label="Provider" value={selected.provider} />
                          <InfoBlock label="Status" value={selected.status.toUpperCase()} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={openCompose}>
                          <Reply className="mr-2 h-4 w-4" aria-hidden />
                          Reply
                        </Button>
                        <Button type="button" variant="outline" onClick={openReplyAll}>
                          <ReplyAll className="mr-2 h-4 w-4" aria-hidden />
                          Reply All
                        </Button>
                        <Button type="button" variant="outline" onClick={openForward}>
                          <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden />
                          Forward
                        </Button>
                        <Button type="button" variant="outline" onClick={openInErp} disabled={!selected.linkedRoute}>
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                          Open in ERP
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid min-h-[560px] place-items-center text-center">
                    <div className="max-w-sm space-y-3">
                      <MailOpen className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
                      <div className="text-lg font-semibold text-foreground">Select an email thread</div>
                      <p className="text-sm text-muted-foreground">Open an ERP communication, notification, or draft to inspect the full linked document history.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {composeOpen ? (
        <SimpleModal title={composeFolder === "draft" ? "Save Draft" : "Compose Message"} onClose={() => setComposeOpen(false)} className="max-w-5xl">
          <div className="flex border-b mb-4">
            <button
              type="button"
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                !previewMode ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPreviewMode(false)}
            >
              Compose / Edit
            </button>
            <button
              type="button"
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                previewMode ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPreviewMode(true)}
            >
              Email Preview
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              {!previewMode ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="To" value={composeTo} onChange={setComposeTo} placeholder="recipient@company.com" />
                    <Field label="CC" value={composeCc} onChange={setComposeCc} placeholder="cc@company.com" />
                    <Field label="BCC" value={composeBcc} onChange={setComposeBcc} placeholder="bcc@company.com" />
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/50 p-3 rounded-lg border border-slate-200/80">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Country</Label>
                      <select
                        value={composeCountryId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setComposeCountryId(cid);
                          setComposeBranchId("");
                          loadComposeConfig(undefined, undefined, undefined, undefined, cid);
                        }}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
                      >
                        <option value="">-- Select Country --</option>
                        {data?.countries?.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Branch (Main / City)</Label>
                      <select
                        value={composeBranchId}
                        onChange={(e) => {
                          const bid = e.target.value;
                          setComposeBranchId(bid);
                          loadComposeConfig(undefined, undefined, bid, undefined, composeCountryId);
                        }}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
                        disabled={!composeCountryId}
                      >
                        <option value="">-- Select Branch --</option>
                        {data?.cityBranches
                          ?.filter((b: any) => b.country_id === composeCountryId)
                          ?.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Subject" value={composeSubject} onChange={setComposeSubject} placeholder="Email subject" />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Apply Template</Label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm shadow-sm outline-none focus:border-primary"
                      >
                        <option value="">-- Apply Template --</option>
                        <option value="quotation">Quotation Request</option>
                        <option value="invoice">Sales Invoice</option>
                        <option value="purchase_order">Purchase Order Request</option>
                        <option value="payment_reminder">Friendly Payment Reminder</option>
                        <option value="shipment_update">Shipment Dispatched Update</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Body</Label>
                    <textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      className="min-h-[260px] w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Write the email body..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Attachments</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        id="email-composer-file-upload"
                      />
                      <label
                        htmlFor="email-composer-file-upload"
                        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-3.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted hover:text-accent-foreground"
                      >
                        <Paperclip className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        Attach Files
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {composeAttachments.length} file(s) attached
                      </span>
                    </div>

                    {composeAttachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {composeAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1 text-xs">
                            <span className="truncate max-w-[160px] font-medium">{att.filename}</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive font-bold text-sm ml-1"
                              onClick={() => setComposeAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/10 p-5 space-y-4">
                  <div className="border-b pb-3 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground">From:</span>{" "}
                      <span className="font-medium text-foreground">
                        {configLoading ? "Resolving official server configuration..." : emailConfig?.fromName ? `${emailConfig.fromName} <${emailConfig.fromEmail}>` : "Default Official Mail"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">To:</span>{" "}
                      <span className="font-medium text-foreground">{composeTo || "-"}</span>
                    </div>
                    {composeCc && (
                      <div>
                        <span className="font-semibold text-muted-foreground">CC:</span>{" "}
                        <span className="font-medium text-foreground">{composeCc}</span>
                      </div>
                    )}
                    {composeBcc && (
                      <div>
                        <span className="font-semibold text-muted-foreground">BCC:</span>{" "}
                        <span className="font-medium text-foreground">{composeBcc}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-muted-foreground">Subject:</span>{" "}
                      <span className="font-medium text-foreground">{composeSubject || "(No Subject)"}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900 min-h-[300px] flex flex-col">
                    {emailConfig?.logoUrl && (
                      <div className="mb-6">
                        <img src={emailConfig.logoUrl} alt="Logo" className="max-h-10 object-contain" />
                      </div>
                    )}
                    
                    <div className="flex-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {composeBody || "Type body text in Edit mode."}
                    </div>

                    {emailConfig?.signatureText && (
                      <div className="mt-8 border-t pt-4 text-xs text-muted-foreground whitespace-pre-wrap">
                        {emailConfig.signatureText}
                      </div>
                    )}
                  </div>

                  {composeAttachments.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-muted-foreground">Attachments:</div>
                      <div className="flex flex-wrap gap-2">
                        {composeAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded bg-muted/60 border px-2 py-0.5 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            <span>{att.filename}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="text-sm font-semibold text-foreground">Official Email Router</div>
              
              {configLoading ? (
                <div className="rounded-lg bg-background border p-3.5 text-xs text-muted-foreground animate-pulse">
                  Checking Branch Email configuration...
                </div>
              ) : emailConfig ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3.5 space-y-2 text-xs shadow-sm dark:border-green-900/60 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 font-bold text-green-700 dark:text-green-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    Status: ✅ Email Ready
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground pt-1.5 border-t">
                    <div><span className="font-semibold text-foreground">Country:</span> {emailConfig.countryName}</div>
                    <div><span className="font-semibold text-foreground">Branch:</span> {emailConfig.branchName}</div>
                    <div><span className="font-semibold text-foreground">Official Email:</span> {emailConfig.fromEmail || "-"}</div>
                    <div><span className="font-semibold text-foreground">Provider:</span> {emailConfig.providerName || "-"}</div>
                    <div>
                      <span className="font-semibold text-foreground">SMTP Status:</span>{" "}
                      {emailConfig.hasPassword ? (
                        <span className="text-green-600 font-bold">Connected 🟢</span>
                      ) : (
                        <span className="text-amber-500 font-bold">Incomplete 🟡</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 space-y-1 text-xs shadow-sm dark:border-red-900/60 dark:bg-red-950/20">
                  <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-450">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Status: ❌ Email Not Configured
                  </div>
                  <p className="text-[11px] text-red-700 pt-1.5 border-t leading-relaxed font-medium">
                    {configError || "No official email account is configured for this branch."}
                  </p>
                </div>
              )}

              {!configLoading && emailConfig?.providerName?.toLowerCase() === "gmail" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-850 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                  <div className="font-semibold text-amber-800 dark:text-amber-400">Gmail Notice:</div>
                  <p className="mt-1 leading-relaxed text-[11px]">
                    Google App Password is required to send emails via Gmail. Traditional account passwords are blocked by Google security.
                  </p>
                </div>
              )}

              {(!composeTo || !composeTo.includes("@")) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-850 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  <p className="leading-relaxed font-semibold text-red-800 dark:text-red-400">
                    Recipient email address is missing for this ERP record.
                  </p>
                </div>
              )}

              {!configLoading && !emailConfig && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  <p className="leading-relaxed">
                    {configError || "Email configuration could not be loaded. Please configure an active SMTP account first."}
                  </p>
                </div>
              )}

              {emailConfig && (
                <div className="space-y-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs h-9"
                    disabled={testingConnection || configLoading}
                    onClick={handleTestConnection}
                  >
                    {testingConnection ? "Testing Connection..." : "Test SMTP Connection"}
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div className="font-semibold text-xs text-foreground">ERP Document Linking</div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-muted-foreground">Linked Module</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2.5 text-xs outline-none"
                    value={composeModule}
                    onChange={(e) => setComposeModule(e.target.value)}
                  >
                    <option value="">-- No Linking --</option>
                    <option value="Purchase Order">Purchase Order</option>
                    <option value="Sales Invoice">Sales Invoice</option>
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Payment">Payment</option>
                    <option value="Shipment">Shipment</option>
                  </select>
                </div>
                <Field
                  label="Document No."
                  value={composeDocumentNo}
                  onChange={setComposeDocumentNo}
                  placeholder="PO-2026-0012"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isSendDisabled} 
                  onClick={() => saveCompose("sent")}
                >
                  <Send className="mr-2 h-4 w-4" aria-hidden />
                  {saving ? "Sending..." : "Send Email"}
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled={saving || configLoading} onClick={() => saveCompose("draft")}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  Save Draft
                </Button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value || "-"}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function EmailActionsMenu({
  onReply,
  onReplyAll,
  onForward,
  onPrint,
  onDownload,
  onOpenInErp,
  onLinkDocument,
  onCreatePurchaseOrder,
  onCreateInvoice,
  onCreatePayment
}: {
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onPrint: () => void;
  onDownload: () => void;
  onOpenInErp: () => void;
  onLinkDocument: () => void;
  onCreatePurchaseOrder: () => void;
  onCreateInvoice: () => void;
  onCreatePayment: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onMouseDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  function action(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setOpen((current) => !current)}>
        <MoreVertical className="h-4 w-4" aria-hidden />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border bg-background shadow-lg">
          <ActionRow icon={Reply} label="Reply" onClick={() => action(onReply)} />
          <ActionRow icon={ReplyAll} label="Reply All" onClick={() => action(onReplyAll)} />
          <ActionRow icon={ArrowLeftRight} label="Forward" onClick={() => action(onForward)} />
          <ActionRow icon={Printer} label="Print" onClick={() => action(onPrint)} />
          <ActionRow icon={Paperclip} label="Download Attachment" onClick={() => action(onDownload)} />
          <ActionRow icon={ExternalLink} label="Open in ERP" onClick={() => action(onOpenInErp)} />
          <ActionRow icon={Link2} label="Link ERP Document" onClick={() => action(onLinkDocument)} />
          <ActionRow icon={FilePlus2} label="Create Purchase Order" onClick={() => action(onCreatePurchaseOrder)} />
          <ActionRow icon={FilePlus2} label="Create Invoice" onClick={() => action(onCreateInvoice)} />
          <ActionRow icon={FilePlus2} label="Create Payment" onClick={() => action(onCreatePayment)} />
        </div>
      ) : null}
    </div>
  );
}

function ActionRow({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
