import type { DraftNeed, Need, Session } from "../types";
import { APP_VERSION_LABEL } from "../version";
import { AccountBar } from "./AccountBar";
import { NeedComposer } from "./NeedComposer";
import { NeedRow } from "./NeedRow";

interface KidHomeProps {
  session: Session;
  needs: Need[];
  error: string | null;
  onAdd: (drafts: DraftNeed[]) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSignOut: () => void;
}

export function KidHome({
  session,
  needs,
  error,
  onAdd,
  onToggle,
  onRemove,
  onSignOut,
}: KidHomeProps) {
  const open = needs.filter((need) => !need.done);
  const done = needs.filter((need) => need.done);

  return (
    <div className="app">
      <header className="brand">
        <h1>Aisle</h1>
        <p className="tagline">Add what you need. Only you see this list.</p>
      </header>
      <AccountBar session={session} onSignOut={onSignOut} />
      <NeedComposer onAdd={onAdd} confirmLabel="Add my items" hideStores />
      {error ? <p className="banner">{error}</p> : null}

      <p className="kid-note">
        Grown-ups see your items on the family lists. You only see what you add.
      </p>

      {open.length === 0 && done.length === 0 ? (
        <p className="empty">Nothing of yours yet. Speak a need or type one.</p>
      ) : null}
      {open.map((need) => (
        <NeedRow
          key={need.id}
          need={need}
          showList
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
      {done.length > 0 ? <div className="section">Checked off</div> : null}
      {done.map((need) => (
        <NeedRow
          key={need.id}
          need={need}
          showList
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
