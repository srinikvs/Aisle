import type { Need, Role } from "../types";

/** Kids only see items they added. Adults see the shared household. */
export function needsForViewer(
  needs: readonly Need[],
  viewerId: string,
  role: Role,
): Need[] {
  if (role === "kid") {
    return needs.filter((need) => need.addedBy === viewerId);
  }
  return [...needs];
}

export function canManageHousehold(role: Role | null): boolean {
  return role === "adult";
}

export function canBrowseHousehold(role: Role | null): boolean {
  return role === "adult";
}

/** Locked: kids never see Costco / Publix / Office Depot store-run UI. */
export function canBrowseStoreRuns(role: Role | null): boolean {
  return role === "adult";
}

/** Locked: only adults get the 5pm open-items / store-run reminder. */
export function canReceiveShoppingReminder(role: Role | null): boolean {
  return role === "adult";
}

export function canMutateNeed(
  need: Need | undefined,
  viewerId: string,
  role: Role,
): boolean {
  if (!need) return false;
  if (role === "adult") return true;
  return need.addedBy === viewerId;
}

export function addedByLabel(
  addedBy: string | null,
  viewerId: string,
  members: readonly { userId: string; displayName: string }[],
): string | null {
  if (!addedBy || addedBy === viewerId) return null;
  return members.find((member) => member.userId === addedBy)?.displayName ?? null;
}
