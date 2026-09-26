"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  User,
  X,
  CreditCard,
  ShoppingCart,
  Ship,
  DollarSign,
  Download,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getCrmTranslation } from "@/lib/crm/crm-i18n";

interface CustomerProfile360FullProps {
  customerId: string;
  onClose: () => void;
}

export function CustomerProfile360Full({ customerId, onClose }: CustomerProfile360FullProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const t = getCrmTranslation(lang);

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "sales" | "purchases" | "cheques" | "shipping">("timeline");

  // Log activity modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<"Call" | "Meeting" | "Message" | "Note">("Call");
  const [notes, setNotes] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/crm/customer-360?customerId=${encodeURIComponent(customerId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProfileData(json.data);
      }
    } catch (err) {
      console.error("Failed to load customer profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchProfile();
    }
  }, [customerId]);

  const handleSaveActivity = async () => {
    if (!notes.trim()) return;
    setSavingActivity(true);
    try {
      const res = await fetch("/api/erp/crm/customer-360", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          activityType,
          notes,
          promiseDate: promiseDate || null,
          promiseAmount: promiseAmount ? parseFloat(promiseAmount) : null
        })
      });
      const json = await res.json();
      if (json.success) {
        setLogModalOpen(false);
        setNotes("");
        setPromiseDate("");
        setPromiseAmount("");
        fetchProfile();
      }
    } catch (err) {
      console.error("Failed to save activity:", err);
    } finally {
      setSavingActivity(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[600px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Loading Customer 360 Full Profile...</p>
      </div>
    );
  }

  if (!profileData || !profileData.customer) {
    return (
      <div className="w-full p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200">
        <p className="text-slate-500 mb-4">Customer profile not found.</p>
        <Button onClick={onClose} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const { customer, financialSummary, salesOrders, purchaseOrders, cheques, shippingAndClearing, timeline } = profileData;

  const handleDownloadStatement = () => {
    if (!profileData) return;
    const { customer, financialSummary, salesOrders, purchaseOrders, cheques, shippingAndClearing, timeline } = profileData;
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    let csvContent = "";
    csvContent += `CUSTOMER 360 STATEMENT REPORT\n`;
    csvContent += `Generated At,"${nowStr}"\n`;
    csvContent += `Customer ID,"${customer.customerCode || ""}"\n`;
    csvContent += `Company Name,"${(customer.companyName || "").replace(/"/g, '""')}"\n`;
    csvContent += `Contact Person,"${(customer.customerName || "").replace(/"/g, '""')}"\n`;
    csvContent += `Phone,"${customer.mobile || ""}"\n`;
    csvContent += `Email,"${customer.email || ""}"\n`;
    csvContent += `Country,"${customer.countryName || ""}"\n`;
    csvContent += `Branch / City,"${customer.cityName || ""} (${customer.branchName || ""})"\n`;
    csvContent += `Sales Manager,"${customer.assignedUserName || ""}"\n\n`;

    csvContent += `FINANCIAL POSITION SUMMARY\n`;
    csvContent += `Currency,"${financialSummary.currency || "AED"}"\n`;
    csvContent += `Total Receivables,"${financialSummary.totalReceivable || 0}"\n`;
    csvContent += `Total Payables,"${financialSummary.totalPayable || 0}"\n`;
    csvContent += `Net Financial Position,"${financialSummary.netPosition || 0}"\n`;
    csvContent += `Uncleared Cheques Count,"${financialSummary.chequesCount || 0}"\n\n`;

    csvContent += `SALES ORDERS / QUOTATIONS (${(salesOrders || []).length})\n`;
    csvContent += `Order #,Date,Amount,Currency,Status\n`;
    (salesOrders || []).forEach((o: any) => {
      csvContent += `"${o.orderNumber || ""}","${o.date || ""}","${o.amount || 0}","${o.currency || "AED"}","${o.status || ""}"\n`;
    });
    csvContent += `\n`;

    csvContent += `PURCHASE ORDERS (${(purchaseOrders || []).length})\n`;
    csvContent += `Order #,Date,Amount,Currency,Status\n`;
    (purchaseOrders || []).forEach((p: any) => {
      csvContent += `"${p.orderNumber || ""}","${p.date || ""}","${p.amount || 0}","${p.currency || "AED"}","${p.status || ""}"\n`;
    });
    csvContent += `\n`;

    csvContent += `BANK CHEQUES REGISTER (${(cheques || []).length})\n`;
    csvContent += `Cheque #,Bank,Due Date,Amount,Type,Status\n`;
    (cheques || []).forEach((ch: any) => {
      csvContent += `"${ch.chequeNumber || ""}","${ch.bankName || ""}","${ch.dueDate || ""}","${ch.amount || 0}","${ch.type || ""}","${ch.status || ""}"\n`;
    });
    csvContent += `\n`;

    csvContent += `SHIPPING & CLEARING ORDERS (${(shippingAndClearing || []).length})\n`;
    csvContent += `Ref #,Line / Agent,Date,Status\n`;
    (shippingAndClearing || []).forEach((s: any) => {
      csvContent += `"${s.orderRef || ""}","${s.shippingLine || ""}","${s.date || ""}","${s.status || ""}"\n`;
    });
    csvContent += `\n`;

    csvContent += `ACTIVITY TIMELINE NOTES (${(timeline || []).length})\n`;
    csvContent += `Date,Type,Performed By,Notes / Outcome\n`;
    (timeline || []).forEach((tl: any) => {
      csvContent += `"${tl.date || ""}","${tl.type || ""}","${tl.user || ""}","${(tl.notes || "").replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer_360_statement_${customer.customerCode || "profile"}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`w-full min-h-screen pb-12 font-sans space-y-6 ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Banner Navigation & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs gap-1.5"
          >
            <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
            <span>{t.backToRegister}</span>
          </Button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {customer.companyName}
              </h2>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                {customer.customerCode}
              </Badge>
              <Badge className={`text-[11px] font-bold ${customer.isActive ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                {customer.isActive ? t.statusActive : t.statusAtRisk}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{customer.customerName}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-rose-500" />
                {customer.cityName}, {customer.countryName} ({customer.branchName})
              </span>
            </p>
          </div>
        </div>

        {/* Right action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setLogModalOpen(true)}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5 px-4 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.logNewActivity}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadStatement}
            className="h-9 border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/70 rounded-xl text-xs font-bold gap-1.5 px-3"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t.downloadFullStatement}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="h-9 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold gap-1.5 px-3"
          >
            <Printer className="h-3.5 w-3.5 text-amber-500" />
            <span>{t.printReport}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>{t.totalReceivable}</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">
            {financialSummary.currency} {Number(financialSummary.totalReceivable || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            {financialSummary.salesOrdersCount} {t.salesOrders}
          </p>
        </div>

        {/* Total Payables */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>{t.totalPayable}</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">
            {financialSummary.currency} {Number(financialSummary.totalPayable || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-blue-600 font-semibold mt-1">
            {financialSummary.purchaseOrdersCount} {t.purchases}
          </p>
        </div>

        {/* Net Position */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>{t.netPosition}</span>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-xl font-black ${financialSummary.netPosition >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {financialSummary.currency} {Number(financialSummary.netPosition || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Receivable - Payable Net
          </p>
        </div>

        {/* Cheques Outstanding */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>{t.chequesBalance}</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">
            {cheques.length} Cheques
          </div>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">
            Active in Banking & Clearing
          </p>
        </div>
      </div>

      {/* Main Workspace: Left Tabs Nav & Right Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-6 pt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "timeline"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{t.activityTimeline} ({timeline.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "sales"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>{t.salesOrders} ({salesOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "purchases"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>{t.purchases} ({purchaseOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cheques")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "cheques"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{t.cheques} ({cheques.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shipping")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "shipping"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Ship className="h-3.5 w-3.5" />
            <span>{t.shippingClearing} ({shippingAndClearing.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {/* TAB 1: Activity Timeline */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t.activityTimeline}
                </h3>
                <Button
                  size="sm"
                  onClick={() => setLogModalOpen(true)}
                  className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {t.logNewActivity}
                </Button>
              </div>

              {timeline.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No interactions recorded yet. Click &quot;Log Interaction&quot; to add a call, meeting, WhatsApp, or note.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6">
                  {timeline.map((item: any, idx: number) => {
                    const isCall = item.type?.toLowerCase().includes("call");
                    const isMeeting = item.type?.toLowerCase().includes("meet");
                    const isMessage = item.type?.toLowerCase().includes("mess");

                    return (
                      <div key={idx} className="relative pl-6">
                        {/* Dot indicator */}
                        <span className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                          isCall ? "bg-emerald-500" : isMeeting ? "bg-purple-500" : isMessage ? "bg-teal-500" : "bg-blue-500"
                        }`} />

                        <div className="bg-slate-50/80 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {isCall && <Phone className="h-3.5 w-3.5 text-emerald-600" />}
                              {isMeeting && <Calendar className="h-3.5 w-3.5 text-purple-600" />}
                              {isMessage && <MessageCircle className="h-3.5 w-3.5 text-teal-600" />}
                              {!isCall && !isMeeting && !isMessage && <FileText className="h-3.5 w-3.5 text-blue-600" />}
                              <span>{item.type}</span>
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {new Date(item.date).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap mt-1">
                            {item.content}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                            <span>Logged by: <strong className="text-slate-600 dark:text-slate-300">{item.author}</strong> ({item.role})</span>
                            {item.promiseDate && (
                              <span className="text-amber-600 font-bold">
                                Promise Due: {item.promiseDate} {item.promiseAmount ? `(${item.promiseAmount})` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Sales Orders */}
          {activeTab === "sales" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t.salesOrders} ({salesOrders.length})
                </h3>
              </div>

              {salesOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No sales orders found for this customer.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">Contract #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-right">Paid</th>
                        <th className="p-3 text-right">Remaining</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {salesOrders.map((so: any) => (
                        <tr key={so.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-blue-600">{so.salesOrderNo || so.id.slice(0, 8)}</td>
                          <td className="p-3 font-mono text-slate-600">{so.salesContractNo || "-"}</td>
                          <td className="p-3 text-slate-600">{so.orderDate}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{so.currency} {Number(so.orderTotal).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">{so.currency} {Number(so.paidAmount).toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-600 font-bold">{so.currency} {Number(so.remainingAmount).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {so.salesStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={so.link}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md"
                            >
                              <span>{t.openOriginalRecord}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Purchases */}
          {activeTab === "purchases" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.purchases} ({purchaseOrders.length})
              </h3>
              {purchaseOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No purchase orders found for this party.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">PO #</th>
                        <th className="p-3">Contract #</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-right">Advance Paid</th>
                        <th className="p-3 text-right">Remaining Due</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {purchaseOrders.map((po: any) => (
                        <tr key={po.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-blue-600">{po.purchaseOrderNo}</td>
                          <td className="p-3 font-mono text-slate-600">{po.contractNo || "-"}</td>
                          <td className="p-3 text-right font-bold">{po.currency} {Number(po.orderTotal).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600">{po.currency} {Number(po.advancePaid).toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-600 font-bold">{po.currency} {Number(po.remainingDue).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {po.paymentStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={po.link}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md"
                            >
                              <span>{t.openOriginalRecord}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Cheques */}
          {activeTab === "cheques" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.cheques} ({cheques.length})
              </h3>
              {cheques.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No cheque entries found for this party.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Cheque #</th>
                        <th className="p-3">Bank Name</th>
                        <th className="p-3">Particulars</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3 text-right">Debit</th>
                        <th className="p-3 text-right">Credit</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {cheques.map((ch: any) => (
                        <tr key={ch.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-blue-600">{ch.chequeNo}</td>
                          <td className="p-3 text-slate-700">{ch.bankName}</td>
                          <td className="p-3 text-slate-600">{ch.particulars}</td>
                          <td className="p-3 text-slate-600">{ch.dueDate}</td>
                          <td className="p-3 text-right text-emerald-600 font-bold">{ch.currency} {Number(ch.debit).toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-600 font-bold">{ch.currency} {Number(ch.credit).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                              {ch.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={ch.link}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md"
                            >
                              <span>{t.openOriginalRecord}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Shipping & Clearing */}
          {activeTab === "shipping" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.shippingClearing} ({shippingAndClearing.length})
              </h3>
              {shippingAndClearing.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No shipping or clearing orders found for this party.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Type</th>
                        <th className="p-3">Reference / Order #</th>
                        <th className="p-3">Details / Route</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {shippingAndClearing.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-600">{item.referenceNo}</td>
                          <td className="p-3 text-slate-700">{item.details}</td>
                          <td className="p-3 text-slate-600">{item.date}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={item.link}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md"
                            >
                              <span>{t.openOriginalRecord}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Log Activity Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {t.logNewActivity}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">{t.selectType}</label>
              <div className="grid grid-cols-4 gap-2">
                {(["Call", "Meeting", "Message", "Note"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      activityType === type
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Note text */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">{t.noteText}</label>
              <textarea
                placeholder={t.noteText || "Enter details..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Promise Date & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Next Action Date</label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="text-xs rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Committed Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  className="text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogModalOpen(false)}
              className="text-xs rounded-xl"
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleSaveActivity}
              disabled={savingActivity || !notes.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
            >
              {savingActivity ? "Saving..." : t.saveActivity}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
