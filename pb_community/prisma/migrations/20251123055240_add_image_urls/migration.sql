-- AlterTable
ALTER TABLE "public"."PrivateMember" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."RoomPost" ADD COLUMN     "thumbnailUrl" TEXT;
