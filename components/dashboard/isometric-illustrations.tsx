"use client";

import React from "react";

// 1. Modern 3D Blue Buildings (Total Branches)
export function IsoBuilding3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bld1" x1="20" y1="20" x2="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="bld2" x1="40" y1="10" x2="65" y2="65" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="bldTop1" x1="20" y1="25" x2="35" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbeafe" />
          <stop offset="1" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="bldTop2" x1="45" y1="12" x2="60" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <filter id="shadowBld" x="10" y="50" width="60" height="25" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1e3a8a" floodOpacity="0.15" />
        </filter>
      </defs>
      {/* Shadow */}
      <ellipse cx="42" cy="64" rx="28" ry="7" fill="#bfdbfe" opacity="0.6" filter="url(#shadowBld)" />
      {/* Back Tower */}
      <path d="M45 15 L58 8 L70 15 L58 22 Z" fill="url(#bldTop2)" />
      <path d="M45 15 L58 22 L58 60 L45 53 Z" fill="url(#bld1)" />
      <path d="M58 22 L70 15 L70 53 L58 60 Z" fill="url(#bld2)" />
      {/* Windows on back tower */}
      <rect x="48" y="24" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      <rect x="53" y="24" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      <rect x="48" y="32" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      <rect x="53" y="32" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      <rect x="48" y="40" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      <rect x="53" y="40" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.8" transform="skewY(12)" />
      {/* Front Tower */}
      <path d="M18 32 L32 25 L45 32 L32 39 Z" fill="url(#bldTop1)" />
      <path d="M18 32 L32 39 L32 68 L18 61 Z" fill="url(#bld1)" opacity="0.95" />
      <path d="M32 39 L45 32 L45 61 L32 68 Z" fill="url(#bld2)" opacity="0.95" />
      {/* Windows on front tower */}
      <rect x="22" y="38" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
      <rect x="27" y="38" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
      <rect x="22" y="46" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
      <rect x="27" y="46" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
      <rect x="22" y="54" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
      <rect x="27" y="54" width="3" height="4" rx="0.5" fill="#ffffff" opacity="0.9" transform="skewY(14)" />
    </svg>
  );
}

// 2. Modern 3D Blue Avatar Spheres (Total Users)
export function IsoUsers3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="userSphere1" cx="35%" cy="35%" r="65%">
          <stop stopColor="#93c5fd" />
          <stop offset="0.6" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </radialGradient>
        <radialGradient id="userSphere2" cx="30%" cy="30%" r="70%">
          <stop stopColor="#dbeafe" />
          <stop offset="0.5" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </radialGradient>
      </defs>
      <ellipse cx="40" cy="65" rx="26" ry="6" fill="#bfdbfe" opacity="0.6" />
      {/* Left Back Avatar */}
      <circle cx="26" cy="36" r="10" fill="url(#userSphere1)" opacity="0.75" />
      <path d="M14 56 C14 47 22 44 26 44 C30 44 38 47 38 56 Z" fill="url(#userSphere1)" opacity="0.75" />
      {/* Right Back Avatar */}
      <circle cx="54" cy="36" r="10" fill="url(#userSphere1)" opacity="0.75" />
      <path d="M42 56 C42 47 50 44 54 44 C58 44 66 47 66 56 Z" fill="url(#userSphere1)" opacity="0.75" />
      {/* Center Front Main Avatar */}
      <circle cx="40" cy="30" r="13" fill="url(#userSphere2)" />
      <circle cx="36" cy="26" r="3.5" fill="#ffffff" opacity="0.6" />
      <path d="M24 60 C24 48 34 45 40 45 C46 45 56 48 56 60 Z" fill="url(#userSphere2)" />
      <path d="M28 58 C30 50 36 48 40 48 C44 48 50 50 52 58 Z" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

// 3. Modern 3D Golden Stacked Coins (Total Accounts)
export function IsoCoins3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="coinFace" x1="20" y1="20" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.6" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="coinRim" x1="20" y1="20" x2="60" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b45309" />
          <stop offset="0.5" stopColor="#d97706" />
          <stop offset="1" stopColor="#78350f" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="67" rx="24" ry="5.5" fill="#fed7aa" opacity="0.6" />
      {/* Coin 1 (Bottom) */}
      <path d="M22 52 C22 47 30 43 40 43 C50 43 58 47 58 52 L58 58 C58 63 50 67 40 67 C30 67 22 63 22 58 Z" fill="url(#coinRim)" />
      <ellipse cx="40" cy="52" rx="18" ry="7" fill="url(#coinFace)" />
      {/* Coin 2 (Middle) */}
      <path d="M22 41 C22 36 30 32 40 32 C50 32 58 36 58 41 L58 47 C58 52 50 56 40 56 C30 56 22 52 22 47 Z" fill="url(#coinRim)" />
      <ellipse cx="40" cy="41" rx="18" ry="7" fill="url(#coinFace)" />
      {/* Coin 3 (Top) */}
      <path d="M22 30 C22 25 30 21 40 21 C50 21 58 25 58 30 L58 36 C58 41 50 45 40 45 C30 45 22 41 22 36 Z" fill="url(#coinRim)" />
      <ellipse cx="40" cy="30" rx="18" ry="7" fill="url(#coinFace)" />
      {/* Star / Dollar symbol on top coin */}
      <ellipse cx="40" cy="30" rx="14" ry="5" fill="#fde047" stroke="#b45309" strokeWidth="0.8" opacity="0.8" />
    </svg>
  );
}

// 4. Modern 3D Floating Purple Glass Cubes (Total Products)
export function IsoCubes3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cubeTop" x1="20" y1="20" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e9d5ff" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id="cubeLeft" x1="20" y1="30" x2="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="cubeRight" x1="40" y1="30" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9333ea" />
          <stop offset="1" stopColor="#581c87" />
        </linearGradient>
      </defs>
      <ellipse cx="42" cy="66" rx="25" ry="6" fill="#f3e8ff" opacity="0.6" />
      {/* Floating Small Cube (Top Right) */}
      <g transform="translate(18, -12) scale(0.65)">
        <path d="M40 20 L58 10 L76 20 L58 30 Z" fill="url(#cubeTop)" />
        <path d="M40 20 L58 30 L58 50 L40 40 Z" fill="url(#cubeLeft)" />
        <path d="M58 30 L76 20 L76 40 L58 50 Z" fill="url(#cubeRight)" />
      </g>
      {/* Main Center Cube */}
      <path d="M20 32 L42 19 L64 32 L42 45 Z" fill="url(#cubeTop)" />
      <path d="M20 32 L42 45 L42 66 L20 53 Z" fill="url(#cubeLeft)" />
      <path d="M42 45 L64 32 L64 53 L42 66 Z" fill="url(#cubeRight)" />
      <path d="M24 35 L42 45 L42 63 L24 53 Z" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

// 5. Modern 3D Mint Green Parcel Package (Total Stock Value)
export function IsoPackage3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pkgTop" x1="20" y1="20" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a7f3d0" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="pkgLeft" x1="20" y1="30" x2="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="pkgRight" x1="40" y1="30" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      <ellipse cx="42" cy="66" rx="25" ry="6" fill="#d1fae5" opacity="0.6" />
      {/* Box */}
      <path d="M20 34 L42 21 L64 34 L42 47 Z" fill="url(#pkgTop)" />
      <path d="M20 34 L42 47 L42 66 L20 53 Z" fill="url(#pkgLeft)" />
      <path d="M42 47 L64 34 L64 53 L42 66 Z" fill="url(#pkgRight)" />
      {/* Ribbon / Tape */}
      <path d="M38 23 L46 28 L46 66 L38 61 Z" fill="#ffffff" opacity="0.45" />
      <path d="M20 40 L64 40 L64 44 L20 44 Z" fill="#ffffff" opacity="0.35" />
      {/* Bow on top */}
      <ellipse cx="42" cy="30" rx="4" ry="2" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

// 6. Modern 3D Pink Shopping Cart (Total Purchases)
export function IsoCart3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cartGrad" x1="20" y1="20" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f472b6" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
      </defs>
      <ellipse cx="44" cy="67" rx="22" ry="5" fill="#fce7f3" opacity="0.6" />
      {/* Cart Basket */}
      <path d="M22 28 L30 28 L38 52 L58 52 L64 34 L32 34" stroke="url(#cartGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Basket Grid Lines */}
      <path d="M36 40 L60 40 M38 46 L58 46" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Basket item 1 (cube) */}
      <rect x="36" y="24" width="10" height="10" rx="2" fill="#f43f5e" opacity="0.85" transform="rotate(-8 36 24)" />
      <rect x="46" y="22" width="11" height="12" rx="2" fill="#fb7185" opacity="0.9" transform="rotate(6 46 22)" />
      {/* Wheels */}
      <circle cx="39" cy="60" r="4.5" fill="#9d174d" />
      <circle cx="39" cy="60" r="2" fill="#ffffff" />
      <circle cx="56" cy="60" r="4.5" fill="#9d174d" />
      <circle cx="56" cy="60" r="2" fill="#ffffff" />
    </svg>
  );
}

// 7. Modern 3D Orange Ascending Bar Chart (Total Sales)
export function IsoChart3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bar1Top" x1="15" y1="40" x2="30" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="bar1Side" x1="15" y1="45" x2="30" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <ellipse cx="44" cy="66" rx="26" ry="6" fill="#fed7aa" opacity="0.6" />
      {/* Bar 1 (Short) */}
      <path d="M16 48 L26 42 L36 48 L26 54 Z" fill="url(#bar1Top)" />
      <path d="M16 48 L26 54 L26 65 L16 59 Z" fill="url(#bar1Side)" />
      <path d="M26 54 L36 48 L36 59 L26 65 Z" fill="#b45309" />
      {/* Bar 2 (Medium) */}
      <path d="M32 36 L42 30 L52 36 L42 42 Z" fill="url(#bar1Top)" />
      <path d="M32 36 L42 42 L42 65 L32 59 Z" fill="url(#bar1Side)" />
      <path d="M42 42 L52 36 L52 59 L42 65 Z" fill="#b45309" />
      {/* Bar 3 (Tall) */}
      <path d="M48 24 L58 18 L68 24 L58 30 Z" fill="url(#bar1Top)" />
      <path d="M48 24 L58 30 L58 65 L48 59 Z" fill="url(#bar1Side)" />
      <path d="M58 30 L68 24 L68 59 L58 65 Z" fill="#b45309" />
    </svg>
  );
}

// 8. Modern 3D Blue Financial Trend Wave (Profit / Loss)
export function IsoTrend3D({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="waveFill" x1="20" y1="20" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#6366f1" stopOpacity="0.5" />
          <stop offset="1" stopColor="#312e81" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="waveLine" x1="15" y1="50" x2="65" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="0.5" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <ellipse cx="42" cy="66" rx="26" ry="6" fill="#e0e7ff" opacity="0.6" />
      {/* 3D Curved Surface */}
      <path
        d="M16 54 C26 40 34 50 44 34 C54 20 64 26 68 22 L68 60 C64 64 54 62 44 64 C34 66 26 62 16 64 Z"
        fill="url(#waveFill)"
      />
      {/* 3D Neon Line */}
      <path
        d="M16 54 C26 40 34 50 44 34 C54 20 64 26 68 22"
        stroke="url(#waveLine)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Glowing point on top */}
      <circle cx="68" cy="22" r="4" fill="#ec4899" />
      <circle cx="68" cy="22" r="2" fill="#ffffff" />
    </svg>
  );
}
