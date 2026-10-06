/**
 * ID Card & Identity Document Extractor (Local + Intelligent Rules)
 * 
 * Supports:
 * - UAE Emirates ID
 * - Pakistan CNIC / NICOP / Smart Card
 * - India Aadhaar / PAN / Driving License
 * - Afghan Tazkira / Electronic National ID
 * - International Passports (MRZ & Visual Zone)
 * - Driving Licenses & General Government IDs
 */

export interface ExtractedIdCard {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  fullName: string;
  dob: string;
  issueDate: string;
  expiryDate: string;
  gender: string;
  nationality: string;
  country: string;
  confidence: number;
  rawText: string;
}

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function normDate(raw: string): string | null {
  const s = clean(raw).replace(/\s+/g, "");
  // yyyy-mm-dd or yyyy/mm/dd or yyyy.mm.dd
  let m = s.match(/\b(19\d{2}|20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](19\d{2}|20\d{2})\b/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // dd Mon yyyy (e.g. 15 Aug 1995 or 15-Aug-1995)
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  const mm = raw.match(/\b(\d{1,2})[ -]?([A-Za-z]{3,9})[ ,-]?(19\d{2}|20\d{2})\b/);
  if (mm) {
    const mi = months.indexOf(mm[2].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${mm[3]}-${String(mi + 1).padStart(2, "0")}-${mm[1].padStart(2, "0")}`;
  }

  return null;
}

export function parseIdCardText(text: string, docTypeHint?: string): ExtractedIdCard {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = text.replace(/\r/g, "");

  let documentType = docTypeHint || "National ID Card";
  let documentNumber = "";
  let firstName = "";
  let lastName = "";
  let fatherName = "";
  let fullName = "";
  let dob = "";
  let issueDate = "";
  let expiryDate = "";
  let gender = "";
  let nationality = "";
  let country = "";
  let confidence = 0.5;

  // ── 1. Check for Passport & MRZ ──────────────────────────────────────────
  const isPassport = /passport|passeport|pasaporte|reiseba|p<[a-z]{3}/i.test(fullText) || (docTypeHint && docTypeHint.toLowerCase().includes("passport"));
  const mrzMatches = fullText.match(/P<([A-Z]{3})([A-Z<]+)<<([A-Z<]+)/i);
  if (mrzMatches) {
    documentType = "Passport";
    country = mrzMatches[1] || "";
    const surnameRaw = mrzMatches[2].replace(/</g, " ").trim();
    const givenRaw = mrzMatches[3].replace(/</g, " ").trim();
    lastName = surnameRaw;
    firstName = givenRaw;
    fullName = `${givenRaw} ${surnameRaw}`.trim();
    confidence = 0.95;
  }

  // ── 2. Check for UAE Emirates ID (Front & Back MRZ) ──────────────────────
  const emiratesIdMatch =
    fullText.match(/\b(784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d)\b/) ||
    fullText.match(/id\s*number\s*[:.\-]?\s*(784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d)/i) ||
    fullText.match(/(?:ILARE\d*?)(784\d{12})/i) ||
    fullText.match(/\b(784\d{12})\b/);

  if (emiratesIdMatch || /united arab emirates|emirates id|federal authority for identity|الهيئة الاتحادية للهوية/i.test(fullText) || (docTypeHint && docTypeHint.toLowerCase().includes("emirates"))) {
    documentType = "Emirates ID (UAE)";
    country = "United Arab Emirates";
    if (emiratesIdMatch) {
      const rawDigits = (emiratesIdMatch[1] || emiratesIdMatch[0]).replace(/[\s-]/g, "");
      const match784 = rawDigits.match(/784\d{12}/);
      if (match784) {
        const d = match784[0];
        documentNumber = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
      } else if (rawDigits.length === 15) {
        documentNumber = `${rawDigits.slice(0, 3)}-${rawDigits.slice(3, 7)}-${rawDigits.slice(7, 14)}-${rawDigits.slice(14)}`;
      } else {
        documentNumber = emiratesIdMatch[1];
      }
      confidence = Math.max(confidence, 0.9);
    }
  }

  // ── 3. Check for Pakistan CNIC / NICOP ───────────────────────────────────
  const cnicMatch =
    fullText.match(/\b(\d{5}[-\s]\d{7}[-\s]\d)\b/) ||
    fullText.match(/identity\s*number\s*[:.\-]?\s*(\d{5}[-\s]?\d{7}[-\s]?\d)/i) ||
    fullText.match(/\b(\d{13})\b/);

  if (cnicMatch || /national identity card|islamic republic of pakistan|nadra|nicop/i.test(fullText) || (docTypeHint && docTypeHint.toLowerCase().includes("cnic"))) {
    documentType = "CNIC / Pakistan ID";
    country = "Pakistan";
    if (cnicMatch) {
      const rawDigits = cnicMatch[1].replace(/[\s-]/g, "");
      if (rawDigits.length === 13) {
        documentNumber = `${rawDigits.slice(0, 5)}-${rawDigits.slice(5, 12)}-${rawDigits.slice(12)}`;
      } else {
        documentNumber = cnicMatch[1];
      }
      confidence = Math.max(confidence, 0.9);
    }
  }

  // ── 4. Check for Indian Aadhaar Card ──────────────────────────────────────
  const aadhaarMatch = fullText.match(/\b(\d{4}\s\d{4}\s\d{4})\b/) || fullText.match(/\b(\d{12})\b/);
  if ((aadhaarMatch && /unique identification authority|aadhaar|govt\.? of india/i.test(fullText)) || /aadhaar/i.test(fullText)) {
    documentType = "Aadhaar Card (India)";
    country = "India";
    if (aadhaarMatch) {
      const rawDigits = aadhaarMatch[1].replace(/\s/g, "");
      documentNumber = `${rawDigits.slice(0, 4)} ${rawDigits.slice(4, 8)} ${rawDigits.slice(8, 12)}`;
      confidence = Math.max(confidence, 0.9);
    }
  }

  // ── 5. Check for Afghan Tazkira / Afghan ID ──────────────────────────────
  if (/afghanistan|tazkira|electronic national id|د افغانستان اسلامي|تذکره/i.test(fullText)) {
    documentType = "Afghan Tazkira / ID";
    country = "Afghanistan";
    const afgNumMatch = fullText.match(/\b(\d{4}[-\s]?\d{4}[-\s]?\d{5,8})\b/) || fullText.match(/\b(\d{10,15})\b/);
    if (afgNumMatch) {
      documentNumber = afgNumMatch[1];
      confidence = Math.max(confidence, 0.85);
    }
  }

  // ── Fallback document number search if not found ────────────────────────
  if (!documentNumber) {
    const genericIdMatch =
      fullText.match(/(?:id|card|document|passport|identity|license|no\.?|number)\s*[:#\-]?\s*([A-Z0-9\-]{5,20})/i) ||
      fullText.match(/\b([A-Z]{1,2}[0-9]{6,9})\b/);
    if (genericIdMatch) {
      documentNumber = genericIdMatch[1].trim();
    }
  }

  // ── 6. Extract Names ──────────────────────────────────────────────────────
  if (!fullName) {
    const nameMatch =
      fullText.match(/(?:name|full\s*name|holder's\s*name|holder\s*name|الاسم)\s*[:.\-]?\s*([A-Za-z\s.]{3,40})(?=\n|$|,|\s{2,})/i) ||
      fullText.match(/(?:given\s*names?)\s*[:.\-]?\s*([A-Za-z\s.]{2,30})/i);
    if (nameMatch) {
      fullName = clean(nameMatch[1]);
    }
  }

  // Back MRZ Line 2 Name (e.g. ABDULLAH<<ASMAT<ULLAH<ABDULLAH)
  const backMrzNameMatch = fullText.match(/([A-Z]+)<<([A-Z<]+)/);
  if (backMrzNameMatch && !fullName) {
    const surname = backMrzNameMatch[1].replace(/</g, " ").trim();
    const given = backMrzNameMatch[2].replace(/</g, " ").trim();
    fullName = `${given} ${surname}`.trim();
  }

  const fatherMatch =
    fullText.match(/(?:father(?:'s)?\s*name|father\s*\/Husband\s*name|s\/o|d\/o|w\/o|husband\s*name|guardian|اسم\s*الاب)\s*[:.\-]?\s*([A-Za-z\s.]{3,40})(?=\n|$|,|\s{2,})/i);
  if (fatherMatch) {
    fatherName = clean(fatherMatch[1]);
  }

  if (fullName && !firstName) {
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
    } else if (parts.length > 2) {
      firstName = parts.slice(0, 2).join(" ");
      lastName = parts.slice(2).join(" ");
    }
  }

  // ── 7. Extract Dates (DOB, Issue Date, Expiry Date) ───────────────────────
  const dobMatch =
    fullText.match(/(?:date\s*of\s*birth|dob|birth\s*date|born|تاريخ\s*الميلاد)\s*[:.\-]?\s*([0-3]?\d[\s/.-]+[0-1]?\d[\s/.-]+(?:19|20)\d{2}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (dobMatch) {
    const d = normDate(dobMatch[1]);
    if (d) dob = d;
  }

  const issueMatch =
    fullText.match(/(?:date\s*of\s*issue|issue\s*date|issuing\s*date|issued|date\s*d'emission|تاريخ\s*الإصدار|تاريخ\s*الاصدار)\s*[:.\-]?\s*([0-3]?\d[\s/.-]+[0-1]?\d[\s/.-]+(?:19|20)\d{2}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (issueMatch) {
    const d = normDate(issueMatch[1]);
    if (d) issueDate = d;
  }

  const expiryMatch =
    fullText.match(/(?:date\s*of\s*expiry|expiry\s*date|expiration\s*date|expires|valid\s*until|valid\s*thru|date\s*d'expiration|تاريخ\s*الإنتهاء|تاريخ\s*الانتهاء)\s*[:.\-]?\s*([0-3]?\d[\s/.-]+[0-1]?\d[\s/.-]+(?:19|20)\d{2}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (expiryMatch) {
    const d = normDate(expiryMatch[1]);
    if (d) expiryDate = d;
  }

  // Generic dates fallback if specific labels were not found
  const allDates = Array.from(fullText.matchAll(/\b([0-3]?\d[\s/.-]+[0-1]?\d[\s/.-]+(?:19|20)\d{2})\b/g))
    .map((m) => normDate(m[1]))
    .filter((d): d is string => Boolean(d));

  if (!dob && allDates.length > 0) {
    // Earliest date is likely DOB
    const sorted = [...allDates].sort();
    dob = sorted[0];
    if (!issueDate && sorted.length > 1) issueDate = sorted[1];
    if (!expiryDate && sorted.length > 2) expiryDate = sorted[sorted.length - 1];
  }

  // ── 8. Extract Gender / Sex ───────────────────────────────────────────────
  const genderMatch = fullText.match(/(?:sex|gender|الجنس)\s*[:.\-]?\s*\b(M(?:ale)?|F(?:emale)?|ذكر|انثى)\b/i);
  if (genderMatch) {
    const g = genderMatch[1].toUpperCase();
    gender = g.startsWith("M") || g.includes("ذكر") ? "Male" : "Female";
  }

  // ── 9. Extract Nationality ────────────────────────────────────────────────
  const natMatch = fullText.match(/(?:nationality|citizenship|الجنسية)\s*[:.\-]?\s*([A-Za-z\s]{3,25})/i);
  if (natMatch) {
    nationality = clean(natMatch[1]);
  }

  return {
    documentType,
    documentNumber,
    firstName,
    lastName,
    fatherName,
    fullName,
    dob,
    issueDate,
    expiryDate,
    gender,
    nationality,
    country,
    confidence,
    rawText: fullText.slice(0, 1000),
  };
}
