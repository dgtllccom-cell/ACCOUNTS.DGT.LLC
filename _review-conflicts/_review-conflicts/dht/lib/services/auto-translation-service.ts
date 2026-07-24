import { type SupportedLanguage } from "@/lib/i18n/languages";

export type TranslationMap = {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
};

// Simple caching to avoid repeated API calls for the same text
const translationCache = new Map<string, TranslationMap>();

/**
 * Automatically translates the input text into the required 5 languages using Gemini API.
 * If the API key is not configured or the request fails, it falls back to returning the original text.
 */
export async function autoTranslateText(
  originalText: string,
  originalLanguage: SupportedLanguage
): Promise<TranslationMap> {
  const val = originalText.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const cacheKey = `${originalLanguage}:${val.toLowerCase()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  
  // Fallback map if no API or error
  const fallbackMap: TranslationMap = {
    en: val,
    ur: val,
    ar: val,
    fa: val,
    ps: val
  };

  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Auto-translation will fallback to copying the original text.");
    return fallbackMap;
  }

  try {
    const prompt = `You are a professional enterprise translator for an accounting ERP system.
Translate the following short text (likely an account name, ledger name, or location) into these exact 5 languages:
1. English (en)
2. Urdu (ur)
3. Arabic (ar)
4. Persian (fa)
5. Pashto (ps)

Original Text: "${val}"
Original Language: ${originalLanguage}

Respond ONLY with a valid JSON object in this exact format, with NO markdown formatting or code blocks:
{
  "en": "English translation",
  "ur": "Urdu translation",
  "ar": "Arabic translation",
  "fa": "Persian translation",
  "ps": "Pashto translation"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      }),
      // Set a timeout to prevent long hangs on inserts
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error(`Gemini API Error: ${response.status} ${response.statusText}`);
      return fallbackMap;
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (resultText) {
      const parsed = JSON.parse(resultText) as TranslationMap;
      
      // Ensure all keys exist
      const finalMap: TranslationMap = {
        en: parsed.en || val,
        ur: parsed.ur || val,
        ar: parsed.ar || val,
        fa: parsed.fa || val,
        ps: parsed.ps || val
      };

      translationCache.set(cacheKey, finalMap);
      return finalMap;
    }

    return fallbackMap;
  } catch (error) {
    console.error("Auto-translation failed, using fallback:", error);
    return fallbackMap;
  }
}
