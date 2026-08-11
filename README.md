# Kulmi

A halal Somali marriage introduction platform — guided compatibility sessions
instead of endless swiping.

Stack: React + Vite + Tailwind + Supabase (auth, database, realtime, storage).
No third-party AI; the compatibility analysis is computed locally.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key.
3. Set up the database — see **[SETUP.md](SETUP.md)**.
4. Start the app:
   `npm run dev`
