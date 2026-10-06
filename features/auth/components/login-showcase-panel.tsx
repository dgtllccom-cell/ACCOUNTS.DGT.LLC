"use client";

import React from "react";
import Image from "next/image";
import { Globe, Users, Languages } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { LOGIN_TRANSLATIONS } from "./login-translations";
import { useLoginScope } from "./login-scope-context";

export function LoginShowcasePanel({ lang: propLang }: { lang?: SupportedLanguage }) {
  const scope = useLoginScope();
  const lang = (scope.selectedLang || propLang || "en") as SupportedLanguage;
  const t = LOGIN_TRANSLATIONS[lang] || LOGIN_TRANSLATIONS.en;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-center overflow-hidden bg-[#06122d]" dir={isRtl ? "rtl" : "ltr"}>
      {/* Background Hero Image */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/images/global_logistics_hero.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center opacity-85"
        />
        {/* Cinematic gradient overlays for contrast and depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#06122d]/90 via-[#06122d]/60 to-[#06122d]/40" />
        <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#06122d]/40 to-[#06122d]/80" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#06122d] to-transparent" />
      </div>

      {/* Hero Showcase Content */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-8 lg:px-12 py-16 flex flex-col justify-center">
        {/* Main Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white leading-[1.2] tracking-tight drop-shadow-lg">
          {t.heroTitle}
        </h1>

        {/* 3 Core Highlights matching the mockup */}
        <div className="mt-12 space-y-8">
          {/* Feature 1: Multi-Country */}
          <div className="flex items-start gap-4 sm:gap-5 group">
            <div className="h-13 w-13 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10 group-hover:scale-105 group-hover:border-blue-400/60 transition-all duration-300">
              <Globe className="h-6 w-6 text-blue-300 group-hover:text-blue-200 transition-colors" />
            </div>
            <div className="pt-0.5">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {t.featMultiCountryTitle}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-300/85 leading-relaxed mt-0.5">
                {t.featMultiCountryDesc}
              </p>
            </div>
          </div>

          {/* Feature 2: Role-Based Access */}
          <div className="flex items-start gap-4 sm:gap-5 group">
            <div className="h-13 w-13 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10 group-hover:scale-105 group-hover:border-blue-400/60 transition-all duration-300">
              <Users className="h-6 w-6 text-blue-300 group-hover:text-blue-200 transition-colors" />
            </div>
            <div className="pt-0.5">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {t.featRoleAccessTitle}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-300/85 leading-relaxed mt-0.5">
                {t.featRoleAccessDesc}
              </p>
            </div>
          </div>

          {/* Feature 3: Five Languages */}
          <div className="flex items-start gap-4 sm:gap-5 group">
            <div className="h-13 w-13 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10 group-hover:scale-105 group-hover:border-blue-400/60 transition-all duration-300">
              <Languages className="h-6 w-6 text-blue-300 group-hover:text-blue-200 transition-colors" />
            </div>
            <div className="pt-0.5">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {t.featLanguagesTitle}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-300/85 leading-relaxed mt-0.5">
                {t.featLanguagesDesc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
