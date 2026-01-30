const { createMiddleware } = require('hono/factory');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function requireAdmin() {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!user || !user.isAdmin) {
      return c.json({ error: "管理者権限が必要です" }, 403);
    }
    await next();
  });
}

module.exports = requireAdmin;