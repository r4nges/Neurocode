import { defineConfig } from 'vitest/config';

// O DATABASE_URL é injetado aqui ANTES de qualquer import. Como o
// `dotenv/config` em client.js não sobrescreve variáveis já definidas,
// o test.db vence o .env. Assim nenhum teste toca o dev.db.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'test-secret-not-for-production',
      NODE_ENV: 'test',
    },
    globalSetup: './tests/global-setup.js',
    fileParallelism: false,
  },
});
