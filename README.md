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

## v1.1.0

1. Email + password accounts. Sign up / sign in from the SPA.
2. Shared **household**: the first adult creates it; adults invite others by email as **adult** or **kid**.
3. **Kids** can add needs (voice or type) and see only items they added. They cannot open household lists or store runs.
4. **Adults** keep the current Aisle behavior (four lists, Costco / Publix / Office Depot, voice, checkoffs) on the shared household data.
5. Optional import of this device’s old `localStorage` (`aisle-v1`) when creating a household.
6. Cloud persistence via **Supabase** (Auth + Postgres + RLS). Without env vars the app uses **local demo mode** (accounts stay on this device).

## v1.0.1

1. Vite `base` is configurable at build time (`BASE_PATH` or `vite --base`) so the same app deploys at Playadda `/aisle/` and Sarukulu site root.

## v1.0.0

1. Version ID (`v1.0.0`) in the document title and footer.
2. Lists tab for the four lists; Store runs for Costco, Publix, and Office Depot.
3. “Tap to speak a need” (Web Speech API) plus a typing fallback. Parsed items confirm before they land on a list.
4. Checkoff on a store run syncs everywhere. State persists in `localStorage` (`aisle-v1`). A starter list of 12 open needs ships so store views are not empty.

## Accounts and family

| Role | What they can do |
| --- | --- |
| Adult | Full lists + store runs on the shared household. Invite / revoke by email. |
| Kid | Add items. See and check off only their own items. No Family screen, no other lists, no store runs. |

Invite flow:

1. An adult opens **Family**, enters an email, picks Kid or Adult.
2. That person creates an account with the **same email** (or opens the copied invite link, then signs up).
3. They join the household automatically. Kids land on “My items”; adults see the shared lists.

Aisle does not send mail itself. The adult tells the person to sign up, or shares the invite link. With Supabase you can later turn on Auth email templates if you want a real message.

### Migrating from `localStorage` (v1.0.x)

Existing devices already have `aisle-v1` lists. After you sign up and **create a household**, Aisle offers **Import items saved on this device**. That copies them onto the household (tagged as added by you) and sets `aisle-v1-imported` so the prompt does not repeat.

- Import is optional. Starting fresh leaves the old `aisle-v1` key untouched.
- Import is per device. Each adult who still has local lists can import once.
- Local demo mode (no Supabase env) keeps the new household in `aisle-accounts-v1` on that browser only. Set Supabase to share across phones.

## Auth provider (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email** on. For a family app, turn **off Confirm email** so invitees can join immediately. Password signup is enough; magic link is unused.
3. **Authentication → URL configuration**
   - Site URL: `https://sarukulu.duckdns.org/`
   - Redirects: that origin, `https://playadda.duckdns.org/aisle/`, and `http://localhost:5173/` (and `/aisle/` if you use the default Vite base).
4. SQL editor: run [`supabase/schema.sql`](supabase/schema.sql). It creates `profiles`, `households`, `memberships`, `invites`, `needs`, RLS (kids only `select` their own needs), and RPCs for create / invite / accept / revoke.
5. Copy **Project URL** and **anon public** key into env (see below). Never put the service role key in the Vite app.

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

Rebuild after changing env. Vite inlines `VITE_*` at **build** time.

## Jenkins env secrets

Add two **secret text** credentials (or bind them as environment variables on the job). They must be present in the shell that runs `vite build`:

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

Example build steps (Sarukulu):

```bash
export VITE_SUPABASE_URL=$VITE_SUPABASE_URL
export VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
npm ci
npm test
BASE_PATH=/ npm run build
# rsync dist/
```

Playadda is the same without `BASE_PATH=/`. If these two variables are missing, the built SPA runs in local demo mode and households will not sync between devices.

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

1. Create an adult account and a household (import local lists if offered).
2. Tap **Tap to speak a need** and say something like “milk, notebooks for school, sunscreen for the trip” — or **Type instead**.
3. Confirm the sort (move an item to another list or store before adding).
4. Open **Family** and invite a kid email. Sign out, create that account, and confirm they only see items they add.
5. Open **Store runs** as an adult and compare Costco vs Publix vs Office Depot.

Allow the microphone when asked. If the browser blocks speech (common in some in-app previews), type from the home pill or any list.

## Stack

Vite 6 + React 19 + TypeScript. Speech uses the browser Web Speech API; parsing is local keyword + phrase matching. Household data uses Supabase when configured, otherwise an on-device demo backend.

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
