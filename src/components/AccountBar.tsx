import type { Role, Session } from "../types";

interface AccountBarProps {
  session: Session;
  onFamily?: () => void;
  onSignOut: () => void;
}

function roleLabel(role: Role | null): string {
  return role === "kid" ? "Kid" : "Adult";
}

export function AccountBar({ session, onFamily, onSignOut }: AccountBarProps) {
  return (
    <div className="account-bar">
      <div className="account-who">
        <strong>{session.account.displayName}</strong>
        <span>
          {session.account.email}
          {session.role ? ` · ${roleLabel(session.role)}` : ""}
          {session.household ? ` · ${session.household.name}` : ""}
        </span>
      </div>
      <div className="account-actions">
        {onFamily ? (
          <button type="button" className="linkish" onClick={onFamily}>
            Family
          </button>
        ) : null}
        <button type="button" className="linkish" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
