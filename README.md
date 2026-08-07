# My Life System

An English-language personal life dashboard built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style components, Zod, Recharts and a PWA manifest.

The app supports two backends: an atomic JSON datastore for localhost development and a Supabase PostgreSQL repository for hosted production. Setting `DATA_BACKEND=supabase` routes every read and mutation through Supabase, while local development can remain fully offline.

## Current product

- Public dashboard, Daily Tasks, Lifecycle, Calories and Settings pages
- No account, registration, email/password login or Supabase Auth
- Server-verified four-digit management code for every mutation
- Management authorization is locked again on every browser refresh
- Four cumulative daily movement tasks with complete, undo, carry and carry-reversal flows
- Lifecycle timeline calculated in the configured IANA timezone
- Lifecycle starts at Explore World 33%, Relationship 33%, Family 33%
- `ENERGIZED = Explore World + Relationship + Family`, clamped to 0–100 only for display
- Initial ENERGIZED is 99% and shows 🥰; only 100% shows ❤️
- Configurable exercise, dessert and smoking deltas; old ledger entries retain their original deltas
- Manual meals, temporary food-photo analysis, editable AI results and daily/weekly/monthly intake charts
- Real JSON and CSV exports
- Protected Lifecycle reset and full-system reset
- Separate desktop sidebar and mobile bottom-navigation layouts
- Installable PWA with safe-area support and no API-response caching

## Start on localhost

Requirements: Node.js 22+ and npm.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set the local values in `.env.local`:

```env
ADMIN_PIN=your-private-4-digit-code
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATA_BACKEND=local
```

Generate a strong session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Open [http://localhost:3000](http://localhost:3000).

The local datastore is created at `data/local-db.json`. It is ignored by Git, survives refreshes and server restarts, and is written through serialized atomic transactions.

## Management authorization

Public viewing never requires a code. A protected action opens the four-cell management-code dialog.

1. `POST /api/admin/verify-pin` verifies `ADMIN_PIN` on the server with a timing-safe comparison.
2. Success creates a signed `mls_admin_session` cookie.
3. The cookie is HttpOnly, SameSite=Strict, path-wide, valid for 10 minutes and Secure in production.
4. Five failed attempts from one IP trigger a five-minute lockout.
5. Every mutation handler independently validates the cookie and its Zod request schema.
6. Refreshing the page deletes the management cookie, so the next mutation requires the code again.
7. The code is never stored in client JavaScript, HTML, local/session storage, cookies, the database or a `NEXT_PUBLIC_` variable.

Local JSON mode uses an in-memory limiter. Supabase mode stores only a server-keyed hash of the client address and shares the five-attempt/five-minute lock across Vercel instances.

## Lifecycle model

Fresh installations use:

```text
Explore World  33%
Relationship   33%
Family         33%
ENERGIZED      99%
```

ENERGIZED is not stored and is never averaged:

```ts
const rawEnergized = exploreWorld + relationship + family;
const energized = Math.min(100, Math.max(0, rawEnergized));
```

Each category keeps its real 0–100 value even when the displayed sum reaches 100. The timeline is independent: birth date plus target age derives the target date, and current-day calculations always use the saved timezone.

## Fully connected Settings

Every visible Settings control persists to the server and affects the corresponding feature:

- General: website name, English/Chinese primary UI language, timezone
- Life Timeline: birth date, target age and derived read-only target date
- Lifecycle: three scores, required reason and audit records
- Daily Tasks: name, target, unit, order and active state; stored historical records keep their original targets
- Lifecycle Rules: exercise, dessert and smoking deltas used only for new effects
- Calories: default meal type, AI analysis enablement and AI-result confirmation behavior
- Display: PWA landing page, desktop sidebar density and mobile date range
- Data: complete JSON export, selected CSV exports, Lifecycle reset and full reset

An unchanged section has a disabled Save button. A modified section shows `Unsaved Changes`, requests the management code and reports a success or failure toast.

## Pages and APIs

Pages:

```text
/
/tasks
/lifecycle
/calories
/settings
/install
```

Public reads and exports:

```text
GET  /api/public/dashboard
GET  /api/public/tasks?date=YYYY-MM-DD
GET  /api/public/lifecycle
GET  /api/public/calories?date=YYYY-MM-DD
GET  /api/settings
POST /api/settings/export
GET  /api/admin/session
DELETE /api/admin/session
```

Protected writes:

```text
POST   /api/tasks/complete
POST   /api/tasks/uncomplete
POST   /api/tasks/carry
POST   /api/tasks/revert-carry
PATCH  /api/tasks/definition
POST   /api/analyze-food
POST   /api/food/create
PATCH  /api/food/update
DELETE /api/food/delete
POST   /api/smoking/create
DELETE /api/smoking/delete
POST   /api/lifecycle/adjust
PATCH  /api/settings/general
PATCH  /api/settings/timeline
PATCH  /api/settings/lifecycle
PATCH  /api/settings/tasks
PATCH  /api/settings/lifecycle-rules
PATCH  /api/settings/calories
PATCH  /api/settings/display
POST   /api/settings/reset-lifecycle
POST   /api/settings/reset-all
```

## Food-photo privacy

Images exist only in browser memory and in one request to `/api/analyze-food`. The browser compresses the image before sending it, the API validates a structured result, and the image is discarded. There is no image, URL or Base64 field in the local datastore or Supabase schema. The service worker excludes all `/api/*` requests.

With no `OPENAI_API_KEY`, localhost returns a clearly labelled demo analysis so the review and save flow remains testable. To use live analysis later, set server-only values and restart:

```env
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5.6-luna
```

## Hosted Supabase backend

Run all migrations in order:

```text
supabase/migrations/202608070001_initial_schema.sql
supabase/migrations/202608070002_app_settings_and_energized.sql
supabase/migrations/202608070003_production_repository.sql
```

They include tables, constraints, singleton settings, public SELECT policies, denied anonymous writes and secret/service-role-only transaction functions. ENERGIZED is deliberately not a database column.

Configure the production repository with:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATA_BACKEND=supabase
```

The Repository layer uses the server-only secret key. Keep it out of source control and verify anonymous SELECT works while anonymous INSERT, UPDATE, DELETE and RPC writes fail.

## Test and build

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

The 75 automated tests cover authentication, expiry, durable lockout, refresh locking, Singapore midnight and leap years, derived target dates, carryover accumulation and reversal, once-only behavior effects, ENERGIZED sum/clamping/stages, settings persistence, historical task targets in both backends, configurable lifecycle rules, real exports, protected resets, image-schema privacy and server-side write protection.

## PWA

Visit `/install` for device instructions. The manifest uses standalone display, portrait preference, app icons and `/?pwa=1` as the launch URL. The saved default landing page is honored for PWA launches. Network-first navigation keeps internal routes refresh-safe, while API requests and management responses are never cached by the service worker.

## Project structure

```text
app/                         Pages, manifest and API route handlers
components/                  app shell, settings context, admin gate and UI primitives
hooks/                       public fetch and mutation helpers
lib/                         authorization, dates, schemas, lifecycle and business services
public/                      social image and PWA service worker
supabase/migrations/         PostgreSQL schema, RLS and transaction functions
tests/                       Vitest behavior and security tests
.github/workflows/ci.yml     optional CI for later GitHub use
vercel.json                  optional Vercel configuration
```

## GitHub and Vercel deployment

```bash
git init
git add .
git commit -m "Build My Life System"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/my-life-system.git
git push -u origin main
```

Import the repository into Vercel and add all production environment variables. Set the real `ADMIN_PIN` only in Vercel's server environment, use a long random `ADMIN_SESSION_SECRET`, set `NEXT_PUBLIC_APP_URL` to the HTTPS origin and never expose the Supabase secret or OpenAI key with `NEXT_PUBLIC_`.

## Known limits

- Local JSON mode targets one Next.js process; hosted deployments must use `DATA_BACKEND=supabase`.
- OpenAI analysis is simulated until a key is supplied.
- The failed-attempt limiter resets on restart only in local JSON mode; Supabase mode is durable.
- Changing language translates the primary navigation and page copy; some secondary data labels remain English.
- Calorie estimates are informational, not medical advice or precise measurement.
