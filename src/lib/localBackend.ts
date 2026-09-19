import type {
  Account,
  CustomList,
  Household,
  Invite,
  ListId,
  Membership,
  Need,
  Role,
  Session,
  StoreId,
} from "../types";
import type { AisleBackend, KvStore } from "./backend";
import {
  createCustomList,
  deleteCustomList,
  loadHouseholdCustomLists,
  renameCustomList,
  saveHouseholdCustomLists,
} from "./customLists";
import {
  addDrafts,
  removeNeed,
  setNeedList,
  setNeedPin,
  toggleNeed,
} from "./mutations";
import { canManageCustomLists, canManageHousehold, canMutateNeed, needsForViewer } from "./permissions";
import { isValidEmail, newId, newNeedId, normalizeEmail } from "./storage";

export const LOCAL_DB_KEY = "aisle-accounts-v1";

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

interface StoredNeed extends Need {
  householdId: string;
}

interface LocalDb {
  users: StoredUser[];
  sessionUserId: string | null;
  households: Household[];
  memberships: { householdId: string; userId: string; role: Role }[];
  invites: Invite[];
  needs: StoredNeed[];
}

function emptyDb(): LocalDb {
  return {
    users: [],
    sessionUserId: null,
    households: [],
    memberships: [],
    invites: [],
    needs: [],
  };
}

function defaultStore(): KvStore {
  if (typeof localStorage === "undefined") {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
  }
  return localStorage;
}

async function hashPassword(email: string, password: string): Promise<string> {
  const payload = `${normalizeEmail(email)}:${password}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function displayNameFrom(email: string, displayName?: string): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || "Family member";
}

function requireUser(db: LocalDb): StoredUser {
  const user = db.users.find((entry) => entry.id === db.sessionUserId);
  if (!user) throw new Error("Sign in to continue.");
  return user;
}

function membershipFor(db: LocalDb, userId: string) {
  return db.memberships.find((row) => row.userId === userId);
}

function householdById(db: LocalDb, id: string): Household | undefined {
  return db.households.find((row) => row.id === id);
}

function toAccount(user: StoredUser): Account {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

function pendingForEmail(db: LocalDb, email: string): Invite[] {
  return db.invites
    .filter((invite) => invite.email === email && invite.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);
}

function acceptNewestInvite(db: LocalDb, user: StoredUser): void {
  if (membershipFor(db, user.id)) return;
  const invite = pendingForEmail(db, user.email)[0];
  if (!invite) return;
  db.memberships.push({
    householdId: invite.householdId,
    userId: user.id,
    role: invite.role,
  });
  invite.status = "accepted";
}

function sessionOf(db: LocalDb, user: StoredUser): Session {
  const membership = membershipFor(db, user.id);
  const household = membership ? householdById(db, membership.householdId) ?? null : null;
  return {
    account: toAccount(user),
    household,
    role: membership?.role ?? null,
    pendingInvites: household ? [] : pendingForEmail(db, user.email),
  };
}

function publicNeed(need: StoredNeed): Need {
  return {
    id: need.id,
    name: need.name,
    listId: need.listId,
    pinnedStore: need.pinnedStore,
    done: need.done,
    createdAt: need.createdAt,
    addedBy: need.addedBy,
  };
}

function householdNeeds(db: LocalDb, householdId: string): StoredNeed[] {
  return db.needs.filter((need) => need.householdId === householdId);
}

function visibleNeeds(db: LocalDb, user: StoredUser): Need[] {
  const membership = membershipFor(db, user.id);
  if (!membership) return [];
  return needsForViewer(householdNeeds(db, membership.householdId), user.id, membership.role);
}

function requireMembership(db: LocalDb, user: StoredUser) {
  const membership = membershipFor(db, user.id);
  if (!membership) throw new Error("Join or create a household first.");
  return membership;
}

function requireAdult(db: LocalDb, user: StoredUser) {
  const membership = requireMembership(db, user);
  if (!canManageHousehold(membership.role)) {
    throw new Error("Only adults can manage the household.");
  }
  return membership;
}

function applyMutation(
  db: LocalDb,
  user: StoredUser,
  mutate: (state: { version: 1; needs: Need[] }) => { version: 1; needs: Need[] },
  id?: string,
): Need[] {
  const membership = requireMembership(db, user);
  const stored = householdNeeds(db, membership.householdId);
  if (id) {
    const target = stored.find((need) => need.id === id);
    if (!canMutateNeed(target, user.id, membership.role)) {
      throw new Error("You can only change items you added.");
    }
  }
  const next = mutate({ version: 1, needs: stored.map(publicNeed) });
  const kept = db.needs.filter((need) => need.householdId !== membership.householdId);
  db.needs = [
    ...kept,
    ...next.needs.map((need) => ({ ...need, householdId: membership.householdId })),
  ];
  return visibleNeeds(db, user);
}

export function createLocalBackend(store: KvStore = defaultStore()): AisleBackend {
  const read = (): LocalDb => {
    const parsed = store.getItem(LOCAL_DB_KEY);
    if (!parsed) return emptyDb();
    try {
      return { ...emptyDb(), ...(JSON.parse(parsed) as Partial<LocalDb>) };
    } catch {
      return emptyDb();
    }
  };

  const write = (db: LocalDb): void => {
    store.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  };

  const withDb = <T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> => {
    const db = read();
    return Promise.resolve(fn(db)).then((result) => {
      write(db);
      return result;
    });
  };

  return {
    kind: "local",

    async getSession() {
      const db = read();
      if (!db.sessionUserId) return null;
      const user = db.users.find((entry) => entry.id === db.sessionUserId);
      if (!user) return null;
      acceptNewestInvite(db, user);
      write(db);
      return sessionOf(db, user);
    },

    async signUp(email, password, displayName) {
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      return withDb(async (db) => {
        const normalized = normalizeEmail(email);
        if (db.users.some((user) => user.email === normalized)) {
          throw new Error("An account with that email already exists.");
        }
        const user: StoredUser = {
          id: newId("user"),
          email: normalized,
          passwordHash: await hashPassword(normalized, password),
          displayName: displayNameFrom(normalized, displayName),
        };
        db.users.push(user);
        db.sessionUserId = user.id;
        acceptNewestInvite(db, user);
        return sessionOf(db, user);
      });
    },

    async signIn(email, password) {
      return withDb(async (db) => {
        const normalized = normalizeEmail(email);
        const user = db.users.find((entry) => entry.email === normalized);
        if (!user || user.passwordHash !== (await hashPassword(normalized, password))) {
          throw new Error("Email or password is incorrect.");
        }
        db.sessionUserId = user.id;
        acceptNewestInvite(db, user);
        return sessionOf(db, user);
      });
    },

    async signOut() {
      return withDb((db) => {
        db.sessionUserId = null;
      });
    },

    async createHousehold(name) {
      return withDb((db) => {
        const user = requireUser(db);
        if (membershipFor(db, user.id)) {
          throw new Error("You already belong to a household.");
        }
        const household: Household = {
          id: newId("hh"),
          name: name.trim() || "Family",
        };
        db.households.push(household);
        db.memberships.push({ householdId: household.id, userId: user.id, role: "adult" });
        return sessionOf(db, user);
      });
    },

    async acceptInvite(inviteId) {
      return withDb((db) => {
        const user = requireUser(db);
        if (membershipFor(db, user.id)) {
          throw new Error("You already belong to a household.");
        }
        const invite = db.invites.find((row) => row.id === inviteId);
        if (!invite || invite.status !== "pending" || invite.email !== user.email) {
          throw new Error("This invite is not for your email, or it is no longer valid.");
        }
        db.memberships.push({
          householdId: invite.householdId,
          userId: user.id,
          role: invite.role,
        });
        invite.status = "accepted";
        return sessionOf(db, user);
      });
    },

    async inviteMember(email, role) {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireAdult(db, user);
        if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
        const normalized = normalizeEmail(email);
        if (normalized === user.email) throw new Error("You are already in this household.");
        const existingUser = db.users.find((entry) => entry.email === normalized);
        if (existingUser && membershipFor(db, existingUser.id)?.householdId === membership.householdId) {
          throw new Error("That person is already in this household.");
        }
        const alreadyPending = db.invites.find(
          (invite) =>
            invite.householdId === membership.householdId &&
            invite.email === normalized &&
            invite.status === "pending",
        );
        if (alreadyPending) throw new Error("An invite is already pending for that email.");
        const household = householdById(db, membership.householdId);
        const invite: Invite = {
          id: newId("inv"),
          householdId: membership.householdId,
          householdName: household?.name ?? "Family",
          email: normalized,
          role,
          invitedBy: user.id,
          status: "pending",
          createdAt: Date.now(),
        };
        db.invites.push(invite);
        return invite;
      });
    },

    async revokeInvite(inviteId) {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireAdult(db, user);
        const invite = db.invites.find((row) => row.id === inviteId);
        if (!invite || invite.householdId !== membership.householdId) {
          throw new Error("Invite not found.");
        }
        invite.status = "revoked";
      });
    },

    async listMembers() {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireMembership(db, user);
        const rows = db.memberships.filter((row) => row.householdId === membership.householdId);
        const visible = membership.role === "kid" ? rows.filter((row) => row.userId === user.id) : rows;
        return visible.map((row) => {
          const member = db.users.find((entry) => entry.id === row.userId);
          return {
            userId: row.userId,
            email: member?.email ?? "",
            displayName: member?.displayName ?? "Member",
            role: row.role,
          } satisfies Membership;
        });
      });
    },

    async listInvites() {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireAdult(db, user);
        return db.invites.filter(
          (invite) => invite.householdId === membership.householdId && invite.status === "pending",
        );
      });
    },

    async listNeeds() {
      return withDb((db) => visibleNeeds(db, requireUser(db)));
    },

    async listCustomLists() {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireMembership(db, user);
        if (!canManageCustomLists(membership.role)) return [];
        return loadHouseholdCustomLists(membership.householdId, store);
      });
    },

    async createCustomList(title, blurb = "") {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireMembership(db, user);
        const current = loadHouseholdCustomLists(membership.householdId, store);
        const next = createCustomList(current, title, membership.role, blurb);
        saveHouseholdCustomLists(membership.householdId, next, store);
        return next[next.length - 1] as CustomList;
      });
    },

    async renameCustomList(id, title) {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireMembership(db, user);
        const current = loadHouseholdCustomLists(membership.householdId, store);
        const next = renameCustomList(current, id, title, membership.role);
        saveHouseholdCustomLists(membership.householdId, next, store);
        const renamed = next.find((list) => list.id === id);
        if (!renamed) throw new Error("List not found.");
        return renamed;
      });
    },

    async deleteCustomList(id) {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireMembership(db, user);
        const current = loadHouseholdCustomLists(membership.householdId, store);
        const next = deleteCustomList(current, id, membership.role);
        saveHouseholdCustomLists(membership.householdId, next, store);
        db.needs = db.needs.filter(
          (need) => need.householdId !== membership.householdId || need.listId !== id,
        );
      });
    },

    async addDrafts(drafts) {
      return withDb((db) => {
        const user = requireUser(db);
        return applyMutation(db, user, (state) => addDrafts(state, drafts, user.id));
      });
    },

    async toggleNeed(id) {
      return withDb((db) => applyMutation(db, requireUser(db), (state) => toggleNeed(state, id), id));
    },

    async setNeedList(id, listId: ListId) {
      return withDb((db) => applyMutation(db, requireUser(db), (state) => setNeedList(state, id, listId), id));
    },

    async setNeedPin(id, storeId: StoreId | null) {
      return withDb((db) => applyMutation(db, requireUser(db), (state) => setNeedPin(state, id, storeId), id));
    },

    async removeNeed(id) {
      return withDb((db) => applyMutation(db, requireUser(db), (state) => removeNeed(state, id), id));
    },

    async importNeeds(needs) {
      return withDb((db) => {
        const user = requireUser(db);
        const membership = requireAdult(db, user);
        const incoming: StoredNeed[] = needs
          .filter((need) => need.name.trim().length > 0)
          .map((need) => ({
            ...need,
            id: newNeedId(),
            addedBy: user.id,
            householdId: membership.householdId,
          }));
        db.needs.push(...incoming);
        return visibleNeeds(db, user);
      });
    },
  };
}
