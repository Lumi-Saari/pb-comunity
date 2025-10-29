const { createMiddleware } = require('hono/factory');

function ensureAuthenticated() {
  return createMiddleware(async (c, next) => {
    const session = c.get('session');
    if (!session || !session.user) {
      return c.redirect('/login');
  }
  await next();
 });

}

module.exports = ensureAuthenticated;