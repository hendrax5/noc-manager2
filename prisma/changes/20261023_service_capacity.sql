-- CreateTable
CREATE TABLE "CustomerPickerUse" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPickerUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPickerUse_ticketId_key" ON "CustomerPickerUse"("ticketId");

-- CreateIndex
CREATE INDEX "CustomerPickerUse_userId_createdAt_customerId_idx" ON "CustomerPickerUse"("userId", "createdAt", "customerId");

-- AddForeignKey
ALTER TABLE "CustomerPickerUse" ADD CONSTRAINT "CustomerPickerUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPickerUse" ADD CONSTRAINT "CustomerPickerUse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPickerUse" ADD CONSTRAINT "CustomerPickerUse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
