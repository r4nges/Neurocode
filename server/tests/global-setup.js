import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Roda UMA vez antes de toda a suíte. Recria um banco descartável a partir
// das migrações commitadas e semeia o conteúdo estático, garantindo
// isolamento total do dev.db e dados prontos para os testes de conteúdo.
export default async function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });

  // Importante: fixar o DATABASE_URL ANTES de importar o client. O `dotenv/config`
  // em client.js não sobrescreve env já definida, então o test.db vence o .env.
  process.env.DATABASE_URL = 'file:./test.db';
  const { default: prisma } = await import('../src/db/client.js');
  const { seedContent } = await import('../src/content/seed.js');
  await seedContent(prisma);
  await prisma.$disconnect();
}
