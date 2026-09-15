import { expect, test } from "@playwright/test";

test("homepage presents the approved story without overflow", async ({ page }) => {
  await page.goto("/");
  const heroHeading = page.getByRole("heading", { level: 1, name: "Race Together", exact: true });
  await expect(heroHeading).toBeVisible();
  expect((await heroHeading.textContent())?.replace(/\s+/g, " ").trim()).toBe("Race Together");
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const experienceDock = page.locator("[data-experience-dock]");
  await expect(page.getByRole("link", { name: /book a session/i }).first()).toBeVisible();
  await expect(page.locator("[data-session-card]")).toHaveCount(4);
  await expect(experienceDock.locator(":scope > a")).toHaveCount(3);
  if (viewportWidth <= 560) {
    await expect(experienceDock).toBeHidden();
  } else {
    await expect(experienceDock).toBeVisible();
    await expect(experienceDock.getByText("01")).toBeVisible();
    await expect(experienceDock.getByText("Refuel", { exact: true })).toBeVisible();
  }
  await expect(page.locator('[data-session-card] a[href="/book?service=regular-sim"]')).toHaveCount(1);
  await expect(page.locator('[data-session-card] a[href="/book?service=pro-sim"]')).toHaveCount(1);
  await expect(page.locator('[data-session-card] a[href="/book?service=ps5"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: "Choose your setup", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compare experiences", exact: true })).toHaveAttribute("href", "/experiences");
  await expect(page.getByRole("heading", { name: /more than racing/i })).toHaveCount(0);
  await expect(page.locator("[data-home-hero] img")).toHaveAttribute("loading", "eager");
  expect(await page.locator("main img[loading='eager']").count()).toBe(1);
  const sessionHeights = await page.locator("[data-session-card]").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
  expect(Math.max(...sessionHeights)).toBeLessThan(400);
  if (viewportWidth >= 1024) {
    const dock = await experienceDock.boundingBox();
    expect(dock?.y).toBeLessThan(page.viewportSize()!.height);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile header keeps booking visible and menu keyboard-safe", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 900, "Mobile and tablet header only");
  await page.goto("/");
  const book = page.locator(".mobile-book-cta");
  await expect(book).toBeVisible();
  await expect(book).toHaveAttribute("href", "/book");
  const box = await book.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);

  const toggle = page.locator("[data-menu-toggle]");
  await expect(toggle).toHaveAccessibleName("Open menu");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName("Close menu");
  await expect(page.locator("#mobile-nav")).toBeVisible();
  await expect(page.locator("#mobile-nav a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-nav")).toBeHidden();
  await expect(toggle).toHaveAccessibleName("Open menu");
  await expect(toggle).toBeFocused();
});

test("mock booking flow reaches confirmation", async ({ page }) => {
  await page.route("**/api/bookings", async (route) => {
    const payload = route.request().postDataJSON() as { start?: string };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ bookingId: "XR-E2E01", total: 20, start: payload.start }),
    });
  });
  await page.goto("/book");
  await page.getByRole("button", { name: /choose a time/i }).click();
  await page.getByLabel("Date").evaluate((input: HTMLInputElement) => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    input.value = date.toISOString().slice(0, 10);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: /check availability/i }).click();
  const slot = page.locator("[data-slots] button").first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.getByRole("button", { name: /enter details/i }).click();
  await page.getByLabel("Name").fill("Test Customer");
  await page.getByLabel("Mobile / WhatsApp").fill("+60123456789");
  await page.getByRole("button", { name: /confirm booking/i }).click();
  await expect(page.getByRole("heading", { name: /booking confirmed/i })).toBeVisible();
  await expect(page.locator("[data-booking-id]")).toContainText("XR-");
});

test("core routes render without console errors or broken images", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  for (const route of ["/", "/experiences", "/pricing", "/book", "/visit"]) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should load`).toBe(true);
    await expect(page.locator("main h1")).toBeVisible();
    const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 0).length);
    expect(broken, `${route} should have no broken images`).toBe(0);
  }
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("homepage supports reduced motion and 200 percent equivalent reflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1024", "Single representative reflow audit");
  await page.setViewportSize({ width: 384, height: 512 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1, name: "Race Together", exact: true })).toBeVisible();
  const book = page.locator(".mobile-book-cta");
  await book.focus();
  const styles = await book.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineWidth: Number.parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle };
  });
  expect(styles.outlineStyle).not.toBe("none");
  expect(styles.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("favicon and web manifest are available", async ({ request }) => {
  for (const path of ["/favicon.svg", "/favicon-32x32.png", "/apple-touch-icon.png", "/site.webmanifest"]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} should load`).toBe(true);
  }
});
