-- Legacy brand aliases that resolve to an existing Customer when linking CIDs.
-- Additive and nullable: older images ignore the column, no data rewrite.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "aliases" JSONB;
