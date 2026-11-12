#!/usr/bin/env node
/**
 * Exports every app string in English, Bahasa Melayu and Tamil to a CSV for
 * native-speaker review (H28). Open the CSV in Excel or Google Sheets.
 *
 *   node scripts/export-translations.js [output.csv]
 *
 * Default output: ../docs/translation-review/beltflow-translations.csv
 * Rows marked HIGH cover consent, child safety, privacy, money and
 * approval decisions: review those first.
 */
/* global __dirname */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');
const OUT = process.argv[2] || path.join(__dirname, '..', '..', 'docs', 'translation-review', 'beltflow-translations.csv');

// Load the TypeScript dictionaries directly: transpile .ts files on require.
const originalLoader = Module._extensions['.js'];
Module._extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: filename,
  });
  mod._compile(outputText, filename);
};
void originalLoader;

const { en } = require(path.join(SRC, 'i18n/locales/en.ts'));
const { ms } = require(path.join(SRC, 'i18n/locales/ms.ts'));
const { ta } = require(path.join(SRC, 'i18n/locales/ta.ts'));
const { ASSISTANT_STRINGS } = require(path.join(SRC, 'i18n/assistantStrings.ts'));

const HIGH = /consent|guardian|minor|child|safety|medical|emergency|privacy|private|delete|revoke|refund|payment|paid|pay\b|fee|settle|receipt|duitnow|fpx|approve|reject|declin|withdraw|ai |assistant|read-only|cannot|never/i;

function flatten(obj, prefix, out) {
  if (typeof obj === 'string') {
    out[prefix] = obj;
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const rows = [];
for (const key of Object.keys(en)) {
  rows.push({ area: key.split('.')[0], key, en: en[key], ms: ms[key], ta: ta[key] });
}
const aEn = flatten(ASSISTANT_STRINGS.en, '', {});
const aMs = flatten(ASSISTANT_STRINGS.ms, '', {});
const aTa = flatten(ASSISTANT_STRINGS.ta, '', {});
for (const key of Object.keys(aEn)) {
  // Suggested-question queries are sent to the server in English on purpose.
  if (/\.query$/.test(key)) continue;
  rows.push({ area: 'assistant', key: `assistant.${key}`, en: aEn[key], ms: aMs[key], ta: aTa[key] });
}

const placeholders = s => (String(s).match(/\{\w+\}/g) || []).join(' ');
const cell = v => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = ['priority', 'area', 'key', 'english', 'bahasa_melayu', 'tamil', 'placeholders_keep_as_is',
  'bm_ok (Y/N)', 'bm_suggested', 'tamil_ok (Y/N)', 'tamil_suggested', 'reviewer_notes'];
const lines = [header.join(',')];
rows
  .map(r => ({ ...r, priority: HIGH.test(`${r.key} ${r.en}`) ? 'HIGH' : 'normal' }))
  .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'HIGH' ? -1 : 1))
  .forEach(r => {
    lines.push([r.priority, r.area, r.key, r.en, r.ms, r.ta, placeholders(r.en), '', '', '', '', ''].map(cell).join(','));
  });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
// BOM so Excel opens the file as UTF-8 and shows Tamil correctly.
fs.writeFileSync(OUT, '﻿' + lines.join('\n') + '\n', 'utf8');
const high = lines.filter(l => l.startsWith('HIGH,')).length;
console.log(`Wrote ${rows.length} strings (${high} HIGH priority) to ${path.relative(process.cwd(), OUT)}`);
