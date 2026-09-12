import type { DraftNeed, ListId, StoreId } from "../types";

const LIST_PHRASES: { listId: ListId; pattern: RegExp }[] = [
  { listId: "school", pattern: /\bfor\s+(school|class|homework|the\s+kids?)\b/i },
  { listId: "travel", pattern: /\bfor\s+(the\s+)?(trip|travel|flight|vacation|holiday)\b/i },
  { listId: "shopping", pattern: /\bfor\s+(the\s+)?(house|home|household|office)\b/i },
  { listId: "grocery", pattern: /\bfor\s+(the\s+)?(kitchen|grocer(?:y|ies)|dinner)\b/i },
];

const WORD_LISTS: { listId: ListId; words: readonly string[] }[] = [
  {
    listId: "school",
    words: [
      "notebook",
      "notebooks",
      "pencil",
      "pencils",
      "binder",
      "binders",
      "glue",
      "crayon",
      "crayons",
      "folder",
      "folders",
      "highlighter",
      "highlighters",
      "eraser",
      "erasers",
      "backpack",
      "marker",
      "markers",
      "scissors",
      "ruler",
      "rulers",
      "calculator",
      "index cards",
      "composition book",
      "graph paper",
      "protractor",
      "loose leaf",
    ],
  },
  {
    listId: "travel",
    words: [
      "sunscreen",
      "passport",
      "adapter",
      "charger",
      "toiletries",
      "suitcase",
      "luggage",
      "boarding pass",
      "headphones",
      "earplugs",
      "neck pillow",
      "travel size",
      "converter",
      "power bank",
      "usb-c",
      "usbc",
    ],
  },
  {
    listId: "shopping",
    words: [
      "detergent",
      "paper towel",
      "paper towels",
      "battery",
      "batteries",
      "light bulb",
      "light bulbs",
      "trash bag",
      "trash bags",
      "sponge",
      "sponges",
      "cleaner",
      "dish soap",
      "laundry",
      "dryer sheets",
      "aluminum foil",
      "ziploc",
      "storage bins",
      "printer paper",
      "ink cartridge",
      "stapler",
      "sticky notes",
    ],
  },
  {
    listId: "grocery",
    words: [
      "milk",
      "eggs",
      "bread",
      "cheese",
      "chicken",
      "yogurt",
      "butter",
      "coffee",
      "spinach",
      "banana",
      "bananas",
      "apple",
      "apples",
      "orange",
      "oranges",
      "juice",
      "cereal",
      "rice",
      "pasta",
      "tomato",
      "tomatoes",
      "onion",
      "onions",
      "garlic",
      "beef",
      "salmon",
      "avocado",
      "avocados",
      "lettuce",
      "broccoli",
      "carrot",
      "carrots",
      "potato",
      "potatoes",
      "flour",
      "sugar",
      "olive oil",
      "yogurt",
      "oat milk",
      "almond milk",
      "ground beef",
      "thighs",
    ],
  },
];

const STORE_PHRASES: { storeId: StoreId; pattern: RegExp }[] = [
  { storeId: "costco", pattern: /\b(at|from|for)?\s*costco\b/i },
  { storeId: "publix", pattern: /\b(at|from|for)?\s*publix\b/i },
  {
    storeId: "office-depot",
    pattern: /\b(at|from|for)?\s*office\s*depot\b/i,
  },
];

const SPLIT = /(?:,|;|\n|\band\b)+/i;

const STRIP_PHRASES =
  /\s+(for\s+(school|class|homework|the\s+kids?|the\s+trip|travel|the\s+flight|vacation|holiday|the\s+house|home|household|the\s+office|the\s+kitchen|grocer(?:y|ies)|dinner)|at\s+(costco|publix|office\s*depot)|from\s+(costco|publix|office\s*depot))\s*$/i;

export function splitUtterance(raw: string): string[] {
  return raw
    .split(SPLIT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function titleCaseName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Usb-C|Usbc)\b/g, "USB-C")
    .replace(/\bAa\b/g, "AA")
    .replace(/^#(\d)/, "#$1");
}

export function cleanItemName(fragment: string): string {
  return titleCaseName(fragment.replace(STRIP_PHRASES, "").trim());
}

export function classifyList(fragment: string): ListId {
  for (const { listId, pattern } of LIST_PHRASES) {
    if (pattern.test(fragment)) return listId;
  }

  const lower = fragment.toLowerCase();
  for (const { listId, words } of WORD_LISTS) {
    if (words.some((word) => lower.includes(word))) return listId;
  }

  return "shopping";
}

export function classifyStore(fragment: string): StoreId | null {
  for (const { storeId, pattern } of STORE_PHRASES) {
    if (pattern.test(fragment)) return storeId;
  }
  return null;
}

export function parseNeeds(raw: string, fallbackList?: ListId): DraftNeed[] {
  const parts = splitUtterance(raw);
  return parts
    .map((fragment, index) => {
      const name = cleanItemName(fragment);
      if (!name) return null;
      const hinted = LIST_PHRASES.some(({ pattern }) => pattern.test(fragment));
      const wordHit = WORD_LISTS.some(({ words }) =>
        words.some((word) => fragment.toLowerCase().includes(word)),
      );
      const listId =
        hinted || wordHit || !fallbackList
          ? classifyList(fragment)
          : fallbackList;
      return {
        key: `draft-${index}-${name.toLowerCase().replace(/\s+/g, "-")}`,
        name,
        listId,
        pinnedStore: classifyStore(fragment),
      } satisfies DraftNeed;
    })
    .filter((draft): draft is DraftNeed => draft !== null);
}
