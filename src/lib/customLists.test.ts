import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUSTOM_LISTS_STORAGE_KEY,
  createCustomList,
  deleteCustomList,
  isCustomListId,
  loadHouseholdCustomLists,
  parseCustomListStore,
  renameCustomList,
  saveHouseholdCustomLists,
} from "./customLists.ts";
import { createLocalBackend } from "./localBackend.ts";
import type { KvStore } from "./backend.ts";

function memoryStore(): KvStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("createCustomList", () => {
  it("creates a named list beside the built-ins", () => {
    const next = createCustomList([], "International travel to-do", "adult", "Packing");
    assert.equal(next.length, 1);
    assert.equal(next[0]?.title, "International travel to-do");
    assert.equal(next[0]?.blurb, "Packing");
    assert.ok(isCustomListId(next[0]?.id ?? ""));
  });

  it("rejects kids, blank names, reserved names, and duplicates", () => {
    assert.throws(() => createCustomList([], "Work to-do", "kid"), /Only adults/);
    assert.throws(() => createCustomList([], "Work to-do", null), /Only adults/);
    assert.throws(() => createCustomList([], "   ", "adult"), /Give the list a name/);
    assert.throws(() => createCustomList([], "Grocery", "adult"), /reserved/);
    assert.throws(() => createCustomList([], "School supplies", "adult"), /reserved/);
    const once = createCustomList([], "Work to-do", "adult");
    assert.throws(() => createCustomList(once, "work to-do", "adult"), /already exists/);
  });
});

describe("renameCustomList and deleteCustomList", () => {
  it("renames a custom list and refuses built-ins", () => {
    const [list] = createCustomList([], "Work to-do", "adult");
    assert.ok(list);
    const renamed = renameCustomList([list], list.id, "Office to-do", "adult");
    assert.equal(renamed[0]?.title, "Office to-do");
    assert.throws(() => renameCustomList([list], "grocery", "Nope", "adult"), /cannot be renamed/);
    assert.throws(() => renameCustomList([list], list.id, "Travel", "adult"), /reserved/);
    assert.throws(() => renameCustomList([list], list.id, "Office to-do", "kid"), /Only adults/);
  });

  it("deletes a custom list", () => {
    const lists = createCustomList([], "Work to-do", "adult");
    const id = lists[0]?.id ?? "";
    assert.deepEqual(deleteCustomList(lists, id, "adult"), []);
    assert.throws(() => deleteCustomList(lists, "shopping", "adult"), /cannot be renamed/);
    assert.throws(() => deleteCustomList(lists, id, "kid"), /Only adults/);
    assert.throws(() => deleteCustomList([], "custom-missing", "adult"), /not found/);
  });
});

describe("custom list persistence", () => {
  it("round-trips per household and ignores junk", () => {
    const storage = memoryStore();
    const lists = createCustomList([], "Work to-do", "adult");
    saveHouseholdCustomLists("hh-1", lists, storage);
    assert.deepEqual(loadHouseholdCustomLists("hh-1", storage), lists);
    assert.deepEqual(loadHouseholdCustomLists("hh-2", storage), []);
    assert.ok(storage.getItem(CUSTOM_LISTS_STORAGE_KEY)?.includes("Work to-do"));
    assert.deepEqual(parseCustomListStore("not-json"), {});
    assert.deepEqual(parseCustomListStore('{"hh":[{"id":"nope"}]}'), { hh: [] });
  });
});

describe("local backend list management", () => {
  it("lets adults create, rename, and delete lists; kids cannot", async () => {
    const store = memoryStore();
    const adultApi = createLocalBackend(store);
    await adultApi.signUp("parent@home.com", "secret1", "Parent");
    await adultApi.createHousehold("Home");
    const created = await adultApi.createCustomList("Work to-do", "Desk items");
    assert.equal(created.title, "Work to-do");
    assert.ok(isCustomListId(created.id));

    await adultApi.addDrafts([
      { key: "w", name: "Stand-up notes", listId: created.id, pinnedStore: null },
    ]);
    assert.equal((await adultApi.listNeeds()).filter((need) => need.listId === created.id).length, 1);

    const renamed = await adultApi.renameCustomList(created.id, "Office to-do");
    assert.equal(renamed.title, "Office to-do");
    assert.equal((await adultApi.listCustomLists())[0]?.title, "Office to-do");

    const invite = await adultApi.inviteMember("kid@home.com", "kid");
    assert.equal(invite.role, "kid");

    const kidApi = createLocalBackend(store);
    await kidApi.signUp("kid@home.com", "secret1", "Kid");
    assert.deepEqual(await kidApi.listCustomLists(), []);
    await assert.rejects(() => kidApi.createCustomList("Secret list"), /Only adults/);
    await assert.rejects(() => kidApi.renameCustomList(created.id, "Nope"), /Only adults/);
    await assert.rejects(() => kidApi.deleteCustomList(created.id), /Only adults/);

    await adultApi.signIn("parent@home.com", "secret1");
    await adultApi.deleteCustomList(created.id);
    assert.deepEqual(await adultApi.listCustomLists(), []);
    assert.equal(
      (await adultApi.listNeeds()).some((need) => need.listId === created.id),
      false,
    );
  });
});
