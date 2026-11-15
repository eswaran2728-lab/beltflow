/**
 * Renders the app icon, Android adaptive icon layers, splash image and favicon
 * from assets/brand/logo-mark.svg.
 *
 * Run from mobile/:  node scripts/render-brand-assets.js
 * Needs Playwright with Chromium (a dev tool, not an app dependency).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ASSETS = path.join(__dirname, '..', 'assets');
const mark = fs
  .readFileSync(path.join(ASSETS, 'brand', 'logo-mark.svg'), 'utf8')
  .replace(/<\?xml[^>]*>/, '');
const NAVY_BG = 'radial-gradient(120% 120% at 30% 20%, #1B4A75 0%, #0D2B47 45%, #061828 100%)';

/** One page: the mark centred at `scale` of the canvas, on `background`. */
function page(size, { background, scale, mono = false, wordmark = false }) {
  const m = Math.round(size * scale);
  const svg = mono
    ? mark.replace(/fill="[^"]*"/g, 'fill="#FFFFFF"').replace(/<defs>[\s\S]*?<\/defs>/, '')
    : mark;
  return `<html><body style="margin:0;width:${size}px;height:${size}px;background:${background};display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div style="width:${m}px;height:${m}px">${svg}</div>
    ${wordmark ? `<div style="font:800 ${Math.round(size * 0.1)}px -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;letter-spacing:-0.02em;margin-top:${Math.round(size * 0.01)}px">Belt<span style="color:#F2941C">Flow</span></div>` : ''}
  </body></html>`;
}

const TARGETS = [
  // [file, size, options, transparent]
  ['icon.png', 1024, { background: NAVY_BG, scale: 0.84 }, false],
  ['android-icon-foreground.png', 512, { background: 'transparent', scale: 0.6 }, true],
  ['android-icon-background.png', 512, { background: NAVY_BG, scale: 0 }, false],
  ['android-icon-monochrome.png', 432, { background: 'transparent', scale: 0.6, mono: true }, true],
  ['splash-icon.png', 1024, { background: 'transparent', scale: 0.5, wordmark: true }, true],
  ['favicon.png', 48, { background: NAVY_BG, scale: 0.8 }, false],
];

(async () => {
  const browser = await chromium.launch();
  for (const [file, size, opts, transparent] of TARGETS) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(page(size, opts));
    await p.screenshot({ path: path.join(ASSETS, file), omitBackground: transparent });
    await p.close();
    console.log('rendered', file, `${size}x${size}`);
  }
  await browser.close();
})();
