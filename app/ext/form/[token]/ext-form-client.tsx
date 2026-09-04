"use client";

/**
 * External Form Client — /ext/form/[token]
 *
 * Standalone, high-converting public form page.
 * Matching the exact 4-Step Smart & Responsive UI:
 *   Step 1: Personal Info (Multi-Phone + Numbers Keypad), Documents (CNIC Front/Back, Passport Pages) & Contracts
 *   Step 2: Address Information (100% 5-Language Localized Country -> State -> City -> Postal Code Cascader)
 *   Step 3: Review Your Information (Structured Cards with Edit jump-backs)
 *   Step 4: Photo, Final Submit & Comprehensive Confirmation Receipt Card
 *
 * 100% Responsive on Mobile (iPhone/Android) and Desktop.
 * 5-Language Parity (English, Urdu, Arabic, Persian, Pashto) with full RTL and A-to-Z translation.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { t as centralT } from "@/lib/i18n/ui";
import { locName } from "./location-translations";
import {
  Shield,
  Globe,
  User,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  CreditCard,
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Download,
  Printer,
  MapPin,
  Building,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Send,
  AlertCircle,
  Check,
  X,
  FileCheck,
  Briefcase,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  RotateCcw,
  Calendar
} from "lucide-react";

// ─── 5-Language Dictionary ────────────────────────────────────────────────────

type Lang = "en" | "ur" | "ar" | "fa" | "ps";

const LANGS: { code: Lang; label: string; dir: "ltr" | "rtl"; nativeName: string }[] = [
  { code: "en", label: "English", dir: "ltr", nativeName: "English" },
  { code: "ur", label: "Urdu", dir: "rtl", nativeName: "اردو" },
  { code: "ar", label: "Arabic", dir: "rtl", nativeName: "العربية" },
  { code: "fa", label: "Persian", dir: "rtl", nativeName: "فارسی" },
  { code: "ps", label: "Pashto", dir: "rtl", nativeName: "پښتو" },
];

const dictEn: Record<string, string> = {
  "headerTitle": "DIGITAL DOCK ERP Public Customer Verification",
  "headerSubtitle": "Easy 5 Steps",
  "step1": "Identity & Personal Info",
  "step2": "Upload Documents",
  "step3": "Verify Details",
  "step4": "Additional Info",
  "step5": "Generate & Download PDF",
  "personalInfoTitle": "Personal Information",
  "personalInfoSub": "Please enter your personal details.",
  "firstName": "First Name",
  "firstNamePh": "Enter first name",
  "lastName": "Last Name",
  "lastNamePh": "Enter last name",
  "fatherName": "Father's / Guardian's Name",
  "fatherNamePh": "Enter father / guardian name",
  "mobile": "Mobile / Phone",
  "mobilePh": "Enter mobile number",
  "addAnotherMobile": "+ Add Another Phone",
  "whatsapp": "WhatsApp Number",
  "whatsappPh": "Enter WhatsApp number",
  "addAnotherWhatsapp": "+ Add Another WhatsApp",
  "email": "Email Address (English)",
  "gender": "Gender",
  "male": "Male",
  "female": "Female",
  "other": "Other",
  "documentsTitle": "Documents",
  "documentsSub": "Add your documents one by one.",
  "docType": "Document Type",
  "docNumber": "Document Number",
  "docNumberPh": "Enter document number",
  "frontSide": "Front Side",
  "backSide": "Back Side",
  "mainPage": "Main Info Page",
  "visaPage": "Visa / Back Page",
  "cameraBtn": "Camera",
  "galleryBtn": "Gallery",
  "addDocBtn": "+ Add Document",
  "contractsTitle": "Contracts & Attachments",
  "contractsSub": "Add applicable agreements or reference letters.",
  "contractType": "Contract Type",
  "addContractBtn": "+ Add Contract",
  "step2Title": "Address Details",
  "step2Sub": "Select country, state, city and enter full street address.",
  "country": "Country",
  "stateProvince": "State / Province / Emirate",
  "city": "City / Port / Commercial Hub",
  "postalCode": "Postal / City Code (Auto-Filled)",
  "fullAddress": "Full Address (Street, Building, Office)",
  "fullAddressPh": "Enter complete street address, suite, or flat number",
  "step3Title": "Review Your Information",
  "step3Sub": "Please verify all details before final submission.",
  "editBtn": "Edit",
  "reviewVerifyBadge": "Are all details accurate? You can edit any section before submitting.",
  "step4Title": "Upload Profile Photo",
  "step4Sub": "Please upload your recent photo.",
  "photoSizeHint": "JPG, PNG (Max 5MB)",
  "nextDocsBtn": "Next: Documents & Contracts →",
  "nextAddressBtn": "Next: Address Details →",
  "nextPhotoBtn": "Next: Profile Photo →",
  "nextReviewBtn": "Next: Review & Application Report →",
  "backBtn": "Back",
  "submitFormBtn": "Submit Form",
  "successTitle": "Form Submitted Successfully!",
  "successMsg": "Thank you! Your submission has been securely recorded in our ERP system.",
  "receiptTitle": "Official Submission Receipt",
  "receiptRef": "Reference Token",
  "submittedOn": "Submitted On",
  "printReceipt": "Print / Save Receipt",
  "submitAnother": "Submit Another Form",
  "errorInvalid": "Invalid or Expired Link",
  "loading": "Loading form...",
  "issueDate": "Issue Date",
  "expiryDate": "Expiry Date",
  "dob": "Date of Birth",
  "contactType": "Contact Type",
  "customDocName": "Custom Document Name",
  "customDocNamePh": "e.g. Tazkira / QID / Business Card",
  "addContactBtn": "+ Add Another Contact",
  "phoneLabel": "Phone / Contact Number",
  "aiScanTitle": "⚡ Instant AI Document & Smart ID Scanner",
  "aiScanSubtitle": "Take a photo of your ID card — names, ID number & dates are auto-extracted instantly!",
  "aiScanningBadge": "⚡ Scanning & Auto-Extracting details...",
  "aiScanSuccessMsg": "Document details auto-extracted! You can review or edit anytime.",
  "retakeBtn": "Retake",
  "clearBtn": "Clear",
  "viewFullBtn": "View Full",
  "frontSideReady": "Front Side (Ready)",
  "backSideReady": "Back Side (Ready)",
  "downloadSlipBtn": "Download Application Slip (PDF)",
  "printSlipBtn": "Print Application Sheet",
  "appSlipHeading": "Official Registration & Verification Sheet",
  "appSlipSub": "Please review and download your complete verification application before final submission.",
  "declarationText": "I hereby confirm that the personal details, contact information, address, and uploaded documents provided in this application are accurate, true, and complete.",
  "issued": "Issued",
  "expires": "Expires",
  "optional": "Optional",
  "changeLanguage": "Change Language",
  "customLabelPh": "Enter Custom Label (e.g. Office Assistant / Warehouse)",
  "postalCodeShort": "Postal Code",
};

function t(key: string, lang: string): string {
  return centralT(lang as never, ("extform." + key) as never, dictEn[key] ?? key);
}

// Enum-option label lookup (Contact / Document / Contract types) — central dict, value as fallback.
const optSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const ctLabel = (v: string, lang: string) => centralT(lang as never, ("extform.ct_" + optSlug(v)) as never, v);
const docLabel = (v: string, lang: string) => centralT(lang as never, ("extform.doc_" + optSlug(v)) as never, v);
const cntLabel = (v: string, lang: string) => centralT(lang as never, ("extform.cnt_" + optSlug(v)) as never, v);

// ─── Location Dataset & 5-Language Translations ───────────────────────────────

// LOCATION_TRANSLATIONS + locName() moved to ./location-translations.ts


interface CityData {
  name: string;
  postalCode: string;
  cityCode: string;
}

interface StateData {
  cities: CityData[];
}

interface CountryData {
  code: string;
  phoneCode: string;
  states: Record<string, StateData>;
}

const LOCATION_HIERARCHY: Record<string, CountryData> = {
  Pakistan: {
    code: "PK",
    phoneCode: "+92",
    states: {
      Sindh: {
        cities: [
          { name: "Karachi", postalCode: "74000", cityCode: "KHI" },
          { name: "Hyderabad", postalCode: "71000", cityCode: "HYD" },
          { name: "Sukkur", postalCode: "65200", cityCode: "SKR" },
          { name: "Larkana", postalCode: "77150", cityCode: "LRK" },
          { name: "Mirpur Khas", postalCode: "69000", cityCode: "MPK" },
          { name: "Nawabshah", postalCode: "67450", cityCode: "NBS" },
        ],
      },
      Punjab: {
        cities: [
          { name: "Lahore", postalCode: "54000", cityCode: "LHE" },
          { name: "Rawalpindi", postalCode: "46000", cityCode: "RWP" },
          { name: "Faisalabad", postalCode: "38000", cityCode: "FSD" },
          { name: "Multan", postalCode: "60000", cityCode: "MUX" },
          { name: "Gujranwala", postalCode: "52250", cityCode: "GUJ" },
          { name: "Sialkot", postalCode: "51310", cityCode: "SKT" },
          { name: "Bahawalpur", postalCode: "63100", cityCode: "BWP" },
          { name: "Sargodha", postalCode: "40100", cityCode: "SGD" },
          { name: "Sheikhupura", postalCode: "39350", cityCode: "SKP" },
          { name: "Rahim Yar Khan", postalCode: "64200", cityCode: "RYK" },
        ],
      },
      "Khyber Pakhtunkhwa": {
        cities: [
          { name: "Peshawar", postalCode: "25000", cityCode: "PEW" },
          { name: "Mardan", postalCode: "23200", cityCode: "MDN" },
          { name: "Abbottabad", postalCode: "22010", cityCode: "ABT" },
          { name: "Swat (Mingora)", postalCode: "19130", cityCode: "SWT" },
          { name: "Dera Ismail Khan", postalCode: "29050", cityCode: "DIK" },
          { name: "Kohat", postalCode: "26000", cityCode: "KHT" },
          { name: "Bannu", postalCode: "28100", cityCode: "BNU" },
        ],
      },
      Balochistan: {
        cities: [
          { name: "Quetta", postalCode: "87300", cityCode: "UET" },
          { name: "Gwadar", postalCode: "91200", cityCode: "GWD" },
          { name: "Chaman (Border)", postalCode: "86000", cityCode: "CHM" },
          { name: "Turbat", postalCode: "92600", cityCode: "TBT" },
          { name: "Hub Industrial", postalCode: "90150", cityCode: "HUB" },
          { name: "Sibi", postalCode: "82000", cityCode: "SBI" },
          { name: "Khuzdar", postalCode: "89100", cityCode: "KZD" },
        ],
      },
      "Islamabad Capital Territory": {
        cities: [{ name: "Islamabad", postalCode: "44000", cityCode: "ISB" }],
      },
      "Azad Jammu & Kashmir": {
        cities: [
          { name: "Muzaffarabad", postalCode: "13100", cityCode: "MZD" },
          { name: "Mirpur", postalCode: "10250", cityCode: "MPR" },
        ],
      },
    },
  },
  "United Arab Emirates": {
    code: "AE",
    phoneCode: "+971",
    states: {
      Dubai: {
        cities: [
          { name: "Dubai (Deira / Port Rashid)", postalCode: "00000", cityCode: "DXB" },
          { name: "Jebel Ali Free Zone (JAFZA)", postalCode: "00000", cityCode: "JAF" },
          { name: "Bur Dubai", postalCode: "00000", cityCode: "BDB" },
          { name: "Al Quoz Industrial", postalCode: "00000", cityCode: "AQZ" },
        ],
      },
      "Abu Dhabi": {
        cities: [
          { name: "Abu Dhabi City", postalCode: "00000", cityCode: "AUH" },
          { name: "Musaffah Industrial", postalCode: "00000", cityCode: "MSF" },
          { name: "Khalifa Port (KIZAD)", postalCode: "00000", cityCode: "KHD" },
          { name: "Al Ain", postalCode: "00000", cityCode: "AAN" },
        ],
      },
      Sharjah: {
        cities: [
          { name: "Sharjah City", postalCode: "00000", cityCode: "SHJ" },
          { name: "Hamriyah Free Zone", postalCode: "00000", cityCode: "HFZ" },
          { name: "Khor Fakkan", postalCode: "00000", cityCode: "KLF" },
        ],
      },
      Ajman: {
        cities: [{ name: "Ajman Free Zone / City", postalCode: "00000", cityCode: "AJM" }],
      },
    },
  },
  Afghanistan: {
    code: "AF",
    phoneCode: "+93",
    states: {
      Kabul: {
        cities: [{ name: "Kabul City", postalCode: "1001", cityCode: "KBL" }],
      },
      Kandahar: {
        cities: [
          { name: "Kandahar City", postalCode: "3801", cityCode: "KDH" },
          { name: "Spin Boldak Border Crossing", postalCode: "3805", cityCode: "SBD" },
        ],
      },
      Herat: {
        cities: [
          { name: "Herat City", postalCode: "3001", cityCode: "HEA" },
          { name: "Islam Qala Border Crossing", postalCode: "3005", cityCode: "ISQ" },
          { name: "Torghundi Border", postalCode: "3006", cityCode: "TGH" },
        ],
      },
      Nangarhar: {
        cities: [
          { name: "Jalalabad City", postalCode: "2601", cityCode: "JAA" },
          { name: "Torkham Border Crossing", postalCode: "2605", cityCode: "TKM" },
        ],
      },
      Balkh: {
        cities: [
          { name: "Mazar-i-Sharif", postalCode: "1701", cityCode: "MZR" },
          { name: "Hairatan Port / Border", postalCode: "1705", cityCode: "HRT" },
        ],
      },
      Nimruz: {
        cities: [{ name: "Zaranj (Milak Border)", postalCode: "8501", cityCode: "ZRJ" }],
      },
    },
  },
  "Saudi Arabia": {
    code: "SA",
    phoneCode: "+966",
    states: {
      Riyadh: {
        cities: [{ name: "Riyadh City", postalCode: "11564", cityCode: "RUH" }],
      },
      Makkah: {
        cities: [{ name: "Jeddah Islamic Port / City", postalCode: "21589", cityCode: "JED" }],
      },
      "Eastern Province": {
        cities: [{ name: "King Abdulaziz Port (Dammam)", postalCode: "31411", cityCode: "DMM" }],
      },
    },
  },
  China: {
    code: "CN",
    phoneCode: "+86",
    states: {
      Zhejiang: {
        cities: [{ name: "Yiwu (International Trade City)", postalCode: "322000", cityCode: "YIW" }],
      },
      Guangdong: {
        cities: [{ name: "Guangzhou (Huangpu / Nansha Port)", postalCode: "510000", cityCode: "CAN" }],
      },
      Shanghai: {
        cities: [{ name: "Shanghai Port", postalCode: "200000", cityCode: "SHA" }],
      },
    },
  },
  Turkey: {
    code: "TR",
    phoneCode: "+90",
    states: {
      Istanbul: {
        cities: [{ name: "Istanbul (Ambarli Port)", postalCode: "34000", cityCode: "IST" }],
      },
      Mersin: {
        cities: [{ name: "Mersin International Port", postalCode: "33000", cityCode: "MER" }],
      },
    },
  },
  Iran: {
    code: "IR",
    phoneCode: "+98",
    states: {
      Hormozgan: {
        cities: [{ name: "Bandar Abbas (Shahid Rajaee)", postalCode: "79177", cityCode: "BND" }],
      },
      "Sistan & Baluchestan": {
        cities: [
          { name: "Chabahar (Beheshti Port)", postalCode: "99717", cityCode: "CHB" },
          { name: "Zahedan / Mirjaveh Border", postalCode: "98135", cityCode: "ZAH" },
        ],
      },
      Tehran: {
        cities: [{ name: "Tehran", postalCode: "11369", cityCode: "THR" }],
      },
    },
  },
  Oman: {
    code: "OM",
    phoneCode: "+968",
    states: {
      Muscat: {
        cities: [{ name: "Muscat / Port Sultan Qaboos", postalCode: "100", cityCode: "MCT" }],
      },
      "Al Batinah": {
        cities: [{ name: "Sohar Port & Freezone", postalCode: "311", cityCode: "SOH" }],
      },
    },
  },
  "United Kingdom": {
    code: "GB",
    phoneCode: "+44",
    states: {
      England: {
        cities: [
          { name: "London", postalCode: "EC1A 1BB", cityCode: "LON" },
          { name: "Felixstowe Port", postalCode: "IP11 3SY", cityCode: "FXT" },
          { name: "Southampton Port", postalCode: "SO14 2AQ", cityCode: "SOU" },
        ],
      },
    },
  },
  "United States": {
    code: "US",
    phoneCode: "+1",
    states: {
      California: {
        cities: [{ name: "Los Angeles / Long Beach Port", postalCode: "90001", cityCode: "LAX" }],
      },
      Texas: {
        cities: [{ name: "Houston Port / City", postalCode: "77001", cityCode: "HOU" }],
      },
      "New York": {
        cities: [{ name: "New York / Port of NY & NJ", postalCode: "10001", cityCode: "NYC" }],
      },
    },
  },
};

// ─── Document & Contract & Contact Types with 5-Language Labels ───────────────

const CONTACT_TYPES: { value: string }[] = [
  { value: "Mobile" },
  { value: "WhatsApp" },
  { value: "Phone" },
  { value: "Office" },
  { value: "Emergency" },
  { value: "Custom" },
];

const DOC_TYPES: { value: string }[] = [
  { value: "CNIC" },
  { value: "Passport" },
  { value: "Emirates ID" },
  { value: "Tazkira" },
  { value: "Iqama" },
  { value: "Aadhaar Card" },
  { value: "Driving License" },
  { value: "Trade / Tax License" },
  { value: "Custom" },
];

const CONTRACT_TYPES: { value: string }[] = [
  { value: "Employment Contract" },
  { value: "Customer Service Agreement" },
  { value: "Trade & Clearing Terms" },
  { value: "NDA & Confidentiality" },
  { value: "Other Attachment" },
];

interface ContactEntry {
  id: string;
  type: string;
  customLabel?: string;
  value: string;
}

interface DocItem {
  id: string;
  type: string;
  customName?: string;
  number: string;
  issueDate?: string;
  expiryDate?: string;
  dob?: string;
  fileName?: string;
  frontImage?: string;
  backImage?: string;
}

interface ContractItem {
  id: string;
  type: string;
  contractNo: string;
  fileName?: string;
}

/**
 * Client-Side Canvas Image Compression
 * Scales photo to max 1200px and converts to 80% JPEG.
 * Reduces 10MB mobile camera photos to ~120KB-200KB crystal-clear images,
 * eliminating all HTTP 413 and mobile Network Connection Errors!
 */
async function compressImageFile(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ExtFormClient({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("ur");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Link metadata
  const [initialLoading, setInitialLoading] = useState(true);
  const [linkMeta, setLinkMeta] = useState<{
    formType: string;
    createdByName: string | null;
    status: string;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Language Modal
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [contactsList, setContactsList] = useState<ContactEntry[]>([
    { id: "1", type: "Mobile", value: "" },
    { id: "2", type: "WhatsApp", value: "" },
  ]);
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("male");

  // Step 1: Documents
  const [docType, setDocType] = useState("CNIC");
  const [customDocType, setCustomDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDob, setDocDob] = useState("");
  const [docIssueDate, setDocIssueDate] = useState("");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [docFrontImage, setDocFrontImage] = useState<string | null>(null);
  const [docBackImage, setDocBackImage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocItem[]>([]);

  // Smart ID Scanning & Extraction State
  const [scanningId, setScanningId] = useState(false);
  const [scanNotification, setScanNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<{ src: string; title: string } | null>(null);

  // Step 1: Contracts
  const [contractType, setContractType] = useState("Customer Service Agreement");
  const [contracts, setContracts] = useState<ContractItem[]>([]);

  // Step 2: Address Info (Cascading Location)
  const [country, setCountry] = useState("Pakistan");
  const [stateProvince, setStateProvince] = useState("Sindh");
  const [city, setCity] = useState("Karachi");
  const [postalCode, setPostalCode] = useState("74000");
  const [fullAddress, setFullAddress] = useState("");

  // Step 4: Photo & Submission
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTimestamp, setSubmittedTimestamp] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // File Input Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  // Load link details on mount
  useEffect(() => {
    async function checkToken() {
      try {
        const res = await fetch(`/api/public/form-link/${token}`);
        const data = await res.json();
        const linkInfo = data?.data || data?.link;
        if (data?.ok && linkInfo) {
          setLinkMeta(linkInfo);
          if (linkInfo.status === "used" || linkInfo.status === "submitted") {
            setPageError("This form link has already been used and submitted.");
          } else if (linkInfo.status === "expired") {
            setPageError("This form link has expired. Please request a new link.");
          } else if (linkInfo.status === "revoked") {
            setPageError("This form link has been revoked by administration.");
          }
        } else {
          setPageError(data?.error || "Invalid or non-existent form link.");
        }
      } catch {
        setPageError("Could not reach verification server. Please try again.");
      } finally {
        setInitialLoading(false);
      }
    }
    checkToken();
  }, [token]);

  // Update State when Country changes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryObj = LOCATION_HIERARCHY[newCountry];
    if (countryObj) {
      const firstState = Object.keys(countryObj.states)[0] || "";
      setStateProvince(firstState);
      if (firstState && countryObj.states[firstState]) {
        const firstCity = countryObj.states[firstState].cities[0];
        if (firstCity) {
          setCity(firstCity.name);
          setPostalCode(firstCity.postalCode);
        }
      }
    }
  };

  // Update City & Postal Code when State changes
  const handleStateChange = (newState: string) => {
    setStateProvince(newState);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && countryObj.states[newState]) {
      const firstCity = countryObj.states[newState].cities[0];
      if (firstCity) {
        setCity(firstCity.name);
        setPostalCode(firstCity.postalCode);
      }
    }
  };

  // Update Postal Code when City changes
  const handleCityChange = (newCityName: string) => {
    setCity(newCityName);
    const countryObj = LOCATION_HIERARCHY[country];
    if (countryObj && stateProvince && countryObj.states[stateProvince]) {
      const foundCity = countryObj.states[stateProvince].cities.find((c) => c.name === newCityName);
      if (foundCity) {
        setPostalCode(foundCity.postalCode);
      }
    }
  };

  // Contact list handlers
  const handleAddContact = (type: string = "Mobile") => {
    setContactsList((prev) => [
      ...prev,
      { id: Date.now().toString(), type, value: "" },
    ]);
  };

  const handleRemoveContact = (id: string) => {
    setContactsList((prev) => prev.filter((c) => c.id !== id));
  };

  const handleContactTypeChange = (id: string, newType: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, type: newType } : c))
    );
  };

  const handleContactCustomLabelChange = (id: string, label: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, customLabel: label } : c))
    );
  };

  const handleContactValueChange = (id: string, val: string) => {
    setContactsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value: val } : c))
    );
  };

  // Smart OCR Scan & Auto-Fill Handler
  const scanAndAutoFill = async (base64Img: string, typeHint?: string) => {
    setScanningId(true);
    setScanNotification({ message: t("aiScanningBadge", lang), type: "info" });
    try {
      const res = await fetch("/api/public/scan-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Img, docTypeHint: typeHint || docType })
      });
      const data = await res.json();
      if (data?.ok && data?.extracted) {
        const ext = data.extracted;
        if (ext.firstName && !firstName) setFirstName(ext.firstName);
        if (ext.lastName && !lastName) setLastName(ext.lastName);
        if (ext.fatherName && !fatherName) setFatherName(ext.fatherName);
        if (ext.documentNumber) setDocNumber(ext.documentNumber);
        if (ext.dob) setDocDob(ext.dob);
        if (ext.issueDate) setDocIssueDate(ext.issueDate);
        if (ext.expiryDate) setDocExpiryDate(ext.expiryDate);
        if (ext.gender) setGender(ext.gender.toLowerCase() === "female" ? "female" : "male");
        
        if (ext.documentType) {
          const match = DOC_TYPES.find((dt) =>
            dt.value.toLowerCase().includes(ext.documentType.toLowerCase()) ||
            ext.documentType.toLowerCase().includes(dt.value.toLowerCase())
          );
          if (match) setDocType(match.value);
        }

        if (ext.country) {
          const cMatch = Object.keys(LOCATION_HIERARCHY).find(
            (c) => c.toLowerCase() === ext.country.toLowerCase() || ext.country.toLowerCase().includes(c.toLowerCase())
          );
          if (cMatch) handleCountryChange(cMatch);
        }

        const summary = [ext.fullName || `${ext.firstName} ${ext.lastName}`.trim(), ext.documentNumber].filter(Boolean).join(" • ");
        setScanNotification({
          message: summary ? `✓ ${summary} — ${t("aiScanSuccessMsg", lang)}` : t("aiScanSuccessMsg", lang),
          type: "success"
        });
      } else {
        setScanNotification(null);
      }
    } catch {
      setScanNotification(null);
    } finally {
      setScanningId(false);
    }
  };

  // Image Upload Helper with Canvas Compression
  const handleImageUpload = async (file: File | undefined, setter: (val: string | null) => void) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 1400, 0.85);
      setter(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Dedicated Front ID Upload with Auto-Scan Trigger
  const handleFrontUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 1400, 0.85);
      setDocFrontImage(compressed);
      await scanAndAutoFill(compressed, docType);
    } catch {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = reader.result as string;
        setDocFrontImage(res);
        await scanAndAutoFill(res, docType);
      };
      reader.readAsDataURL(file);
    }
  };

  // Dedicated Back ID Upload with Auto-Scan Trigger (MRZ & Details Extraction)
  const handleBackUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1400, 1400, 0.85);
      setDocBackImage(compressed);
      await scanAndAutoFill(compressed, docType);
    } catch {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = reader.result as string;
        setDocBackImage(res);
        await scanAndAutoFill(res, docType);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Document Handler
  const handleAddDoc = () => {
    if (!docNumber && !docFrontImage) return;
    const finalType = docType === "Custom" && customDocType.trim() ? customDocType.trim() : docType;
    const newDoc: DocItem = {
      id: Date.now().toString(),
      type: finalType,
      customName: docType === "Custom" ? customDocType.trim() : undefined,
      number: docNumber || "",
      dob: docDob || undefined,
      issueDate: docIssueDate || undefined,
      expiryDate: docExpiryDate || undefined,
      frontImage: docFrontImage || undefined,
      backImage: docBackImage || undefined,
      fileName: `${finalType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setDocuments((prev) => [...prev, newDoc]);
    setDocNumber("");
    setDocDob("");
    setDocIssueDate("");
    setDocExpiryDate("");
    setCustomDocType("");
    setDocFrontImage(null);
    setDocBackImage(null);
    setScanNotification(null);
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Add Contract Handler
  const handleAddContract = () => {
    const newCnt: ContractItem = {
      id: Date.now().toString(),
      type: contractType,
      contractNo: `CNT-00${contracts.length + 1}`,
      fileName: `${contractType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    };
    setContracts((prev) => [...prev, newCnt]);
  };

  const handleRemoveContract = (id: string) => {
    setContracts((prev) => prev.filter((c) => c.id !== id));
  };

  // Direct Mobile & Desktop Download Slip Helper
  const handleDownloadSlip = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        window.print();
        return;
      }

      // Background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 1200, 1600);

      // Header Banner
      const headerGrad = ctx.createLinearGradient(0, 0, 1200, 0);
      headerGrad.addColorStop(0, "#312e81");
      headerGrad.addColorStop(1, "#4f46e5");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, 1200, 150);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DIGITAL DOCK ERP • OFFICIAL VERIFICATION RECORD", 600, 75);
      ctx.font = "18px monospace";
      ctx.fillStyle = "#c7d2fe";
      ctx.fillText(`TOKEN REF: ${token.toUpperCase()}`, 600, 115);

      // Main Card Container
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(50, 180, 1100, 1370, 20);
      ctx.fill();
      ctx.stroke();

      // Applicant Name & Profile
      ctx.textAlign = "start";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 34px sans-serif";
      ctx.fillText(`${firstName} ${lastName}`.trim() || t("applicant", lang), 90, 260);

      if (fatherName) {
        ctx.font = "bold 22px sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText(`Father / Guardian: ${fatherName}`, 90, 305);
      }

      ctx.font = "18px monospace";
      ctx.fillStyle = "#4f46e5";
      ctx.fillText(`Gender: ${gender.toUpperCase()} | DOB: ${docDob || "N/A"}`, 90, 350);

      // Divider
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(90, 380);
      ctx.lineTo(1110, 380);
      ctx.stroke();

      // Registered Contacts Section
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Registered Contact Numbers:", 90, 425);

      let yPos = 475;
      const validContacts = contactsList.filter((c) => c.value.trim());
      if (validContacts.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 20px sans-serif";
        ctx.fillText("No contacts registered", 90, yPos);
        yPos += 40;
      } else {
        validContacts.forEach((c) => {
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.roundRect(90, yPos - 30, 1020, 48, 10);
          ctx.fill();
          ctx.strokeStyle = "#e2e8f0";
          ctx.stroke();

          ctx.fillStyle = "#4338ca";
          ctx.font = "bold 20px sans-serif";
          const label = c.type === "Custom" && c.customLabel ? c.customLabel : (ctLabel(c.type, lang));
          ctx.fillText(`${label}:`, 110, yPos);

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 22px monospace";
          ctx.fillText(c.value, 340, yPos);
          yPos += 60;
        });
      }

      // Address Section
      yPos += 15;
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Residential & Business Location:", 90, yPos);
      yPos += 45;

      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.roundRect(90, yPos - 30, 1020, 90, 10);
      ctx.fill();
      ctx.strokeStyle = "#e2e8f0";
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(`Country / City: ${country} • ${stateProvince} • ${city} (Postal: ${postalCode})`, 110, yPos);
      yPos += 35;
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#475569";
      ctx.fillText(`Full Street Address: ${fullAddress || "—"}`, 110, yPos);
      yPos += 65;

      // Identity Document Section
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Identity Document & Verification:", 90, yPos);
      yPos += 45;

      ctx.fillStyle = "#eef2ff";
      ctx.beginPath();
      ctx.roundRect(90, yPos - 30, 1020, 110, 12);
      ctx.fill();
      ctx.strokeStyle = "#c7d2fe";
      ctx.stroke();

      const docDisplayType = docLabel(docType, lang) || docType;
      ctx.fillStyle = "#312e81";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(docDisplayType, 110, yPos);
      if (docNumber) {
        ctx.fillStyle = "#4f46e5";
        ctx.font = "bold 22px monospace";
        ctx.fillText(`ID #: ${docNumber}`, 600, yPos);
      }
      yPos += 40;
      ctx.font = "18px monospace";
      ctx.fillStyle = "#475569";
      ctx.fillText(`DOB: ${docDob || "N/A"} | Issued: ${docIssueDate || "N/A"} | Expires: ${docExpiryDate || "N/A"}`, 110, yPos);

      // Bottom Status Badge
      ctx.fillStyle = "#059669";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`RECORD STATUS: VERIFIED & REGISTERED • ${new Date().toLocaleDateString()}`, 90, 1500);

      // Download Link
      const a = document.createElement("a");
      a.download = `DigitalDock_Verification_Slip_${token.slice(0, 8)}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.print();
    }
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const mobContacts = contactsList.filter((c) => c.type === "Mobile" && c.value.trim());
    const waContacts = contactsList.filter((c) => c.type === "WhatsApp" && c.value.trim());
    const primaryMobile = mobContacts.length > 0 ? mobContacts.map((c) => c.value.trim()).join(" / ") : contactsList.find((c) => c.value.trim())?.value.trim() || "";
    const primaryWhatsapp = waContacts.length > 0 ? waContacts.map((c) => c.value.trim()).join(" / ") : primaryMobile;

    const finalDocs = [...documents];
    if (finalDocs.length === 0 && (docFrontImage || docNumber.trim())) {
      const finalType = docType === "Custom" && customDocType.trim() ? customDocType.trim() : docType;
      finalDocs.push({
        id: "active-doc",
        type: finalType,
        customName: docType === "Custom" ? customDocType.trim() : undefined,
        number: docNumber || "",
        dob: docDob || undefined,
        issueDate: docIssueDate || undefined,
        expiryDate: docExpiryDate || undefined,
        frontImage: docFrontImage || undefined,
        backImage: docBackImage || undefined,
        fileName: `${finalType.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      });
    }

    const payload = {
      fullName: `${firstName} ${lastName}`.trim() || firstName || lastName,
      firstName,
      lastName,
      fatherName,
      mobile: primaryMobile,
      whatsapp: primaryWhatsapp,
      mobiles: mobContacts.map((c) => c.value.trim()),
      whatsapps: waContacts.map((c) => c.value.trim()),
      contacts: contactsList.filter((c) => c.value.trim()).map((c) => ({
        type: c.type === "Custom" && c.customLabel ? c.customLabel : (ctLabel(c.type, lang)),
        value: c.value.trim()
      })),
      email,
      gender,
      country,
      stateProvince,
      city,
      postalCode,
      address: fullAddress,
      documents: finalDocs,
      contracts,
      photo: photoPreview,
      originalLanguage: lang,
    };

    try {
      const res = await fetch(`/api/public/form-link/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setSubmitted(true);
        setSubmittedTimestamp(new Date().toLocaleString());
      } else {
        setSubmitError(json.error ?? "Submission failed. Please check inputs.");
      }
    } catch {
      setSubmitError("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "rtl";

  const isCnic = docType === "CNIC" || docType === "ID Card";
  const isPassport = docType === "Passport";

  const currentCountryObj = LOCATION_HIERARCHY[country];
  const availableStates = currentCountryObj ? Object.keys(currentCountryObj.states) : [];
  const availableCities =
    currentCountryObj && stateProvince && currentCountryObj.states[stateProvince]
      ? currentCountryObj.states[stateProvince].cities
      : [];

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col items-center justify-start py-6 px-3 sm:px-6"
    >
      {/* Hidden File Inputs for Photo Upload */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setPhotoPreview)}
      />
      <input
        ref={photoCameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setPhotoPreview)}
      />

      {/* Hidden File Inputs for Document Front/Back */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={frontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocFrontImage)}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
      />
      <input
        ref={backCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageUpload(e.target.files?.[0], setDocBackImage)}
      />

      {/* Main Container Card */}
      <div className="w-full max-w-[620px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] border border-slate-100 p-5 sm:p-7 space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Shield className="h-5 w-5 fill-indigo-100" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {t("headerTitle", lang)}
              </h1>
              <p className="text-xs font-semibold text-slate-400">
                {t("headerSubtitle", lang)}
              </p>
            </div>
          </div>

          {/* Language Selector Button */}
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-xs cursor-pointer"
            title={t("changeLanguage", lang)}
          >
            <Globe className="h-4 w-4" />
          </button>
        </div>

        {/* Language Modal */}
        {langModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xs w-full border border-slate-200 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">{t("selectLanguageTitle", lang)}</h3>
                <button
                  type="button"
                  onClick={() => setLangModalOpen(false)}
                  className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {LANGS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setLangModalOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      lang === item.code
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.nativeName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {initialLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="h-10 w-10 mx-auto border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400">{t("loading", lang)}</p>
          </div>
        )}

        {/* Page Error / Invalid Link */}
        {!initialLoading && pageError && (
          <div className="py-12 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center border border-red-200">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-base font-bold text-slate-800">{t("errorInvalid", lang)}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">{pageError}</p>
          </div>
        )}

        {/* Form Body */}
        {!initialLoading && !pageError && !submitted && (
          <div className="space-y-6">
            
            {/* Step Wizard Progress Header */}
            <div className="relative flex items-center justify-between px-2 pt-2 pb-1">
              <div className="absolute left-6 right-6 top-5 h-0.5 bg-slate-200 -z-0" />
              {[1, 2, 3, 4, 5].map((stepNum) => {
                const isPassed = currentStep > stepNum;
                const isCurrent = currentStep === stepNum;
                const stepLabelKey = `step${stepNum}`;

                return (
                  <div key={stepNum} className="flex flex-col items-center relative z-10 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPassed) setCurrentStep(stepNum as 1 | 2 | 3 | 4 | 5);
                      }}
                      className={`h-9 w-9 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                        isPassed
                          ? "bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50 cursor-pointer"
                          : isCurrent
                          ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-50"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {isPassed ? <Check size={14} className="stroke-[3]" /> : stepNum}
                    </button>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold text-center ${
                        isCurrent
                          ? "text-indigo-600"
                          : isPassed
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {t(stepLabelKey, lang)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 1: PERSONAL INFORMATION & CONTACTS
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Personal Information Box */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-indigo-100/60 text-indigo-600 flex items-center justify-center">
                      <User size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("personalInfoTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("personalInfoSub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Gender / Title Selection (Dropdown at the top before names) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("gender", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute start-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                        >
                          <option value="male">{t("male", lang)}</option>
                          <option value="female">{t("female", lang)}</option>
                          <option value="other">{t("other", lang)}</option>
                        </select>
                      </div>
                    </div>

                    {/* First Name & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("firstName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder={t("firstNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("lastName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder={t("lastNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Father Name & Date of Birth (Compact 2-col Grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("fatherName", lang)}
                        </label>
                        <div className="relative">
                          <User className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={fatherName}
                            onChange={(e) => setFatherName(e.target.value)}
                            placeholder={t("fatherNamePh", lang)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("dob", lang)}
                        </label>
                        <div className="relative">
                          <Calendar className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                          <input
                            type="date"
                            value={docDob}
                            onChange={(e) => setDocDob(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contact Numbers with Type Selector & Dynamic Add/Remove */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          {t("mobile", lang)} / {t("contactType", lang)} <span className="text-red-500">*</span>
                        </label>
                      </div>

                      <div className="space-y-2">
                        {contactsList.map((contact) => (
                          <div key={contact.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                            <div className="flex items-center gap-2">
                              {/* Contact Type Selector */}
                              <select
                                value={contact.type}
                                onChange={(e) => handleContactTypeChange(contact.id, e.target.value)}
                                className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              >
                                {CONTACT_TYPES.map((ct) => (
                                  <option key={ct.value} value={ct.value}>
                                    {ctLabel(ct.value, lang)}
                                  </option>
                                ))}
                              </select>

                              {/* Number Dialer Input */}
                              <div className="relative flex-1">
                                {contact.type === "WhatsApp" ? (
                                  <MessageSquare className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Phone className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-indigo-500" />
                                )}
                                <input
                                  type="tel"
                                  inputMode="tel"
                                  dir="ltr"
                                  pattern="[0-9+]*"
                                  value={contact.value}
                                  onChange={(e) => handleContactValueChange(contact.id, e.target.value)}
                                  placeholder="+92 300 1234567"
                                  className="w-full bg-white border border-slate-200 rounded-lg ps-8 pe-2 py-1.5 text-xs sm:text-sm font-medium text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                                />
                              </div>

                              {/* Remove Button */}
                              {contactsList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveContact(contact.id)}
                                  className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer shrink-0"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            {/* Custom Label if Custom Type is chosen */}
                            {contact.type === "Custom" && (
                              <input
                                type="text"
                                value={contact.customLabel || ""}
                                onChange={(e) => handleContactCustomLabelChange(contact.id, e.target.value)}
                                placeholder={t("customLabelPh", lang)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Quick Add Contact Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddContact("Mobile")}
                          className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addAnotherMobile", lang)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddContact("WhatsApp")}
                          className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addAnotherWhatsapp", lang)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddContact("Phone")}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Plus size={12} />
                          <span>{t("addContactBtn", lang)}</span>
                        </button>
                      </div>
                    </div>

                    {/* Email (English Typing with Localized Label) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("email", lang)}
                      </label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          inputMode="email"
                          dir="ltr"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 1 Next Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextDocsBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 2: DOCUMENTS & CONTRACTS (Moved to Step 2)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Documents Box (CNIC, Passport, Emirates ID, Tazkira, Iqama, Aadhaar, Custom) */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles size={16} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                          {t("aiScanTitle", lang)}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {t("aiScanSubtitle", lang)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Scanning Status Pulse */}
                  {scanningId && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2.5 text-indigo-700 text-xs font-bold animate-pulse">
                      <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{t("aiScanningBadge", lang)}</span>
                    </div>
                  )}

                  {/* Scan Result Notification */}
                  {!scanningId && scanNotification && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-emerald-800 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span>{scanNotification.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScanNotification(null)}
                        className="text-emerald-600 hover:text-emerald-900 p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <div className="space-y-3 pt-1">
                    {/* Document Type Dropdown (Fully Localized with Custom Type option) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("docType", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {DOC_TYPES.map((dt) => (
                          <option key={dt.value} value={dt.value}>
                            {docLabel(dt.value, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Document Name Input if 'Custom' is selected */}
                    {docType === "Custom" && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-indigo-700">
                          {t("customDocName", lang)} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customDocType}
                          onChange={(e) => setCustomDocType(e.target.value)}
                          placeholder={t("customDocNamePh", lang)}
                          className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    )}

                    {/* Dual Visual Photo Upload Cards: Front Side & Back Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Front Side Card */}
                      <div className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${docFrontImage ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 shadow-2xs'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CreditCard size={13} className="text-indigo-600" />
                            <span className="text-xs font-bold text-slate-800">
                              {isPassport ? t("mainPage", lang) : t("frontSide", lang)}
                            </span>
                          </div>
                          {docFrontImage ? (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={11} /> {t("frontSideReady", lang)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              {t("requiredMark", lang)}
                            </span>
                          )}
                        </div>

                        {/* Front Side Thumbnail Preview */}
                        {docFrontImage ? (
                          <div className="space-y-2">
                            <div
                              onClick={() => setPreviewModalImage({ src: docFrontImage, title: isPassport ? t("passportMainPage", lang) : t("idFrontSide", lang) })}
                              className="relative h-28 w-full rounded-xl overflow-hidden border border-indigo-100 bg-slate-100 flex items-center justify-center cursor-pointer group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={docFrontImage} alt={t("previewFront", lang)} className="h-full w-full object-contain" />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                <Eye size={14} />
                                <span>{t("viewFullBtn", lang)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => frontCameraRef.current?.click()}
                                className="flex-1 py-1.5 px-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <Camera size={12} />
                                <span>{t("retakeBtn", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => frontInputRef.current?.click()}
                                className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                              >
                                <ImageIcon size={12} />
                                <span>{t("chooseGallery", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDocFrontImage(null)}
                                className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-all shrink-0"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => frontCameraRef.current?.click()}
                              className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                            >
                              <Camera size={14} />
                              <span>{t("cameraBtn", lang)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => frontInputRef.current?.click()}
                              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                            >
                              <ImageIcon size={14} />
                              <span>{t("galleryBtn", lang)}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Back Side Card (Hidden for Passport) */}
                      {!isPassport && (
                        <div className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${docBackImage ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200 shadow-2xs'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CreditCard size={13} className="text-indigo-600" />
                              <span className="text-xs font-bold text-slate-800">
                                {t("backSide", lang)}
                              </span>
                            </div>
                            {docBackImage ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> {t("backSideReady", lang)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">
                                {t("optional", lang)}
                              </span>
                            )}
                          </div>

                          {/* Back Side Thumbnail Preview */}
                          {docBackImage ? (
                            <div className="space-y-2">
                              <div
                                onClick={() => setPreviewModalImage({ src: docBackImage, title: t("idBackSide", lang) })}
                                className="relative h-28 w-full rounded-xl overflow-hidden border border-indigo-100 bg-slate-100 flex items-center justify-center cursor-pointer group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={docBackImage} alt={t("previewBack", lang)} className="h-full w-full object-contain" />
                                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold">
                                  <Eye size={14} />
                                  <span>{t("viewFullBtn", lang)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => backCameraRef.current?.click()}
                                  className="flex-1 py-1.5 px-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                                >
                                  <Camera size={12} />
                                  <span>{t("retakeBtn", lang)}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => backInputRef.current?.click()}
                                  className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs"
                                >
                                  <ImageIcon size={12} />
                                  <span>{t("chooseGallery", lang)}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDocBackImage(null)}
                                  className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-all shrink-0"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => backCameraRef.current?.click()}
                                className="flex-1 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                              >
                                <Camera size={14} />
                                <span>{t("cameraBtn", lang)}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => backInputRef.current?.click()}
                                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all shadow-2xs"
                              >
                                <ImageIcon size={14} />
                                <span>{t("galleryBtn", lang)}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hidden Native File Inputs */}
                    <input
                      ref={frontCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFrontUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <input
                      ref={frontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFrontUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <input
                      ref={backCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleBackUpload(e.target.files?.[0])}
                      className="hidden"
                    />
                    <input
                      ref={backInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleBackUpload(e.target.files?.[0])}
                      className="hidden"
                    />

                    {/* Document Number */}
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("docNumber", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                          placeholder={t("docNumberPh", lang)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Dates: Issue Date, Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          {t("issueDate", lang)}
                        </label>
                        <input
                          type="date"
                          value={docIssueDate}
                          onChange={(e) => setDocIssueDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          {t("expiryDate", lang)}
                        </label>
                        <input
                          type="date"
                          value={docExpiryDate}
                          onChange={(e) => setDocExpiryDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    {/* Add Document to List Button */}
                    <button
                      type="button"
                      onClick={handleAddDoc}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      <span>{t("addDocBtn", lang)}</span>
                    </button>

                    {/* Render Added Documents */}
                    {documents.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-indigo-600" />
                                <div>
                                  <span className="font-bold text-xs text-slate-800">
                                    {docLabel(doc.type, lang) || doc.type}
                                  </span>
                                  <span className="text-[11px] text-slate-600 font-mono ms-2">
                                    #{doc.number}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDoc(doc.id)}
                                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Dates details */}
                            {(doc.dob || doc.issueDate || doc.expiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600 font-mono bg-white/70 p-1.5 rounded-lg border border-slate-100">
                                {doc.dob && <span>DOB: <b>{doc.dob}</b></span>}
                                {doc.issueDate && <span>{t("issued", lang)}: <b>{doc.issueDate}</b></span>}
                                {doc.expiryDate && <span>{t("expires", lang)}: <b>{doc.expiryDate}</b></span>}
                              </div>
                            )}

                            {/* Image Thumbnails */}
                            {(doc.frontImage || doc.backImage) && (
                              <div className="flex items-center gap-2 pt-1">
                                {doc.frontImage && (
                                  <div className="h-12 w-20 rounded-md border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.frontImage} alt={t("docFront", lang)} className="h-full w-full object-cover" />
                                  </div>
                                )}
                                {doc.backImage && (
                                  <div className="h-12 w-20 rounded-md border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.backImage} alt={t("docBack", lang)} className="h-full w-full object-cover" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contracts & Attachments Box */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-purple-100/60 text-purple-600 flex items-center justify-center">
                      <Briefcase size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("contractsTitle", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("contractsSub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("contractType", lang)}
                      </label>
                      <select
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {CONTRACT_TYPES.map((ct) => (
                          <option key={ct.value} value={ct.value}>
                            {ctLabel(ct.value, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddContract}
                      className="w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Plus size={14} />
                      <span>{t("addContractBtn", lang)}</span>
                    </button>

                    {contracts.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {contracts.map((cnt) => (
                          <div
                            key={cnt.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-purple-100 bg-purple-50/40"
                          >
                            <div className="flex items-center gap-2">
                              <FileCheck size={14} className="text-purple-600" />
                              <span className="font-bold text-xs text-slate-800">
                                {cntLabel(cnt.type, lang) || cnt.type}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveContract(cnt.id)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextAddressBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 3: ADDRESS INFORMATION (100% 5-Language Localized Cascader)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-100/60 text-emerald-600 flex items-center justify-center">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                        {t("step2Title", lang)}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {t("step2Sub", lang)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Country Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("country", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {Object.keys(LOCATION_HIERARCHY).map((cKey) => (
                          <option key={cKey} value={cKey}>
                            {locName(cKey, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* State / Province Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("stateProvince", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={stateProvince}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {availableStates.map((stKey) => (
                          <option key={stKey} value={stKey}>
                            {locName(stKey, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City / Port Selector (100% Localized) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("city", lang)} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={city}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      >
                        {availableCities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {locName(c.name, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Postal Code (Auto-filled) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("postalCode", lang)}
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder={t("postalCodeShort", lang)}
                          className="w-full bg-slate-100/70 border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-bold text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    {/* Full Street Address */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        {t("fullAddress", lang)} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                        <textarea
                          rows={3}
                          value={fullAddress}
                          onChange={(e) => setFullAddress(e.target.value)}
                          placeholder={t("fullAddressPh", lang)}
                          className="w-full bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextPhotoBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 4: PROFILE PHOTO (Applicant Photo / Selfie)
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base">
                      {t("step4Title", lang)}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {t("step4Sub", lang)}
                    </p>
                  </div>

                  {/* Circular Avatar Preview */}
                  <div className="relative mx-auto w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-200 flex items-center justify-center">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt={t("candidateAvatar", lang)} className="h-full w-full object-cover" />
                    ) : (
                      <User size={56} className="text-slate-400" />
                    )}
                  </div>

                  {/* Camera / Gallery Upload Buttons */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => photoCameraRef.current?.click()}
                      className="py-2.5 px-5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer transition-all"
                    >
                      <Camera size={15} />
                      <span>{t("cameraBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="py-2.5 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer transition-all"
                    >
                      <ImageIcon size={15} />
                      <span>{t("galleryBtn", lang)}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">{t("photoSizeHint", lang)}</p>
                </div>

                {/* Step 4 Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <span>{t("nextReviewBtn", lang)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════════
                STEP 5: REVIEW YOUR INFORMATION & PRE-SUBMISSION APPLICATION SLIP
            ════════════════════════════════════════════════════════════════════════ */}
            {currentStep === 5 && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="text-center space-y-1 pb-1">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-wide">
                    {t("appSlipHeading", lang)}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
                    {t("appSlipSub", lang)}
                  </p>
                </div>

                {/* Pre-Submission Download & Print Action Toolbar */}
                <div className="bg-linear-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
                  <div className="space-y-0.5 text-center sm:text-start">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <ShieldCheck size={16} className="text-emerald-400" />
                      <span className="font-black text-xs sm:text-sm tracking-wide uppercase">
                        {t("receiptTitle", lang)} (Draft / Verified)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-normal">
                      {t("downloadPrintHint", lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleDownloadSlip}
                      className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <Download size={14} />
                      <span>{t("downloadSlipBtn", lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-white/20"
                    >
                      <Printer size={14} />
                      <span>{t("printSlipBtn", lang)}</span>
                    </button>
                  </div>
                </div>

                {/* Official Verification Application Summary Sheet */}
                <div className="border-2 border-indigo-200 bg-white rounded-3xl p-5 sm:p-7 space-y-5 shadow-sm print:border-none print:shadow-none print:p-0">
                  {/* Enterprise Official Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        DD
                      </div>
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                          Digital Dock ERP
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                          {t("publicVerificationGateway", lang)}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="inline-block text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {t("applicationDraft", lang)}
                      </span>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Ref: {token.slice(0, 12).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Applicant Profile Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="h-20 w-20 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                      {photoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoPreview} alt={t("applicant", lang)} className="h-full w-full object-cover" />
                      ) : (
                        <User size={36} className="text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1 text-center sm:text-start flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="font-black text-base sm:text-lg text-slate-900">
                          {firstName} {lastName}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center sm:justify-start gap-1 cursor-pointer print:hidden"
                        >
                          <Edit3 size={11} />
                          <span>{t("editBtn", lang)}</span>
                        </button>
                      </div>
                      {fatherName && (
                        <p className="text-xs text-slate-500 font-medium">
                          {t("fatherName", lang)}: <span className="font-bold text-slate-800">{fatherName}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                          {t(gender, lang)}
                        </span>
                        {docDob && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            DOB: {docDob}
                          </span>
                        )}
                        {email && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            {email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Contact Breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("phoneLabel", lang)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {contactsList.filter(c => c.value.trim()).length} Registered
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contactsList.filter(c => c.value.trim()).map((c) => (
                        <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-700 text-[11px]">
                            {c.type === "Custom" && c.customLabel ? c.customLabel : (ctLabel(c.type, lang))}
                          </span>
                          <span className="font-mono font-bold text-slate-800">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Identity Documents & Dual Card Previews */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("documentsTitle", lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Edit3 size={11} />
                        <span>{t("editBtn", lang)}</span>
                      </button>
                    </div>

                    {documents.length === 0 && !docFrontImage ? (
                      <p className="text-xs text-slate-400 italic">{t("noDocsAttached", lang)}</p>
                    ) : (
                      <div className="space-y-3">
                        {/* If user hasn't pressed '+ Add Document' but has active front image */}
                        {docFrontImage && (
                          <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {docLabel(docType, lang) || (docType === "Custom" ? customDocType : docType)}
                              </span>
                              {docNumber && (
                                <span className="text-xs font-mono font-bold text-indigo-700">#{docNumber}</span>
                              )}
                            </div>
                            {(docDob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {docDob && <span>DOB: <b>{docDob}</b></span>}
                                {docIssueDate && <span>{t("issued", lang)}: <b>{docIssueDate}</b></span>}
                                {docExpiryDate && <span>{t("expires", lang)}: <b>{docExpiryDate}</b></span>}
                              </div>
                            )}
                            {/* Dual Side-by-Side Photo Previews */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {docFrontImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">{t("frontSide", lang)}</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docFrontImage, title: t("idFrontSide", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docFrontImage} alt={t("docFront", lang)} className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                              {docBackImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">{t("backSide", lang)}</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docBackImage, title: t("idBackSide", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docBackImage} alt={t("docBack", lang)} className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stored Documents in List */}
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {docLabel(doc.type, lang) || doc.type}
                              </span>
                              {doc.number && doc.number !== "N/A" && (
                                <span className="text-xs font-mono font-bold text-indigo-700">#{doc.number}</span>
                              )}
                            </div>
                            {(doc.dob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {doc.dob && <span>DOB: <b>{doc.dob}</b></span>}
                                {docIssueDate && <span>{t("issued", lang)}: <b>{docIssueDate}</b></span>}
                                {docExpiryDate && <span>{t("expires", lang)}: <b>{docExpiryDate}</b></span>}
                              </div>
                            )}
                            {(doc.frontImage || doc.backImage) && (
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {doc.frontImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.frontImage!, title: t("documentFront", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.frontImage} alt={t("docFront", lang)} className="h-full w-full object-contain" />
                                  </div>
                                )}
                                {doc.backImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.backImage!, title: t("documentBack", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.backImage} alt={t("docBack", lang)} className="h-full w-full object-contain" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Applicant Profile Header */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="h-20 w-20 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                      {photoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoPreview} alt={t("applicant", lang)} className="h-full w-full object-cover" />
                      ) : (
                        <User size={36} className="text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1 text-center sm:text-start flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <h3 className="font-black text-base sm:text-lg text-slate-900">
                          {firstName} {lastName}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center sm:justify-start gap-1 cursor-pointer print:hidden"
                        >
                          <Edit3 size={11} />
                          <span>{t("editBtn", lang)}</span>
                        </button>
                      </div>
                      {fatherName && (
                        <p className="text-xs text-slate-500 font-medium">
                          {t("fatherName", lang)}: <span className="font-bold text-slate-800">{fatherName}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase">
                          {t(gender, lang)}
                        </span>
                        {docDob && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            DOB: {docDob}
                          </span>
                        )}
                        {email && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono">
                            {email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Contact Breakdown */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("phoneLabel", lang)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {contactsList.filter(c => c.value.trim()).length} Registered
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contactsList.filter(c => c.value.trim()).map((c) => (
                        <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-700 text-[11px]">
                            {c.type === "Custom" && c.customLabel ? c.customLabel : c.type}
                          </span>
                          <span className="font-mono font-bold text-slate-800">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Identity Documents & Dual Card Previews */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("documentsTitle", lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Edit3 size={11} />
                        <span>{t("editBtn", lang)}</span>
                      </button>
                    </div>

                    {documents.length === 0 && !docFrontImage ? (
                      <p className="text-xs text-slate-400 italic">{t("noDocsAttached", lang)}</p>
                    ) : (
                      <div className="space-y-3">
                        {/* If user hasn't pressed '+ Add Document' but has active front image */}
                        {docFrontImage && (
                          <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {docLabel(docType, lang) || (docType === "Custom" ? customDocType : docType)}
                              </span>
                              <span className="text-xs font-mono font-bold text-indigo-700">#{docNumber || "N/A"}</span>
                            </div>
                            {(docDob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {docDob && <span>DOB: <b>{docDob}</b></span>}
                                {docIssueDate && <span>{t("issued", lang)}: <b>{docIssueDate}</b></span>}
                                {docExpiryDate && <span>{t("expires", lang)}: <b>{docExpiryDate}</b></span>}
                              </div>
                            )}
                            {/* Dual Side-by-Side Photo Previews */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {docFrontImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">{t("frontSide", lang)}</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docFrontImage, title: t("idFrontSide", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docFrontImage} alt={t("docFront", lang)} className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                              {docBackImage && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">{t("backSide", lang)}</span>
                                  <div
                                    onClick={() => setPreviewModalImage({ src: docBackImage, title: t("idBackSide", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={docBackImage} alt={t("docBack", lang)} className="h-full w-full object-contain" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stored Documents in List */}
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">
                                {docLabel(doc.type, lang) || doc.type}
                              </span>
                              <span className="text-xs font-mono font-bold text-indigo-700">#{doc.number}</span>
                            </div>
                            {(doc.dob || docIssueDate || docExpiryDate) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono bg-white p-2 rounded-xl border border-slate-200">
                                {doc.dob && <span>DOB: <b>{doc.dob}</b></span>}
                                {doc.issueDate && <span>{t("issued", lang)}: <b>{doc.issueDate}</b></span>}
                                {doc.expiryDate && <span>{t("expires", lang)}: <b>{doc.expiryDate}</b></span>}
                              </div>
                            )}
                            {(doc.frontImage || doc.backImage) && (
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                {doc.frontImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.frontImage!, title: t("documentFront", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.frontImage} alt={t("docFront", lang)} className="h-full w-full object-contain" />
                                  </div>
                                )}
                                {doc.backImage && (
                                  <div
                                    onClick={() => setPreviewModalImage({ src: doc.backImage!, title: t("documentBack", lang) })}
                                    className="h-28 rounded-xl border border-slate-200 overflow-hidden bg-white flex items-center justify-center cursor-pointer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={doc.backImage} alt={t("docBack", lang)} className="h-full w-full object-contain" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Full Address Hierarchy */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        {t("step2Title", lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer print:hidden"
                      >
                        <Edit3 size={11} />
                        <span>{t("editBtn", lang)}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("country", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(country, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("stateProvince", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(stateProvince, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("city", lang)}:</span>
                        <span className="font-bold text-slate-800">{locName(city, lang)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">{t("postalCode", lang)}:</span>
                        <span className="font-mono font-bold text-slate-800">{postalCode || "—"}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-200">
                        <span className="text-slate-400 text-[10px] block">{t("fullAddress", lang)}:</span>
                        <p className="font-medium text-slate-800 mt-0.5">{fullAddress || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Declaration & Signature Box */}
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      {t("declarationText", lang)}
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block">{t("generatedOn", lang)}</span>
                        <span className="text-[10px] font-mono text-slate-700">
                          {new Date().toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-end">
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider block">{t("applicantStatus", lang)}</span>
                        <span className="text-[10px] font-bold text-emerald-700 font-mono">
                          {t("readyForSubmission", lang)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Step 5 Navigation & Submit Buttons */}
                <div className="flex items-center gap-3 pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    disabled={submitting}
                    className="py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    {t("backBtn", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        <span>{t("submitFormBtn", lang)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            STEP 4 COMPLETE: OFFICIAL DIGITAL RECEIPT & CONFIRMATION SCREEN
        ════════════════════════════════════════════════════════════════════════ */}
        {submitted && (
          <div className="space-y-6 animate-in zoom-in-95 duration-400">
            {/* Success Banner */}
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200 shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {t("successTitle", lang)}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t("successMsg", lang)}
              </p>
            </div>

            {/* Official Digital Receipt Card */}
            <div className="border-2 border-dashed border-indigo-200 bg-slate-50/70 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <span className="font-black text-xs sm:text-sm text-indigo-950 uppercase tracking-wide">
                    {t("receiptTitle", lang)}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {t("verifiedRecord", lang)}
                </span>
              </div>

              {/* Header: Photo + Name */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-14 w-14 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt={t("applicant", lang)} className="h-full w-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-black text-sm text-slate-900">
                    {firstName} {lastName}
                  </h4>
                  {fatherName && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t("fatherName", lang)}: <span className="font-bold text-slate-700">{fatherName}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 font-mono">
                    Token: {token.slice(0, 16)}...
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] block">{t("phoneLabel", lang)}:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {contactsList.filter(c => c.value.trim()).map(c => (
                      <span key={c.id} className="inline-block px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800">
                        <b>{c.type === "Custom" && c.customLabel ? c.customLabel : c.type}:</b> {c.value}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{t("country", lang)} / {t("city", lang)}:</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {locName(country, lang)} / {locName(city, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">{t("postalCode", lang)}:</span>
                  <span className="font-bold font-mono text-slate-800 text-[11px]">{postalCode || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 text-[10px] block">{t("fullAddress", lang)}:</span>
                  <span className="font-medium text-slate-800 text-[11px]">{fullAddress || "—"}</span>
                </div>
                {email && (
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px] block">{t("email", lang)}:</span>
                    <span className="font-bold font-mono text-slate-800 text-[11px]">{email}</span>
                  </div>
                )}
              </div>

              {/* Attached Documents Thumbnails */}
              {(documents.length > 0 || docFrontImage || docNumber.trim()) && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    {t("documentsTitle", lang)} ({documents.length > 0 ? documents.length : 1}):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(documents.length > 0 ? documents : [{
                      id: "active",
                      type: docType === "Custom" && customDocType.trim() ? customDocType.trim() : docType,
                      number: docNumber,
                      dob: docDob,
                      issueDate: docIssueDate,
                      expiryDate: docExpiryDate,
                      frontImage: docFrontImage || undefined,
                      backImage: docBackImage || undefined,
                    }]).map((d) => (
                      <div key={d.id} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-[11px] text-slate-800 block">
                          {docLabel(d.type, lang) || d.type}
                        </span>
                        {d.number && d.number !== "N/A" && (
                          <span className="text-[10px] font-mono text-slate-500 block">#{d.number}</span>
                        )}
                        {(d.dob || d.issueDate || d.expiryDate) && (
                          <div className="text-[9px] text-slate-400 font-mono">
                            {d.dob && <div>{t("dob", lang)}: {d.dob}</div>}
                            {d.issueDate && <div>{t("issued", lang)}: {d.issueDate}</div>}
                            {d.expiryDate && <div>{t("expires", lang)}: {d.expiryDate}</div>}
                          </div>
                        )}
                        {(d.frontImage || d.backImage) && (
                          <div className="flex gap-1 pt-1">
                            {d.frontImage && (
                              <div className="h-9 w-12 rounded border border-slate-200 overflow-hidden bg-slate-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={d.frontImage} alt={t("docFront", lang)} className="h-full w-full object-cover" />
                              </div>
                            )}
                            {d.backImage && (
                              <div className="h-9 w-12 rounded border border-slate-200 overflow-hidden bg-slate-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={d.backImage} alt={t("docBack", lang)} className="h-full w-full object-cover" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Timestamp */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>{t("submittedOn", lang)}: {submittedTimestamp}</span>
                <span className="font-mono font-bold text-indigo-600">{t("secureErpGateway", lang)}</span>
              </div>
            </div>

            {/* Print / Download Receipt Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={handleDownloadSlip}
                className="w-full sm:flex-1 py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download size={16} />
                <span>{t("downloadSlipBtn", lang)}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto py-3.5 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={15} />
                <span>{t("printReceipt", lang)}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Gateway Brand */}
        <div className="text-center pt-2 border-t border-slate-100 print:hidden">
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            {t("poweredBy", lang)}
          </p>
        </div>

        {/* Full Image Lightbox / Inspection Modal */}
        {previewModalImage && (
          <div
            onClick={() => setPreviewModalImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                  {previewModalImage.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-[70vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewModalImage.src}
                  alt={previewModalImage.title}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
              >
                {t("closePreview", lang)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
