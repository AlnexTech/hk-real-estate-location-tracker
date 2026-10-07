import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  DEFAULT_LAUNCH_TEMPLATE,
  SEED_LOCATIONS,
  SEED_UPDATES,
} from "../src/lib/seed";
import {
  Country,
  Format,
  Health,
  LoiStatus,
  Ownership,
  Priority,
  PrismaClient,
  Stage,
  UserRole,
  type Prisma,
} from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const STAGE_MAP: Record<string, Stage> = {
  "1 - Market (No Site)": Stage.MARKET_NO_SITE,
  "2 - Site Search": Stage.SITE_SEARCH,
  "3 - LOI": Stage.LOI,
  "4 - Lease": Stage.LEASE,
  "5 - Under Construction": Stage.UNDER_CONSTRUCTION,
  "6 - Open": Stage.OPEN,
  "On Hold": Stage.ON_HOLD,
  Dead: Stage.DEAD,
};

const HEALTH_MAP: Record<string, Health> = {
  Green: Health.GREEN,
  Yellow: Health.YELLOW,
  Red: Health.RED,
};

const PRIORITY_MAP: Record<string, Priority> = {
  Low: Priority.LOW,
  Medium: Priority.MEDIUM,
  High: Priority.HIGH,
  Normal: Priority.MEDIUM,
  "Back burner": Priority.BACK_BURNER,
};

const OWNERSHIP_MAP: Record<string, Ownership> = {
  Corporate: Ownership.CORPORATE,
  Franchise: Ownership.FRANCHISE,
  "Corporate + Partner": Ownership.CORPORATE_PARTNER,
};

const FORMAT_MAP: Record<string, Format> = {
  "With Food Court": Format.WITH_FOOD_COURT,
  "Without Food Court": Format.WITHOUT_FOOD_COURT,
};

const LOI_STATUS_MAP: Record<string, LoiStatus> = {
  "Not Started": LoiStatus.NOT_STARTED,
  Drafting: LoiStatus.DRAFTING,
  "Sent to Landlord": LoiStatus.SENT_TO_LANDLORD,
  "Counter Received": LoiStatus.COUNTER_RECEIVED,
  Negotiating: LoiStatus.NEGOTIATING,
  Signed: LoiStatus.SIGNED,
  Dead: LoiStatus.DEAD,
};

const COUNTRY_MAP: Record<string, Country> = {
  USA: Country.USA,
  Canada: Country.Canada,
  Australia: Country.Australia,
};

function asDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

function asInt(value?: number | string | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asDecimal(
  value?: number | string | null,
): Prisma.Decimal | string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function mapEnum<T>(
  value: string | undefined | null,
  map: Record<string, T>,
): T | null {
  if (!value) return null;
  const mapped = map[value];
  if (!mapped) {
    throw new Error(`Unknown enum value: ${JSON.stringify(value)}`);
  }
  return mapped;
}

async function main() {
  for (const loc of SEED_LOCATIONS) {
    const data = {
      name: loc.name,
      city: loc.city || null,
      state: loc.state || null,
      country: mapEnum(loc.country, COUNTRY_MAP),
      address: loc.address || null,
      landlord: loc.landlord || null,
      ownership: mapEnum(loc.ownership, OWNERSHIP_MAP),
      format: mapEnum(loc.format, FORMAT_MAP),
      sqft: asInt(loc.sqft),
      stage: mapEnum(loc.stage, STAGE_MAP) ?? Stage.SITE_SEARCH,
      health: mapEnum(loc.health, HEALTH_MAP),
      priority: mapEnum(loc.priority, PRIORITY_MAP) ?? Priority.MEDIUM,
      searchSince: asDate(loc.searchSince),
      loiStatus: mapEnum(loc.loiStatus, LOI_STATUS_MAP),
      loiSent: asDate(loc.loiSent),
      loiSigned: asDate(loc.loiSigned),
      leaseDraft: asDate(loc.leaseDraft),
      leaseAttorney: asDate(loc.leaseAttorney),
      leaseSigned: asDate(loc.leaseSigned),
      rentStart: asDate(loc.rentStart),
      freeRent: asInt(loc.freeRent),
      ti: asDecimal(loc.ti),
      baseRent: asDecimal(loc.baseRent),
      nnn: asDecimal(loc.nnn),
      fddSigned: asDate(loc.fddSigned),
      targetOpen: asDate(loc.targetOpen),
      actualOpen: asDate(loc.actualOpen),
      notesMfi: loc.notesMfi || null,
      notes: loc.notes || null,
      drive: loc.drive || null,
      lastTouched: asDate(loc.lastTouched),
    };

    await prisma.location.upsert({
      where: { id: loc.id },
      create: { id: loc.id, ...data },
      update: data,
    });
  }

  for (const update of SEED_UPDATES) {
    await prisma.locationUpdate.upsert({
      where: { id: update.id },
      create: {
        id: update.id,
        locationId: update.locId,
        text: update.text,
        at: asDate(update.at)!,
        authorName: update.by,
        createdAt: new Date(update.ts),
      },
      update: {
        locationId: update.locId,
        text: update.text,
        at: asDate(update.at)!,
        authorName: update.by,
        createdAt: new Date(update.ts),
      },
    });
  }

  let template = await prisma.launchTemplate.findFirst({
    where: { isDefault: true },
  });

  if (!template) {
    template = await prisma.launchTemplate.create({
      data: {
        name: DEFAULT_LAUNCH_TEMPLATE.name,
        days: DEFAULT_LAUNCH_TEMPLATE.days,
        isDefault: true,
      },
    });
  } else {
    template = await prisma.launchTemplate.update({
      where: { id: template.id },
      data: {
        name: DEFAULT_LAUNCH_TEMPLATE.name,
        days: DEFAULT_LAUNCH_TEMPLATE.days,
        isDefault: true,
      },
    });
  }

  await prisma.launchTemplateTask.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.launchTemplateTask.createMany({
    data: DEFAULT_LAUNCH_TEMPLATE.tasks.map((task, index) => ({
      templateId: template!.id,
      tid: task.tid,
      phase: task.phase,
      task: task.task,
      owner: task.owner,
      startOffset: task.s,
      endOffset: task.e,
      critical: task.crit,
      sortOrder: index,
    })),
  });

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Admin",
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: UserRole.admin,
        },
      });
      console.log(`Created admin ${adminEmail}`);
    }
  }

  const [locations, updates, templates, templateTasks, plans, users] =
    await Promise.all([
      prisma.location.count(),
      prisma.locationUpdate.count(),
      prisma.launchTemplate.count(),
      prisma.launchTemplateTask.count(),
      prisma.launchPlan.count(),
      prisma.user.count(),
    ]);

  console.log("Seed complete:");
  console.log({ locations, updates, templates, templateTasks, plans, users });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
