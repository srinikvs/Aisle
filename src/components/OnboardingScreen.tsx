import { useState } from "react";
import type { Invite, Session } from "../types";
import { APP_VERSION_LABEL } from "../version";
import { AccountBar } from "./AccountBar";

interface OnboardingScreenProps {
  session: Session;
  busy: boolean;
  error: string | null;
  canImportLegacy: boolean;
  legacyCount: number;
  onCreate: (name: string, importLegacy: boolean) => Promise<void>;
  onAccept: (inviteId: string) => Promise<void>;
  onSignOut: () => void;
}

export function OnboardingScreen({
  session,
  busy,
  error,
  canImportLegacy,
  legacyCount,
  onCreate,
  onAccept,
  onSignOut,
}: OnboardingScreenProps) {
  const [name, setName] = useState("Family");
  const [importLegacy, setImportLegacy] = useState(canImportLegacy);
  const invites: Invite[] = session.pendingInvites;

  return (
    <div className="app">
      <header className="brand">
        <h1>Aisle</h1>
        <p className="tagline">Join your household or start a new one.</p>
      </header>
      <AccountBar session={session} onSignOut={onSignOut} />

      {invites.length > 0 ? (
        <section className="panel">
          <h2>Invites</h2>
          <p className="panel-copy">An adult invited this email to share their lists.</p>
          {invites.map((invite) => (
            <div className="member-row" key={invite.id}>
              <div>
                <strong>{invite.householdName}</strong>
                <div className="need-meta">
                  Join as {invite.role === "kid" ? "a kid" : "an adult"}
                </div>
              </div>
              <button
                type="button"
                className="primary-btn compact"
                disabled={busy}
                onClick={() => void onAccept(invite.id)}
              >
                Join
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel">
        <h2>Start a household</h2>
        <p className="panel-copy">
          You become the first adult. Invite family next — kids only see items they add.
        </p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate(name, importLegacy);
          }}
        >
          <label>
            Household name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Family"
            />
          </label>
          {canImportLegacy ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={importLegacy}
                onChange={(event) => setImportLegacy(event.target.checked)}
              />
              Import {legacyCount} item{legacyCount === 1 ? "" : "s"} saved on this
              device
            </label>
          ) : (
            <p className="panel-copy">
              Lists on this device stay local unless you import them here. You can
              also start fresh.
            </p>
          )}
          {error ? <p className="banner">{error}</p> : null}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Working…" : "Create household"}
          </button>
        </form>
      </section>
      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
