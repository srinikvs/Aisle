import { canManageListReminders, canReceiveShoppingReminder } from "./permissions";
import type { ListId, Role } from "../types";

export const REMINDER_HOUR = 17;
export const REMINDER_MINUTE = 0;
export const REMINDER_STORAGE_KEY = "aisle-reminder-v2";
export const REMINDER_STORAGE_KEY_V1 = "aisle-reminder-v1";
export const REMINDER_NOTIFICATION_TAG = "aisle-daily-shopping";
export const REMINDER_SYNC_TAG = "aisle-shopping-reminder";

export const REMINDER_MSG_STATE = "AISLE_REMINDER_STATE";
export const REMINDER_MSG_SHOW = "AISLE_SHOW_REMINDER";
export const REMINDER_MSG_FIRED = "AISLE_REMINDER_FIRED";

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export const REMINDER_TIMEZONES = [
  { value: "", label: "This device" },
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "UTC", label: "UTC" },
] as const;

/** v1.1.1 per-user on/off. Kept so we can migrate to per-list prefs. */
export interface ReminderPref {
  enabled: boolean;
  lastFiredDate: string | null;
}

export interface ListReminderPref {
  enabled: boolean;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  timezone: string | null;
  lastFiredDate: string | null;
}

export interface ReminderCopy {
  title: string;
  body: string;
  listId?: ListId;
}

export interface ReminderScheduleState {
  listId: ListId;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  timezone: string | null;
  lastFiredDate: string | null;
  title: string;
  body: string;
}

export interface ReminderWorkerState {
  enabled: boolean;
  hour: number;
  minute: number;
  lastFiredDate: string | null;
  title: string;
  body: string;
  schedules: ReminderScheduleState[];
}

export type ReminderKv = Pick<Storage, "getItem" | "setItem">;
export type ReminderMap = Record<ListId, ListReminderPref>;

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DEFAULT_PREF: ReminderPref = { enabled: false, lastFiredDate: null };

export function emptyReminderPref(): ReminderPref {
  return { ...DEFAULT_PREF };
}

export function emptyListReminderPref(): ListReminderPref {
  return {
    enabled: false,
    hour: REMINDER_HOUR,
    minute: REMINDER_MINUTE,
    daysOfWeek: [...ALL_WEEKDAYS],
    timezone: null,
    lastFiredDate: null,
  };
}

export function normalizeDaysOfWeek(days: readonly number[] | undefined): number[] {
  const unique = [...new Set((days ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return unique.sort((a, b) => a - b);
}

export function clampHour(value: number): number {
  if (!Number.isFinite(value)) return REMINDER_HOUR;
  return Math.min(23, Math.max(0, Math.trunc(value)));
}

export function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return REMINDER_MINUTE;
  return Math.min(59, Math.max(0, Math.trunc(value)));
}

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolvedTimeZone(timezone: string | null | undefined): string | null {
  return isValidTimeZone(timezone) ? timezone : null;
}

export function zonedParts(now: Date, timezone?: string | null): ZonedParts {
  const zone = resolvedTimeZone(timezone);
  if (!zone) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      weekday: now.getDay(),
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

export function localDateKey(now: Date, timezone?: string | null): string {
  const parts = zonedParts(now, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const asUtcMs = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
  };
  const offset = asUtcMs(utcGuess) - utcGuess;
  let adjusted = utcGuess - offset;
  const offset2 = asUtcMs(adjusted) - adjusted;
  if (offset2 !== offset) adjusted = utcGuess - offset2;
  return new Date(adjusted);
}

function addZonedDays(parts: ZonedParts, days: number, timezone: string): ZonedParts {
  const noon = zonedLocalToUtc(parts.year, parts.month, parts.day, 12, 0, timezone);
  return zonedParts(new Date(noon.getTime() + days * 86_400_000), timezone);
}

export function nextReminderAt(
  now: Date,
  hour = REMINDER_HOUR,
  minute = REMINDER_MINUTE,
  daysOfWeek: readonly number[] = ALL_WEEKDAYS,
  timezone: string | null = null,
): Date {
  const days = normalizeDaysOfWeek(daysOfWeek);
  const zone = resolvedTimeZone(timezone);
  if (days.length === 0) {
    const fallback = new Date(now.getTime() + 86_400_000 * 8);
    fallback.setHours(hour, minute, 0, 0);
    return fallback;
  }

  for (let add = 0; add <= 8; add += 1) {
    if (zone) {
      const today = zonedParts(now, zone);
      const dayParts = add === 0 ? today : addZonedDays(today, add, zone);
      if (!days.includes(dayParts.weekday)) continue;
      const candidate = zonedLocalToUtc(
        dayParts.year,
        dayParts.month,
        dayParts.day,
        hour,
        minute,
        zone,
      );
      if (candidate.getTime() > now.getTime()) return candidate;
    } else {
      const candidate = new Date(now.getTime());
      candidate.setDate(candidate.getDate() + add);
      candidate.setHours(hour, minute, 0, 0);
      if (!days.includes(candidate.getDay())) continue;
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  const later = new Date(now.getTime());
  later.setDate(later.getDate() + 1);
  later.setHours(hour, minute, 0, 0);
  return later;
}

export function nextListReminderAt(now: Date, pref: ListReminderPref): Date {
  return nextReminderAt(now, pref.hour, pref.minute, pref.daysOfWeek, pref.timezone);
}

export function nextEnabledReminderAt(now: Date, prefs: ReminderMap): Date | null {
  const times = Object.values(prefs)
    .filter((pref) => pref.enabled && normalizeDaysOfWeek(pref.daysOfWeek).length > 0)
    .map((pref) => nextListReminderAt(now, pref).getTime());
  if (times.length === 0) return null;
  return new Date(Math.min(...times));
}

export function shouldFireListReminder(
  now: Date,
  pref: ListReminderPref | undefined,
  role: Role | null,
): boolean {
  if (!canReceiveShoppingReminder(role) && !canManageListReminders(role)) return false;
  if (!pref?.enabled) return false;
  const days = normalizeDaysOfWeek(pref.daysOfWeek);
  if (days.length === 0) return false;
  const zone = resolvedTimeZone(pref.timezone);
  const parts = zonedParts(now, zone);
  if (!days.includes(parts.weekday)) return false;
  if (pref.lastFiredDate === localDateKey(now, zone)) return false;
  if (parts.hour > pref.hour) return true;
  if (parts.hour < pref.hour) return false;
  return parts.minute >= pref.minute;
}

/** @deprecated Use shouldFireListReminder. Kept for the v1.1.1 daily 5pm shape. */
export function shouldFireReminder(
  now: Date,
  pref: ReminderPref | undefined,
  role: Role | null,
  hour = REMINDER_HOUR,
  minute = REMINDER_MINUTE,
): boolean {
  if (!pref) return false;
  return shouldFireListReminder(
    now,
    {
      enabled: pref.enabled,
      hour,
      minute,
      daysOfWeek: [...ALL_WEEKDAYS],
      timezone: null,
      lastFiredDate: pref.lastFiredDate,
    },
    role,
  );
}

export function markListReminderFired(pref: ListReminderPref, now: Date): ListReminderPref {
  return { ...pref, lastFiredDate: localDateKey(now, pref.timezone) };
}

export function markReminderFired(pref: ReminderPref, now: Date): ReminderPref {
  return { ...pref, lastFiredDate: localDateKey(now) };
}

export function reminderCopy(openNeedCount: number, listTitle = "shopping"): ReminderCopy {
  const title = `Time to review ${listTitle}`;
  if (openNeedCount <= 0) {
    return {
      title,
      body:
        listTitle.toLowerCase() === "shopping"
          ? "No open needs. Check Store runs or add items for tomorrow."
          : `No open needs on ${listTitle}. Add items when you think of them.`,
    };
  }
  const noun = openNeedCount === 1 ? "need" : "needs";
  return {
    title,
    body:
      listTitle.toLowerCase() === "shopping"
        ? `${openNeedCount} open ${noun}. Review lists or start a store run.`
        : `${openNeedCount} open ${noun} on ${listTitle}.`,
  };
}

export function reminderNotificationTag(listId?: ListId): string {
  return listId ? `aisle-list-reminder:${listId}` : REMINDER_NOTIFICATION_TAG;
}

function isLegacyPref(value: unknown): value is ReminderPref {
  if (!value || typeof value !== "object") return false;
  const pref = value as ReminderPref;
  return (
    typeof pref.enabled === "boolean" &&
    (pref.lastFiredDate === null || typeof pref.lastFiredDate === "string") &&
    !("daysOfWeek" in pref)
  );
}

function isListPref(value: unknown): value is ListReminderPref {
  if (!value || typeof value !== "object") return false;
  const pref = value as ListReminderPref;
  return (
    typeof pref.enabled === "boolean" &&
    Number.isFinite(pref.hour) &&
    Number.isFinite(pref.minute) &&
    Array.isArray(pref.daysOfWeek) &&
    (pref.timezone === null || typeof pref.timezone === "string") &&
    (pref.lastFiredDate === null || typeof pref.lastFiredDate === "string")
  );
}

function normalizeListPref(pref: ListReminderPref): ListReminderPref {
  return {
    enabled: pref.enabled,
    hour: clampHour(pref.hour),
    minute: clampMinute(pref.minute),
    daysOfWeek: normalizeDaysOfWeek(pref.daysOfWeek),
    timezone: resolvedTimeZone(pref.timezone),
    lastFiredDate: pref.lastFiredDate,
  };
}

export function parseReminderStore(raw: string | null): Record<string, ReminderPref> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, ReminderPref> = {};
    for (const [userId, pref] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof userId === "string" && isLegacyPref(pref)) out[userId] = pref;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseReminderMapStore(raw: string | null): Record<string, ReminderMap> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, ReminderMap> = {};
    for (const [userId, map] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof userId !== "string" || !map || typeof map !== "object" || Array.isArray(map)) continue;
      const prefs: ReminderMap = {};
      for (const [listId, pref] of Object.entries(map as Record<string, unknown>)) {
        if (typeof listId === "string" && isListPref(pref)) prefs[listId] = normalizeListPref(pref);
      }
      out[userId] = prefs;
    }
    return out;
  } catch {
    return {};
  }
}

function migrateV1(storage: ReminderKv): Record<string, ReminderMap> {
  const v2 = parseReminderMapStore(storage.getItem(REMINDER_STORAGE_KEY));
  if (Object.keys(v2).length > 0) return v2;
  const v1 = parseReminderStore(storage.getItem(REMINDER_STORAGE_KEY_V1));
  const migrated: Record<string, ReminderMap> = {};
  for (const [userId, pref] of Object.entries(v1)) {
    migrated[userId] = {
      shopping: {
        enabled: pref.enabled,
        hour: REMINDER_HOUR,
        minute: REMINDER_MINUTE,
        daysOfWeek: [...ALL_WEEKDAYS],
        timezone: null,
        lastFiredDate: pref.lastFiredDate,
      },
    };
  }
  if (Object.keys(migrated).length > 0) {
    storage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(migrated));
  }
  return migrated;
}

export function loadReminderMap(userId: string, storage: ReminderKv): ReminderMap {
  if (!userId) return {};
  return migrateV1(storage)[userId] ?? {};
}

export function loadReminderPref(userId: string, storage: ReminderKv): ReminderPref {
  const shopping = loadReminderMap(userId, storage).shopping;
  if (!shopping) return emptyReminderPref();
  return { enabled: shopping.enabled, lastFiredDate: shopping.lastFiredDate };
}

export function saveReminderMap(userId: string, prefs: ReminderMap, storage: ReminderKv): ReminderMap {
  const store = migrateV1(storage);
  store[userId] = { ...prefs };
  storage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(store));
  return store[userId];
}

export function saveReminderPref(
  userId: string,
  pref: ReminderPref,
  storage: ReminderKv,
): ReminderPref {
  const map = loadReminderMap(userId, storage);
  map.shopping = {
    ...(map.shopping ?? emptyListReminderPref()),
    enabled: pref.enabled,
    lastFiredDate: pref.lastFiredDate,
  };
  saveReminderMap(userId, map, storage);
  return pref;
}

export function reminderPrefFor(map: ReminderMap, listId: ListId): ListReminderPref {
  return map[listId] ? { ...map[listId] } : emptyListReminderPref();
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function reminderWorkerUrl(baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl}sw.js`;
}

export async function registerReminderWorker(
  baseUrl = import.meta.env.BASE_URL,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(reminderWorkerUrl(baseUrl), {
      scope: baseUrl,
    });
  } catch {
    return null;
  }
}

async function reminderWorker(
  registration?: ServiceWorkerRegistration | null,
): Promise<ServiceWorker | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const target =
    registration ?? (await navigator.serviceWorker.getRegistration().catch(() => undefined));
  return target?.active ?? target?.waiting ?? navigator.serviceWorker.controller ?? null;
}

export async function syncReminderWorkerState(
  state: ReminderWorkerState,
  registration?: ServiceWorkerRegistration | null,
): Promise<void> {
  const worker = await reminderWorker(registration);
  worker?.postMessage({ type: REMINDER_MSG_STATE, state });
}

export async function pauseReminderDelivery(): Promise<void> {
  await syncReminderWorkerState({
    enabled: false,
    hour: REMINDER_HOUR,
    minute: REMINDER_MINUTE,
    lastFiredDate: null,
    title: "",
    body: "",
    schedules: [],
  });
}

export async function requestReminderPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showShoppingReminder(
  copy: ReminderCopy,
  registration?: ServiceWorkerRegistration | null,
  baseUrl = import.meta.env.BASE_URL,
): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const options: NotificationOptions = {
    body: copy.body,
    tag: reminderNotificationTag(copy.listId),
    icon: `${baseUrl}favicon.svg`,
    data: { url: baseUrl, listId: copy.listId ?? null },
  };
  try {
    if (registration) {
      await registration.showNotification(copy.title, options);
      return true;
    }
    new Notification(copy.title, options);
    return true;
  } catch {
    return false;
  }
}

export async function registerPeriodicReminder(
  registration: ServiceWorkerRegistration | null,
): Promise<boolean> {
  if (!registration) return false;
  const periodic = (
    registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    }
  ).periodicSync;
  if (!periodic) return false;
  try {
    await periodic.register(REMINDER_SYNC_TAG, { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
