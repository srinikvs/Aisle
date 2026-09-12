import { LISTS, STORES } from "../data/catalogs";
import type { DraftNeed, ListId, StoreId } from "../types";

interface ConfirmSheetProps {
  drafts: DraftNeed[];
  onChange: (drafts: DraftNeed[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSheet({
  drafts,
  onChange,
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  const update = (key: string, patch: Partial<DraftNeed>) => {
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  };

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="sheet"
        role="dialog"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-title">Confirm the sort</h3>
        <p>Move an item to another list or store before adding.</p>
        {drafts.map((draft) => (
          <div className="draft" key={draft.key}>
            <input
              type="text"
              value={draft.name}
              aria-label="Item name"
              onChange={(event) => update(draft.key, { name: event.target.value })}
            />
            <div className="draft-row">
              <select
                aria-label="List"
                value={draft.listId}
                onChange={(event) =>
                  update(draft.key, { listId: event.target.value as ListId })
                }
              >
                {LISTS.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Store"
                value={draft.pinnedStore ?? ""}
                onChange={(event) =>
                  update(draft.key, {
                    pinnedStore: (event.target.value || null) as StoreId | null,
                  })
                }
              >
                <option value="">Any covering store</option>
                {STORES.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={drafts.every((draft) => !draft.name.trim())}
          >
            Add to lists
          </button>
        </div>
      </div>
    </div>
  );
}
