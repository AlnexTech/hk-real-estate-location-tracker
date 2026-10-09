import { prisma } from "@/lib/db";
import { sendActivityNotification } from "@/lib/mail";
import type { Actor } from "@/lib/session";
import type { LaunchPlan, Location } from "@/lib/types";
import { FIELDS, daysSince } from "@/lib/constants";
import { ActivityAction } from "@/generated/prisma/client";
import { toUserRole } from "@/lib/user-role";

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

export async function daysWithoutLocationUpdate(
  agents: { id: string; name: string }[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  for (const agent of agents) result.set(agent.id, null);
  if (agents.length === 0) return result;

  const ids = agents.map((agent) => agent.id);
  const names = [...new Set(agents.map((agent) => agent.name).filter(Boolean))];

  const [logs, notes] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        userId: { in: ids },
        OR: [
          {
            entity: "location",
            action: { in: [ActivityAction.create, ActivityAction.edit] },
          },
          { entity: "update", action: ActivityAction.create },
        ],
      },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
      select: { userId: true, createdAt: true },
    }),
    names.length
      ? prisma.locationUpdate.findMany({
          where: { authorName: { in: names } },
          orderBy: { createdAt: "desc" },
          distinct: ["authorName"],
          select: { authorName: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const latestLog = new Map<string, Date>();
  for (const log of logs) {
    if (log.userId) latestLog.set(log.userId, log.createdAt);
  }
  const latestNote = new Map(notes.map((note) => [note.authorName, note.createdAt]));

  for (const agent of agents) {
    const times = [latestLog.get(agent.id), latestNote.get(agent.name)].filter(
      (value): value is Date => value instanceof Date,
    );
    if (times.length === 0) continue;
    const newest = times.reduce((left, right) => (left > right ? left : right));
    result.set(agent.id, daysSince(newest.toISOString()) ?? 0);
  }

  return result;
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
      actorRole: toUserRole(input.actor.role),
      action: ActivityAction[input.action],
      entity: input.entity,
      entityId: input.entityId,
      entityName: input.entityName,
      summary: input.summary,
    },
  });

  try {
    await sendActivityNotification({
      actorName: input.actor.name,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      action: input.action,
      entity: input.entity,
      entityName: input.entityName,
      summary: input.summary,
    });
  } catch (error) {
    console.error("Activity notification failed", error);
  }
}
