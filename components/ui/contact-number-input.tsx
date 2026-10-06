"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCountryCallingCodes } from "@/features/contact-types/use-country-calling-code";
import type { ContactTypeKey } from "@/features/contact-types/contact-type-api";

function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

function splitCallingCode(full: string) {
  const trimmed = full.trim();
  if (!trimmed.startsWith("+")) return { code: "", rest: trimmed };
  // naive split: +<1-6 digits>
  const m = /^\+([0-9]{1,6})(.*)$/.exec(trimmed);
  if (!m) return { code: "", rest: trimmed };
  return { code: `+${m[1]}`, rest: m[2] ?? "" };
}

export function ContactNumberInput({
  label,
  countryId,
  contactTypeKey,
  value,
  disabled,
  placeholder,
  hideLabel,
  showHelp,
  onValueChange
}: {
  label: string;
  countryId: string | null;
  contactTypeKey: ContactTypeKey;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  hideLabel?: boolean;
  showHelp?: boolean;
  onValueChange: (nextFull: string) => void;
}) {
  const { callingCodeByType } = useCountryCallingCodes(countryId);
  const callingCode = callingCodeByType.get(contactTypeKey) ?? "";

  const [local, setLocal] = useState("");

  // Keep local number in sync with external value.
  useEffect(() => {
    const { rest } = splitCallingCode(value || "");
    setLocal(digitsOnly(rest));
  }, [value]);

  // When country/calling code changes, auto-prefix if the user hasn't entered a different code manually.
  useEffect(() => {
    if (!callingCode) return;
    if (!value) return;
    const { code, rest } = splitCallingCode(value);
    if (!code || code === callingCode) {
      const next = `${callingCode}${digitsOnly(rest)}`;
      if (next !== value) onValueChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callingCode]);

  const displayCode = callingCode || "+";

  const help = useMemo(() => {
    if (!callingCode) return "Select Country to load calling code.";
    return `Auto code: ${callingCode}`;
  }, [callingCode]);

  const compact = Boolean(hideLabel) && showHelp === false;

  return (
    <div className={compact ? "" : "space-y-2"}>
      {hideLabel ? null : <Label>{label}</Label>}
      <div className={cn("flex overflow-hidden rounded-lg border bg-background", disabled && "opacity-60")}>
        <div className="grid min-w-[64px] place-items-center border-r bg-muted/30 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {displayCode}
        </div>
        <Input
          className="border-0"
          value={local}
          onChange={(e) => {
            const nextLocal = digitsOnly(e.target.value);
            setLocal(nextLocal);
            const nextFull = callingCode ? `${callingCode}${nextLocal}` : nextLocal;
            onValueChange(nextFull);
          }}
          disabled={disabled}
          placeholder={placeholder ?? "Enter number"}
          inputMode="numeric"
        />
      </div>
      {showHelp === false ? null : <div className="text-xs text-muted-foreground">{help}</div>}
    </div>
  );
}
