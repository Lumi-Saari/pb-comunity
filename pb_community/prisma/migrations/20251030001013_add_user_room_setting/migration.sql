/*
  Warnings:

  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropTable
DROP TABLE "public"."Notification";

-- CreateTable
CREATE TABLE "public"."UserRoomSetting" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "privateId" TEXT,
    "notify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoomSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRoomSetting_userId_roomId_privateId_key" ON "public"."UserRoomSetting"("userId", "roomId", "privateId");

-- AddForeignKey
ALTER TABLE "public"."UserRoomSetting" ADD CONSTRAINT "UserRoomSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRoomSetting" ADD CONSTRAINT "UserRoomSetting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("roomId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRoomSetting" ADD CONSTRAINT "UserRoomSetting_privateId_fkey" FOREIGN KEY ("privateId") REFERENCES "public"."privates"("privateId") ON DELETE SET NULL ON UPDATE CASCADE;
