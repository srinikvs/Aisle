import {
  isBuiltinListId,
  type BuiltinListId,
  type CustomList,
  type ListId,
  type ListMeta,
  type StoreId,
  type StoreMeta,
} from "../types";

export interface BuiltinListMeta extends ListMeta {
  id: BuiltinListId;
}

export const LISTS: readonly BuiltinListMeta[] = [
  {
    id: "grocery",
    title: "Grocery",
    shortTitle: "Grocery",
    blurb: "Food and kitchen staples.",
  },
  {
    id: "school",
    title: "School supplies",
    shortTitle: "School",
    blurb: "Classroom and homework kit.",
  },
  {
    id: "shopping",
    title: "Shopping",
    shortTitle: "Shopping",
    blurb: "Household and everyday errands.",
  },
  {
    id: "travel",
    title: "Travel",
    shortTitle: "Travel",
    blurb: "Trip extras and packing leftovers.",
  },
] as const;

export const STORES: readonly StoreMeta[] = [
  {
    id: "costco",
    title: "Costco",
    blurb: "Every open need from all four lists.",
    covers: ["grocery", "school", "shopping", "travel"],
  },
  {
    id: "publix",
    title: "Publix",
    blurb: "Food, household, and travel extras — not school supplies.",
    covers: ["grocery", "shopping", "travel"],
  },
  {
    id: "office-depot",
    title: "Office Depot",
    blurb: "School, office, and trip tech — not groceries.",
    covers: ["school", "shopping", "travel"],
  },
] as const;

export function listMeta(id: ListId, customLists: readonly CustomList[] = []): ListMeta {
  const builtin = LISTS.find((list) => list.id === id);
  if (builtin) return builtin;
  const custom = customLists.find((list) => list.id === id);
  if (custom) return custom;
  throw new Error(`Unknown list: ${id}`);
}

export function allLists(customLists: readonly CustomList[] = []): ListMeta[] {
  return [...LISTS, ...customLists];
}

export function storeMeta(id: StoreId): StoreMeta {
  const found = STORES.find((store) => store.id === id);
  if (!found) throw new Error(`Unknown store: ${id}`);
  return found;
}

export function storeCovers(storeId: StoreId, listId: ListId): boolean {
  return isBuiltinListId(listId) && storeMeta(storeId).covers.includes(listId);
}
