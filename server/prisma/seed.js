import prisma from '../src/db/client.js';

async function main() {
  console.log('Seed: nada para semear ainda (o conteúdo entra na Fase 3).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
