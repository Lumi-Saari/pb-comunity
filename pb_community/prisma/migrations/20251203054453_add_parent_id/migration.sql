/*
  Warnings:

  - You are about to drop the `PrivatePostReply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoomPostReply` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PrivatePostReply" DROP CONSTRAINT "PrivatePostReply_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PrivatePostReply" DROP CONSTRAINT "PrivatePostReply_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoomPostReply" DROP CONSTRAINT "RoomPostReply_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoomPostReply" DROP CONSTRAINT "RoomPostReply_userId_fkey";

-- AlterTable
ALTER TABLE "public"."RoomPost" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "public"."private_posts" ADD COLUMN     "parentId" TEXT;

-- DropTable
DROP TABLE "public"."PrivatePostReply";

-- DropTable
DROP TABLE "public"."RoomPostReply";

-- AddForeignKey
ALTER TABLE "public"."RoomPost" ADD CONSTRAINT "RoomPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."RoomPost"("postId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_posts" ADD CONSTRAINT "private_posts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."private_posts"("postId") ON DELETE SET NULL ON UPDATE CASCADE;
