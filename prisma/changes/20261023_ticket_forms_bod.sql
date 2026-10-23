-- CreateTable
CREATE TABLE "BodWindow" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "normalBandwidthMbps" DOUBLE PRECISION NOT NULL,
    "bodBandwidthMbps" DOUBLE PRECISION NOT NULL,
    "normalSnapshot" JSONB NOT NULL,
    "activeSnapshot" JSONB,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" INTEGER,
    "activationEvidence" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredBy" INTEGER,
    "restorationEvidence" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" INTEGER,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BodWindow_ticketId_key" ON "BodWindow"("ticketId");

-- CreateIndex
CREATE INDEX "BodWindow_serviceId_endsAt_idx" ON "BodWindow"("serviceId", "endsAt");

-- CreateIndex
CREATE INDEX "BodWindow_restoredAt_cancelledAt_endsAt_idx" ON "BodWindow"("restoredAt", "cancelledAt", "endsAt");

-- AddForeignKey
ALTER TABLE "BodWindow" ADD CONSTRAINT "BodWindow_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodWindow" ADD CONSTRAINT "BodWindow_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
