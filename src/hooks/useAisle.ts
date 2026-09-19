import { useCallback, useEffect, useState } from "react";
import { getBackend, type AisleBackend, type BackendKind } from "../lib/backend";
import { addedByLabel } from "../lib/permissions";
import {
  markLegacyImported,
  peekLegacyState,
  wasLegacyImported,
} from "../lib/storage";
import type {
  CustomList,
  DraftNeed,
  Invite,
  ListId,
  Membership,
  Need,
  Role,
  Session,
  StoreId,
} from "../types";

export type AisleStatus = "loading" | "signed-out" | "needs-household" | "ready";

export function inviteIdFromSearch(search = window.location.search): string | null {
  return new URLSearchParams(search).get("invite");
}

export function useAisle() {
  const [backend, setBackend] = useState<AisleBackend | null>(null);
  const [status, setStatus] = useState<AisleStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applySession = useCallback(async (next: Session | null, api: AisleBackend) => {
    setSession(next);
    setError(null);
    if (!next) {
      setNeeds([]);
      setCustomLists([]);
      setMembers([]);
      setInvites([]);
      setStatus("signed-out");
      return;
    }
    if (!next.household) {
      setNeeds([]);
      setCustomLists([]);
      setMembers([]);
      setInvites([]);
      setStatus("needs-household");
      return;
    }
    const [listed, lists, householdMembers, pending] = await Promise.all([
      api.listNeeds(),
      next.role === "adult" ? api.listCustomLists() : Promise.resolve([]),
      next.role === "adult" ? api.listMembers() : api.listMembers().catch(() => []),
      next.role === "adult" ? api.listInvites() : Promise.resolve([]),
    ]);
    setNeeds(listed);
    setCustomLists(lists);
    setMembers(householdMembers);
    setInvites(pending);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const api = await getBackend();
        if (cancelled) return;
        setBackend(api);
        const current = await api.getSession();
        if (cancelled) return;
        await applySession(current, api);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not start Aisle.");
          setStatus("signed-out");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    if (!backend || status !== "ready") return;
    const refresh = () => {
      void applySession(session, backend);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [applySession, backend, session, status]);

  const run = useCallback(
    async (fn: (api: AisleBackend) => Promise<void>, rethrow = false) => {
      if (!backend) return;
      setBusy(true);
      setError(null);
      try {
        await fn(backend);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Something went wrong.");
        if (rethrow) throw caught;
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await run(async (api) => {
        const next = await api.signUp(email, password, displayName);
        const inviteId = inviteIdFromSearch();
        const joined =
          !next.household && inviteId ? await api.acceptInvite(inviteId).catch(() => next) : next;
        await applySession(joined, api);
      }, true);
    },
    [applySession, run],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await run(async (api) => {
        const next = await api.signIn(email, password);
        const inviteId = inviteIdFromSearch();
        const joined =
          !next.household && inviteId ? await api.acceptInvite(inviteId).catch(() => next) : next;
        await applySession(joined, api);
      }, true);
    },
    [applySession, run],
  );

  const signOut = useCallback(async () => {
    await run(async (api) => {
      await api.signOut();
      await applySession(null, api);
    });
  }, [applySession, run]);

  const createHousehold = useCallback(
    async (name: string, importLegacy: boolean) => {
      await run(async (api) => {
        const next = await api.createHousehold(name);
        if (importLegacy) {
          const legacy = peekLegacyState();
          if (legacy && !wasLegacyImported()) {
            await api.importNeeds(legacy.needs);
            markLegacyImported();
          }
        }
        await applySession(next, api);
      });
    },
    [applySession, run],
  );

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      await run(async (api) => {
        const next = await api.acceptInvite(inviteId);
        await applySession(next, api);
      });
    },
    [applySession, run],
  );

  const inviteMember = useCallback(
    async (email: string, role: Role) => {
      if (!backend || !session) return;
      await run(async (api) => {
        await api.inviteMember(email, role);
        setInvites(await api.listInvites());
      }, true);
    },
    [backend, run, session],
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      if (!backend) return;
      await run(async (api) => {
        await api.revokeInvite(inviteId);
        setInvites(await api.listInvites());
      });
    },
    [backend, run],
  );

  const mutateNeeds = useCallback(
    async (fn: (api: AisleBackend) => Promise<Need[]>) => {
      if (!backend) return;
      try {
        setNeeds(await fn(backend));
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update the list.");
      }
    },
    [backend],
  );

  const add = useCallback(
    (drafts: readonly DraftNeed[]) => {
      void mutateNeeds((api) => api.addDrafts(drafts));
    },
    [mutateNeeds],
  );
  const toggle = useCallback(
    (id: string) => {
      void mutateNeeds((api) => api.toggleNeed(id));
    },
    [mutateNeeds],
  );
  const move = useCallback(
    (id: string, listId: ListId) => {
      void mutateNeeds((api) => api.setNeedList(id, listId));
    },
    [mutateNeeds],
  );
  const pin = useCallback(
    (id: string, storeId: StoreId | null) => {
      void mutateNeeds((api) => api.setNeedPin(id, storeId));
    },
    [mutateNeeds],
  );
  const remove = useCallback(
    (id: string) => {
      void mutateNeeds((api) => api.removeNeed(id));
    },
    [mutateNeeds],
  );

  const createList = useCallback(
    async (title: string, blurb?: string) => {
      if (!backend) return;
      try {
        const created = await backend.createCustomList(title, blurb);
        setCustomLists(await backend.listCustomLists());
        setError(null);
        return created;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not create the list.");
        throw caught;
      }
    },
    [backend],
  );

  const renameList = useCallback(
    async (id: string, title: string) => {
      if (!backend) return;
      try {
        await backend.renameCustomList(id, title);
        setCustomLists(await backend.listCustomLists());
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not rename the list.");
        throw caught;
      }
    },
    [backend],
  );

  const deleteList = useCallback(
    async (id: string) => {
      if (!backend) return;
      try {
        await backend.deleteCustomList(id);
        setCustomLists(await backend.listCustomLists());
        setNeeds(await backend.listNeeds());
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete the list.");
        throw caught;
      }
    },
    [backend],
  );

  const labelFor = useCallback(
    (need: Need) =>
      session ? addedByLabel(need.addedBy, session.account.id, members) : null,
    [members, session],
  );

  const legacyCount = peekLegacyState()?.needs.length ?? 0;
  const canImportLegacy = legacyCount > 0 && !wasLegacyImported();

  return {
    backendKind: (backend?.kind ?? "local") as BackendKind,
    status,
    session,
    needs,
    customLists,
    members,
    invites,
    error,
    busy,
    canImportLegacy,
    legacyCount,
    signUp,
    signIn,
    signOut,
    createHousehold,
    acceptInvite,
    inviteMember,
    revokeInvite,
    add,
    toggle,
    move,
    pin,
    remove,
    createList,
    renameList,
    deleteList,
    labelFor,
  };
}
