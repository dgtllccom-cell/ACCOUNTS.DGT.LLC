"use client";

import { useState, useRef } from "react";
import { Paperclip, Send, Trash2, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
  senderEmail: string;
  availableStorageBytes: number;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSent,
  senderEmail,
  availableStorageBytes,
}: ComposeModalProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const totalAttachmentBytes = attachments.reduce((acc, a) => acc + a.size, 0);
  const messageSizeBytes = Buffer.byteLength(body, "utf8") + totalAttachmentBytes;
  const isOverQuota = messageSizeBytes > availableStorageBytes;

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles: Array<{ name: string; size: number; type: string }> = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      newFiles.push({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      });
    }
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      setError("Please specify a recipient email address");
      return;
    }
    if (!subject.trim()) {
      setError("Please specify a subject for the email");
      return;
    }
    if (isOverQuota) {
      setError("Message size exceeds your remaining storage quota. Upgrade your plan or delete old messages.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/mail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body,
          attachments,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message");
      }

      onSent();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <span className="text-sm font-semibold tracking-wide">New Message &bull; DGT Mail</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* From */}
          <div className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span className="w-16 font-medium">From:</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{senderEmail}</span>
          </div>

          {/* To */}
          <div className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
            <span className="w-16 font-medium text-slate-500">To:</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com, gmail.com, etc."
              className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 text-xs"
              required
            />
          </div>

          {/* Subject */}
          <div className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
            <span className="w-16 font-medium text-slate-500">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-white font-medium placeholder:text-slate-400 text-xs"
              required
            />
          </div>

          {/* Body */}
          <div className="p-4 flex-1 flex flex-col min-h-[220px]">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              className="w-full flex-1 bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-100 text-sm leading-relaxed placeholder:text-slate-400"
            />
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200 shadow-sm"
                >
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="max-w-[150px] truncate">{att.name}</span>
                  <span className="text-[10px] text-slate-400">({(att.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-slate-400 hover:text-red-500 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer Bar */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleAddFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Attach Files"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <span className="text-[11px] text-slate-400">
                Message Size: {(messageSizeBytes / 1024).toFixed(1)} KB
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={loading || isOverQuota}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow"
              >
                {loading ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
