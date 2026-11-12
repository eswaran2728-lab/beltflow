# Bahasa Melayu and Tamil review sheet (H28)

`beltflow-translations.csv` lists every string in the mobile app: English, Bahasa Melayu and Tamil side by side. Open it in Google Sheets or Excel (it is UTF-8, so Tamil displays correctly).

## For the reviewer
1. Start with rows marked **HIGH**. They cover consent, child safety, privacy, payments and approval decisions, where a wrong word matters most.
2. For each row, fill `bm_ok` / `tamil_ok` with **Y** or **N**. If **N**, write a better version in `bm_suggested` / `tamil_suggested`.
3. Keep anything in curly brackets exactly as it is, e.g. `{name}`, `{date}`. The app replaces those with real values. The `placeholders_keep_as_is` column lists them.
4. Keep translations short where the English is short: many are button labels on a phone screen.
5. Terms used so far: Master = "Master" (BM) / ஆசான் (Tamil); Persatuan = "Persatuan" / சங்கம். Say if you prefer different terms; they can be changed everywhere at once.

Rows starting `assistant.` are the AI Assistant screen.

## For developers
Regenerate after changing any text:

```bash
cd mobile && node scripts/export-translations.js
```

Apply reviewer changes in `mobile/src/i18n/locales/modules/<area>.ts` (the area is the first part of the key), or in `mobile/src/i18n/locales/ms.ts` / `ta.ts` and `mobile/src/i18n/assistantStrings.ts` for the rest. Then run `npm test` in `mobile/`: it checks every key has the same `{placeholders}` in all three languages.
