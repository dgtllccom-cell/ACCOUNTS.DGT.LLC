/**
 * External form layout — completely standalone, no sidebar, no auth.
 * Used for /ext/form/[token] and any future public-facing ERP pages.
 */
import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Secure Form | DGT ERP",
  description: "Fill and submit your information securely.",
  robots: { index: false, follow: false },
};

export default function ExtLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
