const { Hono } = require('hono')
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();

app.use(ensureAuthenticated());

app.get('/new', (c) => {
  return c.html(
  layout(
    c,
    'ルームの作成',
    html`
      <form method="post" action="/rooms">
        <div>
          <h5>ルーム名</h5>
          <input type="text" name="roomName" />
        </div>
        <div>
          <h5>説明（なくてもOK）</h5>
          <textarea name="memo"></textarea>
        </div>
        <button type="submit">ルームを作成</button>
      </form>
    `,
   ),
  );
});

// ルーム作成
app.post('/', async (c) => {
  const { user } = c.get('session') ?? {};
  const body = await c.req.parseBody();

  if (!user?.userId) return c.json({ error: 'ログインしてください' }, 401);

  if (!user || user.isDeleted) {
    return c.html(layout(c, 'エラー', html`
      <p>ログイン情報がありません。再度ログインしてください。</p>
      <a href="/login">ログイン</a>
    `));
  }

 const room = await prisma.room.create({
  data: {
    roomId: randomUUID(),
    roomName: body.roomName || "名称未設定",
    memo: body.memo || "",
    createBy: user.userId,  // ← 外部キーのフィールドを直接指定！
  },
  select: { roomId: true, roomName: true, updatedAt: true }
});

  return c.redirect('/rooms/' + room.roomId);
});

app.post('/:roomId/delete', async (c) => {
  const { user } = c.get('session') ?? {};
  const { roomId } = c.req.param();

  if (!user?.userId) return c.text('ログインしてください', 401);

  const room = await prisma.room.findUnique({ where: { roomId} });
  if (!room) return c.text('ルームが見つかりません', 404);

  // 作成者チェックを追加
  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみがルームを削除できます', 403);
  }

  await prisma.roomPost.deleteMany({ where: { roomId } });

  await prisma.room.delete({ where: { roomId } });

  return c.redirect('/');
});

app.get('/:roomId', async (c) => {
  const { roomId } = c.req.param();

  const room = await prisma.room.findUnique({
    where: { roomId },
    select: { roomName: true }
  });

  if (!room) return c.text('ルームが存在しません', 404);

const posts = await prisma.RoomPost.findMany({
  where: { roomId },
  orderBy: { createdAt: 'desc' },
  include: {
    user: {
      select: { username: true }
    }
  }
});

const postList = posts.map(
  (p) => `
  <p><strong>${p.user.username}</strong> :
  ${p.content}
  <br/>
  <small>${p.createdAt.toLocaleString()}</small>
  </p>
  <hr/>
  `
).join('');

  return c.html(`
    <h1>${room.roomName} へようこそ！</h1>
    <a href="/">トップページに戻る</a>
    <form method="POST" action="/rooms/${roomId}/delete" onsubmit="return confirm('本当にこのルームを削除しますか？')">
      <button type="submit">このルームを削除する</button>
    </form>
    <div id="postList">
      ${postList || '<p>投稿はまだありません</p>'}
    </div>

    <form method="POST" action="/rooms/${roomId}/posts">
      <input type="text" name="content" required />
      <button type="submit">投稿</button>
    </form>
  `);
});

module.exports = app;