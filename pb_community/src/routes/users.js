const { Hono } = require('hono');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const users = new Hono();

users.use(ensureAuthenticated());


users.get('/', async (c) => {
  const results = await prisma.user.findMany({
    where: {
      isDeleted: false,
    }
  });

  const userList = results.length > 0
    ? results.map(
        (p) => `
          <p><strong>${p.username ?? '名無しユーザー'}</strong></p>
          <hr/>
        `
      ).join('')
    : '<p>ユーザーはまだいません</p>';

  return c.html(`
    <!doctype html>
    <html>
      <head>
        <h1>ユーザー一覧</h1>
        <link rel="stylesheet" href="/stylesheets/style.css" />
      </head>
      <body>
        <div id="userList">
          ${userList}
        </div>
      </body>
    </html>
  `);
});

module.exports = users;