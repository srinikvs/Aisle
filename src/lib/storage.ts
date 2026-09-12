import { createStarterState } from "../data/starter";
import { LIST_IDS, STORE_IDS, type AppState, type Need } from "../types";

export const STORAGE_KEY = "aisle-v1";
export const LEGACY_IMPORT_FLAG = "aisle-v1-imported";

function isListId(value: unknown): value is Need["listId"] {
  return typeof value === "string" && (LIST_IDS as readonly string[]).includes(value);
}

function isStoreId(value: unknown): value is Need["pinnedStore"] {
  return value === null || (typeof value === "string" && (STORE_IDS as readonly string[]).includes(value));
}

function isNeed(value: unknown): value is Need {
  if (!value || typeof value !== "object") return false;
  const need = value as Need;
  const addedByOk =
    need.addedBy === undefined || need.addedBy === null || typeof need.addedBy === "string";
  return (
    typeof need.id === "string" &&
    typeof need.name === "string" &&
    isListId(need.listId) &&
    isStoreId(need.pinnedStore) &&
    typeof need.done === "boolean" &&
    typeof need.createdAt === "number" &&
    addedByOk
  );
}

function normalizeNeed(need: Need): Need {
  return { ...need, addedBy: need.addedBy ?? null };
}

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.needs)) return null;
    if (!parsed.needs.every(isNeed)) return null;
    return { version: 1, needs: parsed.needs.map(normalizeNeed) };
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

export function peekLegacyState(
  storage: Pick<Storage, "getItem"> = localStorage,
): AppState | null {
  return parseState(storage.getItem(STORAGE_KEY));
}

export function wasLegacyImported(
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return storage.getItem(LEGACY_IMPORT_FLAG) === "1";
}

export function markLegacyImported(
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(LEGACY_IMPORT_FLAG, "1");
}

export function newNeedId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `need-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
