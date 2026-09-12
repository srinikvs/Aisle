import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import type { Invite, Membership, Role } from "../types";

interface FamilyScreenProps {
  householdName: string;
  members: Membership[];
  invites: Invite[];
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onInvite: (email: string, role: Role) => Promise<void>;
  onRevoke: (inviteId: string) => Promise<void>;
}

function inviteUrl(inviteId: string): string {
  const url = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  url.searchParams.set("invite", inviteId);
  return url.toString();
}

export function FamilyScreen({
  householdName,
  members,
  invites,
  busy,
  error,
  onBack,
  onInvite,
  onRevoke,
}: FamilyScreenProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("kid");
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <section>
      <div className="screen-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
        <h2>Family</h2>
      </div>
      <p className="screen-blurb">
        {householdName} — adults see every list and store run. Kids only see
        items they add — no Store runs.
      </p>

      <div className="section">People</div>
      {members.map((member) => (
        <div className="member-row" key={member.userId}>
          <div>
            <strong>{member.displayName}</strong>
            <div className="need-meta">{member.email}</div>
          </div>
          <span className="role-badge">{member.role === "kid" ? "Kid" : "Adult"}</span>
        </div>
      ))}

      <div className="section">Invite by email</div>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onInvite(email, role)
            .then(() => setEmail(""))
            .catch(() => {});
        }}
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="kid@home.com"
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="kid">Kid — add items, see only their own, no Store runs</option>
            <option value="adult">Adult — full lists and store runs</option>
          </select>
        </label>
        {error ? <p className="banner">{error}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Working…" : "Send invite"}
        </button>
      </form>

      {invites.length > 0 ? <div className="section">Pending</div> : null}
      {invites.map((invite) => (
        <div className="member-row" key={invite.id}>
          <div>
            <strong>{invite.email}</strong>
            <div className="need-meta">
              {invite.role === "kid" ? "Kid" : "Adult"} · they sign up with this email
            </div>
          </div>
          <div className="account-actions">
            <button
              type="button"
              className="linkish"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl(invite.id)).then(() => {
                  setCopied(invite.id);
                });
              }}
            >
              {copied === invite.id ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className="linkish"
              onClick={() => void onRevoke(invite.id)}
            >
              Revoke
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
