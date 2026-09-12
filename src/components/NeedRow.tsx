import { Check, Trash2 } from "lucide-react";
import { LISTS, STORES } from "../data/catalogs";
import type { ListId, Need, StoreId } from "../types";

interface NeedRowProps {
  need: Need;
  showList?: boolean;
  addedByLabel?: string | null;
  onToggle: (id: string) => void;
  onMove?: (id: string, listId: ListId) => void;
  onPin?: (id: string, storeId: StoreId | null) => void;
  onRemove?: (id: string) => void;
}

export function NeedRow({
  need,
  showList,
  addedByLabel,
  onToggle,
  onMove,
  onPin,
  onRemove,
}: NeedRowProps) {
  return (
    <div className={`need${need.done ? " done" : ""}`}>
      <button
        type="button"
        className={`check${need.done ? " on" : ""}`}
        aria-pressed={need.done}
        aria-label={need.done ? `Uncheck ${need.name}` : `Check off ${need.name}`}
        onClick={() => onToggle(need.id)}
      >
        {need.done ? <Check size={16} strokeWidth={2.4} /> : null}
      </button>
      <div className="need-name">
        <div>{need.name}</div>
        {showList ? (
          <div className="need-meta">
            {LISTS.find((list) => list.id === need.listId)?.title}
          </div>
        ) : null}
        {addedByLabel ? <div className="need-meta">Added by {addedByLabel}</div> : null}
      </div>
      <div className="need-tools">
        {onMove ? (
          <select
            aria-label={`Move ${need.name} to another list`}
            value={need.listId}
            onChange={(event) => onMove(need.id, event.target.value as ListId)}
          >
            {LISTS.map((list) => (
              <option key={list.id} value={list.id}>
                {list.shortTitle}
              </option>
            ))}
          </select>
        ) : null}
        {onPin ? (
          <select
            aria-label={`Pin ${need.name} to a store`}
            value={need.pinnedStore ?? ""}
            onChange={(event) =>
              onPin(need.id, (event.target.value || null) as StoreId | null)
            }
          >
            <option value="">Any store</option>
            {STORES.map((store) => (
              <option key={store.id} value={store.id}>
                {store.title}
              </option>
            ))}
          </select>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="ghost"
            aria-label={`Remove ${need.name}`}
            onClick={() => onRemove(need.id)}
          >
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
