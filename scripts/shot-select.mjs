// Selects a train from the home map (via the dev map handle) and screenshots.
import { chromium } from '@playwright/test';
const [out, w = '1440', h = '900', theme = 'light'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme });
await ctx.addInitScript((t) => { localStorage.setItem('train-tracker:theme', t); localStorage.setItem('tt-debug', '1'); }, theme);
const page = await ctx.newPage();
await page.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
// click the first rendered moving train
const pt = await page.evaluate(() => {
  const m = window.__trainMap;
  const f = m.queryRenderedFeatures({ layers: ['train-arrow'] }).find((x) => {
    const p = m.project(x.geometry.coordinates);
    const wide = window.innerWidth >= 768;
    return wide ? p.x > 520 && p.x < window.innerWidth - 420 && p.y > 140 && p.y < window.innerHeight - 80 : p.x > 40 && p.x < window.innerWidth - 40 && p.y > 150 && p.y < window.innerHeight - 250;
  });
  if (!f) return null;
  const p = m.project(f.geometry.coordinates);
  return { x: p.x, y: p.y };
});
console.log('click', pt);
if (pt) await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(9000);
await page.screenshot({ path: out });
await browser.close();
