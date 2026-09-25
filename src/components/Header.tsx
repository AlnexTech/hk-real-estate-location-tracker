"use client";

import {
  COUNTRIES,
  FOCUS,
  days,
  daysSince,
  fmt,
  prio,
  searching,
} from "@/lib/constants";
import { useTracker, type AlertGroup } from "@/lib/store";
import type { FocusKey, Location, ViewMode } from "@/lib/types";
import { useState } from "react";
import { PromptModal } from "./Modal";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const {
    locations,
    ui,
    setUi,
    canWrite,
    isAdmin,
    addLocation,
    setOpenId,
  } = useTracker();
  const [addOpen, setAddOpen] = useState(false);

  const sub = `${locations.length} locations · ${new Date().toLocaleDateString(
    undefined,
    { month: "long", day: "numeric", year: "numeric" },
  )}${canWrite ? "" : " · read only"}`;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <img
            src="/hyperkidz-logo.png"
            alt="Hyper Kidz"
            className="brand-logo"
          />
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">
            Real Estate Location Tracker
          </h1>
          <div className="sub">{sub}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="tablist" aria-label="View">
            {(
              [
                ["board", "Board"],
                ["table", "Table"],
                ["plan", "Launch Plan"],
              ] as [ViewMode, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                data-v={v}
                aria-pressed={ui.view === v}
                onClick={() => setUi({ view: v })}
              >
                {label}
              </button>
            ))}
          </div>
          <ThemeToggle />
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (!canWrite) return;
              if (!isAdmin) return;
              setAddOpen(true);
            }}
          >
            + Location
          </button>
        </div>
      </header>

      <PromptModal
        open={addOpen}
        title="Add a location"
        fields={[{ label: "Location name", value: "Hyper Kidz " }]}
        okLabel="Add"
        onCancel={() => setAddOpen(false)}
        onOk={async (vals) => {
          setAddOpen(false);
          const name = vals[0];
          if (!name || name === "Hyper Kidz") return;
          const id = await addLocation(name);
          if (id) setTimeout(() => setOpenId(id), 300);
        }}
      />
    </>
  );
}

export function Filters() {
  const { ui, setUi } = useTracker();
  const focus = ui.focus ? FOCUS[ui.focus as Exclude<FocusKey, "">] : null;

  return (
    <div className="sticky-filters flex flex-wrap items-center gap-2">
      <input
        className="max-w-[340px] text-[15px]"
        placeholder="Search location, city, state…"
        value={ui.q}
        onChange={(e) => setUi({ q: e.target.value })}
      />
      <select
        style={{ width: "auto" }}
        value={ui.country}
        onChange={(e) => setUi({ country: e.target.value })}
      >
        <option value="">All countries</option>
        {COUNTRIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select
        style={{ width: "auto" }}
        value={ui.prio}
        onChange={(e) => setUi({ prio: e.target.value })}
      >
        <option value="">All priorities</option>
        <option>High</option>
        <option>Normal</option>
        <option>Back burner</option>
      </select>
      <select
        style={{ width: "auto" }}
        value={ui.health}
        onChange={(e) => setUi({ health: e.target.value })}
      >
        <option value="">All health</option>
        <option>Green</option>
        <option>Yellow</option>
        <option>Red</option>
      </select>
      <label className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
        <input
          type="checkbox"
          style={{ width: "auto" }}
          checked={ui.hideOpen}
          onChange={(e) => setUi({ hideOpen: e.target.checked })}
        />
        Hide open locations
      </label>
      {focus && (
        <span className="chip">
          {focus.label}
          <button
            type="button"
            title="Clear"
            onClick={() => setUi({ focus: "" })}
          >
            ×
          </button>
        </span>
      )}
      <div className="flex-1" />
    </div>
  );
}

export function Kpis() {
  const { locations, ui, setUi } = useTracker();

  const open = locations.filter((l) => l.stage === "6 - Open").length;
  const pipe = locations.filter(
    (l) =>
      l.stage &&
      l.stage !== "6 - Open" &&
      l.stage !== "Dead" &&
      l.stage !== "On Hold",
  ).length;
  const loi = locations.filter(
    (l) => l.stage === "3 - LOI" || l.stage === "4 - Lease",
  ).length;
  const build = locations.filter(
    (l) => l.stage === "5 - Under Construction",
  ).length;
  const red =
    locations.filter((l) => l.health === "Red").length +
    locations.filter((l) => l.health === "Yellow").length;
  const late = locations.filter(
    (l) =>
      l.targetOpen &&
      !l.actualOpen &&
      l.stage !== "6 - Open" &&
      days(l.targetOpen)! < 0,
  ).length;
  const hi = locations.filter(
    (l) => prio(l) === "High" && l.stage !== "6 - Open",
  ).length;
  const longest = Math.max(0, ...locations.map((l) => searching(l) || 0));

  const k: [string, number, boolean, FocusKey][] = [
    ["Open", open, false, "open"],
    ["In pipeline", pipe, false, "pipeline"],
    ["High priority", hi, false, "high"],
    ["LOI + Lease", loi, false, "loilease"],
    ["Under construction", build, false, "build"],
    ["Red or Yellow", red, red > 0, "flag"],
    ["Target date passed", late, late > 0, "late"],
    ["Longest search (days)", longest, longest >= 180, "searching"],
  ];

  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
      {k.map(([label, n, warn, f]) => (
        <div
          key={f}
          className={`kpi ${warn ? "warn" : ""}`}
          role="button"
          tabIndex={0}
          aria-pressed={ui.focus === f}
          onClick={() => {
            const next = ui.focus === f ? "" : f;
            setUi({
              focus: next as FocusKey,
              ...(next ? { view: "table" as const } : {}),
            });
            if (next) {
              document
                .getElementById("main-view")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.currentTarget as HTMLElement).click();
            }
          }}
        >
          <div className="n">{n}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}

function alertDetail(groupId: string, loc: Location): string | null {
  if (groupId === "late" && loc.targetOpen) {
    const late = days(loc.targetOpen);
    if (late !== null && late < 0) {
      const n = -late;
      return n === 1 ? "1 day past opening" : `${n} days past opening`;
    }
  }
  if (groupId === "loi" && loc.loiSent) {
    const n = daysSince(loc.loiSent);
    if (n !== null) return n === 1 ? "sent 1 day ago" : `sent ${n} days ago`;
  }
  const sd = searching(loc);
  if (sd !== null) return sd === 1 ? "searching 1 day" : `searching ${sd} days`;
  return null;
}

function attentionLead(actionCount: number, watchCount: number) {
  const things =
    actionCount === 1
      ? "1 thing needs a decision now"
      : `${actionCount} things need a decision now`;
  const sites =
    watchCount === 1
      ? "1 location is still looking for a site"
      : `${watchCount} locations are still looking for a site`;
  if (actionCount && watchCount) return `${things}. ${sites}.`;
  if (actionCount) return `${things}.`;
  if (watchCount) return `${sites}.`;
  return "Nothing needs attention right now.";
}

function AlertLocation({
  groupId,
  loc,
  onOpen,
}: {
  groupId: string;
  loc: Location;
  onOpen: (id: string) => void;
}) {
  const detail = alertDetail(groupId, loc);
  const high = prio(loc) === "High";
  const health =
    groupId === "flag" && (loc.health === "Red" || loc.health === "Yellow")
      ? loc.health
      : null;

  return (
    <button type="button" className="brief-loc" onClick={() => onOpen(loc.id)}>
      <span className="brief-loc-name">{loc.name}</span>
      {(high || health || detail) && (
        <span className="brief-loc-meta">
          {high && <span className="prio High">High</span>}
          {health && <span className={`brief-health ${health}`}>{health}</span>}
          {detail && <span>{detail}</span>}
        </span>
      )}
    </button>
  );
}

function AlertCard({
  group,
  expanded,
  limit,
  wide,
  onToggle,
  onOpen,
}: {
  group: AlertGroup;
  expanded: boolean;
  limit: number;
  wide?: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const shown = expanded ? group.items : group.items.slice(0, limit);
  const hidden = group.items.length - shown.length;
  const tone = group.watch ? "watch" : group.hard ? "hard" : "soft";

  return (
    <article className={`brief-card ${tone}`}>
      <div className="brief-card-top">
        <div className="brief-count">{group.items.length}</div>
        <div>
          <h3>{group.k}</h3>
          <p>{group.why}</p>
        </div>
      </div>
      <div className={wide ? "brief-grid" : "brief-list"}>
        {shown.map((loc) => (
          <AlertLocation
            key={loc.id}
            groupId={group.id}
            loc={loc}
            onOpen={onOpen}
          />
        ))}
      </div>
      {group.items.length > limit && (
        <button type="button" className="brief-more" onClick={onToggle}>
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </article>
  );
}

export function Alerts() {
  const { alertGroups, digest, showToast, setOpenId } = useTracker();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groups = alertGroups();
  const actions = groups.filter((g) => !g.watch);
  const watch = groups.filter((g) => g.watch);
  const actionCount = actions.reduce((n, g) => n + g.items.length, 0);
  const watchCount = watch.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="brief mb-4" aria-label="Needs your attention">
      <div className="brief-head">
        <div>
          <h2>Needs your attention</h2>
          <p className="brief-lead">{attentionLead(actionCount, watchCount)}</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const t = digest();
            try {
              await navigator.clipboard.writeText(t);
              showToast("Weekly summary copied");
            } catch {
              showToast("Copy failed");
            }
          }}
        >
          Copy weekly summary
        </button>
      </div>
      {groups.length > 0 && (
        <div className="brief-body">
          {actions.length > 0 && (
            <div className="brief-actions">
              {actions.map((group) => (
                <AlertCard
                  key={group.id}
                  group={group}
                  expanded={!!openGroups[group.id]}
                  limit={4}
                  onOpen={setOpenId}
                  onToggle={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                />
              ))}
            </div>
          )}
          {watch.map((group) => (
            <AlertCard
              key={group.id}
              group={group}
              wide
              expanded={!!openGroups[group.id]}
              limit={8}
              onOpen={setOpenId}
              onToggle={() =>
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.id]: !prev[group.id],
                }))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function Feed() {
  const { updates, locations } = useTracker();
  if (!updates.length) {
    return (
      <div className="feed mt-[18px]">
        <h2>Recent updates</h2>
        <div className="sub">No updates yet.</div>
      </div>
    );
  }
  return (
    <div className="feed mt-[18px]">
      <h2>Recent updates</h2>
      {updates.slice(0, 12).map((u) => {
        const l = locations.find((x) => x.id === u.locId);
        return (
          <div key={u.id} className="row">
            <strong>{l ? l.name : u.locName}</strong> — {u.text}
            <div className="who">
              {fmt(u.at)} · {u.by || "Someone"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
