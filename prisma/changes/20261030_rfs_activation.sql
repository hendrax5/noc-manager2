-- RFS is a target date, not a Resolve gate.
-- Pending circuits registered by a ticket carry the RFS instant in "plannedActiveAt";
-- a cron sweep flips them to Active when it passes. Additive and nullable: older
-- images ignore both columns, no data rewrite.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "plannedActiveAt" TIMESTAMP(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Service_status_plannedActiveAt_idx" ON "Service"("status", "plannedActiveAt");
