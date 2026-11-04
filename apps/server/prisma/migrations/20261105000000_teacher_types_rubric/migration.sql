-- Teacher-defined assessment types, the Save status, and per-teacher settings (types, rubric).

ALTER TABLE "Assessment" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Assessment" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
ALTER TABLE "Assessment" ALTER COLUMN "kind" SET DEFAULT 'regular';
DROP TYPE "AssessmentKind";

-- Work saved before the Save button existed counts as saved if every one of the four criteria was marked.
ALTER TABLE "Assessment" ADD COLUMN "completedAt" TIMESTAMP(3);
UPDATE "Assessment" a
   SET "completedAt" = a."updatedAt"
 WHERE a."assessorType" = 'teacher'
   AND (SELECT count(*) FROM "CriterionScore" c WHERE c."assessmentId" = a."id" AND c."deletedAt" IS NULL) >= 4;

ALTER TABLE "User" ADD COLUMN "settings" JSONB;
