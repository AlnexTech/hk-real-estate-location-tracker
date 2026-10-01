import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/session";
import type { LaunchPlan, Location } from "@/lib/types";
import { FIELDS } from "@/lib/constants";
import { ActivityAction, UserRole } from "@/generated/prisma/client";

const FIELD_LABELS = new Map<string, string>([["name", "Name"]]);
for (const field of FIELDS) {
  if (field[0] !== "sec") FIELD_LABELS.set(field[0], field[1]);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  const text = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
  return normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
}

function same(left: unknown, right: unknown): boolean {
  return show(left) === show(right);
}

export function summarizeLocationPatch(
  before: Location,
  patch: Partial<Location>,
  note?: string,
): string {
  const changes: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "lastTouched" || key === "updatedAt" || key === "id") continue;
    const previous = (before as unknown as Record<string, unknown>)[key];
    if (same(previous, value)) continue;
    const label = FIELD_LABELS.get(key) || key;
    changes.push(`${label}: ${show(previous)} → ${show(value)}`);
  }
  const summary = changes.join("; ") || "Saved the location";
  if (!note?.trim()) return summary;
  return `${summary}. Note: ${show(note.trim())}`;
}

export function summarizePlanChange(before: LaunchPlan, next: LaunchPlan): string {
  const bits: string[] = [];
  if (!same(before.start, next.start)) {
    bits.push(`start ${show(before.start)} → ${show(next.start)}`);
  }
  const previous = new Map(before.tasks.map((task) => [task.tid, task]));
  let statusChanges = 0;
  let added = 0;
  for (const task of next.tasks) {
    const prior = previous.get(task.tid);
    if (!prior) {
      added += 1;
      continue;
    }
    if (!same(prior.status, task.status)) statusChanges += 1;
  }
  if (added) bits.push(added === 1 ? "1 task added" : `${added} tasks added`);
  if (statusChanges) {
    bits.push(
      statusChanges === 1
        ? "1 task status change"
        : `${statusChanges} task status changes`,
    );
  }
  return bits.length ? `Updated the launch plan (${bits.join("; ")})` : "Updated the launch plan";
}

export async function logActivity(input: {
  actor: Actor;
  action: "create" | "edit" | "delete";
  entity: string;
  entityId?: string;
  entityName?: string;
  summary: string;
}) {
  await prisma.activityLog.create({
    data: {
      userId: input.actor.id,
      actorName: input.actor.name,
      actorEmail: input.actor.email,
      actorRole: input.actor.role === "admin" ? UserRole.admin : UserRole.agent,
      action: ActivityAction[input.action],
      entity: input.entity,
      entityId: input.entityId,
      entityName: input.entityName,
      summary: input.summary,
    },
  });
}
