import { useCallback, useEffect, useRef, useState } from "react";
import { allLists } from "../data/catalogs";
import { needsForList, openCount } from "../lib/coverage";
import { canManageListReminders, canReceiveShoppingReminder } from "../lib/permissions";
import {
  loadReminderMap,
  markListReminderFired,
  nextEnabledReminderAt,
  notificationPermission,
  notificationsSupported,
  pauseReminderDelivery,
  registerPeriodicReminder,
  registerReminderWorker,
  reminderCopy,
  reminderPrefFor,
  requestReminderPermission,
  saveReminderMap,
  shouldFireListReminder,
  showShoppingReminder,
  syncReminderWorkerState,
  type ListReminderPref,
  type ReminderCopy,
  type ReminderMap,
} from "../lib/reminder";
import type { CustomList, ListId, Need, Role } from "../types";

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function noteForPermission(result: NotificationPermission | "unsupported"): string {
  if (result === "granted") {
    return "On. We’ll nudge you at the time you set when this browser can deliver it.";
  }
  if (result === "denied") {
    return "Notifications are blocked. If Aisle is open at the reminder time, you’ll see a banner instead.";
  }
  if (result === "unsupported") {
    return "This browser can’t send notifications. You’ll get a banner if Aisle is open at the reminder time.";
  }
  return "On. Allow notifications when asked, or keep Aisle open for an in-app banner.";
}

export function useListReminders(
  userId: string,
  role: Role | null,
  needs: readonly Need[],
  customLists: readonly CustomList[] = [],
) {
  const allowed = canReceiveShoppingReminder(role) && canManageListReminders(role);
  const storage = browserStorage();
  const [prefs, setPrefs] = useState<ReminderMap>(() =>
    allowed && storage ? loadReminderMap(userId, storage) : {},
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    notificationsSupported() ? notificationPermission() : "unsupported",
  );
  const [banner, setBanner] = useState<ReminderCopy | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyList, setBusyList] = useState<ListId | null>(null);

  const prefsRef = useRef(prefs);
  const needsRef = useRef(needs);
  const listsRef = useRef(customLists);
  const roleRef = useRef(role);
  const userIdRef = useRef(userId);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  prefsRef.current = prefs;
  needsRef.current = needs;
  listsRef.current = customLists;
  roleRef.current = role;
  userIdRef.current = userId;

  const persist = useCallback((next: ReminderMap) => {
    prefsRef.current = next;
    setPrefs(next);
    const store = browserStorage();
    if (store && userIdRef.current) saveReminderMap(userIdRef.current, next, store);
  }, []);

  const copyFor = useCallback((listId: ListId) => {
    const list = allLists(listsRef.current).find((entry) => entry.id === listId);
    const title = list?.title ?? "this list";
    return { ...reminderCopy(openCount(needsForList(listId, needsRef.current)), title), listId };
  }, []);

  const pushWorkerState = useCallback(async (next: ReminderMap) => {
    const schedules = Object.entries(next)
      .filter(([, pref]) => pref.enabled)
      .map(([listId, pref]) => {
        const copy = copyFor(listId);
        return {
          listId,
          hour: pref.hour,
          minute: pref.minute,
          daysOfWeek: pref.daysOfWeek,
          timezone: pref.timezone,
          lastFiredDate: pref.lastFiredDate,
          title: copy.title,
          body: copy.body,
        };
      });
    const first = schedules[0];
    await syncReminderWorkerState(
      {
        enabled: schedules.length > 0 && canReceiveShoppingReminder(roleRef.current),
        hour: first?.hour ?? 17,
        minute: first?.minute ?? 0,
        lastFiredDate: first?.lastFiredDate ?? null,
        title: first?.title ?? "",
        body: first?.body ?? "",
        schedules,
      },
      registrationRef.current,
    );
  }, [copyFor]);

  const deliver = useCallback(async (copy: ReminderCopy, asTest: boolean) => {
    const shown = await showShoppingReminder(copy, registrationRef.current);
    const showBanner = !shown || (!asTest && document.visibilityState === "visible");
    setBanner(showBanner ? copy : null);
    return shown;
  }, []);

  const fireIfDue = useCallback(
    async (now = new Date()) => {
      let current = { ...prefsRef.current };
      let fired = false;
      for (const [listId, pref] of Object.entries(current)) {
        if (!shouldFireListReminder(now, pref, roleRef.current)) continue;
        current = { ...current, [listId]: markListReminderFired(pref, now) };
        persist(current);
        await deliver(copyFor(listId), false);
        fired = true;
      }
      if (fired) await pushWorkerState(current);
      return fired;
    },
    [copyFor, deliver, persist, pushWorkerState],
  );

  useEffect(() => {
    if (!allowed) {
      void pauseReminderDelivery();
      return;
    }
    const store = browserStorage();
    const loaded = store ? loadReminderMap(userId, store) : {};
    prefsRef.current = loaded;
    setPrefs(loaded);
    setPermission(notificationPermission());
    setBanner(null);
  }, [allowed, userId]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const arm = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const nextAt = nextEnabledReminderAt(new Date(), prefsRef.current);
      const delay = nextAt ? Math.max(1000, nextAt.getTime() - Date.now()) : 60 * 60 * 1000;
      timeoutId = window.setTimeout(() => {
        void fireIfDue().then(() => {
          if (!cancelled) arm();
        });
      }, Math.min(delay, 2_147_000_000));
    };

    const onVisible = () => {
      setPermission(notificationPermission());
      void fireIfDue();
    };

    const onWorkerFired = (event: MessageEvent) => {
      if (event.data?.type !== "AISLE_REMINDER_FIRED") return;
      const date = typeof event.data.date === "string" ? event.data.date : null;
      const listId = typeof event.data.listId === "string" ? event.data.listId : null;
      if (!date) return;
      const current = { ...prefsRef.current };
      if (listId && current[listId]) {
        persist({ ...current, [listId]: { ...current[listId], lastFiredDate: date } });
        return;
      }
      const next: ReminderMap = {};
      for (const [id, pref] of Object.entries(current)) {
        next[id] = pref.enabled ? { ...pref, lastFiredDate: date } : pref;
      }
      persist(next);
    };

    void (async () => {
      if (Object.values(prefsRef.current).some((pref) => pref.enabled)) {
        registrationRef.current = await registerReminderWorker();
        await pushWorkerState(prefsRef.current);
        await registerPeriodicReminder(registrationRef.current);
      }
      if (cancelled) return;
      await fireIfDue();
      arm();
    })();

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onWorkerFired);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onWorkerFired);
    };
  }, [allowed, fireIfDue, persist, pushWorkerState, userId]);

  const update = useCallback(
    (listId: ListId, patch: Partial<ListReminderPref>) => {
      if (!allowed) return reminderPrefFor(prefsRef.current, listId);
      const current = reminderPrefFor(prefsRef.current, listId);
      const nextPref = { ...current, ...patch };
      const next = { ...prefsRef.current, [listId]: nextPref };
      persist(next);
      void pushWorkerState(next);
      return nextPref;
    },
    [allowed, persist, pushWorkerState],
  );

  const enable = useCallback(
    async (listId: ListId, patch?: Partial<ListReminderPref>) => {
      if (!allowed) return;
      setBusyList(listId);
      setNote(null);
      try {
        const result = await requestReminderPermission();
        setPermission(result);
        registrationRef.current = await registerReminderWorker();
        const current = reminderPrefFor(prefsRef.current, listId);
        const nextPref = { ...current, ...patch, enabled: true };
        const next = { ...prefsRef.current, [listId]: nextPref };
        persist(next);
        await pushWorkerState(next);
        await registerPeriodicReminder(registrationRef.current);
        setNote(noteForPermission(result));
        await fireIfDue();
      } finally {
        setBusyList(null);
      }
    },
    [allowed, fireIfDue, persist, pushWorkerState],
  );

  const disable = useCallback(
    async (listId: ListId) => {
      const nextPref = { ...reminderPrefFor(prefsRef.current, listId), enabled: false };
      const next = { ...prefsRef.current, [listId]: nextPref };
      persist(next);
      await pushWorkerState(next);
      setBanner(null);
      setNote("Reminder off on this device.");
    },
    [persist, pushWorkerState],
  );

  const tryNow = useCallback(
    async (listId: ListId) => {
      if (!allowed || !reminderPrefFor(prefsRef.current, listId).enabled) return;
      const shown = await deliver(copyFor(listId), true);
      setNote(
        shown
          ? "Test notification sent."
          : "Couldn’t show a system notification. Banner below is the fallback.",
      );
    },
    [allowed, copyFor, deliver],
  );

  const dropList = useCallback(
    (listId: ListId) => {
      if (!prefsRef.current[listId]) return;
      const next = { ...prefsRef.current };
      delete next[listId];
      persist(next);
      void pushWorkerState(next);
    },
    [persist, pushWorkerState],
  );

  const enabledCount = Object.values(prefs).filter((pref) => pref.enabled).length;

  return {
    visible: allowed,
    prefs,
    prefFor: (listId: ListId) => reminderPrefFor(prefs, listId),
    enabledCount,
    permission,
    banner,
    note,
    busyList,
    update,
    enable,
    disable,
    tryNow,
    dropList,
    dismissBanner: () => setBanner(null),
  };
}
