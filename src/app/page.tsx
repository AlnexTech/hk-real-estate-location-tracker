"use client";

import { Alerts, Feed, Filters, Header, Kpis } from "@/components/Header";
import { BoardView, TableView } from "@/components/BoardTable";
import { LocationDrawer } from "@/components/LocationDrawer";
import { PlanView } from "@/components/PlanView";
import { TrackerProvider, useTracker } from "@/lib/store";

function TrackerApp() {
  const { ui, toast, hydrated } = useTracker();

  if (!hydrated) {
    return (
      <div className="app-shell">
        <div className="sub">Loading pipeline…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Filters />
      <Kpis />
      <Alerts />
      <div id="main-view">
        {ui.view === "board" && <BoardView />}
        {ui.view === "table" && <TableView />}
        {ui.view === "plan" && <PlanView />}
      </div>
      <Feed />
      <LocationDrawer />
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <TrackerProvider>
      <TrackerApp />
    </TrackerProvider>
  );
}
