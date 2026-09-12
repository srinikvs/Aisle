import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStarterState } from "../data/starter.ts";
import { addDrafts, toggleNeed } from "./mutations.ts";
import { parseState } from "./storage.ts";

describe("mutations", () => {
  it("toggles the same need everywhere (single source of truth)", () => {
    const start = createStarterState();
    const id = "starter-milk";
    const after = toggleNeed(start, id);
    const item = after.needs.find((need) => need.id === id);
    assert.equal(item?.done, true);
    const undone = toggleNeed(after, id);
    assert.equal(undone.needs.find((need) => need.id === id)?.done, false);
  });

  it("skips duplicate open items on the same list", () => {
    const start = createStarterState();
    const next = addDrafts(start, [
      { key: "a", name: "Milk", listId: "grocery", pinnedStore: null },
    ]);
    assert.equal(next.needs.length, start.needs.length);
  });

  it("round-trips JSON state", () => {
    const start = createStarterState();
    const restored = parseState(JSON.stringify(start));
    assert.deepEqual(restored, start);
  });

  it("accepts pre-account needs without addedBy and stamps the creator on add", () => {
    const restored = parseState(
      JSON.stringify({
        version: 1,
        needs: [
          {
            id: "legacy-1",
            name: "Milk",
            listId: "grocery",
            pinnedStore: null,
            done: false,
            createdAt: 1,
          },
        ],
      }),
    );
    assert.equal(restored?.needs[0]?.addedBy, null);
    const next = addDrafts(
      restored ?? createStarterState(),
      [{ key: "a", name: "Eggs", listId: "grocery", pinnedStore: null }],
      "user-1",
    );
    assert.equal(next.needs.find((need) => need.name === "Eggs")?.addedBy, "user-1");
  });
});
