import { useState, useEffect } from "react";

type PrintState = {
  isOpen: boolean;
  htmlContent: string;
  title: string;
  /** optional: lets the preview modal re-render the document in another language
   *  / orientation by rebuilding the HTML from source. */
  rebuild?: ((opts: { lang: string; orientation: "portrait" | "landscape" }) => string) | null;
  lang?: string;
};

type PrintListener = (state: PrintState) => void;

class PrintStore {
  private state: PrintState = {
    isOpen: false,
    htmlContent: "",
    title: "Print Document",
    rebuild: null,
    lang: "en",
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

  openPrint = (
    htmlContent: string,
    title: string = "Print Document",
    extra?: { rebuild?: PrintState["rebuild"]; lang?: string },
  ) => {
    this.setState({
      isOpen: true,
      htmlContent,
      title,
      rebuild: extra?.rebuild ?? null,
      lang: extra?.lang ?? "en",
    });
  };

  /** replace the previewed HTML in place (used by the modal's language / orientation switch). */
  updateHtml = (htmlContent: string, lang?: string) => {
    this.setState({ htmlContent, ...(lang ? { lang } : {}) });
  };

  closePrint = () => {
    this.setState({ isOpen: false, htmlContent: "", title: "Print Document", rebuild: null });
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
    updateHtml: printStore.updateHtml,
    closePrint: printStore.closePrint,
  };
}
