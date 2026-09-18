import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { canReceiveShoppingReminder } from "./permissions.ts";
import {
  REMINDER_STORAGE_KEY,
  emptyReminderPref,
  loadReminderPref,
  localDateKey,
  markReminderFired,
  nextReminderAt,
  parseReminderStore,
  reminderCopy,
  reminderWorkerUrl,
  saveReminderPref,
  shouldFireReminder,
} from "./reminder.ts";

function at(isoLocalish: string): Date {
  return new Date(isoLocalish);
}

function memory(initial?: Record<string, string>): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} {
  const data = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("canReceiveShoppingReminder", () => {
  it("is adults only", () => {
    assert.equal(canReceiveShoppingReminder("adult"), true);
    assert.equal(canReceiveShoppingReminder("kid"), false);
    assert.equal(canReceiveShoppingReminder(null), false);
  });
});

describe("nextReminderAt", () => {
  it("schedules today when it is still morning", () => {
    const now = at("2026-09-12T09:15:00");
    const next = nextReminderAt(now, 17, 0);
    assert.equal(next.getFullYear(), 2026);
    assert.equal(next.getMonth(), 8);
    assert.equal(next.getDate(), 12);
    assert.equal(next.getHours(), 17);
    assert.equal(next.getMinutes(), 0);
    assert.equal(next.getSeconds(), 0);
  });

  it("rolls to tomorrow at or after 5pm", () => {
    const exact = nextReminderAt(at("2026-09-12T17:00:00"), 17, 0);
    assert.equal(exact.getDate(), 13);
    assert.equal(exact.getHours(), 17);

    const evening = nextReminderAt(at("2026-09-12T20:30:00"), 17, 0);
    assert.equal(evening.getDate(), 13);
    assert.equal(evening.getHours(), 17);
  });
});

describe("shouldFireReminder", () => {
  const enabled = { enabled: true, lastFiredDate: null as string | null };

  it("does not fire for kids or when disabled", () => {
    assert.equal(shouldFireReminder(at("2026-09-12T17:01:00"), enabled, "kid"), false);
    assert.equal(
      shouldFireReminder(at("2026-09-12T17:01:00"), { enabled: false, lastFiredDate: null }, "adult"),
      false,
    );
    assert.equal(shouldFireReminder(at("2026-09-12T17:01:00"), undefined, "adult"), false);
  });

  it("does not fire before 5pm local", () => {
    assert.equal(shouldFireReminder(at("2026-09-12T16:59:00"), enabled, "adult"), false);
  });

  it("fires at or after 5pm once per local day", () => {
    const now = at("2026-09-12T17:00:00");
    assert.equal(shouldFireReminder(now, enabled, "adult"), true);
    const fired = markReminderFired(enabled, now);
    assert.equal(fired.lastFiredDate, localDateKey(now));
    assert.equal(shouldFireReminder(now, fired, "adult"), false);
    assert.equal(shouldFireReminder(at("2026-09-13T17:05:00"), fired, "adult"), true);
  });
});

describe("reminderCopy", () => {
  it("mentions open needs and store runs for adults", () => {
    assert.equal(reminderCopy(0).title, "Time to review shopping");
    assert.match(reminderCopy(0).body, /Store runs/);
    assert.match(reminderCopy(1).body, /1 open need\./);
    assert.match(reminderCopy(12).body, /12 open needs/);
    assert.match(reminderCopy(12).body, /store run/);
  });
});

describe("reminder preference store", () => {
  it("persists per user and ignores junk", () => {
    const storage = memory();
    saveReminderPref("adult-1", { enabled: true, lastFiredDate: "2026-09-12" }, storage);
    saveReminderPref("adult-2", { enabled: false, lastFiredDate: null }, storage);

    assert.deepEqual(loadReminderPref("adult-1", storage), {
      enabled: true,
      lastFiredDate: "2026-09-12",
    });
    assert.deepEqual(loadReminderPref("adult-2", storage), {
      enabled: false,
      lastFiredDate: null,
    });
    assert.deepEqual(loadReminderPref("missing", storage), emptyReminderPref());
    assert.ok(storage.getItem(REMINDER_STORAGE_KEY)?.includes("adult-1"));
    assert.deepEqual(parseReminderStore("not-json"), {});
    assert.deepEqual(parseReminderStore('{"x":{"enabled":"yes"}}'), {});
  });
});

describe("reminder worker url", () => {
  it("stays under the Vite base path", () => {
    assert.equal(reminderWorkerUrl("/aisle/"), "/aisle/sw.js");
    assert.equal(reminderWorkerUrl("/"), "/sw.js");
  });

  it("service worker uses its registration scope, not a hardcoded host path", () => {
    const sw = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
    assert.match(sw, /registration\.scope/);
    assert.equal(sw.includes("/aisle/"), false);
    assert.match(sw, /periodicsync/);
    assert.match(sw, /AISLE_REMINDER_STATE/);
  });
});
