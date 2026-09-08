import React from "react";

interface EmblemProps {
  className?: string;
}

/**
 * Global Imperial Emblem for Daman Business Group (Super Admin)
 */
export function DamanBusinessGroupEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="dbgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="35%" stopColor="#FFB300" />
          <stop offset="70%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FFD54F" />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0a1936" />
        </linearGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="100" cy="100" r="92" fill="url(#dbgGlow)" />

      {/* Outer Golden Rope / Beaded Ring */}
      <circle cx="100" cy="100" r="86" stroke="url(#goldGrad)" strokeWidth="2.5" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="80" stroke="url(#goldGrad)" strokeWidth="1.5" />

      {/* 5 Core Regions Stars (UAE, PK, AF, IN, CN) */}
      {[0, 72, 144, 216, 288].map((angle, i) => {
        const rad = ((angle - 90) * Math.PI) / 180;
        const cx = 100 + 74 * Math.cos(rad);
        const cy = 100 + 74 * Math.sin(rad);
        return (
          <polygon
            key={i}
            points={`${cx},${cy - 4} ${cx + 1.2},${cy - 1.2} ${cx + 4},${cy - 1} ${cx + 1.8},${cy + 1.2} ${cx + 2.5},${cy + 4} ${cx},${cy + 2.2} ${cx - 2.5},${cy + 4} ${cx - 1.8},${cy + 1.2} ${cx - 4},${cy - 1} ${cx - 1.2},${cy - 1.2}`}
            fill="url(#goldGrad)"
          />
        );
      })}

      {/* Central Regal Shield */}
      <path
        d="M68 62 H132 V108 C132 134 100 152 100 152 C100 152 68 134 68 108 Z"
        fill="url(#shieldGrad)"
        stroke="url(#goldGrad)"
        strokeWidth="3.5"
      />

      {/* Shield Inner Inset */}
      <path
        d="M74 68 H126 V106 C126 128 100 144 100 144 C100 144 74 128 74 106 Z"
        stroke="url(#goldGrad)"
        strokeWidth="1"
        opacity="0.6"
        fill="none"
      />

      {/* Laurel Branches (Left & Right) */}
      <g stroke="url(#goldGrad)" strokeWidth="1.5" fill="url(#goldGrad)" opacity="0.85">
        <path d="M52 120 C48 95 60 70 70 60" fill="none" strokeWidth="1.8" />
        <ellipse cx="50" cy="110" rx="3.5" ry="2" transform="rotate(-30 50 110)" />
        <ellipse cx="48" cy="98" rx="3.5" ry="2" transform="rotate(-20 48 98)" />
        <ellipse cx="50" cy="86" rx="3.5" ry="2" transform="rotate(-10 50 86)" />
        <ellipse cx="56" cy="74" rx="3.5" ry="2" transform="rotate(10 56 74)" />
        <ellipse cx="64" cy="65" rx="3.5" ry="2" transform="rotate(25 64 65)" />

        <path d="M148 120 C152 95 140 70 130 60" fill="none" strokeWidth="1.8" />
        <ellipse cx="150" cy="110" rx="3.5" ry="2" transform="rotate(30 150 110)" />
        <ellipse cx="152" cy="98" rx="3.5" ry="2" transform="rotate(20 152 98)" />
        <ellipse cx="150" cy="86" rx="3.5" ry="2" transform="rotate(10 150 86)" />
        <ellipse cx="144" cy="74" rx="3.5" ry="2" transform="rotate(-10 144 74)" />
        <ellipse cx="136" cy="65" rx="3.5" ry="2" transform="rotate(-25 136 65)" />
      </g>

      {/* Imperial Crown atop Shield */}
      <path
        d="M84 56 L88 44 L100 50 L112 44 L116 56 Z"
        fill="url(#goldGrad)"
        stroke="#B45309"
        strokeWidth="1"
      />
      <circle cx="88" cy="42" r="1.8" fill="#FFF" />
      <circle cx="100" cy="48" r="2.2" fill="#FFF" />
      <circle cx="112" cy="42" r="1.8" fill="#FFF" />

      {/* DBG Monogram Typography in Center of Shield */}
      <text
        x="100"
        y="112"
        textAnchor="middle"
        fill="url(#goldGrad)"
        fontFamily="serif"
        fontSize="30"
        fontWeight="900"
        letterSpacing="2"
      >
        DBG
      </text>

      {/* Ribbon Banner at Bottom */}
      <path
        d="M45 158 Q100 172 155 158 L150 172 Q100 184 50 172 Z"
        fill="url(#goldGrad)"
        stroke="#92400E"
        strokeWidth="1"
      />
      <text
        x="100"
        y="169"
        textAnchor="middle"
        fill="#06122D"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="1.8"
      >
        DAMAN BUSINESS GROUP
      </text>
    </svg>
  );
}

/**
 * Official State Monogram of Pakistan
 * Features: Crescent and Star, Quartered shield (Agriculture & Industry), Poet's Jasmine wreath, Scroll.
 */
export function PakistanEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pkGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pkGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="pkGreen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#pkGlow)" />
      <circle cx="100" cy="100" r="84" stroke="url(#pkGold)" strokeWidth="2" strokeDasharray="4 2" />

      {/* Islamic Crescent and Star on Top */}
      <g fill="url(#pkGold)">
        <path d="M102 30 A14 14 0 1 0 102 54 A11 11 0 1 1 102 30 Z" />
        <polygon points="107,38 109,42 113,42 110,45 111,49 107,46 103,49 104,45 101,42 105,42" />
      </g>

      {/* Jasmine Floral Wreath (Chambeli) */}
      <g stroke="url(#pkGold)" strokeWidth="1.6" fill="url(#pkGold)">
        <path d="M50 126 C44 96 54 68 70 56" fill="none" strokeWidth="2" />
        <circle cx="50" cy="116" r="3" fill="#FFF" />
        <circle cx="46" cy="102" r="3" fill="#FFF" />
        <circle cx="48" cy="88" r="3" fill="#FFF" />
        <circle cx="56" cy="74" r="3" fill="#FFF" />
        <circle cx="68" cy="62" r="3" fill="#FFF" />

        <path d="M150 126 C156 96 146 68 130 56" fill="none" strokeWidth="2" />
        <circle cx="150" cy="116" r="3" fill="#FFF" />
        <circle cx="154" cy="102" r="3" fill="#FFF" />
        <circle cx="152" cy="88" r="3" fill="#FFF" />
        <circle cx="144" cy="74" r="3" fill="#FFF" />
        <circle cx="132" cy="62" r="3" fill="#FFF" />
      </g>

      {/* Quartered Shield */}
      <path
        d="M72 66 H128 V108 C128 132 100 148 100 148 C100 148 72 132 72 108 Z"
        fill="url(#pkGreen)"
        stroke="url(#pkGold)"
        strokeWidth="3"
      />
      {/* Quarter dividing cross */}
      <line x1="100" y1="66" x2="100" y2="148" stroke="url(#pkGold)" strokeWidth="1.8" />
      <line x1="72" y1="104" x2="128" y2="104" stroke="url(#pkGold)" strokeWidth="1.8" />

      {/* Four Agricultural / Industrial Symbols inside quarters */}
      {/* Q1: Cotton (Top Left) */}
      <circle cx="86" cy="85" r="4.5" fill="#FFF" opacity="0.9" />
      <circle cx="83" cy="88" r="3" fill="#FFF" opacity="0.9" />
      <circle cx="89" cy="88" r="3" fill="#FFF" opacity="0.9" />

      {/* Q2: Wheat Sheaf (Top Right) */}
      <path d="M114 94 L114 76 M111 80 L114 84 L117 80 M111 86 L114 90 L117 86" stroke="url(#pkGold)" strokeWidth="1.6" strokeLinecap="round" />

      {/* Q3: Tea Plant (Bottom Left) */}
      <path d="M86 130 C86 122 84 115 82 112 M86 122 C89 120 91 116 90 114" stroke="url(#pkGold)" strokeWidth="1.6" strokeLinecap="round" />

      {/* Q4: Jute Plant (Bottom Right) */}
      <path d="M114 132 L114 114 M110 120 L114 116 L118 120 M111 126 L114 122 L117 126" stroke="url(#pkGold)" strokeWidth="1.6" strokeLinecap="round" />

      {/* Scroll Banner at bottom */}
      <path
        d="M46 156 Q100 170 154 156 L149 170 Q100 182 51 170 Z"
        fill="url(#pkGold)"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#022C22"
        fontFamily="sans-serif"
        fontSize="7"
        fontWeight="900"
        letterSpacing="1.5"
      >
        ISLAMIC REPUBLIC OF PAKISTAN
      </text>
    </svg>
  );
}

/**
 * Official National Monogram of Afghanistan
 * Features: Central Mehrab & Minbar Mosque, radiant rising sun, wheat sheaves, national banner.
 */
export function AfghanistanEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="afGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="afGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="afBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1C1917" />
          <stop offset="100%" stopColor="#0C0A09" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#afGlow)" />
      <circle cx="100" cy="100" r="84" stroke="url(#afGold)" strokeWidth="2" />

      {/* Radiant Sunburst on Top */}
      <g stroke="url(#afGold)" strokeWidth="1.8">
        {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180].map((angle, i) => {
          const rad = ((angle + 180) * Math.PI) / 180;
          const x1 = 100 + 44 * Math.cos(rad);
          const y1 = 76 + 22 * Math.sin(rad);
          const x2 = 100 + 52 * Math.cos(rad);
          const y2 = 76 + 26 * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" />;
        })}
      </g>

      {/* Flanking Sheaves of Wheat */}
      <g stroke="url(#afGold)" strokeWidth="2" fill="url(#afGold)">
        <path d="M54 136 C42 100 52 66 76 48" fill="none" strokeWidth="2.5" />
        {[52, 64, 76, 90, 104, 118].map((y, i) => (
          <ellipse key={i} cx={46 + i * 4} cy={y} rx="4" ry="2.5" transform={`rotate(${30 - i * 8} ${46 + i * 4} ${y})`} />
        ))}

        <path d="M146 136 C158 100 148 66 124 48" fill="none" strokeWidth="2.5" />
        {[52, 64, 76, 90, 104, 118].map((y, i) => (
          <ellipse key={i} cx={154 - i * 4} cy={y} rx="4" ry="2.5" transform={`rotate(${-30 + i * 8} ${154 - i * 4} ${y})`} />
        ))}
      </g>

      {/* Central Mosque with Mehrab and Minbar */}
      <circle cx="100" cy="104" r="34" fill="url(#afBg)" stroke="url(#afGold)" strokeWidth="2.5" />
      {/* Dome */}
      <path d="M84 94 Q100 78 116 94 Z" fill="url(#afGold)" />
      <line x1="100" y1="78" x2="100" y2="72" stroke="url(#afGold)" strokeWidth="2" />
      <circle cx="100" cy="71" r="2" fill="url(#afGold)" />
      {/* Mosque Pillars & Base */}
      <rect x="85" y="94" width="30" height="28" fill="none" stroke="url(#afGold)" strokeWidth="1.8" />
      {/* Mehrab Arch */}
      <path d="M93 122 V106 Q100 100 107 106 V122 Z" fill="none" stroke="url(#afGold)" strokeWidth="1.8" />
      {/* Minbar Steps */}
      <path d="M96 118 H104 M97 114 H103 M98 110 H102" stroke="url(#afGold)" strokeWidth="1.2" />

      {/* Two Afghan Flags beside Mosque */}
      <line x1="76" y1="124" x2="76" y2="88" stroke="url(#afGold)" strokeWidth="1.8" />
      <polygon points="76,88 64,94 76,100" fill="#000" stroke="url(#afGold)" strokeWidth="1" />

      <line x1="124" y1="124" x2="124" y2="88" stroke="url(#afGold)" strokeWidth="1.8" />
      <polygon points="124,88 136,94 124,100" fill="#047857" stroke="url(#afGold)" strokeWidth="1" />

      {/* Banner at bottom */}
      <path
        d="M48 156 Q100 170 152 156 L147 170 Q100 182 53 170 Z"
        fill="url(#afGold)"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#0C0A09"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="2"
      >
        AFGHANISTAN OPERATIONS
      </text>
    </svg>
  );
}

/**
 * Official Golden Falcon Monogram of the United Arab Emirates
 * Features: Quraysh Falcon, disc with UAE flag and 7 stars, golden parchment banner.
 */
export function UaeEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="uaeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="uaeGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#uaeGlow)" />
      <circle cx="100" cy="100" r="84" stroke="url(#uaeGold)" strokeWidth="2" strokeDasharray="5 3" />

      {/* Falcon Head & Beak */}
      <path
        d="M96 46 C96 38 106 38 108 42 C114 42 118 46 116 52 C114 56 108 58 102 58 Z"
        fill="url(#uaeGold)"
      />
      <circle cx="106" cy="46" r="1.8" fill="#000" />
      <path d="M116 48 L122 52 L116 54 Z" fill="url(#uaeGold)" stroke="#78350F" strokeWidth="0.8" />

      {/* Outstretched Majestic Wings (Left & Right) */}
      <g fill="url(#uaeGold)" stroke="#92400E" strokeWidth="0.8">
        {/* Left Wing Feathers */}
        <path d="M88 62 C70 54 48 58 36 72 C46 76 60 76 74 74 Z" />
        <path d="M86 72 C68 68 44 76 34 92 C48 94 62 90 76 84 Z" />
        <path d="M84 82 C68 82 46 94 40 112 C54 110 68 102 78 94 Z" />
        <path d="M82 94 C70 98 52 112 50 128 C64 122 74 112 82 104 Z" />

        {/* Right Wing Feathers */}
        <path d="M112 62 C130 54 152 58 164 72 C154 76 140 76 126 74 Z" />
        <path d="M114 72 C132 68 156 76 166 92 C152 94 138 90 124 84 Z" />
        <path d="M116 82 C132 82 154 94 160 112 C146 110 132 102 122 94 Z" />
        <path d="M118 94 C130 98 148 112 150 128 C136 122 126 112 118 104 Z" />

        {/* Tail Feathers */}
        <polygon points="94,136 100,154 106,136" />
        <polygon points="88,134 94,150 98,136" />
        <polygon points="102,136 106,150 112,134" />
      </g>

      {/* Central Disc: UAE National Flag & 7 Emirates Stars */}
      <circle cx="100" cy="98" r="26" fill="#FFF" stroke="url(#uaeGold)" strokeWidth="3" />
      {/* UAE Flag stripes inside disc */}
      <g clipPath="url(#uaeDiscClip)">
        <clipPath id="uaeDiscClip">
          <circle cx="100" cy="98" r="23" />
        </clipPath>
        {/* Top: Green */}
        <rect x="84" y="75" width="40" height="15" fill="#00732F" />
        {/* Middle: White */}
        <rect x="84" y="90" width="40" height="16" fill="#FFFFFF" />
        {/* Bottom: Black */}
        <rect x="84" y="106" width="40" height="15" fill="#000000" />
        {/* Left vertical: Red */}
        <rect x="76" y="75" width="13" height="46" fill="#FF0000" />
      </g>

      {/* 7 Golden Stars around disc */}
      {[0, 51.4, 102.8, 154.2, 205.6, 257, 308.4].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 100 + 29 * Math.cos(rad);
        const cy = 98 + 29 * Math.sin(rad);
        return <circle key={i} cx={cx} cy={cy} r="1.6" fill="url(#uaeGold)" />;
      })}

      {/* Talons holding Golden Scroll */}
      <path d="M90 132 L88 140 M92 132 L92 140 M108 132 L108 140 M110 132 L112 140" stroke="url(#uaeGold)" strokeWidth="2.2" strokeLinecap="round" />

      {/* Golden Scroll Banner */}
      <path
        d="M44 156 Q100 170 156 156 L151 170 Q100 182 49 170 Z"
        fill="url(#uaeGold)"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#06122D"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="2"
      >
        UNITED ARAB EMIRATES
      </text>
    </svg>
  );
}

/**
 * Royal Monogram of Saudi Arabia
 * Features: Royal Palm Tree above crossed curved scimitars, royal gold medallion.
 */
export function SaudiArabiaEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="saGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="saGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="saGreen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#065F46" />
          <stop offset="100%" stopColor="#022C22" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#saGlow)" />
      <circle cx="100" cy="100" r="84" stroke="url(#saGold)" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="78" stroke="url(#saGold)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />

      {/* Majestic Royal Palm Tree */}
      <g fill="url(#saGold)" stroke="#92400E" strokeWidth="0.8">
        {/* Palm Trunk */}
        <path d="M96 106 L98 68 L102 68 L104 106 Z" fill="url(#saGold)" />
        <line x1="97" y1="76" x2="103" y2="76" stroke="#92400E" strokeWidth="1.2" />
        <line x1="97" y1="84" x2="103" y2="84" stroke="#92400E" strokeWidth="1.2" />
        <line x1="96" y1="92" x2="104" y2="92" stroke="#92400E" strokeWidth="1.2" />
        <line x1="96" y1="100" x2="104" y2="100" stroke="#92400E" strokeWidth="1.2" />

        {/* Palm Fronds (Branches) */}
        {/* Central Top */}
        <path d="M100 68 C100 50 100 40 100 36 C100 40 100 50 100 68" stroke="url(#saGold)" strokeWidth="2.5" />
        <path d="M100 36 C96 46 92 56 100 68 C108 56 104 46 100 36 Z" />

        {/* Left Fronds */}
        <path d="M100 68 C84 56 64 54 50 62 C66 66 82 66 100 68 Z" />
        <path d="M100 68 C80 62 60 70 48 82 C64 80 82 76 100 68 Z" />
        <path d="M100 68 C84 72 68 84 62 98 C74 90 88 82 100 68 Z" />

        {/* Right Fronds */}
        <path d="M100 68 C116 56 136 54 150 62 C134 66 118 66 100 68 Z" />
        <path d="M100 68 C120 62 140 70 152 82 C136 80 118 76 100 68 Z" />
        <path d="M100 68 C116 72 132 84 138 98 C126 90 112 82 100 68 Z" />
      </g>

      {/* Two Crossed Curved Scimitars (Arabian Swords) */}
      <g stroke="url(#saGold)" strokeWidth="3" strokeLinecap="round" fill="none">
        {/* Sword 1: Top-Left to Bottom-Right */}
        <path d="M60 112 Q100 134 140 148" />
        {/* Sword 2: Top-Right to Bottom-Left */}
        <path d="M140 112 Q100 134 60 148" />
      </g>
      {/* Sword Handles & Hilts */}
      <g fill="url(#saGold)" stroke="#78350F" strokeWidth="1">
        {/* Handle Left */}
        <circle cx="58" cy="110" r="3.5" />
        <rect x="58" y="112" width="4" height="6" transform="rotate(-30 58 112)" />

        {/* Handle Right */}
        <circle cx="142" cy="110" r="3.5" />
        <rect x="138" y="112" width="4" height="6" transform="rotate(30 138 112)" />
      </g>

      {/* Banner at bottom */}
      <path
        d="M46 156 Q100 170 154 156 L149 170 Q100 182 51 170 Z"
        fill="url(#saGold)"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#022C22"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="2"
      >
        KINGDOM OF SAUDI ARABIA
      </text>
    </svg>
  );
}

/**
 * National Monogram of India
 * Features: Ashoka Lion Capital with 24-Spoke Dharma Chakra.
 */
export function IndiaEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="inGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="inGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#inGlow)" />
      <circle cx="100" cy="100" r="84" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />

      {/* Ashoka Stambha / 3 Lions Representation */}
      {/* Center Lion */}
      <g fill="#F59E0B" stroke="#92400E" strokeWidth="0.8">
        <path d="M92 42 C92 34 108 34 108 42 C114 44 116 52 114 60 C110 70 90 70 86 60 C84 52 86 44 92 42 Z" />
        {/* Mane */}
        <path d="M84 58 C80 66 84 80 100 82 C116 80 120 66 116 58 C112 66 88 66 84 58 Z" />

        {/* Left Lion Profile */}
        <path d="M72 48 C68 46 64 54 66 62 C70 72 80 76 84 72 C80 64 74 58 72 48 Z" />

        {/* Right Lion Profile */}
        <path d="M128 48 C132 46 136 54 134 62 C130 72 120 76 116 72 C120 64 126 58 128 48 Z" />

        {/* Abacus Base Platform */}
        <rect x="66" y="82" width="68" height="14" rx="2" fill="#F59E0B" />
      </g>

      {/* Central 24-Spoke Ashoka Chakra (Dharma Wheel) */}
      <circle cx="100" cy="116" r="22" stroke="#1D4ED8" strokeWidth="2.5" fill="#EFF6FF" />
      <circle cx="100" cy="116" r="3" fill="#1D4ED8" />
      {/* 24 spokes */}
      {[...Array(12)].map((_, i) => {
        const angle = i * 15;
        const rad = (angle * Math.PI) / 180;
        const x1 = 100 + 21 * Math.cos(rad);
        const y1 = 116 + 21 * Math.sin(rad);
        const x2 = 100 - 21 * Math.cos(rad);
        const y2 = 116 - 21 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1D4ED8" strokeWidth="1.2" />;
      })}

      {/* Flanking Animals on Abacus: Galloping Horse & Bull */}
      <g fill="#F59E0B">
        {/* Horse on Left */}
        <circle cx="68" cy="116" r="2.5" />
        {/* Bull on Right */}
        <circle cx="132" cy="116" r="2.5" />
      </g>

      {/* Banner at bottom */}
      <path
        d="M48 156 Q100 170 152 156 L147 170 Q100 182 53 170 Z"
        fill="#F59E0B"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#06122D"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="2"
      >
        REPUBLIC OF INDIA
      </text>
    </svg>
  );
}

/**
 * National Monogram of China
 * Features: Tiananmen Gate beneath 5 Golden Stars, circular wreath of wheat and cogwheel.
 */
export function ChinaEmblem({ className = "w-24 h-24" }: EmblemProps) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cnGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#991b1b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cnRed" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#cnGlow)" />
      <circle cx="100" cy="100" r="84" stroke="#FBBF24" strokeWidth="2.5" />

      {/* Central Red Disc */}
      <circle cx="100" cy="100" r="76" fill="url(#cnRed)" stroke="#F59E0B" strokeWidth="1.5" />

      {/* 5 Golden Stars (One Large, 4 Small) */}
      {/* Large Center Star */}
      <polygon
        points="100,42 103,52 113,52 105,58 108,68 100,62 92,68 95,58 87,52 97,52"
        fill="#FDE047"
        stroke="#D97706"
        strokeWidth="0.5"
      />
      {/* 4 Arc Stars */}
      {[
        { cx: 80, cy: 50, rot: -20 },
        { cx: 74, cy: 62, rot: -35 },
        { cx: 120, cy: 50, rot: 20 },
        { cx: 126, cy: 62, rot: 35 },
      ].map((st, i) => (
        <polygon
          key={i}
          transform={`translate(${st.cx} ${st.cy}) rotate(${st.rot}) scale(0.4)`}
          points="0,-10 3,-3 10,-3 4,2 6,9 0,5 -6,9 -4,2 -10,-3 -3,-3"
          fill="#FDE047"
        />
      ))}

      {/* Tiananmen Gate Podium & Roofs */}
      <g fill="#FDE047" stroke="#92400E" strokeWidth="0.8">
        {/* Top Pagoda Roof */}
        <polygon points="100,74 78,82 122,82" />
        <polygon points="100,80 72,90 128,90" />
        {/* Gate Wall Structure */}
        <rect x="74" y="90" width="52" height="24" fill="#B91C1C" stroke="#FDE047" strokeWidth="1.5" />
        {/* 5 Arched Gateways */}
        <path d="M96 114 V102 Q100 98 104 102 V114 Z" fill="#FDE047" />
        <path d="M88 114 V105 Q91 102 94 105 V114 Z" fill="#FDE047" />
        <path d="M80 114 V107 Q82 105 84 107 V114 Z" fill="#FDE047" />
        <path d="M106 114 V105 Q109 102 112 105 V114 Z" fill="#FDE047" />
        <path d="M116 114 V107 Q118 105 120 107 V114 Z" fill="#FDE047" />
      </g>

      {/* Industrial Cogwheel at Bottom */}
      <circle cx="100" cy="136" r="14" fill="#FDE047" stroke="#92400E" strokeWidth="1" />
      <circle cx="100" cy="136" r="6" fill="#B91C1C" />

      {/* Banner at bottom */}
      <path
        d="M48 156 Q100 170 152 156 L147 170 Q100 182 53 170 Z"
        fill="#FDE047"
        stroke="#78350F"
        strokeWidth="1"
      />
      <text
        x="100"
        y="167"
        textAnchor="middle"
        fill="#991B1B"
        fontFamily="sans-serif"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="2"
      >
        PEOPLE'S REPUBLIC OF CHINA
      </text>
    </svg>
  );
}
