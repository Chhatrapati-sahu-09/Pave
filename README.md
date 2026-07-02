# Pave — Crowdsourced Sidewalk Accessibility Map

<p align="center">
  <img src="public/logo-pave.png" alt="Pave Logo" width="400" />
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/TailwindCSS-v4-38BDF8?logo=tailwind-css" alt="Tailwind CSS" /></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" alt="Supabase" /></a>
  <a href="https://postgis.net"><img src="https://img.shields.io/badge/PostGIS-Spatial-0047FF?logo=postgresql" alt="PostGIS" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License" /></a>
</p>

**Pave** is a web application that empowers users to report sidewalk and entrance accessibility issues (e.g., broken pavement, missing curb cuts, stairs without ramps). The community confirms or disputes reports in real time, building a crowdsourced accessibility heatmap for wheelchair users, parents with strollers, and anyone navigating street obstacles.

---

## Key Features

* **Interactive Map**: View and report accessibility issues using MapLibre GL.
* **Heatmap Mode**: Toggle between individual markers and a spatial density heatmap.
* **Secure Auth**: Sign in using Supabase Auth (with mock login fallback for testing).
* **Photo Evidence**: Upload issue images directly to Supabase Storage.
* **Community Verification**: Vote to confirm ("Still there") or dispute ("Fixed") reports.
* **Auto-Dispute**: Reports with multiple disputes are dimmed/hidden automatically.
* **Spatial Filtering**: Filter markers on the fly within the current map window using PostGIS.

---

## Tech Stack

* **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, MapLibre GL
* **Backend**: Next.js API Routes, Supabase Auth & Storage
* **Database**: PostgreSQL with PostGIS extension for spatial queries

---

## Getting Started

### 1. Database Setup (Supabase)
1. Run the SQL scripts in [supabase/migrations/](file:///supabase/migrations/) on your Supabase SQL Editor:
   - [0001_init.sql](file:///supabase/migrations/0001_init.sql): Schema & spatial functions.
   - [0002_storage.sql](file:///supabase/migrations/0002_storage.sql): Storage buckets & policies.
2. Get your Supabase project URL and Anon key.

### 2. Environment Variables
1. Copy `.env.local.example` to `.env.local`.
2. Fill in the keys in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
   ```

### 3. Run Locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## License & Author

* **License**: MIT
* **Author**: Chhatrapati Sahu ([Chhatrapati-sahu-09](https://github.com/Chhatrapati-sahu-09))
