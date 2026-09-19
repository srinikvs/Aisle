import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { parseNeeds } from "../lib/parser";
import { createRecognizer, speechSupported, type SpeechStatus } from "../lib/speech";
import type { DraftNeed, ListId, ListMeta } from "../types";
import { ConfirmSheet } from "./ConfirmSheet";

export interface NeedComposerHandle {
  begin: (text: string, listHint?: ListId) => void;
}

interface NeedComposerProps {
  onAdd: (drafts: DraftNeed[]) => void;
  lists?: readonly ListMeta[];
  confirmLabel?: string;
  showBar?: boolean;
  hideStores?: boolean;
}

export const NeedComposer = forwardRef<NeedComposerHandle, NeedComposerProps>(
  function NeedComposer({ onAdd, lists, confirmLabel, showBar = true, hideStores = false }, ref) {
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

    useImperativeHandle(ref, () => ({ begin: beginConfirm }));

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

    return (
      <>
        {showBar ? (
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
                {liveText || "“Milk, notebooks for school, sunscreen for the trip”"}
              </span>
            </span>
          </button>
          <div className="type-row">
            <button type="button" className="linkish" onClick={() => setTyping((value) => !value)}>
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
        ) : null}

        {drafts ? (
          <ConfirmSheet
            drafts={drafts}
            lists={lists}
            confirmLabel={confirmLabel}
            hideStores={hideStores}
            onChange={setDrafts}
            onCancel={() => setDrafts(null)}
            onConfirm={() => {
              onAdd(drafts);
              setDrafts(null);
            }}
          />
        ) : null}
      </>
    );
  },
);
