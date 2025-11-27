/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `PrivateMember` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnailUrl` on the `PrivateMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."PrivateMember" DROP COLUMN "imageUrl",
DROP COLUMN "thumbnailUrl";

-- AlterTable
ALTER TABLE "public"."private_posts" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;
