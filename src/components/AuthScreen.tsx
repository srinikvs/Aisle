import { useState } from "react";
import type { BackendKind } from "../lib/backend";
import { APP_VERSION_LABEL } from "../version";

interface AuthScreenProps {
  kind: BackendKind;
  busy: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName?: string) => Promise<void>;
}

export function AuthScreen({ kind, busy, error, onSignIn, onSignUp }: AuthScreenProps) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);
    try {
      if (mode === "in") await onSignIn(email, password);
      else await onSignUp(email, password, displayName);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Could not continue.");
    }
  };

  return (
    <div className="app">
      <header className="brand">
        <h1>Aisle</h1>
        <p className="tagline">
          Sign in so your household can share grocery, school, shopping, and travel
          lists.
        </p>
      </header>

      {kind === "local" ? (
        <p className="mode-note">
          Local demo mode — accounts stay on this device. Set{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to
          share a household across phones.
        </p>
      ) : null}

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "in"}
          className={mode === "in" ? "active" : ""}
          onClick={() => setMode("in")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "up"}
          className={mode === "up" ? "active" : ""}
          onClick={() => setMode("up")}
        >
          Create account
        </button>
      </div>

      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {mode === "up" ? (
          <label>
            Name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              placeholder="Veera"
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@home.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            placeholder="At least 6 characters"
            required
            minLength={6}
          />
        </label>
        {localError || error ? <p className="banner">{localError || error}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
    </div>
  );
}
