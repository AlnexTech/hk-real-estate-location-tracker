# Hyper Kidz Real Estate Location Tracker

Next.js port of the Hyper Kidz pipeline tracker — board, table, alerts, location drawer, and 270-day launch plans.

## Run

```bash
cd "hk real estate tracker"
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

- Seeded from `Hyper_Kidz_Location_Pipeline_Tracker.xlsx` (59 locations).
- Changes persist in the browser via `localStorage`.

## Features (parity with source HTML)

- Board / Table / Launch Plan views
- KPI focus filters, search, country / priority / health filters
- Alerts + weekly summary copy
- Drag-and-drop stage moves on the board
- Location drawer with fields, quick actions, updates, delete
- 270-day launch plan with Gantt bars
