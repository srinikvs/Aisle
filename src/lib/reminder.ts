import { canReceiveShoppingReminder } from "./permissions";
import type { Role } from "../types";

export const REMINDER_HOUR = 17;
export const REMINDER_MINUTE = 0;
export const REMINDER_STORAGE_KEY = "aisle-reminder-v1";
export const REMINDER_NOTIFICATION_TAG = "aisle-daily-shopping";
export const REMINDER_SYNC_TAG = "aisle-shopping-reminder";

export const REMINDER_MSG_STATE = "AISLE_REMINDER_STATE";
export const REMINDER_MSG_SHOW = "AISLE_SHOW_REMINDER";
export const REMINDER_MSG_FIRED = "AISLE_REMINDER_FIRED";

export interface ReminderPref {
  enabled: boolean;
  lastFiredDate: string | null;
}

export interface ReminderCopy {
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
}

export type ReminderKv = Pick<Storage, "getItem" | "setItem">;

const DEFAULT_PREF: ReminderPref = { enabled: false, lastFiredDate: null };

export function emptyReminderPref(): ReminderPref {
  return { ...DEFAULT_PREF };
}

export function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Next 5:00 PM local. If it is already 5pm or later, returns tomorrow. */
export function nextReminderAt(
  now: Date,
  hour = REMINDER_HOUR,
  minute = REMINDER_MINUTE,
): Date {
  const next = new Date(now.getTime());
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function shouldFireReminder(
  now: Date,
  pref: ReminderPref | undefined,
  role: Role | null,
  hour = REMINDER_HOUR,
  minute = REMINDER_MINUTE,
): boolean {
  if (!canReceiveShoppingReminder(role) || !pref?.enabled) return false;
  if (pref.lastFiredDate === localDateKey(now)) return false;
  const target = new Date(now.getTime());
  target.setHours(hour, minute, 0, 0);
  return now.getTime() >= target.getTime();
}

export function markReminderFired(pref: ReminderPref, now: Date): ReminderPref {
  return { ...pref, lastFiredDate: localDateKey(now) };
}

export function reminderCopy(openNeedCount: number): ReminderCopy {
  const title = "Time to review shopping";
  if (openNeedCount <= 0) {
    return {
      title,
      body: "No open needs. Check Store runs or add items for tomorrow.",
    };
  }
  const noun = openNeedCount === 1 ? "need" : "needs";
  return {
    title,
    body: `${openNeedCount} open ${noun}. Review lists or start a store run.`,
  };
}

function isPref(value: unknown): value is ReminderPref {
  if (!value || typeof value !== "object") return false;
  const pref = value as ReminderPref;
  return (
    typeof pref.enabled === "boolean" &&
    (pref.lastFiredDate === null || typeof pref.lastFiredDate === "string")
  );
}

export function parseReminderStore(raw: string | null): Record<string, ReminderPref> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, ReminderPref> = {};
    for (const [userId, pref] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof userId === "string" && isPref(pref)) out[userId] = pref;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadReminderPref(userId: string, storage: ReminderKv): ReminderPref {
  if (!userId) return emptyReminderPref();
  return parseReminderStore(storage.getItem(REMINDER_STORAGE_KEY))[userId] ?? emptyReminderPref();
}

export function saveReminderPref(
  userId: string,
  pref: ReminderPref,
  storage: ReminderKv,
): ReminderPref {
  const store = parseReminderStore(storage.getItem(REMINDER_STORAGE_KEY));
  store[userId] = pref;
  storage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(store));
  return pref;
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
    tag: REMINDER_NOTIFICATION_TAG,
    icon: `${baseUrl}favicon.svg`,
    data: { url: baseUrl },
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
