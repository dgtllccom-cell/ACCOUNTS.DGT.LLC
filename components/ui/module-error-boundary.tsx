"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  lang?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ERP ModuleErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const lang = (this.props.lang || (typeof document !== "undefined" ? (localStorage.getItem("erp_lang") || document.documentElement.lang || "en") : "en")) as "en" | "ur" | "ar" | "fa" | "ps";
      const tr = (str: string) => {
        const res = autoTranslate5Languages(str);
        return res[lang] || str;
      };

      const title = this.props.fallbackTitle || tr("Module Section Exception");
      const message = this.props.fallbackMessage || tr("This section encountered a temporary issue while rendering data. Click below to reload.");

      return (
        <div className="my-4 p-6 rounded-2xl border border-rose-200 bg-white dark:border-rose-900/40 dark:bg-slate-900 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-3">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-1">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            {message}
          </p>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="text-[10px] font-mono text-left bg-slate-950 text-rose-400 p-3 rounded-lg overflow-x-auto max-w-xl mx-auto mb-4">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{tr("Try Again (Reload)")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard";
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold text-xs transition"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>{tr("Go to Dashboard")}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
