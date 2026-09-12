import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStarterState } from "../data/starter.ts";
import { needsForStore, openCount, storeSeesNeed } from "./coverage.ts";
import type { Need } from "../types.ts";

function need(partial: Partial<Need> & Pick<Need, "listId">): Need {
  return {
    id: partial.id ?? "n",
    name: partial.name ?? "Item",
    listId: partial.listId,
    pinnedStore: partial.pinnedStore ?? null,
    done: partial.done ?? false,
    createdAt: 1,
    addedBy: partial.addedBy ?? null,
  };
}

describe("store coverage", () => {
  it("Costco sees every list; Publix skips school; Office Depot skips grocery", () => {
    const grocery = need({ listId: "grocery" });
    const school = need({ listId: "school" });
    const shopping = need({ listId: "shopping" });
    const travel = need({ listId: "travel" });

    assert.equal(storeSeesNeed("costco", grocery), true);
    assert.equal(storeSeesNeed("costco", school), true);
    assert.equal(storeSeesNeed("publix", school), false);
    assert.equal(storeSeesNeed("publix", grocery), true);
    assert.equal(storeSeesNeed("office-depot", grocery), false);
    assert.equal(storeSeesNeed("office-depot", school), true);
    assert.equal(storeSeesNeed("office-depot", shopping), true);
    assert.equal(storeSeesNeed("office-depot", travel), true);
  });

  it("pins hide an item from the other specialty stores, not Costco", () => {
    const pinned = need({ listId: "shopping", pinnedStore: "publix" });
    assert.equal(storeSeesNeed("costco", pinned), true);
    assert.equal(storeSeesNeed("publix", pinned), true);
    assert.equal(storeSeesNeed("office-depot", pinned), false);
  });

  it("starter data gives Costco 12 open needs", () => {
    const { needs } = createStarterState();
    assert.equal(openCount(needsForStore("costco", needs)), 12);
    assert.equal(openCount(needsForStore("publix", needs)), 9);
    assert.equal(openCount(needsForStore("office-depot", needs)), 9);
  });
});
