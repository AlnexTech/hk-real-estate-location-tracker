import { addDays, days, today } from "@/lib/constants";
import {
  inclusiveDuration,
  LAUNCH_PLAN_DAYS,
} from "@/lib/launch-template-data";
import type { LaunchPlan, PlanTask, TaskStatus } from "@/lib/types";

export { inclusiveDuration, LAUNCH_PLAN_DAYS };

/** Grand Opening is Day 0 + 270 (inclusive day number from the sheet). */
export function openingDateFromDay0(day0: string): string {
  return addDays(day0, LAUNCH_PLAN_DAYS);
}

export function plannedStartFromOffsets(
  day0: string,
  startOffset: number,
): string {
  return addDays(day0, startOffset);
}

export function plannedEndFromOffsets(day0: string, endOffset: number): string {
  return addDays(day0, endOffset);
}

export function materializeTaskDates(
  day0: string,
  task: Pick<PlanTask, "s" | "e" | "duration">,
): { plannedStart: string; plannedEnd: string; duration: number } {
  return {
    plannedStart: plannedStartFromOffsets(day0, task.s),
    plannedEnd: plannedEndFromOffsets(day0, task.e),
    duration: task.duration ?? inclusiveDuration(task.s, task.e),
  };
}

export function materializePlanTasks(
  day0: string,
  tasks: Omit<PlanTask, "status" | "plannedStart" | "plannedEnd">[],
): PlanTask[] {
  return tasks.map((task) => {
    const dates = materializeTaskDates(day0, task);
    return {
      ...task,
      ...dates,
      status: "Not Started" as TaskStatus,
    };
  });
}

export function isTerminalStatus(status?: TaskStatus | string): boolean {
  return status === "Done" || status === "N/A";
}

export function isTaskOverdue(
  task: Pick<PlanTask, "status" | "plannedEnd" | "e">,
  planStart?: string,
  asOf: string = today(),
): boolean {
  if (isTerminalStatus(task.status)) return false;
  const end =
    task.plannedEnd ||
    (planStart !== undefined ? plannedEndFromOffsets(planStart, task.e) : "");
  if (!end) return false;
  const n = days(end);
  if (n === null) return false;
  // days() is relative to today(); for asOf override compare manually
  if (asOf === today()) return n < 0;
  const endMs = new Date(end + "T00:00:00").getTime();
  const asOfMs = new Date(asOf + "T00:00:00").getTime();
  return endMs < asOfMs;
}

export function planProgress(
  p?: { tasks?: { status?: string }[] } | null,
): number | null {
  if (!p?.tasks?.length) return null;
  const live = p.tasks.filter((t) => t.status !== "N/A");
  if (!live.length) return 0;
  return Math.round(
    (live.filter((t) => t.status === "Done").length / live.length) * 100,
  );
}

export function currentPhase(plan: LaunchPlan | undefined | null): string {
  if (!plan?.tasks?.length) return "";
  const open = plan.tasks.find((t) => !isTerminalStatus(t.status));
  return open?.phase || plan.tasks[plan.tasks.length - 1]?.phase || "";
}

export function daysElapsed(day0: string, asOf: string = today()): number {
  const start = new Date(day0 + "T00:00:00").getTime();
  const now = new Date(asOf + "T00:00:00").getTime();
  return Math.max(0, Math.round((now - start) / 864e5));
}

export function daysRemaining(
  openingDate: string,
  asOf: string = today(),
): number {
  const open = new Date(openingDate + "T00:00:00").getTime();
  const now = new Date(asOf + "T00:00:00").getTime();
  return Math.round((open - now) / 864e5);
}

export function overdueTasks(plan: LaunchPlan, asOf: string = today()): PlanTask[] {
  return plan.tasks.filter((t) => isTaskOverdue(t, plan.start, asOf));
}

export function upcomingTasks(
  plan: LaunchPlan,
  limit = 5,
  asOf: string = today(),
): PlanTask[] {
  return plan.tasks
    .filter((t) => !isTerminalStatus(t.status))
    .slice()
    .sort((a, b) => {
      const ae = a.plannedEnd || plannedEndFromOffsets(plan.start, a.e);
      const be = b.plannedEnd || plannedEndFromOffsets(plan.start, b.e);
      return ae.localeCompare(be) || a.s - b.s;
    })
    .filter((t) => {
      const end = t.plannedEnd || plannedEndFromOffsets(plan.start, t.e);
      return end >= asOf || isTaskOverdue(t, plan.start, asOf);
    })
    .slice(0, limit);
}

/**
 * Applying a local planned-date edit must not change the plan opening date.
 * Returns the same openingDate that was passed in.
 */
export function openingDateAfterTaskEdit(
  openingDate: string,
  _editedTask: Pick<PlanTask, "plannedStart" | "plannedEnd">,
): string {
  return openingDate;
}

export function taskPlannedEnd(
  task: Pick<PlanTask, "plannedEnd" | "e">,
  planStart: string,
): string {
  return task.plannedEnd || plannedEndFromOffsets(planStart, task.e);
}

export function taskPlannedStart(
  task: Pick<PlanTask, "plannedStart" | "s">,
  planStart: string,
): string {
  return task.plannedStart || plannedStartFromOffsets(planStart, task.s);
}

/** Offset of a calendar date from Day 0 for Gantt positioning. */
export function dayOffsetFromStart(day0: string, date: string): number {
  const a = new Date(day0 + "T00:00:00").getTime();
  const b = new Date(date + "T00:00:00").getTime();
  return Math.round((b - a) / 864e5);
}
