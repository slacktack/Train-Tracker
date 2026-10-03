// Screenshot helper: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [theme]
import { chromium } from '@playwright/test';

const [url, out, w = '1440', h = '900', wait = '9000', theme = 'light'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: theme });
await ctx.addInitScript((t) => {
  try {
    localStorage.setItem('train-tracker:theme', t);
  } catch {}
}, theme);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log('saved', out, errs.length ? `errors: ${errs.join(' | ')}` : 'no errors');
await browser.close();
