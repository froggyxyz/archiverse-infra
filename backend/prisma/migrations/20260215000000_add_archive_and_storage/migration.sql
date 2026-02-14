-- AlterTable
ALTER TABLE "User" ADD COLUMN "storageLimit" BIGINT NOT NULL DEFAULT 10737418240;
ALTER TABLE "User" ADD COLUMN "storageUsed" BIGINT NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE');
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" BIGINT,
    "mimeType" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "s3Key" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "currentStage" TEXT,
    "stageProgress" DOUBLE PRECISION,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
