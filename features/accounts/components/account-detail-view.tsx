"use client";
import { useState, useEffect } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

type Account = {
  id: string;
  code: string;
  name: string;
  country?: { name: string };
  linked_companies: any[];
  linked_banks: any[];
  linked_warehouses: any[];
  linked_customers: any[];
};

type MasterRecord = { id: string; name: string; code: string };

export function AccountDetailView({ accountId }: { accountId: string }) {
  const lang = useActiveLanguage();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<{
    companies: MasterRecord[];
    banks: MasterRecord[];
    warehouses: MasterRecord[];
    customers: MasterRecord[];
  }>({ companies: [], banks: [], warehouses: [], customers: [] });

  useEffect(() => {
    loadAccount();
    loadMasterData();
  }, [accountId]);

  async function loadAccount() {
    try {
      const res = await apiGet<{ account: Account }>(`/api/erp/accounts/${accountId}`);
      setAccount(res.account);
    } catch (err) {
      console.error("Failed to load account:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMasterData() {
    try {
      const [companies, banks, warehouses, customers] = await Promise.all([
        apiGet<{ companies: MasterRecord[] }>("/api/erp/companies"),
        apiGet<{ banks: MasterRecord[] }>("/api/erp/banks"),
        apiGet<{ warehouses: MasterRecord[] }>("/api/erp/warehouses"),
        apiGet<{ customers: MasterRecord[] }>("/api/erp/customers")
      ]);
      setMasterData({
        companies: companies.companies || [],
        banks: banks.banks || [],
        warehouses: warehouses.warehouses || [],
        customers: customers.customers || []
      });
    } catch (err) {
      console.error("Failed to load master data:", err);
    }
  }

  async function linkItem(type: string, itemId: string) {
    try {
      await apiPost(`/api/erp/accounts/${accountId}/links`, {
        type,
        linkedId: itemId,
        action: "add"
      });
      loadAccount();
    } catch (err: any) {
      alert(`${t(lang, "acct.adv_failed_to_link", "Failed to link:")} ${err.message}`);
    }
  }

  async function unlinkItem(type: string, itemId: string) {
    try {
      await apiPost(`/api/erp/accounts/${accountId}/links`, {
        type,
        linkedId: itemId,
        action: "remove"
      });
      loadAccount();
    } catch (err: any) {
      alert(`${t(lang, "acct.adv_failed_to_unlink", "Failed to unlink:")} ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!account) {
    return <div className="p-4 text-red-600">{t(lang, "acct.adv_account_not_found", "Account not found")}</div>;
  }

  const getAvailableForLink = (type: string) => {
    const linked = account[`linked_${type}` as keyof Account] as any[] || [];
    const linkedIds = new Set(linked.map((l: any) => l.id));
    return masterData[type as keyof typeof masterData].filter((m: any) => !linkedIds.has(m.id));
  };

  const LinkSection = ({ type, title, linked, available }: any) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">{t(lang, "acct.adv_currently_linked", "Currently Linked")} ({linked.length})</h4>
          {linked.length === 0 ? (
            <p className="text-slate-500 text-sm italic">{t(lang, "acct.adv_no_linked_records", "No linked records")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linked.map((item: any) => (
                <div key={item.id} className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span>{item.name || item.code}</span>
                  <button
                    onClick={() => unlinkItem(type, item.id)}
                    className="hover:text-red-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2">{t(lang, "acct.adv_available_to_link", "Available to Link")} ({available.length})</h4>
          {available.length === 0 ? (
            <p className="text-slate-500 text-sm italic">All {title.toLowerCase()} {t(lang, "acct.adv_all_linked_suffix", "are linked")}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {available.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border border-slate-200">
                  <span className="text-sm">{item.name || item.code}</span>
                  <button
                    onClick={() => linkItem(type, item.id)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t(lang, "acct.adv_link_btn", "Link")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "roz.col_account_details", "Account Details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">{t(lang, "common.code", "Code")}</p>
              <p className="font-mono font-semibold">{account.code}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">{t(lang, "common.name", "Name")}</p>
              <p className="font-semibold">{account.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">{t(lang, "report.country", "Country")}</p>
              <p>{account.country?.name || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <LinkSection
          type="companies"
          title={t(lang, "acct.adv_linked_companies", "Linked Companies")}
          linked={account.linked_companies}
          available={getAvailableForLink("companies")}
        />
        <LinkSection
          type="banks"
          title={t(lang, "acct.adv_linked_banks", "Linked Banks")}
          linked={account.linked_banks}
          available={getAvailableForLink("banks")}
        />
        <LinkSection
          type="warehouses"
          title={t(lang, "acct.adv_linked_warehouses", "Linked Warehouses")}
          linked={account.linked_warehouses}
          available={getAvailableForLink("warehouses")}
        />
        <LinkSection
          type="customers"
          title={t(lang, "acct.adv_linked_customers_owners", "Linked Customers/Owners")}
          linked={account.linked_customers}
          available={getAvailableForLink("customers")}
        />
      </div>
    </div>
  );
}
