/* Aisle list reminder worker.
 * Registered under Vite base so Playadda and Sarukulu both stay valid.
 * Browsers park this worker often; it can only notify when woken
 * (page message, notification click, or periodic background sync).
 */
const STATE_CACHE = "aisle-reminder-state";
const STATE_URL = "state";
const NOTIFICATION_TAG = "aisle-daily-shopping";
const SYNC_TAG = "aisle-shopping-reminder";

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function readState() {
  const cache = await caches.open(STATE_CACHE);
  const response = await cache.match(STATE_URL);
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function writeState(state) {
  const cache = await caches.open(STATE_CACHE);
  await cache.put(STATE_URL, new Response(JSON.stringify(state), {
    headers: { "Content-Type": "application/json" },
  }));
}

function zonedParts(now, timeZone) {
  if (!timeZone) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      weekday: now.getDay(),
    };
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return {
      year: Number(get("year")),
      month: Number(get("month")),
      day: Number(get("day")),
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      weekday: WEEKDAY_INDEX[get("weekday")] ?? now.getDay(),
    };
  } catch {
    return zonedParts(now, null);
  }
}

function localDateKey(now = new Date(), timeZone) {
  const parts = zonedParts(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function schedulesFrom(state) {
  if (Array.isArray(state?.schedules) && state.schedules.length > 0) {
    return state.schedules;
  }
  if (!state) return [];
  return [{
    listId: "shopping",
    hour: Number.isFinite(state.hour) ? state.hour : 17,
    minute: Number.isFinite(state.minute) ? state.minute : 0,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    timezone: null,
    lastFiredDate: state.lastFiredDate ?? null,
    title: state.title,
    body: state.body,
  }];
}

async function showReminder(title, body, tag) {
  const options = {
    body,
    tag: tag || NOTIFICATION_TAG,
    icon: `${self.registration.scope}favicon.svg`,
    data: { url: self.registration.scope },
  };
  await self.registration.showNotification(title || "Time to review a list", options);
}

function due(schedule, now) {
  const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  if (days.length === 0) return false;
  const parts = zonedParts(now, schedule.timezone);
  const today = localDateKey(now, schedule.timezone);
  if (schedule.lastFiredDate === today) return false;
  if (!days.includes(parts.weekday)) return false;
  const hour = Number.isFinite(schedule.hour) ? schedule.hour : 17;
  const minute = Number.isFinite(schedule.minute) ? schedule.minute : 0;
  if (parts.hour > hour) return true;
  if (parts.hour < hour) return false;
  return parts.minute >= minute;
}

async function maybeNotify() {
  const state = await readState();
  if (!state?.enabled) return;
  const now = new Date();
  const schedules = schedulesFrom(state);
  const fired = [];
  for (const schedule of schedules) {
    if (!due(schedule, now)) continue;
    const today = localDateKey(now, schedule.timezone);
    await showReminder(
      schedule.title || "Time to review a list",
      schedule.body || "Review open items on this list.",
      schedule.listId ? `aisle-list-reminder:${schedule.listId}` : NOTIFICATION_TAG,
    );
    schedule.lastFiredDate = today;
    fired.push({ listId: schedule.listId || "shopping", date: today });
  }
  if (fired.length === 0) return;
  state.schedules = schedules;
  state.lastFiredDate = fired[fired.length - 1]?.date ?? state.lastFiredDate;
  await writeState(state);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    for (const event of fired) {
      client.postMessage({ type: "AISLE_REMINDER_FIRED", date: event.date, listId: event.listId });
    }
  }
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "AISLE_REMINDER_STATE" && data.state) {
    event.waitUntil(writeState(data.state));
  }
  if (data.type === "AISLE_SHOW_REMINDER") {
    event.waitUntil(showReminder(data.title, data.body, data.tag));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(maybeNotify());
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
