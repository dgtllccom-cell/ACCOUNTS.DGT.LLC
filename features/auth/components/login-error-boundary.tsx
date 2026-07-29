"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  refId: string;
};

export class LoginErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const refId = "ERR-LOGIN-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      refId
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[LoginErrorBoundary caught client exception]:", error, errorInfo);
  }

  handleReload = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.clear();
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 dark:bg-rose-950/40 p-6 text-rose-900 dark:text-rose-200 shadow-xl space-y-4 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Login Component Diagnostic Notice
              </h3>
              <p className="text-[10px] font-mono text-rose-500">Ref ID: {this.state.refId}</p>
            </div>
          </div>

          <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            A temporary client exception occurred during rendering. Details are provided below:
          </p>

          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/60 font-mono text-[11px] text-rose-800 dark:text-rose-300 overflow-x-auto max-h-36">
            <p className="font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
            {this.state.error?.stack && (
              <pre className="mt-2 text-[10px] opacity-80 whitespace-pre-wrap">{this.state.error.stack}</pre>
            )}
          </div>

          <button
            onClick={this.handleReload}
            className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <RefreshCw className="h-4 w-4" /> RELOAD LOGIN SESSION
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
