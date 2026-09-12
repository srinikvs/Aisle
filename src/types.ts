export const LIST_IDS = ["grocery", "school", "shopping", "travel"] as const;
export type ListId = (typeof LIST_IDS)[number];

export const STORE_IDS = ["costco", "publix", "office-depot"] as const;
export type StoreId = (typeof STORE_IDS)[number];

export interface Need {
  id: string;
  name: string;
  listId: ListId;
  /** When set, Publix / Office Depot only show the item if they match. Costco still sees every open need. */
  pinnedStore: StoreId | null;
  done: boolean;
  createdAt: number;
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
