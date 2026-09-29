-- Projects created before the baseline Revit standard existed keep NULL here;
-- the start-up seed gives them the baseline parameters and worksets once.
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "revitBaselineAt" TIMESTAMP(3);
