-- Additive upgrade for existing db-push installations. Apply with psql -v ON_ERROR_STOP=1.
-- Existing tickets remain Unclassified; no heuristic backfill or data removal.
BEGIN;
CREATE TABLE IF NOT EXISTS "TroubleMasterEntry" (
  "id" SERIAL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TroubleMasterEntry_kind_normalizedName_key" ON "TroubleMasterEntry"("kind","normalizedName");
CREATE INDEX IF NOT EXISTS "TroubleMasterEntry_kind_active_sortOrder_idx" ON "TroubleMasterEntry"("kind","active","sortOrder");
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "workType" TEXT NOT NULL DEFAULT 'Unclassified';
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "sapReference" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "symptomId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "causeId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "symptomLabel" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "causeLabel" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "cid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Service_cid_key" ON "Service"("cid");
CREATE INDEX IF NOT EXISTS "Ticket_workType_createdAt_idx" ON "Ticket"("workType","createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Ticket_symptomId_fkey') THEN
    ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "TroubleMasterEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Ticket_causeId_fkey') THEN
    ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "TroubleMasterEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
INSERT INTO "TroubleMasterEntry"("kind","name","normalizedName","description","sortOrder") VALUES
 ('symptom','Down / Tidak terkoneksi','down / tidak terkoneksi','Layanan tidak dapat diakses.',10),
 ('symptom','Intermittent / Putus-nyambung','intermittent / putus-nyambung','Koneksi terputus berulang.',20),
 ('symptom','High Latency','high latency','Waktu respons di atas ambang layanan.',30),
 ('symptom','Packet Loss','packet loss','Paket hilang pada pengukuran.',40),
 ('symptom','Slow Throughput','slow throughput','Kecepatan aktual menurun.',50),
 ('cause','FO CUT','fo cut','Kabel fiber optik putus.',10),
 ('cause','Fiber Bending','fiber bending','Tekukan fiber atau core.',20),
 ('cause','Gangguan listrik','gangguan listrik','Gangguan suplai daya.',30),
 ('cause','Kerusakan perangkat','kerusakan perangkat','Perangkat atau komponen rusak.',40),
 ('cause','Kesalahan konfigurasi','kesalahan konfigurasi','Konfigurasi perangkat tidak sesuai.',50),
 ('cause','Gangguan routing','gangguan routing','Gangguan rute atau peering.',60),
 ('cause','Kapasitas penuh / Congestion','kapasitas penuh / congestion','Kapasitas tidak mencukupi.',70),
 ('cause','Gangguan pihak ketiga','gangguan pihak ketiga','Gangguan di luar jaringan sendiri.',80),
 ('cause','Belum diketahui','belum diketahui','Investigasi masih berjalan.',90)
ON CONFLICT ("kind","normalizedName") DO NOTHING;
COMMIT;
