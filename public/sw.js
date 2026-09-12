/* Aisle shopping reminder worker.
 * Registered under Vite base so Playadda and Sarukulu both stay valid.
 * Browsers park this worker often; it can only notify when woken
 * (page message, notification click, or periodic background sync).
 */
const STATE_CACHE = "aisle-reminder-state";
const STATE_URL = "state";
const NOTIFICATION_TAG = "aisle-daily-shopping";
const SYNC_TAG = "aisle-shopping-reminder";

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

function localDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function showReminder(title, body) {
  const options = {
    body,
    tag: NOTIFICATION_TAG,
    icon: `${self.registration.scope}favicon.svg`,
    data: { url: self.registration.scope },
  };
  await self.registration.showNotification(title || "Time to review shopping", options);
}

async function maybeNotify() {
  const state = await readState();
  if (!state?.enabled) return;
  const now = new Date();
  const today = localDateKey(now);
  if (state.lastFiredDate === today) return;
  const hour = Number.isFinite(state.hour) ? state.hour : 17;
  const minute = Number.isFinite(state.minute) ? state.minute : 0;
  const target = new Date(now.getTime());
  target.setHours(hour, minute, 0, 0);
  if (now.getTime() < target.getTime()) return;
  await showReminder(
    state.title || "Time to review shopping",
    state.body || "Review open items or start a store run.",
  );
  state.lastFiredDate = today;
  await writeState(state);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage({ type: "AISLE_REMINDER_FIRED", date: today });
  }
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "AISLE_REMINDER_STATE" && data.state) {
    event.waitUntil(writeState(data.state));
  }
  if (data.type === "AISLE_SHOW_REMINDER") {
    event.waitUntil(showReminder(data.title, data.body));
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
