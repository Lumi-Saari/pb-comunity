'use strict';

describe('/login', () => {
  test('ログインのためのリンクが含まれる', async () => {
    const app = require('./app');
    const res = await app.request('/login');
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=UTF-8');
    expect(await res.text()).toMatch(/<a href="\/auth\/google\/callback"/);
    expect(res.status).toBe(200);
  });
});
