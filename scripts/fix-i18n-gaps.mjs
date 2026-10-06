import fs from "node:fs";

let src = fs.readFileSync("lib/i18n/ui.ts", "utf8");

function updateDict(lang, keyValues) {
  const start = src.search(new RegExp(`const ${lang}\\s*:\\s*Dict\\s*=\\s*\\{`));
  if (start === -1) {
    console.error(`Could not find start of ${lang}`);
    return;
  }
  const braceStart = src.indexOf("{", start);
  let depth = 0, i = braceStart, end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  let body = src.slice(braceStart + 1, end);
  for (const [k, v] of Object.entries(keyValues)) {
    const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reg = new RegExp(`("${escapedKey}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
    if (reg.test(body)) {
      body = body.replace(reg, `$1"${v}"`);
      console.log(`Updated [${lang}] ${k} -> ${v}`);
    } else {
      console.warn(`Key not found in [${lang}]: ${k}`);
    }
  }
  src = src.slice(0, braceStart + 1) + body + src.slice(end);
}

// UR
updateDict("ur", {
  "branch.saved_status_msg": "{action}: {name} ({code}) - محفوظ شدہ"
});

// AR
updateDict("ar", {
  "report.builder_pdf": "تقرير PDF",
  "branch.saved_status_msg": "{action}: {name} ({code}) - تم الحفظ",
  "acct.ntn": "الرقم الضريبي (NTN)"
});

// FA
updateDict("fa", {
  "report.builder_pdf": "گزارش PDF",
  "branch.saved_status_msg": "{action}: {name} ({code}) - ذخیره شد",
  "acct.ntn": "شماره مالیاتی (NTN)"
});

// PS
updateDict("ps", {
  "report.builder_pdf": "د PDF راپور",
  "branch.saved_status_msg": "{action}: {name} ({code}) - خوندي شو",
  "sed.f_iban": "آیبان (IBAN)",
  "acct.iban": "آیبان (IBAN)",
  "acct.ntn": "د مالیې ملي شمېره (NTN)"
});

fs.writeFileSync("lib/i18n/ui.ts", src, "utf8");
console.log("Successfully wrote updated lib/i18n/ui.ts");
