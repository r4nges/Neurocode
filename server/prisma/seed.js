import prisma from '../src/db/client.js';
import { seedContent } from '../src/content/seed.js';

async function main() {
  await seedContent(prisma);
  console.log('Seed: conteúdo Front-end (HTML/CSS/JS) + roadmaps bloqueados aplicados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
