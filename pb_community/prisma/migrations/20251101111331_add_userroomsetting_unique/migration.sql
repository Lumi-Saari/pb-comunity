/*
  Warnings:

  - A unique constraint covering the columns `[userId,privateId]` on the table `UserRoomSetting` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,roomId]` on the table `UserRoomSetting` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserRoomSetting_userId_privateId_key" ON "public"."UserRoomSetting"("userId", "privateId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoomSetting_userId_roomId_key" ON "public"."UserRoomSetting"("userId", "roomId");
