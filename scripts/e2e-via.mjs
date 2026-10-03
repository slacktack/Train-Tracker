import { chromium } from '@playwright/test';
const B = 'http://localhost:3200';
const browser = await chromium.launch();
let fails = 0;
const ok = (c, l) => { if (!c) fails++; console.log(c ? '  ok  ' : '  FAIL', l); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('train-tracker:theme', 'light'));
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));

// build the route through the form
await p.goto(`${B}/trains`, { waitUntil: 'domcontentloaded' });
await p.getByRole('button', { name: 'Add a stop in between' }).click();
ok((await p.getByText('Stop 1').count()) > 0, 'adding a stop shows a station picker');
await p.getByRole('button', { name: 'Remove this stop' }).click();
ok((await p.getByText('Stop 1').count()) === 0, 'a stop can be removed again');

// empty stop is rejected with a clear message
await p.getByRole('button', { name: 'Add a stop in between' }).click();
await p.getByLabel('From', { exact: true }).fill('jhansi');
await p.getByRole('option').first().click();
await p.getByLabel('To', { exact: true }).fill('guwahati');
await p.getByRole('option').first().click();
await p.getByRole('button', { name: 'Search trains' }).click();
ok((await p.getByText('Pick every stop you added').count()) > 0, 'an empty stop is rejected with a clear message');
await p.getByLabel('Stop 1').fill('kanpur central');
await p.getByRole('option').first().click();
await p.getByRole('button', { name: 'Search trains' }).click();
await p.waitForURL(/via=/);
ok(/via=CNB/.test(p.url()), 'the stop is kept in the URL');

await p.waitForSelector('article[aria-label*="+"]', { timeout: 120000 });
ok((await p.getByText('Your route').count()) > 0, 'route header is shown');
const n = await p.locator('article[aria-label*="+"]').count();
ok(n >= 3, `chained itineraries listed (${n})`);
await p.getByRole('radio', { name: 'Fastest' }).last().click();
const t = await p.locator('article[aria-label*="+"]').evaluateAll((els) => els.map((e) => { const m = e.textContent.match(/Total (?:(\d+) h)?\s*(?:(\d+) min)?/); return (+(m?.[1] || 0)) * 60 + (+(m?.[2] || 0)); }));
ok(t.every((v, i) => i === 0 || t[i - 1] <= v), 'toggles work on a chosen route too');

// three legs, same-train split appears
await p.goto(`${B}/trains?from=VGLB&to=GHY&via=CNB,PNBE&date=2026-10-06&quota=GN`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('article[aria-label*="+"]', { timeout: 120000 });
const three = await p.locator('article[aria-label*="+"][aria-label*=" + "]').first().getAttribute('aria-label');
ok(three.split(' + ').length === 3, `three-train itinerary: ${three}`);
await p.getByRole('button', { name: 'Compare side by side' }).first().click();
await p.waitForSelector('[role=dialog][aria-label="Side by side"]');
ok((await p.locator('[role=dialog] section').count()) === 3, 'side-by-side view handles three trains');
await p.keyboard.press('Escape');

// phone: no overflow, tabs for 3
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const q = await m.newPage();
await q.goto(`${B}/trains?from=VGLB&to=GHY&via=CNB&date=2026-10-06&quota=GN`, { waitUntil: 'domcontentloaded' });
await q.waitForSelector('article[aria-label*="+"]', { timeout: 120000 });
ok(!(await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal overflow on phone');
ok(errs.length === 0, `no page errors ${errs.join('|').slice(0, 100)}`);
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
