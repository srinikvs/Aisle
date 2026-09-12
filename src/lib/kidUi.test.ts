import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { canBrowseStoreRuns } from "./permissions.ts";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("kid store-run lock", () => {
  it("forbids store-run UI for the kid role", () => {
    assert.equal(canBrowseStoreRuns("kid"), false);
    assert.equal(canBrowseStoreRuns("adult"), true);
  });

  it("KidHome never mounts store-run screens or store names", () => {
    const src = source("../components/KidHome.tsx");
    assert.equal(src.includes("StoreScreen"), false);
    assert.equal(/costco|publix|office-depot/i.test(src), false);
    assert.match(src, /hideStores/);
  });

  it("kids are routed to KidHome instead of AdultHome", () => {
    const src = source("../App.tsx");
    assert.match(src, /role === "kid"/);
    assert.match(src, /<KidHome/);
    assert.match(src, /never mount AdultHome/);
    assert.match(src, /pauseReminderDelivery/);
  });

  it("KidHome never mounts the shopping reminder", () => {
    const src = source("../components/KidHome.tsx");
    assert.equal(src.includes("ReminderCard"), false);
    assert.equal(src.includes("useShoppingReminder"), false);
    assert.equal(/5pm|notification/i.test(src), false);
  });

  it("only AdultHome mounts the shopping reminder", () => {
    const src = source("../components/AdultHome.tsx");
    assert.match(src, /ReminderCard/);
    assert.match(src, /showControls=\{home\}/);
  });
});
