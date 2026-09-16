import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("Race Control shell is private-labelled, responsive, and free of browser errors", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/race-control/schedule");
  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
  await expect(page.locator("#agenda-title")).not.toHaveText("Sunday · 13 September 2026");
  await expect(page.getByText(/Demo fixture · private owner workspace/i)).toBeVisible();
  await expect(page.locator(".rc-notice")).toContainText(/Demo fixture|Shared Calendar mode/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator("body")).not.toContainText("fixture-calendar-ref");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);

  await mkdir(".impeccable/review/race-control", { recursive: true });
  await page.screenshot({ path: `.impeccable/review/race-control/${testInfo.project.name}.png`, fullPage: true, animations: "disabled" });
});

test("Race Control settings routes remain explicit drafts", async ({ page }) => {
  for (const path of ["resources", "hours", "pricing", "offers", "rules"]) {
    await page.goto(`/race-control/settings/${path}`);
    await expect(page.getByText("Not published", { exact: true })).toBeVisible();
    await expect(page.locator('[placeholder*="TODO(owner)"]').first()).toBeVisible();
  }
});
