import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("capture approved-size hero reproduction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Single-writer desktop evidence capture");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".hero-image").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".home-hero img"));
    return images.length >= 1 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await mkdir(".impeccable/review/homepage-upgrade/after", { recursive: true });
  await page.screenshot({ path: ".impeccable/review/homepage-upgrade/after/hero-repro-1536.png", fullPage: false, animations: "disabled" });
});
