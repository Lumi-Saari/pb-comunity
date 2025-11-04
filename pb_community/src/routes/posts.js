const { Hono } = require('hono');
const { html } = require('hono/html');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query']});

const app = new Hono();
// routes/posts.js
app.post('/rooms/:roomId/posts', async (c) => {
  const { roomId } = c.req.param();
  const body = await c.req.parseBody();
  const content = body.content;

  // セッションからユーザーを取得
  const { user } = c.get('session') ?? {};
  if (!user) {
    return c.text('ログインが必要です', 401);
  }

  if (user.isDeleted) {
    console.log("機能してるかー？");
    return c.html(layout(c, 'エラー', html`
      <p>ログイン情報がありません。再度ログインしてください。</p>
      <a href="/login">ログイン</a>
    `));
  }

const existingUser = await prisma.user.findUnique({ where: { userId: user.userId } });
if(!existingUser) return c.text('ユーザーが存在しません',400);

//　！この下見ないほうがいいよ！
  const bannedWords = [  // 暴力・危険行為
  "殺す", "殴る", "蹴る", "刺す", "爆弾", "危険",,

  // いじめ・差別
  "バカ", "死ね", "ブス", "キモい", "アホ", "差別", "障害者","やめろ",

  // 性的・下ネタ
  "エロ", "セックス", "下ネタ", "AV", "裸", "ちんこ", "まんこ",

  // SNSで禁止されるような侮辱表現
  "氏ね", "クズ", "死体", "ゴミ", "チンポ", "チンチン",

  // 個人情報系（簡易チェック用）
  "@", "gmail", "yahoo", "電話番号", "住所"];
  if (bannedWords.some(word => content.includes(word))) {
    return c.text("!不適切な投稿が含まれています!", 400);
  }
  // 投稿チェック関数
function containsBannedWords(content) {
  const text = content.toLowerCase(); // 大文字小文字無視
  return bannedWords.some(word => text.includes(word.toLowerCase()));
}

  if (containsBannedWords(content)) {
    return c.text("!不適切な言葉が含まれています!", 400);
  }

// 投稿作成
const post = await prisma.roomPost.create({
  data: {
    roomId,
    userId: user.userId,
    content,
  },
});

// 通知設定を取得（投稿者以外で通知ONの人）
const settings = await prisma.userRoomSetting.findMany({
  where: {
    roomId,
    notify: true,
    NOT: { userId: user.userId },
  },
});

// 通知レコードを作成
await Promise.all(
  settings.map(t =>
    prisma.notification.create({
      data: {
        userId: t.userId,
        message: `${user.name} さんがルームに投稿しました`,
        url: `/rooms/${roomId}#post-${post.id}`, // ✅ post.id はここで定義済み
      },
    })
  )
);

  // 投稿後はルームページにリダイレクト
  return c.redirect(`/rooms/${roomId}`, 303);
});
 

app.post('/privates/:privateId/posts', async (c) => {
  const { privateId } = c.req.param();
  const body = await c.req.parseBody();
  const content = body.content;

  const { user } = c.get('session') ?? {};
  if(!user) {
    return c.text('ログインが必要です', 401);
  }

  if (user.isDeleted) {
    return c.html(layout(c, 'エラー', html`
      <p>ログイン情報がありません。再度ログインしてください。</p>
      <a href="/login">ログイン</a>
    `));
  }

const existingUser = await prisma.user.findUnique({ where: { userId: user.userId } });
if(!existingUser) return c.text('ユーザーが存在しません',400);

  const bannedWords = ["暴力", "差別"];
  if (bannedWords.some(word => content.includes(word))) {
    return c.text("不適切な投稿が含まれています", 400);
  }

const post = await prisma.privatePost.create({
  data: {
    content,
    privateId,
    userId: user.userId,
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
const session = c.get('session');
console.log(session);

return c.redirect(`/privates/${privateId}`, 303);
});


module.exports = app;