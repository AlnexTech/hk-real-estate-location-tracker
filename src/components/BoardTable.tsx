"use client";

import {
  SHORT,
  STAGES,
  days,
  fmt,
  healthLabel,
  planProgress,
  prio,
  searching,
} from "@/lib/constants";
import { useTracker } from "@/lib/store";
import type { Location } from "@/lib/types";
import { useState, type ReactNode } from "react";

function LocationCard({
  loc,
  canWrite,
  onOpen,
}: {
  loc: Location;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const { plans } = useTracker();
  const d = days(loc.targetOpen);
  let when: ReactNode = null;
  if (loc.actualOpen) when = `Opened ${fmt(loc.actualOpen)}`;
  else if (loc.targetOpen)
    when = (
      <span className={d !== null && d < 0 ? "late" : ""}>
        Target {fmt(loc.targetOpen)}
        {d !== null && d < 0 ? ` (${-d}d late)` : ""}
      </span>
    );
  const p = prio(loc);
  const sd = searching(loc);
  const prog = planProgress(plans[loc.id]);

  return (
    <div
      className={`card ${p === "Back burner" ? "back" : ""}`}
      draggable={canWrite}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", loc.id)}
      onClick={onOpen}
    >
      <div className="nm">
        {loc.name || "Untitled"}{" "}
        {p === "High" && <span className="prio High">High</span>}
        {p === "Back burner" && <span className="prio Back">Back burner</span>}
      </div>
      <div className="mt">
        <span
          className={`dot ${loc.health || "none"}`}
          title={healthLabel(loc.health) || "Lease health not set"}
        />
        {[loc.city, loc.state].filter(Boolean).join(", ") || "—"}
      </div>
      {sd !== null && (
        <div className="mt">
          <span className={sd >= 180 ? "late" : ""}>Searching {sd} days</span>
        </div>
      )}
      {when && <div className="mt">{when}</div>}
      {prog !== null && <div className="mt">Launch plan {prog}%</div>}
    </div>
  );
}

export function BoardView() {
  const { filtered, canWrite, setOpenId, saveLocation } = useTracker();
  const [dropStage, setDropStage] = useState<string | null>(null);
  const cols = STAGES.filter(
    (s) => s !== "Dead" || filtered.some((l) => l.stage === "Dead"),
  );

  return (
    <div className="board">
      {cols.map((s) => {
        const items = filtered.filter((l) => l.stage === s);
        return (
          <div
            key={s}
            className={`col ${dropStage === s ? "drop" : ""}`}
            onDragOver={(e) => {
              if (!canWrite) return;
              e.preventDefault();
              setDropStage(s);
            }}
            onDragLeave={() => setDropStage((cur) => (cur === s ? null : cur))}
            onDrop={async (e) => {
              e.preventDefault();
              setDropStage(null);
              if (!canWrite) return;
              const id = e.dataTransfer.getData("text/plain");
              const loc = filtered.find((x) => x.id === id);
              if (!loc || loc.stage === s) return;
              await saveLocation(id, { stage: s }, `Moved to ${SHORT[s]}`);
            }}
          >
            <h3>
              <span>{SHORT[s]}</span>
              <span className="cnt">{items.length}</span>
            </h3>
            <div className="list">
              {items.length ? (
                items.map((l) => (
                  <LocationCard
                    key={l.id}
                    loc={l}
                    canWrite={canWrite}
                    onOpen={() => setOpenId(l.id)}
                  />
                ))
              ) : (
                <div className="sub" style={{ padding: 6 }}>
                  Nothing here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TableView() {
  const { filtered, setOpenId } = useTracker();
  if (!filtered.length) {
    return <div className="empty">No locations match.</div>;
  }
  return (
    <div className="tablewrap">
      <table className="data">
        <thead>
          <tr>
            <th>Location</th>
            <th>City</th>
            <th>State</th>
            <th>Priority</th>
            <th>Days searching</th>
            <th>Stage</th>
            <th>Lease health</th>
            <th>LOI</th>
            <th>Lease Signed</th>
            <th>Target Open</th>
            <th>Actual Open</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => {
            const d = days(l.targetOpen);
            const p = prio(l);
            return (
              <tr key={l.id} onClick={() => setOpenId(l.id)}>
                <td>
                  <strong>{l.name || ""}</strong>
                </td>
                <td>{l.city || ""}</td>
                <td>{l.state || ""}</td>
                <td>
                  {p !== "Normal" && (
                    <span className={`prio ${p === "High" ? "High" : "Back"}`}>
                      {p}
                    </span>
                  )}
                </td>
                <td>{searching(l) !== null ? searching(l) : ""}</td>
                <td>{SHORT[l.stage || ""] || l.stage || ""}</td>
                <td>
                  {l.health ? (
                    <span className={`pill ${l.health}`}>{healthLabel(l.health)}</span>
                  ) : (
                    ""
                  )}
                </td>
                <td>{l.loiStatus || ""}</td>
                <td>{fmt(l.leaseSigned)}</td>
                <td
                  className={
                    !l.actualOpen && d !== null && d < 0 ? "late" : ""
                  }
                >
                  {fmt(l.targetOpen)}
                </td>
                <td>{fmt(l.actualOpen)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
