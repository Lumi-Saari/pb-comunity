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
          <h5>ルーム名</h5>
          <input type="text" name="privateName" />
        </div>
        <div>
          <h5>説明（なくてもOK）</h5>
          <textarea name="memo"></textarea>
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
  const username = body.username;

  if (!user?.userId) return c.text('ログインしてください', 401);

  const room = await prisma.private.findUnique({ where: { privateId } });
  if (!room) return c.text('ルームが見つかりません', 404);

  // 作成者チェックを追加
  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみがメンバーを招待できます', 403);
  }

  await prisma.privateMember.upsert({
    where: { privateId_userId: { privateId, userId: invitee.userId } },
    update: {},
    create: { privateId, userId: invitee.userId },
  });

  await prisma.privatePost.create({
    data: {
      privateId,
      userId: user.userId,
      content: `${user.username} さんが ${invitee.username} さんを招待しました。`,
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

module.exports = app;