import { storeMeta } from "../data/catalogs";
import { isBuiltinListId, type Need, type StoreId } from "../types";

/** Costco sees every open need from the four built-in lists. Custom lists stay off Store runs. */
export function storeSeesNeed(storeId: StoreId, need: Need): boolean {
  if (!isBuiltinListId(need.listId)) return false;
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
