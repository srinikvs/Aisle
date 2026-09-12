import type { AppState, Need } from "../types";

function item(
  id: string,
  name: string,
  listId: Need["listId"],
  createdAt: number,
): Need {
  return { id, name, listId, pinnedStore: null, done: false, createdAt };
}

/** Twelve open needs so store runs are never empty on first launch. */
export function createStarterState(): AppState {
  const t0 = 1_700_000_000_000;
  return {
    version: 1,
    needs: [
      item("starter-milk", "Milk", "grocery", t0),
      item("starter-eggs", "Eggs", "grocery", t0 + 1),
      item("starter-chicken", "Chicken thighs", "grocery", t0 + 2),
      item("starter-notebooks", "Notebooks", "school", t0 + 3),
      item("starter-pencils", "#2 pencils", "school", t0 + 4),
      item("starter-glue", "Glue sticks", "school", t0 + 5),
      item("starter-towels", "Paper towels", "shopping", t0 + 6),
      item("starter-detergent", "Laundry detergent", "shopping", t0 + 7),
      item("starter-batteries", "AA batteries", "shopping", t0 + 8),
      item("starter-sunscreen", "Sunscreen", "travel", t0 + 9),
      item("starter-charger", "USB-C charger", "travel", t0 + 10),
      item("starter-adapter", "Travel adapter", "travel", t0 + 11),
    ],
  };
}
