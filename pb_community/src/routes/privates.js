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
    'プライベートルームの作成',
    html`
      <form method="post" action="/privates">
        <div>
          <h5>ルーム名 二十五文字まで</h5>
          <input type="text" name="privateName"  maxlength="25" />
        </div>
        <div>
          <h5>説明（なくてもOK）五十文字まで</h5>
          <textarea name="memo" maxlength="50" ></textarea>
        </div>
        <button type="submit">プライベートルームを作成</button>
      </form>
    `,
   ),
  );
});

 // プライベートルーム作成
app.post('/', async (c) => {
  const { user } = c.get('session') ?? {};
  const body = await c.req.parseBody();

  if (!user?.userId) {
    return c.json({ error: 'ログインしてください' }, 401);
  }

  if (!user || user.isDeleted) {
    return c.html(layout(c, 'エラー', html`
      <p>ログイン情報がありません。再度ログインしてください。</p>
      <a href="/login">ログイン</a>
    `));
  }

const privateRoom = await prisma.private.create({
  data: {
    privateId: randomUUID(),
    privateName: body.privateName || "名称未設定",
    memo: body.memo || "",
    createBy: user.userId,  
  },
  select: { privateId: true, privateName: true, updatedAt: true }
});

await prisma.privateMember.upsert({
  where: { privateId_userId: { privateId: privateRoom.privateId, userId: user.userId } },
  create: { privateId: privateRoom.privateId, userId: user.userId },
  update: {}, // upsert なので update も必要
});

return c.redirect('/privates/' + privateRoom.privateId);
});

app.post('/:privateId/invitation', async (c) => {
  const { user } = c.get('session') ?? {};
  const { privateId } = c.req.param();
  const body = await c.req.parseBody();
  const username = body.username; // 招待対象ユーザー名を取得

  if (!user?.userId) return c.text('ログインしてください', 401);

  // 招待先ルーム確認
  const room = await prisma.private.findUnique({ where: { privateId } });
  if (!room) return c.text('ルームが見つかりません', 404);

  // 作成者チェック
  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみがメンバーを招待できます', 403);
  }

  // 招待対象ユーザー検索
  const invitee = await prisma.user.findUnique({ where: { username } });
  if (!invitee) return c.text('指定されたユーザーが見つかりません', 404);

  // すでにメンバーの場合はスキップ
  const existingMember = await prisma.privateMember.findUnique({
    where: { privateId_userId: { privateId, userId: invitee.userId } },
  });
  if (existingMember) {
    return c.text(`${invitee.username} さんはすでにメンバーです`, 400);
  }

  // メンバー追加
  await prisma.privateMember.create({
    data: { privateId, userId: invitee.userId },
  });

  // 招待メッセージ投稿
  await prisma.privatePost.create({
    data: {
      privateId,
      userId: user.userId,
      content: `${user.name} さんが ${invitee.username} さんを招待しました。`,
    },
  });

  // 通知作成
   await prisma.notification.create({
  data: {
    userId: invitee.userId,
    message: `${user.name} さんがあなたをプライベートルーム "${room.privateName}" に招待しました。`,
    url: `/privates/${privateId}`,
  },
});

  return c.redirect(`/privates/${privateId}`);
});


app.post('/:privateId/delete', async (c) => {
  const { user } = c.get('session') ?? {};
  const { privateId } = c.req.param();

  if (!user?.userId) return c.text('ログインしてください', 401);

  const room = await prisma.private.findUnique({
    where: { privateId },
  });
  if (!room) return c.text('ルームが見つかりません', 404);

  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみがルームを削除できます', 403);
  }

  //  投稿を削除
  await prisma.privatePost.deleteMany({
    where: { privateId },
  });

  //  メンバーを削除
  await prisma.privateMember.deleteMany({
    where: { privateId },
  });

  //  ルームを削除
  await prisma.private.delete({
    where: { privateId },
  });

  return c.redirect('/');
});


app.get('/:privateId', async (c) => {
  const { privateId } = c.req.param();

  const private = await prisma.private.findUnique({
    where: { privateId },
    select: { privateName: true }
  });

  if (!private) return c.text('ルームが存在しません', 404);

 const posts = await prisma.privatePost.findMany({
  where: { privateId },
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
    privateId,
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
    <h1>${private.privateName} へようこそ！</h1>
    <a href="/">トップページに戻る</a>
    <form method="POST" action="/privates/${privateId}/invitation">
     <input type="text" name="username" placeholder="招待する人の名前">
     <button type="submit">招待する</button>
    </form>
     <button id="notify-btn"
     data-private-id="${privateId}"
    data-notify="${notifyEnabled ? 'true' : 'false'}">
    ${notifyEnabled ? '🔔 通知オン' : '🔕 通知オフ'}
   </button>
    <script src="/notify.js"></script>
    <form method="POST" action="/privates/${privateId}/delete" onsubmit="return confirm('本当にこのプライベートルームを削除しますか？')">
      <button type="submit">このプライベートルームを削除する</button>
    </form>
    <div id="postList">
      ${postList || '<p>投稿はまだありません</p>'}
    </div>

    <form method="POST" action="/privates/${privateId}/posts">
      <input type="text" name="content" required />
      <button type="submit">投稿</button>
    </form>
  `);
  
});

// 通知オン／オフ切り替え
app.post('/:privateId/notify', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.text('ログインしてください', 401);

  const { privateId } = c.req.param();
  const { notify } = await c.req.json();

  await prisma.userRoomSetting.upsert({
    where: { userId_privateId: { userId: user.userId, privateId } },
    update: { notify },
    create: { userId: user.userId, privateId, notify },
  });

  return c.json({ ok: true });
});

module.exports = app;