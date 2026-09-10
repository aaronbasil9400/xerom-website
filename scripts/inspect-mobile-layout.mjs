import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:4321/");
const result = await page.evaluate(() => Object.fromEntries([".hero", ".hero-scene", ".race-path", ".path-step", ".path-media", ".route-line"].map((selector) => {
  const element = document.querySelector(selector);
  if (!element) return [selector, null];
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return [selector, { width: rect.width, height: rect.height, top: rect.top, display: style.display, gridTemplateRows: style.gridTemplateRows, alignContent: style.alignContent, minHeight: style.minHeight }];
})));
console.log(JSON.stringify(result, null, 2));
await browser.close();
