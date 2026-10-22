CREATE TABLE IF NOT EXISTS "ServiceIdentifier" (
  "id" SERIAL PRIMARY KEY,
  "serviceId" INTEGER NOT NULL REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "code" TEXT NOT NULL,
  "originalCode" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "sourceTicketId" INTEGER,
  "actorId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceIdentifier_code_normalized" CHECK ("code" = upper(btrim("code")) AND length("code") BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceIdentifier_code_key" ON "ServiceIdentifier"("code");
CREATE INDEX IF NOT EXISTS "ServiceIdentifier_serviceId_idx" ON "ServiceIdentifier"("serviceId");
