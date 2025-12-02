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
        <form method="get" action="/auth/google">
        <div><strong>以下に当てはまりますか？ 当てはまっていないのに登録するとアカウント停止の対象となる可能性があります。</strong></div><br/>
         <input id="terms" type="checkbox" required />
          <label for="terms">ポーランドボールの作品(動画、イラスト等)を投稿しています。</label>
          <br />
         <input id="rules" type="checkbox" required />
          <label for="rules">喧嘩をしないなどのコミュニティガイドラインを遵守します。</label>
          <br />
          <button type="submit">Googleでログイン</button>
        </form>
      `,
    ),
  );
});

module.exports = app;