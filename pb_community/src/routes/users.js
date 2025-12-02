const { Hono } = require('hono');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const users = new Hono();

users.use(ensureAuthenticated());

users.get('/', async (c) => {
  const { user } = c.get('session');
  if (!user) return c.redirect('/auth/google');

  const sort = c.req.query('sort') || 'created';

  // 必要な情報を全て取得
  const results = await prisma.user.findMany({
    where: { isDeleted: false },
    select: {
      userId: true,
      username: true,
      activityPlace: true,
      bio: true,
      iconUrl: true,
      createdAt: true,
    },
  });

  // 並び替え
  if (sort === 'name') {
    const collator = new Intl.Collator('ja', { sensitivity: 'base', numeric: true });
    results.sort((a, b) => collator.compare(a.username ?? '', b.username ?? ''));
  } else if (sort === 'latest') {
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'created') {
    results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // 自分を先頭に（並び替え後に！）
  const myUser = results.find(u => u.userId === user.userId);
 const others = results.filter(u => u.userId !== user.userId);
  const allUsers = myUser ? [myUser, ...others] : others;


  // HTML
  const userList = allUsers.map(p => `
    <p><h3><img src="${p.iconUrl || '/uploads/default.jpg'}" alt="アイコン" width="50" height="50">
    <strong>${p.username ?? '名無しユーザー'}</h3></strong></p>
    <p>活動場所: ${p.activityPlace ?? '未設定'}</p>
    <p>自己紹介: ${p.bio ?? '未設定'}</p>
    <hr/>
  `).join('');

  return c.html(`
    <!doctype html>
    <html>
      <head>
        <title>ユーザー一覧</title>
        <link rel="stylesheet" href="/stylesheets/style.css" />
      </head>
      <body>
        <h1>ユーザー一覧</h1>
        <a href="/">ホームへ戻る</a>
        <div>
          <a href="/users?sort=name">あいうえお順</a> |
          <a href="/users?sort=created">登録順</a> |
          <a href="/users?sort=latest">新しい順</a>
        </div>
        <div id="userList">${userList}</div>
      </body>
    </html>
  `);
});

module.exports = users;
