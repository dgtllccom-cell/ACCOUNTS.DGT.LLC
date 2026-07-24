import { useState, useEffect } from "react";

type PrintState = {
  isOpen: boolean;
  htmlContent: string;
  title: string;
};

type PrintListener = (state: PrintState) => void;

class PrintStore {
  private state: PrintState = {
    isOpen: false,
    htmlContent: "",
    title: "Print Document",
  };
  private listeners: Set<PrintListener> = new Set();

  getState = () => this.state;

  setState = (partialState: Partial<PrintState>) => {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach((listener) => listener(this.state));
  };

  subscribe = (listener: PrintListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  openPrint = (htmlContent: string, title: string = "Print Document") => {
    this.setState({ isOpen: true, htmlContent, title });
  };

  closePrint = () => {
    this.setState({ isOpen: false, htmlContent: "", title: "Print Document" });
  };
}

export const printStore = new PrintStore();

export function usePrintStore() {
  const [state, setState] = useState(printStore.getState());

  useEffect(() => {
    return printStore.subscribe(setState);
  }, []);

  return {
    ...state,
    openPrint: printStore.openPrint,
    closePrint: printStore.closePrint,
  };
}
