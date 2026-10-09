import { useRef, useState } from "react";
import {
  Backpack,
  Building2,
  CirclePlus,
  List,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Warehouse,
} from "lucide-react";
import { STORES, allLists, listMeta } from "../data/catalogs";
import { useListReminders } from "../hooks/useListReminders";
import { needsForList, needsForStore, openCount } from "../lib/coverage";
import { isCustomListId } from "../lib/customLists";
import type {
  CustomList,
  DraftNeed,
  Invite,
  ListId,
  Membership,
  Need,
  Session,
  StoreId,
} from "../types";
import { APP_VERSION_LABEL } from "../version";
import { AccountBar } from "./AccountBar";
import { FamilyScreen } from "./FamilyScreen";
import { ListScreen } from "./ListScreen";
import { NeedComposer, type NeedComposerHandle } from "./NeedComposer";
import { NewListSheet } from "./NewListSheet";
import { ReminderCard } from "./ReminderCard";
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
  customLists: CustomList[];
  members: Membership[];
  invites: Invite[];
  error: string | null;
  busy: boolean;
  onAdd: (drafts: DraftNeed[]) => void;
  onToggle: (id: string) => void;
  onMove: (id: string, listId: ListId) => void;
  onRemove: (id: string) => void;
  onCreateList: (title: string, blurb?: string) => Promise<CustomList | void>;
  onRenameList: (id: string, title: string) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onInvite: (email: string, role: "adult" | "kid") => Promise<void>;
  onRevoke: (inviteId: string) => Promise<void>;
  onSignOut: () => void;
  addedByName: (need: Need) => string | null;
}

export function AdultHome({
  session,
  needs,
  customLists,
  members,
  invites,
  error,
  busy,
  onAdd,
  onToggle,
  onMove,
  onRemove,
  onCreateList,
  onRenameList,
  onDeleteList,
  onInvite,
  onRevoke,
  onSignOut,
  addedByName,
}: AdultHomeProps) {
  const [tab, setTab] = useState<Tab>("lists");
  const [openList, setOpenList] = useState<ListId | null>(null);
  const [openStore, setOpenStore] = useState<StoreId | null>(null);
  const [family, setFamily] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const composerRef = useRef<NeedComposerHandle>(null);
  const home = !openList && !openStore && !family;
  const lists = allLists(customLists);
  const reminders = useListReminders(session.account.id, session.role, needs, customLists);

  return (
    <div className="app">
      {home ? (
        <>
          <header className="brand">
            <h1>Aisle</h1>
            <p className="tagline">
              Speak grocery, school, shopping, and travel — or add a list of
              your own. Walking into Costco, Publix, or Office Depot? We pull
              what that store can cover.
            </p>
          </header>
          <AccountBar
            session={session}
            onFamily={() => setFamily(true)}
            onSignOut={onSignOut}
          />
        </>
      ) : null}

      <ReminderCard
        enabledCount={reminders.enabledCount}
        banner={reminders.banner}
        note={home ? reminders.note : null}
        needs={needs}
        showControls={home}
        onDismissBanner={reminders.dismissBanner}
      />
      <NeedComposer ref={composerRef} lists={lists} onAdd={onAdd} showBar={home} />
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
              {lists.map((list) => {
                const Icon = isCustomListId(list.id)
                  ? List
                  : LIST_ICONS[list.id as keyof typeof LIST_ICONS];
                const count = openCount(needsForList(list.id, needs));
                const reminderOn = reminders.prefFor(list.id).enabled;
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
                        {reminderOn ? " · reminder on" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                className="tile new-list"
                onClick={() => {
                  setCreateError(null);
                  setCreating(true);
                }}
              >
                <CirclePlus className="tile-icon" strokeWidth={1.6} />
                <div>
                  <h2>New list</h2>
                  <p>Work to-do, trip prep, anything named.</p>
                </div>
              </button>
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
          key={openList}
          list={listMeta(openList, customLists)}
          lists={lists}
          needs={needs}
          reminder={reminders.prefFor(openList)}
          reminderBusy={reminders.busyList === openList}
          reminderNote={reminders.note}
          onBack={() => setOpenList(null)}
          onToggle={onToggle}
          onMove={onMove}
          onRemove={onRemove}
          onTyped={(text) => composerRef.current?.begin(text, openList)}
          onRename={
            isCustomListId(openList)
              ? async (title) => {
                  await onRenameList(openList, title);
                }
              : undefined
          }
          onDelete={
            isCustomListId(openList)
              ? async () => {
                  await onDeleteList(openList);
                  reminders.dropList(openList);
                  setOpenList(null);
                }
              : undefined
          }
          onReminderChange={(patch) => reminders.update(openList, patch)}
          onReminderEnable={() => void reminders.enable(openList)}
          onReminderDisable={() => void reminders.disable(openList)}
          onReminderTryNow={() => void reminders.tryNow(openList)}
          addedByName={addedByName}
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

      {creating ? (
        <NewListSheet
          busy={busy}
          error={createError}
          onCancel={() => setCreating(false)}
          onCreate={async (title, blurb) => {
            setCreateError(null);
            try {
              const created = await onCreateList(title, blurb);
              setCreating(false);
              if (created) setOpenList(created.id);
            } catch (caught) {
              setCreateError(caught instanceof Error ? caught.message : "Could not create the list.");
            }
          }}
        />
      ) : null}

      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
