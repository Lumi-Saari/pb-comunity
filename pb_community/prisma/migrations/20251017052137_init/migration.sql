-- CreateTable
CREATE TABLE "public"."users" (
    "userId" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."rooms" (
    "roomId" TEXT NOT NULL,
    "roomName" VARCHAR(255) NOT NULL,
    "memo" TEXT NOT NULL,
    "createBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "public"."privates" (
    "privateId" TEXT NOT NULL,
    "privateName" VARCHAR(255) NOT NULL,
    "memo" TEXT NOT NULL,
    "createBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privates_pkey" PRIMARY KEY ("privateId")
);

-- CreateTable
CREATE TABLE "public"."PrivateMember" (
    "id" TEXT NOT NULL,
    "privateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomPost" (
    "postId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoomPost_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."private_posts" (
    "postId" TEXT NOT NULL,
    "privateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "private_posts_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateMember_privateId_userId_key" ON "public"."PrivateMember"("privateId", "userId");

-- AddForeignKey
ALTER TABLE "public"."rooms" ADD CONSTRAINT "rooms_createBy_fkey" FOREIGN KEY ("createBy") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."privates" ADD CONSTRAINT "privates_createBy_fkey" FOREIGN KEY ("createBy") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateMember" ADD CONSTRAINT "PrivateMember_privateId_fkey" FOREIGN KEY ("privateId") REFERENCES "public"."privates"("privateId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivateMember" ADD CONSTRAINT "PrivateMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomPost" ADD CONSTRAINT "RoomPost_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("roomId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomPost" ADD CONSTRAINT "RoomPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_posts" ADD CONSTRAINT "private_posts_privateId_fkey" FOREIGN KEY ("privateId") REFERENCES "public"."privates"("privateId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_posts" ADD CONSTRAINT "private_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
