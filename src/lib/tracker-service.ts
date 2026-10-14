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
import {
  materializeTaskDates,
  openingDateFromDay0,
} from "@/lib/launch-schedule";
import {
  assertPlanSaveAllowed,
  mayStartLaunchPlan,
} from "@/lib/permissions";
import { HttpError, type Actor } from "@/lib/session";
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
    const { DEFAULT_LAUNCH_TEMPLATE } = await import("@/lib/launch-template-data");
    appTemplate = DEFAULT_LAUNCH_TEMPLATE;
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

  const before = planToApp(existing);
  // Opening date is locked after creation; always persist the stored value.
  const nextPlan: LaunchPlan = {
    ...plan,
    start: before.start,
    openingDate: before.openingDate,
  };

  if (actor) {
    try {
      assertPlanSaveAllowed(actor.role, before, nextPlan);
    } catch (error) {
      throw new HttpError(
        403,
        error instanceof Error ? error.message : "Not allowed",
      );
    }
  }

  await prisma.launchPlanTask.deleteMany({ where: { planId: existing.id } });
  await prisma.launchPlan.update({
    where: { id: existing.id },
    data: {
      tasks: {
        create: planTasksToDb(nextPlan.tasks),
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
      summary: summarizePlanChange(before, nextPlan),
    });
  }
  return planToApp(updated);
}

export async function startPlan(
  locationId: string,
  start: string,
  actor?: Actor,
): Promise<LaunchPlan> {
  if (actor && !mayStartLaunchPlan(actor.role)) {
    throw new HttpError(403, "Only admins can start a launch plan");
  }

  const { LAUNCH_TEMPLATE_SOURCE_KEY } = await import(
    "@/lib/launch-template-data"
  );
  let template = await prisma.launchTemplate.findFirst({
    where: { sourceKey: LAUNCH_TEMPLATE_SOURCE_KEY },
    include: { tasks: true },
  });
  if (!template) {
    template = await prisma.launchTemplate.findFirst({
      where: { isDefault: true },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      include: { tasks: true },
    });
  }
  if (!template) throw new Error("No default launch template found");

  const openingDate = openingDateFromDay0(start);

  await prisma.launchPlan.deleteMany({ where: { locationId } });

  const created = await prisma.launchPlan.create({
    data: {
      locationId,
      templateId: template.id,
      start: asDate(start)!,
      openingDate: asDate(openingDate)!,
      tasks: {
        create: template.tasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((t, index) => {
            const dates = materializeTaskDates(start, {
              s: t.startOffset,
              e: t.endOffset,
              duration: t.duration,
            });
            return {
              tid: t.tid,
              phase: t.phase,
              phaseOrder: t.phaseOrder,
              task: t.task,
              owner: t.owner,
              primaryContact: t.primaryContact,
              secondaryContact: t.secondaryContact,
              startOffset: t.startOffset,
              endOffset: t.endOffset,
              duration: dates.duration,
              plannedStart: asDate(dates.plannedStart)!,
              plannedEnd: asDate(dates.plannedEnd)!,
              critical: t.critical,
              sortOrder: index,
              status: TaskStatus.NOT_STARTED,
            };
          }),
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
      summary: `Started the 270-day launch plan for ${location?.name || "a location"} (Day 0 ${start}, opening ${openingDate})`,
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

  const taskData = plan.tasks
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      tid: t.tid,
      phase: t.phase,
      phaseOrder: t.phaseOrder,
      task: t.task,
      owner: t.owner,
      primaryContact: t.primaryContact,
      secondaryContact: t.secondaryContact,
      s: t.startOffset,
      e: t.endOffset,
      duration: t.duration,
      crit: t.critical,
    }));

  // Publish a new version; leave prior default templates (and in-progress plans) intact.
  await prisma.launchTemplate.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });

  const latest = await prisma.launchTemplate.findFirst({
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const template = await prisma.launchTemplate.create({
    data: {
      name: "270-Day Launch Plan",
      days: 270,
      version: nextVersion,
      isDefault: true,
      tasks: { create: templateTasksToDb(taskData) },
    },
  });

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
      summary: `Published launch template v${nextVersion} from ${location?.name || "a location"}`,
    });
  }
  return templateToApp(full);
}
