"use client";

import {
  SHORT,
  fieldsForLocation,
  addDays,
  days,
  fmt,
  healthLabel,
  planProgress,
  prio,
  searching,
} from "@/lib/constants";
import { useTracker } from "@/lib/store";
import type { FieldDef, LaunchPlan, Location, Update } from "@/lib/types";
import { useEffect, useMemo } from "react";

function money(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw);
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function relative(raw: string): string | null {
  const n = days(raw);
  if (n === null || Number.isNaN(n)) return null;
  if (n === 0) return "today";
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

function dateLine(key: string, raw: string, loc: Location): { value: string; warn: boolean } {
  const shown = fmt(raw) || raw;
  const rel = relative(raw);
  const overdue =
    key === "targetOpen" &&
    !loc.actualOpen &&
    loc.stage !== "6 - Open" &&
    (days(raw) ?? 0) < 0;
  if (!rel) return { value: shown, warn: overdue };
  if (overdue) {
    const n = days(raw)!;
    return { value: `${shown} · ${-n} days overdue`, warn: true };
  }
  return { value: `${shown} · ${rel}`, warn: false };
}

function fieldText(def: FieldDef, loc: Location): { value: string; warn: boolean; href?: string } | null {
  if (def[0] === "sec") return null;
  const [key, , type] = def;
  const raw = (loc as unknown as Record<string, unknown>)[key];
  if (raw === undefined || raw === null || raw === "") {
    return { value: "Not set", warn: false };
  }
  if (type === "date") return dateLine(key, String(raw), loc);
  if (key === "sqft") {
    const n = Number(raw);
    return {
      value: Number.isFinite(n) ? `${n.toLocaleString()} sq ft` : String(raw),
      warn: false,
    };
  }
  if (key === "ti") return { value: money(raw), warn: false };
  if (key === "baseRent") return { value: `${money(raw)} / mo`, warn: false };
  if (key === "nnn") {
    const n = Number(raw);
    return {
      value: Number.isFinite(n)
        ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(raw),
      warn: false,
    };
  }
  if (key === "freeRent") return { value: `${raw} months`, warn: false };
  if (key === "drive" && /^https?:\/\//i.test(String(raw))) {
    return { value: String(raw), warn: false, href: String(raw) };
  }
  if (key === "health") return { value: healthLabel(String(raw)), warn: false };
  return { value: String(raw), warn: false };
}

function openingFact(loc: Location): { value: string; warn: boolean } {
  if (loc.actualOpen) {
    return { value: fmt(loc.actualOpen) || loc.actualOpen, warn: false };
  }
  if (loc.targetOpen) {
    const line = dateLine("targetOpen", loc.targetOpen, loc);
    return line;
  }
  return { value: "No date", warn: false };
}

export function LocationReport({
  loc,
  updates,
  plan,
  onClose,
}: {
  loc: Location;
  updates: Update[];
  plan?: LaunchPlan;
  onClose: () => void;
}) {
  const { showToast } = useTracker();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const model = useMemo(() => {
    const generated = new Date().toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const place = [loc.city, loc.state].filter(Boolean).join(", ");
    const sqft = loc.sqft ? `${Number(loc.sqft).toLocaleString()} sq ft` : "";
    const subtitle = [place, loc.country, loc.ownership, loc.format, sqft]
      .filter(Boolean)
      .join(" · ");
    const stage = SHORT[loc.stage || ""] || loc.stage || "No stage";
    const searchDays = searching(loc);
    const open = openingFact(loc);
    const facts = [
      { label: "Stage", value: stage, warn: false },
      { label: "Priority", value: prio(loc), warn: prio(loc) === "High" },
      {
        label: "Searching",
        value:
          searchDays !== null
            ? `${searchDays} days`
            : loc.stage === "6 - Open"
              ? "Open"
              : "Not started",
        warn: false,
      },
      {
        label: loc.actualOpen ? "Opened" : "Target open",
        value: open.value,
        warn: open.warn,
      },
    ];

    const sections: {
      title: string;
      rows: {
        label: string;
        value: string;
        full: boolean;
        warn: boolean;
        href?: string;
      }[];
    }[] = [];
    let current: (typeof sections)[number] | null = null;
    for (const def of fieldsForLocation(loc)) {
      if (def[0] === "sec") {
        current = { title: def[1], rows: [] };
        sections.push(current);
        continue;
      }
      const shown = fieldText(def, loc);
      if (!current || !shown) continue;
      const full = def[3] === "full" || def[2] === "textarea";
      current.rows.push({
        label: def[1],
        value: shown.value,
        full,
        warn: shown.warn,
        href: shown.href,
      });
    }

    const history = [...updates]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map((u) => ({
        text: u.text,
        meta: `${fmt(u.at) || u.at}${u.by ? ` · ${u.by}` : ""}`,
      }));

    const live = plan?.tasks?.filter((t) => t.status !== "N/A") ?? [];
    const done = live.filter((t) => t.status === "Done").length;
    const progress = planProgress(plan);
    const openTasks = (plan?.tasks ?? [])
      .filter((t) => t.status !== "Done" && t.status !== "N/A")
      .slice()
      .sort((a, b) => Number(b.crit) - Number(a.crit) || a.e - b.e);
    const taskLines = openTasks.slice(0, 8).map((t) => {
      const end = plan?.start ? addDays(plan.start, t.e) : "";
      const n = end ? days(end) : null;
      const late = n !== null && !Number.isNaN(n) && n < 0;
      const when = end
        ? `${fmt(end)}${late ? ` · ${-n!} days overdue` : n === 0 ? " · due today" : n !== null ? ` · due in ${n} days` : ""}`
        : "No start date";
      return {
        name: t.task,
        meta: `${t.phase} · ${t.owner || "Unassigned"} · ${t.status || "Not Started"} · ${when}${t.crit ? " · Critical" : ""}`,
        warn: late,
      };
    });

    const planBlock = {
      started: !!plan?.tasks?.length,
      progress,
      startLabel: plan?.start ? fmt(plan.start) || plan.start : "Not set",
      summary: plan?.tasks?.length
        ? `${done} of ${live.length} tasks done${progress !== null ? ` · ${progress}%` : ""}`
        : "No 270-day launch plan has been started.",
      tasks: taskLines,
      more: Math.max(0, openTasks.length - taskLines.length),
    };

    const lines: string[] = [
      loc.name || "Untitled location",
      `Location report · ${generated}`,
      subtitle,
      "",
      facts.map((f) => `${f.label}: ${f.value}`).join("\n"),
    ];
    if (loc.address) lines.push("", loc.address);
    for (const sec of sections) {
      lines.push("", sec.title.toUpperCase());
      for (const row of sec.rows) lines.push(`${row.label}: ${row.value}`);
    }
    lines.push("", "HISTORY");
    if (!history.length) lines.push("Nothing logged yet.");
    else history.forEach((h) => lines.push(`- ${h.text} (${h.meta})`));
    lines.push("", "LAUNCH PLAN", planBlock.summary);
    if (planBlock.started) lines.push(`Day 1: ${planBlock.startLabel}`);
    planBlock.tasks.forEach((t) => lines.push(`- ${t.name} — ${t.meta}`));
    if (planBlock.more) lines.push(`- ${planBlock.more} more open tasks`);

    return {
      generated,
      subtitle,
      stage,
      facts,
      sections,
      history,
      plan: planBlock,
      text: lines.filter((l) => l !== undefined).join("\n"),
    };
  }, [loc, plan, updates]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.text);
      showToast("Location report copied");
    } catch {
      showToast("Could not copy the report");
    }
  };

  return (
    <div
      className="report-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <article
        className="report-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-report-title"
      >
        <header className="report-head">
          <div>
            <div className="report-kicker">Location report</div>
            <h2 id="loc-report-title">{loc.name || "Untitled location"}</h2>
            {model.subtitle ? <div className="sub">{model.subtitle}</div> : null}
            <div className="report-chips">
              <span className="pill report-chip">{model.stage}</span>
              {loc.health ? (
                <span className={`pill ${loc.health}`}>{healthLabel(loc.health)}</span>
              ) : (
                <span className="pill report-chip">Lease health not set</span>
              )}
              <span className="pill report-chip">{prio(loc)}</span>
            </div>
          </div>
          <div className="report-actions">
            <button type="button" className="btn" onClick={copy}>
              Copy
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {loc.address ? <p className="report-address">{loc.address}</p> : null}

        <div className="report-facts">
          {model.facts.map((f) => (
            <div key={f.label} className="report-fact">
              <div className="k">{f.label}</div>
              <div className={`v${f.warn ? " late" : ""}`}>{f.value}</div>
            </div>
          ))}
        </div>

        {model.sections.map((sec) => (
          <section key={sec.title} className="report-sec">
            <h3>{sec.title}</h3>
            <div className="report-rows">
              {sec.rows.map((row) => (
                <div
                  key={row.label}
                  className={`report-row${row.full ? " full" : ""}`}
                >
                  <div className="k">{row.label}</div>
                  <div className={`v${row.value === "Not set" ? " empty" : ""}${row.warn ? " late" : ""}`}>
                    {row.href ? (
                      <a href={row.href} target="_blank" rel="noreferrer">
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="report-sec">
          <h3>History</h3>
          {model.history.length ? (
            model.history.map((h, i) => (
              <div key={`${h.meta}-${i}`} className="report-history">
                <div>{h.text}</div>
                <div className="who">{h.meta}</div>
              </div>
            ))
          ) : (
            <div className="sub">Nothing logged yet.</div>
          )}
        </section>

        <section className="report-sec">
          <h3>Launch plan</h3>
          <div className="report-plan-summary">{model.plan.summary}</div>
          {model.plan.started ? (
            <>
              <div className="sub">Day 1 · {model.plan.startLabel}</div>
              {model.plan.progress !== null ? (
                <div className="report-bar" aria-hidden="true">
                  <span style={{ width: `${model.plan.progress}%` }} />
                </div>
              ) : null}
              {model.plan.tasks.length ? (
                <div className="report-tasks">
                  {model.plan.tasks.map((t) => (
                    <div key={t.name} className="report-task">
                      <div>{t.name}</div>
                      <div className={`who${t.warn ? " late" : ""}`}>{t.meta}</div>
                    </div>
                  ))}
                  {model.plan.more ? (
                    <div className="sub">{model.plan.more} more open tasks</div>
                  ) : null}
                </div>
              ) : (
                <div className="sub" style={{ marginTop: 8 }}>
                  Every open task is done.
                </div>
              )}
            </>
          ) : null}
        </section>

        <footer className="report-foot">Generated {model.generated}</footer>
      </article>
    </div>
  );
}
