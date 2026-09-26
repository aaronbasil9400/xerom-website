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
  await expect(page.locator("#new-booking select[name='duration'] option")).toHaveText(["30 minutes", "60 minutes", "90 minutes", "120 minutes"]);
  await expect(page.locator(".rc-demo-banner")).toHaveCount(0);
  await expect(page.getByText("Draft surface", { exact: true })).toHaveCount(0);
  await expect(page.locator(".rc-notice")).toHaveCount(0);
  await expect(page.locator(".rc-summary")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator("body")).not.toContainText("fixture-calendar-ref");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);

  await mkdir(".impeccable/review/race-control", { recursive: true });
  await page.screenshot({ path: `.impeccable/review/race-control/${testInfo.project.name}.png`, fullPage: true, animations: "disabled" });
});

test("Activity history separates audited actions from recovery holds without customer details", async ({ page }) => {
  await page.route("**/api/admin/activity?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    data: [
      { id: "action:test-action", category: "booking", action: "check-in", state: "succeeded", actorId: "access:owner-subject", createdAt: "2026-09-26T10:00:00.000Z", updatedAt: "2026-09-26T10:00:01.000Z", bookingId: "XR-ACTIVITY01", resourceIds: ["regular-01"] },
      { id: "config:test-publish", category: "settings", action: "publish", state: "succeeded", actorId: "access:owner-subject", createdAt: "2026-09-26T09:00:00.000Z", updatedAt: "2026-09-26T09:00:00.000Z", revisionId: "rev-activity01" },
      { id: "block:test-block", category: "block", action: "maintenance", state: "needs_review", actorId: "access:owner-subject", createdAt: "2026-09-26T08:00:00.000Z", updatedAt: "2026-09-26T08:00:00.000Z", resourceIds: ["pro-01"], start: "2026-09-27T08:00:00.000Z", end: "2026-09-27T09:00:00.000Z" },
    ],
    nextCursor: null,
    recoveryHolds: [{ operationId: "block:test-block", resourceIds: ["pro-01"], start: "2026-09-27T08:00:00.000Z", end: "2026-09-27T09:00:00.000Z", createdAt: "2026-09-26T08:00:00.000Z" }],
    recoveryHoldsTruncated: false,
    publicationHistoryUnavailable: false,
  }) }));
  await page.goto("/race-control/activity");
  await expect(page.getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
  await expect(page.getByText("Booking check-in", { exact: true })).toBeVisible();
  await expect(page.getByText("Business settings published", { exact: true })).toBeVisible();
  await expect(page.getByText("Maintenance block created", { exact: true })).toBeVisible();
  await expect(page.getByText("Recovery hold · pro-01", { exact: true })).toBeVisible();
  await expect(page.getByText(/By Owner/).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Test Customer");
  await expect(page.locator("body")).not.toContainText("+60123456789");
  await page.getByLabel("Type").selectOption("settings");
  await expect(page.getByText("Business settings published", { exact: true })).toBeVisible();
  await expect(page.getByText("Booking check-in", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
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

test("Race Control settings routes load the canonical unsaved draft without leaking calendar IDs", async ({ page }) => {
  for (const path of ["resources", "hours", "pricing", "offers", "rules"]) {
    await page.goto(`/race-control/settings/${path}`);
    if (path === "resources") {
      await expect(page.getByRole("link", { name: "Experience", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { name: "Experience editor", exact: true })).toBeVisible();
    }
    await expect(page.locator("[data-settings-state]")).toContainText(/Seed draft|Private draft/);
    await expect(page.locator("[data-settings-fields]")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("fixture-calendar-ref");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test("Bookings exposes combinable filters and normalized CSV export", async ({ page }) => {
  await page.goto("/race-control/bookings");
  await expect(page.getByLabel("Phone number")).toBeVisible();
  await expect(page.getByLabel("Experience type")).toHaveValue("");
  await expect(page.getByRole("columnheader", { name: "Experience" })).toBeVisible();
  await expect(page.getByLabel("Duration")).toHaveValue("");
  const downloadPromise = page.waitForEvent("download").catch(() => null);
  await page.route("**/api/admin/bookings?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("format") === "csv") return route.fulfill({ status: 200, headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="xerom.csv"' }, body: "booking_id\r\nXR-FIXTURE" });
    return route.continue();
  });
  await page.getByLabel("Phone number").fill("0123");
  await page.getByLabel("Experience type").selectOption("regular-sim");
  await page.getByLabel("Duration").selectOption("60");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download?.suggestedFilename()).toBe("xerom.csv");
});

test("Publishing preserves and explains the existing hero contract", async ({ page }) => {
  await page.goto("/race-control/content");
  await expect(page.getByRole("heading", { name: "Homepage hero image" })).toBeVisible();
  await expect(page.getByText("16:9", { exact: true })).toBeVisible();
  await expect(page.getByText("1600 × 900px", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("8 MB", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Choose approved Xerom hero image")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("Hero upload page reviews and publishes the saved draft", async ({ page }) => {
  const placeholderHero = "social-group-hero-placeholder-ai";
  const uploadedHero = "hero-11111111-1111-4111-8111-111111111111";
  let draftHero = placeholderHero;
  let liveHero = placeholderHero;
  let etag = '"draft-1"';
  let publishCount = 0;

  const draftResponse = () => ({ data: { websiteContent: { homepage: { heroAssetId: draftHero } } }, etag, draftHash: "a".repeat(64), seeded: false });
  await page.route("**/api/public-config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { websiteContent: { homepage: { heroAssetId: liveHero } } } }) }));
  await page.route("**/api/admin/config/draft", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(draftResponse()) });
    const body = route.request().postDataJSON() as { config?: { websiteContent?: { homepage?: { heroAssetId?: string } } } };
    draftHero = body.config?.websiteContent?.homepage?.heroAssetId ?? draftHero;
    etag = '"draft-2"';
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {}, etag }) });
  });
  await page.route("**/api/admin/media/hero", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { assetId: uploadedHero } }) }));
  await page.route("**/api/admin/config/review", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { draftHash: "a".repeat(64), baseRevision: "rev-current", reviewToken: "review-token-1234567890", publishable: true, scannedEventCount: 6, affectedBookingIds: [], validationErrors: [] } }) }));
  await page.route("**/api/admin/config/publish", async (route) => {
    publishCount += 1;
    liveHero = draftHero;
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ revisionId: "rev-published" }) });
  });

  await page.goto("/race-control/content");
  await expect(page.getByRole("button", { name: "Publish reviewed draft" })).toBeDisabled();
  await page.getByLabel("Choose approved Xerom hero image").setInputFiles("src/assets/images/social-group-hero.placeholder-ai.1600x900.jpg");
  await page.getByRole("button", { name: "Upload to private draft" }).click();
  await expect(page.locator("[data-hero-upload-result]")).toContainText("saved to the private draft");
  await expect(page.getByRole("button", { name: "Review changes" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Publish reviewed draft" })).toBeDisabled();

  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.locator("[data-hero-impact]")).toContainText("6 future Calendar entries checked");
  await expect(page.getByRole("button", { name: "Publish reviewed draft" })).toBeEnabled();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Publish reviewed draft" }).click();
  await expect(page.locator("[data-hero-publish-result]")).toContainText("now live");
  expect(publishCount).toBe(1);
});
