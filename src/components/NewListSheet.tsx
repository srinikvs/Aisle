import { useState } from "react";

interface NewListSheetProps {
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onCreate: (title: string, blurb: string) => Promise<void> | void;
}

export function NewListSheet({ busy, error, onCancel, onCreate }: NewListSheetProps) {
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="sheet"
        role="dialog"
        aria-labelledby="new-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="new-list-title">New list</h3>
        <p>Name a list that sits beside Grocery, School, Shopping, and Travel.</p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate(title, blurb);
          }}
        >
          <label>
            List name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="International travel to-do"
              autoComplete="off"
              autoFocus
            />
          </label>
          <label>
            Note (optional)
            <input
              value={blurb}
              onChange={(event) => setBlurb(event.target.value)}
              placeholder="What this list is for"
              autoComplete="off"
            />
          </label>
          {error ? <p className="banner">{error}</p> : null}
          <div className="sheet-actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || !title.trim()}>
              {busy ? "…" : "Create list"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
