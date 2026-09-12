import type { AppState, DraftNeed, ListId, Need, StoreId } from "../types";
import { newNeedId } from "./storage";

export function toggleNeed(state: AppState, id: string): AppState {
  return {
    ...state,
    needs: state.needs.map((need) =>
      need.id === id ? { ...need, done: !need.done } : need,
    ),
  };
}

export function addDrafts(state: AppState, drafts: readonly DraftNeed[]): AppState {
  const now = Date.now();
  const incoming: Need[] = drafts
    .map((draft) => ({
      id: newNeedId(),
      name: draft.name.trim(),
      listId: draft.listId,
      pinnedStore: draft.pinnedStore,
      done: false,
      createdAt: now,
    }))
    .filter((need) => need.name.length > 0);

  if (incoming.length === 0) return state;

  const existingKeys = new Set(
    state.needs
      .filter((need) => !need.done)
      .map((need) => `${need.listId}:${need.name.toLowerCase()}`),
  );

  const unique = incoming.filter((need) => {
    const key = `${need.listId}:${need.name.toLowerCase()}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  return { ...state, needs: [...state.needs, ...unique] };
}

export function setNeedList(state: AppState, id: string, listId: ListId): AppState {
  return {
    ...state,
    needs: state.needs.map((need) =>
      need.id === id ? { ...need, listId } : need,
    ),
  };
}

export function setNeedPin(state: AppState, id: string, pinnedStore: StoreId | null): AppState {
  return {
    ...state,
    needs: state.needs.map((need) =>
      need.id === id ? { ...need, pinnedStore } : need,
    ),
  };
}

export function removeNeed(state: AppState, id: string): AppState {
  return { ...state, needs: state.needs.filter((need) => need.id !== id) };
}
