"use client";

import {
  TSTATUS,
  days,
  fmt,
  today,
} from "@/lib/constants";
import {
  currentPhase,
  dayOffsetFromStart,
  daysElapsed,
  daysRemaining,
  isTaskOverdue,
  LAUNCH_PLAN_DAYS,
  overdueTasks,
  planProgress,
  taskPlannedEnd,
  taskPlannedStart,
  upcomingTasks,
} from "@/lib/launch-schedule";
import { LAUNCH_PHASES } from "@/lib/launch-template-data";
import { useTracker } from "@/lib/store";
import type { PlanTask, TaskStatus } from "@/lib/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

type PlanTab = "list" | "gantt";
type DueFilter = "" | "overdue" | "upcoming" | "done";

export function PlanView() {
  const {
    locations,
    plans,
    template,
    planLoc,
    setPlanLoc,
    openId,
    canWrite,
    isAdmin,
    startPlan,
    savePlan,
    saveTemplateFromPlan,
    showToast,
  } = useTracker();

  const [newStart, setNewStart] = useState(today);
  const [tab, setTab] = useState<PlanTab>("list");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("");
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editTask, setEditTask] = useState<PlanTask | null>(null);

  const opts = useMemo(
    () =>
      [...locations].sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      ),
    [locations],
  );

  useEffect(() => {
    if (!planLoc || !locations.find((l) => l.id === planLoc)) {
      const next =
        (openId && locations.find((l) => l.id === openId)?.id) ||
        opts[0]?.id ||
        "";
      if (next) setPlanLoc(next);
    }
  }, [planLoc, locations, openId, opts, setPlanLoc]);

  const loc = locations.find((x) => x.id === planLoc);
  const p = plans[planLoc];
  const prog = planProgress(p);
  const total = template?.days || LAUNCH_PLAN_DAYS;
  const opening = p?.openingDate || "";
  const phase = currentPhase(p);
  const overdue = p ? overdueTasks(p) : [];
  const upcoming = p ? upcomingTasks(p, 5) : [];
  const elapsed = p?.start ? daysElapsed(p.start) : 0;
  const remaining = opening ? daysRemaining(opening) : null;

  const owners = useMemo(() => {
    if (!p) return [] as string[];
    return [...new Set(p.tasks.map((t) => t.owner).filter(Boolean))].sort();
  }, [p]);

  const filteredTasks = useMemo(() => {
    if (!p) return [] as PlanTask[];
    return p.tasks.filter((t) => {
      if (phaseFilter && t.phase !== phaseFilter) return false;
      if (statusFilter && (t.status || "Not Started") !== statusFilter)
        return false;
      if (ownerFilter && t.owner !== ownerFilter) return false;
      if (dueFilter === "overdue" && !isTaskOverdue(t, p.start)) return false;
      if (dueFilter === "done" && t.status !== "Done") return false;
      if (dueFilter === "upcoming") {
        const end = taskPlannedEnd(t, p.start);
        if (t.status === "Done" || t.status === "N/A") return false;
        if (isTaskOverdue(t, p.start)) return false;
        const n = days(end);
        if (n === null || n > 30) return false;
      }
      if (q) {
        const hay = `${t.task} ${t.owner} ${t.primaryContact || ""} ${t.secondaryContact || ""} ${t.phase}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [p, phaseFilter, statusFilter, ownerFilter, dueFilter, q]);

  const saveTaskPatch = (tid: string, patch: Partial<PlanTask>) => {
    if (!p) return;
    const tasks = p.tasks.map((t) =>
      t.tid === tid ? { ...t, ...patch } : t,
    );
    void savePlan(planLoc, { tasks });
  };

  const onSaveTaskDetail = (next: PlanTask) => {
    if (!p) return;
    const tasks = p.tasks.map((t) => (t.tid === next.tid ? next : t));
    void savePlan(planLoc, { tasks });
    setEditTask(null);
  };

  return (
    <div className="plan-view">
      <div className="planhead">
        <div className="f plan-loc">
          <label>Location</label>
          <select
            id="planSel"
            value={planLoc}
            onChange={(e) => setPlanLoc(e.target.value)}
          >
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {!p && (
          <>
            <div className="f" style={{ width: 200 }}>
              <label>Planned start (Day 0)</label>
              <input
                key="new-start"
                type="date"
                value={newStart}
                disabled={!isAdmin}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn primary"
              disabled={!isAdmin}
              onClick={() => {
                if (!template) {
                  showToast("Plan template not loaded yet");
                  return;
                }
                startPlan(planLoc, newStart || today());
              }}
            >
              Start 270-day plan
            </button>
          </>
        )}
        {p && isAdmin && (
          <button
            type="button"
            className="btn plan-admin-btn"
            onClick={() => saveTemplateFromPlan(planLoc)}
          >
            Save as default
          </button>
        )}
      </div>

      {!p ? (
        <div className="empty">
          No launch plan yet for {loc?.name || ""}.
          {isAdmin
            ? " Enter the planned start date (site selected and lease signed or submitted) to create the plan. All task end dates and the opening date will be filled automatically."
            : " An admin sets the planned start date to create the plan."}
        </div>
      ) : (
        <>
          <section className="plan-overview">
            <div className="plan-overview-main">
              <div className="plan-progress-block">
                <div className="plan-progress-top">
                  <span className="plan-progress-label">Progress</span>
                  <strong>{prog ?? 0}%</strong>
                </div>
                <div className="pbar">
                  <i style={{ width: `${prog ?? 0}%` }} />
                </div>
                <div className="plan-progress-meta">
                  Day {elapsed} of {total}
                  {phase ? ` · ${phase}` : ""}
                </div>
              </div>
              <div className="plan-metrics">
                <div className="plan-metric">
                  <span className="plan-metric-label">Day 0</span>
                  <span className="plan-metric-value">{fmt(p.start)}</span>
                </div>
                <div className="plan-metric">
                  <span className="plan-metric-label">Opening</span>
                  <span className="plan-metric-value">
                    {fmt(opening) || "—"}
                  </span>
                </div>
                <div className="plan-metric">
                  <span className="plan-metric-label">Remaining</span>
                  <span className="plan-metric-value">
                    {remaining === null
                      ? "—"
                      : remaining >= 0
                        ? `${remaining}d`
                        : `${-remaining}d past`}
                  </span>
                </div>
                <div
                  className={`plan-metric${overdue.length ? " warn" : ""}`}
                >
                  <span className="plan-metric-label">Overdue</span>
                  <span className="plan-metric-value">{overdue.length}</span>
                </div>
              </div>
            </div>
            <div className="plan-next">
              <div className="plan-next-label">Up next</div>
              {upcoming.length ? (
                <ul>
                  {upcoming.slice(0, 3).map((t) => {
                    const end = taskPlannedEnd(t, p.start);
                    const late = isTaskOverdue(t, p.start);
                    return (
                      <li key={t.tid}>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setEditTask(t)}
                        >
                          {t.task}
                        </button>
                        <span className={late ? "late" : "sub"}>
                          {fmt(end)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="sub">All caught up</p>
              )}
            </div>
          </section>

          <div className="plan-toolbar">
            <div className="plan-toolbar-top">
              <div className="seg">
                <button
                  type="button"
                  className={tab === "list" ? "on" : ""}
                  onClick={() => setTab("list")}
                >
                  Tasks
                </button>
                <button
                  type="button"
                  className={tab === "gantt" ? "on" : ""}
                  onClick={() => setTab("gantt")}
                >
                  Timeline
                </button>
              </div>
              <input
                className="plan-search"
                placeholder="Search tasks…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="plan-filters">
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
              >
                <option value="">All phases</option>
                {LAUNCH_PHASES.map((ph) => (
                  <option key={ph} value={ph}>
                    {ph}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {TSTATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="">All responsible</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              >
                <option value="">Any due date</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Due in 30 days</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {tab === "list" ? (
            <div className="tablewrap plan-tablewrap">
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Task</th>
                    <th>Responsible</th>
                    <th>Planned</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let phaseName = "";
                    const rows: ReactNode[] = [];
                    filteredTasks.forEach((t) => {
                      if (t.phase !== phaseName) {
                        phaseName = t.phase;
                        const isCollapsed = !!collapsed[phaseName];
                        const phaseTasks = filteredTasks.filter(
                          (x) => x.phase === phaseName,
                        );
                        const done = phaseTasks.filter(
                          (x) => x.status === "Done",
                        ).length;
                        rows.push(
                          <tr
                            key={`ph-${phaseName}`}
                            className="phaserow"
                            onClick={() =>
                              setCollapsed((c) => ({
                                ...c,
                                [phaseName]: !c[phaseName],
                              }))
                            }
                          >
                            <td colSpan={5}>
                              <span className="phase-toggle">
                                {isCollapsed ? "▸" : "▾"}
                              </span>
                              <span className="phase-name">{phaseName}</span>
                              <span className="phase-count">
                                {done}/{phaseTasks.length}
                              </span>
                            </td>
                          </tr>,
                        );
                      }
                      if (collapsed[phaseName]) return;
                      const st = taskPlannedStart(t, p.start);
                      const en = taskPlannedEnd(t, p.start);
                      const late = isTaskOverdue(t, p.start);
                      rows.push(
                        <tr
                          key={t.tid}
                          className={`trow ${t.status === "Done" ? "done" : ""}`}
                        >
                          <td>
                            <select
                              className="plan-status"
                              value={t.status || "Not Started"}
                              disabled={!canWrite}
                              onChange={(e) =>
                                saveTaskPatch(t.tid, {
                                  status: e.target.value as TaskStatus,
                                })
                              }
                            >
                              {TSTATUS.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          </td>
                          <td className="tname">
                            <button
                              type="button"
                              className="linkish"
                              onClick={() => setEditTask(t)}
                            >
                              {t.crit && (
                                <span className="prio High">Critical</span>
                              )}{" "}
                              {t.task}
                            </button>
                            {(t.primaryContact || t.secondaryContact) && (
                              <div className="sub">
                                {[t.primaryContact, t.secondaryContact]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                          </td>
                          <td className="plan-owner">{t.owner || "—"}</td>
                          <td className={`plan-dates${late ? " late" : ""}`}>
                            <span>
                              {fmt(st)} – {fmt(en)}
                            </span>
                            {late ? (
                              <span className="overdue-tag">Overdue</span>
                            ) : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="plan-open-btn"
                              onClick={() => setEditTask(t)}
                            >
                              Open
                            </button>
                          </td>
                        </tr>,
                      );
                    });
                    if (!rows.length) {
                      rows.push(
                        <tr key="empty">
                          <td colSpan={5} className="sub">
                            No tasks match these filters.
                          </td>
                        </tr>,
                      );
                    }
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tablewrap plan-tablewrap">
              <table className="ptable gantt-table">
                <thead>
                  <tr>
                    <th style={{ width: 240 }}>Task</th>
                    <th>
                      Timeline
                      <span className="gantt-open-mark">
                        {" "}
                        · Opening {fmt(opening)}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const st = taskPlannedStart(t, p.start);
                    const en = taskPlannedEnd(t, p.start);
                    const left = dayOffsetFromStart(p.start, st);
                    const right = dayOffsetFromStart(p.start, en);
                    const width = Math.max(1, right - left + 1);
                    const late = isTaskOverdue(t, p.start);
                    return (
                      <tr
                        key={t.tid}
                        className={t.status === "Done" ? "done" : ""}
                      >
                        <td className="tname">
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => setEditTask(t)}
                          >
                            {t.task}
                          </button>
                          <div className="sub">{t.phase}</div>
                        </td>
                        <td>
                          <div className="gantt gantt-wide">
                            <i
                              className={`${t.crit ? "crit" : ""} ${late ? "late-bar" : ""}`}
                              style={{
                                left: `${((left / total) * 100).toFixed(2)}%`,
                                width: `${Math.max(0.8, (width / total) * 100).toFixed(2)}%`,
                              }}
                              title={`${fmt(st)} → ${fmt(en)}`}
                            />
                            <span
                              className="gantt-opening"
                              style={{
                                left: `${((LAUNCH_PLAN_DAYS / total) * 100).toFixed(2)}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editTask && p && (
        <TaskDetailModal
          task={editTask}
          planStart={p.start}
          openingDate={opening}
          drive={loc?.drive}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onClose={() => setEditTask(null)}
          onSave={onSaveTaskDetail}
        />
      )}
    </div>
  );
}

function TaskDetailModal({
  task,
  planStart,
  openingDate,
  drive,
  canWrite,
  isAdmin,
  onClose,
  onSave,
}: {
  task: PlanTask;
  planStart: string;
  openingDate: string;
  drive?: string;
  canWrite: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (task: PlanTask) => void;
}) {
  const [draft, setDraft] = useState<PlanTask>({ ...task });

  useEffect(() => {
    setDraft({ ...task });
  }, [task]);

  const set = <K extends keyof PlanTask>(key: K, value: PlanTask[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <Modal open onClose={onClose} className="task-detail-modal">
      <h3>{draft.task}</h3>
      <div className="sub" style={{ marginBottom: 12 }}>
        {draft.phase} · Day 0 {fmt(planStart)} · Opening {fmt(openingDate)}
      </div>

      <div className="task-detail-grid">
        <div className="f">
          <label>Status</label>
          <select
            value={draft.status || "Not Started"}
            disabled={!canWrite}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
          >
            {TSTATUS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="f">
          <label>Responsible party</label>
          <input value={draft.owner || ""} disabled readOnly />
        </div>
        <div className="f">
          <label>Primary contact</label>
          <input
            value={draft.primaryContact || ""}
            disabled={!isAdmin}
            onChange={(e) => set("primaryContact", e.target.value)}
          />
        </div>
        <div className="f">
          <label>Secondary contact</label>
          <input
            value={draft.secondaryContact || ""}
            disabled={!isAdmin}
            onChange={(e) => set("secondaryContact", e.target.value)}
          />
        </div>
        <div className="f">
          <label>Planned start</label>
          <input
            type="date"
            value={draft.plannedStart || taskPlannedStart(draft, planStart)}
            disabled={!isAdmin}
            onChange={(e) => set("plannedStart", e.target.value)}
          />
        </div>
        <div className="f">
          <label>Planned end</label>
          <input
            type="date"
            value={draft.plannedEnd || taskPlannedEnd(draft, planStart)}
            disabled={!isAdmin}
            onChange={(e) => set("plannedEnd", e.target.value)}
          />
        </div>
        <div className="f">
          <label>Actual start</label>
          <input
            type="date"
            value={draft.actualStart || ""}
            disabled={!canWrite}
            onChange={(e) => set("actualStart", e.target.value)}
          />
        </div>
        <div className="f">
          <label>Actual finish</label>
          <input
            type="date"
            value={draft.actualFinish || ""}
            disabled={!canWrite}
            onChange={(e) => set("actualFinish", e.target.value)}
          />
        </div>
        <div className="f" style={{ gridColumn: "1 / -1" }}>
          <label>Notes</label>
          <textarea
            rows={3}
            value={draft.notes || ""}
            disabled={!canWrite}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        {drive ? (
          <div className="f" style={{ gridColumn: "1 / -1" }}>
            <label>Location drive folder</label>
            <a href={drive} target="_blank" rel="noreferrer">
              {drive}
            </a>
          </div>
        ) : null}
      </div>

      {isAdmin && (
        <p className="sub" style={{ marginTop: 10 }}>
          Changing planned dates updates this task only. The ultimate opening
          date ({fmt(openingDate)}) stays fixed.
        </p>
      )}

      <div className="mrow">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!canWrite && !isAdmin}
          onClick={() => onSave(draft)}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
