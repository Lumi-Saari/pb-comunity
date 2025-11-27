const { Hono } = require('hono');
const { html } = require('hono/html');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query']});

const app = new Hono();
// routes/posts.js
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

  const post = await prisma.roomPost.create({
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
        message: `${user.name} さんがルームに投稿しました`,
        url: `/rooms/${roomId}#post-${post.id}`,
      },
    })
  )
);

  return c.json(post);
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
        message: `${user.name} さんがプライベートルームに投稿しました`,
        url: `/privates/${privateId}#post-${post.id}`,
      },
    })
  )
);

return c.json(post)
});

app.post('/privates/:postId/replies', async (c) => {
  const { postId } = c.req.param();
  const { user } = c.get('session') ?? {};
  if (!user) return c.text('ログインが必要です', 401);

  const body = await c.req.json();
  const content = typeof body.content === 'string' ? body.content : null;
  if (!content) return c.text('返信内容がありません', 400);

  // 返信作成
  const reply = await prisma.privatePostReply.create({
    data: {
      postId,
      userId: user.userId,
      content
    },
    include: {
      user: {
        select: {
          username: true,
          iconUrl: true
        }
      }
    }
  });

  return c.json(reply);
});



module.exports = app;