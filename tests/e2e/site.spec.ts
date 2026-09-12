import { expect, test } from "@playwright/test";

test("homepage presents the approved story without overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /race together/i })).toBeVisible();
  await expect(page.getByText("01").first()).toBeVisible();
  await expect(page.getByText("Refuel", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /book a session/i }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mock booking flow reaches confirmation", async ({ page }) => {
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
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  for (const route of ["/", "/experiences", "/pricing", "/book", "/visit"]) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should load`).toBe(true);
    await expect(page.locator("main h1")).toBeVisible();
    const broken = await page.locator("img").evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 0).length);
    expect(broken, `${route} should have no broken images`).toBe(0);
  }
  expect(consoleErrors).toEqual([]);
});

test("favicon and web manifest are available", async ({ request }) => {
  for (const path of ["/favicon.svg", "/favicon-32x32.png", "/apple-touch-icon.png", "/site.webmanifest"]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} should load`).toBe(true);
  }
});
