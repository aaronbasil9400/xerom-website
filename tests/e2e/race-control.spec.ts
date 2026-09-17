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
  await expect(page.getByText(/Any minute within opening hours; no one-hour notice floor/i)).toBeVisible();
  await expect(page.locator("#new-booking select[name='duration'] option")).toHaveText(["30 minutes", "60 minutes", "120 minutes"]);
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

test("Race Control sidebar collapses, persists, and restores without narrowing the work area", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 701, "Phone navigation remains a horizontal bar.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/race-control/schedule");
  const toggle = page.getByRole("button", { name: "Collapse section navigation" });
  const nav = page.locator("#rc-sidebar");
  await expect(nav).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand section navigation" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await page.locator(".rc-shell").evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")[0]).toBe("0px");
  const widths = await page.evaluate(() => ({ shell: document.querySelector<HTMLElement>(".rc-shell")!.getBoundingClientRect().width, main: document.querySelector<HTMLElement>(".rc-main")!.getBoundingClientRect().width }));
  expect(widths.main).toBeGreaterThan(widths.shell * 0.9);
  await page.reload();
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Expand section navigation" }).click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole("button", { name: "Collapse section navigation" })).toHaveAttribute("aria-expanded", "true");
});

test("Race Control phone navigation ignores a saved desktop collapse preference", async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) >= 701, "Only phone widths use the horizontal navigation bar.");
  await page.addInitScript(() => localStorage.setItem("rc-sidebar", "collapsed"));
  await page.goto("/race-control/schedule");
  await expect(page.locator("#rc-sidebar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bookings", exact: true })).toBeVisible();
  await expect(page.locator("[data-rc-sidebar-toggle]")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("Race Control settings routes remain explicit drafts", async ({ page }) => {
  for (const path of ["resources", "hours", "pricing", "offers", "rules"]) {
    await page.goto(`/race-control/settings/${path}`);
    await expect(page.getByText("Not published", { exact: true })).toBeVisible();
    await expect(page.locator('[placeholder*="TODO(owner)"]').first()).toBeVisible();
  }
});
