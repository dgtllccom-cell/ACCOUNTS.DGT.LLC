# 5-LANGUAGE I18N VERIFICATION CHECKLIST

## Keys Consolidated (30 Total in `lib/i18n/ui.ts`)

### Namespace: `ait` (AI Tools)

**All keys must exist in EN, UR, AR, FA, PS blocks:**

```
ait.title                    ✓ EN/UR/AR/FA/PS
ait.domain_required          ✓ EN/UR/AR/FA/PS
ait.domain_business          ✓ EN/UR/AR/FA/PS
ait.domain_shipping          ✓ EN/UR/AR/FA/PS
ait.source_type              ✓ EN/UR/AR/FA/PS
ait.type_voice               ✓ EN/UR/AR/FA/PS
ait.type_text                ✓ EN/UR/AR/FA/PS
ait.recording                ✓ EN/UR/AR/FA/PS
ait.click_record             ✓ EN/UR/AR/FA/PS
ait.stop                     ✓ EN/UR/AR/FA/PS
ait.duration                 ✓ EN/UR/AR/FA/PS
ait.transcription            ✓ EN/UR/AR/FA/PS
ait.text_instruction         ✓ EN/UR/AR/FA/PS
ait.placeholder_voice        ✓ EN/UR/AR/FA/PS
ait.placeholder_text         ✓ EN/UR/AR/FA/PS
ait.submit                   ✓ EN/UR/AR/FA/PS
ait.processing               ✓ EN/UR/AR/FA/PS
ait.submitted_ok             ✓ EN/UR/AR/FA/PS
ait.job_no                   ✓ EN/UR/AR/FA/PS
ait.status                   ✓ EN/UR/AR/FA/PS
ait.error_msg                ✓ EN/UR/AR/FA/PS
ait.error_enter_text         ✓ EN/UR/AR/FA/PS
ait.approval_title           ✓ EN/UR/AR/FA/PS
ait.approval_desc            ✓ EN/UR/AR/FA/PS
```

### Verification Command
```bash
npm run i18n:guard
# Expected: 13,972 keys × 5 languages, full parity, no missing refs
```

---

## English (EN) - LTR

### Voice/Text Entry Page

| Text | Key | Value | Verified |
|------|-----|-------|----------|
| Page Title | ait.title | "Voice or Text Entry" | [ ] |
| Domain Label | ait.domain_required | "Operational Domain (Required)" | [ ] |
| Business Option | ait.domain_business | "Business" | [ ] |
| Shipping Option | ait.domain_shipping | "Shipping" | [ ] |
| Type Label | ait.source_type | "Type" | [ ] |
| Voice Option | ait.type_voice | "Voice" | [ ] |
| Text Option | ait.type_text | "Text" | [ ] |
| Recording Status | ait.recording | "Recording..." | [ ] |
| Click to Start | ait.click_record | "Click Record to start" | [ ] |
| Stop Button | ait.stop | "Stop" | [ ] |
| Duration Label | ait.duration | "Duration:" | [ ] |
| Transcription Field | ait.transcription | "Transcription" | [ ] |
| Text Field | ait.text_instruction | "Text Instruction" | [ ] |
| Voice Placeholder | ait.placeholder_voice | "Transcription will appear here after recording" | [ ] |
| Text Placeholder | ait.placeholder_text | "Enter your instruction here" | [ ] |
| Submit Button | ait.submit | "Submit for AI Processing" | [ ] |
| Processing State | ait.processing | "Processing..." | [ ] |
| Success Message | ait.submitted_ok | "Submitted Successfully" | [ ] |
| Job Display | ait.job_no | "Job:" | [ ] |
| Status Display | ait.status | "Status:" | [ ] |
| Error Prefix | ait.error_msg | "Error:" | [ ] |
| Validation Error | ait.error_enter_text | "Please enter transcript or record audio" | [ ] |

### Approval Queue Page

| Text | Key | Value | Verified |
|------|-----|-------|----------|
| Page Title | ait.approval_title | "Approval Queue" | [ ] |
| Description | ait.approval_desc | "Approval queue will show pending AI drafts awaiting your review." | [ ] |

---

## Urdu (UR) - RTL

### Visual Verification
- [ ] Text flows **right-to-left**
- [ ] Input fields aligned to right
- [ ] Labels positioned on right
- [ ] Buttons positioned for RTL
- [ ] Numbers in Urdu/Eastern-Arabic numerals (optional but better if supported)
- [ ] No English text mixed in (except data values like job numbers)

### Key Translations
| English | Urdu | Verified |
|---------|------|----------|
| Voice or Text Entry | وائس یا ٹیکسٹ درج کریں | [ ] |
| Operational Domain (Required) | آپریشنل ڈومین (لازمی) | [ ] |
| Business | بزنس | [ ] |
| Shipping | شپنگ | [ ] |
| Recording... | ریکارڈنگ جاری ہے... | [ ] |
| Submit for AI Processing | AI پروسیسنگ کے لیے جمع کریں | [ ] |
| Submitted Successfully | کامیابی سے جمع ہو گیا | [ ] |

### Form Interaction (RTL)
- [ ] Domain selector works in RTL mode
- [ ] Voice recording works in RTL mode
- [ ] Submit button works in RTL mode
- [ ] Error messages display in RTL
- [ ] Success messages display in RTL
- [ ] Transcript textarea accepts Urdu input
- [ ] Language selector works from Urdu page

---

## Arabic (AR) - RTL

### Visual Verification
- [ ] Text flows **right-to-left**
- [ ] Form layout mirrored for RTL
- [ ] No English text leakage
- [ ] Proper Arabic typography

### Key Translations
| English | Arabic | Verified |
|---------|--------|----------|
| Voice or Text Entry | إدخال صوتي أو نصي | [ ] |
| Operational Domain | المجال التشغيلي | [ ] |
| Business | عمل تجاري | [ ] |
| Shipping | شحن | [ ] |
| Submit for AI Processing | إرسال للمعالجة بواسطة الذكاء الاصطناعي | [ ] |
| Submitted Successfully | تم الإرسال بنجاح | [ ] |

---

## Farsi (FA) - RTL

### Visual Verification
- [ ] Text flows **right-to-left**
- [ ] Form inputs accept Persian text
- [ ] Proper Farsi typography (half-space, connecting characters)
- [ ] No English text visible (except data)

### Key Translations
| English | Farsi | Verified |
|---------|-------|----------|
| Voice or Text Entry | ورود صوتی یا متنی | [ ] |
| Operational Domain (Required) | حوزه عملیاتی (ضروری) | [ ] |
| Business | تجارت | [ ] |
| Shipping | حمل و نقل | [ ] |
| Submit for AI Processing | ارسال برای پردازش هوش مصنوعی | [ ] |

---

## Pashto (PS) - RTL

### Visual Verification
- [ ] Text flows **right-to-left**
- [ ] Pashto characters render correctly
- [ ] Form layout adjusts for RTL
- [ ] No English text visible

### Key Translations
| English | Pashto | Verified |
|---------|--------|----------|
| Voice or Text Entry | صوت یا متن درج کړئ | [ ] |
| Operational Domain | د کاري حوزه | [ ] |
| Business | کسب و کار | [ ] |
| Shipping | د لېږد | [ ] |
| Submit for AI Processing | د AI پروسیسنگ لپاره سپارئ | [ ] |

---

## Language Persistence & Switching

### Test 1: Language Selection
- [ ] User can select language from settings
- [ ] Language selector shows all 5 options
- [ ] Selected language persists in localStorage
- [ ] Selected language persists across page reload
- [ ] Page content updates immediately on selection

### Test 2: Initial Language
- [ ] Browser language preference respected (if set)
- [ ] Falls back to English if browser language not supported
- [ ] User's saved language preference takes precedence
- [ ] Super admin users can change language

### Test 3: Language Coverage
- [ ] Submit voice entry page: ALL text translated
- [ ] Success message: Translated to selected language
- [ ] Error messages: Translated to selected language
- [ ] Approval queue page: Translated to selected language
- [ ] Navigation menu: Translated to selected language

### Test 4: Dynamic Content Translation
- [ ] Job numbers (e.g., "AI-2026-00001") NOT translated (data)
- [ ] Status values (e.g., "pending") NOT translated (data)
- [ ] But labels around them (e.g., "Job:") ARE translated

---

## RTL/LTR Direction Verification

### RTL Languages (UR, AR, FA, PS)

#### HTML Direction Attribute
```html
<!-- Should have dir="rtl" on container -->
<div dir="rtl" className="form-container">
  ...
</div>
```

**Verify in DevTools:**
- [ ] Container has `dir="rtl"` attribute
- [ ] Or CSS has `direction: rtl`

#### Flexbox/Grid Layout
- [ ] Items stack correctly in RTL
- [ ] `flex-start` becomes right side
- [ ] `flex-end` becomes left side
- [ ] Text alignment `text-start` = right in RTL
- [ ] Text alignment `text-end` = left in RTL

#### Form Elements
- [ ] Radio buttons: positioned on right side
- [ ] Checkboxes: positioned on right side
- [ ] Input fields: text entered from right
- [ ] Textarea: text entered from right
- [ ] Labels: positioned to right of input

#### Margins & Padding
- [ ] Use logical properties: `ms-*`, `me-*`, `ps-*`, `pe-*`
- [ ] Or use CSS `margin-inline`, `padding-inline`
- [ ] Avoid hard-coded `margin-left`, `margin-right`

---

## Production Testing Sequence

### 1. Language Selector Test
```bash
# Open page in EN
https://api.dgt.llc/dashboard/ai-entry/voice-text

# Switch to each language in order:
# EN → UR → AR → FA → PS → EN (cycle)

# For each language:
✓ Title translates
✓ All labels translate
✓ Form remains functional
✓ Language persists on reload
✓ RTL languages show right-to-left
✓ No console errors
```

### 2. Cross-Language Form Test
```bash
# Start in EN
- Fill domain: BUSINESS
- Fill type: TEXT
- Type English text: "Payment of 1000"
- Switch to UR
- UI translates but text preserves
- Submit works
- Success message in UR

# Repeat with voice recording in UR
- Record speech in Urdu
- Transcription appears
- Submit
- Success message in UR
```

### 3. RTL Form Interaction Test (UR/AR/FA/PS)
```bash
# For each RTL language:
- Verify radio buttons clickable
- Verify voice record button works
- Verify text input accepts RTL characters
- Verify form submission works
- Verify response in correct language
```

### 4. Approval Queue Language Test
```bash
# Switch approval queue page through all 5 languages
# For each language:
- Title translates: "Approval Queue" / "منظوری کی قطار" / etc.
- Description translates
- Approval buttons work
- No English text visible
```

---

## Regression: No English Leakage

For each language page, verify NO English text appears:
- [ ] UR page: No English text (except data)
- [ ] AR page: No English text (except data)
- [ ] FA page: No English text (except data)
- [ ] PS page: No English text (except data)

**Quick test:**
```bash
# Switch to each language
# Use browser Find (Ctrl+F)
# Search for: "Voice" (English word)
# Should find ZERO matches (translated to other language)
```

---

## Checklist Summary

- [ ] All 30 keys exist in all 5 languages
- [ ] `npm run i18n:guard` passes (13,972 keys, full parity)
- [ ] Language selector functional
- [ ] English page tested end-to-end
- [ ] Urdu page tested end-to-end (RTL)
- [ ] Arabic page tested end-to-end (RTL)
- [ ] Farsi page tested end-to-end (RTL)
- [ ] Pashto page tested end-to-end (RTL)
- [ ] No English text leakage in any language
- [ ] RTL/LTR rendering correct
- [ ] Language persistence working
- [ ] Mobile responsiveness in all languages
- [ ] Form submission works in all languages
- [ ] Error messages translated in all languages
- [ ] Success messages translated in all languages

**Target: 100% multilingual compliance before production release**
