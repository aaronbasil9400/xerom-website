import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("capture validated homepage evidence", async ({ page }, testInfo) => {
  const reviewVariant = process.env.VISUAL_VARIANT ?? "after";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".hero-image").waitFor({ state: "visible" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(480, innerHeight * .75)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const images = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
    for (const image of images) {
      image.scrollIntoView({ block: "center" });
      await Promise.race([
        image.decode().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1_500)),
      ]);
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  await mkdir(`.impeccable/review/homepage-upgrade/${reviewVariant}`, { recursive: true });
  const filenames: Record<string, string> = {
    "mobile-375": "mobile-375.png",
    "mobile-390": "mobile-390.png",
    "mobile-430": "mobile-430.png",
    "tablet-768": "tablet-768.png",
    "desktop-1024": "desktop-1024.png",
    "desktop-1440": "desktop-1440.png",
  };
  await page.screenshot({ path: `.impeccable/review/homepage-upgrade/${reviewVariant}/${filenames[testInfo.project.name]}`, fullPage: true, animations: "disabled" });
});
