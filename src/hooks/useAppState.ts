import { useCallback, useEffect, useState } from "react";
import { addDrafts, removeNeed, setNeedList, setNeedPin, toggleNeed } from "../lib/mutations";
import { loadState, saveState } from "../lib/storage";
import type { AppState, DraftNeed, ListId, StoreId } from "../types";

export function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggle = useCallback((id: string) => {
    setState((current) => toggleNeed(current, id));
  }, []);

  const add = useCallback((drafts: readonly DraftNeed[]) => {
    setState((current) => addDrafts(current, drafts));
  }, []);

  const move = useCallback((id: string, listId: ListId) => {
    setState((current) => setNeedList(current, id, listId));
  }, []);

  const pin = useCallback((id: string, storeId: StoreId | null) => {
    setState((current) => setNeedPin(current, id, storeId));
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => removeNeed(current, id));
  }, []);

  return { state, toggle, add, move, pin, remove };
}
