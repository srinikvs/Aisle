import { createStarterState } from "../data/starter";
import { LIST_IDS, STORE_IDS, type AppState, type Need } from "../types";

export const STORAGE_KEY = "aisle-v1";

function isListId(value: unknown): value is Need["listId"] {
  return typeof value === "string" && (LIST_IDS as readonly string[]).includes(value);
}

function isStoreId(value: unknown): value is Need["pinnedStore"] {
  return value === null || (typeof value === "string" && (STORE_IDS as readonly string[]).includes(value));
}

function isNeed(value: unknown): value is Need {
  if (!value || typeof value !== "object") return false;
  const need = value as Need;
  return (
    typeof need.id === "string" &&
    typeof need.name === "string" &&
    isListId(need.listId) &&
    isStoreId(need.pinnedStore) &&
    typeof need.done === "boolean" &&
    typeof need.createdAt === "number"
  );
}

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.needs)) return null;
    if (!parsed.needs.every(isNeed)) return null;
    return { version: 1, needs: parsed.needs };
  } catch {
    return null;
  }
}

export function loadState(storage: Pick<Storage, "getItem"> = localStorage): AppState {
  return parseState(storage.getItem(STORAGE_KEY)) ?? createStarterState();
}

export function saveState(
  state: AppState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function newNeedId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `need-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
