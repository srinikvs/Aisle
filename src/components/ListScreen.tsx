import { ChevronLeft } from "lucide-react";
import { listMeta } from "../data/catalogs";
import { needsForList } from "../lib/coverage";
import type { ListId, Need } from "../types";
import { NeedRow } from "./NeedRow";

interface ListScreenProps {
  listId: ListId;
  needs: Need[];
  onBack: () => void;
  onToggle: (id: string) => void;
  onMove: (id: string, listId: ListId) => void;
  onRemove: (id: string) => void;
  onTyped: (text: string) => void;
}

export function ListScreen({
  listId,
  needs,
  onBack,
  onToggle,
  onMove,
  onRemove,
  onTyped,
}: ListScreenProps) {
  const list = listMeta(listId);
  const items = needsForList(listId, needs);
  const open = items.filter((need) => !need.done);
  const done = items.filter((need) => need.done);

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
      {open.length === 0 && done.length === 0 ? (
        <p className="empty">Nothing here yet. Speak a need or type one.</p>
      ) : null}
      {open.map((need) => (
        <NeedRow
          key={need.id}
          need={need}
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
