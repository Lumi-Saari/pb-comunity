const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const app = new Hono();

// 一覧テーブル生成関数
function roomTable(rooms) {
  return html`
    <table>
      <thead>
        <tr>
          <th>ルーム名</th>
        </tr>
      </thead>
      <tbody>
        ${rooms.map(
          (room) => html`
            <tr>
              <td>
                <a href="/rooms/${room.roomId}">
                  ${room.roomName}
                </a>
              </td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `;
}

function privateTable(privates) {
  return html`
    <table>
      <thead>
        <tr>
          <th>プライベートルーム名</th>
        </tr>
      </thead>
      <tbody>
        ${privates.map(
          (private) => html`
            <tr>
              <td>
                <a href="/privates/${private.privateId}">
                  ${private.privateName}
                </a>
              </td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `;
}

// トップページ
app.get('/', async (c) => {
  const session = c.get('session');
  const { user } = c.get('session') ?? {};

let rooms = [];
let privates = [];

if (user) {
  [rooms, privates] = await Promise.all([
    prisma.Room.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { roomId: true, roomName: true, updatedAt: true },
    }),
    prisma.Private.findMany({
      where: {
        members: { some: { userId: user.userId } },
      },
      orderBy: { updatedAt: 'desc' },
      select: { privateId: true, privateName: true, updatedAt: true },
    }),
  ]);
} 

  return c.html(
  layout(
    c,
    'PB投稿者コミュニティ',
    html`
      <h1>ポーランドボール投稿者コミュニティ</h1>
      <p>ようこそポーランドボール投稿者コミュニティへ！</p>
     <div>
        <a href="/logout">ログアウト</a>
      </div>
      <div>
        <a href="/account">アカウント管理</a>
      </div>
      <h2>メニュー</h2>
      <div>
      <a href="/notifications" id="notif-link">
      🔔 通知 <span id="notif-count"></span>
      </a> 
       <script>
       async function updateNotifCount() {
        const res = await fetch('/notifications/count');
        const data = await res.json();
        const el = document.getElementById('notif-count');
        el.textContent = data.count > 0 ? '(' + data.count + ')' : '';
       }
      updateNotifCount();
       setInterval(updateNotifCount, 10000); // 10秒ごとに更新
      </script>
      </div>
      <div>
        <a href="/users">ユーザー一覧</a>
      </div>
      <div>
        <a href="/rooms/new">ルームを作る</a>
      </div>
      <div>
        <a href="/privates/new">プライベートルームを作る</a>
      </div>

      <h3>ルーム一覧</h3>
      ${rooms.length > 0
        ? roomTable(rooms)
        : html`<p>まだルームはありません</p>`}

      <h3>プライベートルーム一覧</h3>
      ${privates.length > 0
        ? privateTable(privates)
        : html`<p>まだ招待されているプライベートルームはありません</p>`}
    `
  )
);
});

module.exports = app;