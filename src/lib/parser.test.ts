import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyList,
  cleanItemName,
  parseNeeds,
  splitUtterance,
} from "./parser.ts";

describe("splitUtterance", () => {
  it("splits the demo phrase on commas", () => {
    assert.deepEqual(
      splitUtterance("milk, notebooks for school, sunscreen for the trip"),
      ["milk", "notebooks for school", "sunscreen for the trip"],
    );
  });

  it("splits on and / newlines", () => {
    assert.deepEqual(splitUtterance("apples and bananas\ncoffee"), [
      "apples",
      "bananas",
      "coffee",
    ]);
  });
});

describe("classifyList", () => {
  it("uses for-school / for-the-trip phrases", () => {
    assert.equal(classifyList("notebooks for school"), "school");
    assert.equal(classifyList("sunscreen for the trip"), "travel");
  });

  it("uses grocery keywords", () => {
    assert.equal(classifyList("milk"), "grocery");
    assert.equal(classifyList("chicken thighs"), "grocery");
  });
});

describe("parseNeeds", () => {
  it("parses the spoken demo into three lists", () => {
    const drafts = parseNeeds(
      "Milk, notebooks for school, sunscreen for the trip",
    );
    assert.equal(drafts.length, 3);
    assert.deepEqual(
      drafts.map((d) => [d.name, d.listId]),
      [
        ["Milk", "grocery"],
        ["Notebooks", "school"],
        ["Sunscreen", "travel"],
      ],
    );
  });

  it("pins a store when the utterance names one", () => {
    const drafts = parseNeeds("batteries at Costco");
    assert.equal(drafts[0]?.pinnedStore, "costco");
    assert.equal(drafts[0]?.name, "Batteries");
  });

  it("uses the fallback list when nothing matches", () => {
    const drafts = parseNeeds("mystery widget", "travel");
    assert.equal(drafts[0]?.listId, "travel");
  });

  it("cleans trailing phrases from the name", () => {
    assert.equal(cleanItemName("notebooks for school"), "Notebooks");
  });
});
