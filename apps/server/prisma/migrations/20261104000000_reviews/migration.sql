-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ofAssessmentId" TEXT,
ADD COLUMN     "peerOpen" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Assessment_ofAssessmentId_idx" ON "Assessment"("ofAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_ofAssessmentId_assessorType_assessorId_key" ON "Assessment"("ofAssessmentId", "assessorType", "assessorId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_ofAssessmentId_fkey" FOREIGN KEY ("ofAssessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

