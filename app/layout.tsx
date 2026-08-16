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
    var isLocalDev = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(location.hostname) !== -1;
    if (isLocalDev && 'serviceWorker' in navigator) {
      // Actively unregister in local dev instead of just skipping registration --
      // an already-registered SW from a previous session keeps controlling the page
      // (SW registration is origin-scoped, not tab-scoped, and re-registers itself
      // on every load via this same script) and its cache can silently serve stale
      // HTML/RSC payloads for a route even after the dev server has rebuilt with
      // new code, in a way that survives hard reloads and brand new tabs alike.
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister().catch(function() {}); });
      }).catch(function() {});
      if (window.caches && caches.keys) {
        caches.keys().then(function(keys) {
          keys.forEach(function(k) { caches.delete(k).catch(function() {}); });
        }).catch(function() {});
      }
    } else if (window.isSecureContext && 'serviceWorker' in navigator) {
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
        if (str && (str.indexOf('Loading chunk') !== -1 || str.indexOf('ChunkLoadError') !== -1 || str.indexOf('failed to fetch') !== -1 || str.indexOf('Failed to fetch dynamically imported module') !== -1)) {
          if ('caches' in window) {
            caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); }).catch(function() {});
          }
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }).catch(function() {});
          }
          // NOTE: this runs inside a dangerouslySetInnerHTML template literal, where a JS
          // template literal strips "\/" down to "/". A regex literal here (e.g.
          // /_next\/static\/chunks\/.../) therefore gets its escapes removed, the first bare
          // "/" ends the literal early, and the leftover text becomes bogus regex flags -> an
          // "Invalid regular expression flags" SyntaxError that kills this whole inline script.
          // Extract the route with plain string ops (no backslashes) so it can never recur.
          var targetRoute = null;
          try {
            var marker = '/_next/static/chunks/app';
            var mi = str.indexOf(marker);
            if (mi !== -1) {
              var rest = str.slice(mi + marker.length);
              var cut = rest.length;
              for (var ci = 0; ci < rest.length; ci++) {
                var ch = rest.charAt(ci);
                if (ch === '?' || ch === '"' || ch === "'" || ch === ' ' || ch === ')' || ch === ':') { cut = ci; break; }
              }
              var seg = rest.slice(0, cut);
              if (seg.length > 3 && seg.slice(-3) === '.js') seg = seg.slice(0, -3);
              var dash = seg.lastIndexOf('-');
              if (dash > 0) seg = seg.slice(0, dash);
              if (seg && seg.charAt(0) === '/') targetRoute = seg;
            }
          } catch(e) {}
          var dest = targetRoute || window.location.pathname;
          var countKey = 'erp_auto_chunk_cnt';
          var tsKey = 'erp_auto_chunk_ts';
          var now = Date.now();
          var lastTs = parseInt(sessionStorage.getItem(tsKey) || '0', 10);
          var count = parseInt(sessionStorage.getItem(countKey) || '0', 10);
          if (now - lastTs > 15000) count = 0;
          if (count < 3) {
            sessionStorage.setItem(countKey, String(count + 1));
            sessionStorage.setItem(tsKey, String(now));
            window.location.replace(dest + (dest.indexOf('?') !== -1 ? '&' : '?') + '_v=' + now);
          }
        }
      } catch (inner) {}
    };
    window.addEventListener('error', function(e) { handleChunkErr(e ? (e.message || e.error) : null); }, true);
    window.addEventListener('unhandledrejection', function(e) { handleChunkErr(e ? e.reason : null); }, true);
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
