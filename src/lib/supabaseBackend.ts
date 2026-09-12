import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
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
import type { AisleBackend } from "./backend";
import { addDrafts } from "./mutations";
import { isValidEmail, normalizeEmail } from "./storage";

interface NeedRow {
  id: string;
  household_id: string;
  added_by: string | null;
  name: string;
  list_id: ListId;
  pinned_store: StoreId | null;
  done: boolean;
  created_at: string;
}

function asRole(value: string): Role {
  return value === "kid" ? "kid" : "adult";
}

function rowToNeed(row: NeedRow): Need {
  return {
    id: row.id,
    name: row.name,
    listId: row.list_id,
    pinnedStore: row.pinned_store,
    done: row.done,
    createdAt: Date.parse(row.created_at) || Date.now(),
    addedBy: row.added_by,
  };
}

function messageOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (message) return message.replace(/^ERROR:\s*/i, "").split("\n")[0] ?? fallback;
  }
  return fallback;
}

export function createSupabaseBackend(
  url: string = (import.meta as ImportMeta & { env: { VITE_SUPABASE_URL: string } }).env
    .VITE_SUPABASE_URL,
  anonKey: string = (import.meta as ImportMeta & { env: { VITE_SUPABASE_ANON_KEY: string } }).env
    .VITE_SUPABASE_ANON_KEY,
): AisleBackend {
  const supabase: SupabaseClient = createClient(url, anonKey);

  const loadSession = async (user: User | null): Promise<Session | null> => {
    if (!user) return null;
    await supabase.rpc("aisle_accept_pending");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", user.id)
      .maybeSingle();
    const email = normalizeEmail(profile?.email ?? user.email ?? "");
    const account = {
      id: user.id,
      email,
      displayName: profile?.display_name || email.split("@")[0] || "Family member",
    };
    const { data: membership } = await supabase
      .from("memberships")
      .select("role, household_id")
      .eq("user_id", user.id)
      .maybeSingle();
    let household = null;
    if (membership?.household_id) {
      const { data: row } = await supabase
        .from("households")
        .select("id, name")
        .eq("id", membership.household_id)
        .maybeSingle();
      if (row) household = { id: row.id as string, name: (row.name as string) || "Family" };
    }
    let pendingInvites: Invite[] = [];
    if (!household) {
      const { data: invites } = await supabase
        .from("invites")
        .select("id, household_id, email, role, invited_by, status, created_at")
        .eq("email", email)
        .eq("status", "pending");
      pendingInvites = (invites ?? []).map((invite) => ({
        id: invite.id as string,
        householdId: invite.household_id as string,
        householdName: "Family",
        email: invite.email as string,
        role: asRole(String(invite.role)),
        invitedBy: invite.invited_by as string,
        status: "pending" as const,
        createdAt: Date.parse(String(invite.created_at)) || Date.now(),
      }));
    }
    return {
      account,
      household,
      role: membership ? asRole(String(membership.role)) : null,
      pendingInvites,
    };
  };

  const currentUser = async (): Promise<User> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Sign in to continue.");
    return data.user;
  };

  const currentNeeds = async (): Promise<Need[]> => {
    const { data, error } = await supabase
      .from("needs")
      .select("id, household_id, added_by, name, list_id, pinned_store, done, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(messageOf(error, "Could not load needs."));
    return (data as NeedRow[]).map(rowToNeed);
  };

  const requireHousehold = async () => {
    const session = await loadSession((await currentUser()) ?? null);
    if (!session?.household || !session.role) {
      throw new Error("Join or create a household first.");
    }
    return session;
  };

  return {
    kind: "supabase",

    async getSession() {
      const { data } = await supabase.auth.getUser();
      return loadSession(data.user);
    },

    async signUp(email, password, displayName) {
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: { data: { display_name: displayName?.trim() || undefined } },
      });
      if (error) throw new Error(messageOf(error, "Could not create the account."));
      if (!data.user) throw new Error("Check your email to confirm the account, then sign in.");
      if (!data.session) {
        throw new Error("Check your email to confirm the account, then sign in.");
      }
      const session = await loadSession(data.user);
      if (!session) throw new Error("Could not create the account.");
      return session;
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error || !data.user) throw new Error("Email or password is incorrect.");
      const session = await loadSession(data.user);
      if (!session) throw new Error("Email or password is incorrect.");
      return session;
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async createHousehold(name) {
      const { error } = await supabase.rpc("aisle_create_household", {
        p_name: name.trim() || "Family",
      });
      if (error) throw new Error(messageOf(error, "Could not create the household."));
      const session = await loadSession(await currentUser());
      if (!session) throw new Error("Could not create the household.");
      return session;
    },

    async acceptInvite(inviteId) {
      const { error } = await supabase.rpc("aisle_accept_invite", { p_invite_id: inviteId });
      if (error) throw new Error(messageOf(error, "Could not accept the invite."));
      const session = await loadSession(await currentUser());
      if (!session) throw new Error("Could not accept the invite.");
      return session;
    },

    async inviteMember(email, role) {
      if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
      const { data, error } = await supabase.rpc("aisle_invite_member", {
        p_email: normalizeEmail(email),
        p_role: role,
      });
      if (error) throw new Error(messageOf(error, "Could not send the invite."));
      const session = await requireHousehold();
      return {
        id: String(data),
        householdId: session.household!.id,
        householdName: session.household!.name,
        email: normalizeEmail(email),
        role,
        invitedBy: session.account.id,
        status: "pending",
        createdAt: Date.now(),
      };
    },

    async revokeInvite(inviteId) {
      const { error } = await supabase.rpc("aisle_revoke_invite", { p_invite_id: inviteId });
      if (error) throw new Error(messageOf(error, "Could not revoke the invite."));
    },

    async listMembers() {
      const session = await requireHousehold();
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, role")
        .eq("household_id", session.household!.id);
      if (error) throw new Error(messageOf(error, "Could not load household members."));
      const ids = (data ?? []).map((row) => row.user_id as string);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, email, display_name").in("id", ids)
        : { data: [] };
      const byId = new Map(
        (profiles ?? []).map((profile) => [
          profile.id as string,
          profile as { id: string; email: string; display_name: string },
        ]),
      );
      return (data ?? []).map((row) => {
        const profile = byId.get(row.user_id as string);
        return {
          userId: row.user_id as string,
          email: profile?.email ?? "",
          displayName: profile?.display_name ?? "Member",
          role: asRole(String(row.role)),
        } satisfies Membership;
      });
    },

    async listInvites() {
      const session = await requireHousehold();
      const { data, error } = await supabase
        .from("invites")
        .select("id, household_id, email, role, invited_by, status, created_at")
        .eq("household_id", session.household!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw new Error(messageOf(error, "Could not load invites."));
      return (data ?? []).map(
        (invite) =>
          ({
            id: invite.id as string,
            householdId: invite.household_id as string,
            householdName: session.household!.name,
            email: invite.email as string,
            role: asRole(String(invite.role)),
            invitedBy: invite.invited_by as string,
            status: "pending",
            createdAt: Date.parse(String(invite.created_at)) || Date.now(),
          }) satisfies Invite,
      );
    },

    async listNeeds() {
      await requireHousehold();
      return currentNeeds();
    },

    async addDrafts(drafts: readonly DraftNeed[]) {
      const session = await requireHousehold();
      const next = addDrafts({ version: 1, needs: [] }, drafts, session.account.id);
      if (next.needs.length === 0) return currentNeeds();
      const { error } = await supabase.from("needs").insert(
        next.needs.map((need) => ({
          household_id: session.household!.id,
          added_by: session.account.id,
          name: need.name,
          list_id: need.listId,
          pinned_store: need.pinnedStore,
          done: false,
        })),
      );
      if (error) throw new Error(messageOf(error, "Could not add items."));
      return currentNeeds();
    },

    async toggleNeed(id) {
      const needs = await currentNeeds();
      const target = needs.find((need) => need.id === id);
      if (!target) throw new Error("You can only change items you added.");
      const { error } = await supabase.from("needs").update({ done: !target.done }).eq("id", id);
      if (error) throw new Error(messageOf(error, "You can only change items you added."));
      return currentNeeds();
    },

    async setNeedList(id, listId) {
      const { error } = await supabase.from("needs").update({ list_id: listId }).eq("id", id);
      if (error) throw new Error(messageOf(error, "You can only change items you added."));
      return currentNeeds();
    },

    async setNeedPin(id, storeId) {
      const { error } = await supabase.from("needs").update({ pinned_store: storeId }).eq("id", id);
      if (error) throw new Error(messageOf(error, "You can only change items you added."));
      return currentNeeds();
    },

    async removeNeed(id) {
      const { error } = await supabase.from("needs").delete().eq("id", id);
      if (error) throw new Error(messageOf(error, "You can only change items you added."));
      return currentNeeds();
    },

    async importNeeds(needs) {
      const session = await requireHousehold();
      if (session.role !== "adult") throw new Error("Only adults can manage the household.");
      const rows = needs
        .filter((need) => need.name.trim().length > 0)
        .map((need) => ({
          household_id: session.household!.id,
          added_by: session.account.id,
          name: need.name,
          list_id: need.listId,
          pinned_store: need.pinnedStore,
          done: need.done,
          created_at: new Date(need.createdAt).toISOString(),
        }));
      if (rows.length === 0) return currentNeeds();
      const { error } = await supabase.from("needs").insert(rows);
      if (error) throw new Error(messageOf(error, "Could not import items."));
      return currentNeeds();
    },
  };
}
