import { chromium } from '@playwright/test';
const B = 'http://localhost:3200';
const browser = await chromium.launch();
let fails = 0;
const ok = (c, l) => { if (!c) fails++; console.log(c ? '  ok  ' : '  FAIL', l); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('train-tracker:theme', 'light'));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));

await p.goto(`${B}/trains?from=RKMP&to=DMV&date=2026-10-04&quota=GN`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('article[aria-label*="+"]', { timeout: 120000 });
const totals = async () => (await p.locator('article[aria-label*="+"]').evaluateAll((els) =>
  els.map((e) => { const m = e.textContent.match(/Total (?:(\d+) h)?\s*(?:(\d+) min)?/); return m ? (+(m[1] || 0)) * 60 + (+(m[2] || 0)) : null; })));
const fares = async () => (await p.locator('article[aria-label*="+"]').evaluateAll((els) =>
  els.map((e) => { const m = e.textContent.match(/₹([\d,]+) for both/); return m ? +m[1].replace(/,/g, '') : null; })));

await p.getByRole('radio', { name: 'Fastest' }).last().click();
const t = (await totals()).filter((x) => x !== null);
ok(t.length > 3 && t.every((v, i) => i === 0 || t[i - 1] <= v), `Fastest sorts by total time (best ${Math.floor(t[0] / 60)}h${t[0] % 60}m)`);

await p.getByRole('radio', { name: 'Cheapest' }).last().click();
const f = (await fares()).filter((x) => x !== null);
ok(f.length > 3 && f.every((v, i) => i === 0 || f[i - 1] <= v), `Cheapest sorts by fare (lowest Rs ${f[0]})`);

const before = await p.locator('article[aria-label*="+"]').count();
await p.getByRole('button', { name: 'No tight changes' }).click();
await p.getByRole('button', { name: 'Wait under 6 h' }).click();
const after = await p.locator('article[aria-label*="+"]').count();
ok(after <= before, `filters narrow the list (${before} -> ${after})`);
const waits = await p.locator('article[aria-label*="+"]').evaluateAll((els) => els.map((e) => e.textContent.match(/Wait (?:(\d+) h)?\s*(?:(\d+) min)?/)).filter(Boolean).map((m) => (+(m[1] || 0)) * 60 + (+(m[2] || 0))));
ok(waits.every((w) => w <= 360 && w >= 90), `every shown wait is 1h30 to 6h (${Math.min(...waits)}-${Math.max(...waits)} min)`);

// station board: tapping a train opens seats, not tracking
await p.goto(`${B}/station/NDLS`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('ul button.glass');
const urlBefore = p.url();
await p.locator('ul button.glass').first().click();
await p.waitForSelector('[role=dialog][aria-label="Seats and tickets"]');
ok(p.url() === urlBefore, 'board row opens a sheet and does not navigate away');
await p.waitForTimeout(6000);
const body = await p.locator('[role=dialog]').innerText();
ok(/Going to/.test(body) && /Live status|Track live|No reserved tickets|SL|3A|2A|CC/.test(body), 'sheet shows destination picker and seats or an honest no-reservation note');
await p.keyboard.press('Escape');
ok((await p.locator('[role=dialog]').count()) === 0, 'sheet closes with Escape');
ok(errs.length === 0, `no page errors ${errs.join('|').slice(0, 100)}`);
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
