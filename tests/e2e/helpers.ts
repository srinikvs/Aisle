import { expect, type Page } from "@playwright/test";
import { APP_VERSION_LABEL } from "../../src/version";

/** Reserved `.test` address. Hashed into on-device localStorage only. */
export const GUEST_EMAIL = "guest@aisle.test";
export const GUEST_PASSWORD = "e2e-guest";
export const VERSION_TEXT = `Aisle ${APP_VERSION_LABEL}`;

export async function openFresh(page: Page): Promise<void> {
  await page.route(
    (url) =>
      url.hostname === "fonts.googleapis.com" ||
      url.hostname === "fonts.gstatic.com" ||
      url.hostname.endsWith(".supabase.co"),
    (route) => route.abort(),
  );
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Aisle" })).toBeVisible();
  await expect(page).toHaveTitle(VERSION_TEXT);
  await expect(page.locator("footer.version")).toHaveText(VERSION_TEXT);
}

/** Local demo sign-up and household create. Never submits to Supabase. */
export async function signUpLocalGuest(page: Page): Promise<void> {
  await expect(page.getByText(/Local demo mode/)).toBeVisible();
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Name").fill("Guest");
  await page.getByLabel("Email").fill(GUEST_EMAIL);
  await page.getByLabel("Password").fill(GUEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Start a household" })).toBeVisible();
  await page.getByLabel("Household name").fill("Family");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page.getByRole("tab", { name: "Lists" })).toBeVisible();
  await expect(page.getByText(GUEST_EMAIL)).toBeVisible();
}
