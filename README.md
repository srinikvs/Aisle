# Aisle

Voice grocery / multi-list shopping assistant. Speak a need once; keep **Grocery**, **School supplies**, **Shopping**, and **Travel** as their own lists. Walking into Costco, Publix, or Office Depot? Aisle pulls what that store can cover.

## Hosts

| Host | URL | Vite `base` | Jenkins build |
| --- | --- | --- | --- |
| Playadda | `https://playadda.duckdns.org/aisle/` | `/aisle/` (default) | `npm ci` → `npm run build` |
| Sarukulu | `https://sarukulu.duckdns.org/` | `/` | `npm ci` → `BASE_PATH=/ npm run build` |

Jenkins then rsyncs **`dist/`**. Root `index.html` is the Vite source (`/src/main.tsx` only). Do not commit hashed asset paths.

`npm run build` still writes `/aisle/`-prefixed assets by default so Playadda is unchanged. For Sarukulu (site root), pass **`BASE`** in either of these ways:

```bash
# Env (picked up by vite.config.ts)
BASE_PATH=/ npm run build

# Vite CLI (overrides config.base)
npm run build -- --base /
# or
npm run build:root
```

Local preview of a root build: `npm run preview:root` after `npm run build:root`.

## v1.0.1

1. Vite `base` is configurable at build time (`BASE_PATH` or `vite --base`) so the same app deploys at Playadda `/aisle/` and Sarukulu site root.

## v1.0.0

1. Version ID (`v1.0.0`) in the document title and footer.
2. Lists tab for the four lists; Store runs for Costco, Publix, and Office Depot.
3. “Tap to speak a need” (Web Speech API) plus a typing fallback. Parsed items confirm before they land on a list.
4. Checkoff on a store run syncs everywhere. State persists in `localStorage` (`aisle-v1`). A starter list of 12 open needs ships so store views are not empty.

## Lists and stores

| List | Costco | Publix | Office Depot |
| --- | --- | --- | --- |
| Grocery | yes | yes | no |
| School supplies | yes | no | yes |
| Shopping | yes | yes | yes |
| Travel | yes | yes | yes |

- **Costco** — every open need from all four lists.
- **Publix** — food, household, and travel extras (not school supplies).
- **Office Depot** — school, office, and trip tech (not groceries).

Pin an item to a store in the confirm sheet if you only want Publix or Office Depot to show it. Costco still sees every open need.

## Try it

1. Tap **Tap to speak a need** and say something like “milk, notebooks for school, sunscreen for the trip” — or **Type instead**.
2. Confirm the sort (move an item to another list or store before adding).
3. Open **Store runs** and compare Costco vs Publix vs Office Depot.
4. Check an item off on a run; it is checked off on its list too.

Allow the microphone when asked. If the browser blocks speech (common in some in-app previews), type from the home pill or any list.

## Stack

Client-only Vite 6 + React 19 + TypeScript. No API keys. Speech uses the browser Web Speech API; parsing is local keyword + phrase matching.

```bash
npm install
npm test
npm run dev            # http://localhost:5173/aisle/
BASE_PATH=/ npm run dev
                       # http://localhost:5173/
npm run build          # dist/ with /aisle/ assets (Playadda)
npm run build:root     # dist/ with / assets (Sarukulu)
```

## License

Use and modify freely for personal or commercial projects.
