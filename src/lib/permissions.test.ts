import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addedByLabel,
  canBrowseHousehold,
  canBrowseStoreRuns,
  canManageHousehold,
  canMutateNeed,
  needsForViewer,
} from "./permissions.ts";
import type { Need } from "../types.ts";

function need(partial: Partial<Need> & Pick<Need, "id" | "addedBy">): Need {
  return {
    name: "Item",
    listId: "shopping",
    pinnedStore: null,
    done: false,
    createdAt: 1,
    ...partial,
  };
}

describe("needsForViewer", () => {
  const adultItem = need({ id: "a", addedBy: "adult-1", name: "Milk", listId: "grocery" });
  const kidItem = need({ id: "k", addedBy: "kid-1", name: "Notebooks", listId: "school" });
  const all = [adultItem, kidItem];

  it("adults see every household item", () => {
    assert.deepEqual(needsForViewer(all, "adult-1", "adult"), all);
  });

  it("kids see only items they added", () => {
    assert.deepEqual(needsForViewer(all, "kid-1", "kid"), [kidItem]);
    assert.deepEqual(needsForViewer(all, "kid-2", "kid"), []);
  });
});

describe("canMutateNeed", () => {
  const item = need({ id: "a", addedBy: "kid-1" });

  it("adults can change any item", () => {
    assert.equal(canMutateNeed(item, "adult-1", "adult"), true);
  });

  it("kids can only change their own items", () => {
    assert.equal(canMutateNeed(item, "kid-1", "kid"), true);
    assert.equal(canMutateNeed(item, "kid-2", "kid"), false);
    assert.equal(canMutateNeed(undefined, "kid-1", "kid"), false);
  });
});

describe("household helpers", () => {
  it("only adults manage the household", () => {
    assert.equal(canManageHousehold("adult"), true);
    assert.equal(canManageHousehold("kid"), false);
    assert.equal(canManageHousehold(null), false);
  });

  it("kids never browse household lists or store runs", () => {
    assert.equal(canBrowseHousehold("adult"), true);
    assert.equal(canBrowseHousehold("kid"), false);
    assert.equal(canBrowseStoreRuns("adult"), true);
    assert.equal(canBrowseStoreRuns("kid"), false);
    assert.equal(canBrowseStoreRuns(null), false);
  });

  it("labels another member’s item for adults", () => {
    assert.equal(
      addedByLabel("kid-1", "adult-1", [{ userId: "kid-1", displayName: "Sam" }]),
      "Sam",
    );
    assert.equal(addedByLabel("adult-1", "adult-1", []), null);
    assert.equal(addedByLabel(null, "adult-1", []), null);
  });
});
