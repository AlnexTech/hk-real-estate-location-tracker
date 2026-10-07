-- Replace priority values: Normal becomes Medium, and Low is added.
CREATE TYPE "priority_new" AS ENUM ('Low', 'Medium', 'High', 'Back burner');

ALTER TABLE "locations" ALTER COLUMN "priority" DROP DEFAULT;

ALTER TABLE "locations"
  ALTER COLUMN "priority" TYPE "priority_new"
  USING (
    CASE "priority"::text
      WHEN 'Normal' THEN 'Medium'
      WHEN 'High' THEN 'High'
      WHEN 'Back burner' THEN 'Back burner'
      ELSE 'Medium'
    END
  )::"priority_new";

ALTER TABLE "locations"
  ALTER COLUMN "priority" SET DEFAULT 'Medium'::"priority_new";

DROP TYPE "priority";

ALTER TYPE "priority_new" RENAME TO "priority";
