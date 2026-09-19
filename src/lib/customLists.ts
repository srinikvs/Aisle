import type { CustomList, Role } from "../types";
import { LIST_IDS } from "../types";
import { canManageCustomLists } from "./permissions";
import { newId } from "./storage";

/**
 * On-device custom list types, keyed by household.
 * Demo backend and Supabase both use this until a `list_types` table exists.
 * Cloud seam: swap load/save for household-scoped rows
 * (household_id, id, title, blurb, created_at) when auth schema is ready.
 */
export const CUSTOM_LISTS_STORAGE_KEY = "aisle-custom-lists-v1";
export const CUSTOM_LIST_ID_PREFIX = "custom-";

export type HouseholdListStore = Record<string, CustomList[]>;
export type ListKv = Pick<Storage, "getItem" | "setItem">;

const BUILTIN_TITLES = new Set([
  "grocery",
  "school",
  "school supplies",
  "shopping",
  "travel",
]);

export function isCustomListId(id: string): boolean {
  return id.startsWith(CUSTOM_LIST_ID_PREFIX);
}

export function normalizeListTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

function shortTitleFrom(title: string): string {
  return title.length > 18 ? `${title.slice(0, 16).trimEnd()}…` : title;
}

function titleKey(title: string): string {
  return normalizeListTitle(title).toLowerCase();
}

function assertAdult(role: Role | null): void {
  if (!canManageCustomLists(role)) {
    throw new Error("Only adults can manage lists.");
  }
}

function assertNameAvailable(lists: readonly CustomList[], title: string, ignoreId?: string): string {
  const name = normalizeListTitle(title);
  if (!name) throw new Error("Give the list a name.");
  if (BUILTIN_TITLES.has(name.toLowerCase()) || (LIST_IDS as readonly string[]).includes(name.toLowerCase())) {
    throw new Error("That name is reserved for a built-in list.");
  }
  const taken = lists.some(
    (list) => list.id !== ignoreId && titleKey(list.title) === name.toLowerCase(),
  );
  if (taken) throw new Error("A list with that name already exists.");
  return name;
}

export function newCustomListId(): string {
  return `${CUSTOM_LIST_ID_PREFIX}${newId("list")}`;
}

export function createCustomList(
  lists: readonly CustomList[],
  title: string,
  role: Role | null,
  blurb = "",
  now = Date.now(),
): CustomList[] {
  assertAdult(role);
  const name = assertNameAvailable(lists, title);
  const list: CustomList = {
    id: newCustomListId(),
    title: name,
    shortTitle: shortTitleFrom(name),
    blurb: blurb.trim() || "A custom list for this household.",
    createdAt: now,
  };
  return [...lists, list];
}

export function renameCustomList(
  lists: readonly CustomList[],
  id: string,
  title: string,
  role: Role | null,
): CustomList[] {
  assertAdult(role);
  if (!isCustomListId(id)) {
    throw new Error("Built-in lists cannot be renamed or deleted.");
  }
  const current = lists.find((list) => list.id === id);
  if (!current) throw new Error("List not found.");
  const name = assertNameAvailable(lists, title, id);
  return lists.map((list) =>
    list.id === id
      ? { ...list, title: name, shortTitle: shortTitleFrom(name) }
      : list,
  );
}

export function deleteCustomList(
  lists: readonly CustomList[],
  id: string,
  role: Role | null,
): CustomList[] {
  assertAdult(role);
  if (!isCustomListId(id)) {
    throw new Error("Built-in lists cannot be renamed or deleted.");
  }
  if (!lists.some((list) => list.id === id)) {
    throw new Error("List not found.");
  }
  return lists.filter((list) => list.id !== id);
}

function isCustomList(value: unknown): value is CustomList {
  if (!value || typeof value !== "object") return false;
  const list = value as CustomList;
  return (
    typeof list.id === "string" &&
    isCustomListId(list.id) &&
    typeof list.title === "string" &&
    typeof list.shortTitle === "string" &&
    typeof list.blurb === "string" &&
    typeof list.createdAt === "number"
  );
}

export function parseCustomListStore(raw: string | null): HouseholdListStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: HouseholdListStore = {};
    for (const [householdId, lists] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof householdId !== "string" || !Array.isArray(lists)) continue;
      out[householdId] = lists.filter(isCustomList);
    }
    return out;
  } catch {
    return {};
  }
}

export function loadHouseholdCustomLists(householdId: string, storage: ListKv): CustomList[] {
  if (!householdId) return [];
  return parseCustomListStore(storage.getItem(CUSTOM_LISTS_STORAGE_KEY))[householdId] ?? [];
}

export function saveHouseholdCustomLists(
  householdId: string,
  lists: readonly CustomList[],
  storage: ListKv,
): CustomList[] {
  const store = parseCustomListStore(storage.getItem(CUSTOM_LISTS_STORAGE_KEY));
  store[householdId] = [...lists];
  storage.setItem(CUSTOM_LISTS_STORAGE_KEY, JSON.stringify(store));
  return store[householdId];
}
