import { storeMeta } from "../data/catalogs";
import type { Need, StoreId } from "../types";

/** Costco sees every open need. Other stores honor list coverage and an optional pin. */
export function storeSeesNeed(storeId: StoreId, need: Need): boolean {
  const store = storeMeta(storeId);
  if (!store.covers.includes(need.listId)) return false;
  if (storeId === "costco") return true;
  if (need.pinnedStore && need.pinnedStore !== storeId) return false;
  return true;
}

export function needsForStore(storeId: StoreId, needs: readonly Need[]): Need[] {
  return needs.filter((need) => storeSeesNeed(storeId, need));
}

export function openCount(needs: readonly Need[]): number {
  return needs.filter((need) => !need.done).length;
}

export function needsForList(listId: Need["listId"], needs: readonly Need[]): Need[] {
  return needs.filter((need) => need.listId === listId);
}
