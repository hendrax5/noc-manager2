ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mergedIntoId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_mergedIntoId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_mergedIntoId_fkey"
      FOREIGN KEY ("mergedIntoId") REFERENCES "Customer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_active_name_idx" ON "Customer"("active", "name");
CREATE INDEX IF NOT EXISTS "Customer_mergedIntoId_idx" ON "Customer"("mergedIntoId");
