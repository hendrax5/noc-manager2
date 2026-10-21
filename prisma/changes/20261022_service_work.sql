BEGIN;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "serviceWorkTypeId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "serviceWorkTypeLabel" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "serviceChange" JSONB;
CREATE TABLE IF NOT EXISTS "ServiceWorkType" (
 "id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL UNIQUE,
 "operation" TEXT NOT NULL, "defaultJobCategoryId" INTEGER, "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "ServiceWorkType" ("name","normalizedName","operation","sortOrder") VALUES
 ('Instalasi Baru','instalasi baru','Installation',0),('Upgrade','upgrade','Upgrade',1),('Downgrade','downgrade','Downgrade',2),('Perubahan Layanan','perubahan layanan','Change',3),('Terminasi','terminasi','Terminate',4)
 ON CONFLICT ("normalizedName") DO NOTHING;
COMMIT;
