import fs from 'fs';

const oldContent = fs.readFileSync('features/accounts/components/account-live-report-panel.tsx', 'utf8');

const header = `"use client";

import type { ReactNode } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useMemo } from "react";
import {
  Info,
  UserRound,
  Building2,
  Landmark,
  Warehouse,
  ShieldAlert,
  Printer,
  FileText,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { transliterateProperNoun, localizeTerm } from "@/lib/i18n/transliteration";

export type AccountLiveReportProps = {
  // Wizard States
  accountName: string;
  accountCode: string;
  accountTitle: string;
  subType: string;
  category: string;
  manualReferenceNumber?: string;
  currency: string;
  status?: string;
  lang?: SupportedLanguage;
  contacts?: Array<{ type: string; value: string }>;

  // Connected Master details
  customerDetail?: any;
  companyDetail?: any;
`;

const body = oldContent.substring(oldContent.indexOf('  bankDetail?: any;'));
fs.writeFileSync('features/accounts/components/account-live-report-panel.tsx', header + body, 'utf8');
console.log('✅ features/accounts/components/account-live-report-panel.tsx header restored cleanly!');
