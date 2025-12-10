
// public/notify.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('notify-btn-room');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const roomId = btn.dataset.roomId;
    const currentState = btn.dataset.notify === 'true';
    const newState = !currentState;

    try {
      const res = await fetch(`/rooms/${roomId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: newState })
      });

      if (!res.ok) throw new Error('通知設定の更新に失敗しました');

      btn.dataset.notify = newState.toString();
      btn.textContent = newState ? '🔔 通知オン' : '🔕 通知オフ';
    } catch (err) {
      console.error(err);
      alert('通知設定の更新に失敗しました');
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('notify-btn-private');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const privateId = btn.dataset.privateId;
    const currentState = btn.dataset.notify === 'true';
    const newState = !currentState;

   try {
      const res = await fetch(`/privates/${privateId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: newState })
      });

      if (!res.ok) throw new Error('通知設定の更新に失敗しました');
       btn.dataset.notify = newState.toString();
    btn.textContent = newState ?  '🔔 通知オン' : '🔕 通知オフ';
    } catch (err) {
      console.error(err);
      alert('通知設定の更新に失敗しました');
      return;
    }
  });
});