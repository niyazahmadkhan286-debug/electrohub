# ElectroHub

Electronics inventory management app. Next.js 16 (App Router) + Supabase
(Postgres, Auth, Row Level Security). No mock data — every number on the
dashboard is computed live from the `products` table, and every read/write
requires a signed-in Supabase user.

## One-time setup

These are the only steps that need your own Supabase/Vercel accounts —
everything else (schema, API, auth, dashboard) is already implemented.

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates
   the `products` table, its constraints/indexes, Row Level Security
   policies (authenticated users only — no anonymous access), and a small
   set of demo products.
3. Go to **Project Settings → API** and copy the **Project URL** and
   **anon public key**.

### 2. Create the first (and only) user

There is no public sign-up page — that's intentional, since this is an
internal inventory tool, not a multi-tenant product. Create the first
user yourself:

**Authentication → Users → Add user** in the Supabase dashboard, set an
email + password, and use those credentials to log in at `/login`. Add
more users the same way later if needed.

### 3. Set environment variables

Copy `.env.example` to `.env.local` for local development:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both are safe to expose to the browser — every write is enforced
server-side by Postgres RLS policies, not by keeping these secret. Never
commit `.env.local`.

### 4. Deploy to Vercel

1. Push this repo to GitHub and import it into Vercel (or run `vercel` from
   the CLI).
2. In the Vercel project's **Settings → Environment Variables**, add the
   same two variables from step 3.
3. Deploy. If the variables are missing, the app fails with a clear
   "Server misconfiguration" message instead of a silent crash.

## Local development

```bash
pnpm install
pnpm dev
```

Requires `.env.local` from step 3 above. Visit `http://localhost:3000` —
you'll be redirected to `/login`.

## How it's wired together

- `supabase/schema.sql` — table, constraints (no negative price/stock),
  indexes (category, status, trigram search on name/brand, created_at),
  and RLS policies.
- `lib/supabase/{client,server,middleware}.ts` — browser/server Supabase
  clients and session refresh.
- `middleware.ts` — redirects unauthenticated page requests to `/login`;
  API routes handle their own 401s (see `lib/api-response.ts`) so a
  fetch() call gets clean JSON instead of an HTML redirect.
- `app/api/products` / `app/api/products/[id]` — CRUD with Zod validation
  (`lib/validation.ts`), search/filter/sort/pagination, safe DB-error
  mapping (`lib/api-response.ts`).
- `app/api/dashboard` — all dashboard statistics computed from live data.
- `app/dashboard-app.tsx` — the UI; fetches everything above, with
  loading/empty/error states and retry on every tab.
