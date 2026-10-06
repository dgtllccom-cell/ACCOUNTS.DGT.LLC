"use client";

import React, { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { LoginTab } from "./login-form";

export interface LoginScopeContextType {
  activeTab: LoginTab;
  selectedCountry: string;
  selectedCity: string;
  selectedLang: string;
  identifier: string;
  setActiveTab: (tab: LoginTab) => void;
  setSelectedCountry: (country: string) => void;
  setSelectedCity: (city: string) => void;
  setSelectedLang: (lang: string) => void;
  setIdentifier: (id: string) => void;
  /** Effective country to display in the showcase panel */
  effectiveCountry: string;
}

const LoginScopeContext = createContext<LoginScopeContextType | null>(null);

export function LoginScopeProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode;
  initialLang?: string;
}) {
  const [activeTab, setActiveTab] = useState<LoginTab>("super_admin");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedLang, setSelectedLang] = useState<string>(initialLang);
  const [identifier, setIdentifier] = useState<string>("");

  // Determine effective country for monogram / showcase
  const effectiveCountry = useMemo(() => {
    // If super_admin tab is explicitly active and no country is chosen, keep as global super admin
    if (activeTab === "super_admin" && !selectedCountry) {
      return "";
    }

    // 1. Explicit country selection takes precedence
    if (selectedCountry) {
      return selectedCountry;
    }

    // 2. Infer from typed identifier (email/username)
    const lowerId = identifier.trim().toLowerCase();
    if (lowerId.startsWith("pk.") || lowerId.includes("pakistan") || lowerId.includes("/pk/")) return "Pakistan";
    if (lowerId.startsWith("af.") || lowerId.includes("afghanistan") || lowerId.includes("/af/")) return "Afghanistan";
    if (lowerId.startsWith("ae.") || lowerId.includes("uae") || lowerId.includes("dubai") || lowerId.includes("/ae/")) return "United Arab Emirates";
    if (lowerId.startsWith("sa.") || lowerId.includes("saudi") || lowerId.includes("/sa/")) return "Saudi Arabia";
    if (lowerId.startsWith("in.") || lowerId.includes("india") || lowerId.includes("/in/")) return "India";
    if (lowerId.startsWith("cn.") || lowerId.includes("china") || lowerId.includes("/cn/")) return "China";

    // 3. If on a non-super-admin tab (country, city, branch, agent) and no country chosen yet, default to Pakistan as primary regional hub
    if (["country", "city", "branch", "agent"].includes(activeTab)) {
      if (selectedLang === "ps") return "Afghanistan";
      if (selectedLang === "ar") return "United Arab Emirates";
      if (selectedLang === "fa") return "Afghanistan";
      return "Pakistan";
    }

    return "";
  }, [activeTab, selectedCountry, identifier, selectedLang]);

  return (
    <LoginScopeContext.Provider
      value={{
        activeTab,
        selectedCountry,
        selectedCity,
        selectedLang,
        identifier,
        setActiveTab,
        setSelectedCountry,
        setSelectedCity,
        setSelectedLang,
        setIdentifier,
        effectiveCountry,
      }}
    >
      {children}
    </LoginScopeContext.Provider>
  );
}

export function useLoginScope() {
  const ctx = useContext(LoginScopeContext);
  if (!ctx) {
    // Return safe fallback if not wrapped in provider
    return {
      activeTab: "super_admin" as LoginTab,
      selectedCountry: "",
      selectedCity: "",
      selectedLang: "en",
      identifier: "",
      setActiveTab: () => {},
      setSelectedCountry: () => {},
      setSelectedCity: () => {},
      setSelectedLang: () => {},
      setIdentifier: () => {},
      effectiveCountry: "",
    };
  }
  return ctx;
}
