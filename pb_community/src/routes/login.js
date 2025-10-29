const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');

const app = new Hono();

// ログインページ
app.get('/', (c) => {
  return c.html(
    layout(
      c,
      'login',
      html`
        <h1>Login</h1>
        <a href="/auth/google">Googleでログイン</a>
      `,
    ),
  );
});

module.exports = app;