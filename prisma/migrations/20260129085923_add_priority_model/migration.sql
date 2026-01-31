-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "fotoRumah" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "pengawalan" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "priority" TEXT;

-- CreateTable
CREATE TABLE "Priority" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Priority_name_key" ON "Priority"("name");
