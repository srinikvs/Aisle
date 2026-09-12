import { useEffect, useRef, useState } from "react";
import {
  Backpack,
  Building2,
  Mic,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Warehouse,
} from "lucide-react";
import { ConfirmSheet } from "./components/ConfirmSheet";
import { ListScreen } from "./components/ListScreen";
import { StoreScreen } from "./components/StoreScreen";
import { LISTS, STORES } from "./data/catalogs";
import { useAppState } from "./hooks/useAppState";
import { needsForList, needsForStore, openCount } from "./lib/coverage";
import { parseNeeds } from "./lib/parser";
import { createRecognizer, speechSupported, type SpeechStatus } from "./lib/speech";
import type { DraftNeed, ListId, StoreId } from "./types";
import { APP_VERSION_LABEL } from "./version";

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

export function App() {
  const { state, toggle, add, move, remove } = useAppState();
  const [tab, setTab] = useState<Tab>("lists");
  const [openList, setOpenList] = useState<ListId | null>(null);
  const [openStore, setOpenStore] = useState<StoreId | null>(null);
  const [drafts, setDrafts] = useState<DraftNeed[] | null>(null);
  const [typing, setTyping] = useState(false);
  const [typeValue, setTypeValue] = useState("");
  const [speech, setSpeech] = useState<SpeechStatus>(
    speechSupported() ? "idle" : "unsupported",
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const recognitionRef = useRef<ReturnType<typeof createRecognizer>>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const beginConfirm = (text: string, listHint?: ListId) => {
    const parsed = parseNeeds(text, listHint);
    if (parsed.length === 0) {
      setBanner("Nothing to add. Try milk, notebooks for school, sunscreen for the trip.");
      return;
    }
    setBanner(null);
    setDrafts(parsed);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setSpeech(speechSupported() ? "idle" : "unsupported");
  };

  const startListening = () => {
    setBanner(null);
    setLiveText("");
    const recognition = createRecognizer({
      onTranscript: (text, isFinal) => {
        setLiveText(text);
        if (isFinal && text) beginConfirm(text);
      },
      onEnd: () => {
        setSpeech(speechSupported() ? "idle" : "unsupported");
        recognitionRef.current = null;
      },
      onError: (message) => {
        setSpeech("error");
        setBanner(message);
        setTyping(true);
      },
    });
    if (!recognition) {
      setSpeech("unsupported");
      setTyping(true);
      setBanner("Voice isn’t available here. Type a need instead.");
      return;
    }
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setSpeech("listening");
    } catch {
      setTyping(true);
      setBanner("Could not start the microphone. Type a need instead.");
    }
  };

  const onMic = () => {
    if (speech === "listening") {
      stopListening();
      if (liveText) beginConfirm(liveText);
      return;
    }
    startListening();
  };

  const home = !openList && !openStore;

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

          <div className="mic-wrap">
            <button
              type="button"
              className={`mic-pill${speech === "listening" ? " listening" : ""}`}
              onClick={onMic}
            >
              <span className="mic-icon">
                <Mic size={22} />
              </span>
              <span className="mic-copy">
                <strong>
                  {speech === "listening" ? "Listening… tap to stop" : "Tap to speak a need"}
                </strong>
                <span>
                  {liveText ||
                    "“Milk, notebooks for school, sunscreen for the trip”"}
                </span>
              </span>
            </button>
            <div className="type-row">
              <button type="button" className="linkish" onClick={() => setTyping((v) => !v)}>
                {typing ? "Hide typing" : "Type instead"}
              </button>
            </div>
            {typing ? (
              <form
                className="type-box"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!typeValue.trim()) return;
                  beginConfirm(typeValue);
                  setTypeValue("");
                }}
              >
                <input
                  value={typeValue}
                  onChange={(event) => setTypeValue(event.target.value)}
                  placeholder="Milk, notebooks for school…"
                  autoComplete="off"
                />
                <button type="submit">Sort</button>
              </form>
            ) : null}
            {banner ? <p className="banner">{banner}</p> : null}
          </div>

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
                const count = openCount(needsForList(list.id, state.needs));
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
                const count = openCount(needsForStore(store.id, state.needs));
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
          needs={state.needs}
          onBack={() => setOpenList(null)}
          onToggle={toggle}
          onMove={move}
          onRemove={remove}
          onTyped={(text) => beginConfirm(text, openList)}
        />
      ) : null}

      {openStore ? (
        <StoreScreen
          storeId={openStore}
          needs={state.needs}
          onBack={() => setOpenStore(null)}
          onToggle={toggle}
        />
      ) : null}

      {drafts ? (
        <ConfirmSheet
          drafts={drafts}
          onChange={setDrafts}
          onCancel={() => setDrafts(null)}
          onConfirm={() => {
            add(drafts);
            setDrafts(null);
          }}
        />
      ) : null}

      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
