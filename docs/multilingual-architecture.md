# Multilingual Architecture

## Supported Languages

- English: `en`, LTR, default.
- Arabic: `ar`, RTL.
- Urdu: `ur`, RTL.
- Persian/Farsi: `fa`, RTL.
- Pashto: `ps`, RTL.

## User Preference

Each profile can store `preferred_language_code`. A separate `user_language_preferences` table keeps history and UI direction.

## Translation Storage

For system labels:

- `translation_keys`
- `translation_values`

For user-entered records:

- `record_translations`

Each record translation stores:

- original text.
- original language.
- English translation.
- Arabic translation.
- Urdu translation.
- Persian/Farsi translation.
- Pashto translation.
- auto/manual translation status.
- correction history.

## RTL Support

Arabic, Urdu, Persian/Farsi, and Pashto require:

- `dir="rtl"` layout.
- right-aligned form labels.
- mirrored navigation where required.
- report templates that support RTL text.

## Translation Flow

1. User enters text.
2. System stores original text and original language.
3. Automatic translation fills missing languages.
4. User or admin can manually correct translations.
5. Correction writes `translation_audit_logs`.
6. UI reads language preference and displays the matching translation.

