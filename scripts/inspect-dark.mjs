import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
await ctx.addInitScript(() => localStorage.setItem('train-tracker:theme', 'dark'));
const page = await ctx.newPage();
await page.goto('http://localhost:3200/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const cs = (el) => el && { bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, bgImg: getComputedStyle(el).backgroundImage.slice(0, 60) };
  const en = [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent === 'EN');
  const search = [...document.querySelectorAll('header button')].find((b) => /Search/.test(b.textContent));
  const header = document.querySelector('header > div');
  return { htmlClass: document.documentElement.className.slice(0, 30), en: cs(en), search: cs(search), searchSpan: cs(search?.querySelector('span')), header: cs(header), lamp: getComputedStyle(document.documentElement).getPropertyValue('--lamp'), ink: getComputedStyle(document.documentElement).getPropertyValue('--ink') };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: '/tmp/shots/dark.png', clip: { x: 0, y: 0, width: 1280, height: 120 } });
await browser.close();
