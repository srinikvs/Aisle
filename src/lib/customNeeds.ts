import { isBuiltinListId, type Need } from "../types";
import type { ListKv } from "./customLists";

/**
 * Items on custom lists when the cloud `needs.list_id` check still
 * only allows grocery / school / shopping / travel.
 * Cloud seam: drop this overlay once `needs.list_id` is free text
 * (or a FK to `list_types`) and persist those rows in Postgres.
 */
export const CUSTOM_NEEDS_STORAGE_KEY = "aisle-custom-needs-v1";

type HouseholdNeedStore = Record<string, Need[]>;

function isNeed(value: unknown): value is Need {
  if (!value || typeof value !== "object") return false;
  const need = value as Need;
  return (
    typeof need.id === "string" &&
    typeof need.name === "string" &&
    typeof need.listId === "string" &&
    !isBuiltinListId(need.listId) &&
    (need.pinnedStore === null || typeof need.pinnedStore === "string") &&
    typeof need.done === "boolean" &&
    typeof need.createdAt === "number" &&
    (need.addedBy === null || typeof need.addedBy === "string")
  );
}

export function parseCustomNeedStore(raw: string | null): HouseholdNeedStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: HouseholdNeedStore = {};
    for (const [householdId, needs] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof householdId !== "string" || !Array.isArray(needs)) continue;
      out[householdId] = needs.filter(isNeed);
    }
    return out;
  } catch {
    return {};
  }
}

export function loadHouseholdCustomNeeds(householdId: string, storage: ListKv): Need[] {
  if (!householdId) return [];
  return parseCustomNeedStore(storage.getItem(CUSTOM_NEEDS_STORAGE_KEY))[householdId] ?? [];
}

export function saveHouseholdCustomNeeds(
  householdId: string,
  needs: readonly Need[],
  storage: ListKv,
): Need[] {
  const store = parseCustomNeedStore(storage.getItem(CUSTOM_NEEDS_STORAGE_KEY));
  store[householdId] = needs.filter((need) => !isBuiltinListId(need.listId));
  storage.setItem(CUSTOM_NEEDS_STORAGE_KEY, JSON.stringify(store));
  return store[householdId];
}

export function mergeHouseholdNeeds(builtin: readonly Need[], custom: readonly Need[]): Need[] {
  const seen = new Set(builtin.map((need) => need.id));
  return [...builtin, ...custom.filter((need) => !seen.has(need.id))];
}
