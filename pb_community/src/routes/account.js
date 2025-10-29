const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const app = new Hono();

app.use(ensureAuthenticated());

app.get('/', (c) => {
  return c.html(
    layout(
      c,
      'アカウント管理',
      html`
        <h3>アカウント削除</h3>
        <form method="post" action="/account/delete" onsubmit="return confirm('本当に退会しますか？')">
          <button type="submit">退会する</button>
        </form>
      `
    )
  );
});

app.post('/delete', async (c) => {
  const session = c.get('session');
  const userId = session?.user?.userId;

 if (!userId) {
  return c.html(layout(c, 'エラー', html`
    <p>ログイン情報がありません。再度ログインしてください。</p>
    <a href="/login">ログイン</a>
  `));
 }

  try {
    await prisma.user.update({
      where: { userId },
      data: {
        username: `退会ユーザー_${userId.slice(0, 6)}`,
      },
    });

    await prisma.roomPost.updateMany({
      where: { userId: userId },
      data: { isDeleted: true },
    })
    await prisma.privatePost.updateMany({
      where: { userId: userId },
      data: { isDeleted: true },
    })

    c.set('session', null);
    return c.html(
      layout(
        c,
        '退会しました',
        html`
          <p>退会しました。ご利用ありがとうございました。</p>
          <a href="/">トップページへ</a>
        `
      )
    );
  } catch (err) {
     console.error('❌ Error:', err)
    return c.html(
      layout(
        c,
        'エラー',
        html`
          <p>退会に失敗しました。時間をおいて再度お試しください。</p>
          <a href="/account">アカウント管理へ戻る</a>
          ${err.message}
        `
      )
    );
  }
});

module.exports = app;