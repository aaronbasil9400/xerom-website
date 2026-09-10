import { test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("capture approved-size hero reproduction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Single-writer desktop evidence capture");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".hero-image").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".hero img"));
    return images.length >= 4 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({ path: ".impeccable/review/hero-repro.png", fullPage: false, animations: "disabled" });
});
