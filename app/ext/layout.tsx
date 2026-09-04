/**
 * External form layout — standalone public surface (no sidebar, no auth).
 * Used for /ext/form/[token] and any future public-facing ERP pages.
 *
 * IMPORTANT: this is a NESTED layout, so it must NOT render <html>/<head>/<body>
 * (only the root app/layout.tsx does). Rendering a second <html> here caused a
 * "mounting a new <html>" error and a full hydration failure on every /ext page.
 * The standalone look is applied via a wrapper <div>; the font <link> is hoisted
 * into <head> by React automatically.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure Form | DGT ERP",
  description: "Fill and submit your information securely.",
  robots: { index: false, follow: false },
};

export default function ExtLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ext-standalone-shell"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </div>
  );
}
