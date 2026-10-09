import { prisma } from "@/lib/db";
import {
  logActivity,
  summarizeLocationPatch,
  summarizePlanChange,
} from "@/lib/activity";
import {
  asDate,
  locationPatchToDb,
  locationToApp,
  planTasksToDb,
  planToApp,
  Priority,
  templateTasksToDb,
  templateToApp,
  updateToApp,
} from "@/lib/mappers";
import { slug, today } from "@/lib/constants";
import type { Actor } from "@/lib/session";
import type { LaunchPlan, LaunchTemplate, Location, Update } from "@/lib/types";
import {
  ActivityAction,
  Country,
  Ownership,
  Stage,
  TaskStatus,
} from "@/generated/prisma/client";

export type TrackerPayload = {
  locations: Location[];
  updates: Update[];
  plans: Record<string, LaunchPlan>;
  template: LaunchTemplate;
};

async function lastEditorByLocation(
  updates: { locationId: string; authorName: string; createdAt: Date }[],
): Promise<Map<string, { name: string; at: Date }>> {
  const latest = new Map<string, { name: string; at: number }>();
  const consider = (id: string, name: string, at: Date) => {
    const trimmed = name.trim();
    if (!id || !trimmed) return;
    const time = at.getTime();
    const current = latest.get(id);
    if (!current || time >= current.at) latest.set(id, { name: trimmed, at: time });
  };

  for (const update of updates) {
    consider(update.locationId, update.authorName, update.createdAt);
  }

  const logs = await prisma.activityLog.findMany({
    where: {
      entity: "location",
      entityId: { not: null },
      action: { in: [ActivityAction.create, ActivityAction.edit] },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["entityId"],
    select: { entityId: true, actorName: true, createdAt: true },
  });
  for (const log of logs) {
    if (log.entityId) consider(log.entityId, log.actorName, log.createdAt);
  }

  return new Map(
    [...latest].map(([id, value]) => [id, { name: value.name, at: new Date(value.at) }]),
  );
}

export async function getTrackerData(options?: {
  includeLastEditor?: boolean;
}): Promise<TrackerPayload> {
  const [locations, updates, plans, template] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.locationUpdate.findMany({
      orderBy: { createdAt: "desc" },
      include: { location: { select: { name: true } } },
    }),
    prisma.launchPlan.findMany({
      include: { tasks: true },
    }),
    prisma.launchTemplate.findFirst({
      where: { isDefault: true },
      include: { tasks: true },
    }),
  ]);

  const plansByLoc: Record<string, LaunchPlan> = {};
  for (const plan of plans) {
    plansByLoc[plan.locationId] = planToApp(plan);
  }

  let appTemplate: LaunchTemplate;
  if (template) {
    appTemplate = templateToApp(template);
  } else {
    appTemplate = {
      name: "270-Day Launch Plan",
      days: 270,
      tasks: [],
    };
  }

  const editors = options?.includeLastEditor
    ? await lastEditorByLocation(updates)
    : null;

  return {
    locations: locations.map((row) => {
      const location = locationToApp(row);
      const editor = editors?.get(row.id);
      if (editor) {
        location.lastUpdatedBy = editor.name;
        if (editor.at.getTime() >= row.updatedAt.getTime()) {
          location.updatedAt = editor.at.toISOString();
        }
      }
      return location;
    }),
    updates: updates.map((u) => updateToApp(u, u.location.name)),
    plans: plansByLoc,
    template: appTemplate,
  };
}

export async function saveLocation(
  id: string,
  patch: Partial<Location>,
  logText?: string,
  actor?: Actor,
): Promise<{ location: Location; update?: Update }> {
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) throw new Error("Location not found");
  const before = locationToApp(existing);

  const data = locationPatchToDb({
    ...patch,
    lastTouched: today(),
  });

  const location = await prisma.location.update({
    where: { id },
    data,
  });

  if (actor) {
    await logActivity({
      actor,
      action: "edit",
      entity: "location",
      entityId: id,
      entityName: before.name,
      summary: summarizeLocationPatch(before, patch, logText),
    });
  }

  let update: Update | undefined;
  if (logText) {
    update = await postUpdate(id, logText, actor?.name || "You", true);
  }

  const saved = locationToApp(location);
  if (actor) saved.lastUpdatedBy = actor.name;
  return { location: saved, update };
}

export async function addLocation(
  name: string,
  actor?: Actor,
): Promise<Location> {
  const id = slug(name);
  const already = await prisma.location.findUnique({ where: { id } });
  const row = await prisma.location.upsert({
    where: { id },
    create: {
      id,
      name: name.trim(),
      stage: Stage.SITE_SEARCH,
      country: Country.USA,
      ownership: Ownership.FRANCHISE,
      priority: Priority.MEDIUM,
      lastTouched: asDate(today()),
    },
    update: {
      name: name.trim(),
      stage: Stage.SITE_SEARCH,
      country: Country.USA,
      ownership: Ownership.FRANCHISE,
      priority: Priority.MEDIUM,
      lastTouched: asDate(today()),
    },
  });
  if (actor) {
    await logActivity({
      actor,
      action: already ? "edit" : "create",
      entity: "location",
      entityId: row.id,
      entityName: row.name,
      summary: already
        ? `Updated location ${row.name}`
        : `Added location ${row.name}`,
    });
  }
  const created = locationToApp(row);
  if (actor) created.lastUpdatedBy = actor.name;
  return created;
}

export async function deleteLocation(id: string, actor?: Actor): Promise<void> {
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.location.delete({ where: { id } });
  if (actor) {
    await logActivity({
      actor,
      action: "delete",
      entity: "location",
      entityId: id,
      entityName: existing.name,
      summary: `Deleted location ${existing.name}`,
    });
  }
}

export async function postUpdate(
  locId: string,
  text: string,
  author = "You",
  touch = true,
  actor?: Actor,
): Promise<Update> {
  const location = await prisma.location.findUnique({ where: { id: locId } });
  if (!location) throw new Error("Location not found");

  const id = `u${Date.now()}`;
  const row = await prisma.locationUpdate.create({
    data: {
      id,
      locationId: locId,
      text,
      authorName: author,
      at: asDate(today())!,
    },
  });

  if (touch) {
    await prisma.location.update({
      where: { id: locId },
      data: { lastTouched: asDate(today()) },
    });
  }

  if (actor) {
    const clipped = text.length > 140 ? `${text.slice(0, 137)}…` : text;
    await logActivity({
      actor,
      action: "create",
      entity: "update",
      entityId: row.id,
      entityName: location.name,
      summary: `Posted an update on ${location.name}: ${clipped}`,
    });
  }

  return updateToApp(row, location.name);
}

export async function savePlan(
  locationId: string,
  plan: LaunchPlan,
  actor?: Actor,
): Promise<LaunchPlan> {
  const existing = await prisma.launchPlan.findUnique({
    where: { locationId },
    include: { tasks: true, location: { select: { name: true } } },
  });

  if (!existing) {
    throw new Error("Plan not found. Start a plan first.");
  }

  await prisma.launchPlanTask.deleteMany({ where: { planId: existing.id } });
  await prisma.launchPlan.update({
    where: { id: existing.id },
    data: {
      start: asDate(plan.start)!,
      tasks: {
        create: planTasksToDb(plan.tasks),
      },
    },
  });

  const updated = await prisma.launchPlan.findUniqueOrThrow({
    where: { id: existing.id },
    include: { tasks: true },
  });
  if (actor) {
    await logActivity({
      actor,
      action: "edit",
      entity: "launch_plan",
      entityId: locationId,
      entityName: existing.location.name,
      summary: summarizePlanChange(planToApp(existing), plan),
    });
  }
  return planToApp(updated);
}

export async function startPlan(
  locationId: string,
  start: string,
  actor?: Actor,
): Promise<LaunchPlan> {
  const template = await prisma.launchTemplate.findFirst({
    where: { isDefault: true },
    include: { tasks: true },
  });
  if (!template) throw new Error("No default launch template found");

  await prisma.launchPlan.deleteMany({ where: { locationId } });

  const created = await prisma.launchPlan.create({
    data: {
      locationId,
      templateId: template.id,
      start: asDate(start)!,
      tasks: {
        create: template.tasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((t, index) => ({
            tid: t.tid,
            phase: t.phase,
            task: t.task,
            owner: t.owner,
            startOffset: t.startOffset,
            endOffset: t.endOffset,
            critical: t.critical,
            sortOrder: index,
            status: TaskStatus.NOT_STARTED,
          })),
      },
    },
    include: { tasks: true },
  });

  if (actor) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });
    await logActivity({
      actor,
      action: "create",
      entity: "launch_plan",
      entityId: locationId,
      entityName: location?.name,
      summary: `Started the 270-day launch plan for ${location?.name || "a location"} (day 1 ${start})`,
    });
  }

  return planToApp(created);
}

export async function saveTemplateFromPlan(
  locationId: string,
  actor?: Actor,
): Promise<LaunchTemplate> {
  const plan = await prisma.launchPlan.findUnique({
    where: { locationId },
    include: { tasks: true },
  });
  if (!plan) throw new Error("Plan not found");

  let template = await prisma.launchTemplate.findFirst({
    where: { isDefault: true },
  });

  const taskData = plan.tasks
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      tid: t.tid,
      phase: t.phase,
      task: t.task,
      owner: t.owner,
      s: t.startOffset,
      e: t.endOffset,
      crit: t.critical,
    }));

  if (!template) {
    template = await prisma.launchTemplate.create({
      data: {
        name: "270-Day Launch Plan",
        days: 270,
        isDefault: true,
        tasks: { create: templateTasksToDb(taskData) },
      },
    });
  } else {
    await prisma.launchTemplateTask.deleteMany({
      where: { templateId: template.id },
    });
    template = await prisma.launchTemplate.update({
      where: { id: template.id },
      data: {
        tasks: { create: templateTasksToDb(taskData) },
      },
    });
  }

  const full = await prisma.launchTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: { tasks: true },
  });
  if (actor) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });
    await logActivity({
      actor,
      action: "edit",
      entity: "launch_template",
      entityId: full.id,
      entityName: location?.name,
      summary: `Saved the launch plan for ${location?.name || "a location"} as the default template`,
    });
  }
  return templateToApp(full);
}
