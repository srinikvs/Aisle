import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLocalBackend } from "./localBackend.ts";
import { parseState } from "./storage.ts";
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

describe("local household backend", () => {
  it("signs up, creates a household, and signs back in", async () => {
    const backend = createLocalBackend(memoryStore());
    const created = await backend.signUp("Adult@Home.com", "secret1", "Veera");
    assert.equal(created.account.email, "adult@home.com");
    assert.equal(created.account.displayName, "Veera");
    assert.equal(created.household, null);

    const session = await backend.createHousehold("Sarukulu");
    assert.equal(session.household?.name, "Sarukulu");
    assert.equal(session.role, "adult");

    await backend.signOut();
    assert.equal(await backend.getSession(), null);

    const again = await backend.signIn("adult@home.com", "secret1");
    assert.equal(again.role, "adult");
    assert.equal(again.household?.name, "Sarukulu");
  });

  it("rejects a short password and a duplicate email", async () => {
    const backend = createLocalBackend(memoryStore());
    await assert.rejects(() => backend.signUp("a@b.com", "123"), /at least 6/);
    await backend.signUp("a@b.com", "123456");
    await assert.rejects(() => backend.signUp("A@B.com", "654321"), /already exists/);
  });

  it("lets an adult invite a kid who then only sees their own items", async () => {
    const store = memoryStore();
    const adultApi = createLocalBackend(store);
    await adultApi.signUp("parent@home.com", "secret1", "Parent");
    await adultApi.createHousehold("Home");
    await adultApi.addDrafts([
      { key: "m", name: "Milk", listId: "grocery", pinnedStore: null },
    ]);
    const invite = await adultApi.inviteMember("kid@home.com", "kid");
    assert.equal(invite.role, "kid");
    assert.equal(invite.email, "kid@home.com");

    const kidApi = createLocalBackend(store);
    const kidSession = await kidApi.signUp("kid@home.com", "secret1", "Kid");
    assert.equal(kidSession.role, "kid");
    assert.equal(kidSession.household?.name, "Home");

    const beforeAdd = await kidApi.listNeeds();
    assert.equal(beforeAdd.length, 0);

    await kidApi.addDrafts([
      { key: "n", name: "Notebooks", listId: "school", pinnedStore: null },
    ]);
    const kidNeeds = await kidApi.listNeeds();
    assert.deepEqual(
      kidNeeds.map((need) => need.name),
      ["Notebooks"],
    );

    await adultApi.signIn("parent@home.com", "secret1");
    const adultNeeds = await adultApi.listNeeds();
    assert.deepEqual(
      adultNeeds.map((need) => need.name).sort(),
      ["Milk", "Notebooks"],
    );

    const milk = adultNeeds.find((need) => need.name === "Milk");
    assert.ok(milk);
    await kidApi.signIn("kid@home.com", "secret1");
    await assert.rejects(() => kidApi.toggleNeed(milk.id), /only change items you added/);
    await assert.rejects(() => kidApi.inviteMember("other@home.com", "kid"), /Only adults/);
    await assert.rejects(() => kidApi.listInvites(), /Only adults/);

    const kidMembers = await kidApi.listMembers();
    assert.equal(kidMembers.length, 1);
    assert.equal(kidMembers[0]?.role, "kid");
  });

  it("imports legacy localStorage needs onto the household", async () => {
    const backend = createLocalBackend(memoryStore());
    await backend.signUp("adult@home.com", "secret1");
    await backend.createHousehold("Home");
    const legacy = parseState(
      JSON.stringify({
        version: 1,
        needs: [
          {
            id: "starter-milk",
            name: "Milk",
            listId: "grocery",
            pinnedStore: null,
            done: false,
            createdAt: 1,
          },
        ],
      }),
    );
    assert.ok(legacy);
    const imported = await backend.importNeeds(legacy.needs);
    assert.equal(imported.length, 1);
    assert.equal(imported[0]?.name, "Milk");
    assert.equal(imported[0]?.addedBy, (await backend.getSession())?.account.id);
    assert.notEqual(imported[0]?.id, "starter-milk");
  });

  it("auto-joins the newest pending invite on sign-in", async () => {
    const store = memoryStore();
    const adultApi = createLocalBackend(store);
    await adultApi.signUp("adult@home.com", "secret1");
    await adultApi.createHousehold("Home");
    await adultApi.inviteMember("plus@home.com", "adult");

    const plusApi = createLocalBackend(store);
    const session = await plusApi.signUp("plus@home.com", "secret1");
    assert.equal(session.role, "adult");
    assert.equal(session.household?.name, "Home");
  });
});
