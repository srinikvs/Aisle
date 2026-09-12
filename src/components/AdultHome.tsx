import { useRef, useState } from "react";
import {
  Backpack,
  Building2,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Warehouse,
} from "lucide-react";
import { LISTS, STORES } from "../data/catalogs";
import { needsForList, needsForStore, openCount } from "../lib/coverage";
import type { DraftNeed, Invite, ListId, Membership, Need, Session, StoreId } from "../types";
import { APP_VERSION_LABEL } from "../version";
import { AccountBar } from "./AccountBar";
import { FamilyScreen } from "./FamilyScreen";
import { ListScreen } from "./ListScreen";
import { NeedComposer, type NeedComposerHandle } from "./NeedComposer";
import { StoreScreen } from "./StoreScreen";

type Tab = "lists" | "runs";

const LIST_ICONS = {
  grocery: ShoppingBasket,
  school: Backpack,
  shopping: ShoppingBag,
  travel: Plane,
} as const;

const STORE_ICONS = {
  costco: Warehouse,
  publix: ShoppingBag,
  "office-depot": Building2,
} as const;

interface AdultHomeProps {
  session: Session;
  needs: Need[];
  members: Membership[];
  invites: Invite[];
  error: string | null;
  busy: boolean;
  onAdd: (drafts: DraftNeed[]) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, listId: ListId) => void;
  onRemove: (id: string) => void;
  onInvite: (email: string, role: "adult" | "kid") => Promise<void>;
  onRevoke: (inviteId: string) => Promise<void>;
  onSignOut: () => void;
  addedByName: (need: Need) => string | null;
}

export function AdultHome({
  session,
  needs,
  members,
  invites,
  error,
  busy,
  onAdd,
  onToggle,
  onMove,
  onRemove,
  onInvite,
  onRevoke,
  onSignOut,
  addedByName,
}: AdultHomeProps) {
  const [tab, setTab] = useState<Tab>("lists");
  const [openList, setOpenList] = useState<ListId | null>(null);
  const [openStore, setOpenStore] = useState<StoreId | null>(null);
  const [family, setFamily] = useState(false);
  const composerRef = useRef<NeedComposerHandle>(null);
  const home = !openList && !openStore && !family;

  return (
    <div className="app">
      {home ? (
        <>
          <header className="brand">
            <h1>Aisle</h1>
            <p className="tagline">
              Speak grocery, school, shopping, and travel. Each list stays its
              own. Walking into Costco, Publix, or Office Depot? We pull what
              that store can cover.
            </p>
          </header>
          <AccountBar
            session={session}
            onFamily={() => setFamily(true)}
            onSignOut={onSignOut}
          />
        </>
      ) : null}

      <NeedComposer ref={composerRef} onAdd={onAdd} showBar={home} />
      {home && error ? <p className="banner">{error}</p> : null}

      {home ? (
        <>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "lists"}
              className={tab === "lists" ? "active" : ""}
              onClick={() => setTab("lists")}
            >
              Lists
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "runs"}
              className={tab === "runs" ? "active" : ""}
              onClick={() => setTab("runs")}
            >
              Store runs
            </button>
          </div>

          {tab === "lists" ? (
            <div className="grid">
              {LISTS.map((list) => {
                const Icon = LIST_ICONS[list.id];
                const count = openCount(needsForList(list.id, needs));
                return (
                  <button
                    key={list.id}
                    type="button"
                    className="tile"
                    onClick={() => setOpenList(list.id)}
                  >
                    <Icon className="tile-icon" strokeWidth={1.6} />
                    <div>
                      <h2>{list.title}</h2>
                      <p>
                        {count} open need{count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid stack">
              {STORES.map((store) => {
                const Icon = STORE_ICONS[store.id];
                const count = openCount(needsForStore(store.id, needs));
                return (
                  <button
                    key={store.id}
                    type="button"
                    className="tile wide"
                    onClick={() => setOpenStore(store.id)}
                  >
                    <Icon className="tile-icon" strokeWidth={1.6} />
                    <div className="tile-copy">
                      <h2>{store.title}</h2>
                      <p>{store.blurb}</p>
                    </div>
                    <span className="tile-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {openList ? (
        <ListScreen
          listId={openList}
          needs={needs}
          addedByName={addedByName}
          onBack={() => setOpenList(null)}
          onToggle={onToggle}
          onMove={onMove}
          onRemove={onRemove}
          onTyped={(text) => composerRef.current?.begin(text, openList)}
        />
      ) : null}

      {openStore ? (
        <StoreScreen
          storeId={openStore}
          needs={needs}
          onBack={() => setOpenStore(null)}
          onToggle={onToggle}
        />
      ) : null}

      {family ? (
        <FamilyScreen
          householdName={session.household?.name ?? "Family"}
          members={members}
          invites={invites}
          busy={busy}
          error={error}
          onBack={() => setFamily(false)}
          onInvite={onInvite}
          onRevoke={onRevoke}
        />
      ) : null}

      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
