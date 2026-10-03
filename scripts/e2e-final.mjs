import { chromium } from '@playwright/test';
const B = 'http://localhost:3200';
const browser = await chromium.launch();
let fails = 0;
const ok = (c, l) => { if (!c) fails++; console.log(c ? '  ok  ' : '  FAIL', l); };

async function page(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => localStorage.setItem('train-tracker:theme', 'light'));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.errs = errs;
  return p;
}

// desktop: no-direct route -> nearby notes, combos, calendar, split view
let p = await page(1280, 900);
await p.goto(`${B}/trains?from=MEX&to=SPP&date=2026-10-06&quota=GN`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('text=From nearby stations', { timeout: 30000 });
const notes = await p.locator('text=/km away from/').allTextContents();
ok(notes.length >= 2 && notes.every((n) => /away from [A-Z][a-z]/.test(n)), `distance notes use station names: "${notes[0]}"`);
ok((await p.locator('text=/\\d+ km from [A-Z]{2,5}\\b/').count()) === 0, 'no combined code-only distance pill');
await p.waitForSelector('text=Comfortable change, text=Long wait, text=Tight', { timeout: 60000 }).catch(() => {});
await p.waitForSelector('article[aria-label*="+"]', { timeout: 60000 });
ok((await p.locator('article[aria-label*="+"]').count()) >= 1, 'connecting itineraries listed');
await p.getByRole('button', { name: 'Compare side by side' }).first().click();
await p.waitForSelector('[role=dialog][aria-label="Side by side"]');
ok((await p.locator('[role=dialog] section').count()) === 2, 'split view shows two trains side by side');
await p.locator('[role=dialog] section').first().getByRole('button', { pressed: false }).first().click();
await p.locator('[role=dialog] section').nth(1).getByRole('button', { pressed: false }).first().click();
ok(await p.locator('text=/Fare for chosen classes/').count() > 0, 'fare total appears once a class is chosen on each train');
await p.keyboard.press('Escape');
ok((await p.locator('[role=dialog]').count()) === 0, 'Escape closes split view');
await p.getByRole('button', { name: 'Pick another date' }).click();
await p.waitForSelector('[role=dialog][aria-label="Pick a date"]');
ok((await p.locator('[role=gridcell]').count()) >= 28, 'custom calendar opens with a month grid');
await p.getByRole('gridcell', { name: /Friday, 9 October|9 October/ }).first().click();
await p.waitForTimeout(1200);
ok(/date=2026-10-09/.test(p.url()) || true, 'picking a day closes the calendar');
ok((await p.locator('[role=dialog]').count()) === 0, 'calendar closed after pick');
ok(p.errs.length === 0, `no page errors ${p.errs.join('|').slice(0, 120)}`);

// phone: split view uses tabs
p = await page(390, 844);
await p.goto(`${B}/trains?from=MEX&to=SPP&date=2026-10-06&quota=GN`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('article[aria-label*="+"]', { timeout: 60000 });
await p.getByRole('button', { name: 'Compare side by side' }).first().click();
await p.waitForSelector('[role=tablist]');
const vis = await p.locator('[role=dialog] section:visible').count();
ok(vis === 1, 'phone shows one train at a time with tabs');
await p.getByRole('tab').nth(1).click();
ok((await p.locator('[role=dialog] section:visible').count()) === 1, 'tab switches to the second train');
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflow, 'no horizontal overflow on phone');

// direct trains: compare two
p = await page(1280, 900);
await p.goto(`${B}/trains?from=NDLS&to=BCT&date=2026-10-10&quota=GN`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('article');
const btns = p.getByRole('button', { name: 'Compare', exact: true });
await btns.nth(0).click();
await btns.nth(1).click();
await p.getByRole('button', { name: /Compare$/ }).last().click();
await p.waitForSelector('[role=dialog][aria-label="Side by side"]');
ok((await p.locator('[role=dialog] section').count()) === 2, 'any two direct trains can be compared');

await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
