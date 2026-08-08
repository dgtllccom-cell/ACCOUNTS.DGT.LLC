import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GoogleTranslateScript } from "@/components/layout/google-translate-script";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";

export const metadata: Metadata = {
  applicationName: "Digital Dock ERP",
  title: {
    default: "Digital Dock ERP",
    template: "%s | Digital Dock ERP"
  },
  description: "Multi-country ERP for accounts, ledgers, purchases, sales, roznamcha, stock, and reports.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/digital-dock-icon.svg",
    apple: "/icons/digital-dock-icon.svg"
  },
  appleWebApp: {
    capable: true,
    title: "Digital Dock ERP",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f3ea8"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Runs before React hydrates to avoid theme/lang flash.
          // We keep this small and dependency-free (no next-themes).
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const allowed = new Set(['purple','blue','green','gold','cyan']);
    const storedColor = localStorage.getItem('erp_color');
    const color = (storedColor && allowed.has(storedColor)) ? storedColor : 'purple';
    document.documentElement.classList.remove('theme-purple','theme-blue','theme-green','theme-gold','theme-cyan');
    document.documentElement.classList.add('theme-' + color);
  } catch {}
  try {
    const storedTheme = localStorage.getItem('erp_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = storedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {}
  try {
    const rtl = new Set(['ar','ur','fa','ps']);
    const storedLang = localStorage.getItem('erp_lang');
    const lang = storedLang || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl.has(lang) ? 'rtl' : 'ltr';
    if (rtl.has(lang)) {
      var overrides = { ar: "'Cairo', sans-serif", fa: "'Vazirmatn', sans-serif", ur: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif", ps: "'Noto Naskh Arabic', 'Noto Nastaliq Urdu', serif" };
      document.documentElement.style.setProperty('--font-family-override', overrides[lang] || "'Noto Naskh Arabic', serif");
    }
  } catch {}
  try {
    if (window.isSecureContext && 'serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        try {
          navigator.serviceWorker.register('/sw.js').catch(function() {});
        } catch(swErr) {}
      });
    }
  } catch {}
  try {
    var handleChunkErr = function(err) {
      try {
        var str = '';
        if (typeof err === 'string') str = err;
        else if (err && typeof err === 'object') str = err.message || err.name || String(err);
        if (str && (str.indexOf('Loading chunk') !== -1 || str.indexOf('ChunkLoadError') !== -1 || str.indexOf('failed to fetch') !== -1 || str.indexOf('exception has occurred') !== -1)) {
          var last = sessionStorage.getItem('chunk_reload_attempt');
          var now = Date.now();
          if (!last || (now - parseInt(last, 10)) > 15000) {
            sessionStorage.setItem('chunk_reload_attempt', now.toString());
            window.location.href = window.location.pathname + '?_t=' + now;
          }
        }
      } catch (inner) {}
    };
    window.addEventListener('error', function(e) { handleChunkErr(e ? (e.message || e.error) : null); });
    window.addEventListener('unhandledrejection', function(e) { handleChunkErr(e ? e.reason : null); });
  } catch {}
})();
            `.trim()
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <GoogleTranslateScript />
        {children}
        <PdfPreviewModal />
      </body>
    </html>
  );
}
