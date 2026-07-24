import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GoogleTranslateScript } from "@/components/layout/google-translate-script";
import { PdfPreviewModal } from "@/components/ui/pdf-preview-modal";

const inter = Inter({ subsets: ["latin"] });

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
  } catch {}
})();
            `.trim()
          }}
        />
      </head>
      <body className={inter.className}>
        <GoogleTranslateScript />
        {children}
        <PdfPreviewModal />
      </body>
    </html>
  );
}
