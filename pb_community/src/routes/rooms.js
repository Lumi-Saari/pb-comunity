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
          <h5>ルーム名 二十五文字まで</h5>
          <input type="text" name="roomName" maxlength="25" />
        </div>
        <div>
          <h5>説明（なくてもOK）五十文字まで</h5>
          <textarea name="memo" maxlength="50"></textarea>
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

//　TODO 説明を更新する機能
app.post('/roomId/memo', async (c) => {
  const { user } = c.get('session') ?? {};
  const { roomId } = c.req.param();
  const body = await c.req.parseBody();

  if (!user?.userId) return c.text('ログインしてください', 401);

  const room = await prisma.room.findUnique({ where: { roomId} });
  if (!room) return c.text('ルームが見つかりません', 404);

  // 作成者チェックを追加
  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみが説明を変更できます', 403);
  }

  await prisma.memo.upsert({
    where: { roomId },
    update: { memo: body.memo || "" },
    create: { roomId, memo: body.memo || "" },
  })
})

app.get('/:roomId', async (c) => {
  const { roomId } = c.req.param();
  const memo = await prisma.room.findUnique({
    where: { roomId },
    select: { memo: true }
  }).then(r => r?.memo);

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

 const { user } = c.get('session') ?? {};
if (!user?.userId) return c.redirect('/login');

// UserRoomSetting テーブルに notify TRUE/FALSE の設定があるか探す
const setting = await prisma.userRoomSetting.findFirst({
  where: {
    roomId,
    userId: user.userId,
  },
});

// 判定用フラグ
const notifyEnabled = !!(setting && setting.notify);


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
    <h4>説明: ${memo || 'なし'}</h4>
    <button id="notify-btn"
     data-room-id="${roomId}"
    data-notify="${notifyEnabled ? 'true' : 'false'}">
    ${notifyEnabled ? '🔔 通知オン' : '🔕 通知オフ'}
   </button>
    <script src="/notify.js"></script>
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

// 通知オン／オフ切り替え
app.post('/:roomId/notify', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.text('ログインしてください', 401);

  const { roomId } = c.req.param();
  const { notify } = await c.req.json();

  await prisma.userRoomSetting.upsert({
    where: { userId_roomId: { userId: user.userId, roomId } },
    update: { notify },
    create: { userId: user.userId, roomId, notify },
  });

  return c.json({ ok: true });
});


module.exports = app;