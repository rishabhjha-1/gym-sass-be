/*
  Warnings:

  - Added the required column `gymId` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gymId` to the `Equipment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gymId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gymId` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gymId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- Insert default gym
INSERT INTO "Gym" ("id", "name", "address", "createdAt", "updatedAt")
VALUES ('default-gym', 'Default Gym', 'Default Address', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add nullable gymId columns
ALTER TABLE "Class" ADD COLUMN "gymId" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "gymId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "gymId" TEXT;
ALTER TABLE "Member" ADD COLUMN "gymId" TEXT;
ALTER TABLE "User" ADD COLUMN "gymId" TEXT;

-- Update existing records with default gym
UPDATE "Class" SET "gymId" = 'default-gym' WHERE "gymId" IS NULL;
UPDATE "Equipment" SET "gymId" = 'default-gym' WHERE "gymId" IS NULL;
UPDATE "Expense" SET "gymId" = 'default-gym' WHERE "gymId" IS NULL;
UPDATE "Member" SET "gymId" = 'default-gym' WHERE "gymId" IS NULL;
UPDATE "User" SET "gymId" = 'default-gym' WHERE "gymId" IS NULL;

-- Make gymId columns required
ALTER TABLE "Class" ALTER COLUMN "gymId" SET NOT NULL;
ALTER TABLE "Equipment" ALTER COLUMN "gymId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "gymId" SET NOT NULL;
ALTER TABLE "Member" ALTER COLUMN "gymId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "gymId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
