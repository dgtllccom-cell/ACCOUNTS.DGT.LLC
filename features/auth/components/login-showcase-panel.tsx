"use client";

import React from "react";
import {
  Globe2,
  Zap,
  Layers3,
  ShieldCheck,
  Server,
  Lock,
  MapPin,
  Coins,
  Anchor,
  FileSpreadsheet,
  Building2,
  CheckCircle2,
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { useLoginScope } from "./login-scope-context";
import {
  DamanBusinessGroupEmblem,
  PakistanEmblem,
  AfghanistanEmblem,
  UaeEmblem,
  SaudiArabiaEmblem,
  IndiaEmblem,
  ChinaEmblem,
} from "./country-monograms";

interface CountryConfig {
  name: string;
  nativeName: string;
  flag: string;
  badge: string;
  title: string;
  subtitle: string;
  emblem: React.ReactNode;
  accentColor: string;
  glowClass: string;
  hubs: { title: string; subtitle: string; desc: string };
  currency: { title: string; subtitle: string; desc: string };
  ports: { title: string; subtitle: string; desc: string };
  ledger: { title: string; subtitle: string; desc: string };
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  Pakistan: {
    name: "Pakistan",
    nativeName: "پاکستان",
    flag: "🇵🇰",
    badge: "Pakistan Regional Operations",
    title: "Daman Business Group",
    subtitle: "Pakistan Regional Command & Multi-Branch Network",
    emblem: <PakistanEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(16,185,129,0.35)]" />,
    accentColor: "emerald",
    glowClass: "from-emerald-500/20 via-emerald-600/10 to-transparent",
    hubs: {
      title: "Chaman, Quetta, Karachi, Gwadar",
      subtitle: "Provincial Hubs & Checkposts",
      desc: "Chaman Border, Quetta Hub, Lahore, Peshawar, Torkham & Gwadar deep-sea hub.",
    },
    currency: {
      title: "PKR (Rs.) - Pakistani Rupee",
      subtitle: "State Bank & Daily Market Rates",
      desc: "Real-time multi-currency ledger auto conversion against AED, AFN, CNY, USD.",
    },
    ports: {
      title: "KPT, Port Qasim & Chaman Dry Port",
      subtitle: "Customs & Clearing Gateway",
      desc: "Seamless WebOC clearance, custom duty calculation, and transit container flow.",
    },
    ledger: {
      title: "Branch Roznamcha & Cashbooks",
      subtitle: "Daily Reconciled Balancing",
      desc: "Real-time dual-entry accounts, cash-in-hand verification & audited branch journals.",
    },
  },
  Afghanistan: {
    name: "Afghanistan",
    nativeName: "افغانستان",
    flag: "🇦🇫",
    badge: "Afghanistan Regional Operations",
    title: "Daman Business Group",
    subtitle: "Afghanistan Regional Command & Commercial Transit Hub",
    emblem: <AfghanistanEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(245,158,11,0.35)]" />,
    accentColor: "amber",
    glowClass: "from-amber-500/20 via-amber-600/10 to-transparent",
    hubs: {
      title: "Kabul, Kandahar, Herat, Spin Boldak",
      subtitle: "Major Commercial Hubs",
      desc: "Kabul HQ, Kandahar Bazaar, Herat Trade Center, Spin Boldak & Mazar-i-Sharif.",
    },
    currency: {
      title: "AFN (؋) - Afghan Afghani",
      subtitle: "Sarai Shahzada & DAB Rates",
      desc: "Real-time Afghani conversion with live Sarafi market quotes and multi-currency ledger.",
    },
    ports: {
      title: "Spin Boldak, Torkham & Islam Qala",
      subtitle: "Border Customs & Transit Post",
      desc: "Cross-border transit trade documentation, customs clearance & convoy tracking.",
    },
    ledger: {
      title: "Transit Trade & Roznamcha",
      subtitle: "Daily Cash & Merchant Ledger",
      desc: "Bilateral consignment accounting, merchant advances, and daily border closing.",
    },
  },
  "United Arab Emirates": {
    name: "United Arab Emirates",
    nativeName: "دولة الإمارات",
    flag: "🇦🇪",
    badge: "UAE Global Commercial HQ",
    title: "Daman Business Group",
    subtitle: "UAE Global Commercial Hub & Port Operations",
    emblem: <UaeEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(251,191,36,0.35)]" />,
    accentColor: "amber",
    glowClass: "from-amber-400/20 via-blue-600/10 to-transparent",
    hubs: {
      title: "Dubai, Abu Dhabi, Sharjah, JAFZA",
      subtitle: "Enterprise Headquarters",
      desc: "Central corporate command, Dubai business bay, Sharjah trade office & Jebel Ali free zone.",
    },
    currency: {
      title: "AED (د.إ) - UAE Dirham",
      subtitle: "Central Bank Pegged Settlement",
      desc: "Primary base currency for international trade financing, multi-currency treasury & LCs.",
    },
    ports: {
      title: "Jebel Ali Port & Port Rashid",
      subtitle: "Global Sea Logistics Gateway",
      desc: "End-to-end container tracking, port handling, shipping line bills of lading & manifests.",
    },
    ledger: {
      title: "Multi-Currency Corporate Treasury",
      subtitle: "Automated Daily Financial Closing",
      desc: "Consolidated group accounts, international supplier settlement & audited balance sheets.",
    },
  },
  "Saudi Arabia": {
    name: "Saudi Arabia",
    nativeName: "المملكة العربية السعودية",
    flag: "🇸🇦",
    badge: "Saudi Arabia Regional Operations",
    title: "Daman Business Group",
    subtitle: "Kingdom of Saudi Arabia Commercial Gateway",
    emblem: <SaudiArabiaEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(16,185,129,0.35)]" />,
    accentColor: "emerald",
    glowClass: "from-emerald-500/20 via-emerald-600/10 to-transparent",
    hubs: {
      title: "Riyadh, Jeddah, Dammam, Mecca",
      subtitle: "Commercial Kingdom Hubs",
      desc: "Riyadh Trade Center, Jeddah Port Offices, Dammam Logistics & Holy Cities supply.",
    },
    currency: {
      title: "SAR (﷼) - Saudi Riyal",
      subtitle: "SAMA Settled Accounts",
      desc: "Saudi Riyal invoicing, live cross-border conversions and automated currency balancing.",
    },
    ports: {
      title: "Jeddah Islamic Port & Dammam Port",
      subtitle: "Red Sea & Gulf Logistics",
      desc: "Full customs declaration clearance, container demurrages and sea freight tracking.",
    },
    ledger: {
      title: "ZATCA E-Invoicing & Ledgers",
      subtitle: "Enterprise Regulatory Compliance",
      desc: "Compliant corporate books, VAT/tax reporting, and branch balance sheet sync.",
    },
  },
  India: {
    name: "India",
    nativeName: "भारत",
    flag: "🇮🇳",
    badge: "India Commercial Trade Gateway",
    title: "Daman Business Group",
    subtitle: "India Regional Trade & Cross-Border Clearing",
    emblem: <IndiaEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(59,130,246,0.35)]" />,
    accentColor: "blue",
    glowClass: "from-blue-500/20 via-orange-500/10 to-transparent",
    hubs: {
      title: "Delhi, Mumbai, Attari Border, Amritsar",
      subtitle: "Commercial & Border Trade Hubs",
      desc: "Delhi Commercial Office, Mumbai JNPT logistics, and Attari ICP border clearing.",
    },
    currency: {
      title: "INR (₹) - Indian Rupee",
      subtitle: "Reserve Bank of India Rates",
      desc: "Live Rupee trade pricing, bank rate synchronization and import-export reconciliations.",
    },
    ports: {
      title: "Attari ICP & Nhava Sheva (JNPT)",
      subtitle: "Dry Port & Container Freight",
      desc: "Integrated Check Post documentation, bilateral clearing, and sea freight handling.",
    },
    ledger: {
      title: "Cross-Border Commercial Ledger",
      subtitle: "Reconciled Trade Accounts",
      desc: "Multi-party trade settlements, bill of entry tracking, and audited journals.",
    },
  },
  China: {
    name: "China",
    nativeName: "中国",
    flag: "🇨🇳",
    badge: "China Direct Procurement Hub",
    title: "Daman Business Group",
    subtitle: "China Direct Procurement & Industrial Export Hub",
    emblem: <ChinaEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(239,68,68,0.35)]" />,
    accentColor: "red",
    glowClass: "from-red-500/20 via-amber-500/10 to-transparent",
    hubs: {
      title: "Shenzhen, Guangzhou, Yiwu, Shanghai",
      subtitle: "Manufacturing & Sourcing Centers",
      desc: "Yiwu Commodities Market, Shenzhen Electronics, Guangzhou Textile & Ningbo Port.",
    },
    currency: {
      title: "CNY / RMB (¥) - Chinese Yuan",
      subtitle: "People's Bank of China Rates",
      desc: "Direct supplier Yuan payments, FX settlement and container unit cost conversion.",
    },
    ports: {
      title: "Ningbo-Zhoushan & Shenzhen Port",
      subtitle: "Global Maritime Export Gateway",
      desc: "Factory-direct container stuffing, shipping line bookings, and customs export manifests.",
    },
    ledger: {
      title: "Factory Consignment & Sourcing",
      subtitle: "Direct Vendor Account Books",
      desc: "Commercial invoice auditing, container packing lists, and trade supplier ledgers.",
    },
  },
};

export function LoginShowcasePanel({ lang }: { lang: SupportedLanguage }) {
  const { effectiveCountry, activeTab } = useLoginScope();

  // Pick specific country or fallback to global Super Admin view
  const countryData = effectiveCountry ? COUNTRY_CONFIGS[effectiveCountry] : null;

  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col items-stretch justify-center">
      <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-white/10 p-7 lg:p-9 shadow-2xl backdrop-blur-xl text-white transition-all duration-300">
        {/* Subtle dynamic background ambient glow */}
        <div
          className={`pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-gradient-to-br opacity-40 blur-3xl transition-all duration-500 ${
            countryData ? countryData.glowClass : "from-blue-600/30 via-indigo-600/15 to-transparent"
          }`}
        />

        {/* ── Top Header: Brand Badge & Status ── */}
        <div className="relative z-10 flex items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
            <Building2 className="h-3.5 w-3.5 text-amber-400" />
            <span>
              {countryData ? (
                <>
                  <span className="text-white font-extrabold">{countryData.flag} {countryData.name.toUpperCase()}</span>
                  <span className="text-amber-300/80 mx-1.5">•</span>
                  <span>{countryData.badge}</span>
                </>
              ) : (
                <>
                  <span className="text-amber-300 font-extrabold">DAMAAN BUSINESS GROUP</span>
                  <span className="text-white/40 mx-1.5">•</span>
                  <span>GLOBAL SUPER ADMIN</span>
                </>
              )}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>{t(lang, "login.connected", "System Online")}</span>
          </div>
        </div>

        {/* ── Prominent Brand Title & Emblem Hero Banner ── */}
        <div className="relative z-10 mt-6 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="text-[11px] font-black tracking-[0.24em] uppercase text-amber-300/90 mb-1 flex items-center gap-1.5">
              <span>{countryData ? countryData.nativeName : "دامن بزنس گروپ"}</span>
              <span className="opacity-40">•</span>
              <span>ENTERPRISE ERP</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
              Damaan Business Group
            </h2>
            <p className="mt-1.5 text-xs lg:text-sm text-slate-300 font-medium leading-relaxed">
              {countryData
                ? countryData.subtitle
                : "Unified accounts, cross-border commercial trade, customs clearance, and real-time multi-branch ledgers."}
            </p>
          </div>

          {/* Authentic High-Res Vector Monogram */}
          <div className="shrink-0 flex items-center justify-center p-2 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md shadow-inner transition-transform duration-300 hover:scale-105">
            {countryData ? (
              countryData.emblem
            ) : (
              <DamanBusinessGroupEmblem className="h-28 w-28 drop-shadow-[0_10px_25px_rgba(245,158,11,0.4)]" />
            )}
          </div>
        </div>

        {/* ── 4 Feature Grid (Dynamic to Country or Global Super Admin) ── */}
        <div className="relative z-10 mt-7 grid gap-3.5 sm:grid-cols-2">
          {countryData ? (
            /* ── Country-Specific Operational Grid ── */
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{countryData.hubs.title}</p>
                    <p className="text-[11px] text-slate-300 font-medium">{countryData.hubs.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  {countryData.hubs.desc}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{countryData.currency.title}</p>
                    <p className="text-[11px] text-slate-300 font-medium">{countryData.currency.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  {countryData.currency.desc}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{countryData.ports.title}</p>
                    <p className="text-[11px] text-slate-300 font-medium">{countryData.ports.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  {countryData.ports.desc}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{countryData.ledger.title}</p>
                    <p className="text-[11px] text-slate-300 font-medium">{countryData.ledger.subtitle}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  {countryData.ledger.desc}
                </p>
              </div>
            </>
          ) : (
            /* ── Global Super Admin 4 Features ── */
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <Globe2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">5 Core Regions</p>
                    <p className="text-[11px] text-slate-300 font-medium">UAE, PK, AF, IN, CN</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  Unified financial ledgers with live multi-currency auto conversion (PKR, AED, AFN, INR, CNY).
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Dual-Entry Roznamcha</p>
                    <p className="text-[11px] text-slate-300 font-medium">Real-Time Balancing</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  Instant cashbook reconciliation, multi-branch journal entries, and automated daily closing.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Shipping & Customs</p>
                    <p className="text-[11px] text-slate-300 font-medium">Port Logistics Flow</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  End-to-end container tracking, clearance agents workflow, customs duty & port management.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Bank-Grade Security</p>
                    <p className="text-[11px] text-slate-300 font-medium">256-Bit SSL Encrypted</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
                  Granular role-based scope access, tamper-evident audit logs, and verified operator sessions.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Footer Info Pill ── */}
        <div className="relative z-10 mt-6 flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {countryData
                ? `Authorized ${countryData.name} Personnel Access Only`
                : "Authorized Personnel Access Only"}
            </span>
          </div>
          <span>Damaan Business Group (DGT.LLC)</span>
        </div>
      </div>
    </div>
  );
}
