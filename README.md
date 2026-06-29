# Pave — Crowdsourced Sidewalk Accessibility Map

**Pave** is a full-stack, responsive web application that empowers individuals to report sidewalk and entrance accessibility issues (e.g. broken pavement, missing curb cuts, stairs without ramps, blocked paths, or steep grades). Other users can confirm or dispute reports, constructing a real-time, crowdsourced accessibility heatmap. Designed specifically for wheelchair users, parents with strollers, and anyone navigating a city who needs to know which routes are actually passable.

---

## Technical Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Next.js 16 Proxy**: Network-level boundary routing and session refreshing via `proxy.ts` (Next.js 16's standard replacement for `middleware.ts`)
- **Styling**: Neo-Brutalist Visual Design (thick black borders, flat colors, offset drop shadows)
- **Map**: Mapbox GL JS via `react-map-gl` (with custom client-side clustering via `supercluster` & native WebGL Heatmap layers)
- **Backend & Database**: Next.js Server Route Handlers + Supabase (PostgreSQL with PostGIS extension + Row Level Security)
- **Auth**: Supabase Auth (Email & Password)
- **File Storage**: Supabase Storage (for uploading report photo evidence)

---

## Getting Started

### 1. Database Setup (Supabase)

1. Create a new project in the [Supabase Dashboard](https://database.new).
2. Go to the **SQL Editor** in your Supabase project.
3. Open the migration files in this repository under `supabase/migrations/`:
   - [0001_init.sql](file:///supabase/migrations/0001_init.sql): Sets up tables (`profiles`, `reports`, `confirmations`), enables PostGIS, sets up spatial GIST indexing, adds RLS policies, triggers, and the viewport query function.
   - [0002_storage.sql](file:///supabase/migrations/0002_storage.sql): Creates the `report-photos` bucket and adds storage upload/view policies.
4. Copy-paste and execute the contents of both SQL files (first `0001_init.sql`, then `0002_storage.sql`) in the SQL editor.
5. In your project, go to **Project Settings** > **API** to copy the public URL and Anon key.
6. Copy the database service role key from the API settings if you need administrative capabilities (though it is not strictly required for standard app usage).

### 2. Mapbox Token Setup

1. Sign up for a free account at [Mapbox](https://www.mapbox.com/).
2. Create or find your default public access token on your account homepage.
3. The token should look like `pk.eyJ1Ijoi...`.

### 3. Environment Variables Configuration

1. In the root of your project directory, copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and populate it with your Supabase and Mapbox keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
   NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-public-token-here
   ```

### 4. Running the Project Locally

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`.

---

## Core Features & Neo-Brutalist Layout

1. **Map View**: Centered on your browser's geolocation with a fallback to NYC. Map markers are square with heavy black borders, colored by severity:
   - 🟢 **Level 1 (Low)**: Annoying but passable (`#A8FF60`)
   - 🟡 **Level 2 (Medium)**: Difficult (`#FFD400`)
   - 🔴 **Level 3 (High)**: Impassable (`#FF3366`)
2. **Visual View Toggle**: Switch between **Pin View** (with group clustering bubbles) and **Heatmap View** (gradient density overlay weighted by severity).
3. **Interactive Pin Drop**: Click "Report Accessibility Issue", click any point on the map, and fill out the detailed form.
4. **Photo Upload**: Supports uploading photo evidence of sidewalk issues directly to your Supabase Storage bucket.
5. **Crowdsourced Verification**: Users can vote "Still there" (confirm) or "Fixed / Not accurate" (dispute) to update report data.
6. **Auto-Dispute Trigger**: When a report receives 3+ dispute votes and 1 or fewer confirm votes, its status is automatically updated to `disputed` via a PostgreSQL database trigger, and the map marker dims to represent inaccuracy.
7. **Spatial Bounding Box Filtering**: Filters reports by active viewport boundaries and selections (categories, minimum severity slider) directly at the database layer using PostGIS.

---

## Troubleshooting & Gotchas

### Hydration Mismatch Warnings from Browser Extensions
If you see hydration error overlays or console warnings during local development like:
`A tree hydrated but some attributes of the server rendered HTML didn't match the client properties...` with elements showing extension attributes (like `cz-shortcut-listen="true"` from ColorZilla or attributes from Grammarly/password managers), this has been handled. 

The application uses **`suppressHydrationWarning`** on the root `<html>` element in [layout.tsx](file:///c:/Users/Sahu%20Ji/OneDrive/Desktop/REACT%20PROJECTS/PAVE/app/layout.tsx) to prevent React from throwing errors due to these client-side browser extension injections.
