import type { ListId, ListMeta, StoreId, StoreMeta } from "../types";

export const LISTS: readonly ListMeta[] = [
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

export function listMeta(id: ListId): ListMeta {
  const found = LISTS.find((list) => list.id === id);
  if (!found) throw new Error(`Unknown list: ${id}`);
  return found;
}

export function storeMeta(id: StoreId): StoreMeta {
  const found = STORES.find((store) => store.id === id);
  if (!found) throw new Error(`Unknown store: ${id}`);
  return found;
}

export function storeCovers(storeId: StoreId, listId: ListId): boolean {
  return storeMeta(storeId).covers.includes(listId);
}
