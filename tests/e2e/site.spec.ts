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
  const hoursSummary = page.locator(".hours-chip");
  await expect(hoursSummary).toContainText(/Today · (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
  await expect(hoursSummary.locator("span")).toHaveCount(1);
  await expect(hoursSummary.getByRole("link", { name: "Weekly hours" })).toHaveAttribute("href", "/visit#hours");
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
  await expect(page.locator("[data-session-card]").nth(0)).toContainText("Pro Rig");
  await expect(page.locator("[data-session-card]").nth(1)).toContainText("Regular Rig");
  await expect(page.locator('a[href="/events"]')).not.toHaveCount(0);
  await expect(page.locator('a[href="/whats-new"]')).not.toHaveCount(0);
  await expect(page.locator('a[href="/membership"]')).not.toHaveCount(0);
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
  await page.addInitScript(() => {
    Object.defineProperty(window, "open", { configurable: true, value: (url?: string | URL) => { (window as typeof window & { __openedWhatsapp?: string }).__openedWhatsapp = String(url ?? ""); return null; } });
  });
  await page.route("**/api/bookings", async (route) => {
    const payload = route.request().postDataJSON() as { start?: string; durationMinutes?: number; items?: unknown[] };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ bookingId: "XR-E2E01", total: 44, start: payload.start, durationMinutes: payload.durationMinutes, items: payload.items }),
    });
  });
  await page.goto("/book");
  await page.locator('[data-service-row="ps5"]').getByRole("button", { name: /add one ps5 lounge/i }).click();
  await page.getByLabel("Additional controllers").selectOption("2");
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
  await page.getByLabel("Email address Optional").fill("test@example.com");
  await page.getByRole("button", { name: /confirm booking/i }).click();
  await expect(page.getByRole("heading", { name: /booking confirmed/i })).toBeVisible();
  await expect(page.locator("[data-booking-id]")).toContainText("XR-");
  const whatsappUrl = await page.evaluate(() => (window as typeof window & { __openedWhatsapp?: string }).__openedWhatsapp ?? "");
  expect(decodeURIComponent(whatsappUrl)).toContain("Resources: 1 × Regular Rig · 1 × PS5 Lounge (+2 controllers)");
  expect(decodeURIComponent(whatsappUrl)).toContain("Controllers: 2 included + 2 additional");
  await expect(page.locator("[data-whatsapp-status]")).toContainText("booking is confirmed");
});

test("booking form rejects a non-Malaysian mobile number before submit", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 375, "Single phone-validation browser check");
  let bookingPostCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/bookings") && request.method() === "POST") bookingPostCount += 1;
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
  await page.locator("[data-slots] button").first().click();
  await page.getByRole("button", { name: /enter details/i }).click();
  await page.getByLabel("Name").fill("Test Customer");
  await page.getByLabel("Mobile / WhatsApp").fill("03-8765 4321");
  await page.getByRole("button", { name: /confirm booking/i }).click();
  const validationMessage = await page.getByLabel("Mobile / WhatsApp").evaluate((input: HTMLInputElement) => input.validationMessage);
  expect(validationMessage).toMatch(/valid Malaysian mobile number/i);
  expect(bookingPostCount).toBe(0);
});

test("booking setup enforces configured limits and controller rules", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375", "Single setup validation browser check");
  await page.goto("/book");
  await expect(page.locator('input[name="duration"]')).toHaveCount(4);
  await expect(page.getByLabel("Email address Optional")).toHaveAttribute("type", "email");
  const regularRow = page.locator('[data-service-row="regular-sim"]');
  const addRegular = regularRow.getByRole("button", { name: /add one regular rig/i });
  await addRegular.click();
  await addRegular.click();
  await addRegular.click();
  await expect(regularRow.getByText(/maximum 3 regular rigs available/i)).toBeVisible();
  await expect(page.getByLabel("Regular Rig quantity")).toHaveValue("3");
  await expect(page.locator("[data-controller-choice]")).toBeHidden();
  await page.locator('[data-service-row="ps5"]').getByRole("button", { name: /add one ps5 lounge/i }).click();
  await expect(page.locator("[data-controller-choice]")).toBeVisible();
  await expect(page.getByLabel("Additional controllers")).toHaveValue("0");
  await expect(page.getByLabel("Additional controllers").locator("option")).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("today auto-loads approved single-row availability indicators", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375", "Single approved-indicator browser check");
  let requestedDate = "";
  await page.route("**/api/availability?**", async (route) => {
    requestedDate = new URL(route.request().url()).searchParams.get("date") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configRevision: "seed-draft-v2",
        slots: [
          { start: `${requestedDate}T12:00:00+08:00`, available: true, capacity: { "regular-sim": 3, "pro-sim": 1, ps5: 2 } },
          { start: `${requestedDate}T12:30:00+08:00`, available: false, capacity: { "regular-sim": 2, "pro-sim": 0, ps5: 1 } },
        ],
      }),
    });
  });
  await page.goto("/book");
  await page.locator('[data-service-row="pro-sim"]').getByRole("button", { name: /add one pro rig/i }).click();
  await page.locator('[data-service-row="ps5"]').getByRole("button", { name: /add one ps5 lounge/i }).click();
  const today = await page.getByLabel("Date").getAttribute("min");
  await page.getByRole("button", { name: /choose a time/i }).click();
  await expect(page.locator(".availability-slot")).toHaveCount(2);
  expect(requestedDate).toBe(today);
  await expect(page.locator("[data-availability-legend]")).toContainText("R Regular Rig");
  await expect(page.locator("[data-availability-legend]")).toContainText("P Pro Rig");
  await expect(page.locator("[data-availability-legend]")).toContainText("PS PS5 Lounge");
  await expect(page.locator(".availability-slot").first()).toHaveAccessibleName(/Regular Rig: 3 of 3 available.*Pro Rig: 1 of 1 available.*PS5 Lounge: 2 of 2 available/i);
  await expect(page.locator(".availability-slot").nth(1)).toHaveAttribute("aria-disabled", "true");
  const signalTops = await page.locator(".availability-slot").first().locator(".availability-signal-group").evaluateAll((groups) => groups.map((group) => Math.round(group.getBoundingClientRect().top)));
  expect(new Set(signalTops).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("availability propagates every resource and duration and invalidates stale times", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Single booking-state matrix check");
  const requests: Array<Record<string, string>> = [];
  await page.route("**/api/availability?**", async (route) => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    requests.push(params);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configRevision: "seed-draft-v2", slots: [
        { start: `${params.date}T20:00:00+08:00`, available: true, capacity: { "regular-sim": 3, "pro-sim": 1, ps5: 2 } },
        { start: `${params.date}T20:30:00+08:00`, available: false, capacity: { "regular-sim": 2, "pro-sim": 0, ps5: 1 } },
      ] }),
    });
  });
  await page.goto("/book?service=ps5");
  await page.getByLabel("Additional controllers").selectOption("6");
  await page.getByText("90 min", { exact: true }).click();
  await page.getByRole("button", { name: /choose a time/i }).click();
  await expect(page.locator(".availability-slot")).toHaveCount(2);
  expect(requests.at(-1)).toMatchObject({ regular: "0", pro: "0", ps5: "1", durationMinutes: "90" });
  await expect(page.locator("[data-availability-legend]")).toContainText("PS PS5 Lounge");
  await expect(page.locator("[data-availability-legend]")).not.toContainText("Regular Rig");
  await expect(page.locator("[data-availability-legend]")).not.toContainText("Pro Rig");

  const available = page.locator(".availability-slot").first();
  const unavailable = page.locator(".availability-slot").nth(1);
  await unavailable.click({ force: true });
  await expect(page.getByRole("button", { name: /enter details/i })).toBeDisabled();
  await available.click();
  await expect(page.getByRole("button", { name: /enter details/i })).toBeEnabled();

  await page.getByLabel("Date").evaluate((input: HTMLInputElement) => {
    const next = new Date(`${input.value}T00:00:00`);
    next.setDate(next.getDate() + 1);
    input.value = next.toISOString().slice(0, 10);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: /enter details/i })).toBeDisabled();
  await expect(page.locator(".availability-slot")).toHaveCount(0);
  await expect(page.locator("[data-slot-status]")).toContainText("updated selection");

  await page.getByRole("button", { name: /back/i }).click();
  await page.locator('[data-service-row="regular-sim"]').getByRole("button", { name: /add one regular rig/i }).click();
  await page.locator('[data-service-row="pro-sim"]').getByRole("button", { name: /add one pro rig/i }).click();
  await page.getByText("120 min", { exact: true }).click();
  await page.getByRole("button", { name: /choose a time/i }).click();
  expect(requests.at(-1)).toMatchObject({ regular: "1", pro: "1", ps5: "1", durationMinutes: "120" });
  await expect(page.locator(".availability-slot").first()).toHaveAccessibleName(/Regular Rig.*Pro Rig.*PS5 Lounge/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("core routes render without console errors or broken images", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  for (const route of ["/", "/experiences", "/pricing", "/book", "/visit", "/events", "/whats-new", "/membership"]) {
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
