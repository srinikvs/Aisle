import { ChevronLeft } from "lucide-react";
import { LISTS, storeMeta } from "../data/catalogs";
import { needsForStore } from "../lib/coverage";
import type { Need, StoreId } from "../types";
import { NeedRow } from "./NeedRow";

interface StoreScreenProps {
  storeId: StoreId;
  needs: Need[];
  onBack: () => void;
  onToggle: (id: string) => void;
}

export function StoreScreen({ storeId, needs, onBack, onToggle }: StoreScreenProps) {
  const store = storeMeta(storeId);
  const items = needsForStore(storeId, needs);
  const open = items.filter((need) => !need.done);
  const done = items.filter((need) => need.done);

  return (
    <section>
      <div className="screen-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
        <h2>{store.title}</h2>
      </div>
      <p className="screen-blurb">{store.blurb}</p>
      {open.length === 0 && done.length === 0 ? (
        <p className="empty">No open needs this store can cover.</p>
      ) : null}
      {LISTS.filter((list) => store.covers.includes(list.id)).map((list) => {
        const group = open.filter((need) => need.listId === list.id);
        if (group.length === 0) return null;
        return (
          <div key={list.id}>
            <div className="section">{list.title}</div>
            {group.map((need) => (
              <NeedRow key={need.id} need={need} onToggle={onToggle} />
            ))}
          </div>
        );
      })}
      {done.length > 0 ? <div className="section">Checked off</div> : null}
      {done.map((need) => (
        <NeedRow key={need.id} need={need} showList onToggle={onToggle} />
      ))}
    </section>
  );
}
