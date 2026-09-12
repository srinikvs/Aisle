import { AdultHome } from "./components/AdultHome";
import { AuthScreen } from "./components/AuthScreen";
import { KidHome } from "./components/KidHome";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { useAisle } from "./hooks/useAisle";
import { APP_VERSION_LABEL } from "./version";

export function App() {
  const aisle = useAisle();

  if (aisle.status === "loading") {
    return (
      <div className="app">
        <header className="brand">
          <h1>Aisle</h1>
          <p className="tagline">Opening your household…</p>
        </header>
        <footer className="version">Aisle {APP_VERSION_LABEL}</footer>
      </div>
    );
  }

  if (aisle.status === "signed-out" || !aisle.session) {
    return (
      <AuthScreen
        kind={aisle.backendKind}
        busy={aisle.busy}
        error={aisle.error}
        onSignIn={aisle.signIn}
        onSignUp={aisle.signUp}
      />
    );
  }

  if (aisle.status === "needs-household") {
    return (
      <OnboardingScreen
        session={aisle.session}
        busy={aisle.busy}
        error={aisle.error}
        canImportLegacy={aisle.canImportLegacy}
        legacyCount={aisle.legacyCount}
        onCreate={aisle.createHousehold}
        onAccept={aisle.acceptInvite}
        onSignOut={() => void aisle.signOut()}
      />
    );
  }

  if (aisle.session.role === "kid") {
    return (
      <KidHome
        session={aisle.session}
        needs={aisle.needs}
        error={aisle.error}
        onAdd={aisle.add}
        onToggle={aisle.toggle}
        onRemove={aisle.remove}
        onSignOut={() => void aisle.signOut()}
      />
    );
  }

  return (
    <AdultHome
      session={aisle.session}
      needs={aisle.needs}
      members={aisle.members}
      invites={aisle.invites}
      error={aisle.error}
      busy={aisle.busy}
      onAdd={aisle.add}
      onToggle={aisle.toggle}
      onMove={aisle.move}
      onRemove={aisle.remove}
      onInvite={aisle.inviteMember}
      onRevoke={aisle.revokeInvite}
      onSignOut={() => void aisle.signOut()}
      addedByName={aisle.labelFor}
    />
  );
}
