const { Hono } = require('hono');

const app = new Hono();

app.get('/', (c) => {
  const session = c.get('session');
  
  if (session) {
    session.delete?.(); // 破棄できる場合だけ
  }

  return c.redirect('/login');
});

module.exports = app;
