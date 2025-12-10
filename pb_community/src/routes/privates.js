const { Hono } = require('hono')
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });


const app = new Hono();

function privateTable(privates) {
  return html`
    <table>
      <tbody>
        ${privates.map(
          (p) => html`
            <tr>
              <td>
                ・<a href="/privates/${p.privateId}">${p.privateName}</a>
              </td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `;
}

app.use(ensureAuthenticated());
app.get('/new', (c) => {
  return c.html(
  layout(
    c,
    'プライベートルームの作成',
    html`
      <form method="post" action="/privates">
        <div>
          <h5>ルーム名 二十五文字まで</h5>
          <input type="text" name="privateName"  maxlength="25" />
        </div>
        <div>
          <h5>説明（なくてもOK）五十文字まで</h5>
          <textarea name="memo" rows="5" cols="40" maxlength="50" ></textarea>
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
  const username = body.username; // 招待対象ユーザー名を取得

  if (!user?.userId) return c.text('ログインしてください', 401);

  // 招待先ルーム確認
  const room = await prisma.private.findUnique({ where: { privateId } });
  if (!room) return c.text('ルームが見つかりません', 404);

  // 作成者チェック
  if (room.createBy !== user.userId) {
    return c.text('このルームの作成者のみがメンバーを招待できます', 403);
  }

  // 招待対象ユーザー検索
  const invitee = await prisma.user.findUnique({ where: { username } });
  if (!invitee) return c.text('指定されたユーザーが見つかりません', 404);

  // すでにメンバーの場合はスキップ
  const existingMember = await prisma.privateMember.findUnique({
    where: { privateId_userId: { privateId, userId: invitee.userId } },
  });
  if (existingMember) {
    return c.text(`${invitee.username} さんはすでにメンバーです`, 400);
  }

  // メンバー追加
  await prisma.privateMember.create({
    data: { privateId, userId: invitee.userId },
  });

  // 招待メッセージ投稿
  await prisma.privatePost.create({
    data: {
      privateId,
      userId: user.userId,
      content: `${user.name} さんが ${invitee.username} さんを招待しました。`,
    },
  });

  // 通知作成
   await prisma.notification.create({
  data: {
    userId: invitee.userId,
    message: `${user.name} さんがあなたをプライベートルーム "${room.privateName}" に招待しました。`,
    url: `/privates/${privateId}`,
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

app.post('/:privateId/member/exit', async (c) => {
  const { user } = c.get('session') ?? {};
  const { privateId } = c.req.param();

  if (!user?.userId) return c.text('ログインしてください', 401);

  const room = await prisma.private.findUnique({
    where: { privateId },
  });
  if (!room) return c.text('ルームが見つかりません', 404);

  // メンバーから削除
  await prisma.privateMember.deleteMany({
    where: {
      privateId,
      userId: user.userId,
    },
  });

  return c.redirect('/');
})

app.get('/lists', async (c) => {
  const { user } = c.get('session') ?? {};

  if (!user) {
    return c.redirect('/auth/google');
  }

  const privates = await prisma.private.findMany({
    where: {
      members: { some: { userId: user.userId } },
    },
    orderBy: { updatedAt: 'desc' },
    select: { privateId: true, privateName: true, updatedAt: true },
  });

  return c.html(
    layout(
      c,
      'プライベートルーム一覧',
      html`
      <a href="/">トップページに戻る</a>
        <h2>プライベートルーム一覧</h2>
        ${privates.length > 0
          ? privateTable(privates)
          : html`<p>まだ招待されているプライベートルームはありません</p>`}
      `
    )
  );
});

app.get('/:privateId', async (c) => {
  const { privateId } = c.req.param();


const private = await prisma.private.findUnique({
  where: { privateId },
  select: {
    privateName: true,
    user: {
      select: {
        username: true
      }
    }
  }
});


  if (!private) return c.text('ルームが存在しません', 404);

  const memo = await prisma.private.findUnique({
    where: { privateId },
    select: { memo: true }
  }).then(r => r?.memo);

 const posts = await prisma.privatePost.findMany({
  where: { privateId },
  orderBy: { createdAt: 'desc' },
  select: {
    postId: true,
    parentId: true,
    content: true,
    createdAt: true,
    imageUrl: true,
    thumbnailUrl: true,
    user: {
      select: { username: true, iconUrl: true }
    }
  }
});

// 親投稿だけ
const parents = posts.filter(p => p.parentId === null);

const tree = parents.map(parent => ({
  ...parent,
  replies: posts.filter(p => p.parentId === parent.postId),
  replyCount: posts.filter(p => p.parentId === parent.postId).length
}));

 const { user } = c.get('session') ?? {};
if (!user?.userId) return c.redirect('/login');

// UserRoomSetting テーブルに notify TRUE/FALSE の設定があるか探す
const setting = await prisma.userRoomSetting.findFirst({
  where: {
    privateId,
    userId: user.userId,
  },
});

// 判定用フラグ
const notifyEnabled = !!(setting && setting.notify);

const postList = tree.map((p) => `
  <div class="post" data-postid="${p.postId}">
    <p>
      <strong>${p.user.username}</strong><br/>
      <img src="${p.user.iconUrl || '/uploads/default.jpg'}" width="40">
      ${p.content || ''}<br/>
      ${p.thumbnailUrl ? `<img src="${p.thumbnailUrl}" width="200" class="zoomable" data-full="${p.imageUrl}">` : ''}
      <small>${new Date(p.createdAt).toLocaleString()}</small>
    </p>

    <!-- 返信するボタン -->
    <button class="reply-btn" data-parent="${p.postId}">返信</button>
    

    <!-- 返信一覧開閉ボタン（返信がある場合のみ） -->
<div id="reply-count-${p.postId}" data-count="${p.replyCount}">
  ${p.replyCount > 0 ? `
      <button class="toggle-replies-btn" data-parent="${p.postId}">
        ▼ ${p.replyCount}件の返信
      </button>
    ` : ''}
</div>
  

    <!-- 返信フォーム -->
    <form class="reply-form" data-parent="${p.postId}" style="display:none;">
      <textarea name="content" rows="2" placeholder="返信を書く"></textarea>
      <input type="file" name="icon" accept="image/*">
      <button type="submit">送信</button>
    </form>

    <!-- 返信一覧（最初は非表示） -->
    <div class="replies" data-parent="${p.postId}" style="display:none;">
      ${
        p.replies.map(r => `
          <div class="reply">
            <p>
              <strong>${r.user.username}</strong><br/>
              <img src="${r.user.iconUrl || '/uploads/default.jpg'}" width="40">
              ${r.content}<br/>
              ${r.thumbnailUrl ? `<img src="${r.thumbnailUrl}" width="200" class="zoomable" data-full="${r.imageUrl}">` : ''}
              <small>${new Date(r.createdAt).toLocaleString()}</small>
            </p>
            <hr/>
          </div>
        `).join('')
      }
    </div>

    <hr/>
  </div>
`).join('');

  return c.html(`
    <h1>${private.privateName}</h1>

    <a href="/privates/lists">プライベートルーム一覧に戻る</a>
    <h4>説明: ${memo || 'なし'}</h4>

    <h4>作成者: ${private.user.username}</h4>

    <form method="POST" action="/privates/${privateId}/invitation">
     <input type="text" name="username" placeholder="招待する人の名前">
     <button type="submit">招待する</button>
    </form>

    <form method="POST" action="/privates/${privateId}/member/exit" onsubmit="return confirm('本当にこのプライベートルームから退出しますか？')"
     <button type="submit">このプライベートルームから退出する</button>
     </form>

     <button id="notify-btn-private"
     data-private-id="${privateId}"
    data-notify="${notifyEnabled ? 'true' : 'false'}">
    ${notifyEnabled ? '🔔 通知オン' : '🔕 通知オフ'}
   </button>
    <script src="/notify.js"></script>

     <form action="/privates/${privateId}/memo" method="post">
  <textarea name="memo" rows="5" cols="40" maxlength="50" placeholder="ここに新しい説明"}></textarea>
  <button type="submit">更新</button>
   </form>

    <form method="POST" action="/privates/${privateId}/delete" onsubmit="return confirm('本当にこのプライベートルームを削除しますか？')">
      <button type="submit">このプライベートルームを削除する</button>
    </form>

    <div id="postList">
      ${postList || '<p>投稿はまだありません</p>'}
    </div>

  <form id="postForm">
    <textarea name="content"></textarea>
    <input type="file" name="icon" accept="image/*">
    <button type="submit">投稿</button>
  </form>

  <script>
  const loading = document.getElementById('loading');
   const privateId = "${privateId}";
    const form = document.getElementById('postForm');
    const postListContainer = document.getElementById('postList');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const content = form.querySelector('textarea[name="content"]').value;
      const fileInput = form.querySelector('input[name="icon"]');

       let imageUrl = null;
       let thumbnailUrl = null;

         if (fileInput.files.length > 0) {
        const formData = new FormData();
       formData.append('icon', fileInput.files[0]);
       const res = await fetch('/privates/uploads', { method: 'POST', body: formData });
        const data = await res.json();
       imageUrl = data.url;          
       thumbnailUrl = data.thumbnail; 
        }

      const res = await fetch(\`/privates/${privateId}/posts\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imageUrl, thumbnailUrl }),
      }); 

    const post = await res.json();

      const postHtml = \`
      <p>
        <strong>\${post.user.username}</strong><br/>
        <img src="\${post.user.iconUrl || '/uploads/default.jpg'}" alt="アイコン" width="40" height="40">
        \${post.content || ''} <br/>
        \${post.thumbnailUrl ? \`<br><img src="\${post.thumbnailUrl}" width="200" class="zoomable" data-full="\${post.imageUrl}">\` : ''}
        <small>\${new Date(post.createdAt).toLocaleString()}</small>
      </p>
      <hr/>\`;

      postListContainer.innerHTML = postHtml + postListContainer.innerHTML;
      form.reset();
    });
// 画像クリックで拡大

document.addEventListener('DOMContentLoaded', () => {
  const imgModal = document.getElementById('imgModal');
  const modalImg = document.getElementById('modalImg');

  imgModal.addEventListener('click', () => { imgModal.style.display = 'none'; });

  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG' && e.target.classList.contains('zoomable')) {
      modalImg.src = e.target.dataset.full || e.target.src;
      imgModal.style.display = 'flex';
    }
  });
});

  </script>

  <div id="imgModal" style="
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.8);
  justify-content:center;
  align-items:center;
  z-index:9999;
">
  <img id="modalImg" src="" style="max-width:90%; max-height:90%; border-radius:8px;">
</div>

<script>

// 返信ボタンの開閉
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('reply-btn')) {
    const parentId = e.target.dataset.parent;
    const form = document.querySelector(\`.reply-form[data-parent="\${parentId}"]\`);
    if (form) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
  }
});

// 返信一覧の開閉
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('toggle-replies-btn')) {
    const parentId = e.target.dataset.parent;
    const repliesBox = document.querySelector(\`.replies[data-parent="\${parentId}"]\`);

    if (!repliesBox) return;

    if (repliesBox.style.display === 'none') {
      repliesBox.style.display = 'block';
      e.target.textContent = \`▲ 返信を隠す\`;
    } else {
      repliesBox.style.display = 'none';
      e.target.textContent = \`▼ \${repliesBox.children.length}件の返信\`;
    }
  }
});

function ensureReplyToggleButton(parentId) {
  const postEl = document.querySelector(\`.post[data-postid="\${parentId}"]\`);
  if (!postEl) return;

  // 既にボタンがあるなら作らない
  if (postEl.querySelector(\`#reply-count-\${parentId}\`)) return;

  // ボタンを作成
  const btnHtml = \`
    <button class="toggle-replies-btn" 
            id="reply-count-\${parentId}" 
            data-parent="\${parentId}" 
            data-count="0">
      ▼ 0件の返信
    </button>
  \`;

  // 返信フォームの「直前」に挿入すると自然
  const replyForm = postEl.querySelector(\`.reply-form[data-parent="\${parentId}"]\`);
  replyForm.insertAdjacentHTML("beforebegin", btnHtml);
}


// 返信フォーム送信
document.addEventListener('submit', async (e) => {
  if (e.target.classList.contains('reply-form')) {
    e.preventDefault();

    const form = e.target;  // ← ここが一番重要
    const parentId = form.dataset.parent;
    const content = form.querySelector('textarea[name="content"]').value;
    const fileInput = form.querySelector('input[name="icon"]');

    let imageUrl = null;
    let thumbnailUrl = null;

    if (fileInput.files.length > 0) {
      const fd = new FormData();
      fd.append('icon', fileInput.files[0]);
      const res = await fetch('/privates/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      imageUrl = data.url;
      thumbnailUrl = data.thumbnail;
    }

    const res = await fetch(\`/privates/${privateId}/replies\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parentId, imageUrl, thumbnailUrl }),
    });

    const reply = await res.json();

    // 返信 HTML
    const replyHtml = \`
      <div class="reply">
        <p>
          <strong>\${reply.user.username}</strong><br/>
          <img src="\${reply.user.iconUrl || '/uploads/default.jpg'}" width="40">
          \${reply.content}<br/>
          \${reply.thumbnailUrl ? \`<img src="\${reply.thumbnailUrl}" width="200" class="zoomable" data-full="\${reply.imageUrl}">\` : ''}
          <small>\${new Date(reply.createdAt).toLocaleString()}</small>
        </p>
        <hr/>
      </div>
    \`;


    // 親投稿の .replies に追加
    const parentPost = document.querySelector(\`.post[data-postid="\${parentId}"] .replies\`);
    if (parentPost) {
      parentPost.insertAdjacentHTML('beforeend', replyHtml);
    }

    form.reset();
    form.style.display = 'none';

    // 返信カウント更新
    const replyCountDiv = document.getElementById(\`reply-count-\${parentId}\`);
    if (replyCountDiv) {
      let count = parseInt(replyCountDiv.dataset.count, 10) || 0;
      count += 1;
      replyCountDiv.dataset.count = count.toString();

      // ボタンテキスト更新
      const toggleBtn = replyCountDiv.querySelector('.toggle-replies-btn');
      if (toggleBtn) {
        toggleBtn.textContent = \`▼ \${count}件の返信\`;
      }
    } else {
      // まだボタンがなければ作成
      ensureReplyToggleButton(parentId);
    }
  }
}); 

// SSE受信設定
const evtSource = new EventSource(\`/privates/${privateId}/events\`);

// 新規投稿受信

evtSource.addEventListener('postCreated', (e) => {
  const post = JSON.parse(e.data);

  const postHtml = \`
  <div class="post" data-postid="\${post.postId}">
    <p>
      <strong>\${post.user.username}</strong><br/>
      <img src="\${post.user.iconUrl || '/uploads/default.jpg'}" width="40">
      \${post.content || ''}<br/>
      \${post.thumbnailUrl ? \`<img src="\${post.thumbnailUrl}" class="zoomable" width="200" data-full="\${post.imageUrl}">\` : ''}
      <small>\${new Date(post.createdAt).toLocaleString()}</small>
    </p>

    <button class="reply-btn" data-parent="\${post.postId}">返信</button>

    <form class="reply-form" data-parent="\${post.postId}" style="display:none;">
      <textarea name="content" rows="2" placeholder="返信を書く"></textarea>
      <input type="file" name="icon" accept="image/*">
      <button type="submit">送信</button>
    </form>

    <div class="replies" data-parent="\${post.postId}" style="display:none;"></div>
    <hr/>
  </div>
  \`;

  document.getElementById('postList')
          .insertAdjacentHTML('afterbegin', postHtml);
});

</script>

  `);
});


// 通知オン／オフ切り替え
app.post('/:privateId/notify', async (c) => {
  const { user } = c.get('session') ?? {};
  if (!user?.userId) return c.text('ログインしてください', 401);

  const { privateId } = c.req.param();
  const { notify } = await c.req.json();

  await prisma.userRoomSetting.upsert({
    where: { userId_privateId: { userId: user.userId, privateId } },
    update: { notify },
    create: { userId: user.userId, privateId, notify },
  });

  return c.json({ ok: true });
});

app.post('/:privateId/memo', async (c) => {
  const { user } = c.get('session') ?? {};
  const { privateId } = c.req.param();
  const body = await c.req.parseBody();
  const newMemo = body.memo;

  if (!user?.userId) {
    return c.text('ログインしてください', 401);
  }

  // ルームを取得
  const room = await prisma.private.findUnique({
    where: { privateId },
  });

  if (!room) {
    return c.text('ルームが見つかりません', 404);
  }

  // 作成者以外の編集を禁止
  if (room.createBy !== user.userId) {
    return c.text('編集権限がありません', 403);
  }

  // メモ更新
  await prisma.private.update({
    where: { privateId },
    data: { memo: newMemo },
  });

  return c.redirect(`/privates/${privateId}`);
});

module.exports = app;