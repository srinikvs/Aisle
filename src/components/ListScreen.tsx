import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { needsForList } from "../lib/coverage";
import { isCustomListId } from "../lib/customLists";
import type { ListReminderPref } from "../lib/reminder";
import type { ListId, ListMeta, Need } from "../types";
import { ListReminderCard } from "./ListReminderCard";
import { NeedRow } from "./NeedRow";

interface ListScreenProps {
  list: ListMeta;
  lists: readonly ListMeta[];
  needs: Need[];
  reminder: ListReminderPref;
  reminderBusy?: boolean;
  reminderNote?: string | null;
  onBack: () => void;
  onToggle: (id: string) => void;
  onMove: (id: string, listId: ListId) => void;
  onRemove: (id: string) => void;
  onTyped: (text: string) => void;
  onRename?: (title: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onReminderChange: (patch: Partial<ListReminderPref>) => void;
  onReminderEnable: () => void;
  onReminderDisable: () => void;
  onReminderTryNow: () => void;
  addedByName?: (need: Need) => string | null;
}

export function ListScreen({
  list,
  lists,
  needs,
  reminder,
  reminderBusy,
  reminderNote,
  onBack,
  onToggle,
  onMove,
  onRemove,
  onTyped,
  onRename,
  onDelete,
  onReminderChange,
  onReminderEnable,
  onReminderDisable,
  onReminderTryNow,
  addedByName,
}: ListScreenProps) {
  const items = needsForList(list.id, needs);
  const open = items.filter((need) => !need.done);
  const done = items.filter((need) => need.done);
  const custom = isCustomListId(list.id);
  const [rename, setRename] = useState(list.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <section>
      <div className="screen-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
        <h2>{list.title}</h2>
      </div>
      <p className="screen-blurb">{list.blurb}</p>
      <TypeLine
        placeholder={`Add to ${list.shortTitle.toLowerCase()}…`}
        onSubmit={onTyped}
      />
      <ListReminderCard
        listId={list.id}
        pref={reminder}
        busy={reminderBusy}
        note={reminderNote}
        onChange={onReminderChange}
        onEnable={onReminderEnable}
        onDisable={onReminderDisable}
        onTryNow={onReminderTryNow}
      />
      {custom ? (
        <div className="list-manage">
          <form
            className="type-box"
            onSubmit={(event) => {
              event.preventDefault();
              if (!onRename || !rename.trim() || rename.trim() === list.title) return;
              setBusy(true);
              void Promise.resolve(onRename(rename)).finally(() => setBusy(false));
            }}
          >
            <input
              value={rename}
              onChange={(event) => setRename(event.target.value)}
              aria-label="Rename list"
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !rename.trim()}>
              Rename
            </button>
          </form>
          {confirmDelete ? (
            <div className="delete-confirm">
              <p>Delete this list and its items? Grocery and Store runs stay as they are.</p>
              <button
                type="button"
                className="linkish danger"
                onClick={() => {
                  if (!onDelete) return;
                  setBusy(true);
                  void Promise.resolve(onDelete()).finally(() => setBusy(false));
                }}
              >
                Delete list
              </button>
              <button type="button" className="linkish" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="linkish danger" onClick={() => setConfirmDelete(true)}>
              Delete list
            </button>
          )}
        </div>
      ) : null}
      {open.length === 0 && done.length === 0 ? (
        <p className="empty">Nothing here yet. Speak a need or type one.</p>
      ) : null}
      {open.map((need) => (
        <NeedRow
          key={need.id}
          need={need}
          lists={lists}
          addedByLabel={addedByName?.(need)}
          onToggle={onToggle}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
      {done.length > 0 ? <div className="section">Checked off</div> : null}
      {done.map((need) => (
        <NeedRow
          key={need.id}
          need={need}
          lists={lists}
          addedByLabel={addedByName?.(need)}
          onToggle={onToggle}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
    </section>
  );
}

function TypeLine({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
}) {
  return (
    <form
      className="type-box"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("need") as HTMLInputElement;
        const value = input.value.trim();
        if (!value) return;
        onSubmit(value);
        input.value = "";
      }}
    >
      <input name="need" placeholder={placeholder} autoComplete="off" />
      <button type="submit">Add</button>
    </form>
  );
}
