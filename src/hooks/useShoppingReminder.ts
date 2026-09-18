import { useCallback, useEffect, useRef, useState } from "react";
import { openCount } from "../lib/coverage";
import { canReceiveShoppingReminder } from "../lib/permissions";
import {
  REMINDER_HOUR,
  REMINDER_MINUTE,
  REMINDER_MSG_FIRED,
  markReminderFired,
  nextReminderAt,
  notificationPermission,
  notificationsSupported,
  pauseReminderDelivery,
  registerPeriodicReminder,
  registerReminderWorker,
  reminderCopy,
  requestReminderPermission,
  saveReminderPref,
  loadReminderPref,
  shouldFireReminder,
  showShoppingReminder,
  syncReminderWorkerState,
  type ReminderCopy,
  type ReminderPref,
} from "../lib/reminder";
import type { Need, Role } from "../types";

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function useShoppingReminder(
  userId: string,
  role: Role | null,
  needs: readonly Need[],
) {
  const allowed = canReceiveShoppingReminder(role);
  const storage = browserStorage();
  const [pref, setPref] = useState<ReminderPref>(() =>
    allowed && storage ? loadReminderPref(userId, storage) : { enabled: false, lastFiredDate: null },
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    notificationsSupported() ? notificationPermission() : "unsupported",
  );
  const [banner, setBanner] = useState<ReminderCopy | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const prefRef = useRef(pref);
  const needsRef = useRef(needs);
  const roleRef = useRef(role);
  const userIdRef = useRef(userId);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  prefRef.current = pref;
  needsRef.current = needs;
  roleRef.current = role;
  userIdRef.current = userId;

  const persist = useCallback((next: ReminderPref) => {
    prefRef.current = next;
    setPref(next);
    const store = browserStorage();
    if (store && userIdRef.current) saveReminderPref(userIdRef.current, next, store);
  }, []);

  const pushWorkerState = useCallback(async (next: ReminderPref) => {
    const copy = reminderCopy(openCount(needsRef.current));
    await syncReminderWorkerState(
      {
        enabled: next.enabled && canReceiveShoppingReminder(roleRef.current),
        hour: REMINDER_HOUR,
        minute: REMINDER_MINUTE,
        lastFiredDate: next.lastFiredDate,
        title: copy.title,
        body: copy.body,
      },
      registrationRef.current,
    );
  }, []);

  const deliver = useCallback(async (copy: ReminderCopy, asTest: boolean) => {
    const shown = await showShoppingReminder(copy, registrationRef.current);
    const showBanner = !shown || (!asTest && document.visibilityState === "visible");
    setBanner(showBanner ? copy : null);
    return shown;
  }, []);

  const fireIfDue = useCallback(
    async (now = new Date()) => {
      if (!shouldFireReminder(now, prefRef.current, roleRef.current)) return false;
      const copy = reminderCopy(openCount(needsRef.current));
      persist(markReminderFired(prefRef.current, now));
      await pushWorkerState({ ...prefRef.current });
      await deliver(copy, false);
      return true;
    },
    [deliver, persist, pushWorkerState],
  );

  useEffect(() => {
    if (!allowed) {
      void pauseReminderDelivery();
      return;
    }
    const store = browserStorage();
    const loaded = store ? loadReminderPref(userId, store) : { enabled: false, lastFiredDate: null };
    prefRef.current = loaded;
    setPref(loaded);
    setPermission(notificationPermission());
    setBanner(null);
  }, [allowed, userId]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const arm = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const delay = Math.max(1000, nextReminderAt(new Date()).getTime() - Date.now());
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
      if (event.data?.type !== REMINDER_MSG_FIRED) return;
      const date = typeof event.data.date === "string" ? event.data.date : null;
      if (!date) return;
      persist({ ...prefRef.current, lastFiredDate: date });
    };

    void (async () => {
      if (prefRef.current.enabled) {
        registrationRef.current = await registerReminderWorker();
        await pushWorkerState(prefRef.current);
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

  const enable = useCallback(async () => {
    if (!allowed) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await requestReminderPermission();
      setPermission(result);
      registrationRef.current = await registerReminderWorker();
      const next = { ...prefRef.current, enabled: true };
      persist(next);
      await pushWorkerState(next);
      await registerPeriodicReminder(registrationRef.current);
      if (result === "granted") {
        setNote("On. We’ll nudge you around 5:00 PM local when this browser can deliver it.");
      } else if (result === "denied") {
        setNote(
          "Notifications are blocked. If Aisle is open at 5pm, you’ll see a banner instead.",
        );
      } else if (result === "unsupported") {
        setNote("This browser can’t send notifications. You’ll get a banner if Aisle is open at 5pm.");
      } else {
        setNote("On. Allow notifications when asked, or keep Aisle open for an in-app banner.");
      }
      await fireIfDue();
    } finally {
      setBusy(false);
    }
  }, [allowed, fireIfDue, persist, pushWorkerState]);

  const disable = useCallback(async () => {
    const next = { ...prefRef.current, enabled: false };
    persist(next);
    await pushWorkerState(next);
    setBanner(null);
    setNote("Reminder off on this device.");
  }, [persist, pushWorkerState]);

  const tryNow = useCallback(async () => {
    if (!allowed || !prefRef.current.enabled) return;
    const shown = await deliver(reminderCopy(openCount(needsRef.current)), true);
    setNote(
      shown
        ? "Test notification sent."
        : "Couldn’t show a system notification. Banner below is the fallback.",
    );
  }, [allowed, deliver]);

  return {
    visible: allowed,
    enabled: pref.enabled,
    permission,
    banner,
    note,
    busy,
    enable,
    disable,
    tryNow,
    dismissBanner: () => setBanner(null),
  };
}
