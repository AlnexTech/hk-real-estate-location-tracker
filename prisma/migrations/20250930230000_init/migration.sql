-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "stage" AS ENUM ('1 - Market (No Site)', '2 - Site Search', '3 - LOI', '4 - Lease', '5 - Under Construction', '6 - Open', 'On Hold', 'Dead');

-- CreateEnum
CREATE TYPE "health" AS ENUM ('Green', 'Yellow', 'Red');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('High', 'Normal', 'Back burner');

-- CreateEnum
CREATE TYPE "ownership" AS ENUM ('Corporate', 'Franchise', 'Corporate + Partner');

-- CreateEnum
CREATE TYPE "format" AS ENUM ('With Food Court', 'Without Food Court');

-- CreateEnum
CREATE TYPE "loi_status" AS ENUM ('Not Started', 'Drafting', 'Sent to Landlord', 'Counter Received', 'Negotiating', 'Signed', 'Dead');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('Not Started', 'In Progress', 'Done', 'N/A');

-- CreateEnum
CREATE TYPE "country" AS ENUM ('USA', 'Canada', 'Australia');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'agent');

-- CreateEnum
CREATE TYPE "activity_action" AS ENUM ('create', 'edit', 'delete');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" "country",
    "address" TEXT,
    "landlord" TEXT,
    "ownership" "ownership",
    "format" "format",
    "sqft" INTEGER,
    "stage" "stage" NOT NULL DEFAULT '2 - Site Search',
    "health" "health",
    "priority" "priority" NOT NULL DEFAULT 'Normal',
    "search_since" DATE,
    "loi_status" "loi_status",
    "loi_sent" DATE,
    "loi_signed" DATE,
    "lease_draft" DATE,
    "lease_attorney" DATE,
    "lease_signed" DATE,
    "rent_start" DATE,
    "free_rent" INTEGER,
    "ti" DECIMAL(12,2),
    "base_rent" DECIMAL(12,2),
    "fdd_signed" DATE,
    "target_open" DATE,
    "actual_open" DATE,
    "notes_mfi" TEXT,
    "notes" TEXT,
    "drive" TEXT,
    "last_touched" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_updates" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 270,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launch_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_tasks" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "tid" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "start_day" INTEGER NOT NULL,
    "end_day" INTEGER NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_plans" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "template_id" TEXT,
    "start" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launch_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_tasks" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "tid" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "start_day" INTEGER NOT NULL,
    "end_day" INTEGER NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "status" "task_status" NOT NULL DEFAULT 'Not Started',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "actor_role" "user_role" NOT NULL,
    "action" "activity_action" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "entity_name" TEXT,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_stage_idx" ON "locations"("stage");

-- CreateIndex
CREATE INDEX "locations_country_idx" ON "locations"("country");

-- CreateIndex
CREATE INDEX "locations_priority_idx" ON "locations"("priority");

-- CreateIndex
CREATE INDEX "locations_health_idx" ON "locations"("health");

-- CreateIndex
CREATE INDEX "locations_target_open_idx" ON "locations"("target_open");

-- CreateIndex
CREATE INDEX "location_updates_location_id_created_at_idx" ON "location_updates"("location_id", "created_at");

-- CreateIndex
CREATE INDEX "template_tasks_template_id_sort_order_idx" ON "template_tasks"("template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "template_tasks_template_id_tid_key" ON "template_tasks"("template_id", "tid");

-- CreateIndex
CREATE UNIQUE INDEX "launch_plans_location_id_key" ON "launch_plans"("location_id");

-- CreateIndex
CREATE INDEX "plan_tasks_plan_id_sort_order_idx" ON "plan_tasks"("plan_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "plan_tasks_plan_id_tid_key" ON "plan_tasks"("plan_id", "tid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites"("token_hash");

-- CreateIndex
CREATE INDEX "invites_email_idx" ON "invites"("email");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "location_updates" ADD CONSTRAINT "location_updates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "launch_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_plans" ADD CONSTRAINT "launch_plans_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_plans" ADD CONSTRAINT "launch_plans_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "launch_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "launch_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
