import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Digital Dock ERP",
    short_name: "Dock ERP",
    description: "Multi-country ERP for accounts, ledgers, purchases, sales, roznamcha, stock, and reports.",
    start_url: "/auth/login",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#f8fafc",
    theme_color: "#0f3ea8",
    orientation: "any",
    lang: "en",
    dir: "auto",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/digital-dock-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/digital-dock-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Cash Entry", short_name: "Cash", description: "Open Cash Entry / Roznamcha posting.", url: "/dashboard/roznamcha/cash-entry", icons: [{ src: "/icons/digital-dock-icon.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Account Register", short_name: "Accounts", description: "Open Account Master Register.", url: "/dashboard/accounts/setup-report", icons: [{ src: "/icons/digital-dock-icon.svg", sizes: "any", type: "image/svg+xml" }] },
      { name: "Purchase Booking", short_name: "Purchase", description: "Open Purchase Booking Order.", url: "/dashboard/purchase/new-purchase-booking", icons: [{ src: "/icons/digital-dock-icon.svg", sizes: "any", type: "image/svg+xml" }] }
    ]
  };
}