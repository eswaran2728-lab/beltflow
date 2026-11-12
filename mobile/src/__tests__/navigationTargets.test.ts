/**
 * Every navigation.navigate('Screen') call must open a screen that a
 * navigator registers. Otherwise the button silently does nothing.
 *
 * KNOWN_UNREGISTERED lists buttons found broken on 2026-11-12 whose screens
 * exist but are not wired into a navigator yet (they belong to optional
 * release modules and need an owner decision on gating and placement).
 * Remove an entry when it is wired; never add one to make this test pass.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

const KNOWN_UNREGISTERED: Record<string, string> = {
  Tournaments: 'Admin Persatuan dashboard (H24)',
  Inventory: 'Admin Persatuan dashboard (H25)',
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const files = sourceFiles(SRC).map(f => fs.readFileSync(f, 'utf8'));
const registered = new Set(files.flatMap(s => Array.from(s.matchAll(/\bname=["'](\w+)["']/g), m => m[1])));
const targets = new Set(files.flatMap(s => Array.from(s.matchAll(/navigate\??\.?\(?\s*\(?["'](\w+)["']/g), m => m[1])));

describe('navigation targets', () => {
  test('finds navigators and navigate calls', () => {
    expect(registered.has('ClassWorkspace')).toBe(true);
    expect(targets.size).toBeGreaterThan(5);
  });

  test('every navigate() target is a registered screen (apart from known gaps)', () => {
    const broken = [...targets].filter(t => !registered.has(t) && !(t in KNOWN_UNREGISTERED)).sort();
    expect(broken).toEqual([]);
  });

  test('the Master class workspace handover button opens a registered screen', () => {
    expect(registered.has('ClassHandover')).toBe(true);
  });

  test('known gaps are still gaps (remove fixed ones from the list)', () => {
    const fixed = Object.keys(KNOWN_UNREGISTERED).filter(t => registered.has(t) || !targets.has(t));
    expect(fixed).toEqual([]);
  });
});
