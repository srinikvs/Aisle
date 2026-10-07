import { defineConfig } from "@playwright/test";
import { appBase } from "./vite.config";

declare const process: {
  env: Record<string, string | undefined>;
};

/** Preview origin. Path comes from Vite (`/aisle/` by default, `/` when BASE_PATH=/). */
function previewURL(base: string): string {
  const path = base.endsWith("/") ? base : `${base}/`;
  return `http://127.0.0.1:4173${path}`;
}

function withTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

const remote = process.env.BASE_URL?.trim();
const localURL = previewURL(appBase);
// BASE_URL is the deployed mount: `https://host/aisle/` or `https://host/` for site root.
const baseURL = remote ? withTrailingSlash(remote) : localURL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  // Local preview always builds without Supabase so the guest path needs no secrets.
  webServer: remote
    ? undefined
    : {
        command:
          "VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
        url: localURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: "pixel",
      use: {
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
      },
    },
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
});
