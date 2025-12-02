const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const app = new Hono();

// トップページ
app.get('/', async (c) => {

  return c.html(
  layout(
    c,
    'PBerコミュニティ',
    html`
      <h1>PBerコミュニティ</h1>
      <p>ようこそPBerコミュニティへ!</p>
      <div>
        <a href="/account">アカウント管理</a>
      </div>
      <h2>メニュー</h2>
      <div>
      <a href="/notifications" id="notif-link">
    🔔 通知 <span id="notif-count"></span>
  </a> 
</div>

<script>
async function updateNotifCount() {
  const res = await fetch('/notifications/count');
  const data = await res.json();
  const count = data.count || 0;

  const countEl = document.getElementById('notif-count');
  const linkEl = document.getElementById('notif-link');

  // カウント表示
  countEl.textContent = count > 0 ? '(' + count + ')' : '';

  // ★ 一定数（例:10件）を超えたらリンクを非表示
  if (count > 10) {
    linkEl.style.display = 'none';
  } else {
    linkEl.style.display = ''; // 再表示可能にする
  }
}

updateNotifCount();
setInterval(updateNotifCount, 10000); // 10秒ごとに更新
</script>

      </div>
      <div>
        <a href="/users">ユーザー一覧</a>
      </div>
      <div>
        <h3>ルーム・プライベートルーム作成</h3>
        <a href="/rooms/new">ルームを作る</a><br/>
        <a href="/privates/new">プライベートルームを作る</a>
      </div>
      <div>
       <h3>ルーム・プライベートルーム一覧</h3>
        <a href="/rooms/lists">ルーム一覧を見る</a><br/>
        <a href="/privates/lists">プライベートルーム一覧を見る</a>
      </div>
    `
  )
);
});

module.exports = app;