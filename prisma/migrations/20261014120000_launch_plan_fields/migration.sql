-- AlterEnum
ALTER TYPE "task_status" ADD VALUE 'Blocked';

-- AlterTable
ALTER TABLE "launch_templates" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "launch_templates" ADD COLUMN "source_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "launch_templates_source_key_key" ON "launch_templates"("source_key");

-- AlterTable
ALTER TABLE "template_tasks" ADD COLUMN "phase_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "template_tasks" ADD COLUMN "primary_contact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "template_tasks" ADD COLUMN "secondary_contact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "template_tasks" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "launch_plans" ADD COLUMN "opening_date" DATE;

-- Backfill opening_date for existing plans (start + 270 days)
UPDATE "launch_plans"
SET "opening_date" = ("start" + INTERVAL '270 days')
WHERE "opening_date" IS NULL;

ALTER TABLE "launch_plans" ALTER COLUMN "opening_date" SET NOT NULL;

-- AlterTable
ALTER TABLE "plan_tasks" ADD COLUMN "phase_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plan_tasks" ADD COLUMN "primary_contact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "plan_tasks" ADD COLUMN "secondary_contact" TEXT NOT NULL DEFAULT '';
ALTER TABLE "plan_tasks" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "plan_tasks" ADD COLUMN "planned_start" DATE;
ALTER TABLE "plan_tasks" ADD COLUMN "planned_end" DATE;
ALTER TABLE "plan_tasks" ADD COLUMN "actual_start" DATE;
ALTER TABLE "plan_tasks" ADD COLUMN "actual_finish" DATE;
ALTER TABLE "plan_tasks" ADD COLUMN "notes" TEXT;

-- Backfill planned dates from plan start + offsets
UPDATE "plan_tasks" AS pt
SET
  "planned_start" = (lp."start" + (pt."start_day" * INTERVAL '1 day')),
  "planned_end" = (lp."start" + (pt."end_day" * INTERVAL '1 day')),
  "duration" = CASE
    WHEN pt."duration" = 1 AND pt."end_day" >= pt."start_day"
      THEN pt."end_day" - pt."start_day" + 1
    ELSE pt."duration"
  END
FROM "launch_plans" AS lp
WHERE pt."plan_id" = lp."id"
  AND (pt."planned_start" IS NULL OR pt."planned_end" IS NULL);

ALTER TABLE "plan_tasks" ALTER COLUMN "planned_start" SET NOT NULL;
ALTER TABLE "plan_tasks" ALTER COLUMN "planned_end" SET NOT NULL;
