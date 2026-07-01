# CampusFind admin dashboard

React 19 + Vite + Tailwind CSS v4, scaffolded per ARCHITECTURE.md.

## Run locally
```
npm install
npm run dev
```

## Pages
- `/` Overview — quick stats, stalled-claim banner, recent reports
- `/bulk-import` CSV preview (FR-1), confirm disabled while any row has an error
- `/reports` Admin monitoring (FR-5), force-resolve for unresponsive reporters
- `/walk-in` ISSC walk-in found item intake (FR-11)
- `/analytics` Charts via Recharts (FR-7)
- `/accounts` Single account creation + listing (FR-1)

## Notes
- `src/index.css` holds the shared design tokens (NwSSU green, status colors
  mapped 1:1 to the report_status/claim_status enums in
  `../supabase/migrations/0001_init_schema.sql`).
- `src/data/mockData.js` has placeholder data shaped like the DB schema —
  swap for real Supabase/Express calls when the backend is wired up.
- `src/assets/nwssu-seal.png` is the official university seal you provided.

## Connecting to Supabase

1. Create your Supabase project (Settings -> API gives you the URL + anon key)
2. In the SQL editor, run, in order:
   - `../supabase/migrations/0001_init_schema.sql`
   - `../supabase/migrations/0002_rls_policies.sql`
3. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key
4. `npm run dev` — pages that hit Supabase (`Reports`, `Accounts`, `Walk-in intake`)
   will automatically use real data once `.env.local` is filled in. Until then
   they fall back to mock data with a small banner saying so, so the UI stays
   usable either way.

Bulk import and Analytics are still on mock data only — bulk import needs the
Express all-or-nothing CSV validation layer (not yet built), and analytics
needs a couple more aggregate queries in `src/lib/api.js`.
