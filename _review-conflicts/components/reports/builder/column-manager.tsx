"use client";
import { useState } from "react";
import { type ReportColumnConfig } from "./types";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff } from "lucide-react";

type ColumnManagerProps = {
  columns: ReportColumnConfig[];
  onChange: (columns: ReportColumnConfig[]) => void;
};

export function ColumnManager({ columns, onChange }: ColumnManagerProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const sourceIndex = columns.findIndex((c) => c.id === draggedId);
    const targetIndex = columns.findIndex((c) => c.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newColumns = [...columns];
    const [movedItem] = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, movedItem);

    // Update order property
    const reordered = newColumns.map((col, idx) => ({ ...col, order: idx }));
    onChange(reordered);
    setDraggedId(null);
  };

  const toggleVisibility = (id: string, checked: boolean) => {
    onChange(columns.map((c) => (c.id === id ? { ...c, visible: checked } : c)));
  };

  return (
    <div className="space-y-2 p-2">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        Drag to Reorder Columns
      </div>
      <div className="space-y-1">
        {columns.map((col) => (
          <div
            key={col.id}
            draggable
            onDragStart={(e) => handleDragStart(e, col.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragEnd={() => setDraggedId(null)}
            className={`flex items-center gap-3 p-2 rounded-md border bg-white dark:bg-slate-900 transition-colors ${
              draggedId === col.id ? "opacity-50 border-blue-500 shadow-md" : "border-slate-200 dark:border-slate-800"
            } hover:border-slate-300 dark:hover:border-slate-700 cursor-move`}
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
            <input
              type="checkbox"
              checked={col.visible}
              onChange={(e) => toggleVisibility(col.id, e.target.checked)}
              id={`col-${col.id}`}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor={`col-${col.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
            >
              {col.label}
            </label>
            {col.visible ? (
              <Eye className="h-4 w-4 text-slate-400" />
            ) : (
              <EyeOff className="h-4 w-4 text-slate-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
