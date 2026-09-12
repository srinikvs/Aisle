export const LIST_IDS = ["grocery", "school", "shopping", "travel"] as const;
export type ListId = (typeof LIST_IDS)[number];

export const STORE_IDS = ["costco", "publix", "office-depot"] as const;
export type StoreId = (typeof STORE_IDS)[number];

export type Role = "adult" | "kid";

export interface Need {
  id: string;
  name: string;
  listId: ListId;
  /** When set, Publix / Office Depot only show the item if they match. Costco still sees every open need. */
  pinnedStore: StoreId | null;
  done: boolean;
  createdAt: number;
  /** Account that created the item. Null for pre-account / imported starter rows. */
  addedBy: string | null;
}

export interface Account {
  id: string;
  email: string;
  displayName: string;
}

export interface Household {
  id: string;
  name: string;
}

export interface Membership {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface Invite {
  id: string;
  householdId: string;
  householdName: string;
  email: string;
  role: Role;
  invitedBy: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: number;
}

export interface Session {
  account: Account;
  household: Household | null;
  role: Role | null;
  pendingInvites: Invite[];
}

export interface DraftNeed {
  key: string;
  name: string;
  listId: ListId;
  pinnedStore: StoreId | null;
}

export interface AppState {
  version: 1;
  needs: Need[];
}

export interface ListMeta {
  id: ListId;
  title: string;
  shortTitle: string;
  blurb: string;
}

export interface StoreMeta {
  id: StoreId;
  title: string;
  blurb: string;
  covers: readonly ListId[];
}
