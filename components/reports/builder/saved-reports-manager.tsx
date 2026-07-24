"use client";
import { useState, useEffect } from "react";
import { type SavedReportConfig } from "./types";
import { Button } from "@/components/ui/button";
import { Bookmark, Save, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type SavedReportsManagerProps = {
  moduleName: string;
  currentConfig: Omit<SavedReportConfig, "name" | "module">;
  onLoadReport: (config: SavedReportConfig) => void;
};

export function SavedReportsManager({ moduleName, currentConfig, onLoadReport }: SavedReportsManagerProps) {
  const [reports, setReports] = useState<SavedReportConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [moduleName]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/erp/reports/saved?module=${moduleName}`);
      const json = await res.json();
      if (json.success) {
        setReports(json.data.map((r: any) => ({
          id: r.id,
          name: r.name,
          module: r.module,
          isPublic: r.isPublic,
          ...r.config,
        })));
      }
    } catch (e) {
      console.error("Failed to load saved reports", e);
    }
  };

  const handleSave = async () => {
    if (!newReportName.trim()) return;
    setLoading(true);
    try {
      const configToSave = { ...currentConfig };
      const res = await fetch(`/api/erp/reports/saved`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newReportName,
          module: moduleName,
          isPublic,
          config: configToSave,
        }),
      });
      if (res.ok) {
        setSaveDialogOpen(false);
        setNewReportName("");
        setIsPublic(false);
        fetchReports();
      }
    } catch (e) {
      console.error("Failed to save report", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved report?")) return;
    try {
      const res = await fetch(`/api/erp/reports/saved/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select 
          className="w-[200px] h-9 text-xs border rounded-md px-8 appearance-none bg-white"
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            const rep = reports.find((r) => r.id === val);
            if (rep) onLoadReport(rep);
            e.target.value = ""; // Reset after selection
          }}
          defaultValue=""
        >
          <option value="" disabled>Load Saved Report...</option>
          {reports.length === 0 ? (
            <option disabled>No saved reports</option>
          ) : (
            reports.map((r) => (
              <option key={r.id} value={r.id!}>
                {r.name}
              </option>
            ))
          )}
        </select>
        <Bookmark className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-600 pointer-events-none" />
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 text-xs">
            <Save className="h-3.5 w-3.5 mr-1" /> Save Layout
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Save Custom Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Report Name</label>
              <Input
                placeholder="e.g., Pakistan Pending Payments"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isPublic" className="text-sm font-medium leading-none cursor-pointer">
                Share with other users (Public)
              </label>
            </div>
            
            <div className="bg-slate-50 p-3 rounded text-xs space-y-1.5 border">
              <div className="font-semibold text-slate-700 mb-2">This will save:</div>
              <div className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-3 w-3 text-green-500" /> Selected columns & order</div>
              <div className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-3 w-3 text-green-500" /> Active filters</div>
              <div className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-3 w-3 text-green-500" /> Date range</div>
              <div className="flex items-center gap-2 text-slate-600"><CheckCircle2 className="h-3 w-3 text-green-500" /> Sorting rules</div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading || !newReportName.trim()}>
                {loading ? "Saving..." : "Save Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
