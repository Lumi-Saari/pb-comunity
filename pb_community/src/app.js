'use strict';
require('dotenv').config();

const { Hono } = require('hono');
const { logger } = require('hono/logger');
const { html } = require('hono/html');
const { HTTPException } = require('hono/http-exception');
const { secureHeaders } = require('hono/secure-headers');
const { env } = require('hono/adapter');
const { serveStatic } = require('@hono/node-server/serve-static');
const { trimTrailingSlash } = require('hono/trailing-slash');
const { PrismaClient } = require('@prisma/client');
const { getIronSession } = require('iron-session');

const layout = require('./layout');
const prisma = new PrismaClient();

// 各ルーターを require で読み込み
const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');
const setupNameRouter = require('./routes/setup-name');
const usersRouter = require('./routes/users');
const roomRouter = require('./routes/rooms');
const privateRouter = require('./routes/privates');
const postsRouter = require('./routes/posts');
const accountRouter = require('./routes/account');
const notificationRouter = require('./routes/notifications');
const uploadRouter = require('./routes/uploads');

const app = new Hono();


app.use(logger());
app.use(serveStatic({ root: './public' } ));
app.use(secureHeaders());
app.use(trimTrailingSlash());

app.use(async (c, next) => {
  const { SESSION_PASSWORD } = env(c);
  const session = await getIronSession(c.req.raw, c.res, {
    password: SESSION_PASSWORD,
    cookieName: 'session',
  });
  c.set('session', session);
  await next();
});

app.get('/auth/google', (c) => {
  const redirectUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  redirectUrl.searchParams.set('client_id', env(c).GOOGLE_CLIENT_ID);
  redirectUrl.searchParams.set('redirect_uri', 'http://localhost:3000/auth/google/callback');
  redirectUrl.searchParams.set('response_type', 'code');
  redirectUrl.searchParams.set('scope', 'openid email profile'); //

  return c.redirect(redirectUrl.toString());
});

// Google認証コールバック
app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.text('codeが取得できませんでした', 400);

  // 1. トークン取得
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env(c).GOOGLE_CLIENT_ID,
      client_secret: env(c).GOOGLE_CLIENT_SECRET,
      redirect_uri: 'http://localhost:3000/auth/google/callback',
      grant_type: 'authorization_code',
    }),
  });
  const tokenJson = await tokenRes.json();

  // 2. Googleユーザー情報取得
  const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  }).then(res => res.json());

  if (!userInfo?.sub) return c.text('Failed to get user ID from Google', 500);

  const session = c.get('session');

  // 3. 既存ユーザー検索
  let user = await prisma.user.findUnique({
    where: { userId: userInfo.sub },
  });

  // 🟢 退会済みユーザーなら復活（usernameも再生成）
  if (user && user.isDeleted) {
    let newUserName;
    while (true) {
      newUserName = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const exists = await prisma.user.findUnique({ where: { username: newUserName } });
      if (!exists) break;
    }

    user = await prisma.user.update({
      where: { userId: userInfo.sub },
      data: {
        isDeleted: false,
        username: newUserName,
      },
    });
  }
  // 4. 初回ログイン（新規登録）
  if (!user) {
    let defaultUserName;
    while (true) {
      defaultUserName = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const exists = await prisma.user.findUnique({ where: { username: defaultUserName } });
      if (!exists) break;
    }

    user = await prisma.user.create({
      data: {
        userId: userInfo.sub,
        username: defaultUserName,
      },
    });
  }

  // 5. セッションに保存
  session.user = user;
  await session.save();

// 5. 名前が仮ユーザー名なら必ず setup-name へ
if (user.username.startsWith("user_")) {
  return c.redirect('/setup-name');
}

// それ以外はトップページへ
return c.redirect('/');
});
// ルーティング
app.route('/', indexRouter);
app.route('/login', loginRouter);
app.route('/logout', logoutRouter);
app.route('/setup-name', setupNameRouter);
app.route('/users', usersRouter);
app.route('/rooms', roomRouter);
app.route('/privates', privateRouter);
app.route('/rooms', postsRouter);
app.route('/privates', postsRouter);
app.route('/account', accountRouter);
app.route('/notifications', notificationRouter);
app.use('*', serveStatic({ root: './public/stylesheets' }));
app.route('/rooms/uploads', uploadRouter);
app.route('/privates/uploads', uploadRouter);


// 404 Not Found
app.notFound((c) => {
  return c.html(
   layout(
    c,
    'Not Found',
    html`
      <h1>Not Found</h1>
      <p>${c.req.url}の内容が見つかりませんでした。</p>
    `,
  ),
  404,
  );
});

// エラーハンドリング
app.onError((error, c) => {
  console.error(error);
  const statusCode = error instanceof HTTPException ? error.status :500;
  const { NODE_ENV } = env(c);
  return c.html(
    layout(
      c,
      'Error',
      html`
      <h1>Error</h1>
      <h2>${error.name}(${statusCode})</h2>
      <p>${error.message}</p>
      ${NODE_ENV === 'development' ? html`<pre>${error.stack}</pre>` : ''}
     `,
    ),
    statusCode,
  );
});

module.exports = app;