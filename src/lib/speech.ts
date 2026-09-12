export type SpeechStatus = "unsupported" | "idle" | "listening" | "error";

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

export function createRecognizer(handlers: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): SpeechRecognitionLike | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    let text = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      text += result[0]?.transcript ?? "";
      if (result.isFinal) isFinal = true;
    }
    handlers.onTranscript(text.trim(), isFinal);
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") {
      handlers.onEnd();
      return;
    }
    handlers.onError(
      event.error === "not-allowed"
        ? "Microphone blocked. Type a need instead."
        : "Could not hear that. Try again or type it.",
    );
  };
  recognition.onend = () => handlers.onEnd();
  return recognition;
}
