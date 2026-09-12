import type {
  DraftNeed,
  Invite,
  ListId,
  Membership,
  Need,
  Role,
  Session,
  StoreId,
} from "../types";
import { createLocalBackend } from "./localBackend";

export type BackendKind = "local" | "supabase";

export interface KvStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface AisleBackend {
  readonly kind: BackendKind;
  getSession(): Promise<Session | null>;
  signUp(email: string, password: string, displayName?: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  createHousehold(name: string): Promise<Session>;
  acceptInvite(inviteId: string): Promise<Session>;
  inviteMember(email: string, role: Role): Promise<Invite>;
  revokeInvite(inviteId: string): Promise<void>;
  listMembers(): Promise<Membership[]>;
  listInvites(): Promise<Invite[]>;
  listNeeds(): Promise<Need[]>;
  addDrafts(drafts: readonly DraftNeed[]): Promise<Need[]>;
  toggleNeed(id: string): Promise<Need[]>;
  setNeedList(id: string, listId: ListId): Promise<Need[]>;
  setNeedPin(id: string, storeId: StoreId | null): Promise<Need[]>;
  removeNeed(id: string): Promise<Need[]>;
  importNeeds(needs: readonly Need[]): Promise<Need[]>;
}

export function supabaseConfigured(
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string } | undefined =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & {
          env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
        }).env
      : undefined,
): boolean {
  return Boolean(env?.VITE_SUPABASE_URL?.trim() && env?.VITE_SUPABASE_ANON_KEY?.trim());
}

let singleton: AisleBackend | undefined;

export async function getBackend(): Promise<AisleBackend> {
  if (singleton) return singleton;
  if (supabaseConfigured()) {
    const { createSupabaseBackend } = await import("./supabaseBackend");
    singleton = createSupabaseBackend();
    return singleton;
  }
  singleton = createLocalBackend();
  return singleton;
}

export function resetBackend(): void {
  singleton = undefined;
}
