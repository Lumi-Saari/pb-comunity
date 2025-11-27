-- CreateTable
CREATE TABLE "public"."RoomPostReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomPostReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrivatePostReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivatePostReply_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."RoomPostReply" ADD CONSTRAINT "RoomPostReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."RoomPost"("postId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomPostReply" ADD CONSTRAINT "RoomPostReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivatePostReply" ADD CONSTRAINT "PrivatePostReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."private_posts"("postId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrivatePostReply" ADD CONSTRAINT "PrivatePostReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
