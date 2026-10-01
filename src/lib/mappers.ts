import type {
  Format as DbFormat,
  Health as DbHealth,
  LoiStatus as DbLoiStatus,
  Ownership as DbOwnership,
  Priority as DbPriority,
  Stage as DbStage,
  TaskStatus as DbTaskStatus,
  Country as DbCountry,
  Location as DbLocation,
  LocationUpdate as DbUpdate,
  LaunchPlan as DbPlan,
  LaunchPlanTask as DbPlanTask,
  LaunchTemplate as DbTemplate,
  LaunchTemplateTask as DbTemplateTask,
} from "@/generated/prisma/client";
import {
  Country,
  Format,
  Health,
  LoiStatus,
  Ownership,
  Priority,
  Stage,
  TaskStatus,
} from "@/generated/prisma/client";
import type {
  LaunchPlan,
  LaunchTemplate,
  Location,
  PlanTask,
  Update,
} from "@/lib/types";

const STAGE_TO_APP: Record<DbStage, string> = {
  [Stage.MARKET_NO_SITE]: "1 - Market (No Site)",
  [Stage.SITE_SEARCH]: "2 - Site Search",
  [Stage.LOI]: "3 - LOI",
  [Stage.LEASE]: "4 - Lease",
  [Stage.UNDER_CONSTRUCTION]: "5 - Under Construction",
  [Stage.OPEN]: "6 - Open",
  [Stage.ON_HOLD]: "On Hold",
  [Stage.DEAD]: "Dead",
};

const STAGE_TO_DB: Record<string, DbStage> = Object.fromEntries(
  Object.entries(STAGE_TO_APP).map(([k, v]) => [v, k as DbStage]),
) as Record<string, DbStage>;

const HEALTH_TO_APP: Record<DbHealth, string> = {
  [Health.GREEN]: "Green",
  [Health.YELLOW]: "Yellow",
  [Health.RED]: "Red",
};
const HEALTH_TO_DB: Record<string, DbHealth> = Object.fromEntries(
  Object.entries(HEALTH_TO_APP).map(([k, v]) => [v, k as DbHealth]),
) as Record<string, DbHealth>;

const PRIORITY_TO_APP: Record<DbPriority, string> = {
  [Priority.HIGH]: "High",
  [Priority.NORMAL]: "Normal",
  [Priority.BACK_BURNER]: "Back burner",
};
const PRIORITY_TO_DB: Record<string, DbPriority> = Object.fromEntries(
  Object.entries(PRIORITY_TO_APP).map(([k, v]) => [v, k as DbPriority]),
) as Record<string, DbPriority>;

const OWNERSHIP_TO_APP: Record<DbOwnership, string> = {
  [Ownership.CORPORATE]: "Corporate",
  [Ownership.FRANCHISE]: "Franchise",
  [Ownership.CORPORATE_PARTNER]: "Corporate + Partner",
};
const OWNERSHIP_TO_DB: Record<string, DbOwnership> = Object.fromEntries(
  Object.entries(OWNERSHIP_TO_APP).map(([k, v]) => [v, k as DbOwnership]),
) as Record<string, DbOwnership>;

const FORMAT_TO_APP: Record<DbFormat, string> = {
  [Format.WITH_FOOD_COURT]: "With Food Court",
  [Format.WITHOUT_FOOD_COURT]: "Without Food Court",
};
const FORMAT_TO_DB: Record<string, DbFormat> = Object.fromEntries(
  Object.entries(FORMAT_TO_APP).map(([k, v]) => [v, k as DbFormat]),
) as Record<string, DbFormat>;

const LOI_TO_APP: Record<DbLoiStatus, string> = {
  [LoiStatus.NOT_STARTED]: "Not Started",
  [LoiStatus.DRAFTING]: "Drafting",
  [LoiStatus.SENT_TO_LANDLORD]: "Sent to Landlord",
  [LoiStatus.COUNTER_RECEIVED]: "Counter Received",
  [LoiStatus.NEGOTIATING]: "Negotiating",
  [LoiStatus.SIGNED]: "Signed",
  [LoiStatus.DEAD]: "Dead",
};
const LOI_TO_DB: Record<string, DbLoiStatus> = Object.fromEntries(
  Object.entries(LOI_TO_APP).map(([k, v]) => [v, k as DbLoiStatus]),
) as Record<string, DbLoiStatus>;

const TASK_TO_APP: Record<DbTaskStatus, string> = {
  [TaskStatus.NOT_STARTED]: "Not Started",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.DONE]: "Done",
  [TaskStatus.N_A]: "N/A",
};
const TASK_TO_DB: Record<string, DbTaskStatus> = Object.fromEntries(
  Object.entries(TASK_TO_APP).map(([k, v]) => [v, k as DbTaskStatus]),
) as Record<string, DbTaskStatus>;

const COUNTRY_TO_DB: Record<string, DbCountry> = {
  USA: Country.USA,
  Canada: Country.Canada,
  Australia: Country.Australia,
};

export function toDateString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function locationToApp(row: DbLocation): Location {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    ownership: row.ownership ? OWNERSHIP_TO_APP[row.ownership] : undefined,
    format: row.format ? FORMAT_TO_APP[row.format] : undefined,
    sqft: row.sqft ?? undefined,
    address: row.address ?? undefined,
    landlord: row.landlord ?? undefined,
    stage: STAGE_TO_APP[row.stage],
    health: row.health ? HEALTH_TO_APP[row.health] : "",
    priority: PRIORITY_TO_APP[row.priority],
    searchSince: toDateString(row.searchSince),
    loiStatus: row.loiStatus ? LOI_TO_APP[row.loiStatus] : "",
    loiSent: toDateString(row.loiSent),
    loiSigned: toDateString(row.loiSigned),
    leaseDraft: toDateString(row.leaseDraft),
    leaseAttorney: toDateString(row.leaseAttorney),
    leaseSigned: toDateString(row.leaseSigned),
    rentStart: toDateString(row.rentStart),
    freeRent: row.freeRent ?? undefined,
    ti: decimalToNumber(row.ti),
    baseRent: decimalToNumber(row.baseRent),
    fddSigned: toDateString(row.fddSigned),
    targetOpen: toDateString(row.targetOpen),
    actualOpen: toDateString(row.actualOpen),
    notesMfi: row.notesMfi ?? undefined,
    notes: row.notes ?? undefined,
    drive: row.drive ?? undefined,
    lastTouched: toDateString(row.lastTouched),
    updatedAt: toDateString(row.updatedAt),
  };
}

export function updateToApp(
  row: DbUpdate,
  locName?: string,
): Update {
  return {
    id: row.id,
    locId: row.locationId,
    locName: locName || "",
    text: row.text,
    at: toDateString(row.at)!,
    by: row.authorName,
    ts: row.createdAt.getTime(),
  };
}

export function planTaskToApp(row: DbPlanTask | DbTemplateTask): PlanTask {
  const status =
    "status" in row && row.status ? TASK_TO_APP[row.status] : undefined;
  return {
    tid: row.tid,
    phase: row.phase,
    task: row.task,
    owner: row.owner,
    s: row.startOffset,
    e: row.endOffset,
    crit: row.critical,
    ...(status
      ? { status: status as PlanTask["status"] }
      : {}),
  };
}

export function planToApp(
  row: DbPlan & { tasks: DbPlanTask[] },
): LaunchPlan {
  return {
    start: toDateString(row.start)!,
    tasks: [...row.tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(planTaskToApp),
  };
}

export function templateToApp(
  row: DbTemplate & { tasks: DbTemplateTask[] },
): LaunchTemplate {
  return {
    name: row.name,
    days: row.days,
    tasks: [...row.tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => {
        const { status: _s, ...rest } = planTaskToApp(t);
        return rest;
      }),
  };
}

function emptyToNull(value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  return value;
}

function asInt(value: unknown): number | null {
  const v = emptyToNull(value);
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asDecimal(value: unknown): string | null {
  const v = emptyToNull(value);
  if (v === null) return null;
  return String(v);
}

/** Map a partial app Location patch into Prisma update/create data. */
export function locationPatchToDb(
  patch: Partial<Location>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if ("name" in patch) data.name = patch.name;
  if ("city" in patch) data.city = emptyToNull(patch.city);
  if ("state" in patch) data.state = emptyToNull(patch.state);
  if ("country" in patch) {
    const c = emptyToNull(patch.country) as string | null;
    data.country = c ? COUNTRY_TO_DB[c] ?? null : null;
  }
  if ("address" in patch) data.address = emptyToNull(patch.address);
  if ("landlord" in patch) data.landlord = emptyToNull(patch.landlord);
  if ("ownership" in patch) {
    const v = emptyToNull(patch.ownership) as string | null;
    data.ownership = v ? OWNERSHIP_TO_DB[v] ?? null : null;
  }
  if ("format" in patch) {
    const v = emptyToNull(patch.format) as string | null;
    data.format = v ? FORMAT_TO_DB[v] ?? null : null;
  }
  if ("sqft" in patch) data.sqft = asInt(patch.sqft);
  if ("stage" in patch) {
    const v = patch.stage as string | undefined;
    if (v && STAGE_TO_DB[v]) data.stage = STAGE_TO_DB[v];
  }
  if ("health" in patch) {
    const v = emptyToNull(patch.health) as string | null;
    data.health = v ? HEALTH_TO_DB[v] ?? null : null;
  }
  if ("priority" in patch) {
    const v = emptyToNull(patch.priority) as string | null;
    data.priority = v ? PRIORITY_TO_DB[v] ?? Priority.NORMAL : Priority.NORMAL;
  }
  if ("searchSince" in patch) data.searchSince = asDate(patch.searchSince as string);
  if ("loiStatus" in patch) {
    const v = emptyToNull(patch.loiStatus) as string | null;
    data.loiStatus = v ? LOI_TO_DB[v] ?? null : null;
  }
  if ("loiSent" in patch) data.loiSent = asDate(patch.loiSent as string);
  if ("loiSigned" in patch) data.loiSigned = asDate(patch.loiSigned as string);
  if ("leaseDraft" in patch) data.leaseDraft = asDate(patch.leaseDraft as string);
  if ("leaseAttorney" in patch)
    data.leaseAttorney = asDate(patch.leaseAttorney as string);
  if ("leaseSigned" in patch)
    data.leaseSigned = asDate(patch.leaseSigned as string);
  if ("rentStart" in patch) data.rentStart = asDate(patch.rentStart as string);
  if ("freeRent" in patch) data.freeRent = asInt(patch.freeRent);
  if ("ti" in patch) data.ti = asDecimal(patch.ti);
  if ("baseRent" in patch) data.baseRent = asDecimal(patch.baseRent);
  if ("fddSigned" in patch) data.fddSigned = asDate(patch.fddSigned as string);
  if ("targetOpen" in patch) data.targetOpen = asDate(patch.targetOpen as string);
  if ("actualOpen" in patch) data.actualOpen = asDate(patch.actualOpen as string);
  if ("notesMfi" in patch) data.notesMfi = emptyToNull(patch.notesMfi);
  if ("notes" in patch) data.notes = emptyToNull(patch.notes);
  if ("drive" in patch) data.drive = emptyToNull(patch.drive);
  if ("lastTouched" in patch)
    data.lastTouched = asDate(patch.lastTouched as string);

  return data;
}

export function planTasksToDb(tasks: PlanTask[]) {
  return tasks.map((task, index) => ({
    tid: task.tid,
    phase: task.phase,
    task: task.task,
    owner: task.owner || "",
    startOffset: task.s,
    endOffset: task.e,
    critical: !!task.crit,
    status: task.status
      ? TASK_TO_DB[task.status] ?? TaskStatus.NOT_STARTED
      : TaskStatus.NOT_STARTED,
    sortOrder: index,
  }));
}

export function templateTasksToDb(tasks: Omit<PlanTask, "status">[]) {
  return tasks.map((task, index) => ({
    tid: task.tid,
    phase: task.phase,
    task: task.task,
    owner: task.owner || "",
    startOffset: task.s,
    endOffset: task.e,
    critical: !!task.crit,
    sortOrder: index,
  }));
}

export { asDate, STAGE_TO_DB, Priority };
