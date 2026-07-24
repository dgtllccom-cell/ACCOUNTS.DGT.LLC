"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Save, FileText, Anchor, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleModal } from "@/components/ui/simple-modal";
import { listCountries } from "@/features/locations/location-api";

export type TaxCodeRow = {
  id: string;
  taxName: string;
  taxPct: number;
  countryName: string;
};

import { apiGet, apiPost, apiDelete } from "@/lib/api/client";

export default function TaxesManagementClient({ session }: { session: any }) {
  const [taxes, setTaxes] = useState<TaxCodeRow[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    taxName: "",
    taxPct: "",
    countryName: ""
  });

  const fetchTaxes = async () => {
    try {
      const data = await apiGet("/api/erp/master-data/taxes");
      setTaxes(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTaxes();
    listCountries().then(res => setCountries(res)).catch(() => null);
  }, []);

  const handleAddTax = async () => {
    if (!form.taxName || !form.taxPct || !form.countryName) {
      alert("All fields are required");
      return;
    }
    
    try {
      await apiPost("/api/erp/master-data/taxes", {
        taxName: form.taxName,
        taxPct: form.taxPct,
        countryName: form.countryName
      });
      await fetchTaxes();
      setIsModalOpen(false);
      setForm({ taxName: "", taxPct: "", countryName: "" });
    } catch (err: any) {
      alert(err.message || "Failed to add tax");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tax code?")) return;
    try {
      await apiDelete(`/api/erp/master-data/taxes/${id}`);
      await fetchTaxes();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Settings / Management</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Tax Codes</h1>
          <p className="mt-2 text-sm text-slate-500">
            Define global tax codes by country. These will appear in dropdowns across the ERP (e.g. Expenses Bill).
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2 shadow-sm font-semibold">
          <Plus className="h-4 w-4" /> Add Tax Code
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Country</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tax Name</th>
                <th className="px-4 py-3 font-semibold text-right text-slate-600">Percentage</th>
                <th className="px-4 py-3 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {taxes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No tax codes defined yet.
                  </td>
                </tr>
              ) : (
                taxes.map(tax => (
                  <tr key={tax.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{tax.countryName}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{tax.taxName}</td>
                    <td className="px-4 py-3 text-right font-mono text-primary bg-primary/5">{tax.taxPct}%</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(tax.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {isModalOpen && (
      <SimpleModal onClose={() => setIsModalOpen(false)} title="Add New Tax Code">
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Country</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={form.countryName}
              onChange={e => setForm({...form, countryName: e.target.value})}
            >
              <option value="">Select Country...</option>
              {countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="United Arab Emirates">United Arab Emirates</option>
              <option value="Pakistan">Pakistan</option>
              <option value="Afghanistan">Afghanistan</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Tax Name</Label>
            <Input placeholder="e.g. VAT, GST, BRT" value={form.taxName} onChange={e => setForm({...form, taxName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 font-bold">Percentage (%)</Label>
            <Input type="number" step="0.01" placeholder="e.g. 5.0" value={form.taxPct} onChange={e => setForm({...form, taxPct: e.target.value})} />
          </div>
          
          <div className="pt-4 flex justify-end gap-2 border-t mt-6">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTax} className="font-bold">Save Tax Code</Button>
          </div>
        </div>
      </SimpleModal>
      )}
    </div>
  );
}
