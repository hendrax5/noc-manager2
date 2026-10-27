-- Google Drive archive for ticket attachments (additive only).
-- Apply once before switching to the release that reads these columns:
--   docker compose -f docker-compose.prod.yml exec -T db \
--     psql -U postgres -d nocticketing -v ON_ERROR_STOP=1 < prisma/changes/20261027_drive_attachments.sql
--
-- Legacy attachments are marked "skipped" so the first enable does not backfill 1.4 GB
-- automatically. Use POST /api/internal/drive-sync/backfill to archive them on purpose.

ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveUrl" TEXT;
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveSyncedAt" TIMESTAMP(3);
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "driveError" TEXT;

-- Cutoff is fixed (not NOW()) so re-running the script never skips freshly uploaded files.
UPDATE "Attachment"
   SET "driveStatus" = 'skipped'
 WHERE "driveStatus" = 'pending'
   AND "driveFileId" IS NULL
   AND "createdAt" < TIMESTAMP '2026-10-27 00:00:00';

CREATE INDEX IF NOT EXISTS "Attachment_driveStatus_driveAttempts_idx"
  ON "Attachment" ("driveStatus", "driveAttempts");
