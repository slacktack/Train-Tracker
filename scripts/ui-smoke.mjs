// UI smoke test — real browser, mobile-first.
// Verifies: home renders, palette search → results → track page flow,
// bottom sheet expands, no console/page errors, no failed requests.
// Usage: node scripts/ui-smoke.mjs [baseURL]
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

const problems = [];
let stepCount = 0;

function ok(cond, label) {
  stepCount += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.log(`  ✗ ${label}`);
    problems.push(label);
  }
}

function collectErrors(page, scope) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${scope}] console.error: ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', (err) => problems.push(`[${scope}] pageerror: ${err.message.slice(0, 200)}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    // React aborts RSC prefetches mid-flight when the user navigates — benign.
    if (url.includes('_rsc=') && req.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (!url.includes('maptiler') && !url.includes('tile')) {
      problems.push(`[${scope}] requestfailed: ${req.method()} ${url} ${req.failure()?.errorText ?? ''}`);
    }
  });
}

const browser = await chromium.launch();

// ── 1. Home, mobile ────────────────────────────────────────────────────────
{
  console.log('home (mobile 390x844)');
  const page = await browser.newPage(MOBILE);
  collectErrors(page, 'home');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  // The feed poll lands async after mount — wait for the first data render.
  await page.waitForSelector('button[aria-label="Refresh live feed"]', { timeout: 30000 }).catch(() => {});
  await page.waitForSelector('text=Avg speed', { timeout: 30000 }).catch(() => {});
  ok(await page.locator('text=Search train, number, or city').count() > 0, 'search trigger visible');
  ok(await page.locator('button[aria-label="Refresh live feed"]').count() > 0, 'live count pill visible');
  ok(await page.locator('text=Avg speed').count() > 0, 'national snapshot stats visible');
  ok(await page.locator('canvas').count() > 0, 'map canvas rendered');

  // Palette: empty state shows favorites/recents sections (or hint), typing searches.
  await page.click('button:has-text("Search train")');
  ok(await page.locator('input[aria-label="Search trains by number, name, or city"]').count() > 0, 'palette input focused');
  await page.fill('input[aria-label="Search trains by number, name, or city"]', '12951');
  await page.waitForTimeout(1200);
  const resultCount = await page.locator('button:has-text("12951")').count();
  ok(resultCount > 0, `search returned 12951 result (${resultCount})`);
  await page.locator('button:has-text("12951")').first().click();
  await page.waitForURL('**/track/12951', { timeout: 15000 });
  ok(true, 'navigated to /track/12951');
  await page.screenshot({ path: '/tmp/tt-shots/track-mobile.png' });
  await page.close();
}

// ── 2. Track page, mobile — bottom sheet flow ──────────────────────────────
{
  console.log('track page (mobile)');
  const page = await browser.newPage(MOBILE);
  collectErrors(page, 'track');
  await page.goto(`${BASE}/track/12951`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  ok(await page.locator('button[aria-label="Add to favorites"], button[aria-label="Remove from favorites"]').count() > 0, 'favorite star in nav');
  ok(await page.locator('button[aria-label="Share this train"]').count() > 0, 'share button in nav');
  ok(await page.locator('button[aria-label="Refresh live status"]').count() > 0, 'refresh button in nav');

  // Bottom sheet: peek visible with train identity; expand via handle drag.
  const handle = page.locator('button[aria-label="Expand train details"], button[aria-label="Resize train details"]');
  ok(await handle.count() > 0, 'bottom sheet handle present');
  await handle.first().click();
  await page.waitForTimeout(1200);
  ok(await page.locator('text=Station timeline').count() > 0, 'sheet expanded shows station timeline');
  ok(await page.locator('text=Journey date').count() > 0 || await page.locator('text=Speed').count() > 0, 'panel content rendered');
  await page.screenshot({ path: '/tmp/tt-shots/track-sheet-expanded.png' });
  await page.close();
}

// ── 3. Track page, desktop ─────────────────────────────────────────────────
{
  console.log('track page (desktop)');
  const page = await browser.newPage(DESKTOP);
  collectErrors(page, 'track-desktop');
  await page.goto(`${BASE}/track/12951`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  ok(await page.locator('aside:visible').count() > 0 && await page.locator('text=Station timeline').count() > 0, 'desktop side panel with timeline');
  await page.screenshot({ path: '/tmp/tt-shots/track-desktop.png' });
  await page.close();
}

// ── 4. Home, desktop ───────────────────────────────────────────────────────
{
  console.log('home (desktop)');
  const page = await browser.newPage(DESKTOP);
  collectErrors(page, 'home-desktop');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  ok(await page.locator('text=Train Tracker').count() > 0, 'brand visible');
  ok(await page.locator('canvas').count() > 0, 'map rendered');
  await page.screenshot({ path: '/tmp/tt-shots/home-desktop.png' });
  await page.close();
}

await browser.close();

console.log(`\n${stepCount} checks, ${problems.length} problems`);
for (const p of problems) console.log(`  ⚠ ${p}`);
process.exit(problems.length === 0 ? 0 : 1);
