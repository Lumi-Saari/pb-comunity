const { Hono } = require('hono');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query']});
const { streamSSE } = require('hono/streaming');
const { addStream, removeStream } = require('../utils/eventStream');
const { broadcast } = require('../utils/eventStream');

const app = new Hono();

app.post('/rooms/:roomId/posts', async (c) => {
  const { roomId } = c.req.param();

  const { user } = c.get('session') ?? {};
  if (!user) return c.text('ログインが必要です', 401);

  const existingUser = await prisma.user.findUnique({ where: { userId: user.userId } });
  if (!existingUser) return c.text('ユーザーが存在しません', 400);

  // リクエストボディをまず読み込む
  const body = await c.req.json();
  const content = typeof body.content === 'string' ? body.content : null;
  const imageUrl = body.imageUrl ?? null;
  const thumbnailUrl = body.thumbnailUrl ?? null;
  
  // NGワードチェック（ここで content を使う）
  const bannedWords = [
    "殺す","殴る","蹴る","刺す","爆弾","危険",
    "バカ","死ね","ブス","キモい","アホ","差別","障害者","やめろ",
    "エロ","セックス","下ネタ","AV","裸","ちんこ","まんこ",
    "氏ね","クズ","死体","ゴミ","チンポ","チンチン",
    "@","gmail","yahoo","電話番号","住所"
  ];

  function containsBannedWords(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word.toLowerCase()));
  }

  if (containsBannedWords(content)) {
    return c.text("!不適切な言葉が含まれています!", 400);
  }

  const room = await prisma.room.findUnique({ 
  where: { roomId },
  select: { roomName: true },
 });

  const post = await prisma.RoomPost.create({
    data: {
       roomId,
       userId: user.userId,
       content,
       imageUrl,
       thumbnailUrl,
},
    include: {
      user: {
        select: { username: true, iconUrl: true },
      },
    },
  });

  broadcast(roomId, "postCreated", {
  postId: post.postId,
  user: {
    username: post.user.username,
    iconUrl: post.user.iconUrl,
  },
  content: post.content,
  imageUrl: post.imageUrl,
  thumbnailUrl: post.thumbnailUrl,
  createdAt: post.createdAt,
});

  // 通知対象の設定を取得
const settings = await prisma.userRoomSetting.findMany({
  where: {
    roomId,
    notify: true,
    NOT: { userId: user.userId },
  },
});

// 通知レコードを作成
await Promise.all(
  settings.map(s =>
    prisma.notification.create({
      data: {
        userId: s.userId,
        message: `${user.username} さんが${room.roomName}に投稿しました`,
        url: `/rooms/${roomId}#post-${post.id}`,
      },
    })
  )
);

return c.json(post)
});

app.get('/rooms/:roomId/events', (c) => {
  const { roomId } = c.req.param();

  return streamSSE(c, async (stream) => {
    addStream(roomId, stream);

    stream.onAbort(() => {
      removeStream(roomId, stream);
    });

    stream.writeSSE({ event: "connected", data: "ok" });
  });
});

app.post('/rooms/:roomId/replies', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.text('ログインが必要です', 401);

  const { roomId } = c.req.param();
  const { content, parentId, imageUrl, thumbnailUrl } = await c.req.json();

  if (!parentId) return c.text('parentId が必要です', 400);

  // parentId を postId として検索
  const parent = await prisma.roomPost.findUnique({ where: { postId: parentId } });
  if (!parent) return c.text('返信先の投稿が見つかりません', 404);

    // NGワードチェック（ここで content を使う）
  const bannedWords = [
    "殺す","殴る","蹴る","刺す","爆弾","危険",
    "バカ","死ね","ブス","キモい","アホ","差別","障害者","やめろ",
    "エロ","セックス","下ネタ","AV","裸","ちんこ","まんこ",
    "氏ね","クズ","死体","ゴミ","チンポ","チンチン",
    "@","gmail","yahoo","電話番号","住所"
  ];

  function containsBannedWords(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word.toLowerCase()));
  }

  if (containsBannedWords(content)) {
    return c.text("!不適切な言葉が含まれています!", 400);
  }

  const reply = await prisma.RoomPost.create({
  data: {
    roomId,
    userId: user.userId,
    parentId,
    content,
    imageUrl,
    thumbnailUrl,
  },
  include: {
    user: { select: { username: true, iconUrl: true } },
  },
});

const post = await prisma.RoomPost.findUnique({
  where: { postId: parentId },
  select: { content: true },
});

broadcast(roomId, "replyCreated", {
  replyId: reply.postId,
  parentId: reply.parentId,
  content: reply.content,
  imageUrl: reply.imageUrl,
  thumbnailUrl: reply.thumbnailUrl,
  createdAt: reply.createdAt,
  user: {
    username: reply.user.username,
    iconUrl: reply.user.iconUrl,
  },
});


// 親投稿のユーザー
const parentUserId = parent.userId;

// 自分自身には通知しない
if (parentUserId !== user.userId) {

  // 通知設定を確認（UserRoomSetting）
  const setting = await prisma.userRoomSetting.findFirst({
    where: {
      userId: parentUserId,
      roomId: roomId,
    }
  });

  if (setting?.notify) {
    await prisma.notification.create({
      data: {
        userId: parentUserId,
        message: `${user.username} さんが${post.content}に返信しました`,
        url: `/rooms/${roomId}#post-${reply.postId}`, // 好きなURL
      }
    });
  }
}
// /rooms/:roomId/replies の中、reply 作成後に
const payload = {
  replyId: reply.postId,
  parentId: reply.parentId,
  content: reply.content,
  imageUrl: reply.imageUrl,
  thumbnailUrl: reply.thumbnailUrl,
  createdAt: reply.createdAt,
  user: {
    username: reply.user.username,
    iconUrl: reply.user.iconUrl
  }
};

console.log('[POST] created reply', payload);
broadcast(roomId, "replyCreated", payload);


  return c.json(reply);
});

 

app.post('/privates/:privateId/posts', async (c) => {
  const { privateId } = c.req.param();

  const { user } = c.get('session') ?? {};
  if (!user) return c.text('ログインが必要です', 401);

  const existingUser = await prisma.user.findUnique({ where: { userId: user.userId } });
  if (!existingUser) return c.text('ユーザーが存在しません', 400);

  // リクエストボディをまず読み込む
  const body = await c.req.json();
  const content = typeof body.content === 'string' ? body.content : null;
  const imageUrl = body.imageUrl ?? null;
  const thumbnailUrl = body.thumbnailUrl ?? null;
  
  // NGワードチェック（ここで content を使う）
  const bannedWords = [
    "殺す","殴る","蹴る","刺す","爆弾","危険",
    "バカ","死ね","ブス","キモい","アホ","差別","障害者","やめろ",
    "エロ","セックス","下ネタ","AV","裸","ちんこ","まんこ",
    "氏ね","クズ","死体","ゴミ","チンポ","チンチン",
    "@","gmail","yahoo","電話番号","住所"
  ];

  function containsBannedWords(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word.toLowerCase()));
  }

  if (containsBannedWords(content)) {
    return c.text("!不適切な言葉が含まれています!", 400);
  }

  const post = await prisma.privatePost.create({
    data: {
       privateId,
       userId: user.userId,
       content,
       imageUrl,
       thumbnailUrl,
},
    include: {
      user: {
        select: { username: true, iconUrl: true },
      },
    },
  });

  const room = await prisma.Private.findUnique({ 
  where: { privateId },
  select: { privateName: true },
 });

  broadcast(privateId, "postCreated", {
  postId: post.postId,
  user: {
    username: post.user.username,
    iconUrl: post.user.iconUrl,
  },
  content: post.content,
  imageUrl: post.imageUrl,
  thumbnailUrl: post.thumbnailUrl,
  createdAt: post.createdAt,
});

  // 通知対象の設定を取得
const settings = await prisma.userRoomSetting.findMany({
  where: {
    privateId,
    notify: true,
    NOT: { userId: user.userId },
  },
});

// 通知レコードを作成
await Promise.all(
  settings.map(s =>
    prisma.notification.create({
      data: {
        userId: s.userId,
        message: `${user.username} さんが${room.privateName}に投稿しました`,
        url: `/privates/${privateId}#post-${post.id}`,
      },
    })
  )
);

return c.json(post)
});

app.get('/privates/:privateId/events', (c) => {
  const { privateId } = c.req.param();

  return streamSSE(c, async (stream) => {
    addStream(privateId, stream);

    stream.onAbort(() => {
      removeStream(privateId, stream);
    });

    stream.writeSSE({ event: "connected", data: "ok" });
  });
});

app.post('/privates/:privateId/replies', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.text('ログインが必要です', 401);

  const { privateId } = c.req.param();
  const { content, parentId, imageUrl, thumbnailUrl } = await c.req.json();

  if (!parentId) return c.text('parentId が必要です', 400);

  // parentId を postId として検索
  const parent = await prisma.privatePost.findUnique({ where: { postId: parentId } });
  if (!parent) return c.text('返信先の投稿が見つかりません', 404);

   // NGワードチェック（ここで content を使う）
  const bannedWords = [
    "殺す","殴る","蹴る","刺す","爆弾","危険",
    "バカ","死ね","ブス","キモい","アホ","差別","障害者","やめろ",
    "エロ","セックス","下ネタ","AV","裸","ちんこ","まんこ",
    "氏ね","クズ","死体","ゴミ","チンポ","チンチン",
    "@","gmail","yahoo","電話番号","住所"
  ];

  function containsBannedWords(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word.toLowerCase()));
  }

  if (containsBannedWords(content)) {
    return c.text("!不適切な言葉が含まれています!", 400);
  }

  const reply = await prisma.privatePost.create({
  data: {
    privateId,
    userId: user.userId,
    parentId,
    content,
    imageUrl,
    thumbnailUrl,
  },
  include: {
    user: { select: { username: true, iconUrl: true } },
  },
});

const post = await prisma.privatePost.findUnique({
  where: { postId: parentId },
  select: { content: true },
});

broadcast(privateId, "replyCreated", {
  parentId: reply.parentId,
});

// 親投稿のユーザー
const parentUserId = parent.userId;

// 自分自身には通知しない
if (parentUserId !== user.userId) {

  // 通知設定を確認（UserRoomSetting）
  const setting = await prisma.userRoomSetting.findFirst({
    where: {
      userId: parentUserId,
      privateId: privateId,
    }
  });

  if (setting?.notify) {
    await prisma.notification.create({
      data: {
        userId: parentUserId,
        message: `${user.username} さんが${post.content}に返信しました`,
        url: `/privates/${privateId}#post-${reply.postId}`, // 好きなURL
      }
    });
  }
}


  return c.json(reply);
});

module.exports = app;