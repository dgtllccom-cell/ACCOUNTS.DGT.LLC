"use client";

import { useEffect, useState, useRef } from "react";

import { Download, File as FileIcon, FileText, History, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DocumentRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  versionCount: number;
  uploadedBy: string;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  sizeBytes: number;
  uploadedBy: string;
}

interface DocumentManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  onCountChange?: (count: number) => void;
}

export function DocumentManagerModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  onCountChange
}: DocumentManagerModalProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/erp/documents?entityType=${entityType}&entityId=${entityId}`);
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.data.results || []);
        onCountChange?.(json.data.results?.length || 0);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && entityId) {
      fetchDocuments();
    }
  }, [open, entityId, entityType]);

  const handleUpload = async (file: File, documentIdToReplace?: string) => {
    if (file.size > 20 * 1024 * 1024) {
      alert("File size exceeds 20MB limit.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      
      let url = "/api/erp/documents";
      if (documentIdToReplace) {
        url = `/api/erp/documents/${documentIdToReplace}/version`;
      } else {
        formData.append("entityType", entityType);
        formData.append("entityId", entityId);
      }

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Upload failed");
      }

      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/erp/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchDocuments();
    } catch (err) {
      alert("Failed to delete document. You might not have permission.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId: string, versionId?: string) => {
    try {
      let url = `/api/erp/documents/download?id=${docId}`;
      if (versionId) url += `&versionId=${versionId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to get download link");
      const data = await res.json();
      
      // trigger download
      window.open(data.data.url, "_blank");
    } catch (err) {
      alert("Failed to download document");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col h-[85vh] sm:h-[600px]">
        <DialogHeader className="px-6 py-4 border-b bg-white dark:bg-slate-900 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Paperclip className="h-5 w-5 text-primary" />
            Document Manager
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Manage attachments, versions, and uploads for this record.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Zone */}
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 flex flex-col items-center justify-center text-center transition-colors hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            </div>
            <h3 className="text-sm font-semibold mb-1">Upload New Document</h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Drag and drop your files here or click to browse. Supported formats: PDF, Word, Excel, Images, ZIP. (Max 20MB)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleUpload(e.target.files[0]);
              }}
            />
            <Button
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>
          </div>

          {/* Document List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between">
              Attached Documents ({documents.length})
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </h3>
            
            {documents.length === 0 && !loading && (
              <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <FileIcon className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">No documents attached yet</p>
              </div>
            )}

            {documents.map((doc) => (
              <div key={doc.id} className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                      <span>{formatSize(doc.sizeBytes)}</span>
                      <span>•</span>
                      <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(doc.createdAt))}</span>
                      {doc.versionCount > 1 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 rounded">v{doc.versionCount}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleDownload(doc.id)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download
                    </Button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="Upload New Version" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleUpload(file, doc.id);
                      };
                      input.click();
                    }}>
                      <Upload className="h-4 w-4" />
                    </Button>
                    {doc.versionCount > 1 && (
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-slate-500", expandedDocId === doc.id && "bg-slate-100 dark:bg-slate-800")} title="Version History" onClick={() => setExpandedDocId(expandedDocId === doc.id ? null : doc.id)}>
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50" title="Delete Document" onClick={() => handleDelete(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Version History Expansion */}
                {expandedDocId === doc.id && doc.versions && (
                  <div className="border-t bg-slate-50/50 dark:bg-slate-950/50 p-4">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Version History</h4>
                    <div className="space-y-2 relative before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-border">
                      {doc.versions.map((v, i) => (
                        <div key={v.id} className="relative flex items-center gap-3 pl-8">
                          <div className={cn("absolute left-1.5 h-2 w-2 rounded-full", i === 0 ? "bg-primary ring-4 ring-primary/10" : "bg-slate-300 dark:bg-slate-700")} />
                          <div className="flex-1 flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-lg border text-xs shadow-sm">
                            <div>
                              <span className="font-semibold mr-2">Version {v.versionNumber}</span>
                              <span className="text-muted-foreground">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v.createdAt))}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">{formatSize(v.sizeBytes)}</span>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleDownload(doc.id, v.id)}>
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
