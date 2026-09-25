"use client";

import {
  TSTATUS,
  addDays,
  days,
  fmt,
  planProgress,
  today,
} from "@/lib/constants";
import { useTracker } from "@/lib/store";
import type { PlanTask, TaskStatus } from "@/lib/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PromptModal } from "./Modal";

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
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newStart, setNewStart] = useState(today);

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
  const total = template?.days || 270;

  return (
    <div>
      <div className="planhead">
        <div className="f" style={{ minWidth: 230 }}>
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
        {p ? (
          <>
            <div className="f" style={{ width: 170 }}>
              <label>Day 1 (franchise signing)</label>
              <input
                key="plan-start"
                type="date"
                value={p.start || ""}
                disabled={!canWrite}
                onChange={(e) => savePlan(planLoc, { start: e.target.value })}
              />
            </div>
            <div className="f" style={{ flex: 1, minWidth: 180 }}>
              <label>
                Progress · {prog}% · target open{" "}
                {fmt(addDays(p.start, total - 1))}
              </label>
              <div className="pbar">
                <i style={{ width: `${prog ?? 0}%` }} />
              </div>
            </div>
            <button
              type="button"
              className="btn"
              disabled={!canWrite}
              onClick={() => setAddTaskOpen(true)}
            >
              + Task
            </button>
            {isAdmin && (
              <button
                type="button"
                className="btn"
                onClick={() => saveTemplateFromPlan(planLoc)}
              >
                Save as default plan
              </button>
            )}
          </>
        ) : (
          <>
            <div className="f" style={{ width: 170 }}>
              <label>Day 1 (franchise signing)</label>
              <input
                key="new-start"
                type="date"
                value={newStart}
                disabled={!canWrite}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn primary"
              disabled={!canWrite}
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
      </div>

      {!p ? (
        <div className="empty">
          No launch plan yet for {loc?.name || ""}. Pick the franchise signing
          date and start the 270-day plan.
        </div>
      ) : (
        <div className="tablewrap">
          <table className="ptable">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Status</th>
                <th>Task</th>
                <th style={{ width: 150 }}>Owner</th>
                <th style={{ width: 170 }}>Dates</th>
                <th style={{ width: 180 }}>
                  Day 1 → {total}
                </th>
                <th style={{ width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {(() => {
                let phase = "";
                const rows: ReactNode[] = [];
                p.tasks.forEach((t, i) => {
                  if (t.phase !== phase) {
                    phase = t.phase;
                    rows.push(
                      <tr key={`ph-${phase}-${i}`} className="phaserow">
                        <td colSpan={6}>{phase}</td>
                      </tr>,
                    );
                  }
                  const st = addDays(p.start, t.s);
                  const en = addDays(p.start, t.e);
                  const late =
                    t.status !== "Done" &&
                    t.status !== "N/A" &&
                    days(en)! < 0;
                  rows.push(
                    <tr
                      key={t.tid || i}
                      className={`trow ${t.status === "Done" ? "done" : ""}`}
                    >
                      <td>
                        <select
                          value={t.status || "Not Started"}
                          disabled={!canWrite}
                          onChange={(e) => {
                            const tasks = [...p.tasks];
                            tasks[i] = {
                              ...tasks[i],
                              status: e.target.value as TaskStatus,
                            };
                            savePlan(planLoc, { tasks });
                          }}
                        >
                          {TSTATUS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </td>
                      <td className="tname">
                        {t.crit && (
                          <span className="prio High">Critical</span>
                        )}{" "}
                        {t.task}
                      </td>
                      <td className="sub">{t.owner || ""}</td>
                      <td className={late ? "late" : ""}>
                        {fmt(st)} → {fmt(en)}
                      </td>
                      <td>
                        <div className="gantt">
                          <i
                            className={t.crit ? "crit" : ""}
                            style={{
                              left: `${((t.s / total) * 100).toFixed(1)}%`,
                              width: `${Math.max(1.5, ((t.e - t.s + 1) / total) * 100).toFixed(1)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        {canWrite && (
                          <button
                            type="button"
                            className="xbtn"
                            title="Remove task"
                            onClick={() => {
                              const tasks = p.tasks.filter((_, idx) => idx !== i);
                              savePlan(planLoc, { tasks });
                            }}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>,
                  );
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      )}

      <PromptModal
        open={addTaskOpen}
        title="Add a task"
        fields={[
          { label: "Task" },
          { label: "Owner" },
          { label: "Start day", type: "number", value: "0" },
          { label: "End day", type: "number", value: "0" },
        ]}
        okLabel="Add"
        onCancel={() => setAddTaskOpen(false)}
        onOk={(r) => {
          setAddTaskOpen(false);
          if (!r[0] || !p) return;
          const task: PlanTask = {
            tid: `x${Date.now()}`,
            phase: "Added",
            task: r[0],
            owner: r[1] || "",
            s: +r[2] || 0,
            e: +r[3] || +r[2] || 0,
            crit: false,
            status: "Not Started",
          };
          savePlan(planLoc, { tasks: [...p.tasks, task] });
        }}
      />
    </div>
  );
}
