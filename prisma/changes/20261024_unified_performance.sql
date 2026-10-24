ALTER TABLE "EvaluationPolicyVersion" ADD COLUMN IF NOT EXISTS "performanceRules" JSONB;
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
 "id" SERIAL PRIMARY KEY, "actorId" INTEGER, "source" TEXT NOT NULL,
 "type" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" INTEGER NOT NULL,
 "ticketId" INTEGER, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "idempotencyKey" TEXT NOT NULL UNIQUE, "changes" JSONB NOT NULL,
 "validationState" TEXT NOT NULL DEFAULT 'pending', "reviewedBy" INTEGER,
 "reviewedAt" TIMESTAMP(3), "reviewReason" TEXT
);
CREATE INDEX IF NOT EXISTS "ActivityEvent_actorId_occurredAt_idx" ON "ActivityEvent"("actorId","occurredAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_entityType_entityId_occurredAt_idx" ON "ActivityEvent"("entityType","entityId","occurredAt");
CREATE TABLE IF NOT EXISTS "PerformanceWorkInterval" (
 "id" SERIAL PRIMARY KEY, "ticketId" INTEGER NOT NULL, "userId" INTEGER NOT NULL,
 "kind" TEXT NOT NULL, "reason" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL,
 "endedAt" TIMESTAMP(3), "reviewedBy" INTEGER
);
CREATE INDEX IF NOT EXISTS "PerformanceWorkInterval_ticketId_userId_startedAt_idx" ON "PerformanceWorkInterval"("ticketId","userId","startedAt");
CREATE TABLE IF NOT EXISTS "PerformancePublication" (
 "id" SERIAL PRIMARY KEY, "monthKey" TEXT NOT NULL, "departmentId" INTEGER NOT NULL,
 "company" TEXT NOT NULL, "version" INTEGER NOT NULL, "manifest" JSONB NOT NULL,
 "publishedBy" INTEGER NOT NULL, "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("monthKey","departmentId","company","version")
);
