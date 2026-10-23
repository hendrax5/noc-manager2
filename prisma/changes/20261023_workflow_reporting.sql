-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'Work';

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "commentId" INTEGER,
ADD COLUMN     "containerId" INTEGER,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "reportDate" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'Legacy',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkflowPolicyVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "operation" TEXT,
    "originCompany" TEXT,
    "executorCompany" TEXT,
    "departmentId" INTEGER,
    "roleId" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "WorkflowPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowPhaseDefinition" (
    "id" SERIAL NOT NULL,
    "policyVersionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "jobCategoryId" INTEGER NOT NULL,

    CONSTRAINT "WorkflowPhaseDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPhaseExecution" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "policyVersionId" INTEGER NOT NULL,
    "definitionId" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Pending',
    "assigneeId" INTEGER,
    "completedBy" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionKey" TEXT,
    "evidence" TEXT,
    "categorySnapshot" JSONB NOT NULL,
    "routingSnapshot" JSONB NOT NULL,

    CONSTRAINT "TicketPhaseExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAccessGrant" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "userId" INTEGER,
    "departmentId" INTEGER,
    "company" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReportContainer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,

    CONSTRAINT "MonthlyReportContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportItem" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" INTEGER,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "blocker" TEXT,
    "categorySnapshot" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" INTEGER,

    CONSTRAINT "DailyReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAssignmentPeriod" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "company" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "EmployeeAssignmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationDepartmentEligibility" (
    "departmentId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "updatedBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationDepartmentEligibility_pkey" PRIMARY KEY ("departmentId")
);

-- CreateTable
CREATE TABLE "EvaluationPolicyVersion" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "company" TEXT NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "publishedAt" TIMESTAMP(3),
    "weights" JSONB NOT NULL,
    "targetUnits" DOUBLE PRECISION NOT NULL,
    "categoryWeights" JSONB NOT NULL,
    "rubric" JSONB NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationMonthlyContext" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "scheduledMinutes" INTEGER NOT NULL,
    "eligibleMinutes" INTEGER NOT NULL,
    "requiredReportDates" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "reviewedBy" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationMonthlyContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkEvidenceReference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "qualityPassed" BOOLEAN NOT NULL,
    "onTime" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "assessedBy" INTEGER NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkEvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyEvaluation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "company" TEXT,
    "policyVersionId" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'simulation',
    "status" TEXT NOT NULL,
    "total" DOUBLE PRECISION,
    "snapshot" JSONB NOT NULL,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationReviewEvent" (
    "id" SERIAL NOT NULL,
    "evaluationId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportConfigurationAudit" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportConfigurationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowPolicyVersion_workType_operation_effectiveFrom_idx" ON "WorkflowPolicyVersion"("workType", "operation", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowPhaseDefinition_policyVersionId_key_key" ON "WorkflowPhaseDefinition"("policyVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowPhaseDefinition_policyVersionId_ordinal_key" ON "WorkflowPhaseDefinition"("policyVersionId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPhaseExecution_completionKey_key" ON "TicketPhaseExecution"("completionKey");

-- CreateIndex
CREATE INDEX "TicketPhaseExecution_completedBy_completedAt_idx" ON "TicketPhaseExecution"("completedBy", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPhaseExecution_ticketId_ordinal_key" ON "TicketPhaseExecution"("ticketId", "ordinal");

-- CreateIndex
CREATE INDEX "ReportAccessGrant_actorId_effectiveFrom_idx" ON "ReportAccessGrant"("actorId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReportContainer_ticketId_key" ON "MonthlyReportContainer"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReportContainer_userId_monthKey_key" ON "MonthlyReportContainer"("userId", "monthKey");

-- CreateIndex
CREATE INDEX "EmployeeAssignmentPeriod_userId_effectiveFrom_idx" ON "EmployeeAssignmentPeriod"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPolicyVersion_departmentId_roleId_company_effecti_key" ON "EvaluationPolicyVersion"("departmentId", "roleId", "company", "effectiveMonth");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationMonthlyContext_userId_monthKey_key" ON "EvaluationMonthlyContext"("userId", "monthKey");

-- CreateIndex
CREATE INDEX "WorkEvidenceReference_userId_monthKey_idx" ON "WorkEvidenceReference"("userId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkEvidenceReference_source_sourceId_key" ON "WorkEvidenceReference"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEvaluation_userId_monthKey_revision_key" ON "MonthlyEvaluation"("userId", "monthKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_idempotencyKey_key" ON "DailyReport"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_commentId_key" ON "DailyReport"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_userId_reportDate_revision_key" ON "DailyReport"("userId", "reportDate", "revision");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "MonthlyReportContainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhaseDefinition" ADD CONSTRAINT "WorkflowPhaseDefinition_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "WorkflowPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowPhaseDefinition" ADD CONSTRAINT "WorkflowPhaseDefinition_jobCategoryId_fkey" FOREIGN KEY ("jobCategoryId") REFERENCES "JobCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhaseExecution" ADD CONSTRAINT "TicketPhaseExecution_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhaseExecution" ADD CONSTRAINT "TicketPhaseExecution_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "WorkflowPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhaseExecution" ADD CONSTRAINT "TicketPhaseExecution_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowPhaseDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhaseExecution" ADD CONSTRAINT "TicketPhaseExecution_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPhaseExecution" ADD CONSTRAINT "TicketPhaseExecution_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportContainer" ADD CONSTRAINT "MonthlyReportContainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportContainer" ADD CONSTRAINT "MonthlyReportContainer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportItem" ADD CONSTRAINT "DailyReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignmentPeriod" ADD CONSTRAINT "EmployeeAssignmentPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationMonthlyContext" ADD CONSTRAINT "EvaluationMonthlyContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEvidenceReference" ADD CONSTRAINT "WorkEvidenceReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEvaluation" ADD CONSTRAINT "MonthlyEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationReviewEvent" ADD CONSTRAINT "EvaluationReviewEvent_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "MonthlyEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

