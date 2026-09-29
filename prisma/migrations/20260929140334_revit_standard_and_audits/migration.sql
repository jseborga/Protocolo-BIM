-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "code" TEXT,
ADD COLUMN     "params" JSONB,
ADD COLUMN     "target" TEXT;

-- AlterTable
ALTER TABLE "AuditRun" ADD COLUMN     "apiTokenId" TEXT,
ADD COLUMN     "infoCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RuleSet" ADD COLUMN     "hash" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "WorksetDef" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disciplineId" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorksetDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorksetDef_projectId_idx" ON "WorksetDef"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorksetDef_projectId_name_key" ON "WorksetDef"("projectId", "name");

-- AddForeignKey
ALTER TABLE "WorksetDef" ADD CONSTRAINT "WorksetDef_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorksetDef" ADD CONSTRAINT "WorksetDef_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_apiTokenId_fkey" FOREIGN KEY ("apiTokenId") REFERENCES "ApiToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
