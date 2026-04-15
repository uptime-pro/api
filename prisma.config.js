// @ts-check
const { createRequire } = require('node:module');
const requireFromPrisma = createRequire(require.resolve('prisma/package.json', { paths: ['/usr/local/lib/node_modules'] }));
const { defineConfig } = requireFromPrisma('./config.js');

module.exports = defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
