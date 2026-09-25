"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Search, Plus, Phone, Mail, MapPin, Building2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClearingAgentRow } from "@/lib/repositories/clearing-agents-repository";

export function ClearingAgentListView({ initialAgents }: { initialAgents: ClearingAgentRow[] }) {
  const [search, setSearch] = useState("");
  const [agents] = useState<ClearingAgentRow[]>(initialAgents);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.code || "").toLowerCase().includes(q) ||
      (a.contact_person || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q)
    );
  }, [agents, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400 uppercase tracking-wider">
            Directory & Roster
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Clearing Agent List</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registered customs brokers, clearing representatives and authorized shipping partners.
          </p>
        </div>
        <Link href="/dashboard/shipping-line/agent-entry">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            New Agent Entry
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search clearing agents by name, code, contact or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-xs h-9"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 whitespace-nowrap px-2">
          Total: {filtered.length} agent{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Agent Code</th>
                <th className="px-4 py-3">Agent Name</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Phone & Email</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
              {filtered.length > 0 ? (
                filtered.map((agent, index) => (
                  <tr key={agent.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{index + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {agent.clearing_agent_code || agent.code || `AG-${index + 1}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {(agent.name || "A").slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{agent.name}</p>
                          {agent.notes && <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{agent.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {agent.contact_person || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-[11px]">
                        {agent.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{agent.phone}</span>
                          </div>
                        )}
                        {agent.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate max-w-[150px]">{agent.email}</span>
                          </div>
                        )}
                        {!agent.phone && !agent.email && <span className="text-slate-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        (agent.status || "active") === "active"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      }`}>
                        {agent.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/shipping-line/agent-entry?editId=${agent.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Edit <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No clearing agents found matching &ldquo;{search}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
