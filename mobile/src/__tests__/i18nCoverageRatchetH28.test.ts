/**
 * H28 localisation ratchet.
 *
 * "Implement keys throughout" is ongoing (PDF: continuous, final pass before
 * each release). This test makes coverage only go up:
 *  - files already moved to translation keys must contain no hard-coded
 *    English UI text;
 *  - the total number of hard-coded UI strings in the app may not grow.
 * Lower HARDCODED_BASELINE whenever a screen is translated.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
// Measured 2026-11-11 after the core role journeys pass (was 978 after the
// first H28 pass). Only ever decrease this.
const HARDCODED_BASELINE = 644;

const FULLY_LOCALISED = [
  'components/PendingNextStep.tsx',
  'components/LanguageSelector.tsx',
  'components/Badges.tsx',
  'screens/shared/AssistantScreen.tsx',
  'navigation/roleNavigators/SuperAdminNavigator.tsx',
  'navigation/roleNavigators/AdminPersatuanNavigator.tsx',
  'navigation/roleNavigators/MasterNavigator.tsx',
  'navigation/roleNavigators/ParentNavigator.tsx',
  'navigation/roleNavigators/StudentNavigator.tsx',
  'screens/auth/WelcomeScreen.tsx',
  'screens/auth/LoginScreen.tsx',
  'screens/auth/ForgotPasswordScreen.tsx',
  'screens/auth/SplashScreen.tsx',
  'screens/auth/VerifyCertificateScreen.tsx',
  'screens/auth/AuthenticatedPlaceholderScreen.tsx',
  'screens/roles/UnauthorizedRoleScreen.tsx',
  'screens/roles/RolePlaceholderBase.tsx',
  'screens/roles/superAdmin/index.tsx',
  'screens/roles/adminPersatuan/index.tsx',
  'screens/roles/adminPersatuan/AdminFinanceScreen.tsx',
  'screens/roles/master/index.tsx',
  'screens/roles/master/ClassesScreen.tsx',
  'screens/roles/master/AttendanceScreen.tsx',
  'screens/roles/master/MasterGradingScreen.tsx',
  'screens/roles/master/QRScannerModal.tsx',
  'screens/roles/parent/index.tsx',
  'screens/roles/parent/ParentFeesPaymentScreen.tsx',
  'screens/roles/student/index.tsx',
];

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

describe('H28 localisation ratchet', () => {
  test.each(FULLY_LOCALISED)('%s has no hard-coded English UI text', file => {
    expect(hardcodedStrings(fs.readFileSync(path.join(SRC, file), 'utf8'))).toEqual([]);
  });

  test(`hard-coded UI strings across the app do not exceed the baseline (${HARDCODED_BASELINE})`, () => {
    const total = tsxFiles(SRC).reduce((n, f) => n + hardcodedStrings(fs.readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeLessThanOrEqual(HARDCODED_BASELINE);
  });
});
