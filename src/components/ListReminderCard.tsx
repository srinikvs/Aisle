import {
  REMINDER_TIMEZONES,
  WEEKDAY_LABELS,
  type ListReminderPref,
} from "../lib/reminder";
import type { ListId } from "../types";

interface ListReminderCardProps {
  listId: ListId;
  pref: ListReminderPref;
  busy?: boolean;
  note?: string | null;
  onChange: (patch: Partial<ListReminderPref>) => void;
  onEnable: () => void;
  onDisable: () => void;
  onTryNow: () => void;
}

function timeValue(pref: ListReminderPref): string {
  return `${String(pref.hour).padStart(2, "0")}:${String(pref.minute).padStart(2, "0")}`;
}

export function ListReminderCard({
  listId,
  pref,
  busy,
  note,
  onChange,
  onEnable,
  onDisable,
  onTryNow,
}: ListReminderCardProps) {
  return (
    <div className="reminder-card stack-card">
      <div className="reminder-copy">
        <strong>List reminder</strong>
        <p>Adults only. Pick a time, days, and an optional timezone for this list.</p>
        {note ? <p className="reminder-note">{note}</p> : null}
      </div>
      <div className="reminder-fields">
        <label>
          Time
          <input
            type="time"
            aria-label={`Reminder time for ${listId}`}
            value={timeValue(pref)}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(":").map(Number);
              onChange({ hour: hour || 0, minute: minute || 0 });
            }}
          />
        </label>
        <label>
          Timezone
          <select
            aria-label={`Reminder timezone for ${listId}`}
            value={pref.timezone ?? ""}
            onChange={(event) => onChange({ timezone: event.target.value || null })}
          >
            {REMINDER_TIMEZONES.map((zone) => (
              <option key={zone.value || "local"} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="day-chips" role="group" aria-label="Days of the week">
        {WEEKDAY_LABELS.map((label, day) => {
          const on = pref.daysOfWeek.includes(day);
          return (
            <button
              key={label}
              type="button"
              className={on ? "day-chip on" : "day-chip"}
              aria-pressed={on}
              onClick={() => {
                const days = on
                  ? pref.daysOfWeek.filter((value) => value !== day)
                  : [...pref.daysOfWeek, day];
                onChange({ daysOfWeek: days });
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="reminder-actions row">
        {pref.enabled ? (
          <>
            <span className="role-badge">On</span>
            <button type="button" className="linkish" onClick={onDisable}>
              Turn off
            </button>
            <button type="button" className="linkish" onClick={onTryNow}>
              Try now
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-btn compact"
            onClick={onEnable}
            disabled={busy}
          >
            {busy ? "…" : "Turn on"}
          </button>
        )}
      </div>
    </div>
  );
}
