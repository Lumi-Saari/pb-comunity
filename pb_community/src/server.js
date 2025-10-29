'use strict';

(async () => {
  try {
    const { serve } = await import('@hono/node-server');
    const app = require('./app');

    // 修正: app.fetch を渡す
    serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' });
    console.log('Server started on http://localhost:3000');
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();