# AI VOICE/TEXT ENTRY — UI/UX VERIFICATION CHECKLIST

## Navigation & Menu

### Sidebar Integration
- [ ] "AI Intelligence Tools" section visible in main sidebar
- [ ] Section appears for accountant+ roles
- [ ] Section hidden for staff_user roles
- [ ] Icons render correctly (message-square, phone, check-square)
- [ ] All 3 child routes clickable:
  - Voice/Text Entry
  - Document Intake (existing)
  - Approval Queue

### Route Access
- [ ] `/dashboard/ai-entry/voice-text` loads without errors
- [ ] `/dashboard/ai-entry/approvals` loads without errors
- [ ] Unauthenticated access redirects to login
- [ ] Wrong role access shows 403 or redirects

---

## Voice/Text Entry Page (`/dashboard/ai-entry/voice-text`)

### Layout & Structure
- [ ] Page title visible: "Voice or Text Entry" (EN) or localized
- [ ] Back/navigation button works
- [ ] Page loads within 2 seconds
- [ ] No console JavaScript errors
- [ ] No layout shift or visual jank

### Domain Selector (MANDATORY)
- [ ] Domain selector visible at top of form
- [ ] Label: "Operational Domain (Required)"
- [ ] Two radio buttons: "Business", "Shipping"
- [ ] BUSINESS selected by default
- [ ] Cannot submit without selecting domain
- [ ] Selecting domain updates component state visibly
- [ ] Selection persists across other form interactions

### Source Type Selection
- [ ] "Type" label visible
- [ ] Two options: "🎤 Voice", "⌨️ Text"
- [ ] Voice selected by default
- [ ] Switching types updates UI (shows/hides voice controls)
- [ ] Selection state visible/clear

### Voice Recording Controls (When "Voice" selected)
- [ ] Record button visible and clickable
- [ ] "🎤 Record" label on button
- [ ] Duration counter visible
- [ ] When recording:
  - Button changes to "⏹️ Stop"
  - Status shows "🔴 Recording..."
  - Duration increments every second
- [ ] Stop recording:
  - Duration stops updating
  - Status shows "Click Record to start"
- [ ] Browser microphone permission request works
- [ ] Graceful fallback if microphone unavailable
- [ ] Recording time displayed in real time

### Transcript Display/Editor
- [ ] Textarea visible
- [ ] Label changes based on mode:
  - Voice: "Transcription"
  - Text: "Text Instruction"
- [ ] Placeholder text visible and translatable
- [ ] User can edit transcript before submission
- [ ] Voice transcript auto-populates after recording
- [ ] Text mode allows manual entry
- [ ] Max 50,000 characters enforced (show warning if near limit)

### Submit Button
- [ ] Button text: "Submit for AI Processing"
- [ ] Disabled state while processing (show spinner or disable visually)
- [ ] Click triggers API call
- [ ] Loading indicator appears
- [ ] Submit button text changes to "Processing..." while loading
- [ ] Cannot double-submit (button disabled during request)

### Result/Success Feedback
- [ ] On success, green success box appears
- [ ] Shows: "✓ Submitted Successfully"
- [ ] Displays: "Job: AI-2026-00001"
- [ ] Displays: "Status: transcribing" or "intent_analysis"
- [ ] Success message dismissible
- [ ] Can submit another entry after success

### Error Handling
- [ ] Empty transcript shows error: "Please enter transcript or record audio"
- [ ] Large transcript shows error: "Transcript exceeds maximum length"
- [ ] Missing domain shows error or prevents submission
- [ ] Network error shows user-friendly message
- [ ] No network error exposes internal details
- [ ] Error message visible and readable
- [ ] User can retry after error

---

## Approval Queue Page (`/dashboard/ai-entry/approvals`)

### Layout & Content
- [ ] Page title: "Approval Queue"
- [ ] Description text visible: "Approval queue will show pending AI drafts..."
- [ ] Page loads without errors
- [ ] Back navigation works

### Pending Items Display
- [ ] When no pending items:
  - Shows message or empty state
  - Doesn't show error
- [ ] When items exist:
  - Shows list/table of pending approvals
  - Each item shows:
    - Job number (AI-2026-00001)
    - Submitted date/time
    - Status (pending, returned_for_review)
    - Submitter name
    - Original language indicator
  - Items are sortable or filterable

### Approval Actions
- [ ] Each pending item has action buttons
- [ ] "View/Edit" opens draft details
- [ ] "Approve" button visible
- [ ] "Reject" button visible
- [ ] "Return for Corrections" button visible

### Workflow State Transitions
- [ ] "Approve" → Status changes to "approved"
- [ ] "Reject" → Status changes to "rejected" with reason
- [ ] "Return" → Status changes to "returned_for_review"
- [ ] No action possible on already-approved items
- [ ] No action possible on rejected items

### Draft Editing (If Implemented)
- [ ] Can view original transcript
- [ ] Can view AI-extracted fields
- [ ] Can edit extracted fields (if reviewable)
- [ ] Edited values persist
- [ ] Can see original vs. edited comparison

---

## 5-LANGUAGE SUPPORT

### English (EN)
- [ ] All labels in English
- [ ] "Voice or Text Entry" title
- [ ] "Operational Domain (Required)"
- [ ] "Business", "Shipping"
- [ ] "Type", "Voice", "Text"
- [ ] "Record", "Stop", "Duration"
- [ ] "Transcription", "Text Instruction"
- [ ] "Submit for AI Processing"
- [ ] Success/error messages in English

### Urdu (UR) — RTL
- [ ] All labels in Urdu
- [ ] Text flows right-to-left
- [ ] "وائس یا ٹیکسٹ درج کریں" visible
- [ ] "آپریشنل ڈومین (لازمی)" visible
- [ ] Form layout adjusts for RTL
- [ ] Buttons align correctly for RTL
- [ ] Input fields RTL-aligned
- [ ] No English text leakage

### Arabic (AR) — RTL
- [ ] All labels in Arabic
- [ ] Text flows right-to-left
- [ ] "إدخال صوتي أو نصي" visible
- [ ] Arabic numerals used if applicable
- [ ] Form layout adjusts for RTL
- [ ] No English text leakage

### Farsi (FA) — RTL
- [ ] All labels in Farsi
- [ ] Text flows right-to-left
- [ ] "ورود صوتی یا متنی" visible
- [ ] Form RTL-aligned
- [ ] No English text leakage

### Pashto (PS) — RTL
- [ ] All labels in Pashto
- [ ] Text flows right-to-left
- [ ] "صوت یا متن درج کړئ" visible
- [ ] Form RTL-aligned
- [ ] No English text leakage

### Language Switching
- [ ] User can switch languages via settings
- [ ] UI updates to selected language immediately
- [ ] Language persists across page reload
- [ ] Switching languages doesn't reset form data
- [ ] All error messages translate with language

---

## RESPONSIVENESS

### Desktop (1920px+)
- [ ] All elements visible without scrolling (except very long lists)
- [ ] Form is centered and readable
- [ ] Buttons are clickable size
- [ ] Typography is comfortable to read
- [ ] No horizontal overflow

### Tablet (768px-1024px)
- [ ] Layout adapts to portrait orientation
- [ ] Form is still usable in landscape
- [ ] Touch targets are at least 44x44px
- [ ] No elements overlap
- [ ] Microphone works on tablet browser
- [ ] Recording UI doesn't get cramped

### Mobile (375px-667px)
- [ ] Layout stacks vertically
- [ ] Form is single-column
- [ ] Buttons are touch-friendly (44x44px+)
- [ ] Domain selector is easily clickable
- [ ] Voice recording works on mobile
- [ ] Record button has good visual feedback
- [ ] No horizontal overflow
- [ ] Textarea scrolls if needed
- [ ] Success message visible on small screen

### Landscape Mobile (667px wide, 375px tall)
- [ ] Form doesn't require excessive scrolling
- [ ] Buttons remain clickable
- [ ] Voice controls work
- [ ] No elements hidden off-screen

---

## ACCESSIBILITY

### Keyboard Navigation
- [ ] Tab moves through domain selector
- [ ] Tab moves through source type selector
- [ ] Tab activates Record button
- [ ] Tab moves to transcript textarea
- [ ] Tab moves to Submit button
- [ ] Enter/Space activates buttons
- [ ] No keyboard traps

### Focus Indicators
- [ ] Radio buttons show focus ring
- [ ] Buttons show focus ring
- [ ] Textarea shows focus ring
- [ ] Focus indicators are visible (not just color)

### Screen Reader
- [ ] Domain selector label announced
- [ ] Radio button options announced
- [ ] "Operational Domain (Required)" announced
- [ ] Submit button purpose clear
- [ ] Error messages announced
- [ ] Success messages announced

### Color Contrast
- [ ] Label text has sufficient contrast
- [ ] Button text readable on button background
- [ ] Error text readable (red on white)
- [ ] Input field text readable

---

## BROWSER COMPATIBILITY

- [ ] Chrome/Edge (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Mobile Safari (latest)
- [ ] Chrome Mobile (latest)

### Known Limitations
- [ ] Microphone access requires HTTPS (or localhost)
- [ ] Some older browsers may not support MediaRecorder
- [ ] Voice recording requires modern browser

---

## PERFORMANCE

### Load Time
- [ ] Page loads in < 2 seconds
- [ ] Interactive elements appear within 1 second
- [ ] No cumulative layout shift
- [ ] No main thread blocking

### Recording Performance
- [ ] Recording doesn't cause UI lag
- [ ] Duration counter updates smoothly
- [ ] Recording doesn't drain battery excessively
- [ ] Stop recording is responsive

### Submission Performance
- [ ] Form submission completes within 5 seconds
- [ ] Loading indicator visible throughout
- [ ] Response parsed and displayed quickly
- [ ] No duplicate submissions possible

---

## VALIDATION SUMMARY

✅ When all checkboxes pass: UI is production-ready
❌ Any failed checkbox: Document and fix before deployment

**Target: 100% pass rate before production verification**
