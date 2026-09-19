import { openCount } from "../lib/coverage";
import type { ReminderCopy } from "../lib/reminder";
import type { Need } from "../types";

interface ReminderCardProps {
  enabledCount: number;
  banner: ReminderCopy | null;
  note?: string | null;
  needs: readonly Need[];
  showControls?: boolean;
  onDismissBanner: () => void;
}

export function ReminderCard({
  enabledCount,
  banner,
  note,
  needs,
  showControls = true,
  onDismissBanner,
}: ReminderCardProps) {
  return (
    <>
      {showControls ? (
        <div className="reminder-card">
          <div className="reminder-copy">
            <strong>Per-list reminders</strong>
            <p>
              Open any list to set a time, days, and optional timezone. Grocery
              and Store runs stay the same — custom lists sit beside them.
            </p>
            {note ? <p className="reminder-note">{note}</p> : null}
          </div>
          <div className="reminder-actions">
            <span className="role-badge">{enabledCount > 0 ? `On · ${enabledCount}` : "Off"}</span>
          </div>
        </div>
      ) : null}
      {banner ? (
        <div className="reminder-banner" role="status">
          <div>
            <strong>{banner.title}</strong>
            <p>{banner.body}</p>
            {openCount(needs) > 0 && (!banner.listId || banner.listId === "shopping") ? (
              <p>Open Store runs when you’re ready.</p>
            ) : null}
          </div>
          <button type="button" className="linkish light" onClick={onDismissBanner}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}
