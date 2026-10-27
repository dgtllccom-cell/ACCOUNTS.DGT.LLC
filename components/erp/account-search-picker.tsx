"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { CustomerAccountCard } from "@/components/erp/customer-account-card";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export interface AccountSearchPickerProps {
  label?: string;
  value: string;
  onValueChange: (accountId: string, account?: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  scope?: "all" | "business" | "shipping" | "money_exchange";
  accounts?: any[];
  showSelectedCard?: boolean;
  className?: string;
  onEditAccount?: (accountId: string) => void;
}

export function AccountSearchPicker({
  label,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  disabled,
  required,
  scope = "all",
  accounts: externalAccounts,
  showSelectedCard = false,
  className,
  onEditAccount
}: AccountSearchPickerProps) {
  const lang = useActiveLanguage();
  const [internalAccounts, setInternalAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (externalAccounts && externalAccounts.length > 0) return;

    let active = true;
    setLoading(true);
    const endpoint = scope === "shipping"
      ? "/api/erp/ledger-report/ledgers?scope=shipping&limit=500"
      : scope === "money_exchange"
      ? "/api/erp/ledger-report/ledgers?scope=money_exchange&limit=500"
      : "/api/erp/accounts?limit=500";

    apiGet<{ accounts?: any[]; ledgers?: any[] }>(endpoint)
      .then((res) => {
        if (!active) return;
        const list = res?.accounts || res?.ledgers || [];
        setInternalAccounts(list);
      })
      .catch(() => {
        // Fallback or silence
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [externalAccounts, scope]);

  const accountList = externalAccounts || internalAccounts;

  const options: SearchSelectOption[] = useMemo(() => {
    return (accountList || []).map((acc: any) => {
      const id = acc.id || acc.accountId || acc.ledgerId || "";
      const code = acc.code || acc.accountCode || acc.ledgerCode || "";
      const name = acc.name || acc.accountName || acc.ledgerName || "";
      const companyName = acc.companyName || acc.company_name || "";
      const phone = acc.phone || acc.mobile || acc.whatsapp || acc.contacts?.phone || acc.contacts?.mobile || "";
      const email = acc.email || acc.contacts?.email || "";
      const address = acc.address || [acc.cityName || acc.city_name, acc.countryName || acc.country_name].filter(Boolean).join(", ");
      const branch = acc.branchName || acc.cityBranchName || acc.branch || "";
      const city = acc.cityName || acc.city_name || "";
      const country = acc.countryName || acc.country_name || "";
      const category = acc.category || acc.accountKind || acc.account_type || "Customer / Account";
      const status = acc.is_active === false ? "Inactive" : "Active";

      const keywords = [
        code,
        name,
        companyName,
        phone,
        email,
        address,
        branch,
        city,
        country,
        category
      ].filter(Boolean).join(" ");

      return {
        value: id,
        label: `${code ? code + " — " : ""}${name}`,
        keywords,
        primaryText: name,
        code,
        companyName,
        category,
        phone,
        email,
        address,
        branch,
        city,
        country,
        status,
        isAccountCard: true,
        onEdit: onEditAccount ? () => onEditAccount(id) : undefined
      };
    });
  }, [accountList, onEditAccount]);

  const selectedAccount = useMemo(() => {
    return (accountList || []).find((a: any) => (a.id || a.accountId || a.ledgerId || a.code || a.accountCode) === value) || null;
  }, [accountList, value]);

  const displayLabel = label ?? `${t(lang, "roz.owner_customer", "Customer & Account")}${required ? " *" : ""}`;

  return (
    <div className={className}>
      <SearchSelect
        label={displayLabel}
        value={value}
        options={options}
        placeholder={placeholder ?? t(lang, "common.select", "Select Customer & Account...")}
        searchPlaceholder={searchPlaceholder ?? "Enter customer name, account number, company, phone or address..."}
        disabled={disabled || loading}
        loading={loading}
        accountCards
        richList
        onValueChange={(val: string) => {
          const match = (accountList || []).find((a: any) => (a.id || a.accountId || a.ledgerId) === val);
          onValueChange(val, match);
        }}
        onEditOption={onEditAccount}
      />

      {showSelectedCard && selectedAccount && (
        <div className="mt-2.5">
          <CustomerAccountCard
            account={{
              id: selectedAccount.id || selectedAccount.accountId || selectedAccount.ledgerId,
              name: selectedAccount.name || selectedAccount.accountName || selectedAccount.ledgerName,
              code: selectedAccount.code || selectedAccount.accountCode || selectedAccount.ledgerCode,
              companyName: selectedAccount.companyName || selectedAccount.company_name,
              category: selectedAccount.category || selectedAccount.accountKind,
              phone: selectedAccount.phone || selectedAccount.mobile || selectedAccount.contacts?.phone,
              email: selectedAccount.email || selectedAccount.contacts?.email,
              address: selectedAccount.address,
              branch: selectedAccount.branchName || selectedAccount.cityBranchName,
              city: selectedAccount.cityName,
              country: selectedAccount.countryName,
              status: selectedAccount.is_active === false ? "Inactive" : "Active",
              currency: selectedAccount.currency || selectedAccount.ledgerCurrency,
              balance: selectedAccount.balance ?? selectedAccount.currentBalance
            }}
            onEdit={onEditAccount ? () => onEditAccount(selectedAccount.id || selectedAccount.accountId) : undefined}
            onClear={() => onValueChange("", null)}
            clearLabel={t(lang, "common.clear", "Disconnect")}
            selected
          />
        </div>
      )}
    </div>
  );
}
