import { chromium } from '@playwright/test';
const B = 'http://localhost:3200';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const path = (p) => new URL(p.url()).pathname + new URL(p.url()).search;
let fails = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(ok ? '  ok ' : '  FAIL', label, ok ? '' : `got ${got} want ${want}`); };

async function fresh() { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); return ctx.newPage(); }
const back = (p) => p.locator('button[aria-label="Back"], button:has-text("Back")').first();

// 1. trains list -> track -> back returns to the same search
let p = await fresh();
await p.goto(`${B}/trains?from=SBC&to=MAS&date=2026-10-03&quota=GN`, { waitUntil: 'networkidle' });
await p.waitForSelector('article');
await p.locator('article a[href^="/track/"]').first().click();
await p.waitForURL(/\/track\//);
await p.waitForTimeout(2500);
await back(p).click();
await p.waitForTimeout(1500);
check('trains -> track -> back', path(p), '/trains?from=SBC&to=MAS&date=2026-10-03&quota=GN');

// 2. station board -> seats sheet -> live status -> back returns to the board
p = await fresh();
await p.goto(`${B}/station/NDLS`, { waitUntil: 'networkidle' });
await p.waitForSelector('ul button.glass');
await p.locator('ul button.glass').first().click();
await p.waitForSelector('[role=dialog][aria-label="Seats and tickets"]');
check('board row opens the sheet, not the tracker', path(p), '/station/NDLS');
await p.locator('[role=dialog] a[href^="/track/"]').first().click();
await p.waitForURL(/\/track\//);
await p.waitForTimeout(2500);
await back(p).click();
await p.waitForTimeout(1500);
check('station -> sheet -> track -> back', path(p), '/station/NDLS');

// 3. direct open of a tracker falls back to home
p = await fresh();
await p.goto(`${B}/track/12951`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
await back(p).click();
await p.waitForTimeout(1500);
check('direct /track -> back falls back to /', path(p), '/');

// 4. PNR lookup -> result -> back
p = await fresh();
await p.goto(`${B}/pnr`, { waitUntil: 'networkidle' });
await p.fill('#pnr', '1234567890');
await p.keyboard.press('Enter');
await p.waitForURL(/\/pnr\/1234567890/);
await p.waitForTimeout(2000);
await back(p).click();
await p.waitForTimeout(1000);
check('pnr -> result -> back', path(p), '/pnr');

await browser.close();
console.log(fails ? `${fails} failed` : 'all navigation checks passed');
process.exit(fails ? 1 : 0);
