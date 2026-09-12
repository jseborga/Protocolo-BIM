-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ES', 'EN', 'PT');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('INFORMATION_MANAGER', 'BIM_MANAGER', 'BIM_COORDINATOR', 'BIM_MODELLER', 'REVIEWER', 'CLIENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('APPOINTING', 'LEAD_APPOINTED', 'APPOINTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('RICH_TEXT', 'TABLE', 'MATRIX', 'GENERATED');

-- CreateEnum
CREATE TYPE "NamingTarget" AS ENUM ('FILE', 'MODEL', 'SHEET', 'VIEW', 'FOLDER', 'FAMILY', 'TYPE', 'PARAMETER', 'WORKSET', 'LEVEL', 'GRID');

-- CreateEnum
CREATE TYPE "FieldSource" AS ENUM ('CODE_TABLE', 'FREE_TEXT', 'NUMERIC', 'DATE', 'REGEX');

-- CreateEnum
CREATE TYPE "CaseRule" AS ENUM ('ANY', 'UPPER', 'LOWER');

-- CreateEnum
CREATE TYPE "CdeState" AS ENUM ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RaciLetter" AS ENUM ('R', 'A', 'C', 'I');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('REVIT_ADDIN', 'IFC', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "TemplateScope" AS ENUM ('GLOBAL', 'ORG');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'ES',
    "jobTitle" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "defaultLocale" "Locale" NOT NULL DEFAULT 'ES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "standard" TEXT NOT NULL DEFAULT 'ISO_19650',
    "baseLocale" "Locale" NOT NULL DEFAULT 'ES',
    "enabledLocales" "Locale"[] DEFAULT ARRAY['ES', 'EN', 'PT']::"Locale"[],
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "notes" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "code" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "disciplineId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disciplineId" TEXT,
    "leadId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "disciplineId" TEXT,
    "teamId" TEXT,
    "partyId" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareTool" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "disciplineId" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "purpose" TEXT,
    "nativeFormat" TEXT,
    "exchangeFormat" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SoftwareTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciActivity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "stage" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RaciActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaciAssignment" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "projectRole" "ProjectRole",
    "teamId" TEXT,
    "disciplineId" TEXT,
    "letter" "RaciLetter" NOT NULL,

    CONSTRAINT "RaciAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "TemplateScope" NOT NULL DEFAULT 'GLOBAL',
    "orgId" TEXT,
    "standard" TEXT NOT NULL DEFAULT 'ISO_19650',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "labels" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentKey" TEXT,
    "order" INTEGER NOT NULL,
    "kind" "SectionKind" NOT NULL DEFAULT 'RICH_TEXT',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "titles" JSONB NOT NULL,
    "guidance" JSONB NOT NULL,
    "defaultBody" JSONB,

    CONSTRAINT "TemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "templateId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolSection" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentKey" TEXT,
    "order" INTEGER NOT NULL,
    "kind" "SectionKind" NOT NULL DEFAULT 'RICH_TEXT',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "guidance" JSONB,

    CONSTRAINT "ProtocolSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionContent" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionComment" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolChange" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "userId" TEXT,
    "sectionKey" TEXT,
    "locale" "Locale",
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamingConvention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "target" "NamingTarget" NOT NULL,
    "separator" TEXT NOT NULL DEFAULT '-',
    "caseRule" "CaseRule" NOT NULL DEFAULT 'UPPER',
    "maxLength" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "labels" JSONB NOT NULL,
    "description" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NamingConvention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamingField" (
    "id" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "source" "FieldSource" NOT NULL,
    "codeTableId" TEXT,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "pattern" TEXT,
    "dateFormat" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "example" TEXT,
    "description" JSONB,

    CONSTRAINT "NamingField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeTable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "orgId" TEXT,
    "key" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "description" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeValue" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "description" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CodeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamingExample" (
    "id" TEXT NOT NULL,
    "conventionId" TEXT NOT NULL,
    "sample" TEXT NOT NULL,
    "shouldBeValid" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "NamingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isoStage" INTEGER,
    "date" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TidpTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "partyId" TEXT,
    "teamId" TEXT,
    "container" TEXT NOT NULL,
    "description" TEXT,
    "responsibleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "TidpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "namePattern" TEXT NOT NULL,
    "cdeState" "CdeState",
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" JSONB,

    CONSTRAINT "FolderNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterGroupDef" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParameterGroupDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedParameterDef" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT,
    "guid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'TEXT',
    "isInstance" BOOLEAN NOT NULL DEFAULT true,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ifcPset" TEXT,
    "ifcProperty" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "disciplineId" TEXT,
    "description" JSONB,

    CONSTRAINT "SharedParameterDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "disciplineId" TEXT,
    "revitCategory" TEXT NOT NULL,
    "ifcClass" TEXT,
    "lodGeometry" TEXT,
    "loiInformation" TEXT,
    "documentation" TEXT,
    "requiredParams" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" JSONB,

    CONSTRAINT "ElementRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "AuditSource" NOT NULL,
    "modelName" TEXT NOT NULL,
    "ruleSetVersion" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "totalChecked" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "AuditRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'ERROR',
    "ruleKey" TEXT NOT NULL,
    "elementId" TEXT,
    "elementName" TEXT,
    "category" TEXT,
    "actual" TEXT,
    "expected" TEXT,
    "message" TEXT,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_orgId_email_idx" ON "Invitation"("orgId", "email");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orgId_code_key" ON "Project"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Client_projectId_key" ON "Client"("projectId");

-- CreateIndex
CREATE INDEX "Party_projectId_idx" ON "Party"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_code_key" ON "Discipline"("code");

-- CreateIndex
CREATE INDEX "Team_projectId_idx" ON "Team"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "SoftwareTool_projectId_idx" ON "SoftwareTool"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RaciActivity_projectId_key_key" ON "RaciActivity"("projectId", "key");

-- CreateIndex
CREATE INDEX "RaciAssignment_activityId_idx" ON "RaciAssignment"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolTemplate_key_key" ON "ProtocolTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateSection_templateId_key_key" ON "TemplateSection"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_supersedesId_key" ON "Protocol"("supersedesId");

-- CreateIndex
CREATE INDEX "Protocol_projectId_idx" ON "Protocol"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_projectId_versionLabel_key" ON "Protocol"("projectId", "versionLabel");

-- CreateIndex
CREATE INDEX "ProtocolSection_protocolId_idx" ON "ProtocolSection"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolSection_protocolId_key_key" ON "ProtocolSection"("protocolId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SectionContent_sectionId_locale_key" ON "SectionContent"("sectionId", "locale");

-- CreateIndex
CREATE INDEX "SectionComment_sectionId_idx" ON "SectionComment"("sectionId");

-- CreateIndex
CREATE INDEX "ProtocolChange_protocolId_idx" ON "ProtocolChange"("protocolId");

-- CreateIndex
CREATE INDEX "NamingConvention_projectId_target_idx" ON "NamingConvention"("projectId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "NamingConvention_projectId_key_key" ON "NamingConvention"("projectId", "key");

-- CreateIndex
CREATE INDEX "NamingField_conventionId_idx" ON "NamingField"("conventionId");

-- CreateIndex
CREATE UNIQUE INDEX "NamingField_conventionId_key_key" ON "NamingField"("conventionId", "key");

-- CreateIndex
CREATE INDEX "CodeTable_orgId_idx" ON "CodeTable"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeTable_projectId_key_key" ON "CodeTable"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CodeValue_tableId_code_key" ON "CodeValue"("tableId", "code");

-- CreateIndex
CREATE INDEX "NamingExample_conventionId_idx" ON "NamingExample"("conventionId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_projectId_key_key" ON "Milestone"("projectId", "key");

-- CreateIndex
CREATE INDEX "TidpTask_projectId_idx" ON "TidpTask"("projectId");

-- CreateIndex
CREATE INDEX "FolderNode_projectId_idx" ON "FolderNode"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ParameterGroupDef_projectId_name_key" ON "ParameterGroupDef"("projectId", "name");

-- CreateIndex
CREATE INDEX "SharedParameterDef_projectId_idx" ON "SharedParameterDef"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedParameterDef_projectId_name_key" ON "SharedParameterDef"("projectId", "name");

-- CreateIndex
CREATE INDEX "ElementRequirement_projectId_idx" ON "ElementRequirement"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_projectId_version_key" ON "RuleSet"("projectId", "version");

-- CreateIndex
CREATE INDEX "AuditRun_projectId_startedAt_idx" ON "AuditRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditFinding_runId_severity_idx" ON "AuditFinding"("runId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_projectId_idx" ON "ApiToken"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareTool" ADD CONSTRAINT "SoftwareTool_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareTool" ADD CONSTRAINT "SoftwareTool_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciActivity" ADD CONSTRAINT "RaciActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "RaciActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaciAssignment" ADD CONSTRAINT "RaciAssignment_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplate" ADD CONSTRAINT "ProtocolTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSection" ADD CONSTRAINT "TemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Protocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolSection" ADD CONSTRAINT "ProtocolSection_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProtocolSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProtocolSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionComment" ADD CONSTRAINT "SectionComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamingConvention" ADD CONSTRAINT "NamingConvention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamingField" ADD CONSTRAINT "NamingField_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "NamingConvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamingField" ADD CONSTRAINT "NamingField_codeTableId_fkey" FOREIGN KEY ("codeTableId") REFERENCES "CodeTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeTable" ADD CONSTRAINT "CodeTable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeTable" ADD CONSTRAINT "CodeTable_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeValue" ADD CONSTRAINT "CodeValue_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CodeTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamingExample" ADD CONSTRAINT "NamingExample_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "NamingConvention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidpTask" ADD CONSTRAINT "TidpTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidpTask" ADD CONSTRAINT "TidpTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidpTask" ADD CONSTRAINT "TidpTask_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidpTask" ADD CONSTRAINT "TidpTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidpTask" ADD CONSTRAINT "TidpTask_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderNode" ADD CONSTRAINT "FolderNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderNode" ADD CONSTRAINT "FolderNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FolderNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterGroupDef" ADD CONSTRAINT "ParameterGroupDef_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedParameterDef" ADD CONSTRAINT "SharedParameterDef_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedParameterDef" ADD CONSTRAINT "SharedParameterDef_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ParameterGroupDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedParameterDef" ADD CONSTRAINT "SharedParameterDef_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequirement" ADD CONSTRAINT "ElementRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequirement" ADD CONSTRAINT "ElementRequirement_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequirement" ADD CONSTRAINT "ElementRequirement_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRun" ADD CONSTRAINT "AuditRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
