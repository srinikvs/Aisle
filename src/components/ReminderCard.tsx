import { openCount } from "../lib/coverage";
import { useShoppingReminder } from "../hooks/useShoppingReminder";
import type { Need, Role } from "../types";

interface ReminderCardProps {
  userId: string;
  role: Role | null;
  needs: readonly Need[];
  showControls?: boolean;
}

export function ReminderCard({ userId, role, needs, showControls = true }: ReminderCardProps) {
  const reminder = useShoppingReminder(userId, role, needs);
  if (!reminder.visible) return null;

  return (
    <>
      {showControls ? (
        <div className="reminder-card">
          <div className="reminder-copy">
            <strong>5pm shopping reminder</strong>
            <p>
              Around 5:00 PM local, we’ll nudge you to review open items and store
              runs. Kids never get this prompt.
            </p>
            {reminder.note ? <p className="reminder-note">{reminder.note}</p> : null}
          </div>
          <div className="reminder-actions">
            {reminder.enabled ? (
              <>
                <span className="role-badge">On</span>
                <button type="button" className="linkish" onClick={() => void reminder.disable()}>
                  Turn off
                </button>
                <button type="button" className="linkish" onClick={() => void reminder.tryNow()}>
                  Try now
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-btn compact"
                onClick={() => void reminder.enable()}
                disabled={reminder.busy}
              >
                {reminder.busy ? "…" : "Turn on"}
              </button>
            )}
          </div>
        </div>
      ) : null}
      {reminder.banner ? (
        <div className="reminder-banner" role="status">
          <div>
            <strong>{reminder.banner.title}</strong>
            <p>{reminder.banner.body}</p>
            {openCount(needs) > 0 ? <p>Open Store runs when you’re ready.</p> : null}
          </div>
          <button type="button" className="linkish light" onClick={reminder.dismissBanner}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}
