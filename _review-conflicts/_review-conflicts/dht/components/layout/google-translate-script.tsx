"use client";

import Script from "next/script";

export function GoogleTranslateScript() {
  return (
    <>
      <div id="google_translate_element" style={{ display: "none" }}></div>
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
        onError={(e) => {
          console.warn("Google Translate script failed to load:", e);
        }}
      />
      <Script id="google-translate-init" strategy="afterInteractive">
        {`
          window.googleTranslateElementInit = function() {
            try {
              if (window.google && window.google.translate) {
                new window.google.translate.TranslateElement(
                  { pageLanguage: 'auto', autoDisplay: false },
                  'google_translate_element'
                );
              }
            } catch (err) {
              console.warn("Google Translate init error:", err);
            }
          }
        `}
      </Script>
    </>
  );
}
