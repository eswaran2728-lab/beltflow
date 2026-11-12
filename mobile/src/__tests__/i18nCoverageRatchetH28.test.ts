/**
 * H28 localisation guard.
 *
 * Every screen and component (all .tsx under src/, tests excluded) must take
 * its UI text from translation keys (useI18n().t). This test fails if any
 * file contains hard-coded English UI text, including files added later.
 *
 * The pattern match is simple, so a few pieces of code look like text. They
 * are listed exactly below; anything else is treated as untranslated text.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

// Matches that are code, not UI text (checked by hand 2026-11-12).
const KNOWN_NON_TEXT: Record<string, string[]> = {
  'components/StudentProfileModal.tsx': ['Promise'], // Promise<void> type
  'theme/ThemeProvider.tsx': ['ReturnType'], // ReturnType<...> type
  'screens/roles/parent/ParentMasterMessagingScreen.tsx': ['MAX_ATTACHMENT_SIZE_MB || size'], // size check
  'screens/roles/student/VideoFeedbackScreen.tsx': ['video/mp4'], // file type
};

function hardcodedStrings(source: string): string[] {
  const jsxText = Array.from(source.matchAll(/>\s*([A-Za-z][^<>{}\n]{2,}?)\s*</g)).map(m => m[1]);
  const props = Array.from(source.matchAll(/\b(?:label|title|subtitle|placeholder|message|description|actionLabel|accessibilityLabel)=["']([A-Za-z][^"']{2,})["']/g)).map(m => m[1]);
  return [...jsxText, ...props].filter(s => /[a-z]{2,}/.test(s));
}

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : tsxFiles(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

describe('H28 localisation guard', () => {
  const files = tsxFiles(SRC).map(f => path.relative(SRC, f).split(path.sep).join('/')).sort();

  test('finds the app source files', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files).toContain('screens/auth/LoginScreen.tsx');
  });

  test.each(files)('%s has no hard-coded English UI text', file => {
    const found = hardcodedStrings(fs.readFileSync(path.join(SRC, file), 'utf8'));
    expect(found).toEqual(KNOWN_NON_TEXT[file] ?? []);
  });
});
