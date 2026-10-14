import { isAdminRole } from "@/lib/roles";
import type { LaunchPlan, Location, PlanTask } from "@/lib/types";
import type { AppRole } from "@/types/next-auth";

/** Fields a real estate agent can change. Admins can change every field. */
const AGENT_LOCATION_KEYS = new Set<string>([
  "stage",
  "health",
  "priority",
  "actualOpen",
  "targetOpen",
  "loiStatus",
  "loiSent",
  "loiSigned",
  "leaseDraft",
  "leaseAttorney",
  "leaseSigned",
]);

/** Task fields agents may update on an existing plan. */
const AGENT_TASK_KEYS = new Set<string>([
  "status",
  "actualStart",
  "actualFinish",
  "notes",
]);

export function agentMayPatchLocation(patch: Partial<Location>): boolean {
  return Object.keys(patch).every((key) => AGENT_LOCATION_KEYS.has(key));
}

export function mayStartLaunchPlan(role?: AppRole | string | null): boolean {
  return isAdminRole(role);
}

export function mayEditPlanSchedule(role?: AppRole | string | null): boolean {
  return isAdminRole(role);
}

export function mayEditPlanContacts(role?: AppRole | string | null): boolean {
  return isAdminRole(role);
}

/**
 * Agents may only change status / actual dates / notes on tasks.
 * Admins may change any plan field except openingDate (locked after create).
 */
export function assertPlanSaveAllowed(
  role: AppRole | string,
  before: LaunchPlan,
  next: LaunchPlan,
): void {
  if (isAdminRole(role)) {
    if (before.openingDate && next.openingDate !== before.openingDate) {
      throw new Error("Opening date cannot be changed after the plan is created");
    }
    if (next.start !== before.start) {
      throw new Error(
        "Day 0 cannot be changed after the plan is created; edit individual task dates instead",
      );
    }
    return;
  }

  if (next.start !== before.start || next.openingDate !== before.openingDate) {
    throw new Error("Only admins can change the launch schedule");
  }

  const prevByTid = new Map(before.tasks.map((t) => [t.tid, t]));
  if (next.tasks.length !== before.tasks.length) {
    throw new Error("Only admins can add or remove launch tasks");
  }

  for (const task of next.tasks) {
    const prior = prevByTid.get(task.tid);
    if (!prior) {
      throw new Error("Only admins can add or remove launch tasks");
    }
    assertAgentTaskPatch(prior, task);
  }
}

function assertAgentTaskPatch(prior: PlanTask, next: PlanTask): void {
  const keys = new Set([
    ...Object.keys(prior),
    ...Object.keys(next),
  ]) as Set<keyof PlanTask>;

  for (const key of keys) {
    const a = prior[key] ?? "";
    const b = next[key] ?? "";
    if (String(a) === String(b)) continue;
    if (!AGENT_TASK_KEYS.has(key as string)) {
      throw new Error(
        "Agents can only update task status, actual dates, and notes",
      );
    }
  }
}
